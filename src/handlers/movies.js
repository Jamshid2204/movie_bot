// New / Popular movie lists with pagination, and movie delivery via copyMessage.
const { config } = require('../config');
const {
  getNewMovies,
  getPopularMovies,
  countMovies,
  getMovieById,
  incrementDownloads,
} = require('../db');
const { movieListKeyboard, backToMenuKeyboard } = require('../keyboards');

const PAGE_SIZE = config.pageSize;

/** Send (or edit to) a page of movies. kind = 'new' | 'pop'. */
async function showPage(bot, chatId, kind, page, messageId) {
  const [movies, total] = await Promise.all([
    kind === 'new' ? getNewMovies(page, PAGE_SIZE) : getPopularMovies(page, PAGE_SIZE),
    countMovies(),
  ]);

  const title = kind === 'new' ? '🆕 *New Movies*' : '🔥 *Popular Movies*';

  if (total === 0) {
    const text = `${title}\n\nNo movies yet. Check back later.`;
    const opts = { parse_mode: 'Markdown', reply_markup: backToMenuKeyboard() };
    if (messageId) {
      return bot.editMessageText(text, { chat_id: chatId, message_id: messageId, ...opts });
    }
    return bot.sendMessage(chatId, text, opts);
  }

  const keyboard = movieListKeyboard(movies, kind, page, total);
  const text = `${title}\n\nTap a movie to receive it:`;

  if (messageId) {
    try {
      return await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (err) {
      // edit can fail if content is identical or message is too old; fall back to send.
      if (!/not modified|message is not modified/i.test(err.message)) {
        return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
      }
    }
  }
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function registerMovieListHandlers(bot) {
  // list:new:<page> or list:pop:<page>
  bot.on('callback_query', async (cq) => {
    const m = /^list:(new|pop):(\d+)$/.exec(cq.data);
    if (!m) return;
    const kind = m[1];
    const page = Math.max(1, Number(m[2]));
    const chatId = cq.message.chat.id;
    await bot.answerCallbackQuery(cq.id).catch(() => {});
    await showPage(bot, chatId, kind, page, cq.message.message_id);
  });
}

function registerDeliveryHandler(bot) {
  // get:<id> -> copy the file from the storage channel to the user.
  bot.on('callback_query', async (cq) => {
    const m = /^get:(\d+)$/.exec(cq.data);
    if (!m) return;
    const id = Number(m[1]);
    const chatId = cq.message.chat.id;
    const userId = cq.from.id;

    try {
      const movie = await getMovieById(id);
      if (!movie) {
        return bot.answerCallbackQuery(cq.id, {
          text: 'Movie not found.',
          show_alert: true,
        });
      }

      // Ack the tap with the movie title.
      await bot.answerCallbackQuery(cq.id, { text: `Sending: ${movie.title}` });

      // copyMessage forwards a copy without the "Forwarded from" header.
      await bot.copyMessage(chatId, movie.channel_id, movie.message_id, {
        caption: formatCaption(movie),
        parse_mode: 'Markdown',
      });

      await incrementDownloads(movie.id);
    } catch (err) {
      console.error('[delivery] error:', err.message);
      await bot.sendMessage(
        chatId,
        '⚠️ Could not deliver this movie. The file may have been removed from the storage channel.',
        { reply_markup: backToMenuKeyboard() }
      );
    }
  });
}

function formatCaption(m) {
  const bits = [m.title];
  if (m.year) bits.push(`(${m.year})`);
  let cap = bits.join(' ');
  const meta = [m.genre, m.quality, m.language].filter(Boolean).join(' • ');
  if (meta) cap += `\n${meta}`;
  cap += `\n\nCode: \`${m.code}\``;
  return cap;
}

module.exports = { registerMovieListHandlers, registerDeliveryHandler, showPage };
