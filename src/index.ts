import type { Env, SlackEvent, MessageMapping } from "./types";
import { fetchNewMessages, postChatworkMessage } from "./chatwork";
import { postSlackMessage, verifySlackRequest } from "./slack";

// Marker to identify messages posted by the bridge (avoid infinite loop)
const BRIDGE_MARKER = "[bridge]";

// Strip Chatwork-specific tags like [rp ...], [qt ...][/qt], [To:...], [info][/info], [piconname:...], etc.
function stripChatworkTags(text: string): string {
  return text
    .replace(/\[rp[^\]]*\]/g, "")
    .replace(/\[qt\][^]*?\[\/qt\]/g, "")
    .replace(/\[(?:To|toall|piconname|picon):[^\]]*\]/g, "")
    .replace(/\[\/?(info|title|code|hr)\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default {
  // HTTP handler: receives Slack events (replies)
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("OK", { status: 200 });
    }

    const url = new URL(request.url);

    if (url.pathname === "/slack/events") {
      return handleSlackEvent(request, env);
    }

    return new Response("Not found", { status: 404 });
  },

  // Cron handler: polls Chatwork for new messages
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(pollChatworkAndForward(env));
  },
};

async function pollChatworkAndForward(env: Env): Promise<void> {
  console.log("pollChatworkAndForward: start");
  const messages = await fetchNewMessages(env);
  console.log(`pollChatworkAndForward: fetched ${messages.length} messages`);

  for (const msg of messages) {
    // Skip messages posted by the bridge
    if (msg.body.startsWith(BRIDGE_MARKER)) continue;

    // Skip own messages
    if (env.CHATWORK_SKIP_ACCOUNT_NAME && msg.account.name === env.CHATWORK_SKIP_ACCOUNT_NAME) continue;

    // Check if already forwarded
    const existing = await env.KV.get(`cw:${msg.message_id}`);
    if (existing) continue;

    const cleanBody = stripChatworkTags(msg.body);
    if (!cleanBody) continue;
    const slackText = `<@${env.SLACK_MENTION_USER_ID}> *${msg.account.name}* (Chatwork):\n${cleanBody}`;
    const slackTs = await postSlackMessage(env, slackText);

    // Store mapping: Chatwork message ID → Slack thread ts
    const mapping: MessageMapping = {
      chatworkMessageId: msg.message_id,
      slackTs,
    };
    await env.KV.put(`cw:${msg.message_id}`, JSON.stringify(mapping), {
      expirationTtl: 60 * 60 * 24 * 30, // 30 days
    });
    await env.KV.put(`slack:${slackTs}`, JSON.stringify(mapping), {
      expirationTtl: 60 * 60 * 24 * 30,
    });
  }
}

async function handleSlackEvent(
  request: Request,
  env: Env
): Promise<Response> {
  // Clone request so we can read body twice (once for challenge check, once for verify)
  const cloned = request.clone();
  const body = (await cloned.json()) as SlackEvent;

  // Handle Slack URL verification challenge (before signature verification)
  if (body.type === "url_verification") {
    return new Response(JSON.stringify({ challenge: body.challenge }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify Slack signature for all other requests
  const isValid = await verifySlackRequest(request, env.SLACK_SIGNING_SECRET);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  // Handle message events
  if (body.type === "event_callback" && body.event) {
    const event = body.event;

    if (
      event.type === "message" &&
      event.channel === env.SLACK_CHANNEL_ID &&
      !event.bot_id // Ignore bot messages (prevents loop)
    ) {
      if (event.thread_ts) {
        // Thread reply: forward to Chatwork if it's a bridged thread
        const mappingJson = await env.KV.get(`slack:${event.thread_ts}`);
        if (mappingJson) {
          const replyBody = `${BRIDGE_MARKER} ${event.text}`;
          await postChatworkMessage(env, replyBody);
        }
      } else {
        // Direct channel message: forward to Chatwork
        const replyBody = `${BRIDGE_MARKER} ${event.text}`;
        await postChatworkMessage(env, replyBody);
      }
    }
  }

  return new Response("OK", { status: 200 });
}
