// Bot entry point. Initializes the Telegram bot (long polling), wires up the
// forced-subscription gate, and registers all handlers.
const TelegramBot = require('node-telegram-bot-api');
const { config, validate } = require('./config');
const { enforce, hasJoinedAll } = require('./fsub');
const { mainMenu } = require('./keyboards');
const { registerStartHandler } = require('./handlers/start');
const { registerMovieListHandlers, registerDeliveryHandler } = require('./handlers/movies');
const { registerSearchHandler } = require('./handlers/search');
const { registerAdminHandler } = require('./handlers/admin');

validate();

const bot = new TelegramBot(config.botToken, { polling: true });

bot.on('polling_error', (err) => console.error('[bot] polling_error:', err.message));
bot.on('webhook_error', (err) => console.error('[bot] webhook_error:', err.message));

console.log(`[bot] starting… storage=${config.storageChannelId} requiredChannels=${config.requiredChannels.length}`);

// --- Core routing ---

// /start and /menu commands and the `menu`/`check` callbacks.
registerStartHandler(bot);

// Movie lists (New/Popular + pagination) and delivery (get:<id>).
registerMovieListHandlers(bot);
registerDeliveryHandler(bot);

// Search.
registerSearchHandler(bot);

// Admin (/stats, optional /delete).
registerAdminHandler(bot);

// Noop callback (e.g. the "1/3" page indicator) — swallow it so Telegram doesn't spin.
bot.on('callback_query', (cq) => {
  if (cq.data === 'noop') bot.answerCallbackQuery(cq.id).catch(() => {});
});

// Graceful shutdown.
function shutdown(signal) {
  console.log(`[bot] ${signal} received, stopping…`);
  bot.stopPolling().finally(() => process.exit(0));
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { bot };
