// Always-on combat visuals (SPEC §4.11; owner decision 2026-10-12): the blue selection, the soft shadows and the thin
// target outline are on in every fight, rounds mode or not. The outline uses stance advantage only when rounds mode is
// off (speed counts only in rounds mode): green when the card's stance beats the enemy's revealed stance, red when it
// loses, none when neutral or unrevealed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { STANCE_ADVANTAGE_CSV } from '../src/content/combatRounds.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { cardKind } from '../src/model/tree.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { parseStanceAdvantage, stanceBonus, stanceOutline } from '../src/engine/combatRounds/resolver.js';
import { decorateCombatRoundsScreen } from '../src/ui/components/combatRoundsScreen.js';

const registries = createRegistries(contentBundle);
const TABLE = parseStanceAdvantage(STANCE_ADVANTAGE_CSV);
const ENEMY = 'wanderingSoldier';

// A plain fight: no toggle on. The enemy's intent is set to a known move, revealed.
function normalFight({ intentMove = 'guard', intentKind = 'block' } = {}) {
  const run = createRunState({ seed: 5, classId: 'reaver', registries, profileMeta: { settings: {} } });
  const c = createRunCombat({ registries, rng: createRng(5), run, enemyIds: [ENEMY], settings: {} });
  const enemy = c.enemies[0];
  enemy.intent = { moveId: intentMove, kind: intentKind, combatProfile: {}, damage: null, hits: null, block: 4, delayed: false, pending: false };
  enemy.intentRevealed = true;
  return { c, enemy };
}

test('the stance outline: green when the card beats the revealed stance, red when it loses, none when neutral or hidden', () => {
  assert.ok(TABLE.has('attack>smash') && TABLE.has('smash>attack') === false, 'the table has attack beating smash, and not the reverse');
  const card = { target: 'e1', stance: 'attack' };
  assert.equal(stanceOutline({ card, foe: { stance: 'smash' }, stage: 3, stanceTable: TABLE }), 'green', 'attack beats a revealed smash');
  assert.equal(stanceOutline({ card: { target: 'e1', stance: 'smash' }, foe: { stance: 'attack' }, stage: 3, stanceTable: TABLE }), 'red', 'a smash loses to a revealed attack');
  assert.equal(stanceOutline({ card, foe: { stance: 'attack' }, stage: 3, stanceTable: TABLE }), null, 'neutral: no outline');
  assert.equal(stanceOutline({ card, foe: { stance: 'smash' }, stage: 1, stanceTable: TABLE }), null, 'a stance is revealed from stage 2 only');
  assert.equal(stanceOutline({ card: { target: 'self', stance: 'attack' }, foe: { stance: 'smash' }, stage: 3, stanceTable: TABLE }), null, 'a card for its own side has no outline');
  assert.equal(stanceOutline({ card, foe: { stance: null }, stage: 3, stanceTable: TABLE }), null, 'an unknown foe stance: no outline');
  assert.equal(stanceBonus(TABLE, 'attack', 'smash') > 0, true);
});

test('the stance outline reads the same stance table as the rounds outline', () => {
  for (const [pair] of TABLE) {
    const [a, b] = pair.split('>');
    if (a === b) continue;
    const outline = stanceOutline({ card: { target: 'e1', stance: a }, foe: { stance: b }, stage: 3, stanceTable: TABLE });
    assert.equal(outline, 'green', `${a} beats ${b} in the table, so it is green`);
  }
});

// A stub DOM for one enemy box: its intent, its sprite art and the banner (the decorator only reads and writes these).
function fakeBox(combat) {
  const img = { dataset: {}, closest: () => null, getClientRects: () => [1] };
  const intentEl = { children: [], append(n) { this.children.push(n); }, querySelectorAll: () => [] };
  const box = {
    dataset: {},
    querySelector: (sel) => (sel === '.intent' ? intentEl : null),
    querySelectorAll: (sel) => (sel === '.sprite img' ? [img] : []),
  };
  const root = {
    dataset: {},
    querySelectorAll: () => [],
    querySelector: (sel) => (sel.startsWith('.combatant.enemy') ? box : null),
  };
  return { root, box, img, intentEl, combat };
}
function decorateArmed(combat) {
  const dom = fakeBox(combat);
  const card = combat.piles.hand.find((x) => cardKind(resolveCard(registries, x)) === 'attack');
  const previous = { document: globalThis.document, CSS: globalThis.CSS, getComputedStyle: globalThis.getComputedStyle };
  globalThis.CSS = { escape: String };
  globalThis.getComputedStyle = () => ({ visibility: 'visible' });
  // No element is created in a normal fight with the toggles off: the outline is a dataset write only.
  globalThis.document = { createElement: () => { throw new Error('no element when the toggles are off'); } };
  try {
    decorateCombatRoundsScreen(dom.root, combat, { armedCardId: card.instanceId, targetedId: combat.enemies[0].id });
  } finally {
    Object.assign(globalThis, previous);
  }
  return dom;
}

test('a plain fight with every toggle off draws the stance outline on the enemy, with the shadow first on the sprite', () => {
  const { c } = normalFight({ intentMove: 'guard', intentKind: 'block' });
  const dom = decorateArmed(c);
  // An attack loses to a revealed block (block beats attack in the table): red.
  assert.equal(dom.box.dataset.crOutline, 'red');
  assert.equal(dom.img.dataset.targetOutline, 'red', 'the sprite art carries the outline');
  assert.equal('combatRounds' in dom.root.dataset, false, 'no rounds marker in a plain fight');
});

test('a plain fight draws no outline against a neutral (attack) intent, and none when no card is aimed', () => {
  const { c } = normalFight({ intentMove: 'slash', intentKind: 'attack' });
  const dom = decorateArmed(c);
  assert.equal(dom.box.dataset.crOutline, undefined, 'attack against attack: neutral');
  assert.equal(dom.img.dataset.targetOutline, undefined);
  const { c: idle } = normalFight({ intentMove: 'guard', intentKind: 'block' });
  const none = fakeBox(idle);
  decorateCombatRoundsScreen(none.root, idle, { armedCardId: null, targetedId: idle.enemies[0].id });
  assert.equal(none.box.dataset.crOutline, undefined, 'no card aimed: no outline');
});

test('the always-on rules are not scoped to the preview attribute, and the shadow sits on intent icons and sprites', () => {
  const css = readFileSync(new URL('../styles/combat-visuals.css', import.meta.url), 'utf8');
  assert.match(css, /\.combat \.intent-icon \{\s*filter: drop-shadow\(/, 'a shadow on each intent glyph in every fight');
  assert.match(css, /\.combat \.combatant \.sprite img:not\(\[data-target-outline\]\) \{\s*filter: drop-shadow\(/, 'a shadow on each sprite in every fight');
  assert.doesNotMatch(css, /combat-rounds|data-combat-rounds/, 'no rounds scope in the always-on file');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const visuals = html.indexOf('styles/combat-visuals.css');
  assert.ok(visuals > 0, 'the always-on stylesheet is linked');
  assert.ok(visuals < html.indexOf('styles/combat-rounds-preview.css'), 'and loads before the preview stylesheet');
});
