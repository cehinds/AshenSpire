// The "?" rule for an actor's remaining actions (owner, 2026-10-18): after an actor has acted this turn and still
// has SP for more actions, an observer who failed the Perception check on its intent sees each as "?"; one who
// passed sees them normally. No re-roll, and a failed read never lets a move reach the DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch, previewIntent } from '../src/engine/combat.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { advanceFollowUps, createFollowMemo, followUpPlan } from '../src/ui/models/IntentFollowUpModel.js';
import { stanceFor, moveKind } from '../src/engine/combatRounds/stance.js';
import { iconForStance } from '../src/ui/models/CombatRoundsScreenModel.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { combatantIntent } from '../src/ui/components/combatantOverhead.js';

const POOL_STATS = { strength: 6, dexterity: 4, constitution: 4, wisdom: 2, intelligence: 2 };
const soldier = (patch = {}) => createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map((e) => (e.id === 'wanderingSoldier' ? { ...e, attributes: POOL_STATS, ...patch(e) } : e)) });
const registries = soldier(() => ({}));
const READ = true, MISS = false;

// A fresh fight against the pooled soldier (plan: slash, guard) on a seed whose follow-ups roll the wanted reads, in
// play order. The engine rolls them (presentIntent); the search only finds a seed, and the UI only reads the trace.
function fightOn(seed, regs, setup) {
  const run = createRunState({ seed, classId: 'reaver', registries: regs, profileMeta: { settings: {} } });
  const c = createRunCombat({ registries: regs, rng: createRng(seed), run, enemyIds: ['wanderingSoldier'], settings: {} });
  delete c.enemyKnowledge; // the plain per-move visibility roll (the Core 2 knowledge route is covered below)
  setup?.(c, c.enemies[0]);
  return c;
}
const iconOf = (regs, moveId) => { const m = regs.enemies.get('wanderingSoldier').moves[moveId]; return iconForStance(stanceFor(moveKind(m), m.tags || [])); };
// Two planned follow-ups whose icons differ from each other, so an unread one's icon cannot be mistaken for a read one's.
const distinct = (regs) => (c) => { const [a, b] = c.enemies[0].plannedMoves; return a && b && iconOf(regs, a.moveId) !== iconOf(regs, b.moveId); };
function fight({ regs = registries, reads = [], setup, plan = distinct(regs) } = {}) {
  for (let seed = 1; seed < 900; seed++) {
    const probe = fightOn(seed, regs, setup);
    if (!plan(probe)) continue;
    dispatch(probe, { type: 'endTurn' });
    while (probe.pendingReaction) dispatch(probe, { type: 'chooseReaction', offerId: probe.pendingReaction.id, optionId: null });
    const got = (probe.enemies[0].followTrace || []).map((t) => t.read);
    if (reads.every((want, i) => got[i] === want)) return fightOn(seed, regs, setup);
  }
  throw new Error('no seed rolls the wanted reads');
}
// Plays the enemy phase and returns, per action event of the enemy, the follow-up row the player's screen shows.
function rowsAfterPhase(c, regs = registries) {
  const e = c.enemies[0], plan = followUpPlan({ queue: e.plannedMoves, def: regs.enemies.get(e.enemyId) });
  dispatch(c, { type: 'endTurn' });
  while (c.pendingReaction) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
  const acts = c.eventLog.filter((ev) => (ev.type === 'enemyMoveStarted' && !ev.reaction) || ev.type === 'enemyMoveUnavailable');
  return acts.map(() => {
    const followUps = advanceFollowUps(plan, e.followTrace);
    let html = '', symbols = followUps;
    withKitDom(() => {
      const node = combatantIntent({ kind: 'attack', moveId: 'warcry', damage: 5, hits: 1, profile: {}, stance: 'attacking', revealed: true, hidden: false, followUps });
      html = node.querySelector('.intent-followups')?.outerHTML ?? '';
      html += `|aria:${node.getAttribute('aria-label')}`;
    });
    return { symbols, html };
  });
}
const kinds = (row) => row.symbols.map((s) => (s.kind === 'unknown' ? '?' : s.icon));

