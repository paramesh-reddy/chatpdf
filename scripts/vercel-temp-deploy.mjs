import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const values = {};
for (const line of envFile.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  let value = match[2];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  values[match[1]] = value;
}

for (const key of ['DATABASE_URL', 'OPENAI_API_KEY']) {
  if (!values[key]) {
    console.error(`Missing ${key}`);
    process.exit(1);
  }
}

const vc = path.join(os.tmpdir(), 'vc-cli', 'node_modules', 'vercel', 'dist', 'vc.js');
const args = [
  vc,
  'deploy',
  '--yes',
  '--prod',
  '--force',
  '--logs',
  '--project',
  'chatpdf0.7',
  '--env',
  `DATABASE_URL=${values.DATABASE_URL}`,
  '--env',
  `OPENAI_API_KEY=${values.OPENAI_API_KEY}`,
];

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  shell: false,
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, CI: '1' },
});

child.on('exit', (code) => process.exit(code ?? 1));
