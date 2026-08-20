import { existsSync } from 'node:fs';

const root = new URL(
  '.',
  import.meta.url,
).pathname;
const exists = existsSync(root);
console.log(`HANDROLLED_PATH root=${root} exists=${exists}`);
process.exit(exists ? 0 : 1);
