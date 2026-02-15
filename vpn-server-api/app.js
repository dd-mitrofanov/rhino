const express = require('express');
const { authMiddleware } = require('./middleware/auth');
const { getHealthCheck } = require('./routes/health');
const {
  postGenerateKey,
  deleteRejectKey,
  getKeysOf,
} = require('./routes/keys');

const app = express();

app.use(express.json());

app.get('/health-check', getHealthCheck);

app.use(authMiddleware);

app.post('/generate-key', postGenerateKey);
app.delete('/reject-key/:keyId', deleteRejectKey);
app.get('/keys-of', getKeysOf);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

module.exports = app;
