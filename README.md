# Movie Bot (Telegram)

Pure Telegram bot — no web server. **Self-contained project**: talks to a shared
**Supabase** project directly (Postgres), so it has no filesystem coupling to the
dashboard. Deploy it anywhere (VPS, container, your PC) — it only needs outbound
internet.

## What it does

1. **Forced-subscription gate**: on `/start`, verify the user has joined every channel in
   `REQUIRED_CHANNELS`. If not, show Join buttons + a Check button.
2. **Browse**: 🆕 New / 🔥 Popular lists with pagination, plus 🔍 Search by title or code.
3. **Deliver**: tapping a movie `copyMessage`s the file from the storage channel — no
   "Forwarded from" label — and increments the download counter.
4. **Admin**: `/stats`, `/delete MOV-0001`.

## Prerequisites

- Node.js v16+
- A Supabase project with the `movies` table + RLS + RPC functions set up.
  Follow [`../SUPABASE_SETUP.md`](../SUPABASE_SETUP.md) once (5 minutes).
- The bot must be an **admin** of the storage channel (to read/copy messages) and of
  every required channel (so `getChatMember` works).

## Setup

```bash
npm install
cp .env.example .env   # then fill in BOT_TOKEN, channels, ADMIN_IDS, and the Supabase vars
npm start
# or: npm run dev   (node --watch, Node 18+)
```

## How it works

- `src/index.js` boots polling and registers handlers.
- `src/fsub.js` is the gate — `getChatMember` per required channel.
- `src/supabase.js` initializes the Supabase client with the **service_role** key
  (bypasses RLS — the bot can read/write movies without logging in as a user).
- `src/db.js` wraps all movie queries. Exports the same function names the handlers use.
- Handlers live in `src/handlers/` and communicate via `callback_data` strings
  (`menu`, `check`, `list:new:2`, `get:42`, `search`, `noop`).

## Notes

- The **service_role key** in `.env` is powerful — keep it secret. It is the only reason
  the bot can write to `movies` without going through Supabase Auth.
- If a movie row points at a deleted storage-channel message, delivery fails gracefully and
  the user sees a friendly error.
