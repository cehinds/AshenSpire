import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { createStanceLedger, kindForCard, stanceForCard } from '../src/model/alternativeStance.js';

// The player's at-rest intent glyph reads the last confirmed card's authored
// kind (smash, counter, defend, sweep, spell), not the broad stance family.
test('a confirmed card keeps its authored kind across player turns until the next confirmed card', () => {
  const kinds = createStanceLedger(kindForCard);
  assert.equal(kinds.get(), null);
  assert.equal(kinds.accept({ type: 'cardPlayed', cardId: 'defend' }).maneuver, 'defend');
  assert.equal(kinds.get().maneuver, 'defend');
  kinds.accept({ type: 'cardPlayed', cardId: 'shieldBash' });
  assert.equal(kinds.get().maneuver, 'smash', 'the later confirmed card replaces the kind');
  kinds.accept({ type: 'playerTurnStart' });
  assert.equal(kinds.get().maneuver, 'smash', 'a new player turn keeps the held kind');
  kinds.accept({ type: 'combatStarted' });
  assert.equal(kinds.get(), null, 'a new combat clears it');
});

test('the default ledger still records the broad stance family', () => {
  const stances = createStanceLedger();
  assert.equal(stances.accept({ type: 'cardPlayed', cardId: 'defend' }), 'defensive');
  assert.equal(stanceForCard({ id: 'strike' }), 'offensive');
  assert.equal(kindForCard({ id: 'strike' }).maneuver, 'attack');
});

// Unarmed, the player's figure shows the last confirmed kind; an armed card wins.
test('an unarmed player shows the last confirmed kind, an armed card its own', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const begin = source.indexOf('  function syncPlayerActionIntent('), end = source.indexOf('  function armSelf(', begin);
  const actions = [];
  const leading = { querySelector: () => null, append: action => actions.push(action) };
  const context = {
    combat: {}, upcastRanksByCard: new Map(), resolveCombatCard: () => ({ id: 'shieldBash' }), combatProfileFor, kindForCard, selfArm: null,
    playerActionIntent: profile => ({ profile }), playCard() {}, selectCombatant() {},
    combatEl: { dispatchEvent() {} }, CustomEvent: class { constructor(type) { this.type = type; } },
  };
  const sync = runInNewContext(`${source.slice(begin, end)}\nsyncPlayerActionIntent`, context);
  sync({ querySelector: () => leading }, null, kindForCard({ id: 'defend' }));
  assert.equal(actions.at(-1).profile.maneuver, 'defend', 'the held kind shows while nothing is armed');
  sync({ querySelector: () => leading }, { instanceId: 'x', cardId: 'shieldBash' }, kindForCard({ id: 'defend' }));
  assert.equal(actions.at(-1).profile.maneuver, 'smash', 'the armed card wins over the held kind');
});

// Owner (2026-10-11): the figure shows its intent glyph with nothing played.
// Before a card is confirmed, the neutral resting mark is what it shows.
test('with nothing confirmed or armed, the figure shows the neutral resting mark', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const begin = source.indexOf('  function syncPlayerActionIntent('), end = source.indexOf('  function armSelf(', begin);
  const actions = [];
  const leading = { querySelector: () => null, append: action => actions.push(action) };
  const context = {
    combat: {}, upcastRanksByCard: new Map(), resolveCombatCard: () => ({ id: 'shieldBash' }), combatProfileFor, kindForCard, selfArm: null,
    RESTING_PLAYER_ACTION: { maneuver: 'ready' },
    playerActionIntent: profile => ({ profile }), playCard() {}, selectCombatant() {},
    combatEl: { dispatchEvent() {} }, CustomEvent: class { constructor(type) { this.type = type; } },
  };
  const sync = runInNewContext(`${source.slice(begin, end)}\nsyncPlayerActionIntent`, context);
  sync({ querySelector: () => leading }, null, null);
  assert.equal(actions.length, 1, 'a glyph is appended with nothing played');
  assert.equal(actions[0].profile.maneuver, 'ready');
  sync({ querySelector: () => leading }, null);
  assert.equal(actions.length, 2, 'a turn-start clear (no held kind) still shows the mark');
  const overhead = readFileSync(new URL('../src/ui/components/combatantOverhead.js', import.meta.url), 'utf8');
  assert.match(overhead, /ready: 'prepare'/, 'the resting mark draws the neutral prepare sigil');
  assert.match(overhead, /export const RESTING_PLAYER_ACTION = Object\.freeze\(\{ maneuver: 'ready' \}\);/);
});

