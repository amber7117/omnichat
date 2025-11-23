## OmniChat Backend (Express + Prisma)

- Node 20+, TypeScript, Express, Prisma/PostgreSQL, JWT auth (access + refresh), Socket.IO for tenant events.
- Project root: `packages/backend`. Prisma models: `packages/backend/prisma/schema.prisma`.

### Runtime layout
- `src/index.ts` – boots Express + Socket.IO.
- `src/app.ts` – middleware (helmet, cors, logging), health, route registration.
- `src/routes` – route mounting.
- `src/modules/auth` – register/login/refresh/me.
- `src/modules/channels` – channel instance CRUD (per tenant).
- `src/modules/inbound` – normalized inbound message ingestion and conversation upsert.
- `src/modules/agents` – hook for AI auto-reply pipeline.
- `src/utils/socket.ts` – shared Socket.IO server (`join-channel`, `leave-channel` rooms for tenant/channel scoped events).

### Environment
- `PORT` (default 3001), `CORS_ORIGIN` (comma separated), `SOCKET_PATH` (default `/socket.io`).
- `DATABASE_URL` (Postgres), `JWT_SECRET`, `JWT_REFRESH_SECRET` (fallback to JWT_SECRET), `JWT_ACCESS_TTL` (default `15m`), `JWT_REFRESH_TTL` (default `30d`).

### Auth API
- `POST /api/auth/register { email, password, name?, tenantName? }` → creates Tenant + first User (role `owner`), returns `{ accessToken, refreshToken, user, tenant }`.
- `POST /api/auth/login { email, password }` → returns tokens + user+tenant.
- `POST /api/auth/refresh { refreshToken }` → verifies stored hashed refresh token, rotates token.
- `GET /api/auth/me` (Bearer) → `{ user, tenantId }`.
- Tokens payload: `{ userId, tenantId, email }`.

### Channel API (per tenant, Bearer)
- `POST /api/channels` `{ name, type, metadata?, config?, externalId? }` → creates `ChannelInstance` with status `DISCONNECTED`.
- `GET /api/channels` → list tenant channel instances (for “Add channel” UI).
- Server uses Socket.IO rooms: client should call `joinChannel(channelInstanceId)` for QR/status events.

### Inbound normalization
- Type: `InboundMessagePayload` (`src/types/index.ts`): `{ tenantId, channelInstanceId, channelType, externalUserId, externalConversationId?, text?, attachments?, raw, timestamp }`.
- `handleInboundMessage`:
  1) Validates channel/tenant.
  2) Upserts `Customer` by `channelInstanceId + externalUserId`.
  3) Finds/creates `Conversation` (open conversation per customer or provider conversation id).
  4) Stores `Message` (direction `INBOUND`), updates `lastMessageAt`.
  5) Calls `handleAutoReply` hook (stub for now) to trigger Agents + outbound queue.
  6) Emits Socket.IO notification (future) to inbox UI rooms.

### Data model highlights (`packages/backend/prisma/schema.prisma`)
- **Multi-tenant**: `Tenant` → `User` (role, passwordHash), `RefreshToken` (hashed).
- **Channels**: `ChannelInstance` (type enum includes `WHATSAPP`, `TELEGRAM_USER`, `TELEGRAM_BOT`, `FACEBOOK`, `WIDGET`; statuses `DISCONNECTED|CONNECTING|CONNECTED|ERROR`; config/metadata JSON).
- **Customers & Conversations**: `Customer` unique on `(channelInstanceId, externalId)`, `Conversation` with status `OPEN|CLOSED|SNOOZED`, `Message` with direction `INBOUND|OUTBOUND|SYSTEM`.
- **AI Agents**: `Agent`, `AgentTeam`, `AgentTeamMember`, `AgentCollaboration` to capture multi-agent reasoning logs.
- **Queueing**: `ChannelMessageQueue` for outbound retries (`status PENDING|SENDING|SENT|FAILED|DEAD`, `nextRetryAt`).
- **Channel sessions**: `WhatsAppSession`/`WhatsAppKey` (Baileys auth state), `TelegramSession` (user or bot).

### WhatsApp (Baileys) flow
- Create `ChannelInstance` type `WHATSAPP` → backend starts Baileys socket using Postgres auth state backed by `WhatsAppSession`/`WhatsAppKey`.
- On `qr` event: store QR + expiry (cache/DB) and emit `whatsapp-qr` via Socket.IO to room `channelInstanceId`.
- On `connection === 'open'`: persist auth state, mark `ChannelInstance.status = CONNECTED`, emit `whatsapp-connected`.
- On messages: map to `InboundMessagePayload` (externalUserId = JID, externalConversationId = chatId), call `handleInboundMessage`.
- On outbound: enqueue to `ChannelMessageQueue`, Baileys send handler consumes queue with retry.
- On server start: bootstrap sockets for existing connected/connecting WhatsApp channel instances.

