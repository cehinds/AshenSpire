#!/usr/bin/env node
// Rogue full-slice contract. Source/model only: no browser and no generated build.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { createRunState } from '../src/model/state.js';
import { COMBAT_OPCODES } from '../src/model/schemas.js';

const ROOT = resolve(import.meta.dirname, '..');
const projectCapacity4 = process.argv.includes('--project-capacity4');
const bundle = projectCapacity4
  ? {
      ...contentBundle,
      balance: { ...contentBundle.balance, flaskCapacity: 4 },
      classes: contentBundle.classes.map((row) => ({
        ...row,
        startingFlaskAllocation: row.id === 'starseer' ? { hp: 2, mana: 2 }
          : row.id === 'rogue' ? row.startingFlaskAllocation : { hp: 3, mana: 1 },
      })),
    }
  : contentBundle;
let passed = 0;
let failed = 0;
function check(ok, label, detail = '') {
  if (ok) { passed++; console.log(`PASS ${label}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

const errors = validateContent(bundle).errors;
check(errors.length === 0, 'content bundle validates', errors.map((row) => `${row.path}: ${row.msg}`).join(' | '));

const rogue = bundle.classes.find((row) => row.id === 'rogue');
const rogueCards = bundle.cards.filter((row) => row.class === 'rogue');
const rewardCards = rogue ? rogue.cardPool.map((id) => rogueCards.find((card) => card.id === id)).filter(Boolean) : [];
check(!!rogue, 'Rogue class is registry-authored');
check(rogueCards.length === 39, 'Rogue authors exactly 39 cards', `got ${rogueCards.length}`);
check(rogue?.cardPool?.length === 36 && rewardCards.length === 36,
  'Rogue reward pool has exactly 36 reachable cards', `pool ${rogue?.cardPool?.length || 0}, found ${rewardCards.length}`);
check(JSON.stringify(rewardCards.reduce((out, card) => ({ ...out, [card.rarity]: (out[card.rarity] || 0) + 1 }), {}))
  === JSON.stringify({ common: 13, uncommon: 13, rare: 10 }),
  'Rogue reward rarities are 13 common / 13 uncommon / 10 rare');
check(rogueCards.every((card) => card.textTemplate && card.upgrade && Object.keys(card.upgrade).length),
  'every Rogue card has player text and an authored upgrade');
check(rogue?.startingSignatureCard === 'ambush' && rogueCards.some((card) => card.id === 'ambush' && card.rarity === 'starter'),
  'Ambush is the Rogue starter signature');
check(rogue?.startingRelic === 'cutpursesCoin' && bundle.relics.some((row) => row.id === 'cutpursesCoin' && row.rarity === 'starter'),
  "Cutpurse's Coin is the Rogue starter relic");
check(JSON.stringify(rogue?.startingFlaskAllocation) === JSON.stringify({ hp: 3, mana: 1 }),
  'Rogue starts with 3 Crimson / 1 Azure charge');

const tuned = bundle.attributeRules?.presets?.tuned?.rogue;
check(JSON.stringify(tuned) === JSON.stringify({ strength: 11, dexterity: 13, constitution: 10, wisdom: 9, intelligence: 10 }),
  'Rogue tuned preset is STR11 DEX13 CON10 WIS9 INT10', JSON.stringify(tuned));

const statusIds = new Set(bundle.statuses.map((row) => row.id));
check(['prepared', 'venom', 'afterimage', 'deadlyTempo', 'opportunist', 'envenom'].every((id) => statusIds.has(id)),
  'Rogue mechanics are content statuses over existing hooks');
const prepared = bundle.statuses.find((row) => row.id === 'prepared');
const venom = bundle.statuses.find((row) => row.id === 'venom');
check(prepared?.stackMode === 'unique' && prepared?.decay === 'perTurnEnd', 'Prepared is unique and expires at turn end');
check(venom?.stackMode === 'add' && venom?.decay === 'perTurnEnd'
  && venom.hooks?.some((hook) => hook.on === 'ownerTurnStart' && hook.do?.some((effect) => effect.op === 'loseHp')),
  'Venom ticks through generic status hooks and decays');

const legal = new Set(COMBAT_OPCODES);
const effects = [];
const collect = (rows) => rows.forEach((row) => {
  effects.push(...(row.effects || []), ...(row.upgrade?.effects || []));
});
collect(rogueCards);
const rogueRelic = bundle.relics.find((row) => row.id === 'cutpursesCoin');
for (const trigger of rogueRelic?.triggers || []) effects.push(...(trigger.do || []));
for (const status of bundle.statuses.filter((row) => ['prepared', 'venom', 'afterimage', 'deadlyTempo', 'opportunist', 'envenom'].includes(row.id))) {
  for (const hook of status.hooks || []) effects.push(...(hook.do || []));
}
check(effects.every((effect) => legal.has(effect.op)), 'Rogue uses only the existing combat opcode vocabulary',
  [...new Set(effects.filter((effect) => !legal.has(effect.op)).map((effect) => effect.op))].join(', '));
check(Object.keys(bundle.scripts || {}).length === 1, 'Rogue adds no script escape hatch');

const kits = bundle.equipment.startingKits.filter((row) => row.classId === 'rogue');
const outfits = bundle.equipment.armour.filter((row) => row.classId === 'rogue');
check(kits.length === 2 && kits.filter((row) => row.baseline).length === 1, 'Rogue has two kits and one baseline kit');
check(outfits.length === 4 && outfits.filter((row) => row.unlock === '').length === 1, 'Rogue has four outfits and one free baseline outfit');
check(kits.every((kit) => ['dagger', 'shortbow'].includes(kit.rightHand)
  && ['', 'buckler', 'parryDagger'].includes(kit.leftHand)), 'Rogue kits reuse registered armament kinds');

for (const tint of ['ember', 'frost', 'gold', 'grace', 'rot']) {
  check(existsSync(resolve(ROOT, `assets/sprites/rogue_${tint}.webp`)), `Rogue ${tint} stage sprite exists`);
}
for (const outfit of ['default', 'nightveil', 'duelist', 'shadow']) {
  check(existsSync(resolve(ROOT, `assets/equipment/body_rogue_${outfit}.webp`)), `Rogue ${outfit} body layer exists`);
}

let run = null;
let runError = '';
try { run = createRunState({ seed: 0x704, classId: 'rogue', registries: createRegistries(bundle) }); }
catch (error) { runError = error.message; }
check(!!run, 'Rogue creates through the real run-state door', runError);
check(run?.deck?.length === 10 && run.deck.filter((card) => card.cardId === 'ambush').length === 1,
  'Rogue starts with the registry-derived 10-card deck and one Ambush');
check(run?.flaskCharges?.capacity === 4 && run.flaskCharges.hp === 3 && run.flaskCharges.mana === 1,
  'Rogue run carries the authored 4-charge 3/1 split', JSON.stringify(run?.flaskCharges));

console.log(`\nrogue-parity: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
