const db = require('../db');

async function inviteGuest(ctx) {
  const code = db.generateInviteCode();
  const userId = ctx.from.id;
  db.createInviteCode(code, 'guest', userId);
  await ctx.reply(`Одноразовый инвайт-код для гостя:\n\n\`${code}\`\n\nПередайте его тому, кого хотите пригласить. Активация: /activate ${code}`, {
    parse_mode: 'Markdown',
  });
}

module.exports = { inviteGuest };
