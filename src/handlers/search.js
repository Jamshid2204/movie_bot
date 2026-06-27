// Search by title or code.
// Flow: user taps 🔍 Search -> bot asks for a query -> next text message is the query.
const { searchMovies } = require('../db');
const { movieListKeyboard, backToMenuKeyboard } = require('../keyboards');

// Track which users are in "search mode" (waiting for a text query).
const searching = new Set();

function registerSearchHandler(bot) {
  // Search button.
  bot.on('callback_query', async (cq) => {
    if (cq.data !== 'search') return;
    searching.add(cq.from.id);
    await bot.answerCallbackQuery(cq.id).catch(() => {});
    await bot.editMessageText(
      '🔍 *Search*\n\nSend me a movie title or code (e.g. `MOV-0001` or `matrix`).',
      {
        chat_id: cq.message.chat.id,
        message_id: cq.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: backToMenuKeyboard(),
      }
    );
  });

  // Receive the query text.
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return; // ignore commands
    if (!searching.has(msg.from.id)) return;
    searching.delete(msg.from.id);

    const results = await searchMovies(msg.text);
    if (results.length === 0) {
      return bot.sendMessage(
        msg.chat.id,
        `No results for "${msg.text}".`,
        { reply_markup: backToMenuKeyboard() }
      );
    }

    const total = results.length;
    const keyboard = movieListKeyboard(results, 'new', 1, total); // reuse the list builder
    await bot.sendMessage(msg.chat.id, `Found *${results.length}* result(s):`, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  });
}

module.exports = { registerSearchHandler };
