// tools/coop-combat-smoke.mjs — headless check of the shared N-player combat
// runner (S3). No browser: builds a 2-player fight vs real content, drives both
// players with the naive bot, and checks headcount scaling + live drop/rejoin
// rescale. Solo combat.js is not involved.
//
//   node tools/coop-combat-smoke.mjs

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import {
  createCoopCombat, coopHpMult, playCard, endTurn, useFlask, leaveCombat, joinCombat, coopOutcome,
} from '../src/engine/coopCombat.js';

const REG = createRegistries(contentBundle);
const fails = [];
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails.push(msg); };

function deckOf(classId) {
  const d = REG.classes.get(classId).startingDeck;
  return d.map((cardId, i) => ({ instanceId: `${classId[0]}${i}`, cardId, upgraded: false }));
}
function players() {
  return [
    { id: 'p1', name: 'Ranni', classId: 'astrologer', maxHp: 72, hp: 72, deck: deckOf('astrologer'), relicIds: [], flasks: [] },
    { id: 'p2', name: 'Blaidd', classId: 'vagabond', maxHp: 84, hp: 84, deck: deckOf('vagabond'), relicIds: [], flasks: [] },
  ];
}

// One living player's greedy turn: play leftmost affordable card, then end.
function botTurn(C, playerId) {
  const P = C.players.get(playerId);
  if (!P || !P.connected || !P.entity.alive || P.ended) return;
  let guard = 0;
  while (C.phase === 'player' && !P.ended && !C.result && guard++ < 50) {
    const hand = P.piles.hand;
    const card = hand.find((h) => {
      const def = resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded });
      if ((def.keywords || []).includes('unplayable')) return false;
      return (def.cost === 'X' ? 0 : def.cost) <= P.entity.energy;
    });
    const tgt = C.enemies.find((e) => e.alive);
    try {
      if (card) playCard(C, playerId, card.instanceId, tgt && tgt.id);
      else { endTurn(C, playerId); break; }
    } catch { endTurn(C, playerId); break; }
  }
  if (!P.ended && C.phase === 'player' && !C.result) endTurn(C, playerId);
}

try {
  // --- headcount scaling at fight start ---
  const enemyIds = ['rotHound', 'graveWisp'];
  const rngA = createRng(0x5eed);
  const baseHp = [];
  { // solo-scale reference: roll the same enemies with a 1p mult
    const r = createRng(0x5eed);
    for (const id of enemyIds) { const def = REG.enemies.get(id); baseHp.push(r.int('enemyHP', def.hp[0], def.hp[1])); }
  }
  const C = createCoopCombat({ registries: REG, rng: rngA, players: players(), enemyIds });
  ok(Math.abs(coopHpMult(2) - 1.6) < 1e-9, 'coopHpMult(2) = 1.6');
  ok(C.enemies[0].maxHp === Math.max(1, Math.round(baseHp[0] * 1.6)), '2-player enemy HP = base roll ×1.6');
  ok(C.players.size === 2 && C.phase === 'player', 'both players enter the shared player phase');
  ok(C.players.get('p1').piles.hand.length === 5 && C.players.get('p2').piles.hand.length === 5, 'each player drew their own 5-card hand');

  // --- run a full fight, both players bot-piloted ---
  let rounds = 0;
  while (!C.result && rounds++ < 60) {
    for (const id of ['p1', 'p2']) botTurn(C, id);
  }
  ok(!!C.result, `shared fight concluded without hanging (result=${C.result})`);
  const out = coopOutcome(C);
  ok(out.survivors.p1 && out.survivors.p2, 'coopOutcome reports both players\' ending HP');

  // --- live drop rescales enemies DOWN ---
  const C2 = createCoopCombat({ registries: REG, rng: createRng(0x1234), players: players(), enemyIds: ['demiBrute'] });
  const before = C2.enemies[0].maxHp;
  leaveCombat(C2, 'p2');
  ok(C2.enemies[0].maxHp < before, 'enemy max HP rescales DOWN when p2 drops mid-combat');
  ok(Math.abs(C2.enemies[0].maxHp - Math.round(before * (coopHpMult(1) / coopHpMult(2)))) <= 1, 'down-rescale matches the headcount ratio');
  ok(C2.players.get('p2').connected === false, 'p2 marked disconnected');

  // --- rejoin rescales UP; still one shared fight ---
  const afterDrop = C2.enemies[0].maxHp;
  joinCombat(C2, players()[1]);
  ok(C2.enemies[0].maxHp > afterDrop, 'enemy max HP rescales UP when p2 rejoins');
  ok(C2.players.get('p2').connected === true, 'p2 reconnected into the fight');

  // --- last player leaving suspends the fight (server holds it) ---
  const C3 = createCoopCombat({ registries: REG, rng: createRng(0x9), players: [players()[0]], enemyIds: ['rotHound'] });
  leaveCombat(C3, 'p1');
  ok(C3.phase === 'suspended', 'fight suspends when the last player drops');
  ok(coopOutcome(C3).result === 'suspended', 'suspended outcome surfaces for the session');

  // --- Stagger: a poise-filled (skipNextTurn) enemy loses its telegraphed move ---
  const C4 = createCoopCombat({ registries: REG, rng: createRng(0x5a), players: players(), enemyIds: ['wanderingSoldier'] });
  for (const e of C4.enemies) e.skipNextTurn = true; // simulate a full poise meter
  const hpBefore = [...C4.players.values()].map((P) => P.entity.hp);
  endTurn(C4, 'p1'); endTurn(C4, 'p2'); // → enemy phase
  const hpAfter = [...C4.players.values()].map((P) => P.entity.hp);
  ok(hpBefore.every((h, i) => h === hpAfter[i]), 'staggered enemy deals no damage (move skipped)');
  ok(C4.enemies.every((e) => !e.skipNextTurn), 'skipNextTurn is consumed by the enemy turn');

  // --- Throw-to-ally: a self-heal flask lands on a wounded teammate ---
  const throwers = players();
  throwers[0].flasks = [{ flaskId: 'crimsonFlask' }]; // p1 carries a heal flask
  throwers[1].hp = 30; // p2 is hurt
  const C5 = createCoopCombat({ registries: REG, rng: createRng(0x7c), players: throwers, enemyIds: ['rotHound'] });
  const p2 = C5.players.get('p2').entity;
  const p2Before = p2.hp;
  useFlask(C5, 'p1', 0, 'p2'); // p1 throws the Crimson Flask to p2
  ok(p2.hp > p2Before, 'thrown heal flask heals the targeted ally, not the thrower');
  ok(C5.players.get('p1').entity.flasks.length === 0, 'the thrower spends the flask');
} catch (e) {
  ok(false, `threw: ${e.stack || e.message}`);
}

console.log(fails.length ? `\nCOOP COMBAT SMOKE FAILED (${fails.length})` : '\nShared combat runner (S3) OK');
process.exit(fails.length ? 1 : 0);
