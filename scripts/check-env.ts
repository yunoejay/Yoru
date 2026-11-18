#!/usr/bin/env node
/**
 * Verify the local environment without printing any values.
 *
 * Run with:  npm run check:env
 *
 * Loads `.env.local` when present. The other scripts use
 * `tsx --env-file=.env.local`, which fails when the file is missing — exactly the
 * situation this check exists to explain. Required keys are only ever reported
 * as present or missing; secret values are never printed.
 */
import { existsSync, readFileSync } from 'node:fs';

const ENV_FILE = '.env.local';

/** Variables the app needs for a complete local setup. */
const REQUIRED = ['DATABASE_URL', 'AUTH_JWT_SECRET'] as const;

/** Optional keys and what happens when they are absent. */
const OPTIONAL: ReadonlyArray<{ name: string; note: string }> = [
  { name: 'APP_URL', note: 'defaults to http://localhost:3000' },
  { name: 'SOURCE_USER_AGENT', note: 'importers need a real contact User-Agent' },
  { name: 'SOURCE_RATE_PER_SEC', note: 'defaults to 4 requests/second' },
  { name: 'SOURCE_BURST', note: 'defaults to 2' },
  { name: 'MANGADEX_ENABLED', note: 'see .env.example (off by default)' },
  { name: 'ATSUMARU_ENABLED', note: 'see .env.example (on by default)' },
  { name: 'SMTP_HOST', note: 'unset -> verification codes print to the console' },
];

/**
 * Minimal .env reader: no dependency, no value output, and a real shell/CI
 * value wins over the file. Handles `KEY=value` with optional single/double
 * quotes; the repo's env files do not use inline comments.
 */
function loadEnvFile(path: string): boolean {
  if (!existsSync(path)) return false;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    let value = raw.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
  return true;
}

const isSet = (name: string): boolean => Boolean(process.env[name]?.trim());

const loaded = loadEnvFile(ENV_FILE);
console.log(
  `Yoru environment check${loaded ? ` (${ENV_FILE} loaded)` : ` (${ENV_FILE} not found)`}\n`,
);

console.log('Required:');
for (const name of REQUIRED) {
  console.log(`  ${isSet(name) ? '✓' : '✗'} ${name} ${isSet(name) ? 'is set' : 'is missing'}`);
}

console.log('\nOptional:');
for (const { name, note } of OPTIONAL) {
  console.log(`  ${isSet(name) ? '✓' : '–'} ${name}${isSet(name) ? ' is set' : ` not set (${note})`}`);
}

const missing = REQUIRED.filter(name => !isSet(name));
if (missing.length) {
  console.error(`\nMissing required variables: ${missing.join(', ')}`);
  console.error(
    'Run `npm run env:pull` (linked Vercel project), or copy .env.example to .env.local and fill it in.',
  );
  process.exit(1);
}

console.log('\nEnvironment looks good. Values were not printed.');
