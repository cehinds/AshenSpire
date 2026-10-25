import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { enemyMoveQuote, buildEnemyQueue } from '../src/engine/combatRoundsAdapter.js';
import { rangePairKey } from '../src/model/combatEngagement.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fight = (id, seed = 511) => {
  const run = createRunState({ registries, classId: 'reaver', seed });
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: [id] });
  combat.player.hp = combat.player.maxHp = 10000;
  return combat;
};
const pairOf = combat => rangePairKey('player:player', combat.enemies[0].rangeActorKey || `enemy:${combat.enemies[0].id}`);
const RETREATERS = ['graveWisp', 'lanternMoth', 'chainScavenger', 'courtSurgeon', 'mirrorScribe', 'blightedValkyrie', 'eclipseCantor', 'ashheartDragon'];

test('every reach-start Core enemy owns a two-SP retreat that moves the pair one band out', () => {
  for (const id of RETREATERS) {
    const def = registries.enemies.get(id), move = def.moves[def.rangeRetreatMove];
    assert.ok(move, `${id} has a retreat`);
    assert.equal(move.sp, def.moves[def.rangeClosingMove].sp + 1, `${id}: retreat is advance + 1`);
    assert.deepEqual(move.effects.map(e => [e.op, e.bands]), [['moveEngagement', 1]]);
    const combat = fight(id);
    assert.equal(enemyMoveQuote(def.moves[def.rangeRetreatMove], { enemy: combat.enemies[0], moveId: def.rangeRetreatMove, combat }).advanceSp, 0);
  }
});

test('a retreat is planned only while the fight is closer than the enemy prefers, and not every turn', () => {
  const plans = (hook, seeds = 25) => {
    const rows = [];
    for (let i = 0; i < seeds; i++) {
      const c = fight('blightedValkyrie', 700 + i), emit = c._emitEvent;
      c._emitEvent = (ctx, type, event) => {
        if (type === 'playerTurnEnd' && hook !== null) ctx.rangeState.engagements[Object.keys(ctx.rangeState.engagements)[0]] = hook;
        return emit(ctx, type, event);
      };
      dispatch(c, { type: 'endTurn' });
      for (let k = 0; c.pendingReaction && k < 50; k++) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
      const e = c.enemies[0];
      rows.push({ band: Object.values(c.rangeState.engagements)[0], moves: [e.intent?.moveId, ...(e.plannedMoves || []).map(m => m.moveId)] });
    }
    return rows;
  };
  const inside = plans(0), atPreferred = plans(1);
  for (const row of [...inside, ...atPreferred]) if (row.band >= 1) assert.ok(!row.moves.includes('retreat'), 'no retreat at or beyond the preferred band');
  const retreating = inside.filter(row => row.band < 1 && row.moves.includes('retreat'));
  assert.ok(retreating.length > 0, 'an enemy engaged inside its preferred band plans a retreat');
  assert.ok(retreating.length < inside.filter(row => row.band < 1).length, 'but not every turn');
  for (const row of inside) for (let j = 1; j < row.moves.length; j++) assert.ok(!(row.moves[j] === 'retreat' && row.moves[j - 1] === 'retreat'), 'never twice running');
});

test('a retreat moves the engagement out one band and the player pays Advance again', () => {
  const combat = fight('graveWisp'), enemy = combat.enemies[0];
  const key = Object.keys(combat.rangeState.engagements)[0];
  combat.rangeState.engagements[key] = 0;
  enemy.pendingMove = null;
  enemy.intent = { kind: 'buff', moveId: 'retreat' };
  const before = combat.rangeState.engagements[key];
  // Drive the move through the live enemy phase by forcing the plan.
  enemy.plannedMoves = [{ moveId: 'retreat', sp: 2 }]; enemy.planDue = true;
  dispatch(combat, { type: 'endTurn' });
  for (let k = 0; combat.pendingReaction && k < 50; k++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  assert.equal(combat.rangeState.engagements[key], before + 1, 'the retreat moved the pair out one band (the player must Advance again)');
});

test('the intent presentation names a retreat and an advance instead of a generic buff', async () => {
  const { combatIntentPresentation } = await import('../src/ui/models/CombatIntentModel.js');
  const base = { kind: 'buff', moveId: 'retreat', revealed: true, hidden: false, profile: { camp: 'physical', maneuver: 'preparing' }, combatProfile: { camp: 'physical' } };
  assert.equal(combatIntentPresentation({ ...base, actionEffects: [{ op: 'moveEngagement', target: 'enemy', bands: 1 }] }).title, 'Retreating');
  assert.equal(combatIntentPresentation({ ...base, moveId: 'advance', actionEffects: [{ op: 'moveEngagement', target: 'enemy', bands: -1 }] }).title, 'Advancing');
  assert.equal(combatIntentPresentation({ ...base, moveId: 'warcry', actionEffects: [{ op: 'applyStatus', target: 'self' }] }).title, 'Buffing');
});
