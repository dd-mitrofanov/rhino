const db = require('../db');
const { escapeMarkdown } = require('../utils/escapeMarkdown');

async function keysOfAsk(ctx) {
  await ctx.reply(
    'Введите Telegram ID пользователя (число) или нажмите кнопку для выбора из списка.',
    {
      reply_markup: {
        inline_keyboard: [[{ text: 'Выбрать из списка', callback_data: 'keysof_list' }]],
      },
    }
  );
}

async function keysOfByUserId(ctx, userIdStr) {
  const userId = parseInt(userIdStr.trim(), 10);
  if (Number.isNaN(userId)) {
    await ctx.reply('Введите корректный Telegram ID (число).');
    return true;
  }
  const user = db.getUserById(userId);
  if (!user) {
    await ctx.reply('Пользователь не найден.');
    return true;
  }
  const keys = db.getKeysByUserId(userId);
  if (keys.length === 0) {
    const userName = user.username ? `@${user.username}` : `ID: ${userId}`;
    await ctx.reply(`У пользователя ${userName} (${user.role}) нет ключей.`);
    return true;
  }
  const userName = user.username ? `@${escapeMarkdown(user.username)}` : `ID: ${userId}`;
  let text = `Ключи пользователя ${userName} (${user.role}):\n\n`;
  let currentServer = null;
  for (const k of keys) {
    if (k.server_name !== currentServer) {
      currentServer = k.server_name;
      text += `**${escapeMarkdown(currentServer)}**\n`;
    }
    text += `• ${escapeMarkdown(k.key_name)}\n\`\`\`\n${escapeMarkdown(k.vless_link)}\n\`\`\`\n`;
  }
  await ctx.reply(text, { parse_mode: 'Markdown' });
  return true;
}

async function keysOfListCallback(ctx) {
  if (ctx.callbackQuery?.data !== 'keysof_list') return false;
  await ctx.answerCallbackQuery();
  const users = db.getUsersWithKeyCount();
  const withKeys = users.filter((u) => u.key_count > 0);
  if (withKeys.length === 0) {
    await ctx.reply('Нет пользователей с ключами.');
    return true;
  }
  const keyboard = {
    inline_keyboard: withKeys.map((u) => {
      const userName = u.username ? `@${u.username}` : `ID: ${u.id}`;
      return [{ text: `${userName} (${u.role}, ключей: ${u.key_count})`, callback_data: `keysof:${u.id}` }];
    }),
  };
  await ctx.reply('Выберите пользователя:', { reply_markup: keyboard });
  return true;
}

async function keysOfSelectCallback(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('keysof:')) return false;
  const userId = parseInt(data.slice(7), 10);
  await ctx.answerCallbackQuery();
  await keysOfByUserId(ctx, String(userId));
  return true;
}

function listUsers(ctx) {
  const rows = db.getUsersWithKeyCount();
  if (rows.length === 0) {
    return ctx.reply('Нет пользователей.');
  }
  const roleLabel = (r) => ({ admin: 'admin', user: 'user', guest: 'guest' }[r] || r);
  let text = '';
  for (const u of rows) {
    const date = u.created_at ? new Date(u.created_at).toLocaleString() : '—';
    const userName = u.username ? `@${u.username}` : `ID: ${u.id}`;
    text += `• ${userName} — ${roleLabel(u.role)}, ключей: ${u.key_count}, зарегистрирован: ${date}\n`;
  }
  return ctx.reply(text.trim());
}

module.exports = {
  keysOfAsk,
  keysOfByUserId,
  keysOfListCallback,
  keysOfSelectCallback,
  listUsers,
};
