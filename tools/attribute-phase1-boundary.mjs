// Attribute integration boundary after the approved derived/equipment slices.
// Combat may transport persisted attributes and hand them back to stampDeck on
// an active-set swap. No engine action/resource/status reader interprets them.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mechanics = [
  'src/engine/actions.js',
  'src/engine/combat.js',
  'src/engine/statuses.js',
  'src/model/formulas.js',
  'src/model/resources.js',
];
const findings = [];
const approvedCombatReaders = new Set([
  'attributes: player.attributes ? { ...player.attributes } : null,',
  'const run = { deck: [], loadout: combat.loadout, class: p.classId, attributes: combat.attributes, equipmentProfileRuleSnapshot: combat.equipmentProfileRuleSnapshot };',
]);

for (const rel of mechanics) {
  const source = readFileSync(resolve(root, rel), 'utf8');
  source.split(/\r?\n/).forEach((line, index) => {
    if (/\battributeMode\b|\.attributes\b|\[['"]attributes['"]\]/.test(line)) {
      const trimmed = line.trim();
      if (rel !== 'src/engine/combat.js' || !approvedCombatReaders.has(trimmed)) {
        findings.push(`${rel}:${index + 1}: unapproved attribute gameplay reader: ${trimmed}`);
      }
    }
    if (/Math\.floor\([^\n]*(?:strength|dexterity|vigour|wisdom|intelligence)|\/\s*5\b/i.test(line)) {
      findings.push(`${rel}:${index + 1}: duplicate attribute tier arithmetic: ${line.trim()}`);
    }
  });
}

for (const rel of ['src/content/attributes.js', 'src/model/attributes.js']) {
  const source = readFileSync(resolve(root, rel), 'utf8');
  source.split(/\r?\n/).forEach((line, index) => {
    if (/\bdodge\b/i.test(line)) {
      findings.push(`${rel}:${index + 1}: unimplemented Dodge contamination: ${line.trim()}`);
    }
  });
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}
console.log(`ATTRIBUTE INTEGRATION BOUNDARY OK — exactly ${approvedCombatReaders.size} combat transport/restamp readers; no duplicate tier arithmetic or fake Dodge consumer.`);
