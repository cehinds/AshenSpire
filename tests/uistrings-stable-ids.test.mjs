// tests/uistrings-stable-ids.test.mjs — a reworded label is copy, never identity.
//
// Moving the interface's sentences into content/source/uiStrings.csv (#1489)
// made every label something a content editor can reword without touching
// code. Two places had been using a label as an id: the Wireframes topics
// (persisted as `settingsAdvancedSubgroup.Wireframes`, and the key
// `advancedSubgroups` groups by) and the lore typefaces (persisted as
// `loreFace`). Codex caught both on #1489. This file rewords the rows BEFORE
// the models load, exactly as an edited CSV would, and checks that what a
// profile stores does not move, and that two rows reworded to the same text
// stay two topics and two faces.
//
// Its own file because the rewording has to happen before any module calls
// t(); node --test runs each file in its own process, so nothing else sees it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { uiStrings } from '../src/content/generated/uiStrings.js';

const reword = (id, short) => {
  const row = uiStrings.find((entry) => entry.id === id);
  assert.ok(row, `no uiStrings row '${id}'`);
  row.short = short;
};
// Two families given one label, and the default face and two others reworded
// (two of them to the same text).
reword('wireframe.group.Modals', 'Windows & menus');
reword('wireframe.group.Menus', 'Windows & menus');
reword('lore.face.fell', 'Fell Type (reworded)');
reword('lore.face.cinzel', 'Display capitals');
reword('lore.face.inter', 'Display capitals');

const { WIREFRAME_CHOICE_GROUPS } = await import('../src/ui/models/WireframeChoiceModel.js');
const { advancedSubgroups } = await import('../src/ui/models/AdvancedSettingsGroups.js');
const { categoryHandler, storedAdvancedTopic, rowModified } = await import('../src/ui/screens/settings.js');
const { LORE_FACES, LORE_TYPE_DEFAULTS, resolveLoreType } = await import('../src/ui/models/LoreTypeModel.js');

test('the rewording took: the models read the edited rows', () => {
  assert.deepEqual(WIREFRAME_CHOICE_GROUPS.map((group) => group.label), ['Windows & menus', 'Windows & menus', 'Scenes']);
  assert.equal(LORE_FACES.find((face) => face.id === 'fell').label, 'Fell Type (reworded)');
});

test('Wireframes topics are filed and persisted by group id, labelled by the row', () => {
  const rows = categoryHandler('Advanced').rows.filter((row) => row.wireframeTopic);
  for (const row of rows) {
    const group = WIREFRAME_CHOICE_GROUPS.find((entry) => entry.choices.some((choice) => choice.key === row.key));
    assert.equal(row.wireframeTopic, group.id, `${row.key} is filed under the label, not the id`);
  }
  const groups = advancedSubgroups(categoryHandler('Advanced').rows, 'Wireframes');
  const families = groups.slice(0, WIREFRAME_CHOICE_GROUPS.length);
  // The ids a profile stores are the ones dev always stored: Modals, Menus, Scenes.
  assert.deepEqual(families.map((group) => group.id), ['Modals', 'Menus', 'Scenes']);
  assert.deepEqual(families.map((group) => group.label), ['Windows & menus', 'Windows & menus', 'Scenes']);
  // Two identical labels are still two topics, each with its own rows.
  assert.deepEqual(families.map((group) => group.rows.map((row) => row.key)),
    WIREFRAME_CHOICE_GROUPS.map((group) => group.choices.map((choice) => choice.key)));
  assert.equal(groups.filter((group) => group.label === 'Windows & menus').length, 2);
  // A profile left on Menus before the rewording reopens on Menus.
  const stored = storedAdvancedTopic({ 'settingsAdvancedSubgroup.Wireframes': 'Menus' }, 'Wireframes');
  assert.ok(groups.some((group) => group.id === stored), 'the stored topic no longer names a topic');
});

test('lore faces are stored and defaulted by id, so a reworded label moves nothing', () => {
  assert.equal(LORE_TYPE_DEFAULTS.loreFace, 'fell');
  assert.ok(LORE_FACES.some((face) => face.id === LORE_TYPE_DEFAULTS.loreFace), 'the default names no face');
  // A profile with no explicit choice: this threw while the default was a label.
  assert.equal(resolveLoreType({}).face, 'fell');
  assert.equal(resolveLoreType({ loreFace: 'garamond' }).face, 'garamond');
  // Two faces reworded to the same text stay two faces.
  assert.equal(resolveLoreType({ loreFace: 'cinzel' }).face, 'cinzel');
  assert.equal(resolveLoreType({ loreFace: 'inter' }).face, 'inter');
  // A label is not an id: the reworded text resolves to the default, not a face.
  assert.equal(resolveLoreType({ loreFace: 'Display capitals' }).face, 'fell');
});

test('a profile saved by dev (which stored the face label) keeps its face after the rewording', () => {
  // dev's LoreTypeModel stored these literal labels as `loreFace`.
  assert.equal(resolveLoreType({ loreFace: 'IM Fell English' }).face, 'fell');
  assert.equal(resolveLoreType({ loreFace: 'EB Garamond' }).face, 'garamond');
  assert.equal(resolveLoreType({ loreFace: 'Inter' }).face, 'inter');
});

test('the Typeface row offers ids, shows the reworded labels, and reads dev-era labels', () => {
  const row = categoryHandler('Advanced').rows.find((entry) => entry.key === 'loreFace');
  assert.deepEqual(row.choices, LORE_FACES.map((face) => face.id));
  assert.ok(row.choices.includes(row.def));
  assert.equal(row.choiceLabels.fell, 'Fell Type (reworded)');
  assert.equal(row.choiceLabels.inter, 'Display capitals');
  assert.equal(row.legacyChoices['EB Garamond'], 'garamond');
});

test('a dev-era stored face label counts as modified only when it names a face other than the default', () => {
  // Codex, #1489: rowModified compared the raw stored label to the id default,
  // so a profile still on dev's default ('IM Fell English') showed Reset and
  // appeared in the Changed view although nothing had changed.
  const row = categoryHandler('Advanced').rows.find((entry) => entry.key === 'loreFace');
  assert.equal(rowModified({ loreFace: 'IM Fell English' }, row, {}), false, 'the dev-era default label reads as modified');
  assert.equal(rowModified({ loreFace: 'fell' }, row, {}), false);
  assert.equal(rowModified({ loreFace: 'EB Garamond' }, row, {}), true, 'a dev-era non-default label reads as unchanged');
  assert.equal(rowModified({ loreFace: 'garamond' }, row, {}), true);
});
