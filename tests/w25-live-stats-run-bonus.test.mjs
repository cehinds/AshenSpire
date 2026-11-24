// W25-L: the run-long "+1 INT / +1 WIS while this card is in your deck" upgrade.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { upgradeStepsProblems, applyUpgradeSteps, DeckAttributeBonuses } from '../src/model/cardUpgrade.js';
import { rollUpgradeOptions, upgradeStepRng } from '../src/model/cardUpgradeSteps.js';
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileGear.js';
import { gameProfileRatingReceipt } from '../src/model/gameProfileRun.js';
import { statProjection } from '../src/model/statProjection.js';

const attr = (stat, n = 1) => ({ k: 'attr', stat, n });
const newRun = (classId = 'reaver') => createRunState({ registries, classId, seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const withBonus = (run, step) => { Object.assign(run.deck[0], { upgraded: true, upgradeSteps: [{ k: 'authored' }, step] }); return run; };

test('attr steps validate: INT or WIS, a small count', () => {
  const p = (step) => upgradeStepsProblems({ upgraded: true, upgradeSteps: [step] }, 'c');
  assert.deepEqual(p(attr('intelligence')), []);
  assert.deepEqual(p(attr('wisdom', 2)), []);
  assert.match(p(attr('strength'))[0], /stat/);
  assert.match(p({ k: 'attr', stat: 'wisdom' })[0], /\.n/);
});

test('an attr step changes no play of the card but records its run bonus', () => {
  const strike = registries.cards.get('core.strike');
  const out = applyUpgradeSteps(strike, [{ k: 'authored' }, attr('wisdom')]);
  assert.deepEqual(out.runAttributeBonus, { wisdom: 1 });
  assert.deepEqual(out.effects, applyUpgradeSteps(strike, [{ k: 'authored' }]).effects);
});

test('a random roll never offers it; a card whose upgradeMenu names it is offered it, on spells only', () => {
  const spells = registries.cards.ids().map(id => registries.cards.get(id)).filter(d => (d.tags || []).includes('camp:spell') && (d.effects || []).some(e => e.op === 'damage')).slice(0, 3);
  const strike = registries.cards.get('core.strike');
  // Owner, 2026-11-20: no dud upgrades. `attr` is in DUD_KINDS, so only an authored upgradeMenu can name it.
  let plainAttr = 0, menuSpellAttr = 0, menuStrikeAttr = 0;
  for (const idx of [0, 4, 8, 9, 10]) for (let seed = 0; seed < 300; seed += 1) {
    for (const def of spells) {
      for (const step of rollUpgradeOptions(def, [], idx, upgradeStepRng(seed, `i${seed}`, idx), {}, 3)) if (step.k === 'attr') plainAttr += 1;
      for (const step of rollUpgradeOptions({ ...def, upgradeMenu: ['attr'] }, [], idx, upgradeStepRng(seed, `i${seed}`, idx), {}, 1)) {
        if (step.k === 'attr') { menuSpellAttr += 1; assert.ok(['intelligence', 'wisdom'].includes(step.stat)); assert.equal(step.n, 1); }
      }
    }
    for (const step of rollUpgradeOptions(strike, [], idx, upgradeStepRng(seed, `i${seed}`, idx), {}, 3)) if (step.k === 'attr') plainAttr += 1;
    for (const step of rollUpgradeOptions({ ...strike, upgradeMenu: ['attr'] }, [], idx, upgradeStepRng(seed, `i${seed}`, idx), {}, 3)) if (step.k === 'attr') menuStrikeAttr += 1;
  }
  assert.equal(plainAttr, 0, 'a random roll never offers the run attribute');
  assert.ok(menuSpellAttr > 0, 'a spell whose upgradeMenu names it is offered it');
  assert.equal(menuStrikeAttr, 0, 'never on a physical attack, even when its menu names it');
});

test('the run-long +1 INT applies to the effective attributes, the ratings, the sheet and a fight; it leaves with the card', () => {
  const plain = newRun();
  const run = withBonus(newRun(), attr('intelligence'));
  assert.deepEqual(DeckAttributeBonuses(run.deck), { intelligence: 1 });
  const int = plain.attributes.intelligence;
  assert.equal(gameProfileEffectiveAttributes(registries, run).intelligence, gameProfileEffectiveAttributes(registries, plain).intelligence + 1);
  assert.equal(gameProfileRatingReceipt(registries, run).totals.pr, gameProfileRatingReceipt(registries, plain).totals.pr + 1, 'PR reads INT');
  const sheet = (r) => statProjection(registries, r).attributes.find(row => row.id === 'intelligence').value;
  assert.equal(sheet(run), int + 1, 'the sheet shows it');
  assert.equal(run.attributes.intelligence, int, 'the run\'s own attribute is never rewritten');
  const fight = (r) => createRunCombat({ registries, run: r, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  assert.equal(fight(run).player.attributes.intelligence, fight(plain).player.attributes.intelligence + 1, 'a fight loads it');
  // The card leaves the deck: the bonus goes with it.
  run.deck.splice(0, 1);
  assert.deepEqual(DeckAttributeBonuses(run.deck), {});
  assert.equal(sheet(run), int);
  assert.equal(fight(run).player.attributes.intelligence, fight(plain).player.attributes.intelligence);
});

test('the run-long +1 WIS lifts PR when WIS is the higher attribute', () => {
  const plain = newRun('starseer'), run = withBonus(newRun('starseer'), attr('wisdom'));
  for (const r of [plain, run]) r.attributes.wisdom = r.attributes.intelligence + 4;
  assert.equal(gameProfileRatingReceipt(registries, run).totals.pr, gameProfileRatingReceipt(registries, plain).totals.pr + 1);
});
