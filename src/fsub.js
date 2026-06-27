// Forced-subscription gate.
// Before the bot does anything useful, the user must be a member of every
// channel listed in REQUIRED_CHANNELS. We verify via getChatMember.
//
// Each required channel is a { target, inviteLink } where target is a username
// (@name / name) or a numeric chat id, and inviteLink is optional. If no
// invite link is configured, we try to derive one:
//   - public username  -> https://t.me/<username>
//   - anything else    -> call bot.getChat(target) for chat.invite_link

const { config } = require('./config');

// Telegram membership statuses that count as "joined".
const JOINED_STATUSES = new Set(['creator', 'administrator', 'member']);

// In-memory cache of resolved invite links, keyed by target.
const inviteLinkCache = new Map();

function normalizeTarget(target) {
  if (!target) return '';
  const t = String(target).trim();
  return t.startsWith('@') ? t.slice(1) : t;
}

/** Try to find or build an invite URL for a channel target. Never throws. */
async function resolveInviteLink(bot, channel) {
  if (channel.inviteLink && /^https?:\/\//i.test(channel.inviteLink)) {
    return channel.inviteLink;
  }
  if (inviteLinkCache.has(channel.target)) {
    return inviteLinkCache.get(channel.target);
  }

  const name = normalizeTarget(channel.target);
  // Public username -> canonical t.me URL.
  const looksPublic = /^[A-Za-z0-9_]{5,}$/.test(name);
  if (looksPublic) {
    const url = `https://t.me/${name}`;
    inviteLinkCache.set(channel.target, url);
    return url;
  }

  // Otherwise ask Telegram for the channel's invite link.
  try {
    const chat = await bot.getChat(channel.target);
    const link = chat.invite_link || chat.username ? (chat.invite_link || `https://t.me/${chat.username}`) : '';
    if (link) {
      inviteLinkCache.set(channel.target, link);
      return link;
    }
  } catch (err) {
    console.error(`[fsub] getChat failed for ${channel.target}:`, err.message);
  }
  return '';
}

/** Is the user currently a member of one specific channel? */
async function isMember(bot, target, userId) {
  try {
    const member = await bot.getChatMember(target, userId);
    return JOINED_STATUSES.has(member.status);
  } catch (err) {
    // Common cause: bot is not admin in that channel, or target is wrong.
    console.error(`[fsub] getChatMember failed for ${target}:`, err.message);
    // Fail safe: treat as not joined so we don't accidentally bypass the gate.
    return false;
  }
}

/** Has the user joined ALL required channels? */
async function hasJoinedAll(bot, userId) {
  for (const ch of config.requiredChannels) {
    const ok = await isMember(bot, ch.target, userId);
    if (!ok) return false;
  }
  return true;
}

/**
 * Build the inline keyboard for the join prompt. Returns a 2D array of buttons
 * (suitable for inline_keyboard). Channels without a resolvable link are shown
 * as a plain text note rather than an invalid URL button.
 */
async function buildJoinKeyboardRows(bot) {
  const rows = [];
  for (let i = 0; i < config.requiredChannels.length; i++) {
    const ch = config.requiredChannels[i];
    const url = await resolveInviteLink(bot, ch);
    const label = `➕ Join Channel ${i + 1}`;
    if (url) {
      rows.push([{ text: label, url }]);
    } else {
      // No valid URL -> render as a callback button that just informs the user.
      rows.push([{ text: `${label} (${ch.target})`, callback_data: 'noop' }]);
    }
  }
  rows.push([{ text: '✅ I joined — Check', callback_data: 'check' }]);
  return rows;
}

/**
 * Returns true if the user passed the gate and may proceed.
 * If not, sends the join prompt and returns false so the caller can bail out.
 * Never throws — any Telegram API error is logged and swallowed.
 */
async function enforce(bot, msg) {
  const userId = msg.from.id;
  let ok = false;
  try {
    ok = await hasJoinedAll(bot, userId);
  } catch (err) {
    console.error('[fsub] hasJoinedAll error:', err.message);
    ok = false;
  }
  if (ok) return true;

  try {
    const rows = await buildJoinKeyboardRows(bot);
    await bot.sendMessage(
      msg.chat.id,
      '🔒 *Join our channels to unlock the bot*\n\n' +
        'Please join all of the channels below, then press *Check*.',
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }
    );
  } catch (err) {
    console.error('[fsub] failed to send join prompt:', err.message);
    // Last resort: send a plain text message without any keyboard.
    bot.sendMessage(
      msg.chat.id,
      '🔒 Please join our required channels, then send /start again.'
    ).catch(() => {});
  }
  return false;
}

module.exports = {
  isMember,
  hasJoinedAll,
  enforce,
  resolveInviteLink,
  JOINED_STATUSES,
};