const two = (regs) => (c) => c.enemies[0].plannedMoves.length === 2 && distinct(regs)(c);
const planIcons = (c, regs = registries) => c.enemies[0].plannedMoves.map((m) => iconOf(regs, m.moveId));

test('first follow-up misses its own read, second passes: "?" then the real icon, and the unread kind reaches no DOM', () => {
  const c = fight({ reads: [MISS, READ], plan: two(registries) });
  const [unread, read] = planIcons(c);
  const rows = rowsAfterPhase(c);
  assert.deepEqual(kinds(rows[0]), ['?', read]);
  const [html, aria] = rows[0].html.split('|aria:');
  assert.ok(!html.includes(`"${unread}"`) && !new RegExp(`data-[a-z-]+="${unread}"`).test(html), 'the unread move leaves no icon or data attribute in the row');
  assert.match(aria, /2 more actions unread\.$/, 'the aria label counts the row and names nothing');
  assert.deepEqual(kinds(rows[1]), [read], 'the row shrinks as the enemy acts');
  assert.deepEqual(rows[2].symbols, []);
  assert.ok(c.enemies[0].followTrace.every((t) => !('moveId' in t)), 'the engine trace holds no move id');
});

test('head hidden, first follow-up reads: that follow-up shows its real icon (its own read, not the head\'s)', () => {
  const c = fight({ reads: [READ, MISS], plan: two(registries), setup: (_, e) => { e.intentRevealed = false; } });
  const [read, unread] = planIcons(c);
  const rows = rowsAfterPhase(c);
  assert.deepEqual(kinds(rows[0]), [read, '?']);
  assert.ok(!rows[0].html.split('|aria')[0].includes(`"${unread}"`));
});

test('Read Intent reveals only the current move: failed follow-up reads stay "?"', () => {
  const c = fight({ reads: [MISS, MISS], plan: two(registries), setup: (_, e) => { e.proposalIntentRevealedUntilByOwner = { player: 99 }; } });
  assert.equal(previewIntent(c, c.enemies[0].id).hidden, false, 'the current intent is exact under Read Intent');
  const icons = planIcons(c);
  const rows = rowsAfterPhase(c);
  assert.deepEqual(kinds(rows[0]), ['?', '?']);
  for (const icon of icons) assert.ok(!rows[0].html.split('|aria')[0].includes(`"${icon}"`));
});

test('a follow-up that becomes a charge is not shown, and the row clears', () => {
  const regs = soldier((e) => ({ moves: { ...e.moves, guard: { ...e.moves.guard, delay: { turns: 2 } } } }));
  // Plan: a normal move, then the charging guard.
  const plan = (c) => { const [a, b] = c.enemies[0].plannedMoves; return c.enemies[0].plannedMoves.length === 2 && a.moveId !== 'guard' && b.moveId === 'guard'; };
  const c = fight({ regs, reads: [MISS, MISS], plan });
  const rows = rowsAfterPhase(c, regs);
  assert.deepEqual(kinds(rows[0]), ['?'], 'only the first follow-up can still play; the charge takes the enemy\'s turn');
  assert.deepEqual(rows[1].symbols, []);
  assert.equal(c.enemies[0].followTrace[1].outcome, 'charging');
});

test('a stagger that lands mid-turn ends the row', () => {
  // Every move entombs its owner: the head plays, then the entombed enemy plays none of its plan (SPEC §4.6a).
  const regs = soldier((e) => ({ moves: Object.fromEntries(Object.entries(e.moves).map(([id, m]) => [id,
    { ...m, effects: [...(m.effects || []), { op: 'applyStatus', target: 'self', status: 'entombed', stacks: 1 }] }])) }));
  const c = fight({ regs, reads: [], plan: (cc) => cc.enemies[0].plannedMoves.length === 2 });
  const rows = rowsAfterPhase(c, regs);
  assert.equal(rows.length, 1, 'only the head played');
  assert.deepEqual(rows[0].symbols, [], 'nothing can still play, so no "?" is left standing');
});

