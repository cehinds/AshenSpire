// Card upgrades 9: every real Core card x 10 seeds x up to 10 upgrades keeps the rules, through projectGameCard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries, profile } from './helpers/fixcore-combat-rules.mjs';
import { projectGameCard, gameContent } from '../src/model/gameProfile.js';
import { nextUpgradeStep } from '../src/model/cardUpgradeLimits.js';
import { STACK_CAPS } from '../src/model/cardRank.js';
import { FlatSteps } from '../src/model/cardUpgrade.js';

const subject = { gameProfile: profile };
const ids = gameContent(subject, 'cards').filter((c) => c.id.startsWith('core.') && registries.cards.has(c.id)).map((c) => c.id);
const sum = (face, op) => face.effects.filter((e) => e.op === op).reduce((t, e) => t + (Number.isFinite(e.amount) ? e.amount * (e.hits > 1 ? e.hits : 1) : 0), 0);
const first = (face, op) => face.effects.find((e) => e.op === op && Number.isFinite(e.amount));
const total = (face, op) => { const e = first(face, op); return e ? e.amount * (e.hits > 1 ? e.hits : 1) : 0; };
const numbers = (face) => JSON.stringify([face.cost, face.staminaCost, face.manaCost, face.effects, face.tags, face.damageSchool, face.keywords, face.costGrowth || null, face.runAttributeBonus || null]); // a run-long attribute step (W25-L) changes the face by what it gives the run

test('real Core cards at ranks 1, 3 and 10: caps, the +100% guard, loseHp, cost rules and "every step changes something" hold for 10 seeds x 10 upgrades', () => {
  assert.ok(ids.length >= 50);
  let steps = 0;
  for (const rank of [1, 3, 10]) for (const cardId of ids) {
    const base = registries.cards.get(cardId);
    const plain = projectGameCard(subject, { instanceId: 'x', cardId });
    const unranked = plain;
    // The authored upgrade is the owner's own numbers: the rules bound what is rolled on top of it.
    const authored = base.upgrade ? projectGameCard(subject, { instanceId: 'x', cardId, upgraded: true, upgradeSteps: [{ k: 'authored' }] }) : plain;
    for (let seed = 1; seed <= 10; seed += 1) {
      const run = { seed, gameProfile: profile };
      const instance = { instanceId: `inst-${cardId}`, cardId, upgraded: false, ...(rank > 1 ? { rank } : {}) };
      let before = projectGameCard(subject, instance);
      for (let n = 1; n <= 10; n += 1) {
        const step = nextUpgradeStep(run, instance, base, registries);
        if (!step) break;
        instance.upgradeSteps = [...(instance.upgradeSteps || []), step];
        instance.upgraded = true;
        steps += 1;
        const face = projectGameCard(subject, instance);
        const where = `${cardId} rank ${rank} seed ${seed} upgrade ${n} (${JSON.stringify(step)})`;
        assert.notEqual(numbers(face), numbers(before), `${where} changed nothing`);
        before = face;
        for (const op of ['damage', 'block']) {
          const b = total(plain, op);
          if (b && rank === 1) assert.ok(total(face, op) <= Math.max(b * 2, total(authored, op)), `${where}: ${op} ${total(face, op)} > 2 x ${b}`);
        }
        assert.ok(sum(face, 'loseHp') <= sum(plain, 'loseHp'), `${where}: loseHp rose`);
        for (const e of face.effects) {
          if (e.op !== 'applyStatus' || !Number.isFinite(e.stacks) || STACK_CAPS[e.status] === undefined) continue;
          const given = Math.max(0, ...authored.effects.filter((p) => p.op === 'applyStatus' && p.status === e.status && Number.isFinite(p.stacks)).map((p) => p.stacks));
          assert.ok(e.stacks <= Math.max(STACK_CAPS[e.status], given), `${where}: ${e.status} ${e.stacks} over its cap`);
        }
        const flat = FlatSteps(instance.upgradeSteps);
        for (const pool of ['sp', 'mp']) {
          assert.ok(flat.filter((x) => x.k === 'cost' && x.pool === pool).length <= 1, `${where}: repeated ${pool} cost cut`);
        }
        assert.ok(flat.filter((x) => x.k === 'hits').length <= 1, `${where}: hits more than once`);
        const swaps = flat.filter((x) => x.k === 'costSwap');
        assert.ok(swaps.length <= 1, `${where}: cost swap more than once`);
        assert.equal(face.cost, plain.cost - (plain.staminaCost - face.staminaCost) - 0, `${where}: cost must track staminaCost`);
        const spLimit = base.staminaCost + (swaps[0]?.dir === 'mpToSp' ? 2 : 0);
        const mpLimit = (base.manaCost ?? 0) + (swaps[0]?.dir === 'spToMp' ? 1 : 0);
        assert.ok(face.staminaCost >= 0 && face.staminaCost <= spLimit, `${where}: SP outside the cost bounds`);
        const cantripped = flat.some((x) => x.k === 'tag' && x.tag === 'rank.cantrip');
        if (base.manaCost > 0 || swaps.length) {
          assert.ok(cantripped ? face.manaCost === 0 : face.manaCost >= 0 && face.manaCost <= mpLimit && face.cost >= 0, `${where}: MP outside the cost bounds`);
        }
      }
    }
  }
  assert.ok(steps > 1000, `${steps} steps exercised`);
});
