// Owner, 2026-11-24 (Ward health buffer): Ward adds a blue health-buffer segment on the HP bar (`+N` in blue),
// and CombatPlaybackModel updates `wardHp` from `wardHpChanged`, `damageDealt`, and `wardBroken`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HealthWardView } from '../src/ui/models/CombatHealthModel.js';
import { ApplyHealthWard } from '../src/ui/components/combatHealth.js';
import { meter } from '../src/ui/kit/index.js';
import { withKitDom } from './helpers/dom.mjs';

test('HealthWardView returns null when wardHp is 0 or absent', () => {
  assert.equal(HealthWardView(40, 50, 0), null);
  assert.equal(HealthWardView(40, 50, null), null);
});

test('HealthWardView scales HP and Ward segments cleanly for full and injured HP', () => {
  // Full HP 50/50 + 10 Ward -> totalMax 60
  const full = HealthWardView(50, 50, 10);
  assert.deepEqual({ ...full }, { hp: 50, maxHp: 50, ward: 10, totalMax: 60, hpPct: 83.3, wardFromPct: 83.3, wardWidthPct: 16.7 });
  // Injured HP 20/50 + 10 Ward -> totalMax 50
  const injured = HealthWardView(20, 50, 10);
  assert.deepEqual({ ...injured }, { hp: 20, maxHp: 50, ward: 10, totalMax: 50, hpPct: 40, wardFromPct: 40, wardWidthPct: 20 });
});

for (const who of ['player', 'enemy']) {
  test(`the ${who} HP meter renders "+10" in blue and a blue .m-ward-seg segment`, () => withKitDom(() => {
    const el = meter({ id: 'hp', value: '50/50', cur: 50, max: 50, pct: 100 });
    el.dataset.who = who;
    ApplyHealthWard(el, HealthWardView(50, 50, 10));
    const value = el.querySelector('.m-value');
    assert.match(value.textContent, /50\/50/);
    assert.equal(value.querySelector('.m-ward-bonus').textContent.trim(), '+10');
    assert.equal(el.dataset.wardBonus, '10');
    const seg = el.querySelector('.m-track .m-ward-seg');
    assert.ok(seg);
    assert.equal(seg.dataset.from, '83.3%');
    assert.equal(seg.dataset.width, '16.7%');
    assert.match(value.getAttribute('aria-label'), /HP 50 of 50, plus 10 Ward/);
    // Idempotent
    ApplyHealthWard(el, HealthWardView(50, 50, 10));
    assert.equal(el.querySelectorAll('.m-ward-seg').length, 1);
  }));
}

test('CombatPlaybackModel tracks wardHpChanged, damageDealt.wardHpRemaining, and wardBroken', async () => {
  const { ApplyCombatBeat, CaptureCombatDisplay } = await import('../src/ui/models/CombatPlaybackModel.js');
  const { fight } = await import('./elementFixture.mjs');
  const { combat, player, enemy } = fight({ enemies: 1 });
  player.wardHp = 0;
  enemy.wardHp = 10;
  enemy.statuses.ward = { stacks: 2 };
  const disp = CaptureCombatDisplay(combat, { registries: combat.registries, projectCombatIntent: () => null, followMemo: { plan: () => null } });
  const opts = { combat, registries: combat.registries, projectCombatIntent: () => null, findInst: () => null, playbackEvents: [], reduceFollowRows: () => {} };
  assert.equal(disp.ents.player.wardHp, 0);
  assert.equal(disp.ents[enemy.id].wardHp, 10);
  ApplyCombatBeat(disp, [{ type: 'wardHpChanged', targetId: 'player', value: 5 }], opts);
  assert.equal(disp.ents.player.wardHp, 5);
  ApplyCombatBeat(disp, [{ type: 'damageDealt', targetId: enemy.id, blocked: 0, wardHpRemaining: 4 }], opts);
  assert.equal(disp.ents[enemy.id].wardHp, 4);
  ApplyCombatBeat(disp, [{ type: 'wardBroken', targetId: enemy.id }], opts);
  assert.equal(disp.ents[enemy.id].wardHp, 0);
});

test('Ward HP buffer full absorption reports blocked outcome for floaters while legacy Ward keeps wardResisted', async () => {
  const { outcomeKindForEvent } = await import('../src/ui/fx.js');
  const { floaterWordShown } = await import('../src/ui/models/FloaterPolicyModel.js');
  const wardOnly = { type: 'damageDealt', amount: 0, blocked: 0, hpLoss: 0, wardAbsorbed: 5, wardHpBuffer: true, wardHpRemaining: 0 };
  assert.equal(outcomeKindForEvent(wardOnly), 'blocked');
  assert.equal(floaterWordShown(outcomeKindForEvent(wardOnly)), 'blocked');
  const wardAndPoise = { type: 'damageDealt', amount: 0, blocked: 0, hpLoss: 0, wardAbsorbed: 5, wardHpBuffer: true, wardHpRemaining: 0, poiseAbsorbed: 2, magicPoise: 2 };
  assert.equal(outcomeKindForEvent(wardAndPoise), 'blocked');
  assert.equal(floaterWordShown(outcomeKindForEvent(wardAndPoise)), 'blocked');
  const legacyWard = { type: 'damageDealt', amount: 0, blocked: 0, hpLoss: 0, wardAbsorbed: 3, wardRemaining: 0 };
  assert.equal(outcomeKindForEvent(legacyWard), 'wardResisted');
});
