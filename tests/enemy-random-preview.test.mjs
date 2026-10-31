import test from 'node:test';
import assert from 'node:assert/strict';
import { productionBundle } from './helpers/production-bundle.mjs';
const bundled = productionBundle();
for (const mode of ['native', 'bundled']) test(`${mode} random enemy predicates remain uncommitted and never consume preview RNG`, async () => {
  const load = async path => mode === 'bundled' ? bundled(path) : import(`../${path}`);
  const { contentBundle } = await load('src/content/index.js');
  const { createRegistries } = await load('src/model/registries.js');
  const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = await load('src/model/gameProfile.js');
  const { createRunState } = await load('src/model/state.js');
  const { createRng } = await load('src/engine/rng.js');
  const { createRunCombat } = await load('src/engine/runCombat.js');
  const { previewEnemyAction } = await load('src/engine/enemyActionPreview.js');
  const { dispatch } = await load('src/engine/combat.js');
  const { enemyActionEffectText } = await load('src/model/enemyMoveCards.js');
  const profile = resolveGameProfile('core');
  const base = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const effects = [
    { op: 'block', target: 'self', amount: 2, if: { p: 'random', pct: 100 } },
    { op: 'block', target: 'self', amount: 3, if: { p: 'all', preds: [{ p: 'random', pct: 100 }] } },
    { op: 'block', target: 'self', amount: 5, if: { p: 'any', preds: [{ p: 'not', pred: { p: 'random', pct: 100 } }] } },
    { op: 'block', target: 'self', amount: 11, if: { p: 'any', preds: [{ p: 'random', pct: 0 }, { p: 'hpBelowPct', of: 'owner', pct: 100 }] } },
    { op: 'block', target: 'self', amount: 13, if: { p: 'all', preds: [{ p: 'random', pct: 100 }, { p: 'hpBelowPct', of: 'owner', pct: 0 }] } },
    { op: 'block', target: 'self', amount: 7 },
  ];
  const registries = { ...base, enemies: { ...base.enemies, get(id) {
    const def = base.enemies.get(id);
    return id !== 'wanderingSoldier' ? def : { ...def, firstMove: 'slash', moves: { ...def.moves,
      slash: { ...def.moves.slash, damage: null, hits: 1, effects } } };
  } } };
  function fixture() {
    const run = createRunState({ registries, classId: 'reaver', seed: 511, runId: 'random-preview' });
    const c = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
    c.enemies[0].plannedMoves = [];
    return c;
  }
  const c = fixture(), control = fixture(), enemy = c.enemies[0];
  const snapshot = () => JSON.stringify({ enemy, player: c.player, log: c.eventLog, queue: c.queue, rng: c.rng.getCounters() });
  const before = snapshot();
  for (let n = 0; n < 3; n++) {
    const preview = previewEnemyAction(c, enemy, 'slash');
    const rows = preview.actionEffects;
    assert.deepEqual(Array.from(rows.slice(0, 3), row => [row.conditionMet, row.conditionUncertain]), [[null, true], [null, true], [null, true]]);
    assert.match(enemyActionEffectText(rows[0], registries), /random condition unresolved/);
    assert.equal(rows[3].conditionMet, true);
    assert.equal(rows[4].conditionMet, false);
    assert.equal(rows.at(-1).amount, 7);
    assert.equal(Object.hasOwn(rows.at(-1), 'conditionMet'), false);
  }
  assert.equal(snapshot(), before);
  for (const combat of [c, control]) {
    dispatch(combat, { type: 'setReactions', enabled: false });
    dispatch(combat, { type: 'endTurn' });
  }
  assert.equal(enemy.block, control.enemies[0].block, 'inspection preserves executed conditional and unconditional grants');
  assert.equal(JSON.stringify(c.eventLog), JSON.stringify(control.eventLog));
  assert.equal(JSON.stringify(c.rng.getCounters()), JSON.stringify(control.rng.getCounters()));
  const receipt = c.eventLog.find(e => e.type === 'enemyMoveStarted').actionPreview;
  assert.equal(receipt.actionEffects[0].conditionMet, null);
  assert.equal(receipt.actionEffects[0].conditionUncertain, true);
  // Five execution predicates draw once each; actor/move receipt capture adds none.
  assert.equal(c.rng.getCounters().misc - JSON.parse(before).rng.misc, 5);
});
