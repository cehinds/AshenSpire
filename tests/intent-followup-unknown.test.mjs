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
    const got = (probe.followTrace?.[probe.enemies[0].id] || []).map((t) => t.read);
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
    const followUps = advanceFollowUps(plan, c.followTrace?.[e.id]);
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
  assert.ok(aria.endsWith(`2 more actions: unknown, ${read}.`), 'the aria label names only the read kinds, the rest unknown');
  assert.deepEqual(kinds(rows[1]), [read], 'the row shrinks as the enemy acts');
  assert.deepEqual(rows[2].symbols, []);
  assert.ok(c.followTrace[c.enemies[0].id].every((t) => !('moveId' in t)), 'the engine trace holds no move id');
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
  assert.deepEqual(kinds(rows[0]), ['?', '?'], 'both planned moves show until each one\'s own event: nothing about the charge shows early');
  assert.deepEqual(kinds(rows[1]), ['?'], 'the first follow-up has played; the charge sent no event of its own, so it stays until the turn ends');
  assert.equal(c.followTrace[c.enemies[0].id][1].outcome, 'charging');
});

test('a stagger that lands mid-turn ends the row', () => {
  // Every move entombs its owner: the head plays, then the entombed enemy plays none of its plan (SPEC §4.6a).
  const regs = soldier((e) => ({ moves: Object.fromEntries(Object.entries(e.moves).map(([id, m]) => [id,
    { ...m, effects: [...(m.effects || []), { op: 'applyStatus', target: 'self', status: 'entombed', stacks: 1 }] }])) }));
  const c = fight({ regs, reads: [], plan: (cc) => cc.enemies[0].plannedMoves.length === 2 });
  const rows = rowsAfterPhase(c, regs);
  assert.equal(rows.length, 1, 'only the head played');
  assert.deepEqual(kinds(rows[0]), ['?', '?'], 'the halt is not shown before it plays; the turn end clears the row');
});

