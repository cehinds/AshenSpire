// Reviewable projection of the sole authored tag junction, not another registry.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { attackDescriptor } from '../src/model/attackTags.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
const registries = createRegistries(contentBundle);
const rows = [];
const errors = [];
for (const [family, entries] of [['card', registries.cards.all()], ['armament', registries.equipment.armaments], ['basicCardProfile', registries.equipment.basicCardProfiles], ['enemyMove', registries.enemyMoves]]) {
  if (!Array.isArray(entries)) { errors.push(`${family}: missing materialized tag collection`); continue; }
  for (const entry of entries) {
    const profile = combatProfileFor(entry);
    const scope = family === 'enemyMove' ? entry.enemyId : '';
    const subject = `${family}.${scope ? `${scope}.` : ''}${entry.id}`;
    const counterReply = profile.maneuver === 'counter';
    const authoredDamage = family === 'armament' || (family === 'basicCardProfile' ? entry.role === 'attack'
      : entry.damage != null || [...(entry.effects || []), ...(entry.upgrade?.effects || [])].some((e) => e.op === 'damage'));
    const direct = authoredDamage && !counterReply;
    const identity = attackDescriptor(entry);
    if ((direct || counterReply) && !identity.source) errors.push(`${subject}: missing source assignment`);
    if ((family === 'armament' || (family === 'enemyMove' && (direct || counterReply))) && !identity.damageType) errors.push(`${subject}: missing base damage type`);
    if (family !== 'armament' && !profile.camp) errors.push(`${subject}: missing combat camp`);
    if (profile.camp === 'spell' && !profile.school) errors.push(`${subject}: missing spell school`);
    if (counterReply && !profile.counterMode) errors.push(`${subject}: missing Counter reach`);
    const tags = (domain) => (entry.tags || []).filter((id) => registries.tags.find((tag) => tag.id === id)?.domain === domain).join('|');
    rows.push([family, scope, entry.id, entry.type || entry.role || entry.kind || entry.intent, direct, counterReply,
      identity.source || '', identity.damageType || ((direct || counterReply) ? 'equipped source' : ''),
      profile.camp || '', profile.maneuver || '', profile.school || '', profile.counterMode || '', tags('delivery'), tags('technique'), tags('theme')]);
  }
}
const csv = [['family', 'scope', 'id', 'kind', 'directDamage', 'counterReply', 'source', 'damageType', 'camp', 'maneuver', 'school', 'counterMode', 'delivery', 'technique', 'theme'], ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
const destination = fileURLToPath(new URL('../docs/attack-source-audit.csv', import.meta.url));
if (process.argv.includes('--write') && !errors.length) writeFileSync(destination, csv);
if (process.argv.includes('--check')) {
  try { if (readFileSync(destination, 'utf8').replaceAll('\r\n', '\n') !== csv) errors.push('attack-source-audit.csv is stale; run node tools/attack-source-audit.mjs --write'); }
  catch { errors.push('attack-source-audit.csv is missing; run node tools/attack-source-audit.mjs --write'); }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`${rows.length} attack-source audit checks passed`);
