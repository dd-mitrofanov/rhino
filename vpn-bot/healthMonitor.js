/**
 * Фоновый мониторинг здоровья VPN-серверов.
 * Раз в 5 минут пингует /health-check каждого сервера.
 * При недоступности: алерт (макс. 1 раз в сутки) + пинг каждые 30 сек до восстановления.
 * При восстановлении — уведомление пользователей.
 */

const db = require('./db');
const api = require('./api');
const { escapeMarkdown } = require('./utils/escapeMarkdown');

const INTERVAL_MS = 5 * 60 * 1000; // 5 минут
const RAPID_INTERVAL_MS = 30 * 1000; // 30 секунд для недоступных серверов
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 часа

let mainIntervalId = null;
let rapidIntervalId = null;
const downServerIds = new Set();

function canSendAlert(serverId) {
  const lastAt = db.getLastHealthAlertAt(serverId);
  if (!lastAt) return true;
  const last = new Date(lastAt).getTime();
  return Date.now() - last >= ALERT_COOLDOWN_MS;
}

async function sendToAllUsers(bot, message) {
  const users = db.getAllUsers();
  for (const user of users) {
    try {
      await bot.api.sendMessage(user.id, message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error(`Health monitor: failed to send to user ${user.id}:`, err.message);
    }
  }
}

async function handleServerDown(bot, server) {
  downServerIds.add(server.id);

  if (!canSendAlert(server.id)) return;

  const allServers = db.getAllServers();
  const otherServers = allServers.filter((s) => s.id !== server.id);
  const otherNames = otherServers.length > 0
    ? otherServers.map((s) => escapeMarkdown(s.name)).join(', ')
    : 'нет других серверов';

  const message = `⚠️ Сервер **${escapeMarkdown(server.name)}** имеет проблемы с подключением. Используйте другие серверы: ${otherNames}`;
  await sendToAllUsers(bot, message);
  db.setLastHealthAlertAt(server.id);
  console.log(`Health monitor: alert sent for server "${server.name}"`);
}

async function handleServerRecovered(bot, server) {
  const message = `✅ Сервер **${escapeMarkdown(server.name)}** снова в строю и готов нагибать РКН пока не ляжет`;
  await sendToAllUsers(bot, message);
  console.log(`Health monitor: recovery notification sent for server "${server.name}"`);
}

async function runMainCheck(bot) {
  const servers = db.getAllServers();
  if (servers.length === 0) return;

  for (const server of servers) {
    try {
      const { ok } = await api.healthCheck(server);
      if (ok) {
        if (downServerIds.has(server.id)) {
          downServerIds.delete(server.id);
          await handleServerRecovered(bot, server);
        }
      } else {
        await handleServerDown(bot, server);
      }
    } catch (err) {
      console.error(`Health monitor: error checking server "${server.name}":`, err);
    }
  }
}

async function runRapidCheck(bot) {
  if (downServerIds.size === 0) return;

  for (const serverId of [...downServerIds]) {
    const server = db.getServerById(serverId);
    if (!server) {
      downServerIds.delete(serverId);
      continue;
    }
    try {
      const { ok } = await api.healthCheck(server);
      if (ok) {
        downServerIds.delete(serverId);
        await handleServerRecovered(bot, server);
      }
    } catch (err) {
      console.error(`Health monitor: rapid check error for "${server.name}":`, err);
    }
  }
}

function start(bot) {
  if (mainIntervalId) return;
  runMainCheck(bot);
  mainIntervalId = setInterval(() => runMainCheck(bot), INTERVAL_MS);
  rapidIntervalId = setInterval(() => runRapidCheck(bot), RAPID_INTERVAL_MS);
  console.log('Health monitor: started (main 5 min, rapid 30 sec for down servers)');
}

function stop() {
  if (mainIntervalId) {
    clearInterval(mainIntervalId);
    mainIntervalId = null;
  }
  if (rapidIntervalId) {
    clearInterval(rapidIntervalId);
    rapidIntervalId = null;
  }
  downServerIds.clear();
  console.log('Health monitor: stopped');
}

module.exports = {
  start,
  stop,
};
