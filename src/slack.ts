import type { Env } from "./types";

export async function postSlackMessage(
  env: Env,
  text: string,
  threadTs?: string
): Promise<string> {
  const payload: Record<string, string> = {
    channel: env.SLACK_CHANNEL_ID,
    text,
  };
  if (threadTs) {
    payload.thread_ts = threadTs;
  }

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Slack API error: ${res.status}`);
  }

  const data = (await res.json()) as { ok: boolean; ts: string; error?: string };
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data.ts;
}

export async function verifySlackRequest(
  request: Request,
  signingSecret: string
): Promise<boolean> {
  const timestamp = request.headers.get("X-Slack-Request-Timestamp");
  const signature = request.headers.get("X-Slack-Signature");

  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const body = await request.clone().text();
  const sigBasestring = `v0:${timestamp}:${body}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(sigBasestring)
  );

  const hexSig =
    "v0=" +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  return hexSig === signature;
}
