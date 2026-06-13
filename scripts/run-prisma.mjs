import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const databaseDir = join(rootDir, 'packages', 'database');

const defaultDatabaseUrl =
  'postgresql://sailorclaw:change_me@localhost:5432/sailorclawbot?schema=public';

const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || defaultDatabaseUrl
};

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
