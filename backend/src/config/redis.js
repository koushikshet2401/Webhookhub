const Redis = require('ioredis');

const options = {
  maxRetriesPerRequest: null, // required by BullMQ
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
};

let connection;
if (process.env.REDIS_URL) {
  connection = new Redis(process.env.REDIS_URL, options);
} else {
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const useTls = host !== '127.0.0.1' && host !== 'localhost';
  
  connection = new Redis({
    host,
    port: Number(process.env.REDIS_PORT) || 6379,
    username: process.env.REDIS_USERNAME || 'default',
    password: process.env.REDIS_PASSWORD || undefined,
    tls: useTls ? {} : undefined,
    ...options,
  });
}

connection.on('connect', () => {
  console.log('[redis] connected');
});

connection.on('error', (err) => {
  if (err.message.includes('ECONNRESET')) return;
  console.error('[redis] connection error:', err.message);
});

module.exports = connection;
