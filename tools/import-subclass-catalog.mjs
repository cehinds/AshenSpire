#!/usr/bin/env node
// Import a portable Score Studio subclass catalog into this checkout's playable content.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { saveStudioSubclassCatalog } from './score-studio-save.mjs';

const args = process.argv.slice(2);
if (!args[0] || args.length > 2 || (args[1] && args[1] !== '--no-rebuild')) {
  process.stderr.write('Usage: node tools/import-subclass-catalog.mjs <catalog.json> [--no-rebuild]\n');
  process.exitCode = 1;
} else {
  try {
    const catalog = JSON.parse(readFileSync(args[0], 'utf8'));
    const result = saveStudioSubclassCatalog(fileURLToPath(new URL('..', import.meta.url)), { catalog, rebuild: args[1] !== '--no-rebuild' });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
