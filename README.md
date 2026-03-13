# Chatwork-Slack Bridge

Chatwork の特定ルームのメッセージを Slack チャンネルに転送し、Slack のスレッド返信を Chatwork に返すブリッジ。Cloudflare Workers + KV で動作。

## 仕組み

- **Chatwork → Slack**: Cron Trigger（10分間隔）で Chatwork API をポーリングし、新着メッセージを Slack に投稿
- **Slack → Chatwork**: Slack Events API で スレッド返信を受信し、Chatwork に投稿
- **KV**: メッセージの対応関係を保持（30日TTL）

## セットアップ

### 1. Cloudflare KV Namespace 作成

```bash
npx wrangler kv namespace create KV
```

出力された ID を `wrangler.toml` の `id` に設定。

### 2. Secrets 設定

```bash
npx wrangler secret put CHATWORK_API_TOKEN
npx wrangler secret put CHATWORK_ROOM_ID
npx wrangler secret put SLACK_BOT_TOKEN
npx wrangler secret put SLACK_SIGNING_SECRET
npx wrangler secret put SLACK_CHANNEL_ID
```

### 3. Slack App 設定

1. [Slack API](https://api.slack.com/apps) で App を作成
2. **OAuth & Permissions** で以下の Bot Token Scopes を追加:
   - `chat:write`
   - `channels:history`（パブリックチャンネルの場合）
3. App をワークスペースにインストールし、Bot Token を取得
4. **Event Subscriptions** を有効化:
   - Request URL: `https://chatwork-slack-bridge.<your-subdomain>.workers.dev/slack/events`
   - Subscribe to bot events: `message.channels`
5. Bot を対象チャンネルに招待

### 4. デプロイ

```bash
npm run deploy
```

### 5. ローカル開発

```bash
npm run dev
```