test('a move refused for SP is not shown', () => {
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const regs = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries: regs, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const c = createRunCombat({ registries: regs, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  assert.ok(c.enemies[0].plannedMoves.length >= 1);
  const rows = rowsAfterPhase(c, regs);
  assert.equal(c.enemies[0].followTrace[0].outcome, 'refused');
  assert.deepEqual(rows[0].symbols, [], 'the refused move cannot play, so it is not previewed');
  assert.equal(rows.at(-1).symbols.length, 0);
});

test('no follow-up trace before the enemy phase: nothing shows (pre-play stays with the multi-action toggle)', () => {
  const c = fight();
  assert.equal(c.enemies[0].followTrace, undefined);
  assert.deepEqual(advanceFollowUps(followUpPlan({ queue: c.enemies[0].plannedMoves, def: registries.enemies.get('wanderingSoldier') }), undefined), []);
  assert.deepEqual(advanceFollowUps(null, []), []);
});

test('the engine event stays count-free: the saved golden event log is unchanged', () => {
  const c = fight();
  const planned = c.enemies[0].plannedMoves.length;
  assert.ok(planned >= 1, 'the fixture soldier plans follow-ups');
  dispatch(c, { type: 'endTurn' });
  while (c.pendingReaction) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
  const acts = c.eventLog.filter((e) => (e.type === 'enemyMoveStarted' && !e.reaction) || e.type === 'enemyMoveUnavailable');
  assert.equal(acts.length, planned + 1);
  assert.ok(c.eventLog.filter((e) => e.type === 'enemyMoveStarted').every((e) => !('queued' in e) && !('read' in e)));
});

test('the row stays visible while a player reaction is pending, and the resumed turn keeps its plan', () => {
  // A reaction window opens after the head move: playback state is cleared, then the resume snapshots again.
  const c = fight({ reads: [MISS, READ], plan: two(registries) });
  const e = c.enemies[0], def = registries.enemies.get('wanderingSoldier'), [unread, read] = planIcons(c);
  const memo = createFollowMemo();
  const first = memo.plan(e.id, { resuming: false, build: () => followUpPlan({ queue: e.plannedMoves, def }) });
  dispatch(c, { type: 'endTurn' });
  while (c.pendingReaction) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
  const row = memo.setRow(e.id, advanceFollowUps(first, e.followTrace)); // the head's enemyMoveStarted beat
  assert.deepEqual(row.map((s) => (s.kind === 'unknown' ? '?' : s.icon)), ['?', read]);
  // The reaction modal opens: playback cleared (no disp), enemy phase live. The row is still there.
  assert.deepEqual(memo.row(e.id, true), row, 'the row survives the cleared playback record');
  assert.equal(memo.row(e.id, false), null, 'but only while the enemy phase is live');
  // The resumed dispatch snapshots again, with the queue half spent: the same plan comes back, not a rebuilt one.
  const resumed = memo.plan(e.id, { resuming: true, build: () => followUpPlan({ queue: [], def }) });
  assert.equal(resumed, first);
  assert.deepEqual(advanceFollowUps(resumed, e.followTrace).map((s) => (s.kind === 'unknown' ? '?' : s.icon)), [read], 'the next beat continues the row');
  // A fresh turn rebuilds and the row clears.
  memo.clear();
  assert.equal(memo.row(e.id, true), null);
  assert.notEqual(memo.plan(e.id, { resuming: false, build: () => followUpPlan({ queue: e.plannedMoves, def }) }), first);
  assert.ok(unread !== read);
});
