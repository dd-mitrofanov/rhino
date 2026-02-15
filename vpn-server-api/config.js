require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  token: process.env.TOKEN || '',
  xrayConfigPath: process.env.XRAY_CONFIG_PATH || '/usr/local/etc/xray/config.json',
  serverIp: process.env.SERVER_IP || '',
  serverPort: process.env.SERVER_PORT || '443',
  realityPublicKey: process.env.REALITY_PUBLIC_KEY || '',
  realityServerName: process.env.REALITY_SERVER_NAME || '',
  serverName: process.env.SERVER_NAME || 'MainServer',
};
