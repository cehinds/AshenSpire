// tests/boss-tiers.test.mjs — SPEC §13.3 balance.bossTiers: a boss is scaled
// by the tier it is MET at, whichever seat holds it (#1284).
//   node --test tests/boss-tiers.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';
import { createRegistries } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewIntent } from '../src/engine/combat.js';
import { drawSeatOrder } from '../src/engine/actmap.js';
import { bossTierScale, seatAtTier, seatTierHpMult } from '../src/model/seats.js';
import { enemyMoveDamage } from '../src/model/state.js';
import { enemyMoveCards } from '../src/model/enemyMoveCards.js';

// Tier damage fixtures read every live preview deliberately. Visibility is
// independently tested below; disable concealment through its public config.
const intentRegistry = (baseHiddenChance) => createRegistries({ ...contentBundle,
  balance: { ...contentBundle.balance,
    combatIntent: { ...contentBundle.balance.combatIntent, baseHiddenChance } },
});
const REG = intentRegistry(0);
const T = REG.balance.seatTiers;
const B = REG.balance.bossTiers;
const enc = (id) => REG.encounters.get(id);
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

const PLAYER = { classId: 'reaver', maxHp: 999, hp: 999, energyMax: 3, drawPerTurn: 5, deck: [{ instanceId: 'x1', cardId: 'strike', upgraded: false }] };
const fightWith = (encounter, tier, seed = 7, registries = REG) => {
  const scale = bossTierScale(registries, { encounter, tier });
  return createCombat({ registries, rng: createRng(seed), player: structuredClone(PLAYER), enemyIds: encounter.enemies, hpMult: scale.hp, enemyDamageMult: scale.damage });
};

test('the row is data: one { hp, damage } per tier, validated by name', () => {
  for (const tier of [1, 2, 3]) {
    assert.ok(B[tier].hp > 0 && B[tier].damage > 0, `tier ${tier}`);
  }
  const bad = { ...contentBundle, balance: { ...contentBundle.balance, bossTiers: { ...contentBundle.balance.bossTiers, 2: { hp: 0, damage: 1 } } } };
  assert.match(validateContent(bad).errors.map((e) => `${e.path} ${e.msg}`).join('\n'), /balance\.bossTiers\.2\.hp/);
  const missing = { ...contentBundle, balance: { ...contentBundle.balance, bossTiers: { 1: { hp: 1, damage: 1 } } } };
  assert.match(validateContent(missing).errors.map((e) => e.path).join('\n'), /balance\.bossTiers\.3/);
});

test('only boss-pool fights scale; every other pool keeps the seat ratio alone', () => {
  for (const e of REG.encounters.all().filter((x) => x.pool !== 'boss')) {
    assert.equal(bossTierScale(REG, { encounter: e, tier: 2 }), null, e.id);
  }
});

test('a boss met at tier 1 vs tier 3 takes that tier’s multipliers over its own seat ratio', () => {
  // The Stitched King is authored at the Marches' baseline (tier 2).
  const king = enc('a2_bossStitchedKing');
  const at1 = bossTierScale(REG, { encounter: king, tier: 1 });
  const at3 = bossTierScale(REG, { encounter: king, tier: 3 });
  close(at1.hp, (T[1] / T[2]) * B[1].hp, 'king HP at tier 1');
  close(at1.damage, (T[1] / T[2]) * B[1].damage, 'king damage at tier 1');
  close(at3.hp, (T[3] / T[2]) * B[3].hp, 'king HP at tier 3');
  close(at3.damage, (T[3] / T[2]) * B[3].damage, 'king damage at tier 3');
  // A Weald boss at its own baseline takes only the tier-1 row.
  const omen = bossTierScale(REG, { encounter: enc('bossOmen'), tier: 1 });
  assert.deepEqual(omen, { hp: B[1].hp, damage: B[1].damage });
  // Endless act 4 is tier 1 again.
  assert.deepEqual(bossTierScale(REG, { encounter: king, tier: 4 }), at1);
  // The causeway's null-seat boss is authored at the final tier, whichever
  // seat holds it: at tier 3 its ratio is 1.
  assert.deepEqual(bossTierScale(REG, { encounter: enc('a3_bossRotValkyrie'), tier: 3 }), { hp: B[3].hp, damage: B[3].damage });
});

