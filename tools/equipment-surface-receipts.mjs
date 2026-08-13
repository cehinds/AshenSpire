#!/usr/bin/env node
// Observed-red contract for the one presentation receipt shared by character
// creation and the Armoury. This is source-only: it must not read dist.

import fs from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';

const R = createRegistries(contentBundle);
let passed = 0;
let failed = 0;
function check(ok, label, detail = '') {
  if (ok) { passed++; console.log(`PASS ${label}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

let equipmentSurfaceReceipt = null;
try {
  ({ equipmentSurfaceReceipt } = await import('../src/model/equipmentPresentation.js'));
} catch (error) {
  check(false, 'shared equipment presentation reader exists', error.message);
}
check(typeof equipmentSurfaceReceipt === 'function', 'shared equipment presentation reader is exported');

if (equipmentSurfaceReceipt) {
  const reaver = createRunState({ seed: 0x51, classId: 'reaver', registries: R });
  const active = equipmentSurfaceReceipt(R, reaver);
  check(JSON.stringify(active.roleCopies) === JSON.stringify({ attack: 4, guard: 4, technique: 1, signature: 1 }),
    'active receipt owns exact 4/4/1/1 copy counts', JSON.stringify(active.roleCopies));
  check(active.roles.length === 3 && active.roles.every((row) => row.copies === active.roleCopies[row.role]),
    'each equipment role carries its authored copy count', JSON.stringify(active.roles));
  check(active.signature?.copies === 1 && active.signature?.cardId === R.classes.get('reaver').startingSignatureCard,
    'class signature is the fourth fixed type and carries one copy', JSON.stringify(active.signature));
  check(active.requirements.every((row) => row.pieceId && Array.isArray(row.requirements)),
    'active equipment requirements are presentation-ready receipts', JSON.stringify(active.requirements));
  check(active.poise?.active === false && active.poise?.value === active.poise?.equipment + active.poise?.relic,
    'player Poise threshold stays an inert item plus relic receipt', JSON.stringify(active.poise));
  check(active.poise?.note === 'No current consumer. Player Poise is not the enemy Poise meter.',
    'one exact truthful no-consumer sentence is model-owned', active.poise?.note);

  const lowStrengthReaver = { ...reaver, attributes: { ...reaver.attributes, strength: 10 } };
  const greatsword = equipmentSurfaceReceipt(R, lowStrengthReaver, {
    candidate: { slotId: 'rightHand', setIndex: 0, pieceId: 'greatsword' },
  }).candidate;
  check(greatsword?.pieceId === 'greatsword' && greatsword.requirement?.ok === false
      && greatsword.requirement.failures.some((row) => row.attributeId === 'strength'),
    'candidate comparison carries unmet requirement receipt', JSON.stringify(greatsword));
  check(greatsword?.roles.length === 3 && greatsword.roles.every((row) => Number.isFinite(row.beforeValue) && Number.isFinite(row.afterValue)),
    'candidate comparison carries before-to-after numbers for every equipment role', JSON.stringify(greatsword?.roles));
  check(greatsword?.addedEffects.some((row) => /damage|cost|poise/i.test(row.label)),
    'candidate comparison exposes explicit added effects from registered mod data', JSON.stringify(greatsword?.addedEffects));

  const herald = createRunState({ seed: 0x52, classId: 'herald', registries: R });
  const armourSlot = R.equipment.slots.find((row) => row.kinds.includes('armor'));
  const pilgrim = equipmentSurfaceReceipt(R, herald, {
    candidate: { slotId: armourSlot.id, setIndex: 0, pieceId: 'pilgrim' },
  }).candidate;
  check(pilgrim?.resourceChanges.some((row) => row.id === 'maxHp' && row.after === row.before + 4),
    'candidate comparison exposes authoritative resource before-to-after change', JSON.stringify(pilgrim?.resourceChanges));
  check(pilgrim?.poise && Number.isFinite(pilgrim.poise.before) && Number.isFinite(pilgrim.poise.after),
    'candidate comparison exposes player Poise before-to-after without activating it', JSON.stringify(pilgrim?.poise));
}

const customize = fs.readFileSync(new URL('../src/ui/screens/customize.js', import.meta.url), 'utf8');
const armoury = fs.readFileSync(new URL('../src/ui/screens/equipment.js', import.meta.url), 'utf8');
const receiptComponents = fs.readFileSync(new URL('../src/ui/components/equipmentReceipts.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles/ui.css', import.meta.url), 'utf8');
for (const [source, label] of [[customize, 'creation'], [armoury, 'Armoury']]) {
  check(/equipmentSurfaceReceipt/.test(source), `${label} consumes the shared equipment presentation reader`);
  check(/renderEquipmentRequirements/.test(source), `${label} renders the shared requirement receipt`);
  check(/renderPlayerPoise/.test(source), `${label} renders the shared player Poise receipt`);
}
check(/role-copy-count/.test(armoury), 'Armoury renders role copy-count selectors');
check(/renderCandidateComparison/.test(armoury) && /equip-candidate-comparison/.test(receiptComponents),
  'Armoury renders the canonical candidate comparison');
check(/equip-resource-change/.test(receiptComponents) && /equip-added-effect/.test(receiptComponents),
  'Armoury renders resource and explicit-effect comparison selectors');
for (const selector of ['equipment-requirements', 'player-poise-receipt', 'equip-candidate-comparison']) {
  check(new RegExp(`\\.${selector}[^}]*overflow-wrap\\s*:\\s*anywhere`, 's').test(css),
    `${selector} wraps rather than clipping at 320/390`);
}
check(/\.equip-chip[^}]*min-height\s*:\s*var\(--tap-floor\)/s.test(css),
  'candidate touch target keeps the authored tap floor at 320/390');

console.log(`\nequipment surface receipts: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
