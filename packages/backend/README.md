# OmniChat Backend

Express + Prisma, PostgreSQL, JWT auth, Socket.IO. See `docs/backend/architecture.md` for design details.

## Setup
1) Create `.env` in `packages/backend`:
```
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/omnichat
JWT_SECRET=replace-me
JWT_REFRESH_SECRET=replace-me
CORS_ORIGIN=http://localhost:3000
```
2) Install deps and generate Prisma client:
```
pnpm install
pnpm --filter @omnichat/backend prisma:generate
```
3) Run migrations and start dev server:
```
pnpm --filter @omnichat/backend prisma:migrate dev --name init
pnpm --filter @omnichat/backend dev
```

## API (initial)
- `POST /api/auth/register` – create tenant + user, returns tokens.
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me` (Bearer)
- `POST /api/channels` / `GET /api/channels` (Bearer)
- `POST /api/telegram/bot/webhook/:channelInstanceId` – Telegram bot inbound webhook (token stored in `ChannelInstance.config.botToken`).
- `POST /api/telegram/user/start|confirm|logout` – MTProto user login flow (Bearer; needs `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` env).
- `POST /api/messages/send` (Bearer) – enqueue outbound text to a channel/conversation; worker delivers via channel connector.
- `GET/POST /api/facebook/webhook` – Messenger webhook (verify with `FACEBOOK_VERIFY_TOKEN`, resolves channel by `externalId` = page id; outbound uses `config.pageAccessToken`).
