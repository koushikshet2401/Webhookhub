const Redis = require('ioredis');

const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // required by BullMQ
});

connection.on('connect', () => {
  console.log('[redis] connected');
});

connection.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});

module.exports = connection;
