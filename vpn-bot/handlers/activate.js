const db = require('../db');

async function activate(ctx, code) {
  if (!code || !code.trim()) {
    await ctx.reply('Использование: /activate <код>\nПример: /activate abc12xyz');
    return;
  }
  const userId = ctx.from.id;
  const existing = db.getUserById(userId);
  if (existing) {
    await ctx.reply('Вы уже зарегистрированы. Используйте /start для меню.');
    return;
  }
  const invite = db.getInviteByCode(code.trim());
  if (!invite) {
    await ctx.reply('Код не найден или недействителен.');
    return;
  }
  if (invite.used_by != null) {
    await ctx.reply('Этот код уже был использован.');
    return;
  }
  db.createUser(userId, invite.role, invite.created_by);
  db.useInviteCode(invite.code, userId);
  const roleLabel = invite.role === 'user' ? 'Пользователь' : 'Гость';
  await ctx.reply(`Код активирован! Ваша роль: ${roleLabel}. Используйте /start для меню.`);
}

module.exports = { activate };
