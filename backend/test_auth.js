const axios = require('axios');
const http = require('http');

const baseURL = 'http://localhost:6000/api';
const client = axios.create({ baseURL, validateStatus: () => true });

async function run() {
  console.log('--- AUTH TESTS ---');
  // 1. Register first user -> ADMIN
  let res = await client.post('/auth/register', { name: 'Admin', email: 'admin@test.com', password: 'password123' });
  console.log('1. First user role:', res.data.user?.role, res.status);
  
  // 2. Register second user -> DEVELOPER
  res = await client.post('/auth/register', { name: 'Dev', email: 'dev@test.com', password: 'password123', role: 'ADMIN' });
  console.log('2. Second user role:', res.data.user?.role, res.status);
  
  // 3. Duplicate email -> 409
  res = await client.post('/auth/register', { name: 'Admin2', email: 'admin@test.com', password: 'password123' });
  console.log('3. Duplicate email status:', res.status, res.data);
  
  // 4. Login correct/incorrect
  res = await client.post('/auth/login', { email: 'admin@test.com', password: 'password123' });
  console.log('4. Login correct status:', res.status);
  const adminTokens = { access: res.data.accessToken, refresh: res.data.refreshToken };
  
  res = await client.post('/auth/login', { email: 'admin@test.com', password: 'wrong' });
  console.log('4. Login incorrect status:', res.status);
  
  // 5. Garbage refresh token
  res = await client.post('/auth/refresh', { refreshToken: 'garbage' });
  console.log('5. Garbage refresh token status:', res.status);
  
  // 6. Logout and reuse token
  await client.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${adminTokens.access}` } });
  res = await client.get('/projects', { headers: { Authorization: `Bearer ${adminTokens.access}` } });
  console.log('6. Reuse token after logout status:', res.status);
  
  // 7. Password reset -> tokens invalidated
  // Re-login
  res = await client.post('/auth/login', { email: 'admin@test.com', password: 'password123' });
  const newTokens = { access: res.data.accessToken };
  
  // Request reset
  await client.post('/auth/forgot-password', { email: 'admin@test.com' });
  // Since we don't have direct access to the console logs easily here, we'll fetch the token from DB
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const logs = await prisma.auditLog.findMany({ where: { action: 'user.password_reset_requested' }, orderBy: { id: 'desc' } });
  // Actually the reset token isn't stored in DB directly? It's in Redis!
  // It's in tokenRevocation.js - wait, how does forgotPassword token work?
  // Let's use redis to get it
  const Redis = require('ioredis');
  const redis = new Redis();
  const keys = await redis.keys('pw_reset:*');
  if (keys.length > 0) {
    const token = keys[0].split(':')[1];
    res = await client.post('/auth/reset-password', { token, newPassword: 'newpassword123' });
    console.log('7. Password reset status:', res.status);
    
    // Use token issued before reset
    res = await client.get('/projects', { headers: { Authorization: `Bearer ${newTokens.access}` } });
    console.log('7. Token before reset reuse status:', res.status);
  } else {
    console.log('7. Could not find reset token in redis');
  }

  // 8. Verify email
  const verifyKeys = await redis.keys('email_ver:*');
  if (verifyKeys.length > 0) {
    const token = verifyKeys[0].split(':')[1];
    res = await client.post('/auth/verify-email', { token });
    console.log('8. Verify email valid status:', res.status);
    
    res = await client.post('/auth/verify-email', { token });
    console.log('8. Verify email reused status:', res.status);
  } else {
    console.log('8. Could not find verify token');
  }
}
run().catch(console.error).finally(() => process.exit(0));
