// backend/scripts/loadtest.js

// Load test for POST /api/events - the path that matters most under load,
// since it's the customer-facing endpoint hit on every webhook send.
//
// Usage:
//   node scripts/loadtest.js <apiKey> [baseUrl] [durationSeconds] [connections]
//
// Example:
//   node scripts/loadtest.js whsk_yourrealkeyhere http://localhost:6000 30 20
//
// Run this against a REAL deployment (real MySQL + real Redis + an endpoint
// that actually responds), not against an in-memory mock - numbers from a
// mock are meaningless. Record the result in your README/ARCHITECTURE.md:
// "processed X req/sec, pXX latency Yms" is a real, defensible resume line;
// "fast and scalable" is not.

const autocannon = require('autocannon');

const apiKey = process.argv[2];
const baseUrl = process.argv[3] || 'http://localhost:6000';
const duration = Number(process.argv[4]) || 30;
const connections = Number(process.argv[5]) || 20;

if (!apiKey) {
  console.error('Usage: node scripts/loadtest.js <apiKey> [baseUrl] [durationSeconds] [connections]');
  process.exit(1);
}

const instance = autocannon(
  {
    url: `${baseUrl}/api/events`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ eventType: 'load.test', payload: { ts: Date.now() } }),
    duration,
    connections,
  },
  (err, result) => {
    if (err) {
      console.error('Load test failed:', err);
      process.exit(1);
    }
    console.log('\n--- Summary ---');
    console.log(`Requests/sec: ${result.requests.average}`);
    console.log(`Latency p50/p90/p99 (ms): ${result.latency.p50} / ${result.latency.p90} / ${result.latency.p99}`);
    console.log(`Errors: ${result.errors}, Timeouts: ${result.timeouts}`);
    console.log(`Non-2xx: ${result.non2xx}`);
  }
);

autocannon.track(instance, { renderProgressBar: true });