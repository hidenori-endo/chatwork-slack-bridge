export interface Env {
  KV: KVNamespace;
  CHATWORK_API_TOKEN: string;
  CHATWORK_ROOM_ID: string;
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  SLACK_CHANNEL_ID: string;
  SLACK_MENTION_USER_ID: string;
  CHATWORK_SKIP_ACCOUNT_NAME?: string;
}

export interface ChatworkMessage {
  message_id: string;
  account: {
    account_id: number;
    name: string;
    avatar_image_url: string;
  };
  body: string;
  send_time: number;
  update_time: number;
}

export interface SlackEvent {
  type: string;
  challenge?: string;
  event?: {
    type: string;
    channel: string;
    text: string;
    user: string;
    thread_ts?: string;
    ts: string;
    bot_id?: string;
  };
}

export interface MessageMapping {
  chatworkMessageId: string;
  slackTs: string;
  slackThreadTs?: string;
}
