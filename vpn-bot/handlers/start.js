const db = require('../db');

async function start(ctx) {
  const inviteCode = ctx.message?.text?.split(/\s+/)[1]; // Получаем код из /start <code>
  
  // Если передан инвайт-код, обрабатываем его как активацию
  if (inviteCode) {
    const activateHandler = require('./activate');
    const activated = await activateHandler.activate(ctx, inviteCode);
    // Если активация прошла успешно, показываем меню
    if (activated) {
      // Обновляем userDoc после активации
      const db = require('../db');
      ctx.userDoc = db.getUserById(ctx.from.id);
      // Продолжаем выполнение для показа меню
    } else {
      return; // Активация не удалась, выходим
    }
  }

  const user = ctx.userDoc;
  if (!user) {
    await ctx.reply(
      'Добро пожаловать! Для доступа к боту необходимо активировать инвайт-код.\n\n' +
        'Используйте команду:\n/activate <код>'
    );
    return;
  }
  
  const roleLabel = { admin: 'Администратор', user: 'Пользователь', guest: 'Гость' }[user.role];
  const text = `Добро пожаловать! Вы вошли как **${roleLabel}**.\n\nВыберите действие:`;
  
  // Формируем кнопки в зависимости от роли
  const keyboard = {
    inline_keyboard: [
      [{ text: '🔑 Мои ключи', callback_data: 'cmd:mykeys' }],
      [{ text: '➕ Создать ключ', callback_data: 'cmd:generatekey' }],
      [{ text: '🗑 Отозвать ключ', callback_data: 'cmd:revokekey' }],
    ],
  };

  if (user.role === 'user') {
    keyboard.inline_keyboard.push([{ text: '👤 Пригласить гостя', callback_data: 'cmd:inviteguest' }]);
  }

  if (user.role === 'admin') {
    keyboard.inline_keyboard.push(
      [{ text: '⚙️ Админ панель', callback_data: 'cmd:admin_panel' }]
    );
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

module.exports = { start };
