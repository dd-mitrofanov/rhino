const db = require('../db');

async function start(ctx) {
  const user = ctx.userDoc;
  if (!user) {
    await ctx.reply(
      'Добро пожаловать! Для доступа к боту необходимо активировать инвайт-код.\n\n' +
        'Используйте команду:\n/activate <код>'
    );
    return;
  }
  const roleLabel = { admin: 'Администратор', user: 'Пользователь', guest: 'Гость' }[user.role];
  let text = `Добро пожаловать! Вы вошли как **${roleLabel}**.\n\nДоступные команды:\n`;
  text += '/mykeys — мои ключи\n';
  text += '/generatekey — создать ключ\n';
  text += '/revokekey — отозвать ключ\n';
  if (user.role === 'user') {
    text += '/inviteguest — пригласить гостя\n';
  }
  if (user.role === 'admin') {
    text += '\n— Админ —\n';
    text += '/addserver — добавить сервер\n';
    text += '/deleteserver — удалить сервер\n';
    text += '/listservers — список серверов\n';
    text += '/createinvite — создать инвайт\n';
    text += '/revokekey — отозвать ключ (любого)\n';
    text += '/keysof — ключи пользователя\n';
    text += '/listusers — список пользователей\n';
  }
  await ctx.reply(text, { parse_mode: 'Markdown' });
}

module.exports = { start };
