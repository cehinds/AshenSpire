// tools/session-smoke.mjs — headless check of the authoritative co-op session
// (S2 loop + S3 live combat). No browser, no network: drives the session object
// directly through map → shared combat → rewards, then exercises drop-out
// rescale + catch-up accrual + reconnect replay.
//
//   node tools/session-smoke.mjs

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { playCard, endTurn } from '../src/engine/coopCombat.js';
import { createSession, coopHpMult } from './session.mjs';
import { COOP_CARD_IDS } from '../src/content/cards/coop.js';

const REG = createRegistries(contentBundle);
const fails = [];
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails.push(msg); };

// One member's greedy turn inside a live coopCombat (leftmost affordable → end).
function botTurn(combat, memberId) {
  const P = combat.players.get(memberId);
  if (!P || !P.connected || !P.entity.alive || P.ended) return;
  let guard = 0;
  while (combat.phase === 'player' && !P.ended && !combat.result && guard++ < 50) {
    const card = P.piles.hand.find((h) => {
      const def = resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded });
      if ((def.keywords || []).includes('unplayable')) return false;
      return (def.cost === 'X' ? 0 : def.cost) <= P.entity.energy;
    });
    const tgt = combat.enemies.find((e) => e.alive);
    try {
      if (card) playCard(combat, memberId, card.instanceId, tgt && tgt.id);
      else { endTurn(combat, memberId); break; }
    } catch { endTurn(combat, memberId); break; }
  }
  if (!P.ended && combat.phase === 'player' && !combat.result) endTurn(combat, memberId);
}

// Fork voting: every present member votes for the same node so the party moves.
function route(S, nodeId) {
  for (const m of S.connectedMembers()) {
    S.chooseNode(m.id, nodeId);
    if (S.scene.kind !== 'map') return; // vote resolved (or solo routed)
  }
}

// Walk the party forward, auto-resolving each non-combat scene and each live
// fight, until they reach `stopKind` or a fixed step budget runs out.
function walk(S, { steps = 12, healBetween = true } = {}) {
  let guard = 0;
  while (guard++ < steps * 6) {
    const sc = S.scene;
    if (sc.kind === 'complete') return sc;
    if (sc.kind === 'map') route(S, S.session.reachableIds[0]);
    else if (sc.kind === 'combat') {
      S.autoResolveCombat(botTurn);
      if (healBetween) for (const m of S.livingMembers()) if (m.run.hp < 6) m.run.hp = m.run.maxHp; // keep the bot alive to keep walking
    } else if (sc.kind === 'reward') {
      for (const id of Object.keys(sc.offers)) S.chooseReward(id, { cardId: sc.offers[id].cardIds[0], takeRelic: true, flask: true });
    } else if (sc.kind === 'shrine') { for (const m of S.connectedMembers()) S.shrineChoice(m.id, 'rest'); }
    else if (sc.kind === 'event') { for (const m of S.connectedMembers()) S.eventChoice(m.id, 0); }
    else return sc;
    if (guard > 3 && S.scene.kind === 'map') return S.scene; // reached a fresh map after progress
  }
  return S.scene;
}