test('a move refused for SP is not shown', () => {
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const regs = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries: regs, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const c = createRunCombat({ registries: regs, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const planned = c.enemies[0].plannedMoves.length;
  assert.ok(planned >= 1);
  const rows = rowsAfterPhase(c, regs);
  assert.equal(c.followTrace[c.enemies[0].id][0].outcome, 'refused');
  assert.equal(rows[0].symbols.length, planned, 'the planned move shows until its own event, refused or not');
  assert.equal(rows.at(-1).symbols.length, 0, 'the refusal event removes it');
});

test('no follow-up trace before the enemy phase: nothing shows (pre-play stays with the multi-action toggle)', () => {
  const c = fight();
  assert.equal(c.followTrace, undefined);
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

test('the row stays complete while a reaction window is open, with "?" for moves not read yet', () => {
  // Core 2 fight with reactions: the window opens on the head move, before any follow-up is presented or read.
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const regs = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const make = (seed) => {
    const run = createRunState({ registries: regs, classId: 'reaver', seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
    const c = createRunCombat({ registries: regs, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] });
    c.enemies[0].maxStamina = 3;
    return c;
  };
  const c = make(511), e = c.enemies[0], def = regs.enemies.get('wanderingSoldier');
  const planned = e.plannedMoves.length;
  const plan = followUpPlan({ queue: e.plannedMoves, def });
  dispatch(c, { type: 'endTurn' });
  assert.ok(c.pendingReaction, 'a reaction window is open');
  assert.equal(c.followTrace?.[e.id], undefined, 'no follow-up has been read yet');
  const head = advanceFollowUps(plan, c.followTrace?.[e.id]);
  assert.equal(head.length, planned, 'every planned follow-up is in the row');
  assert.ok(head.every((s) => s.kind === 'unknown'), 'unread moves are "?", never a real icon');
});

test('the row stays visible while a player reaction is pending, and the resumed turn keeps its plan', () => {
  const c = fight({ reads: [MISS, READ], plan: two(registries) });
  const e = c.enemies[0], def = registries.enemies.get('wanderingSoldier'), [, read] = planIcons(c);
  const memo = createFollowMemo();
  const first = memo.plan(e.id, { resuming: false, build: () => followUpPlan({ queue: e.plannedMoves, def }) });
  dispatch(c, { type: 'endTurn' });
  while (c.pendingReaction) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
  const row = memo.setRow(e.id, advanceFollowUps(first, c.followTrace?.[e.id])); // the head's enemyMoveStarted beat
  assert.deepEqual(row.map((s) => (s.kind === 'unknown' ? '?' : s.icon)), ['?', read]);
  assert.deepEqual(memo.row(e.id, true), row, 'the row survives the cleared playback record');
  assert.equal(memo.row(e.id, false), null, 'but only while the enemy phase is live');
  const resumed = memo.plan(e.id, { resuming: true, build: () => followUpPlan({ queue: [], def }) });
  assert.equal(resumed, first);
  assert.deepEqual(advanceFollowUps(resumed, c.followTrace?.[e.id]).map((s) => (s.kind === 'unknown' ? '?' : s.icon)), [read]);
  memo.clear();
  assert.equal(memo.row(e.id, true), null);
  assert.notEqual(memo.plan(e.id, { resuming: false, build: () => followUpPlan({ queue: e.plannedMoves, def }) }), first);
});

test('a reload during a reaction window: the follow-up stays "?" until its own enemyMoveStarted', () => {
  // Core 2, seed 511, maxStamina 3: the window opens on the move BEFORE its enemyMoveStarted, with one move planned.
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const regs = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries: regs, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const c = createRunCombat({ registries: regs, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const e = c.enemies[0];
  e.maxStamina = 3;
  dispatch(c, { type: 'endTurn' });
  assert.ok(c.pendingReaction && !c.eventLog.some((ev) => ev.type === 'enemyMoveStarted'), 'the window opened before any move started');
  const left = e.plannedMoves.length;
  assert.equal(left, 1, 'one planned move is left');
  // A reload: a fresh screen, nothing kept, the plan rebuilt from the saved queue. No trace was saved.
  const memo = createFollowMemo();
  const plan = memo.plan(e.id, { resuming: true, build: () => followUpPlan({ queue: e.plannedMoves, def: regs.enemies.get('wanderingSoldier') }) });
  while (c.pendingReaction) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
  const started = c.eventLog.filter((ev) => ev.type === 'enemyMoveStarted' && !ev.reaction);
  assert.equal(started.length, 2, 'the paused move starts after the resume, then the follow-up');
  const rows = started.map(() => advanceFollowUps(plan, undefined).map((s) => s.kind));
  assert.deepEqual(rows, [['unknown'], []], 'the follow-up stays "?" until its own event; the paused move owns no slot');
});

test('a burden-blocked head sends no enemyMoveStarted: its enemyBurdenBlocked keeps the row aligned', () => {
  const plan = followUpPlan({ queue: [{ moveId: 'slash' }, { moveId: 'guard' }], def: registries.enemies.get('wanderingSoldier') });
  const trace = [{ read: false, outcome: 'played' }, { read: false, outcome: 'played' }];
  // Events in play order: head blocked, follow-up 1 started, follow-up 2 started.
  assert.deepEqual([advanceFollowUps(plan, trace), advanceFollowUps(plan, trace), advanceFollowUps(plan, trace)].map((row) => row.length), [2, 1, 0]);
  // A blocked follow-up is one event too (enemyBurdenBlocked), so it consumes its own slot.
  const next = followUpPlan({ queue: [{ moveId: 'slash' }, { moveId: 'guard' }], def: registries.enemies.get('wanderingSoldier') });
  const out = [advanceFollowUps(next, trace), advanceFollowUps(next, [{ read: false, outcome: 'blocked' }, trace[1]]), advanceFollowUps(next, trace)];
  assert.deepEqual(out.map((row) => row.length), [2, 1, 0]);
});

test('a selected (expanded) intent carries the same follow-up row as the compact one, and no more', () => {
  withKitDom(() => {
    const followUps = [{ kind: 'unknown' }, { kind: 'action', icon: 'defend' }];
    const node = combatantIntent({ kind: 'attack', moveId: 'x', damage: 5, hits: 1, profile: {}, stance: 'attacking', revealed: true, hidden: false, followUps });
    const compact = node.querySelector('.intent-compact .intent-followups'), expanded = node.querySelector('.intent-followups-expanded');
    assert.ok(compact && expanded, 'both presentations hold the row');
    assert.equal(expanded.textContent, compact.textContent);
    assert.deepEqual([...expanded.querySelectorAll('.intent-followup')].map((n) => n.textContent + (n.dataset.unknown ?? '')), [...compact.querySelectorAll('.intent-followup')].map((n) => n.textContent + (n.dataset.unknown ?? '')));
    assert.equal(node.getAttribute('aria-label').match(/2 more actions/g).length, 1, 'one aria label, not two');
    assert.equal(combatantIntent({ kind: 'attack', moveId: 'x', damage: 5, hits: 1, profile: {}, stance: 'attacking', revealed: true, hidden: false }).querySelector('.intent-followups-expanded'), null);
  });
});

test('a read counter follow-up shows the counter icon, as the current intent does (real Gilded Knight parry)', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries, profileMeta: { settings: {} } });
  const c = createRunCombat({ registries, rng: createRng(5), run, enemyIds: ['gildedKnight'], settings: {} });
  const e = c.enemies[0], def = registries.enemies.get('gildedKnight');
  assert.equal(def.moves.parry.intent, 'block', 'authored as a block with a counter');
  const plan = followUpPlan({ queue: [{ moveId: 'parry' }, { moveId: 'thrust' }], def, enemyId: e.id, combat: c });
  const row = advanceFollowUps(plan, [{ read: true, outcome: 'played' }, { read: false, outcome: 'played' }]);
  assert.deepEqual(row.map((s) => (s.kind === 'unknown' ? '?' : s.icon)), ['counter', '?']);
});

test('a read buff and a read spell follow-up show the icon they would show as the current intent', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries, profileMeta: { settings: {} } });
  const c = createRunCombat({ registries, rng: createRng(5), run, enemyIds: ['wanderingSoldier'], settings: {} });
  const e = c.enemies[0], real = registries.enemies.get('wanderingSoldier');
  const def = { ...real, moves: { ...real.moves, hex: { intent: 'attack', tags: ['camp:spell'] } } };
  const plan = followUpPlan({ queue: [{ moveId: 'warcry' }, { moveId: 'hex' }], def, enemyId: e.id, combat: c });
  const read = [{ read: true, outcome: 'played' }, { read: true, outcome: 'played' }];
  assert.deepEqual(advanceFollowUps(plan, read).map((s) => s.icon), ['buff', 'cast']);
});