### Telegram flow
- **Bot**: `POST /api/telegram/bot/webhook/:channelInstanceId` receives updates, resolves `ChannelInstance` (type `TELEGRAM_BOT`, token in `config.botToken`), normalizes inbound (externalUserId = from.id, externalConversationId = chat.id) to `handleInboundMessage`. Outbound can reuse Bot API with stored token.
- **User (MTProto)**: `POST /api/telegram/user/start` sends login code (requires `TELEGRAM_API_ID/HASH` env); `POST /api/telegram/user/confirm` completes login and stores session in `TelegramSession` (sessionType `user`); `POST /api/telegram/user/logout` clears session. Stored under tenant `ChannelInstance` type `TELEGRAM_USER`.
  - Listener: MTProto listener boots from saved sessions, subscribes to new messages, normalizes to `handleInboundMessage` with `channelType: 'telegram-user'`.

### Facebook Page Messenger
- Webhook endpoint (`/api/facebook/webhook`) validates verify token (`FACEBOOK_VERIFY_TOKEN`), resolves `ChannelInstance` by page id (`externalId`), normalizes inbound to `handleInboundMessage`. Outbound uses Graph API with `config.pageAccessToken`.

### WebSocket events (rooms = channelInstanceId)
- `whatsapp-qr` `{ qr, expiresAt }`
- `whatsapp-connected` `{ channelInstanceId }`
- `channel-status` `{ channelInstanceId, status }`
- `message-created` `{ channelInstanceId, conversationId, message }` (emitted on inbound, manual send, auto-reply).
- `conversation-updated` `{ channelInstanceId, conversation }` when `lastMessageAt` changes.

### Outbound sending
- `POST /api/messages/send` (Bearer) enqueues outbound text for a conversation/customer. Creates `Message` (OUTBOUND) and `ChannelMessageQueue` entry.
- Outbound worker (interval) consumes queue, dispatches per channel using conversation/customer external ids:
  - WhatsApp: Baileys socket; target = `conversation.externalConversationId` or `customer.externalId`.
  - Telegram bot: Bot API; target chat = `conversation.externalConversationId` or `customer.externalId`.
  - Telegram user (MTProto): MTProto client; target = `conversation.externalConversationId` or `customer.externalId`.
  - Facebook: Graph API; recipient PSID = `customer.externalId`, token in `channel.config.pageAccessToken`.
  - TODO: web widget, others.

### Media/attachments
- Inbound mapping:
  - WhatsApp: captures image/video/audio/document/location metadata (URL if provided by Baileys, plus hashes/keys) into `attachments`.
  - Telegram bot: stores `fileId`/mime info in `attachments.extra`; URLs not fetched server-side.
  - Telegram user: records basic media identifiers from MTProto update.
  - Facebook: maps message attachments with `payload.url` when available.
- Outbound: `/api/messages/send` accepts `attachments` (url + type). Worker sends first attachment where supported:
  - WhatsApp: image/video/audio/document via Baileys if URL provided; falls back to text.
  - Telegram bot/user: sendPhoto/sendVideo/sendAudio/sendDocument (bot) or `sendFile` (user) with URL.
  - Facebook: uses Graph API attachment payload with URL.

### Auto-reply (initial stub)
- `handleAutoReply` picks first active `Agent` for tenant, applies a cooldown (30s per conversation), runs `runAgentReply` (OpenAI if `OPENAI_API_KEY` present, fallback echo) using agent config (prompt/model/temperature), writes outbound message, enqueues to queue, and emits socket events. Replace with richer tooling as needed.

### Healthcheck
- `/health` returns status and DB connectivity (`db: up|down`, uptime, timestamp); uses `SELECT 1` to verify Postgres.

### Auto-reply (initial stub)
- `handleAutoReply` picks first active `Agent` for tenant, creates outbound `Message` with echo-style reply, and enqueues to `ChannelMessageQueue`.
- Replace `buildSimpleReply` with real LLM/tooling pipeline to honor agent prompt/config; keep payload shape for queue.

### Next implementation steps
- Add real Baileys Postgres auth state helper and socket lifecycle manager.
- Implement Telegram bot webhook + MTProto login/session persistence.
- Add Facebook webhook endpoint + outbound sender.
- Wire `handleAutoReply` to an Agent runner (LLM prompt, tool calls) and queue outbound messages.
- Add migrations + `prisma generate` setup, tests for auth and message ingestion, and role-based access control.
