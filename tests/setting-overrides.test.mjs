// tests/setting-overrides.test.mjs — a specific value wins over a global one,
// by a switch, and a row that does nothing right now is disabled.
//
// Owner, 2026-09-23: "changes to specific stats should over write global stats
// with … a toggle to over write global per stat … Disable fields if toggle
// isn't on". (The every-stat "points per increase" switch this file also
// covered left with the tier dial itself — ruleset 6, #1253.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { advancedConfigRows, configuredContentBundle, advancedConfigExport, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';
import { resolveEquipmentRequirements } from '../src/model/startingStatConfig.js';
import { validateContent } from '../src/model/validate.js';
import { categoryHandler, closedGate, gateSentence, refreshGates, settingsRow } from '../src/ui/screens/settings.js';
import { advancedSection, advancedSubgroups } from '../src/ui/models/AdvancedSettingsGroups.js';

const REQUIREMENT = 'gameConfig.equipmentRequirements.greatsword.strength';
const OWN_REQUIREMENT = 'gameConfig.own.equipmentRequirements.greatsword.strength';
const rows = categoryHandler('Advanced').rows;
const row = (key) => rows.find((candidate) => candidate.key === key) || settingsRow(key);

test('switches file with the row they govern, directly above it', () => {
  const member = (key) => rows.find((candidate) => candidate.key === key.replace('gameConfig.own.', 'gameConfig.')
    || candidate.key.startsWith(`${key.replace('gameConfig.own.', 'gameConfig.')}.`));
  for (const key of [OWN_REQUIREMENT, 'gameConfig.own.balance.rewards.rarityWeightsByClass.starseer',
    'gameConfig.own.balance.equipment.startingDeck.classes.reaver.strikeBias']) {
    const section = advancedSection(row(key));
    assert.equal(section, advancedSection(member(key)), `${key} files in its row's section`);
    const group = advancedSubgroups(rows, section).find((sub) => sub.rows.some((candidate) => candidate.key === key));
    const at = group.rows.findIndex((candidate) => candidate.key === key);
    assert.equal(group.rows[at + 1].key, member(key).key, `${key} sits above its row`);
  }
});

test('a class switched off follows the global, and the bundle still validates', () => {
  const off = {
    'gameConfig.own.balance.rewards.rarityWeightsByClass.starseer': false,
    'gameConfig.own.balance.equipment.startingDeck.classes.reaver.strikeBias': false,
    'gameConfig.balance.rewards.rarityWeightsByClass.starseer.normal.rare': 90,
  };
  const configured = configuredContentBundle(contentBundle, off);
  assert.equal(configured.balance.rewards.rarityWeightsByClass.starseer, undefined, 'Starseer uses Reward rarity');
  assert.ok(configured.balance.rewards.rarityWeightsByClass.herald, 'Herald still uses its own');
  assert.equal(configured.balance.equipment.startingDeck.classes.reaver, undefined, 'Reaver uses the default strike bias');
  assert.equal(validateContent(configured).ok, true);
  assert.ok(configuredContentBundle(contentBundle, {}).balance.rewards.rarityWeightsByClass.starseer, 'default: on, as shipped');
  const gate = closedGate(off, row('gameConfig.balance.rewards.rarityWeightsByClass.starseer.normal.rare'));
  assert.match(gateSentence(gate, off), /Following “Rewards · Rarity Weights · Normal — Rare” \(5\)/);
});

test('an item\'s own requirement is used only while its switch is on', () => {
  const key = 'gameConfig.equipmentRequirements.greatsword.strength';
  const minimum = (settings) => (resolveEquipmentRequirements(contentBundle, settings) || contentBundle.equipment.equipmentRequirements)
    .find((candidate) => candidate.itemId === 'greatsword' && candidate.attributeId === 'strength').minimum;
  assert.equal(row(`gameConfig.own.${key.slice('gameConfig.'.length)}`).resolve({ [key]: 1 }), true, 'a pinned value turns its switch on');
  assert.equal(minimum({ [key]: 1 }), 1);
  assert.equal(minimum({ [key]: 1, [`gameConfig.own.${key.slice('gameConfig.'.length)}`]: false }), 3, 'switched off: authored × multiplier');
  assert.ok(closedGate({}, row(key)), 'no pin: the row is disabled');
});

