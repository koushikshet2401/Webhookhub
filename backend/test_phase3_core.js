const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const baseURL = 'http://localhost:6000/api';
const client = axios.create({ baseURL, validateStatus: () => true });

async function run() {
  console.log('--- PHASE 3 CORE TESTS ---');
  
  // Wipe DB so first user is ADMIN
  await prisma.auditLog.deleteMany({});
  await prisma.delivery.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.endpoint.deleteMany({});
  await prisma.apiKey.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});
  
  let email = `admin_${Date.now()}@test.com`;
  let res = await client.post('/auth/register', { name: 'Admin', email, password: 'password123' });
  const loginRes = await client.post('/auth/login', { email, password: 'password123' });
  const token = loginRes.data.accessToken;
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
  
  res = await client.post('/projects', { name: 'Core Test Project' }, authHeaders);
  const projectId = res.data.id;
  
  res = await client.post(`/projects/${projectId}/endpoints`, { url: 'http://httpbin.org/post', eventTypes: ['order.created'] }, authHeaders);
  const successEndpointId = res.data.id;

  res = await client.post(`/projects/${projectId}/endpoints`, { url: 'http://httpbin.org/status/500', eventTypes: ['order.failed'] }, authHeaders);
  const failEndpointId = res.data.id;

  res = await client.post(`/projects/${projectId}/api-keys`, { label: 'Prod Key' }, authHeaders);
  if (res.status !== 201) {
    console.error('Failed to create API key:', res.status, res.data);
    process.exit(1);
  }
  const apiKey = res.data.key;
  
  const ingestHeaders = { headers: { Authorization: `Bearer ${apiKey}` } };

  console.log('Ingesting SUCCESS event...');
  let ingestRes = await client.post('/events', { type: 'order.created', payload: { orderId: 1 } }, ingestHeaders);
  console.log('Ingest response:', ingestRes.status, ingestRes.data);

  console.log('Ingesting FAILING event...');
  let ingestResFail = await client.post('/events', { type: 'order.failed', payload: { orderId: 2 } }, ingestHeaders);
  console.log('Ingest response fail:', ingestResFail.status, ingestResFail.data);

  // Check rate limit! (Max 100 per 15 minutes)
  console.log('Bursting rate limit...');
  let limitHit = false;
  for (let i=0; i<110; i++) {
    const r = await client.post('/events', { type: 'order.created', payload: { orderId: 3 } }, ingestHeaders);
    if (r.status === 429) {
      limitHit = true;
      console.log(`Rate limit hit correctly at attempt ${i}`);
      break;
    }
  }

  // Idempotency check with a NEW key (to bypass rate limit for the old key)
  res = await client.post(`/projects/${projectId}/api-keys`, { label: 'Prod Key 2' }, authHeaders);
  const apiKey2 = res.data.key;
  const ingestHeaders2 = { headers: { Authorization: `Bearer ${apiKey2}` } };

  console.log('Checking idempotency...');
  const idemKey = `idem-${Date.now()}`;
  let idem1 = await client.post('/events', { type: 'order.created', payload: { orderId: 3 } }, { headers: { Authorization: `Bearer ${apiKey2}`, 'idempotency-key': idemKey }});
  let idem2 = await client.post('/events', { type: 'order.created', payload: { orderId: 3 } }, { headers: { Authorization: `Bearer ${apiKey2}`, 'idempotency-key': idemKey }});
  if (idem1.data.id === idem2.data.id) {
    console.log('Idempotency works! Returned same event ID:', idem1.data.id);
  } else {
    console.log('ERROR: Idempotency failed! IDs:', idem1.data.id, idem2.data.id);
  }

  console.log('Waiting for background workers (5s)...');
  await new Promise(r => setTimeout(r, 5000));

  let listRes = await client.get(`/projects/${projectId}/deliveries`, authHeaders);
  const deliveries = listRes.data.data;
  console.log('Deliveries found:', deliveries.length);
  const successDelivery = deliveries.find(d => d.eventId === ingestRes.data.id);
  if (successDelivery) {
    console.log('SUCCESS delivery status:', successDelivery.status, 'Latency:', successDelivery.latency);
  }

  const failDelivery = deliveries.find(d => d.eventId === ingestResFail.data.id);
  if (failDelivery) {
    console.log('FAIL delivery status:', failDelivery.status, 'Attempts:', failDelivery.attemptsMade);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect().then(() => process.exit(0)));
