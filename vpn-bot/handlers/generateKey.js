const db = require('../db');
const api = require('../api');
const { escapeMarkdown } = require('../utils/escapeMarkdown');

const KEY_LIMIT = 2;

async function sendServerList(ctx) {
  const servers = db.getAllServers();
  if (servers.length === 0) {
    await ctx.reply('Нет доступных серверов. Обратитесь к администратору.');
    return;
  }
  const keyboard = {
    inline_keyboard: servers.map((s) => [{ text: s.name, callback_data: `genkey:${s.id}` }]),
  };
  await ctx.reply('Выберите сервер для создания ключа:', { reply_markup: keyboard });
}

async function handleGenerateKey(ctx) {
  await sendServerList(ctx);
}

async function handleGenerateKeyCallback(ctx) {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith('genkey:')) return false;
  const serverId = parseInt(data.slice(7), 10);
  if (Number.isNaN(serverId)) return false;

  await ctx.answerCallbackQuery();
  const userId = ctx.from.id;
  const server = db.getServerById(serverId);
  if (!server) {
    await ctx.reply('Сервер не найден.');
    return true;
  }
  const count = db.countKeysByUserAndServer(userId, serverId);
  if (count >= KEY_LIMIT) {
    await ctx.reply(`На сервере «${server.name}» у вас уже ${KEY_LIMIT} ключа. Лимит: ${KEY_LIMIT} на сервер.`);
    return true;
  }
  const msg = await ctx.reply('Создаю ключ...');
  try {
    const result = await api.generateKey(server, userId);
    db.insertKey(
      result.keyId,
      userId,
      serverId,
      result.uuid,
      result.shortId,
      result.keyName,
      result.vlessLink
    );
    await ctx.api.editMessageText(ctx.chat.id, msg.message_id,
      `Ключ создан (${escapeMarkdown(server.name)}):\n\n\`\`\`\n${escapeMarkdown(result.vlessLink)}\n\`\`\``,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    const status = err.status;
    let text = 'Не удалось создать ключ. ';
    if (status === 401) text += 'Ошибка авторизации API (проверьте токен сервера).';
    else if (status === 404) text += 'Сервер вернул ошибку.';
    else if (status >= 500) text += 'Сервер временно недоступен.';
    else text += err.message || 'Неизвестная ошибка.';
    await ctx.api.editMessageText(ctx.chat.id, msg.message_id, text);
  }
  return true;
}

module.exports = {
  handleGenerateKey,
  handleGenerateKeyCallback,
  sendServerList,
};
