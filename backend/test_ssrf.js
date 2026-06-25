const axios = require('axios');
const baseURL = 'http://localhost:6000/api';
const client = axios.create({ baseURL, validateStatus: () => true });

async function run() {
  console.log('--- SSRF TESTS ---');
  // Login as admin
  const loginRes = await client.post('/auth/login', { email: 'admin@test.com', password: 'password123' });
  const token = loginRes.data.accessToken;
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
  
  // Create project
  const pRes = await client.post('/projects', { name: 'SSRF Test Project' }, authHeaders);
  const projectId = pRes.data.id;
  
  const testUrls = [
    { url: 'http://example.com/webhook', expected: 201 },
    { url: 'http://localhost:8080', expected: 400 },
    { url: 'http://127.0.0.1:8080', expected: 400 },
    { url: 'http://169.254.169.254/latest/meta-data', expected: 400 },
    { url: 'http://10.0.0.1', expected: 400 },
    { url: 'http://192.168.1.1', expected: 400 },
    { url: 'http://172.16.0.1', expected: 400 },
    { url: 'http://172.31.255.255', expected: 400 },
    { url: 'http://172.15.255.255', expected: 201 }, // Just outside private range
    { url: 'http://172.32.0.1', expected: 201 }      // Just outside private range
  ];
  
  for (const t of testUrls) {
    const res = await client.post(`/projects/${projectId}/endpoints`, { url: t.url, eventTypes: ['*'] }, authHeaders);
    console.log(`URL: ${t.url} -> Expected: ${t.expected}, Got: ${res.status}`);
    if (res.status === 201) {
      if (!res.data.secret) {
        console.log('ERROR: secret not returned on create!');
      }
      // fetch again to ensure secret is NOT returned
      const getRes = await client.get(`/endpoints/${res.data.id}`, authHeaders);
      if (getRes.data.secret) {
        console.log(`ERROR: secret leaked on GET for endpoint ${res.data.id}!`);
      }
    }
  }
}
run().catch(console.error).finally(() => process.exit(0));
