require('dotenv').config();

const { Bot, session } = require('grammy');
const db = require('./db');
const { attachUser, requireRegistered, requireAdmin, requireRole } = require('./middleware');
const startHandler = require('./handlers/start');
const activateHandler = require('./handlers/activate');
const myKeysHandler = require('./handlers/myKeys');
const generateKeyHandler = require('./handlers/generateKey');
const revokeKeyHandler = require('./handlers/revokeKey');
const inviteGuestHandler = require('./handlers/inviteGuest');
const adminServers = require('./handlers/adminServers');
const adminInvite = require('./handlers/adminInvite');
const adminRevoke = require('./handlers/adminRevoke');
const adminUsers = require('./handlers/adminUsers');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('Установите переменную окружения BOT_TOKEN');
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

function getSessionKey(ctx) {
  return ctx.from?.id;
}

bot.use(
  session({
    getSessionKey,
    initial: () => ({}),
  })
);
bot.use(attachUser());

// Проверка: сообщение с командой должно иметь entity bot_command; если нет — обрабатываем как текст-команду
function isCommandMessage(ctx) {
  const msg = ctx.message;
  const text = msg?.text?.trim() ?? '';
  if (!text.startsWith('/')) return false;
  const hasCommandEntity = msg.entities?.some((e) => e.type === 'bot_command');
  return !hasCommandEntity;
}

// Резервная обработка команд, пришедших без entity (некоторые клиенты)
bot.on('message:text').filter(isCommandMessage).use(async (ctx, next) => {
  const raw = ctx.message.text.trim().split(/\s/)[0];
  const cmd = raw.replace(/@\w+$/, '').slice(1).toLowerCase(); // без / и без @botname
  const adminHandlers = {
    add_server: () => requireAdmin()(ctx, () => adminServers.addServerStart(ctx, ctx.session)),
    delete_server: () => requireAdmin()(ctx, () => adminServers.deleteServerList(ctx)),
    list_servers: () => requireAdmin()(ctx, () => adminServers.listServers(ctx)),
    create_invite: () => requireAdmin()(ctx, () => adminInvite.createInviteChooseRole(ctx)),
    keys_of: () => requireAdmin()(ctx, () => { ctx.session.awaitingKeysOf = true; return adminUsers.keysOfAsk(ctx); }),
    list_users: () => requireAdmin()(ctx, () => adminUsers.listUsers(ctx)),
    revoke_key: () => requireRegistered()(ctx, async () => {
      if (ctx.userDoc?.role === 'admin') return adminRevoke.revokeKeyAdminListUsers(ctx);
      return revokeKeyHandler.revokeKeyOwn(ctx);
    }),
  };
  const generalHandlers = {
    start: () => startHandler.start(ctx),
    activate: () => activateHandler.activate(ctx, ctx.message.text.replace(/^\/activate\s*/, '').trim() || ''),
    my_keys: () => requireRegistered()(ctx, () => myKeysHandler.myKeys(ctx)),
    generate_key: () => requireRegistered()(ctx, () => generateKeyHandler.handleGenerateKey(ctx)),
    invite_guest: () => requireRole('user')(ctx, () => inviteGuestHandler.inviteGuest(ctx)),
  };
  const handler = adminHandlers[cmd] ?? generalHandlers[cmd];
  if (handler) {
    await handler();
    return;
  }
  await ctx.reply('Неизвестная команда. Используйте /start для списка команд.');
});

// ——— Общие команды ———
bot.command('start', startHandler.start);

bot.command('activate', async (ctx) => {
  const code = ctx.message?.text?.replace(/^\/activate\s*/, '').trim() || '';
  await activateHandler.activate(ctx, code);
});

bot.command('my_eys', requireRegistered(), myKeysHandler.myKeys);
bot.command('generatekey', requireRegistered(), generateKeyHandler.handleGenerateKey);
bot.command('revokekey', requireRegistered(), async (ctx) => {
  if (ctx.userDoc.role === 'admin') return adminRevoke.revokeKeyAdminListUsers(ctx);
  return revokeKeyHandler.revokeKeyOwn(ctx);
});

// ——— Пользователь: пригласить гостя (только роль user, гость не видит команду) ———
bot.command('inviteguest', requireRole('user'), inviteGuestHandler.inviteGuest);

// ——— Админ: серверы ———
bot.command('addserver', requireAdmin(), async (ctx) => {
  await adminServers.addServerStart(ctx, ctx.session);
});
bot.command('deleteserver', requireAdmin(), adminServers.deleteServerList);
bot.command('listservers', requireAdmin(), adminServers.listServers);

// ——— Админ: инвайты ———
bot.command('createinvite', requireAdmin(), adminInvite.createInviteChooseRole);

// ——— Админ: ключи пользователя и список пользователей ———
bot.command('keysof', requireAdmin(), (ctx) => {
  ctx.session.awaitingKeysOf = true;
  return adminUsers.keysOfAsk(ctx);
});
bot.command('listusers', requireAdmin(), adminUsers.listUsers);

// ——— Текстовые сообщения (диалоги) ———
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  const sid = getSessionKey(ctx);
  if (!sid) return;

  if (ctx.session.awaitingKeysOf) {
    ctx.session.awaitingKeysOf = false;
    await adminUsers.keysOfByUserId(ctx, text);
    return;
  }

  if (adminServers.getAddServerState(ctx.session)) {
    await adminServers.addServerHandleMessage(ctx, ctx.session, text);
    return;
  }
});

// ——— Callback-кнопки ———
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;

  if (await generateKeyHandler.handleGenerateKeyCallback(ctx)) return;
  if (await revokeKeyHandler.handleRevokeCallback(ctx)) return;

  if (await adminInvite.createInviteCallback(ctx)) return;
  if (await adminRevoke.revokeKeyAdminCallback(ctx)) return;
  if (await adminRevoke.revokeKeyAdminConfirmCallback(ctx)) return;

  if (await adminServers.deleteServerCallback(ctx)) return;
  if (await adminServers.deleteServerConfirmCallback(ctx)) return;
  if (await adminServers.deleteServerCancelCallback(ctx)) return;

  if (await adminUsers.keysOfListCallback(ctx)) return;
  if (await adminUsers.keysOfSelectCallback(ctx)) return;
});

// Ошибки
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Graceful shutdown
async function shutdown(signal) {
  console.log(`${signal} received, stopping bot...`);
  await bot.stop();
  const database = db.getDb();
  if (database) database.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bot.start().then(() => {
  console.log('Bot is running');
}).catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});
