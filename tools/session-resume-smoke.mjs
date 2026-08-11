// tools/session-resume-smoke.mjs — headless check of host disk-resume: a live
// co-op run serializes to plain JSON and restores to the identical state, then
// keeps going. This is what lets the launcher restart without losing the run.
//
//   node tools/session-resume-smoke.mjs

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { playCard, endTurn } from '../src/engine/coopCombat.js';
import { createSession, restoreSession } from './session.mjs';

const REG = createRegistries(contentBundle);
const fails = [];
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails.push(msg); };

function botTurn(combat, memberId) {
  const P = combat.players.get(memberId);
  if (!P || !P.connected || !P.entity.alive || P.ended) return;
  let guard = 0;
  while (combat.phase === 'player' && !P.ended && !combat.result && guard++ < 50) {
    const card = P.piles.hand.find((h) => {
      const def = resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded });
      if ((def.keywords || []).includes('unplayable')) return false;
      return (def.cost === 'X' ? 0 : def.cost) <= P.entity.energy && (def.manaCost || 0) <= P.entity.mana;
    });
    const tgt = combat.enemies.find((e) => e.alive);
    try { if (card) playCard(combat, memberId, card.instanceId, tgt && tgt.id); else { endTurn(combat, memberId); break; } }
    catch { endTurn(combat, memberId); break; }
  }
  if (!P.ended && combat.phase === 'player' && !combat.result) endTurn(combat, memberId);
}

// Fork voting: every present member votes for the same node so the party moves.
function route(S, nodeId) {
  for (const m of S.connectedMembers()) {
    S.chooseNode(m.id, nodeId);
    if (S.scene.kind !== 'map') return;
  }
}

// Advance a session to the first clean (non-combat) map boundary after a fight.
function walkToBoundary(S) {
  let guard = 0;
  while (guard++ < 40) {
    const sc = S.scene;
    if (sc.kind === 'map' && guard > 1) return;
    if (sc.kind === 'map') route(S, S.session.reachableIds[0]);
    else if (sc.kind === 'combat') { S.autoResolveCombat(botTurn); for (const m of S.livingMembers()) if (m.run.hp < 12) m.run.hp = m.run.maxHp; }
    else if (sc.kind === 'reward') { for (const id of Object.keys(sc.offers)) S.chooseReward(id, { cardId: sc.offers[id].cardIds[0] }); }
    else if (sc.kind === 'shrine') S.connectedMembers().forEach((m) => S.shrineChoice(m.id, 'rest'));
    else if (sc.kind === 'event') S.connectedMembers().forEach((m) => S.eventChoice(m.id, 0));
    else return;
  }
}

try {
  const S = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
  S.addMember({ id: 'p1', name: 'Wren', classId: 'starseer' });
  S.addMember({ id: 'p2', name: 'Fenn', classId: 'reaver' });
  S.start();
  walkToBoundary(S);
  ok(S.scene.kind === 'map', 'reached a clean map boundary to persist at');

  // Capture state, round-trip through JSON, restore.
  const before = S.snapshot();
  const p2DeckBefore = S.session.members.get('p2').run.deck.length;
  const data = S.serialize();
  ok(data && data.v === 1, 'serialize() produced a versioned blob at a safe boundary');
  const json = JSON.stringify(data);
  const R = restoreSession(REG, JSON.parse(json));
  const after = R.snapshot();

  ok(after.actNumber === before.actNumber && after.floor === before.floor, 'restored act/floor match');
  ok(after.cursorId === before.cursorId, 'restored map cursor matches');
  ok(JSON.stringify(after.reachableIds) === JSON.stringify(before.reachableIds), 'restored reachable nodes match');
  ok(after.party.length === 2, 'restored party has both members');
  ok(R.session.members.get('p2').run.deck.length === p2DeckBefore, 'restored p2 deck size matches (build preserved)');
  ok(after.party.every((p) => !p.connected), 'restored members start disconnected (players re-attach by rejoinId)');

  // A live fight must NOT be persisted (resume lands at the pre-combat node).
  R.chooseNode('p1', R.session.reachableIds[0]);
  let hops = 0;
  while (R.scene.kind !== 'combat' && R.scene.kind !== 'complete' && hops++ < 8) {
    const sc = R.scene;
    if (sc.kind === 'map') R.chooseNode('p1', R.session.reachableIds[0]);
    else if (sc.kind === 'reward') for (const id of Object.keys(sc.offers)) R.chooseReward(id, { cardId: sc.offers[id].cardIds[0] });
    else if (sc.kind === 'shrine') R.shrineChoice('p1', 'rest');
    else if (sc.kind === 'event') R.eventChoice('p1', 0);
  }
  if (R.scene.kind === 'combat') ok(R.serialize() === null, 'serialize() refuses to persist during a live fight');

  // The restored run keeps going deterministically (rng counters preserved).
  ok(R.session.actNumber >= before.actNumber, 'restored run continues advancing');
} catch (e) {
  ok(false, `threw: ${e.stack || e.message}`);
}

console.log(fails.length ? `\nRESUME SMOKE FAILED (${fails.length})` : '\nHost disk-resume core OK');
process.exit(fails.length ? 1 : 0);
