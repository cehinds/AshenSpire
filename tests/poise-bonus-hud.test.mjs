// Owner, 2026-11-15 (W25-W; swapped to purple 2026-11-24): while bonus Poise (Barrier stacks) is above the base maximum the Poise bar's bonus part is purple and the number
// reads "8/8" in yellow followed by "+5" in purple; player and enemy HUDs share the mini HUD, so the one renderer covers both.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PoiseBonusView } from '../src/ui/models/CombatHealthModel.js';
import { ApplyPoiseBonus } from '../src/ui/components/combatHealth.js';
import { meter } from '../src/ui/kit/index.js';
import { withKitDom } from './helpers/dom.mjs';

test('PoiseBonusView splits current Poise into the base part and the bonus past the base maximum', () => {
  // 8 base + one Barrier stack (+5): max 13.
  assert.deepEqual({ ...PoiseBonusView({ value: 13, max: 13, barrierBonus: 5 }) }, { base: 8, shown: 8, bonus: 5, max: 13, value: 13 });
  assert.deepEqual({ ...PoiseBonusView({ value: 10, max: 13, barrierBonus: 5 }) }, { base: 8, shown: 8, bonus: 2, max: 13, value: 10 });
});

test('PoiseBonusView is null with no bonus stack, or once damage has eaten the bonus part', () => {
  assert.equal(PoiseBonusView({ value: 8, max: 8 }), null);
  assert.equal(PoiseBonusView({ value: 8, max: 13, barrierBonus: 5 }), null, 'at the base maximum nothing is above it');
  assert.equal(PoiseBonusView({ value: 3, max: 13, barrierBonus: 5 }), null);
  assert.equal(PoiseBonusView(null), null);
});

for (const who of ['player', 'enemy']) {
  test(`the ${who} Poise meter shows "8/8" then "+5" and a blue bonus segment`, () => withKitDom(() => {
    const el = meter({ id: 'poise', value: '13/13', cur: 13, max: 13, pct: 100 });
    el.dataset.who = who;
    ApplyPoiseBonus(el, PoiseBonusView({ value: 13, max: 13, barrierBonus: 5 }));
    const value = el.querySelector('.m-value');
    assert.match(value.textContent, /8\/8/, 'the base figure');
    assert.doesNotMatch(value.textContent, /13/, 'the full maximum is not printed');
    assert.equal(value.querySelector('.m-bonus').textContent.trim(), '+5', 'the bonus figure, in its own (blue) span');
    assert.equal(el.dataset.bonus, '5');
    const seg = el.querySelector('.m-track .m-bonus-seg');
    assert.ok(seg, 'a bonus segment on the track');
    assert.equal(seg.dataset.from, '61.5%', '8 of 13');
    assert.equal(seg.dataset.width, '38.5%', '5 of 13');
    assert.match(value.getAttribute('aria-label'), /Poise 8 of 8, plus 5 bonus/);
    // Idempotent: a second pass adds no second segment.
    ApplyPoiseBonus(el, PoiseBonusView({ value: 13, max: 13, barrierBonus: 5 }));
    assert.equal(el.querySelectorAll('.m-bonus-seg').length, 1);
  }));
}

test('without bonus the meter is left as drawn', () => withKitDom(() => {
  const el = meter({ id: 'poise', value: '8/8', cur: 8, max: 8, pct: 100 });
  ApplyPoiseBonus(el, PoiseBonusView({ value: 8, max: 8 }));
  assert.equal(el.querySelector('.m-value').textContent, '8/8');
  assert.equal(el.querySelector('.m-bonus-seg'), null);
  assert.equal(el.dataset.bonus, undefined);
}));

test('the engine reports the bonus maximum so the HUD can follow it', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = await import('../src/model/gameProfile.js');
  const { createRunState } = await import('../src/model/state.js');
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const S = await import('../src/engine/statuses.js');
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const e = combat.enemies[0], base = e.persistentPoise.max;
  S.applyStatus(combat, e, 'barrier', 1, combat.player);
  const event = combat.eventLog.filter(row => row.type === 'persistentPoiseChanged' && row.targetId === e.id).at(-1);
  assert.equal(event.barrierBonus, 5);
  assert.deepEqual({ ...PoiseBonusView({ value: event.value, max: event.max, barrierBonus: event.barrierBonus }) }, { base, shown: base, bonus: 5, max: base + 5, value: base + 5 });
});

// Owner, 2026-11-15 (batch 4): at 390x844 a right-lane enemy's "10/10 +5" ran past the screen edge. While a bonus shows, the plate takes the number's own width
// and the bar gives up that room (it was a fixed value slot), so the row never outgrows the HUD.
test('the mini HUD lets a bonus-Poise bar give up width to its longer number', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../styles/combat-mini-hud.css', import.meta.url), 'utf8');
  assert.match(css, /combat-health-poise-bar\[data-bonus\] > \.m-well \{ flex: 0 1 var\(--mh-bar-w\); \}/);
  assert.match(css, /combat-health-poise-bar\[data-bonus\] > \.m-plate\.m-plate \{ flex: 0 0 auto; \}/);
});