test('the engine rolls the scaled HP and hits for the scaled damage; intent, preview and move card agree', () => {
  const king = enc('a2_bossStitchedKing');
  const def = REG.enemies.get(king.enemies[0]);
  for (const tier of [1, 3]) {
    const scale = bossTierScale(REG, { encounter: king, tier });
    const c = fightWith(king, tier);
    const boss = c.enemies[0];
    const rolled = createRng(7).int('enemyHP', def.hp[0], def.hp[1]);
    assert.equal(boss.maxHp, Math.max(1, Math.round(rolled * scale.hp)), `tier ${tier} HP`);
    assert.equal(boss.damageMult, scale.damage, `tier ${tier} damage stamp`);
    for (const [moveId, move] of Object.entries(def.moves)) {
      if (move.damage == null) continue;
      assert.equal(enemyMoveDamage(boss, move), Math.max(1, Math.round(move.damage * scale.damage)), `${moveId} at tier ${tier}`);
    }
    const cards = enemyMoveCards(def, { enemy: boss });
    const blow = cards.find((card) => card.moveId === 'scepterBlow' || card.id === 'scepterBlow');
    assert.ok(blow, 'the move set lists Scepter Blow');
    assert.match(JSON.stringify(blow), new RegExp(`\\b${enemyMoveDamage(boss, def.moves.scepterBlow)}\\b`), 'move card shows the scaled base');
  }
  // Tier 1 and tier 3 differ, and a live hit lands for the scaled number.
  const low = fightWith(king, 1), high = fightWith(king, 3);
  assert.ok(high.enemies[0].maxHp > low.enemies[0].maxHp);
  assert.ok(high.enemies[0].damageMult > low.enemies[0].damageMult);
  let compared = 0;
  for (const c of [low, high]) {
    let guard = 0;
    while (!c.result && guard++ < 6) {
      const intent = c.enemies[0].intent;
      const preview = previewIntent(c, c.enemies[0].id);
      if (intent.damage != null) {
        const move = def.moves[intent.moveId];
        assert.equal(intent.damage, enemyMoveDamage(c.enemies[0], move), 'intent carries the scaled damage');
        assert.ok(preview.damage >= 0);
      }
      const before = c.eventLog.length;
      dispatch(c, { type: 'endTurn' });
      const hits = c.eventLog.slice(before).filter((e) => e.type === 'damageDealt' && e.targetId === 'player');
      if (hits.length && intent.damage != null && !intent.delayed) {
        // No player block (the deck is one Strike, never played) and no
        // player statuses: the hit is the intent's number plus the boss's
        // own Strength, exactly what previewIntent reported.
        assert.equal(hits[0].amount, preview.damage, 'the hit lands for the previewed scaled damage');
        compared++;
      }
    }
  }
  assert.ok(compared >= 2, `live hits were compared (${compared})`);
});

test('an unscaled enemy carries no stamp, so older fights and snapshots keep their shape', () => {
  const c = createCombat({ registries: REG, rng: createRng(3), player: structuredClone(PLAYER), enemyIds: enc('bossOmen').enemies });
  assert.equal('damageMult' in c.enemies[0], false);
});

