// Centralized config. Reads env vars (with dotenv) and parses the structured ones
// (REQUIRED_CHANNELS, ADMIN_IDS) into friendly structures.
require('dotenv').config();

// A "required channel" entry can be supplied in any of these forms per item:
//   @username                  -> public channel username
//   username                   -> public channel username (no @)
//   -1001234567890             -> numeric chat id (private channel)
//   <id-or-username>:<url>     -> explicit id/username + invite URL override
// Items are comma-separated. For username/id without a URL, the invite link is
// resolved at runtime via bot.getChat() (see fsub.js).
function parseRequiredChannels(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      // If the entry contains a URL (http/https/t.me), split on its FIRST colon.
      // We detect a URL by looking for "://" or "t.me".
      const hasUrl = /:\/\//.test(entry) || /t\.me/i.test(entry);
      if (hasUrl) {
        const idx = entry.indexOf(':');
        const target = entry.slice(0, idx).trim();
        const inviteLink = entry.slice(idx + 1).trim();
        return { target, inviteLink };
      }
      // No URL — whole entry is the target (username or numeric id).
      // A stray colon that isn't part of a URL is treated as a separator too.
      if (entry.includes(':')) {
        const idx = entry.indexOf(':');
        return { target: entry.slice(0, idx).trim(), inviteLink: entry.slice(idx + 1).trim() };
      }
      return { target: entry, inviteLink: '' };
    })
    .filter((c) => c.target);
}

function parseAdminIds(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}

const requiredChannels = parseRequiredChannels(process.env.REQUIRED_CHANNELS);

const config = {
  botToken: process.env.BOT_TOKEN || '',
  storageChannelId: process.env.STORAGE_CHANNEL_ID || '',
  requiredChannels,
  adminIds: parseAdminIds(process.env.ADMIN_IDS),
  // Number of movies per page in New/Popular lists.
  pageSize: Number(process.env.MOVIES_PER_PAGE || process.env.PAGE_SIZE) || 8,
};

// Fail fast on missing critical config (don't crash silently later).
function validate() {
  const missing = [];
  if (!config.botToken) missing.push('BOT_TOKEN');
  if (!config.storageChannelId) missing.push('STORAGE_CHANNEL_ID');
  if (!config.requiredChannels.length) missing.push('REQUIRED_CHANNELS');
  if (missing.length) {
    console.error(
      `[config] Missing required env var(s): ${missing.join(', ')}. Fill in bot/.env and restart.`
    );
    process.exit(1);
  }
}

module.exports = { config, validate };
