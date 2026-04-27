const { spawn } = require('child_process');
const path = require('path');

const dbDir = path.join(__dirname, 'lib', 'db');
const env = {
  ...process.env,
  DATABASE_URL: 'postgresql://neondb_owner:npg_vfPaMRhY1F2k@ep-divine-mountain-ak27kpk8-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
};

const child = spawn('npx', ['drizzle-kit', 'push', '--config', './drizzle.config.ts'], {
  cwd: dbDir,
  env,
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
});

let output = '';

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);

  // When drizzle-kit prompts for each table, send Enter to select the default (create table)
  if (text.includes('created or renamed from another table')) {
    setTimeout(() => child.stdin.write('\n'), 200);
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
});

child.on('close', (code) => {
  console.log(`\nExited with code ${code}`);
  if (code !== 0) process.exit(code);
});

setTimeout(() => {
  if (!child.killed) {
    console.log('\nTimed out after 60s');
    child.kill();
    process.exit(1);
  }
}, 60000);