try {
  ok(coopHpMult(1) === 1 && Math.abs(coopHpMult(2) - 1.6) < 1e-9, 'coop HP scaling wired: 1p×1.0, 2p×1.6');

  const S = createSession({ registries: REG, seedString: 'GOLDBOUGH' });
  S.addMember({ id: 'p1', name: 'Wren', classId: 'starseer' });
  S.addMember({ id: 'p2', name: 'Fenn', classId: 'reaver' });
  S.start();
  ok(S.scene.kind === 'map', 'start → shared map scene');
  ok(S.snapshot().party.length === 2, 'snapshot shows a 2-member party');

  // --- fork voting: one vote holds the party; a tie breaks toward the host ---
  const opts = S.session.reachableIds;
  const r1 = S.chooseNode('p1', opts[0]);
  ok(S.scene.kind === 'map' && r1.waiting === 1, 'a lone vote holds the party on the map (1 still to vote)');
  ok(S.scene.votes && S.scene.votes.p1 === opts[0], 'the vote is recorded on the scene for all clients');
  if (opts.length > 1) {
    S.chooseNode('p2', opts[1]); // 1-1 tie → the host's (earliest-joined) pick wins
    ok(S.scene.kind !== 'map' || S.session.cursorId === opts[0], 'tie breaks toward the host pick and the party travels');
    ok(S.session.cursorId === opts[0], 'party traveled to the host-voted node');
  } else {
    S.chooseNode('p2', opts[0]);
    ok(S.session.cursorId === opts[0], 'both votes in → the party travels');
  }
  // rewind to a clean map for the rest of the walk (whatever the node opened)
  {
    let unlock = 0;
    while (S.scene.kind !== 'map' && S.scene.kind !== 'complete' && unlock++ < 10) {
      const sc = S.scene;
      if (sc.kind === 'combat') S.autoResolveCombat(botTurn);
      else if (sc.kind === 'reward') for (const id of Object.keys(sc.offers)) S.chooseReward(id, { cardId: sc.offers[id].cardIds[0] });
      else if (sc.kind === 'shrine') for (const m of S.connectedMembers()) S.shrineChoice(m.id, 'rest');
      else if (sc.kind === 'event') for (const m of S.connectedMembers()) S.eventChoice(m.id, 0);
      else break;
    }
    for (const m of S.livingMembers()) if (m.run.hp < 12) m.run.hp = m.run.maxHp;
  }

  // First node → live shared combat, both members in one fight.
  route(S, S.session.reachableIds[0]);
  // (first node may be an event/shrine; push until a combat opens)
  let steps = 0;
  while (S.scene.kind !== 'combat' && S.scene.kind !== 'complete' && steps++ < 8) {
    const sc = S.scene;
    if (sc.kind === 'map') route(S, S.session.reachableIds[0]);
    else if (sc.kind === 'reward') for (const id of Object.keys(sc.offers)) S.chooseReward(id, { cardId: sc.offers[id].cardIds[0] });
    else if (sc.kind === 'shrine') for (const m of S.connectedMembers()) S.shrineChoice(m.id, 'rest');
    else if (sc.kind === 'event') for (const m of S.connectedMembers()) S.eventChoice(m.id, 0);
  }
  ok(S.scene.kind === 'combat', 'party reaches a live shared combat');
  ok(S.scene.players.length === 2 && S.scene.enemies.length >= 1, 'combat scene exposes both players + shared enemies');
  const twoPMult = coopHpMult(2);
  ok(S.live && Math.abs(S.live.combat.baseHpMult - twoPMult) < 1e-9, 'enemies scaled to the 2-player headcount');

  const p2DeckBefore = S.session.members.get('p2').run.deck.length;
  S.autoResolveCombat(botTurn);
  ok(S.scene.kind === 'reward' || S.scene.kind === 'complete', 'shared combat settles into rewards (or run end)');
  if (S.scene.kind === 'reward') {
    ok(!!S.scene.offers.p1 && !!S.scene.offers.p2, 'both present members get their own reward offer');
    ok(COOP_CARD_IDS.includes(S.scene.offers.p1.cardIds[S.scene.offers.p1.cardIds.length - 1]), 'party rewards carry a co-op-only card option');
    for (const id of Object.keys(S.scene.offers)) S.chooseReward(id, { cardId: S.scene.offers[id].cardIds[0] });
    ok(S.session.members.get('p2').run.deck.length === p2DeckBefore + 1, 'p2 deck grew by the chosen card');
  }

  // --- drop-out: p2 disconnects; the party fights on rescaled to solo ---
  S.setConnected('p2', false);
  ok(S.connectedMembers().length === 1, 'headcount drops to 1 when p2 disconnects');
  let g = 0;
  while (S.scene.kind !== 'combat' && S.scene.kind !== 'complete' && g++ < 10) {
    const sc = S.scene;
    if (sc.kind === 'map') route(S, S.session.reachableIds[0]);
    else if (sc.kind === 'reward') { for (const id of Object.keys(sc.offers)) S.chooseReward(id, { cardId: sc.offers[id].cardIds[0] }); }
    else if (sc.kind === 'shrine') S.shrineChoice('p1', 'rest');
    else if (sc.kind === 'event') S.eventChoice('p1', 0);
    for (const m of S.livingMembers()) if (m.run.hp < 10) m.run.hp = m.run.maxHp;
  }
  ok(S.scene.kind === 'combat', 'the solo remaining member reaches the next fight');
  ok(S.live && Math.abs(S.live.combat.baseHpMult - coopHpMult(1)) < 1e-9, 'enemies rescale DOWN to solo when p2 is away');
  const p2CatchBefore = S.session.members.get('p2').catchup.length;
  S.autoResolveCombat(botTurn);
  if (S.scene.kind === 'reward') { ok(!S.scene.offers.p2, 'absent p2 gets no live reward offer'); for (const id of Object.keys(S.scene.offers)) S.chooseReward(id, { cardId: S.scene.offers[id].cardIds[0] }); }
  const p2 = S.session.members.get('p2');
  ok(p2.catchup.length === p2CatchBefore + 1, 'p2 accrued a queued catch-up reward while away');

  // --- reconnect: p2 replays the missed choice as a series ---
  S.setConnected('p2', true);
  const deckBefore = p2.run.deck.length;
  const queued = p2.catchup[0];
  ok(queued.type === 'reward' && queued.offer.cardIds.length > 0, 'queued item is a reward with rolled options');
  const res = S.resolveCatchup('p2', 0, { cardId: queued.offer.cardIds[0], takeRelic: true, flask: true });
  ok(res.ok && p2.run.deck.length === deckBefore + 1, 'catch-up replay adds the chosen missed card');
  ok(p2.catchup.length === 0, 'catch-up queue drains after replay');

  // --- Mend at a shrine: a player heals a wounded ally 30% instead of resting ---
  S.session.scene = { kind: 'shrine', done: {} };
  const p1m = S.session.members.get('p1');
  p1m.run.hp = 20;
  const mendBefore = p1m.run.hp;
  S.shrineChoice('p2', 'mend', 'p1'); // p2 mends p1
  ok(p1m.run.hp === Math.min(p1m.run.maxHp, mendBefore + Math.ceil(p1m.run.maxHp * 0.3)), 'Mend heals the targeted ally for 30% of their max HP');
} catch (e) {
  ok(false, `threw: ${e.stack || e.message}`);
}

console.log(fails.length ? `\nSESSION SMOKE FAILED (${fails.length})` : '\nSession + live combat (S2+S3) OK');
process.exit(fails.length ? 1 : 0);
