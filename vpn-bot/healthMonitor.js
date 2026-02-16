/**
 * Фоновый мониторинг здоровья VPN-серверов.
 * Раз в 5 минут пингует /health-check каждого сервера.
 * При недоступности отправляет алерт всем пользователям (макс. 1 раз в сутки на сервер).
 */

const db = require('./db');
const api = require('./api');
const { escapeMarkdown } = require('./utils/escapeMarkdown');

const INTERVAL_MS = 5 * 60 * 1000; // 5 минут
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 часа

let intervalId = null;

function canSendAlert(serverId) {
  const lastAt = db.getLastHealthAlertAt(serverId);
  if (!lastAt) return true;
  const last = new Date(lastAt).getTime();
  return Date.now() - last >= ALERT_COOLDOWN_MS;
}

async function checkServer(bot, server) {
  const { ok } = await api.healthCheck(server);
  if (ok) return;

  if (!canSendAlert(server.id)) return;

  const allServers = db.getAllServers();
  const otherServers = allServers.filter((s) => s.id !== server.id);
  const otherNames = otherServers.length > 0
    ? otherServers.map((s) => escapeMarkdown(s.name)).join(', ')
    : 'нет других серверов';

  const message = `⚠️ Сервер **${escapeMarkdown(server.name)}** имеет проблемы с подключением. Используйте другие серверы: ${otherNames}`;

  const users = db.getAllUsers();
  for (const user of users) {
    try {
      await bot.api.sendMessage(user.id, message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error(`Health monitor: failed to send alert to user ${user.id}:`, err.message);
    }
  }

  db.setLastHealthAlertAt(server.id);
  console.log(`Health monitor: alert sent for server "${server.name}"`);
}

async function runCheck(bot) {
  const servers = db.getAllServers();
  if (servers.length === 0) return;

  for (const server of servers) {
    try {
      await checkServer(bot, server);
    } catch (err) {
      console.error(`Health monitor: error checking server "${server.name}":`, err);
    }
  }
}

function start(bot) {
  if (intervalId) return;
  runCheck(bot);
  intervalId = setInterval(() => runCheck(bot), INTERVAL_MS);
  console.log('Health monitor: started (interval 5 min)');
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('Health monitor: stopped');
  }
}

module.exports = {
  start,
  stop,
};
