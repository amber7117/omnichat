# Media Handling & AI Setup Instructions

## 1. Prerequisites
- **Node.js** (v18+) and **pnpm** installed.

## 2. Environment Configuration
Ensure `packages/backend/.env` has the following configurations:

```dotenv
# Database (SQLite - No Docker required)
DATABASE_URL="file:./dev.db"

# Cloudflare R2 (Required for Media Storage)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-public-r2-url.com

# OpenAI (Required for Transcription & Summarization)
OPENAI_API_KEY=sk-your-openai-key
```

## 3. Sync Database Schema
Apply the database schema changes (this will create `dev.db`):

```bash
cd packages/backend
npx prisma db push
```

## 4. Start the Backend
Start the backend server:

```bash
pnpm dev
```

## 5. Verification
1. Send a **Voice Note** or **Video** to the connected WhatsApp number.
2. Check the logs:
   - You should see "WhatsApp message received".
   - You should see "Uploaded file to R2".
   - You should see "Transcription success".
3. Open the **Frontend Workbench**:
   - The message should appear with an audio/video player.
   - The text content should include `[AUDIO TRANSCRIPTION]: ...`.
   - The AI Agent should reply to the content of the voice note.
