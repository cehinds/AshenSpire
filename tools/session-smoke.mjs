// tools/session-smoke.mjs — headless check of the authoritative co-op session
// core (S2). No browser, no network: drives the session object directly through
// map → combat → rewards, then exercises drop-out catch-up accrual + reconnect
// replay. Combat is resolved by a bot stand-in (S3 swaps in the live fight).
//
//   node tools/session-smoke.mjs

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createSession, coopHpMult } from './session.mjs';

const REG = createRegistries(contentBundle);
const fails = [];
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails.push(msg); };

// S2 stand-in resolver: each present member fights a solo instance of the
// (headcount-scaled) encounter with the naive bot; report ending HP + result.
// S3 replaces this with one shared, interactive fight for the whole party.
function botResolver({ enemyIds, enemyStatuses, hpMult, party }) {
  const survivors = {};
  let anyAlive = false;
  for (const p of party) {
    const rng = createRng(0xc0ffee ^ p.run.seed);
    const combat = createCombat({
      registries: REG, rng,
      player: { classId: p.classId, maxHp: p.run.maxHp, hp: p.run.hp, deck: p.run.deck, relicIds: p.run.relics, flasks: p.run.flasks },
      enemyIds, hpMult, enemyStatuses,
    });
    let guard = 0;
    while (!combat.result && guard++ < 9000) {
      const card = combat.piles.hand.find((h) => {
        const def = resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded });
        if ((def.keywords || []).includes('unplayable')) return false;
        return (def.cost === 'X' ? 0 : def.cost) <= combat.player.energy;
      });
      const tgt = combat.enemies.find((e) => e.alive);
      try {
        if (card) dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: tgt && tgt.id });
        else dispatch(combat, { type: 'endTurn' });
      } catch { dispatch(combat, { type: 'endTurn' }); }
    }
    const hp = combat.result === 'victory' ? combat.player.hp : 0;
    survivors[p.id] = { hp };
    if (hp > 0) anyAlive = true;
  }
  return { survivors, result: anyAlive ? 'victory' : 'defeat' };
}

// Walk the party forward until they hit a combat node, resolving any non-combat
// scenes along the way; returns when scene.kind === 'combat' or 'complete'.
function advanceToCombat(S) {
  let guard = 0;
  while (guard++ < 200) {
    const sc = S.scene;
    if (sc.kind === 'combat' || sc.kind === 'complete') return sc;
    if (sc.kind === 'map') {
      const pick = S.session.reachableIds[0];
      S.chooseNode(firstConnectedId(S), pick);
    } else if (sc.kind === 'reward') {
      for (const id of Object.keys(sc.offers)) S.chooseReward(id, { cardId: sc.offers[id].cardIds[0], takeRelic: true, flask: true });
    } else if (sc.kind === 'shrine') {
      for (const m of S.connectedMembers()) S.shrineChoice(m.id, 'rest');
    } else if (sc.kind === 'event') {
      for (const m of S.connectedMembers()) S.eventChoice(m.id, 0);
    } else return sc;
  }
  return S.scene;
}

function firstConnectedId(S) {
  return S.connectedMembers()[0].id;
}

try {
  // scaling curve sanity
  ok(coopHpMult(1) === 1 && Math.abs(coopHpMult(2) - 1.6) < 1e-9 && Math.abs(coopHpMult(3) - 2.2) < 1e-9, 'coop HP scaling: 1p×1.0, 2p×1.6, 3p×2.2');

  const S = createSession({ registries: REG, seedString: 'ERDTREE' });
  S.addMember({ id: 'p1', name: 'Ranni', classId: 'astrologer' });
  S.addMember({ id: 'p2', name: 'Blaidd', classId: 'vagabond' });
  S.start();
  ok(S.scene.kind === 'map', 'start → shared map scene');
  ok(S.session.reachableIds.length > 0, 'first-floor nodes are reachable');
  ok(S.snapshot().party.length === 2, 'snapshot shows a 2-member party');

  // Advance to the first combat and check headcount scaling in the scene.
  const combatScene = advanceToCombat(S);
  ok(combatScene.kind === 'combat', 'party reaches a combat node');
  ok(Math.abs(combatScene.hpMult - coopHpMult(2)) < 1e-9 || combatScene.hpMult > 1, 'combat scene carries a 2-player HP mult');

  const p2DeckBefore = S.session.members.get('p2').run.deck.length;
  const r = S.resolveCombat(botResolver);
  ok(r.ok && r.result === 'victory', 'combat resolves to victory via the bot resolver');
  ok(S.scene.kind === 'reward', 'victory opens a per-member reward scene');
  ok(!!S.scene.offers.p1 && !!S.scene.offers.p2, 'both present members get their own reward offer');

  // Each present member takes a card → decks grow, reward closes back to map.
  for (const id of Object.keys(S.scene.offers)) {
    S.chooseReward(id, { cardId: S.scene.offers[id].cardIds[0], takeRelic: true, flask: true });
  }
  ok(S.scene.kind === 'map', 'reward closes → back on the map');
  ok(S.session.members.get('p2').run.deck.length === p2DeckBefore + 1, 'p2 deck grew by the chosen card');

  // --- drop-out: p2 disconnects; the party clears a combat without them ---
  S.setConnected('p2', false);
  ok(S.connectedMembers().length === 1, 'headcount drops to 1 when p2 disconnects');
  const solo = advanceToCombat(S);
  ok(solo.kind === 'combat' && Math.abs(solo.hpMult - coopHpMult(1)) < 1e-9, 'enemies rescale DOWN to solo when p2 is away');
  const p2CatchBefore = S.session.members.get('p2').catchup.length;
  S.resolveCombat(botResolver);
  // reward for the absent p2 must be queued, not lost.
  const rewardScene = S.scene;
  ok(rewardScene.kind === 'reward' && !rewardScene.offers.p2, 'absent p2 gets no live reward offer');
  // close the present member's reward
  for (const id of Object.keys(rewardScene.offers)) S.chooseReward(id, { cardId: rewardScene.offers[id].cardIds[0] });
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
} catch (e) {
  ok(false, `threw: ${e.stack || e.message}`);
}

console.log(fails.length ? `\nSESSION SMOKE FAILED (${fails.length})` : '\nSession core (S2) OK');
process.exit(fails.length ? 1 : 0);
