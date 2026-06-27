// /start and /menu commands + the `menu` and `check` callbacks.
// The fsub gate is enforced on /start and on every `check`.
const { enforce, hasJoinedAll } = require('../fsub');
const { mainMenu } = require('../keyboards');

const WELCOME =
  '👋 *Welcome to Movie Bot!*\n\n' +
  'Browse the library and get movies delivered straight to your chat.\n\n' +
  'Pick an option:';

function showMenu(bot, chatId) {
  return bot.sendMessage(chatId, WELCOME, {
    parse_mode: 'Markdown',
    reply_markup: mainMenu(),
  });
}

function registerStartHandler(bot) {
  // /start — gate first, then menu.
  bot.onText(/^\/start($|\s)/, async (msg) => {
    const passed = await enforce(bot, msg);
    if (passed) await showMenu(bot, msg.chat.id);
  });

  // /menu — admin bypass not desired; gate everyone.
  bot.onText(/^\/menu($|\s)/, async (msg) => {
    const passed = await enforce(bot, msg);
    if (passed) await showMenu(bot, msg.chat.id);
  });

  // Re-verify membership when the user taps "Check".
  bot.on('callback_query', async (cq) => {
    if (cq.data !== 'check') return;
    const chatId = cq.message.chat.id;
    const userId = cq.from.id;
    try {
      const ok = await hasJoinedAll(bot, userId);
      if (ok) {
        await bot.answerCallbackQuery(cq.id, { text: '✅ Unlocked!' });
        await bot.editMessageText(WELCOME, {
          chat_id: chatId,
          message_id: cq.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: mainMenu(),
        });
      } else {
        await bot.answerCallbackQuery(cq.id, {
          text: '❌ Still missing some channels. Join them all, then try again.',
          show_alert: true,
        });
      }
    } catch (err) {
      console.error('[start] check callback error:', err.message);
      bot.answerCallbackQuery(cq.id).catch(() => {});
    }
  });

  // `menu` callback from inline buttons.
  bot.on('callback_query', (cq) => {
    if (cq.data !== 'menu') return;
    bot
      .editMessageText(WELCOME, {
        chat_id: cq.message.chat.id,
        message_id: cq.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: mainMenu(),
      })
      .catch(() => showMenu(bot, cq.message.chat.id)); // fallback if message is too old to edit
    bot.answerCallbackQuery(cq.id).catch(() => {});
  });
}

module.exports = { registerStartHandler, showMenu };
