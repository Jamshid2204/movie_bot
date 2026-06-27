// Inline keyboard builders. Keep callback_data short — Telegram limits it to 64 bytes.
// Conventions used across handlers:
//   menu         -> show main menu
//   check        -> re-run forced-subscription check
//   join:<link>  -> a "Join channel" button (URL button, not callback)
//   list:new:<p> -> show "New" page p
//   list:pop:<p> -> show "Popular" page p
//   get:<id>     -> deliver movie with this DB id
//   search       -> enter search mode

const { config } = require('./config');

/** Main menu shown after the user passes the fsub gate. */
function mainMenu() {
  return {
    inline_keyboard: [
      [{ text: '🆕 New Movies', callback_data: 'list:new:1' }],
      [{ text: '🔥 Popular', callback_data: 'list:pop:1' }],
      [{ text: '🔍 Search', callback_data: 'search' }],
    ],
  };
}

// NOTE: the forced-subscription join keyboard is built in fsub.js
// (buildJoinKeyboardRows), because resolving invite links requires async
// bot.getChat() calls and must degrade gracefully when no URL is available.

/**
 * Build the inline keyboard for a page of movies.
 * @param {Array} movies  - movie rows from the DB
 * @param {string} kind   - 'new' | 'pop'
 * @param {number} page   - current page (1-based)
 * @param {number} total  - total movie count
 */
function movieListKeyboard(movies, kind, page, total) {
  const pageSize = config.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // One button per movie. Show code + title (truncate to fit one line).
  const rows = movies.map((m) => [
    {
      text: `🎬 ${m.code} — ${truncate(m.title, 38)}${m.quality ? ` [${m.quality}]` : ''}`,
      callback_data: `get:${m.id}`,
    },
  ]);

  // Pagination row.
  const nav = [];
  if (page > 1) nav.push({ text: '◀️ Prev', callback_data: `list:${kind}:${page - 1}` });
  nav.push({ text: `${page}/${totalPages}`, callback_data: 'noop' });
  if (page < totalPages) nav.push({ text: 'Next ▶️', callback_data: `list:${kind}:${page + 1}` });
  rows.push(nav);

  // Back to menu.
  rows.push([{ text: '🏠 Menu', callback_data: 'menu' }]);

  return { inline_keyboard: rows };
}

/** After-delivery keyboard so the user can go back to browsing. */
function backToMenuKeyboard() {
  return {
    inline_keyboard: [[{ text: '🏠 Back to menu', callback_data: 'menu' }]],
  };
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

module.exports = {
  mainMenu,
  movieListKeyboard,
  backToMenuKeyboard,
};
