const db = require('../db');
const api = require('../api');

function buildKeyKeyboard(keysByServer, prefix) {
  const buttons = [];
  for (const [serverId, { serverName, keys }] of Object.entries(keysByServer)) {
    for (const k of keys) {
      buttons.push([{ text: `${serverName}: ${k.key_name}`, callback_data: `${prefix}:${k.id}` }]);
    }
  }
  return { inline_keyboard: buttons };
}

async function revokeKeyOwn(ctx) {
  const userId = ctx.from.id;
  const byServer = db.getKeysByServerForUser(userId);
  const entries = Object.entries(byServer);
  if (entries.length === 0) {
    await ctx.reply('У вас нет ключей для отзыва.');
    return;
  }
  const keyboard = buildKeyKeyboard(byServer, 'revoke');
  await ctx.reply('Выберите ключ для отзыва:', { reply_markup: keyboard });
}

async function handleRevokeConfirm(ctx, keyId, isAdmin = false) {
  const key = db.getKeyById(keyId);
  if (!key) {
    await ctx.reply('Ключ не найден.');
    return true;
  }
  const userId = ctx.from.id;
  if (!isAdmin && key.user_id !== userId) {
    await ctx.reply('Вы можете отзывать только свои ключи.');
    return true;
  }
  const server = { api_url: key.api_url, api_token: key.api_token };
  const msg = await ctx.reply('Отзываю ключ...');
  try {
    await api.rejectKey(server, key.key_id);
    db.deleteKey(keyId);
    await ctx.api.editMessageText(ctx.chat.id, msg.message_id, `Ключ «${key.key_name}» отозван.`);
  } catch (err) {
    let text = 'Не удалось отозвать ключ. ';
    if (err.status === 401) text += 'Ошибка авторизации API.';
    else if (err.status === 404) text += 'Ключ не найден на сервере.';
    else text += err.message || 'Неизвестная ошибка.';
    await ctx.api.editMessageText(ctx.chat.id, msg.message_id, text);
  }
  return true;
}

async function handleRevokeCallback(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('revoke:')) return false;
  const keyId = parseInt(data.slice(7), 10);
  if (Number.isNaN(keyId)) return false;
  await ctx.answerCallbackQuery();
  await handleRevokeConfirm(ctx, keyId, false);
  return true;
}

module.exports = {
  revokeKeyOwn,
  handleRevokeConfirm,
  handleRevokeCallback,
  buildKeyKeyboard,
};
