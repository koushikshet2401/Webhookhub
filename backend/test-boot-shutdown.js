const { spawn } = require('child_process');
const http = require('http');

const serverProcess = spawn('node', ['src/server.js'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';

serverProcess.stdout.on('data', data => {
  const str = data.toString();
  process.stdout.write(str);
  output += str;
});

serverProcess.stderr.on('data', data => {
  const str = data.toString();
  process.stderr.write(str);
  output += str;
});

setTimeout(() => {
  http.get('http://localhost:6000/api/health', (res) => {
    console.log(`\nHealth check status: ${res.statusCode}`);
    
    console.log('\nSending SIGTERM...');
    serverProcess.kill('SIGTERM');
  }).on('error', (e) => {
    console.error(`\nHealth check failed: ${e.message}`);
    serverProcess.kill('SIGKILL');
  });
}, 3000);

serverProcess.on('exit', (code, signal) => {
  console.log(`\nProcess exited with code ${code} and signal ${signal}`);
});
