const xray = require('../services/xray');

async function getHealthCheck(req, res) {
  try {
    const { status, version } = await xray.getXrayStatus();
    return res.json({
      status: status === 'active' ? 'active' : status === 'inactive' ? 'inactive' : 'failed',
      version: version || undefined,
    });
  } catch (err) {
    console.error('health-check error:', err);
    return res.status(500).json({
      status: 'failed',
      version: '',
      error: err.message,
    });
  }
}

module.exports = { getHealthCheck };
