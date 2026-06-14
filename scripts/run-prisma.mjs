import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const databaseDir = join(rootDir, 'packages', 'database');

// Parse root .env file and merge into process.env
function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf8');
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const dotEnvVars = loadDotEnv(join(rootDir, '.env'));

const env = {
  ...dotEnvVars,
  ...process.env, // process.env takes priority over .env file
};

if (!env.DATABASE_URL) {
  env.DATABASE_URL = 'postgresql://sailorclaw:change_me@localhost:5432/sailorclawbot?schema=public';
}

const result = spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'prisma', ...process.argv.slice(2), '--schema', 'prisma/schema.prisma'],
  {
    cwd: databaseDir,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  }
);

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
