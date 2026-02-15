const db = require('../db');

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
  const code = db.generateInviteCode();
  const userId = ctx.from.id;
  db.createInviteCode(code, role, userId);
  const roleLabel = role === 'user' ? 'Пользователь' : 'Гость';
  await ctx.reply(`Инвайт-код (роль: ${roleLabel}):\n\n\`${code}\`\n\nАктивация: /activate ${code}`, {
    parse_mode: 'Markdown',
  });
  return true;
}

module.exports = {
  createInviteChooseRole,
  createInviteCallback,
};
