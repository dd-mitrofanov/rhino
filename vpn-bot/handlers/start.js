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
  text += '/my_keys — мои ключи\n';
  text += '/generate_key — создать ключ\n';
  text += '/revoke_key — отозвать ключ\n';
  if (user.role === 'user') {
    text += '/invite_guest — пригласить гостя\n';
  }
  if (user.role === 'admin') {
    text += '\n— Админ —\n';
    text += '/add_server — добавить сервер\n';
    text += '/delete_server — удалить сервер\n';
    text += '/list_servers — список серверов\n';
    text += '/create_invite — создать инвайт\n';
    text += '/revoke_key — отозвать ключ (любого)\n';
    text += '/keys_of — ключи пользователя\n';
    text += '/list_users — список пользователей\n';
  }
  await ctx.reply(text, { parse_mode: 'Markdown' });
}

module.exports = { start };
