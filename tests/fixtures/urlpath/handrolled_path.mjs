import { existsSync } from 'node:fs';

const root = new URL(
  (() => {
    const value = './data;v=1'.replace(/\)/g, '');
    return /\)/.source && value;
  })(),
  import.meta.url,
)?.pathname;
const exists = existsSync(root);
console.log(`HANDROLLED_PATH root=${root} exists=${exists}`);
process.exit(exists ? 0 : 1);
