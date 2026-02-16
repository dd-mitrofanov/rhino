const db = require('../db');
const { escapeMarkdown } = require('../utils/escapeMarkdown');

async function inviteGuest(ctx) {
  const userId = ctx.from.id;
  const user = db.getUserById(userId);
  const limit = user?.guest_limit ?? 0;
  const invited = db.countInvitedGuests(userId);

  if (invited >= limit) {
    await ctx.reply(
      `Вы достигли лимита приглашений (${limit} гостей). Обратитесь к администратору для увеличения лимита.`
    );
    return;
  }

  const code = db.generateInviteCode();
  db.createInviteCode(code, 'guest', userId);
  
  // Получаем username бота для формирования ссылки
  const botInfo = await ctx.api.getMe();
  const botUsername = botInfo.username;
  const inviteLink = `https://t.me/${botUsername}?start=${code}`;
  
  await ctx.reply(
    `Одноразовый инвайт-код для гостя:\n\n\`${escapeMarkdown(code)}\`\n\n` +
    `Ссылка для активации:\n${escapeMarkdown(inviteLink)}\n\n` +
    `Передайте ссылку тому, кого хотите пригласить. Или используйте команду: /start ${escapeMarkdown(code)}`,
    {
      parse_mode: 'Markdown',
    }
  );
}

module.exports = { inviteGuest };