test('a row whose switch is off does nothing, and the screen says so', () => {
  const drops = 'gameConfig.balance.equipment.drops.chance.elite';
  assert.equal(closedGate({}, row(drops)), null);
  assert.match(gateSentence(closedGate({ 'gameConfig.balance.equipment.drops.enabled': false }, row(drops)), {}), /Used only while “.*Enabled” is on/);
  assert.ok(closedGate({}, row('gameConfig.balance.equipment.swapCostByCategory.0.cost')), 'category costs are off under the flat rule');
  assert.equal(closedGate({ swapCostRule: 'category' }, row('gameConfig.balance.equipment.swapCostByCategory.0.cost')), null);
  assert.ok(closedGate({}, row('gameConfig.balance.poise.growthMult')), 'the older poise meter is off while ratings are on');
  assert.equal(closedGate({ 'gameConfig.combatRatings.enabled': false }, row('gameConfig.balance.poise.growthMult')), null);
  // (The rating multiplier this line used to test retired with ruleset 7; a
  // rating's own stat row is gated the same way.)
  assert.ok(closedGate({ 'gameConfig.combatRatings.enabled': false }, row('gameConfig.derivedStatRules.rules.ar.strength')));
});

test('refreshGates disables the controls, shows the inherited value, and restores the own value', () => {
  const node = (className = '', dataset = {}) => {
    const self = {
      className, dataset, children: [], parent: null, hidden: false, textContent: '', attrs: {}, value: '', disabled: false,
      tagName: dataset.key ? 'INPUT' : 'DIV', type: 'number',
      classList: {
        toggle(name, on) { const set = new Set(String(self.className).split(/\s+/).filter(Boolean)); if (on) set.add(name); else set.delete(name); self.className = [...set].join(' '); },
      },
      setAttribute(name, value) { self.attrs[name] = value; },
      append(child) { child.parent = self; self.children.push(child); },
      appendChild(child) { self.append(child); return child; },
      descendants() { return self.children.flatMap((child) => [child, ...child.descendants()]); },
      matches(selector) {
        if (selector === '[data-key]') return 'key' in self.dataset;
        return String(self.className).split(/\s+/).includes(selector.slice(1));
      },
      querySelector(selector) { return self.descendants().find((child) => child.matches(selector)) || null; },
      querySelectorAll(selector) { return self.descendants().filter((child) => child.matches(selector)); },
      closest(selector) { return self.matches(selector) ? self : self.parent?.closest(selector) || null; },
      ownerDocument: { createElement: () => node('') },
    };
    return self;
  };
  const container = node('panel');
  const wrapper = container.appendChild(node('set-row'));
  wrapper.appendChild(node('as-labelstack'));
  const input = wrapper.appendChild(node('set-num', { key: REQUIREMENT }));
  input.value = '1';
  const settings = { 'gameConfig.equipmentRequirements.scale': 0.5, [REQUIREMENT]: 1, [OWN_REQUIREMENT]: false };
  refreshGates(container, settings);
  assert.equal(input.disabled, true);
  assert.equal(input.value, '2', 'the number shown is the one in force: authored 3 × 0.5, rounded');
  assert.match(wrapper.querySelector('.set-gate-note').textContent, /Following the authored value × the multiplier \(2\)/);
  settings[OWN_REQUIREMENT] = true;
  refreshGates(container, settings);
  assert.equal(input.disabled, false);
  assert.equal(input.value, '1', 'the own value comes back');
  assert.equal(wrapper.querySelector('.set-gate-note').hidden, true);
});

test('every new switch is a known key, so a configuration file carrying them imports', () => {
  const file = { [OWN_REQUIREMENT]: true, 'gameConfig.own.balance.rewards.rarityWeightsByClass.herald': false };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(file), contentBundle), file);
  assert.ok(advancedConfigRows(contentBundle).some((candidate) => candidate.key === OWN_REQUIREMENT));
});

// Codex, on #1260: an override switch must also go dead with the subsystem
// its row belongs to.
test('an override switch is disabled while the rows it governs do nothing', () => {
  const strike = 'gameConfig.own.balance.equipment.startingDeck.classes.reaver.strikeBias';
  assert.equal(closedGate({}, row(strike)), null);
  assert.ok(closedGate({ 'gameConfig.balance.equipment.startingDeck.enabled': false }, row(strike)), 'deck rules off');
});

