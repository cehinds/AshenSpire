// Contract for data-owned, non-color-only flask identity on every major surface.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0;
let failures = 0;
function check(name, fn) {
  checks++;
  try { fn(); console.log(`PASS  ${name}`); }
  catch (error) { failures++; console.log(`FAIL  ${name} — ${error.message}`); }
}
const assert = (v, m) => { if (!v) throw new Error(m); };
const source = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

check('every flask owns icon, artKey and tint in content data', () => {
  for (const row of contentBundle.flasks) {
    assert(typeof row.icon === 'string' && row.icon, `${row.id}.icon absent`);
    assert(typeof row.artKey === 'string' && row.artKey, `${row.id}.artKey absent`);
    assert(typeof row.tint === 'string' && row.tint, `${row.id}.tint absent`);
  }
});

check('Crimson and Azure are red/blue and remain distinct without color', () => {
  const crimson = contentBundle.flasks.find((row) => row.id === 'crimsonFlask');
  const azure = contentBundle.flasks.find((row) => row.id === 'azureFlask');
  assert(crimson.artKey === 'flask-crimson' && /#|red|crimson/i.test(crimson.tint), 'Crimson identity is not red flask art');
  assert(azure.artKey === 'flask-azure' && /#|blue|azure/i.test(azure.tint), 'Azure identity is not blue flask art');
  assert(crimson.icon !== azure.icon, 'Crimson and Azure share the same non-color glyph');
  assert(crimson.name !== azure.name, 'Crimson and Azure share the same accessible name');
});

check('one presenter reaches inventory, solo, co-op, map and Grace receipt', () => {
  for (const rel of [
    'src/ui/components/overlay.js',
    'src/ui/screens/combat.js',
    'src/ui/screens/coop.js',
    'src/ui/screens/map.js',
    'src/ui/screens/rest.js',
  ]) assert(/flaskPresentation|flaskIdentityHtml/.test(source(rel)), `${rel} bypasses shared flask identity`);
});

check('presentation carries a visible glyph, name and machine-readable art key', () => {
  const presenter = source('src/ui/components/flask.js');
  assert(/data-flask-art/.test(presenter), 'presenter omits art key');
  assert(/aria-label/.test(presenter), 'presenter omits accessible name');
  assert(/\.icon/.test(presenter), 'presenter omits visible glyph');
  assert(/\.tint/.test(presenter), 'presenter omits authored tint');
});

console.log(`\n${failures ? `FLASK PRESENTATION RED — ${failures}/${checks}` : `FLASK PRESENTATION GREEN — ${checks}/${checks}`}`);
if (failures) process.exit(1);
