const db = require('../db');

async function inviteGuest(ctx) {
  const code = db.generateInviteCode();
  const userId = ctx.from.id;
  db.createInviteCode(code, 'guest', userId);
  
  // Получаем username бота для формирования ссылки
  const botInfo = await ctx.api.getMe();
  const botUsername = botInfo.username;
  const inviteLink = `https://t.me/${botUsername}?start=${code}`;
  
  await ctx.reply(
    `Одноразовый инвайт-код для гостя:\n\n\`${code}\`\n\n` +
    `Ссылка для активации:\n${inviteLink}\n\n` +
    `Передайте ссылку тому, кого хотите пригласить. Или используйте команду: /start ${code}`,
    {
      parse_mode: 'Markdown',
    }
  );
}

module.exports = { inviteGuest };
