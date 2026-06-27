// Admin commands: /stats (and an optional /delete).
const { config } = require('../config');
const { getStats, deleteByCode } = require('../db');

function isAdmin(userId) {
  return config.adminIds.includes(userId);
}

function registerAdminHandler(bot) {
  bot.onText(/^\/stats($|\s)/, async (msg) => {
    if (!isAdmin(msg.from.id)) return; // silent ignore for non-admins
    const { total, downloads, top } = await getStats();
    const topStr = top.length
      ? top.map((t, i) => `${i + 1}. ${t.code} — ${t.title} (${t.downloads})`).join('\n')
      : '—';

    await bot.sendMessage(
      msg.chat.id,
      `📊 *Stats*\n\nMovies: *${total}*\nTotal downloads: *${downloads}*\n\n*Top 5:*\n${topStr}`,
      { parse_mode: 'Markdown' }
    );
  });

  // Optional: delete a movie by code, e.g. /delete MOV-0001
  bot.onText(/^\/delete\s+(\S+)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const code = match[1].toUpperCase();
    const { count } = await deleteByCode(code);
    await bot.sendMessage(
      msg.chat.id,
      count ? `✅ Deleted ${code}.` : `❌ No movie with code ${code}.`
    );
  });
}

module.exports = { registerAdminHandler };
