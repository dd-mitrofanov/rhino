const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'keys.db');
let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      uuid TEXT NOT NULL,
      shortId TEXT NOT NULL,
      serverName TEXT NOT NULL,
      keyName TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_keys_userId ON keys(userId);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_keys_shortId ON keys(shortId);
  `);
}

function insertKey(userId, uuid, shortId, serverName, keyName) {
  const database = getDb();
  const stmt = database.prepare(
    'INSERT INTO keys (userId, uuid, shortId, serverName, keyName) VALUES (?, ?, ?, ?, ?)'
  );
  const result = stmt.run(userId, uuid, shortId, serverName, keyName);
  return result.lastInsertRowid;
}

function getKeyById(keyId) {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM keys WHERE id = ?');
  return stmt.get(keyId) || null;
}

function getKeysByUserId(userId) {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM keys WHERE userId = ? ORDER BY id');
  return stmt.all(userId);
}

function countKeysByUserId(userId) {
  const database = getDb();
  const stmt = database.prepare('SELECT COUNT(*) AS count FROM keys WHERE userId = ?');
  return stmt.get(userId).count;
}

function deleteKey(keyId) {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM keys WHERE id = ?');
  const result = stmt.run(keyId);
  return result.changes > 0;
}

module.exports = {
  getDb,
  insertKey,
  getKeyById,
  getKeysByUserId,
  countKeysByUserId,
  deleteKey,
};
