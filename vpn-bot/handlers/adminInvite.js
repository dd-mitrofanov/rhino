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
  
  // Получаем username бота для формирования ссылки
  const botInfo = await ctx.api.getMe();
  const botUsername = botInfo.username;
  const inviteLink = `https://t.me/${botUsername}?start=${code}`;
  
  await ctx.reply(
    `Инвайт-код (роль: ${roleLabel}):\n\n\`${code}\`\n\n` +
    `Ссылка для активации:\n${inviteLink}\n\n` +
    `Или используйте команду: /start ${code}`,
    {
      parse_mode: 'Markdown',
    }
  );
  return true;
}

module.exports = {
  createInviteChooseRole,
  createInviteCallback,
};
