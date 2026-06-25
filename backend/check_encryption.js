const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const endpoints = await prisma.endpoint.findMany({ take: 2 });
  console.log(endpoints.map(e => e.secret));
}
run().catch(console.error).finally(() => prisma.$disconnect());