test('concealing a tier-scaled boss keeps its real damage while withholding exact preview', () => {
  const hidden = intentRegistry(0.95);
  const king = hidden.encounters.get('a2_bossStitchedKing');
  const c = fightWith(king, 3, 7, hidden);
  const boss = c.enemies[0];
  for (let turn = 0; turn < 10 && (boss.intent.damage == null || boss.intentRevealed); turn++) dispatch(c, { type: 'endTurn' });
  const move = hidden.enemies.get(boss.enemyId).moves[boss.intent.moveId];
  assert.ok(move.damage > 0, 'the hidden variant checks a real damaging move');
  assert.equal(boss.intentRevealed, false);
  const preview = previewIntent(c, boss.id);
  assert.equal(preview.hidden, true);
  assert.equal(preview.moveId, null);
  assert.equal(preview.damage, undefined);
  assert.ok(preview.stance, 'a concealed boss still announces its stance');
  assert.equal(boss.damageMult, bossTierScale(hidden, { encounter: king, tier: 3 }).damage);
  assert.equal(boss.intent.damage, enemyMoveDamage(boss, move));
  assert.equal(contentBundle.balance.combatIntent.baseHiddenChance, 0.70, 'fixtures do not mutate shared balance');
});

test('a randomized seat order scales each boss by the tier it is met at', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const order = drawSeatOrder(REG, createRng(seed));
    seen.add(order.join('>'));
    for (let tier = 1; tier <= 3; tier++) {
      const seat = seatAtTier(order, tier);
      const own = REG.encounters.all().find((e) => e.pool === 'boss' && e.seat === seat);
      const scale = bossTierScale(REG, { encounter: own, tier });
      const ratio = seatTierHpMult(REG, seat, tier);
      close(scale.hp, ratio * B[tier].hp, `seed ${seed} ${seat}@${tier} hp`);
      close(scale.damage, ratio * B[tier].damage, `seed ${seed} ${seat}@${tier} damage`);
    }
  }
  assert.ok(seen.size >= 4, `the draw covers several orders (${seen.size})`);
});

test('co-op: the scene projects a boss’s damageMult, so a client’s move cards show the scaled damage', async () => {
  const { createSession } = await import('../tools/session.mjs');
  // This historical boss-damage fixture starts after character setup.
  const host = createSession({ registries: createRegistries(legacyContentBundle), seedString: 'BOSSTIER' });
  host.addMember({ id: 'p1', name: 'p1', classId: 'reaver' });
  host.start();
  const graph = host.session.mapGraph;
  const bossId = (graph.bossIds || [graph.bossId])[0];
  host.session.reachableIds = [bossId];
  assert.equal(host.chooseNode('p1', bossId).ok, true);
  const snap = host.snapshot();
  assert.equal(snap.scene.kind, 'combat');
  const [projected] = snap.scene.enemies;
  const encounter = REG.encounters.get(graph.nodes[bossId].encounterId);
  const scale = bossTierScale(REG, { encounter, tier: host.contentAct() });
  assert.ok(scale.damage !== 1, `this seed meets a scaled boss (${projected.enemyId} at tier ${host.contentAct()})`);
  assert.equal(projected.damageMult, scale.damage, 'the projection carries the stamp');
  const def = REG.enemies.get(projected.enemyId);
  const cards = enemyMoveCards(def, { enemy: projected, registries: REG });
  let checked = 0;
  for (const [moveId, move] of Object.entries(def.moves)) {
    if (move.damage == null) continue;
    const card = cards.find((c) => c.moveId === moveId || c.id === moveId);
    assert.ok(card, moveId);
    assert.match(JSON.stringify(card), new RegExp(`\\b${enemyMoveDamage(projected, move)}\\b`), `${moveId}: the client card shows the scaled base`);
    assert.notEqual(enemyMoveDamage(projected, move), move.damage, `${moveId}: scaled differs from authored`);
    checked++;
  }
  assert.ok(checked >= 2);
});

test('the solo inspector reads skills and Previous actions through the scaled move damage', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(src, /function moveDetail\(move, preview = null, entity = null\)/);
  assert.match(src, /damage: enemyMoveDamage\(entity, move\)/, 'a roster move is scaled by the enemy it belongs to');
  assert.match(src, /history: past\.map\(\(moveId\) => \(\{ name: words\(moveId\), detail: moveDetail\(def\.moves\?\.\[moveId\], null, entity\) \}\)\)/, 'Previous actions pass the enemy');
  assert.match(src, /detail: moveDetail\(move, moveId === currentMoveId \? intent : null, entity\)/, 'the skill list passes the enemy');
});
