// tests/setting-overrides.test.mjs — a specific value wins over a global one,
// by a switch, and a row that does nothing right now is disabled.
//
// Owner, 2026-09-23: "changes to specific stats should over write global stats
// with … a toggle to over write global per stat … Disable fields if toggle
// isn't on", then: "a general [switch] … auto toggles the per stat off until I
// toggle the individual per stat option. If the general toggle is off, the per
// stat is automatically enabled", and "I don't like the term tier".
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { advancedConfigRows, configuredContentBundle, advancedConfigExport, parseAdvancedConfigFile, normalizeAdvancedSettings, migrateSharedRate } from '../src/model/advancedConfig.js';
import { resolveEquipmentRequirements, SHARED_RATE_KEY, EVERY_STAT_RATE_LABEL } from '../src/model/startingStatConfig.js';
import { validateContent } from '../src/model/validate.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { categoryHandler, derivedStatDialOptions, closedGate, gateSentence, refreshGates, settingsRow } from '../src/ui/screens/settings.js';
import { advancedSection, advancedSubgroups } from '../src/ui/models/AdvancedSettingsGroups.js';

const OWN_HP = 'gameConfig.own.derivedStatRules.rules.hp.pointsPerTier';
const HP_TIER = 'gameConfig.derivedStatRules.rules.hp.pointsPerTier';
const rows = categoryHandler('Advanced').rows;
const row = (key) => rows.find((candidate) => candidate.key === key) || settingsRow(key);

const born = (settings) => createRunState({
  seed: 0x5eed, classId: 'reaver',
  registries: createRegistries(configuredContentBundle(contentBundle, settings)),
  derivedStatOptions: derivedStatDialOptions(settings),
});
const hpRule = (run) => run.derivedStatRuleSnapshot.rules.rules.hp.pointsPerTier;
const energyRule = (run) => run.derivedStatRuleSnapshot.rules.rules.energy.pointsPerTier;

test('general switch off (the default): every stat uses its own number and the every-stat number is ignored', () => {
  assert.deepEqual(derivedStatDialOptions({}), {}, 'a default run is born with no override layer');
  const run = born({ [SHARED_RATE_KEY]: false, statTierSize: 3 });
  assert.equal(hpRule(run), 1, 'HP keeps its shipped 1');
  assert.equal(energyRule(run), 5, 'Actions keeps its shipped 5 — the every-stat 3 is not used');
  assert.equal(hpRule(born({ [SHARED_RATE_KEY]: false, [HP_TIER]: 2 })), 2, 'a stat\'s own number applies with no switch to turn');
});

test('general switch on: every stat follows the every-stat number until its own switch is turned on', () => {
  const on = { [SHARED_RATE_KEY]: true, statTierSize: 3 };
  assert.equal(hpRule(born(on)), 3);
  assert.equal(energyRule(born(on)), 3);
  const hpOwn = { ...on, [OWN_HP]: true, [HP_TIER]: 2 };
  assert.equal(hpRule(born(hpOwn)), 2, 'HP\'s own number wins once its switch is on');
  assert.equal(energyRule(born(hpOwn)), 3, 'and every other stat still follows');
  assert.equal(hpRule(born({ ...on, [HP_TIER]: 2 })), 3, 'a stored own number with its switch off is not used');
});

test('a profile that had moved the old every-stat number keeps what it did', () => {
  assert.equal(hpRule(born({ statTierSize: 2 })), 2, 'the general switch defaults on for it');
  const profile = { statTierSize: 2 };
  normalizeAdvancedSettings(profile, contentBundle);
  assert.equal(profile[SHARED_RATE_KEY], true, 'and boot writes it, so the run snapshot agrees');
});

test('the screen: the every-stat number and the per-stat switches are disabled while the general switch is off', () => {
  const off = {};
  assert.ok(closedGate(off, row('statTierSize')), 'every-stat number disabled');
  assert.ok(closedGate(off, row(OWN_HP)), 'per-stat switch disabled');
  assert.equal(row(OWN_HP).resolve(off), true, 'and it reads ON — the stat is using its own number');
  assert.equal(closedGate(off, row(HP_TIER)), null, 'the stat\'s own number is editable');

  const on = { [SHARED_RATE_KEY]: true };
  assert.equal(closedGate(on, row('statTierSize')), null);
  assert.equal(row(OWN_HP).resolve(on), false, 'switching the general on starts every stat off');
  const gate = closedGate({ ...on, statTierSize: 4 }, row(HP_TIER));
  assert.ok(gate, 'HP\'s own number is disabled until its switch is on');
  assert.match(gateSentence(gate, { ...on, statTierSize: 4 }), new RegExp(`Following “${EVERY_STAT_RATE_LABEL}” \\(4\\)`));
  assert.equal(closedGate({ ...on, [OWN_HP]: true }, row(HP_TIER)), null);
});

test('no stat-conversion row says "tier"; each names the attribute that drives it', () => {
  const family = rows.filter((candidate) => /derivedStatRules|statTierSize/.test(candidate.key));
  assert.ok(family.length > 10);
  for (const candidate of family) {
    assert.doesNotMatch(candidate.label, /\btier/i, candidate.label);
    if (typeof candidate.note === 'string') assert.doesNotMatch(candidate.note, /\btier/i, candidate.label);
  }
  assert.equal(row(HP_TIER).label, 'HP — Constitution points per increase');
});

