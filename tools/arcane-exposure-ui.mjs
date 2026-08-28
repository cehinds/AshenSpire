#!/usr/bin/env node
// Observed-red UI contract. Both combat surfaces consume host-owned snapshots;
// this gate introduces no client meter mutation or damage arithmetic.

import fs from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { createRunState } from '../src/model/state.js';
import * as UiContent from '../src/ui/uiContent.js';

const R = createRegistries(contentBundle);
let passed = 0;
let failed = 0;
function check(ok, label, detail = '') {
  if (ok) { passed++; console.log(`PASS ${label}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

let arcaneExposureReceipt = null;
try {
  ({ arcaneExposureReceipt } = await import('../src/ui/components/arcaneExposure.js'));
} catch (error) {
  check(false, 'shared Arcane Exposure UI receipt exists', error.message);
}
check(typeof arcaneExposureReceipt === 'function', 'shared Arcane Exposure UI receipt is exported');
check(typeof UiContent.statusInstancePresentation === 'function',
  'one shared status instance reader owns percent versus duration semantics');
if (UiContent.statusInstancePresentation) {
  const row = UiContent.statusInstancePresentation(
    R.statuses.get('magicVulnerable'), { stacks: 25, duration: 2 },
  );
  check(row.valueText === '25%' && row.durationText === '2 turns' && !/×25|x25/i.test(row.label),
    'Magic Vulnerable presents effect percent and duration, never generic stacks', JSON.stringify(row));
}

function enemy(enemyId) {
  const run = createRunState({ seed: 0xa11, classId: 'starseer', registries: R });
  const combat = createCombat({
    registries: R, rng: createRng(0xa11), enemyIds: [enemyId],
    player: {
      classId: run.class, attributes: run.attributes, maxHp: run.maxHp, hp: run.hp,
      maxMana: run.maxMana, mana: run.mana, maxStamina: run.maxStamina, stamina: run.stamina,
      energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, deck: run.deck,
      relicIds: run.relics, flasks: run.flasks, loadout: run.loadout,
      equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot,
    },
  });
  return combat.enemies[0];
}

if (arcaneExposureReceipt) {
  const configured = enemy('wanderingSoldier');
  configured.arcaneExposure.value = 3;
  const live = arcaneExposureReceipt(R, configured, []);
  check(live?.mode === 'configured' && live.label === 'Arcane Exposure'
      && live.value === 3 && live.threshold === 8 && live.percent === 37.5,
    'configured host meter is visible by its data-owned name and exact receipt', JSON.stringify(live));
  configured.arcaneExposure.value = 7;
  check(arcaneExposureReceipt(R, configured, []).fillPercent === 87.5,
    'host value independently changes the rendered fill numerator');
  configured.arcaneExposure.threshold = 14;
  check(arcaneExposureReceipt(R, configured, []).percent === 50,
    'host threshold independently changes denominator and fill');
  configured.arcaneExposure.value = 99;
  check(arcaneExposureReceipt(R, configured, []).percent > 100
      && arcaneExposureReceipt(R, configured, []).fillPercent === 100,
    'numeric receipt stays exact while visual fill clamps independently');
  check(arcaneExposureReceipt(R, enemy('blightHound'), []) === null,
    'truly absent enemy has no Arcane Exposure UI row');
  const immuneEnemy = enemy('charredColossus');
  const immune = arcaneExposureReceipt(R, immuneEnemy, [{
    type: 'arcaneExposureRefused', targetId: immuneEnemy.id, reason: 'immune',
    school: 'magic', attempted: 2,
  }]);
  check(immune?.mode === 'immune' && immune.badge === 'Immune' && /refus/i.test(immune.tooltip),
    'immune host state renders a named refusal badge', JSON.stringify(immune));
  const vulnerable = configured;
  vulnerable.statuses.magicVulnerable = { stacks: 25, duration: 2 };
  vulnerable.arcaneExposure.value = 0;
  const receipt = arcaneExposureReceipt(R, vulnerable, [{
    type: 'arcaneBreak', targetId: vulnerable.id, school: 'magic', threshold: 8,
    status: 'magicVulnerable', value: 25, duration: 2,
  }]);
  check(receipt?.status?.id === 'magicVulnerable' && receipt.status.duration === 2
      && /Magic Vulnerable/.test(receipt.status.label) && receipt.locked === true,
    'Magic Vulnerable duration is a host-state receipt beside the meter', JSON.stringify(receipt));
  check(receipt?.event?.type === 'arcaneBreak' && receipt.event.value === 25 && receipt.event.duration === 2,
    'break receipt names its host-authored status value and duration', JSON.stringify(receipt?.event));
  check(immune?.event?.attempted === 2 && immune.event.reason === 'immune' && immune.event.school === 'magic',
    'refusal receipt renders attempted amount, reason, target, and school', JSON.stringify(immune?.event));
  const before = JSON.stringify(configured.arcaneExposure);
  arcaneExposureReceipt(R, configured, []);
  check(JSON.stringify(configured.arcaneExposure) === before,
    'UI receipt never mutates the host-owned meter');
}

const component = fs.existsSync(new URL('../src/ui/components/arcaneExposure.js', import.meta.url))
  ? fs.readFileSync(new URL('../src/ui/components/arcaneExposure.js', import.meta.url), 'utf8') : '';
const solo = fs.readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const coop = fs.readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles/ui.css', import.meta.url), 'utf8');
check(/renderArcaneExposure/.test(solo), 'solo combat renders the shared host-state meter');
check(/renderArcaneExposure/.test(coop), 'co-op combat renders the shared snapshot meter');
check(/statusInstancePresentation/.test(solo) && /statusInstancePresentation/.test(coop),
  'solo and co-op generic status rows consume the shared typed presentation');
check(/arcaneExposure:/.test(solo) && /arcaneExposureChanged/.test(solo) && /arcaneBreak/.test(solo),
  'solo paced snapshot carries and advances host Arcane state');
check(/scene\.events|sc\.events/.test(coop) && /arcaneExposureRefused|arcaneBreak/.test(coop),
  'co-op consumes transported refusal and break receipts');
check(!/dispatch|applyAttackDamage|arcaneExposure(?:\.value)?\s*(?:=|\+\+|--)/.test(component),
  'shared UI component contains no client mutation or damage path');
check(/arcane-exposure-meter/.test(component) && /arcane-exposure-immune/.test(component),
  'configured and immune states have distinct semantic selectors');
check(/magic-vulnerable-receipt/.test(component),
  'active Magic Vulnerable duration has a semantic receipt selector');
check(/aria-label/.test(component) && /arcane-exposure-glyph/.test(component),
  'meter has a semantic label and non-color glyph channel');
check(/\.arcane-exposure-meter[^}]*overflow-wrap\s*:\s*anywhere/s.test(css),
  'meter receipt wraps rather than clipping at 320/390');
check(/\.arcane-exposure-meter[^}]*min-width\s*:\s*7\.2rem/s.test(css),
  'meter keeps a readable 72px floor at 320/390');

console.log(`\narcane exposure UI: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
