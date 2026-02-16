const db = require('../db');

function getSetGuestLimitState(session) {
  return session?.awaitingSetGuestLimit;
}

function setSetGuestLimitState(session, step, userId = null) {
  if (!session) return;
  session.awaitingSetGuestLimit = step === null ? null : { step, userId };
}

function clearSetGuestLimitState(session) {
  if (session) session.awaitingSetGuestLimit = null;
}

async function setGuestLimitAsk(ctx) {
  const users = db.getAllUsers().filter((u) => u.role === 'user');
  if (users.length === 0) {
    await ctx.reply('Нет пользователей с ролью «Пользователь».');
    return;
  }
  setSetGuestLimitState(ctx.session, 'user', null);
  await ctx.reply(
    'Введите Telegram ID пользователя (число) или нажмите кнопку для выбора из списка.',
    {
      reply_markup: {
        inline_keyboard: [[{ text: 'Выбрать из списка', callback_data: 'setguestlimit_list' }]],
      },
    }
  );
}

async function handleSetGuestLimitMessage(ctx, session, text) {
  const state = getSetGuestLimitState(session);
  if (!state) return false;

  if (state.step === 'user') {
    const userId = parseInt(text.trim(), 10);
    if (Number.isNaN(userId)) {
      await ctx.reply('Введите корректный Telegram ID (число).');
      return true;
    }
    const user = db.getUserById(userId);
    if (!user) {
      await ctx.reply('Пользователь не найден.');
      clearSetGuestLimitState(session);
      return true;
    }
    if (user.role !== 'user') {
      await ctx.reply('Лимит гостей можно изменить только для пользователей с ролью «Пользователь».');
      clearSetGuestLimitState(session);
      return true;
    }
    setSetGuestLimitState(session, 'limit', userId);
    const invited = db.countInvitedGuests(userId);
    await ctx.reply(
      `Пользователь: ${user.username ? `@${user.username}` : `ID: ${userId}`}. ` +
      `Текущий лимит: ${user.guest_limit ?? 0}. Уже приглашено гостей: ${invited}.\n\nВведите новый лимит (число):`
    );
    return true;
  }

  if (state.step === 'limit') {
    const limit = parseInt(text.trim(), 10);
    if (Number.isNaN(limit) || limit < 0) {
      await ctx.reply('Введите корректное число (0 или больше):');
      return true;
    }
    const userId = state.userId;
    db.updateUserGuestLimit(userId, limit);
    clearSetGuestLimitState(session);
    const user = db.getUserById(userId);
    const userName = user?.username ? `@${user.username}` : `ID: ${userId}`;
    await ctx.reply(`Лимит гостей для ${userName} установлен: ${limit}.`);
    return true;
  }

  return false;
}

async function setGuestLimitListCallback(ctx) {
  if (ctx.callbackQuery?.data !== 'setguestlimit_list') return false;
  await ctx.answerCallbackQuery();
  const users = db.getAllUsers().filter((u) => u.role === 'user');
  if (users.length === 0) {
    await ctx.reply('Нет пользователей с ролью «Пользователь».');
    clearSetGuestLimitState(ctx.session);
    return true;
  }
  const keyboard = {
    inline_keyboard: users.map((u) => {
      const invited = db.countInvitedGuests(u.id);
      const label = u.username ? `@${u.username}` : `ID: ${u.id}`;
      return [{ text: `${label} (лимит: ${u.guest_limit ?? 0}, приглашено: ${invited})`, callback_data: `setguestlimit:${u.id}` }];
    }),
  };
  await ctx.reply('Выберите пользователя:', { reply_markup: keyboard });
  return true;
}

async function setGuestLimitSelectCallback(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('setguestlimit:')) return false;
  const userId = parseInt(data.slice(14), 10);
  await ctx.answerCallbackQuery();
  const user = db.getUserById(userId);
  if (!user || user.role !== 'user') {
    await ctx.reply('Пользователь не найден.');
    return true;
  }
  setSetGuestLimitState(ctx.session, 'limit', userId);
  const invited = db.countInvitedGuests(userId);
  await ctx.reply(
    `Пользователь: ${user.username ? `@${user.username}` : `ID: ${userId}`}. ` +
    `Текущий лимит: ${user.guest_limit ?? 0}. Уже приглашено гостей: ${invited}.\n\nВведите новый лимит (число):`
  );
  return true;
}

module.exports = {
  getSetGuestLimitState,
  setGuestLimitAsk,
  handleSetGuestLimitMessage,
  setGuestLimitListCallback,
  setGuestLimitSelectCallback,
};
