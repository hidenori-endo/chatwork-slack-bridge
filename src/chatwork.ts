import type { Env, ChatworkMessage } from "./types";

const CHATWORK_API_BASE = "https://api.chatwork.com/v2";

export async function fetchNewMessages(env: Env): Promise<ChatworkMessage[]> {
  const res = await fetch(
    `${CHATWORK_API_BASE}/rooms/${env.CHATWORK_ROOM_ID}/messages?force=1`,
    {
      headers: { "X-ChatWorkToken": env.CHATWORK_API_TOKEN },
    }
  );

  console.log(`fetchNewMessages: status=${res.status}`);

  if (res.status === 204) {
    console.log("fetchNewMessages: no new messages (204)");
    return [];
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`fetchNewMessages: error ${res.status} ${text}`);
    throw new Error(`Chatwork API error: ${res.status} ${text}`);
  }

  const messages = await res.json() as ChatworkMessage[];
  console.log(`fetchNewMessages: got ${messages.length} messages`);
  return messages;
}

export async function postChatworkMessage(
  env: Env,
  body: string
): Promise<string> {
  const res = await fetch(
    `${CHATWORK_API_BASE}/rooms/${env.CHATWORK_ROOM_ID}/messages`,
    {
      method: "POST",
      headers: {
        "X-ChatWorkToken": env.CHATWORK_API_TOKEN,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ body }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chatwork POST error: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { message_id: string };
  return data.message_id;
}
