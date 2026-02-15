const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../db');
const xray = require('../services/xray');


// Функция для генерации 16-символьной hex-строки (аналог openssl rand -hex 8)
function generateShortId() {
  // Создаем массив из 8 случайных байт (криптографически стойкий генератор)
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback для сред без Web Crypto API (не рекомендуется для продакшена)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Преобразуем каждый байт в двухсимвольное hex-представление и объединяем
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildVlessLink(uuid, shortId, keyName) {
  const params = new URLSearchParams({
    security: 'reality',
    encryption: 'none',
    pbk: config.realityPublicKey,
    fp: 'chrome',
    type: 'tcp',
    flow: 'xtls-rprx-vision',
    sni: config.realityServerName,
    sid: shortId,
    headerType: 'none'
  });
  const hash = encodeURIComponent(keyName);
  return `vless://${uuid}@${config.serverIp}:${config.serverPort}?${params.toString()}#${hash}`;
}

async function postGenerateKey(req, res) {
  try {
    const { userId } = req.body;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userId' });
    }

    const uuid = uuidv4();
    const shortId = generateShortId();

    await xray.addClient(uuid, shortId);
    await xray.restartXray();

    const count = db.countKeysByUserId(userId);
    const order = count + 1;
    const keyName = `${config.serverName}_${order}`;

    const keyId = db.insertKey(userId, uuid, shortId, config.serverName, keyName);
    const vlessLink = buildVlessLink(uuid, shortId, keyName);

    console.log(`Key generated: keyId=${keyId}, userId=${userId}, keyName=${keyName}`);

    return res.status(201).json({
      keyId,
      vlessLink,
      keyName,
      uuid,
      shortId,
    });
  } catch (err) {
    console.error('generate-key error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
    });
  }
}

async function deleteRejectKey(req, res) {
  try {
    const keyId = parseInt(req.params.keyId, 10);
    if (Number.isNaN(keyId)) {
      return res.status(400).json({ error: 'Invalid keyId' });
    }

    const row = db.getKeyById(keyId);
    if (!row) {
      return res.status(404).json({ error: 'Key not found' });
    }

    await xray.removeClient(row.uuid, row.shortId);
    await xray.restartXray();
    db.deleteKey(keyId);

    console.log(`Key revoked: keyId=${keyId}, userId=${row.userId}`);

    return res.status(204).send();
  } catch (err) {
    console.error('reject-key error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
    });
  }
}

async function getKeysOf(req, res) {
  try {
    const userId = req.query.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userId query parameter' });
    }

    const rows = db.getKeysByUserId(userId);
    const keys = rows.map((row) => ({
      id: row.id,
      keyName: row.keyName,
      uuid: row.uuid,
      shortId: row.shortId,
      createdAt: row.createdAt,
      vlessLink: buildVlessLink(row.uuid, row.shortId, row.keyName),
    }));

    return res.json({
      userId,
      keys,
    });
  } catch (err) {
    console.error('keys-of error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
    });
  }
}

module.exports = {
  postGenerateKey,
  deleteRejectKey,
  getKeysOf,
};
