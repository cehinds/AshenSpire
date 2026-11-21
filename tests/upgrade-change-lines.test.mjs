// Every change an upgrade option makes is on the modal (owner, 2026-11-20): no tile reads a bare "Option n" or "Bonus n".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile, projectGameCard } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';
import { rankUpBonusOptions } from '../src/model/rankUpBonus.js';
import { cardUpgradeChanges } from '../src/ui/models/CardUpgradeModel.js';
import { PickText, SmithPickChangeText, SmithOptionPool } from '../src/model/smithUpgrade.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const baseRun = createRunState({ seed: 1, classId: 'reaver', registries, runId: 'lines', profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const pool = registries.cards.all().filter((def) => def.id.startsWith('core.') && !['status', 'curse'].includes(def.type));
const faceOf = (run, instance) => projectGameCard(run, instance);

test('every option offered for every shipped Core card names at least one change (first and second upgrade, rank-up bonus)', () => {
  const blank = [];
  let checked = 0;
  for (const def of pool) {
    for (let seed = 1; seed <= 4; seed += 1) {
      const run = { ...baseRun, seed };
      const fresh = { instanceId: `l${seed}`, cardId: def.id, upgraded: false };
      const first = nextUpgradeOptions(run, fresh, def, registries, 3);
      const check = (instance, steps, label) => {
        const before = faceOf(run, instance);
        for (const step of steps) {
          checked += 1;
          const after = faceOf(run, { ...instance, upgraded: true, upgradeSteps: [...(instance.upgradeSteps || []), step] });
          if (!cardUpgradeChanges(registries, before, after).length) blank.push(`${def.id} ${label} ${JSON.stringify(step)}`);
        }
      };
      check(fresh, first, 'first');
      if (first.length) {
        const worn = { ...fresh, upgraded: true, upgradeSteps: [first[0]] };
        check(worn, nextUpgradeOptions(run, worn, def, registries, 3), 'second');
      }
      for (const option of rankUpBonusOptions(registries, run, fresh)) {
        checked += 1;
        if (!cardUpgradeChanges(registries, faceOf(run, fresh), faceOf(run, option.after)).length) blank.push(`${def.id} bonus ${JSON.stringify(option.step)}`);
      }
    }
  }
  assert.ok(checked > 1000, `checked ${checked} options`);
  assert.deepEqual(blank, []);
});

test('item options read in player words with their change on the item, never a raw effect id', () => {
  const refs = ['armament/greatsword', 'armament/dagger', `armor/reaver/${baseRun.loadout.sets.armor[0]}`];
  const run = { ...baseRun, itemUpgradePicks: { 'armament/greatsword': [{ id: 'attr:strength', k: 'stat', stat: 'strength', n: 1 }] } };
  for (const ref of refs) {
    for (const { pick } of SmithOptionPool(run, ref)) {
      const line = SmithPickChangeText(run, ref, pick);
      assert.ok(line && !/[a-z][A-Z]/.test(line) && !/[a-z][A-Z]/.test(PickText(pick)), `${ref} ${JSON.stringify(pick)}: ${line}`);
      if (pick.k !== 'prop') assert.match(line, /\+\d+%? → \+\d+%?$/, line);
    }
  }
  assert.equal(SmithPickChangeText(run, 'armament/greatsword', { k: 'stat', stat: 'strength', n: 1 }), 'STR +1 → +2');
  assert.equal(PickText({ k: 'effect', effect: 'poiseDamagePct', n: 10 }), '+10% Poise damage');
});
