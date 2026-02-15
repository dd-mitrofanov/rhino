const db = require('../db');
const api = require('../api');

async function revokeKeyAdminListUsers(ctx) {
  const users = db.getUsersWithKeyCount();
  const withKeys = users.filter((u) => u.key_count > 0);
  if (withKeys.length === 0) {
    await ctx.reply('Нет пользователей с ключами.');
    return;
  }
  const keyboard = {
    inline_keyboard: withKeys.map((u) => [
      { text: `${u.id} (${u.role}, ключей: ${u.key_count})`, callback_data: `arevoke_user:${u.id}` },
    ]),
  };
  await ctx.reply('Выберите пользователя:', { reply_markup: keyboard });
}

async function revokeKeyAdminListKeys(ctx, targetUserId) {
  const byServer = db.getKeysByUserId(targetUserId);
  if (byServer.length === 0) {
    await ctx.reply('У пользователя нет ключей.');
    return true;
  }
  const byServerMap = {};
  for (const k of byServer) {
    if (!byServerMap[k.server_id]) byServerMap[k.server_id] = { serverName: k.server_name, keys: [] };
    byServerMap[k.server_id].keys.push(k);
  }
  const buttons = [];
  for (const [, { serverName, keys }] of Object.entries(byServerMap)) {
    for (const k of keys) {
      buttons.push([{ text: `${serverName}: ${k.key_name}`, callback_data: `arevoke:${k.id}` }]);
    }
  }
  await ctx.reply('Выберите ключ для отзыва:', {
    reply_markup: { inline_keyboard: buttons },
  });
  return true;
}

async function revokeKeyAdminCallback(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('arevoke_user:')) return false;
  const userId = parseInt(data.slice(13), 10);
  if (Number.isNaN(userId)) return false;
  await ctx.answerCallbackQuery();
  await revokeKeyAdminListKeys(ctx, userId);
  return true;
}

async function revokeKeyAdminConfirmCallback(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('arevoke:')) return false;
  const keyId = parseInt(data.slice(8), 10);
  if (Number.isNaN(keyId)) return false;
  await ctx.answerCallbackQuery();
  const key = db.getKeyById(keyId);
  if (!key) {
    await ctx.reply('Ключ не найден.');
    return true;
  }
  const server = { api_url: key.api_url, api_token: key.api_token };
  const msg = await ctx.reply('Отзываю ключ...');
  try {
    await api.rejectKey(server, key.key_id);
    db.deleteKey(keyId);
    await ctx.api.editMessageText(ctx.chat.id, msg.message_id, `Ключ «${key.key_name}» отозван.`);
  } catch (err) {
    let text = 'Не удалось отозвать ключ. ' + (err.message || '');
    await ctx.api.editMessageText(ctx.chat.id, msg.message_id, text);
  }
  return true;
}

module.exports = {
  revokeKeyAdminListUsers,
  revokeKeyAdminListKeys,
  revokeKeyAdminCallback,
  revokeKeyAdminConfirmCallback,
};
