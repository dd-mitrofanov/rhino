const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const config = require('../config');

const execAsync = promisify(exec);

async function backupConfig() {
  const configPath = config.xrayConfigPath;
  const backupPath = `${configPath}.backup`;
  const content = await fs.readFile(configPath, 'utf8');
  await fs.writeFile(backupPath, content, 'utf8');
}

async function readConfig() {
  const content = await fs.readFile(config.xrayConfigPath, 'utf8');
  return JSON.parse(content);
}

async function writeConfig(configObj) {
  await backupConfig();
  await fs.writeFile(
    config.xrayConfigPath,
    JSON.stringify(configObj, null, 2),
    'utf8'
  );
}

function findVlessInbound(inbounds) {
  if (!Array.isArray(inbounds)) return null;
  return inbounds.find(
    (inb) => inb.protocol === 'vless' && inb.settings && inb.settings.clients
  );
}

async function addClient(uuid, shortId) {
  const configObj = await readConfig();
  const inbound = findVlessInbound(configObj.inbounds);
  if (!inbound) {
    throw new Error('VLESS inbound not found in xray config');
  }
  const streamSettings = inbound.streamSettings || {};
  const realitySettings = streamSettings.realitySettings || {};
  if (!Array.isArray(realitySettings.shortIds)) {
    realitySettings.shortIds = [];
  }
  realitySettings.shortIds.push(shortId);
  streamSettings.realitySettings = realitySettings;
  inbound.streamSettings = streamSettings;
  await writeConfig(configObj);
}

async function removeClient(uuid, shortId) {
  const configObj = await readConfig();
  const inbound = findVlessInbound(configObj.inbounds);
  if (!inbound) {
    throw new Error('VLESS inbound not found in xray config');
  }
  const realitySettings = inbound.streamSettings?.realitySettings;
  if (realitySettings && Array.isArray(realitySettings.shortIds)) {
    realitySettings.shortIds = realitySettings.shortIds.filter((s) => s !== shortId);
  }
  await writeConfig(configObj);
}

async function restartXray() {
  await execAsync('systemctl restart xray');
}

async function getXrayStatus() {
  try {
    const { stdout } = await execAsync('systemctl is-active xray');
    const status = (stdout || '').trim().toLowerCase();
    let version = '';
    try {
      const { stdout: versionOut } = await execAsync('xray version 2>/dev/null || true');
      version = (versionOut || '').trim().split('\n')[0] || '';
    } catch {
      // ignore
    }
    return {
      status: status === 'active' ? 'active' : status === 'inactive' ? 'inactive' : status || 'failed',
      version,
    };
  } catch (err) {
    const out = (err.stdout || err.stderr || '').trim().toLowerCase();
    const status = out === 'inactive' ? 'inactive' : 'failed';
    return { status, version: '' };
  }
}

module.exports = {
  backupConfig,
  readConfig,
  writeConfig,
  addClient,
  removeClient,
  restartXray,
  getXrayStatus,
};
