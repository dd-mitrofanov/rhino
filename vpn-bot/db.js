const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'bot.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user', 'guest')),
      invited_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invited_by) REFERENCES users(id)
    );
  `);
  
  // Добавляем колонку username, если её нет (для существующих БД)
  try {
    database.exec(`ALTER TABLE users ADD COLUMN username TEXT;`);
  } catch (err) {
    // Колонка уже существует, игнорируем ошибку
  }

  // guest_limit: макс. кол-во гостей, которых может пригласить пользователь (только для role=user)
  try {
    database.exec(`ALTER TABLE users ADD COLUMN guest_limit INTEGER DEFAULT 0;`);
  } catch (err) {
    // Колонка уже существует
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ip TEXT NOT NULL,
      port INTEGER NOT NULL,
      api_token TEXT NOT NULL,
      api_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      server_id INTEGER NOT NULL,
      uuid TEXT NOT NULL,
      shortId TEXT NOT NULL,
      key_name TEXT NOT NULL,
      vless_link TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK(role IN ('user', 'guest')),
      created_by INTEGER NOT NULL,
      used_by INTEGER,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (used_by) REFERENCES users(id)
    );
  `);

  // guest_limit для invite_codes: лимит гостей, который получит приглашённый user
  try {
    database.exec(`ALTER TABLE invite_codes ADD COLUMN guest_limit INTEGER;`);
  } catch (err) {
    // Колонка уже существует
  }

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_keys_user_server ON keys(user_id, server_id);
    CREATE INDEX IF NOT EXISTS idx_keys_server_id ON keys(server_id);

    CREATE TABLE IF NOT EXISTS server_health_alerts (
      server_id INTEGER PRIMARY KEY,
      last_alert_at DATETIME NOT NULL,
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );
  `);
}

// --- Users ---
function getUserById(userId) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

function createUser(id, role, invitedBy = null, username = null, guestLimit = null) {
  const stmt = getDb().prepare(
    'INSERT INTO users (id, username, role, invited_by, guest_limit) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(id, username, role, invitedBy, guestLimit ?? 0);
  return getUserById(id);
}

function updateUserUsername(id, username) {
  getDb().prepare('UPDATE users SET username = ? WHERE id = ?').run(username, id);
}

function updateUserGuestLimit(userId, limit) {
  getDb().prepare('UPDATE users SET guest_limit = ? WHERE id = ?').run(limit, userId);
}

function countInvitedGuests(userId) {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM users WHERE invited_by = ? AND role = 'guest'`
    )
    .get(userId).c;
}

function getAllUsers() {
  return getDb().prepare('SELECT * FROM users ORDER BY created_at DESC').all();
}

function getUsersWithKeyCount() {
  const rows = getDb()
    .prepare(
      `SELECT u.id, u.username, u.role, u.created_at, COUNT(k.id) AS key_count
       FROM users u
       LEFT JOIN keys k ON k.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    )
    .all();
  return rows;
}

// --- Servers ---
function getAllServers() {
  return getDb().prepare('SELECT * FROM servers ORDER BY name').all();
}

function getServerById(serverId) {
  return getDb().prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
}

function addServer(name, ip, port, apiToken, apiUrl) {
  const result = getDb()
    .prepare(
      'INSERT INTO servers (name, ip, port, api_token, api_url) VALUES (?, ?, ?, ?, ?)'
    )
    .run(name, ip, port, apiToken, apiUrl);
  return result.lastInsertRowid;
}

function deleteServer(serverId) {
  getDb().prepare('DELETE FROM server_health_alerts WHERE server_id = ?').run(serverId);
  getDb().prepare('DELETE FROM keys WHERE server_id = ?').run(serverId);
  getDb().prepare('DELETE FROM servers WHERE id = ?').run(serverId);
}

function getLastHealthAlertAt(serverId) {
  const row = getDb().prepare('SELECT last_alert_at FROM server_health_alerts WHERE server_id = ?').get(serverId);
  return row ? row.last_alert_at : null;
}

function setLastHealthAlertAt(serverId) {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO server_health_alerts (server_id, last_alert_at) VALUES (?, datetime('now'))`
    )
    .run(serverId);
}

function clearLastHealthAlertAt(serverId) {
  getDb().prepare('DELETE FROM server_health_alerts WHERE server_id = ?').run(serverId);
}

// --- Keys ---
function countKeysByUserAndServer(userId, serverId) {
  return getDb()
    .prepare('SELECT COUNT(*) AS c FROM keys WHERE user_id = ? AND server_id = ?')
    .get(userId, serverId).c;
}

function getKeysByUserId(userId) {
  return getDb()
    .prepare(
      `SELECT k.*, s.name AS server_name
       FROM keys k
       JOIN servers s ON s.id = k.server_id
       WHERE k.user_id = ?
       ORDER BY s.name, k.created_at`
    )
    .all(userId);
}

function getKeyById(keyId) {
  return getDb().prepare('SELECT k.*, s.name AS server_name, s.api_url, s.api_token FROM keys k JOIN servers s ON s.id = k.server_id WHERE k.id = ?').get(keyId);
}

function insertKey(keyId, userId, serverId, uuid, shortId, keyName, vlessLink) {
  getDb()
    .prepare(
      'INSERT INTO keys (key_id, user_id, server_id, uuid, shortId, key_name, vless_link) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(keyId, userId, serverId, uuid, shortId, keyName, vlessLink);
}

function deleteKey(keyId) {
  getDb().prepare('DELETE FROM keys WHERE id = ?').run(keyId);
}

function getKeysByServerForUser(userId) {
  const rows = getKeysByUserId(userId);
  const byServer = {};
  for (const row of rows) {
    if (!byServer[row.server_id]) {
      byServer[row.server_id] = { serverName: row.server_name, keys: [] };
    }
    byServer[row.server_id].keys.push(row);
  }
  return byServer;
}

// --- Invite codes ---
function getInviteByCode(code) {
  return getDb().prepare('SELECT * FROM invite_codes WHERE code = ?').get(code.toLowerCase());
}

function createInviteCode(code, role, createdBy, guestLimit = null) {
  getDb()
    .prepare('INSERT INTO invite_codes (code, role, created_by, guest_limit) VALUES (?, ?, ?, ?)')
    .run(code.toLowerCase(), role, createdBy, guestLimit);
}

function useInviteCode(code, usedBy) {
  getDb()
    .prepare('UPDATE invite_codes SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ?')
    .run(usedBy, code.toLowerCase());
}

function generateInviteCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  const randomBytes = require('crypto').randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
}

module.exports = {
  getDb,
  getUserById,
  createUser,
  updateUserUsername,
  updateUserGuestLimit,
  countInvitedGuests,
  getAllUsers,
  getUsersWithKeyCount,
  getAllServers,
  getServerById,
  addServer,
  deleteServer,
  getLastHealthAlertAt,
  setLastHealthAlertAt,
  clearLastHealthAlertAt,
  countKeysByUserAndServer,
  getKeysByUserId,
  getKeyById,
  insertKey,
  deleteKey,
  getKeysByServerForUser,
  getInviteByCode,
  createInviteCode,
  useInviteCode,
  generateInviteCode,
};
