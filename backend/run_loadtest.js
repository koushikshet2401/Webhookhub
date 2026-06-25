const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function run() {
  await prisma.user.deleteMany({});
  await prisma.project.deleteMany({});
  
  const user = await prisma.user.create({ data: { name: 'admin', email: 'admin_load@test.com', passwordHash: 'hash', role: 'ADMIN' } });
  const project = await prisma.project.create({ data: { name: 'load_test_proj' } });
  
  // Create API key manually bypassing controller
  const KEY_PREFIX = 'whsk';
  const secret = crypto.randomBytes(24).toString('hex');
  const fullKey = `${KEY_PREFIX}_${secret}`;
  const prefix = secret.slice(0, 8);
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
  
  await prisma.apiKey.create({ data: { projectId: project.id, prefix, keyHash, label: 'load_test_key' } });
  
  console.log(`Running loadtest with key: ${fullKey}`);
  try {
    const out = execSync(`node backend/scripts/loadtest.js ${fullKey} http://localhost:6000/api 30 20`);
    console.log(out.toString());
  } catch (err) {
    console.log(err.stdout?.toString());
    console.log(err.stderr?.toString());
  }
}
run().finally(() => prisma.$disconnect());
