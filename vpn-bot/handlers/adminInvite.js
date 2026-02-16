const db = require('../db');
const { escapeMarkdown } = require('../utils/escapeMarkdown');

function getAwaitingGuestLimitState(session) {
  return session?.awaitingInviteGuestLimit;
}

function setAwaitingGuestLimitState(session, role) {
  if (!session) return;
  session.awaitingInviteGuestLimit = { role };
}

function clearAwaitingGuestLimitState(session) {
  if (session) session.awaitingInviteGuestLimit = null;
}

async function createInviteChooseRole(ctx) {
  const keyboard = {
    inline_keyboard: [
      [{ text: 'Пользователь (user)', callback_data: 'invrole:user' }],
      [{ text: 'Гость (guest)', callback_data: 'invrole:guest' }],
    ],
  };
  await ctx.reply('Выберите роль для инвайт-кода:', { reply_markup: keyboard });
}

async function createInviteCallback(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('invrole:')) return false;
  const role = data.slice(8);
  if (role !== 'user' && role !== 'guest') return false;
  await ctx.answerCallbackQuery();

  if (role === 'guest') {
    await finishCreateInvite(ctx, role, null);
    return true;
  }

  // Для роли user — спрашиваем лимит гостей
  setAwaitingGuestLimitState(ctx.session, role);
  await ctx.reply('Сколько гостей может пригласить этот Пользователь? Введите число (0 = не может приглашать):');
  return true;
}

async function handleGuestLimitMessage(ctx, session, text) {
  const state = getAwaitingGuestLimitState(session);
  if (!state) return false;

  const num = parseInt(text.trim(), 10);
  if (Number.isNaN(num) || num < 0) {
    await ctx.reply('Введите корректное число (0 или больше):');
    return true;
  }

  clearAwaitingGuestLimitState(session);
  await finishCreateInvite(ctx, state.role, num);
  return true;
}

async function finishCreateInvite(ctx, role, guestLimit) {
  const code = db.generateInviteCode();
  const userId = ctx.from.id;
  db.createInviteCode(code, role, userId, role === 'user' ? guestLimit : null);
  const roleLabel = role === 'user' ? 'Пользователь' : 'Гость';
  const limitInfo = role === 'user' ? ` (лимит гостей: ${guestLimit})` : '';

  const botInfo = await ctx.api.getMe();
  const botUsername = botInfo.username;
  const inviteLink = `https://t.me/${botUsername}?start=${code}`;

  await ctx.reply(
    `Инвайт-код (роль: ${roleLabel}${limitInfo}):\n\n\`${escapeMarkdown(code)}\`\n\n` +
    `Ссылка для активации:\n${escapeMarkdown(inviteLink)}\n\n` +
    `Или используйте команду: /start ${escapeMarkdown(code)}`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = {
  createInviteChooseRole,
  createInviteCallback,
  getAwaitingGuestLimitState,
  handleGuestLimitMessage,
};
