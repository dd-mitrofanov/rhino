const db = require('../db');
const { escapeMarkdown } = require('../utils/escapeMarkdown');

const ADD_SERVER_STEPS = ['name', 'ip', 'port', 'api_token'];

function getAddServerState(session) {
  return session?.addServer;
}

function setAddServerState(session, state) {
  if (!session) return;
  session.addServer = state;
}

function clearAddServerState(session) {
  if (session) session.addServer = null;
}

async function addServerStart(ctx, session) {
  setAddServerState(session, { step: 'name' });
  await ctx.reply('Введите отображаемое имя сервера (например: Main VPN):');
}

async function addServerHandleMessage(ctx, session, text) {
  const state = getAddServerState(session);
  if (!state) return false;

  if (state.step === 'name') {
    state.name = text.trim();
    state.step = 'ip';
    await ctx.reply('Введите IP-адрес сервера:');
    return true;
  }
  if (state.step === 'ip') {
    state.ip = text.trim();
    state.step = 'port';
    await ctx.reply('Введите порт API (например: 3000):');
    return true;
  }
  if (state.step === 'port') {
    const port = parseInt(text.trim(), 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      await ctx.reply('Введите корректный порт (1–65535):');
      return true;
    }
    state.port = port;
    state.step = 'api_token';
    await ctx.reply('Введите API-токен (TOKEN из настроек приложения на сервере):');
    return true;
  }
  if (state.step === 'api_token') {
    state.api_token = text.trim();
    const { name, ip, port, api_token } = state;
    // Формируем api_url из IP и порта
    const api_url = `http://${ip}:${port}`;
    db.addServer(name, ip, port, api_token, api_url);
    clearAddServerState(session);
    await ctx.reply(`Сервер «${name}» добавлен.\nAPI URL: ${api_url}`);
    return true;
  }
  return false;
}

async function deleteServerList(ctx) {
  const servers = db.getAllServers();
  if (servers.length === 0) {
    await ctx.reply('Нет добавленных серверов.');
    return;
  }
  const keyboard = {
    inline_keyboard: servers.map((s) => [{ text: s.name, callback_data: `delsrv:${s.id}` }]),
  };
  await ctx.reply(
    'Выберите сервер для удаления. Внимание: все ключи этого сервера будут удалены из бота и перестанут работать на сервере.',
    { reply_markup: keyboard }
  );
}

async function deleteServerCallback(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('delsrv:')) return false;
  const serverId = parseInt(data.slice(7), 10);
  if (Number.isNaN(serverId)) return false;
  await ctx.answerCallbackQuery();
  const server = db.getServerById(serverId);
  if (!server) {
    await ctx.reply('Сервер не найден.');
    return true;
  }
  const keyboard = {
    inline_keyboard: [
      [{ text: 'Да, удалить', callback_data: `delsrv_confirm:${serverId}` }],
      [{ text: 'Отмена', callback_data: 'delsrv_cancel' }],
    ],
  };
  await ctx.reply(`Подтвердите удаление сервера «${server.name}»? Все ключи будут удалены.`, {
    reply_markup: keyboard,
  });
  return true;
}

async function deleteServerConfirmCallback(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('delsrv_confirm:')) return false;
  const serverId = parseInt(data.slice(15), 10);
  await ctx.answerCallbackQuery();
  const server = db.getServerById(serverId);
  if (!server) {
    await ctx.reply('Сервер не найден.');
    return true;
  }
  db.deleteServer(serverId);
  await ctx.reply(`Сервер «${server.name}» удалён.`);
  return true;
}

async function deleteServerCancelCallback(ctx) {
  if (ctx.callbackQuery?.data !== 'delsrv_cancel') return false;
  await ctx.answerCallbackQuery();
  await ctx.reply('Отменено.');
  return true;
}

function listServers(ctx) {
  const servers = db.getAllServers();
  if (servers.length === 0) {
    return ctx.reply('Нет серверов.');
  }
  let text = '';
  for (const s of servers) {
    text += `**${escapeMarkdown(s.name)}**\n  IP: ${escapeMarkdown(s.ip)}:${s.port}\n  API: ${escapeMarkdown(s.api_url)}\n\n`;
  }
  return ctx.reply(text.trim(), { parse_mode: 'Markdown' });
}

module.exports = {
  ADD_SERVER_STEPS,
  getAddServerState,
  setAddServerState,
  clearAddServerState,
  addServerStart,
  addServerHandleMessage,
  deleteServerList,
  deleteServerCallback,
  deleteServerConfirmCallback,
  deleteServerCancelCallback,
  listServers,
};