// Review of #1260 (a separate Claude session), each confirmed before fixing.
test('drop settings that stay live with drops off are not greyed out', () => {
  const off = { 'gameConfig.balance.equipment.drops.enabled': false };
  for (const live of ['consolationCinders', 'requireFound', 'permanentOnFind']) {
    assert.equal(closedGate(off, row(`gameConfig.balance.equipment.drops.${live}`)), null, `${live} is read whether or not drops are on`);
  }
  for (const roll of ['chance.elite', 'rarityWeights.boss.rare', 'preferUnfound']) {
    assert.ok(closedGate(off, row(`gameConfig.balance.equipment.drops.${roll}`)), `${roll} is the roll itself`);
  }
});

test('an item switched on with nothing typed uses its authored requirement, as the row shows', () => {
  const key = 'gameConfig.equipmentRequirements.greatsword.strength';
  const own = `gameConfig.own.${key.slice('gameConfig.'.length)}`;
  const scaled = { 'gameConfig.equipmentRequirements.scale': 0.5 };
  const minimum = (settings) => (resolveEquipmentRequirements(contentBundle, settings) || contentBundle.equipment.equipmentRequirements)
    .find((candidate) => candidate.itemId === 'greatsword' && candidate.attributeId === 'strength').minimum;
  assert.equal(minimum(scaled), 2, 'off: authored 3 × 0.5, rounded');
  assert.equal(minimum({ ...scaled, [own]: true }), 3, 'on, untouched: the authored 3 the enabled row shows');
  assert.equal(minimum({ ...scaled, [own]: true, [key]: 4 }), 4);
});

test('a swap-cost rule row is gated by the rule it belongs to, read from the content', () => {
  const rules = contentBundle.balance.equipment.swapCostRules;
  rules.forEach((rule, index) => {
    const key = `gameConfig.balance.equipment.swapCostRules.${index}.gear`;
    assert.equal(closedGate({ swapCostRule: rule.id }, row(key)), null, `${rule.id} row open under ${rule.id}`);
    const other = rules.find((candidate) => candidate.id !== rule.id).id;
    assert.ok(closedGate({ swapCostRule: other }, row(key)), `${rule.id} row closed under ${other}`);
  });
});

// Codex, on #1260: a row that does nothing right now is disabled, and the note
// says which switch. Ruleset 7 made Poise ONE row, in force with ratings on or
// off, so it is never disabled; the AR, DR, PR and Ward rows are the ones a
// switch closes — they are read only while ratings are on.
test('the Poise row is live either way; AR, DR, PR and Ward rows are disabled while ratings are off', () => {
  const off = { 'gameConfig.combatRatings.enabled': false };
  for (const field of ['base', 'constitution', 'max']) {
    const poise = row(`gameConfig.derivedStatRules.rules.poise.${field}`);
    assert.equal(closedGate({}, poise), null, `poise.${field} is live with ratings on`);
    assert.equal(closedGate(off, poise), null, `poise.${field} is live with ratings off`);
  }
  for (const id of ['ar', 'dr', 'pr', 'ward']) {
    const rating = row(`gameConfig.derivedStatRules.rules.${id}.base`);
    assert.equal(closedGate({}, rating), null, `${id} is live with ratings on`);
    assert.match(gateSentence(closedGate(off, rating), off), /Enable ratings, Poise & Ward” is on/, `${id} names the switch`);
  }
});

test('a row closed by both its feature and its own switch names the feature', () => {
  const deckOff = { 'gameConfig.balance.equipment.startingDeck.enabled': false, 'gameConfig.own.balance.equipment.startingDeck.classes.reaver.strikeBias': false };
  const strike = row('gameConfig.balance.equipment.startingDeck.classes.reaver.strikeBias');
  assert.match(gateSentence(closedGate(deckOff, strike), deckOff), /Starting Deck — Enabled” is on/);
});

