// Reviewable projection of the sole authored tag junction, not another registry.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { attackDescriptor } from '../src/model/attackTags.js';
const registries = createRegistries(contentBundle);
const rows = [];
const errors = [];
for (const [family, entries] of [['card', registries.cards.all()], ['armament', registries.equipment.armaments], ['basicCardProfile', registries.equipment.basicCardProfiles]]) {
  for (const entry of entries) {
    const direct = family === 'armament' || (family === 'basicCardProfile' ? entry.role === 'attack' : [...entry.effects, ...(entry.upgrade?.effects || [])].some((e) => e.op === 'damage'));
    const identity = attackDescriptor(entry);
    if (direct && !identity.source) errors.push(`${family}.${entry.id}: missing source assignment`);
    if (family === 'armament' && !identity.damageType) errors.push(`${family}.${entry.id}: missing base damage type`);
    const tags = (domain) => (entry.tags || []).filter((id) => registries.tags.find((tag) => tag.id === id)?.domain === domain).join('|');
    rows.push([family, entry.id, entry.type || entry.role || entry.kind, direct, identity.source || '', identity.damageType || (direct ? 'equipped source' : ''), tags('delivery'), tags('technique'), tags('theme')]);
  }
}
const csv = [['family', 'id', 'kind', 'directDamage', 'source', 'damageType', 'delivery', 'technique', 'theme'], ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
const destination = fileURLToPath(new URL('../docs/attack-source-audit.csv', import.meta.url));
if (process.argv.includes('--write') && !errors.length) writeFileSync(destination, csv);
if (process.argv.includes('--check')) {
  try { if (readFileSync(destination, 'utf8').replaceAll('\r\n', '\n') !== csv) errors.push('attack-source-audit.csv is stale; run node tools/attack-source-audit.mjs --write'); }
  catch { errors.push('attack-source-audit.csv is missing; run node tools/attack-source-audit.mjs --write'); }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`${rows.length} attack-source audit checks passed`);
