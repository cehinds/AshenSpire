// Phase 1 attributes are creation/save/session data only. This source gate
// fails if a combat/formula/resource reader starts consuming them early, or
// if the clean Phase 1 vocabulary grows deterministic Dodge/stamina behavior.
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

for (const rel of mechanics) {
  const source = readFileSync(resolve(root, rel), 'utf8');
  source.split(/\r?\n/).forEach((line, index) => {
    if (/\battributeMode\b|\.attributes\b|\[['"]attributes['"]\]/.test(line)) {
      findings.push(`${rel}:${index + 1}: Phase 1 attribute gameplay reader: ${line.trim()}`);
    }
  });
}

for (const rel of ['src/content/attributes.js', 'src/model/attributes.js']) {
  const source = readFileSync(resolve(root, rel), 'utf8');
  source.split(/\r?\n/).forEach((line, index) => {
    if (/\b(?:dodge|stamina)\b/i.test(line)) {
      findings.push(`${rel}:${index + 1}: post-Phase-1 mechanic contamination: ${line.trim()}`);
    }
  });
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}
console.log(`ATTRIBUTE PHASE 1 BOUNDARY OK — ${mechanics.length} mechanics files have no attribute reader; no Dodge/stamina vocabulary entered the authored tables/readers.`);