// A spell-only card (camp:spell, no maneuver, e.g. Scholar's Insight) shows the
// prepare glyph, both armed and as the held kind after it is confirmed.
const overheadSource = readFileSync(new URL('../src/ui/components/combatantOverhead.js', import.meta.url), 'utf8');
const overheadBegin = overheadSource.indexOf('export function playerActionIntent(');
const overheadEnd = overheadSource.indexOf('\n}\n', overheadBegin) + 3;
function loadPlayerActionIntent() {
  const fakeDocument = { createElement: tag => ({
    tag, type: '', className: '', attrs: {}, children: [], listeners: {},
    setAttribute(key, value) { this.attrs[key] = value; },
    append(...nodes) { this.children.push(...nodes); },
    addEventListener(type, fn) { this.listeners[type] = fn; },
  }) };
  const body = overheadSource.slice(overheadBegin, overheadEnd).replace(/^export /, '');
  return runInNewContext(`${body}\nplayerActionIntent`, { document: fakeDocument, intentIcon: id => ({ icon: id }) });
}
function loadSyncPlayerActionIntent(playerActionIntent, resolved) {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const begin = source.indexOf('  function syncPlayerActionIntent('), end = source.indexOf('  function armSelf(', begin);
  const actions = [];
  const leading = { querySelector: () => null, append: action => actions.push(action) };
  const context = {
    combat: {}, upcastRanksByCard: new Map(), resolveCombatCard: () => resolved, combatProfileFor, kindForCard, selfArm: null,
    RESTING_PLAYER_ACTION: { maneuver: 'ready' }, playerActionIntent, playCard() {}, selectCombatant() {},
    combatEl: { dispatchEvent() {} }, CustomEvent: class { constructor(type) { this.type = type; } },
  };
  const sync = runInNewContext(`${source.slice(begin, end)}\nsyncPlayerActionIntent`, context);
  return { actions, sync: (inst, held) => sync({ querySelector: () => ({ querySelector: () => null, append: leading.append }) }, inst, held) };
}

test('a spell-only profile shows the prepare glyph, and an untyped one too', () => {
  const playerActionIntent = loadPlayerActionIntent();
  const spellOnly = combatProfileFor({ id: 'scholarsInsight' });
  assert.equal(spellOnly.camp, 'spell');
  assert.equal(spellOnly.maneuver, null);
  const node = playerActionIntent(spellOnly, () => {});
  assert.ok(node, 'a spell-only profile is not dropped');
  assert.equal(node.attrs['aria-label'], 'Selected action: prepare');
  assert.equal(node.children[0].icon, 'prepare');
  const untyped = playerActionIntent({ camp: 'physical', maneuver: null }, () => {});
  assert.ok(untyped, 'an untyped profile still shows a glyph');
  assert.equal(untyped.children[0].icon, 'prepare', 'an untyped profile renders the prepare icon');
  assert.equal(playerActionIntent(null, () => {}), null);
});

test('an armed spell-only card wins over the held kind', () => {
  const { actions, sync } = loadSyncPlayerActionIntent(profile => ({ profile }), { id: 'scholarsInsight' });
  sync({ instanceId: 'x', cardId: 'scholarsInsight' }, kindForCard({ id: 'defend' }));
  assert.equal(actions.at(-1).profile.camp, 'spell', 'the armed spell-only profile is not replaced by the held kind');
  assert.equal(actions.at(-1).profile.maneuver, null);
});

test('after confirming a spell-only card, the held glyph becomes prepare', () => {
  const kinds = createStanceLedger(kindForCard);
  kinds.accept({ type: 'cardPlayed', cardId: 'defend' });
  kinds.accept({ type: 'cardPlayed', cardId: 'scholarsInsight' });
  assert.equal(kinds.get().camp, 'spell', 'the ledger keeps the spell-only profile');
  const { actions, sync } = loadSyncPlayerActionIntent(loadPlayerActionIntent(), null);
  sync(null, kinds.get());
  assert.equal(actions.length, 1, 'the held spell-only kind shows a glyph');
  assert.equal(actions[0].attrs['aria-label'], 'Selected action: prepare');
  assert.equal(actions[0].children[0].icon, 'prepare');
});

test('a sweep profile renders the sweep icon, not the attack icon', () => {
  const playerActionIntent = loadPlayerActionIntent();
  const node = playerActionIntent({ camp: 'physical', maneuver: 'sweep' }, () => {});
  assert.equal(node.children[0].icon, 'sweep');
  assert.equal(node.attrs['aria-label'], 'Selected action: sweep');
});

test('an armed untyped card shows the prepare glyph over a held defend', () => {
  const { actions, sync } = loadSyncPlayerActionIntent(loadPlayerActionIntent(), { id: 'untypedSkill', type: 'skill', cardTags: [] });
  sync({ instanceId: 'x', cardId: 'untypedSkill' }, kindForCard({ id: 'defend' }));
  assert.equal(actions.at(-1).attrs['aria-label'], 'Selected action: prepare', 'the armed profile is always used when present');
  assert.equal(actions.at(-1).children[0].icon, 'prepare');
});

test('selection previews the card stance on the figure sprite; deselect returns to the held stance', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(source, /stageFor\(player\?\.querySelector\('\.sprite'\)\)\?\.setStance\?\.\(def \? stanceForCard\(def\) : heldStances\.get\(\)\);/);
  assert.match(source, /stageFor\(box\)\?\.setStance\?\.\(activeDef \? stanceForCard\(activeDef\) : heldStances\.get\(\)\);/);
});

// Owner (2026-10-12): the glyph and the figure's stance agree, even for a card
// with no authored maneuver — an untagged attack shows attack, not prepare.
test('an untagged attack card reads as attack for both the glyph and the stance', () => {
  const card = { id: 'untaggedStrike', type: 'attack', cardTags: [] };
  assert.equal(stanceForCard(card), 'offensive');
  assert.equal(kindForCard(card).maneuver, 'attack');
  assert.equal(kindForCard({ id: 'untaggedSkill', type: 'skill', cardTags: [] }).maneuver ?? null, null);
});