test('switches file with the row they govern, directly above it', () => {
  for (const [key, section] of [[OWN_HP, 'Progression'], ['gameConfig.own.derivedStatRules.rules.draw.pointsPerTier', 'Hand & Draw'],
    ['gameConfig.own.derivedStatRules.rules.poise.pointsPerTier', 'Ratings & Resistance']]) {
    assert.equal(advancedSection(row(key)), section);
    const group = advancedSubgroups(rows, section).find((sub) => sub.rows.some((candidate) => candidate.key === key));
    const at = group.rows.findIndex((candidate) => candidate.key === key);
    assert.equal(group.rows[at + 1].key, key.replace('gameConfig.own.', 'gameConfig.'), `${key} sits above its row`);
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
  assert.ok(closedGate({ 'gameConfig.combatRatings.enabled': false }, row('gameConfig.combatRatings.multiplier')));
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
  const input = wrapper.appendChild(node('set-num', { key: HP_TIER }));
  input.value = '2';
  const settings = { [SHARED_RATE_KEY]: true, statTierSize: 4, [HP_TIER]: 2 };
  refreshGates(container, settings);
  assert.equal(input.disabled, true);
  assert.equal(input.value, '4', 'the number shown is the one in force');
  assert.match(wrapper.querySelector('.set-gate-note').textContent, /Turn on “HP — use its own Constitution points per increase”/);
  settings[OWN_HP] = true;
  refreshGates(container, settings);
  assert.equal(input.disabled, false);
  assert.equal(input.value, '2', 'the own value comes back');
  assert.equal(wrapper.querySelector('.set-gate-note').hidden, true);
});

test('every new switch is a known key, so a configuration file carrying them imports', () => {
  const file = { [SHARED_RATE_KEY]: true, [OWN_HP]: true, 'gameConfig.own.balance.rewards.rarityWeightsByClass.herald': false };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(file), contentBundle), file);
  assert.ok(advancedConfigRows(contentBundle).some((candidate) => candidate.key === SHARED_RATE_KEY));
});

// Codex, on #1260: the migration rode the item-rating guard, so a profile with
// only the old dial never had its switch written — and setting the dial back
// to 5 later would have turned the mode off in silence.
test('the shared-rate migration runs on its own and sticks when the dial returns to 5', () => {
  const profile = { statTierSize: 3 };
  assert.equal(migrateSharedRate(profile, contentBundle), true);
  assert.equal(profile[SHARED_RATE_KEY], true);
  assert.equal(migrateSharedRate(profile, contentBundle), false, 'written once');
  profile.statTierSize = 5;
  assert.equal(row('statTierSize').gates && closedGate(profile, row('statTierSize')), null, 'the mode stays on');
  assert.equal(migrateSharedRate({}, contentBundle), false, 'a default profile is left alone');
});

// Codex, on #1260: an override switch must also go dead with the subsystem
// its row belongs to.
test('an override switch is disabled while the rows it governs do nothing', () => {
  const strike = 'gameConfig.own.balance.equipment.startingDeck.classes.reaver.strikeBias';
  assert.equal(closedGate({}, row(strike)), null);
  assert.ok(closedGate({ 'gameConfig.balance.equipment.startingDeck.enabled': false }, row(strike)), 'deck rules off');
  const poise = 'gameConfig.own.derivedStatRules.rules.poise.pointsPerTier';
  const shared = { [SHARED_RATE_KEY]: true };
  assert.ok(closedGate(shared, row(poise)), 'ratings on: the derived Poise rule is not used');
  assert.equal(closedGate({ ...shared, 'gameConfig.combatRatings.enabled': false }, row(poise)), null);
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

test('a configuration file carrying the dial under its snapshot spelling agrees with the profile', () => {
  const file = { 'gameConfig.derivedStatRules.defaults.pointsPerTier': 1, [HP_TIER]: 2 };
  assert.equal(row(OWN_HP).resolve(file), false, 'the shared mode is on for it, so HP follows until switched');
  assert.equal(configuredContentBundle(contentBundle, file).derivedStatRules.rules.hp.pointsPerTier, 1,
    'and the configured bundle does not apply HP\'s stored 2 behind a switch that reads off');
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

// Codex, on #1260: character creation's preview builds a run from the
// configured registries alone, with no derivedStatOptions. The every-stat
// number is written into the configured table, so the preview and the run
// it starts agree.
test('the creation preview and the run it starts show the same stats', () => {
  const settings = { [SHARED_RATE_KEY]: true, statTierSize: 3 };
  const registries = createRegistries(configuredContentBundle(contentBundle, settings));
  const preview = createRunState({ seed: 7, classId: 'reaver', registries });
  const run = createRunState({ seed: 7, classId: 'reaver', registries, derivedStatOptions: derivedStatDialOptions(settings) });
  assert.equal(preview.maxHp, run.maxHp);
  assert.equal(hpRule(preview), 3);
  assert.equal(configuredContentBundle(contentBundle, {}).derivedStatRules.rules.hp.pointsPerTier, 1, 'switch off: the table is untouched');
});

// Codex, on #1260: the third door a profile comes in through.
test('importing a file with the older dial writes the shared switch in the same change', () => {
  const file = { 'gameConfig.derivedStatRules.defaults.pointsPerTier': 3 };
  // The settings screen hands its own rows in, which is what makes the dial's
  // snapshot spelling a known key.
  const screenRows = [settingsRow('statTierSize')];
  const changes = parseAdvancedConfigFile(advancedConfigExport(file), contentBundle, {}, screenRows);
  assert.equal(changes[SHARED_RATE_KEY], true);
  const plain = parseAdvancedConfigFile(advancedConfigExport({ [HP_TIER]: 2 }), contentBundle, {}, screenRows);
  assert.equal(Object.hasOwn(plain, SHARED_RATE_KEY), false, 'a file without the dial adds nothing');
});