// Codex, on #1260: rows disabled while ratings are off cannot be corrected,
// so their values are not judged until ratings come back on.
test('invalid rating values are not judged while ratings are off', async () => {
  const { advancedConfigStructuralProblems } = await import('../src/model/advancedConfig.js');
  const broken = { 'gameConfig.combatRatings.impact.lightMaxWeight': 100, 'gameConfig.combatRatings.impact.mediumMaxWeight': 50 };
  assert.ok(advancedConfigStructuralProblems(contentBundle, broken).length > 0, 'with ratings on, the pair is refused');
  assert.deepEqual(advancedConfigStructuralProblems(contentBundle, { ...broken, 'gameConfig.combatRatings.enabled': false }), [],
    'with ratings off, the dormant pair refuses nothing');
});

// Owner, 2026-09-23 (after the Battlefield check in a browser): movement's
// own settings are disabled while formation movement is off.
test('formation movement settings are disabled while movement is off', () => {
  const off = {};
  const on = { 'gameConfig.presentation.movementEnabled': true };
  for (const leaf of ['movementNeedsSelection', 'movementCostsAction', 'tileActivation', 'moveActivation']) {
    const key = `gameConfig.presentation.${leaf}`;
    assert.match(gateSentence(closedGate(off, row(key)), off), /Enable formation movement” is on/, leaf);
    assert.equal(closedGate(on, row(key)), null, leaf);
  }
  assert.equal(closedGate(off, row('gameConfig.presentation.selectionColor')), null, 'the shared selection colour stays live');
});

// Codex, on #1260: the mirror of the dormant-ratings case. With ratings on,
// the older poise rows are disabled, so a stored value there — even one
// validation refuses — is not applied and cannot discard the configuration.
test('a value whose feature is switched off is not applied or judged', () => {
  const stored = { 'gameConfig.balance.stagger.player.statuses.weak': 0, 'gameConfig.balance.rewards.cardChoices': 4 };
  const ratingsOn = configuredContentBundle(contentBundle, stored);
  assert.equal(validateContent(ratingsOn).ok, true, 'ratings on: the dormant 0 is not in the bundle');
  assert.equal(ratingsOn.balance.stagger.player.statuses.weak, contentBundle.balance.stagger.player.statuses.weak);
  assert.equal(ratingsOn.balance.rewards.cardChoices, 4, 'and unrelated tuning is kept');
  const ratingsOff = configuredContentBundle(contentBundle, { ...stored, 'gameConfig.combatRatings.enabled': false });
  assert.equal(ratingsOff.balance.stagger.player.statuses.weak, 0, 'ratings off: the row is live and its value applies');
});

// Review of #1260: a run saved before combat ratings existed is played with
// ratings off, so its poise and stagger tuning is in force and must be applied,
// even though its stored settings do not say ratings are off.
test('a snapshot from before ratings keeps its poise and stagger tuning', () => {
  const overrides = { 'gameConfig.balance.stagger.player.statuses.weak': 3, 'gameConfig.derivedStatRules.rules.poise.base': 7 };
  const legacy = configuredContentBundle(contentBundle, { schemaVersion: 1, overrides });
  assert.equal(legacy.balance.combatRatings.enabled, false);
  assert.equal(legacy.balance.stagger.player.statuses.weak, 3);
  assert.equal(legacy.derivedStatRules.rules.poise.base, 7);
  const current = configuredContentBundle(contentBundle, { schemaVersion: 1, ratingsVersion: 1, overrides });
  assert.equal(current.balance.combatRatings.enabled, true);
  assert.equal(current.balance.stagger.player.statuses.weak, contentBundle.balance.stagger.player.statuses.weak, 'ratings on: set aside');
});

// Codex, on #1260: a multiplier the pools cannot carry is refused whole, and
// the game keeps the authored table; the greyed-out row shows that, not the
// refused product.
test('a disabled requirement shows the value a new run uses when the multiplier is refused', () => {
  const refused = { 'gameConfig.equipmentRequirements.scale': 2, [OWN_REQUIREMENT]: false };
  const gate = closedGate(refused, row(REQUIREMENT));
  assert.match(gateSentence(gate, refused), /\(3\)/, 'authored 3, not the refused 6');
  const admitted = { 'gameConfig.equipmentRequirements.scale': 0.5, [OWN_REQUIREMENT]: false };
  assert.match(gateSentence(closedGate(admitted, row(REQUIREMENT)), admitted), /\(2\)/);
});
