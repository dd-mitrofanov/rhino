/**
 * HTTP-клиент для API VPN-сервера.
 * POST /generate-key, DELETE /reject-key/:keyId
 */

async function request(apiUrl, apiToken, method, path, body = null) {
  const url = `${apiUrl.replace(/\/$/, '')}${path}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  };
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Генерация ключа на сервере.
 * @param {{ api_url: string, api_token: string }} server
 * @param {string} userId — Telegram ID
 * @returns {Promise<{ keyId: number, vlessLink: string, keyName: string, uuid: string, shortId: string }>}
 */
async function generateKey(server, userId) {
  return request(server.api_url, server.api_token, 'POST', '/generate-key', {
    userId: String(userId),
  });
}

/**
 * Отзыв ключа на сервере.
 * @param {{ api_url: string, api_token: string }} server
 * @param {number} keyId — keyId из API (поле key_id в БД бота)
 */
async function rejectKey(server, keyId) {
  await request(server.api_url, server.api_token, 'DELETE', `/reject-key/${keyId}`);
}

/**
 * Проверка здоровья сервера (GET /health-check, без авторизации).
 * @param {{ api_url: string }} server
 * @returns {Promise<{ ok: boolean }>} ok: true если сервер отвечает и status === 'active'
 */
async function healthCheck(server) {
  const url = `${server.api_url.replace(/\/$/, '')}/health-check`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`Health check ${url}: HTTP ${res.status}`);
      return { ok: false };
    }
    const data = await res.json().catch((e) => {
      console.warn(`Health check ${url}: invalid JSON`, e.message);
      return {};
    });
    const ok = data?.status === 'active';
    if (!ok) {
      console.warn(`Health check ${url}: status="${data?.status ?? 'undefined'}" (expected "active")`);
    }
    return { ok };
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`Health check ${url}:`, err.message);
    return { ok: false };
  }
}

module.exports = {
  generateKey,
  rejectKey,
  healthCheck,
};
