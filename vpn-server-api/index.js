const app = require('./app');
const config = require('./config');

require('./db').getDb();

const server = app.listen(config.port, () => {
  console.log(`VPN Server API listening on port ${config.port}`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
