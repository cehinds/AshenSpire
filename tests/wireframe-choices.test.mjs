// tests/wireframe-choices.test.mjs — Settings → Advanced → Wireframes.
//
// The owner asked (2026-09-20) to "customize the wireframe choices for modals
// and menus and scenes … as one of the advanced settings with subsettings",
// with a drop down per group. What is checked here is the part that can be
// checked without a browser: the catalogue, the six resolvers the components
// call, the rows the tab draws, and the words that carry a choice from the
// settings bag to the root element and back.
//
// THE LOAD-BEARING CLAIM IS 'auto'. Every choice starts on it, and every
// resolver returns its authored argument unchanged when it is in force, so a
// player who never opens this tab sees precisely the build that shipped before
// it existed. Each resolver below is asserted against that first.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AS_DESIGNED, WIREFRAME_CHOICE_GROUPS, WIREFRAME_CHOICES, WIREFRAME_CHOICE_KEYS,
  wireframeChoice, wireframeChoices, wireframeChoiceSpec,
  resolveModalRung, resolveFooterSize, resolveCategoryNavMode, resolveWorkspaceSpec, resolveSceneConfig,
} from '../src/ui/models/WireframeChoiceModel.js';
import { MODAL_SIZES, BUTTON_ROW_SIZES, restampModalWireframes } from '../src/ui/components/modalShell.js';
import { CATEGORY_NAV_MODES } from '../src/ui/models/CategoryNavModel.js';
import { workspaceFrameVars } from '../src/ui/models/WorkspaceModel.js';
import { sceneLayers } from '../src/ui/models/SceneLayerModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';
import { applyWireframeChoices, activeWireframeChoice, activeWireframeChoices } from '../src/ui/wireframeChoices.js';
import { categoryHandler } from '../src/ui/screens/settings.js';
import { advancedSection, advancedSubgroups } from '../src/ui/models/AdvancedSettingsGroups.js';

const scene = { id: 'test', box: [0, 0, 1600, 900], floorStart: 0.6 };

test('the catalogue: three families, every choice a drop down that starts as designed', () => {
  assert.deepEqual(WIREFRAME_CHOICE_GROUPS.map((group) => group.id), ['Modals', 'Menus', 'Scenes']);
  assert.ok(Object.isFrozen(WIREFRAME_CHOICE_GROUPS));
  assert.equal(new Set(WIREFRAME_CHOICE_KEYS).size, WIREFRAME_CHOICE_KEYS.length, 'no key twice');
  for (const choice of WIREFRAME_CHOICES) {
    assert.equal(choice.def, AS_DESIGNED, `${choice.key} starts as designed`);
    assert.equal(choice.options[0].id, AS_DESIGNED, `${choice.key} offers it first`);
    assert.ok(choice.options.length >= 2, `${choice.key} offers a real alternative`);
    assert.equal(new Set(choice.options.map((entry) => entry.id)).size, choice.options.length);
    for (const entry of choice.options) assert.ok(entry.label && entry.label !== entry.id, `${choice.key}/${entry.id} is worded`);
    assert.ok(choice.note && choice.note.length > 40, `${choice.key} says what it does`);
  }
});

test('a stored word outside the options is the default, and an unknown key is a mistake', () => {
  assert.equal(wireframeChoice({}, 'wireframeModalWidth'), AS_DESIGNED);
  assert.equal(wireframeChoice(undefined, 'wireframeModalWidth'), AS_DESIGNED);
  assert.equal(wireframeChoice({ wireframeModalWidth: 'enormous' }, 'wireframeModalWidth'), AS_DESIGNED);
  assert.equal(wireframeChoice({ wireframeModalWidth: 'wide' }, 'wireframeModalWidth'), 'wide');
  assert.throws(() => wireframeChoiceSpec('wireframeModalHeight'), /Unknown wireframe choice/);
  assert.deepEqual(Object.keys(wireframeChoices({})), [...WIREFRAME_CHOICE_KEYS]);
});

test('modal width steps one rung and stops at both ends', () => {
  for (const rung of MODAL_SIZES) assert.equal(resolveModalRung(rung, AS_DESIGNED, MODAL_SIZES), rung);
  assert.equal(resolveModalRung('md', 'narrow', MODAL_SIZES), 'sm');
  assert.equal(resolveModalRung('md', 'wide', MODAL_SIZES), 'lg');
  assert.equal(resolveModalRung('sm', 'narrow', MODAL_SIZES), 'sm', 'narrower than the narrowest is the narrowest');
  assert.equal(resolveModalRung('xl', 'wide', MODAL_SIZES), 'xl', 'and it never wraps round to sm');
  assert.throws(() => resolveModalRung('huge', 'wide', MODAL_SIZES), /Unknown modal size/);
});

test('the footer step is the caller’s until a choice names one', () => {
  assert.equal(resolveFooterSize('short', AS_DESIGNED, BUTTON_ROW_SIZES), 'short');
  assert.equal(resolveFooterSize('short', 'nonsense', BUTTON_ROW_SIZES), 'short');
  for (const size of BUTTON_ROW_SIZES) assert.equal(resolveFooterSize('short', size, BUTTON_ROW_SIZES), size);
});

test('the category navigation: the model measures, the player may overrule', () => {
  for (const planned of CATEGORY_NAV_MODES) {
    assert.equal(resolveCategoryNavMode(planned, AS_DESIGNED), planned);
    for (const wanted of CATEGORY_NAV_MODES) assert.equal(resolveCategoryNavMode(planned, wanted), wanted);
  }
  assert.equal(resolveCategoryNavMode('rail', 'accordion'), 'rail', 'rule 11: never a third shape');
});

test('every workspace frame the choices can ask for is one workspaceFrameVars accepts', () => {
  const authored = wireframeUi.workspace;
  assert.equal(resolveWorkspaceSpec(authored, AS_DESIGNED).frameWidth, authored.frameWidth);
  const full = resolveWorkspaceSpec(authored, 'full');
  assert.deepEqual([full.frameWidth, full.frameHeight], [1, 1]);
  const inset = resolveWorkspaceSpec(authored, 'inset');
  assert.ok(inset.frameWidth < authored.frameWidth && inset.frameHeight < authored.frameHeight);
  for (const option of wireframeChoiceSpec('wireframeMenuFrame').options) {
    const spec = resolveWorkspaceSpec(authored, option.id);
    assert.doesNotThrow(() => workspaceFrameVars(spec), `${option.id} stays inside (0, 1]`);
    assert.equal(spec.railWidth, authored.railWidth, `${option.id} leaves the rail share alone`);
  }
});

test('the scene switches move WGS6 and WGS7 and nothing else', () => {
  // The dialogue hands the fitter its own floor fraction; an answer about the
  // skyline must not quietly replace it with combat's.
  const dialogue = { ...wireframeUi.scene, floorFraction: 0.42 };
  assert.deepEqual(resolveSceneConfig(dialogue, wireframeChoices({})), { ...dialogue });
  const off = resolveSceneConfig(dialogue, { wireframeSceneSkyline: 'off', wireframeSceneFloor: 'off' });
  assert.deepEqual(off, { ...dialogue, skyline: false, floor: false });
  assert.equal(off.floorFraction, 0.42);
  const on = resolveSceneConfig({ ...dialogue, skyline: false, floor: false }, { wireframeSceneSkyline: 'on', wireframeSceneFloor: 'on' });
  assert.deepEqual([on.skyline, on.floor], [true, true]);

  // And the fitter reads them: no skyline is a hidden plate, no floor band is a
  // plain cover crop rather than a ground-line alignment.
  const plain = sceneLayers({ width: 390, height: 450, scene, config: off });
  assert.equal(plain.skyline.visible, false);
  assert.equal(plain.aligned, false);
  const drawn = sceneLayers({ width: 390, height: 450, scene, config: resolveSceneConfig(wireframeUi.scene, wireframeChoices({})) });
  assert.deepEqual(drawn, sceneLayers({ width: 390, height: 450, scene }), 'as designed is the shipped crop, exactly');
});

test('the Wireframes tab: one drop-down row per choice, filed under its family', () => {
  const rows = categoryHandler('Advanced').rows.filter((row) => row.advancedGroup === 'Wireframes');
  assert.deepEqual(rows.map((row) => row.key), [...WIREFRAME_CHOICE_KEYS], 'derived from the catalogue, in its order');
  for (const row of rows) {
    const spec = wireframeChoiceSpec(row.key);
    assert.equal(advancedSection(row), 'Wireframes');
    assert.equal(row.type, 'choice');
    assert.equal(row.dropdown, true, 'the owner asked for drop downs, including under four options');
    assert.equal(row.def, spec.def);
    assert.deepEqual(row.choices, spec.options.map((entry) => entry.id));
    assert.deepEqual(Object.values(row.choiceLabels), spec.options.map((entry) => entry.label));
    assert.equal(row.label, spec.label);
  }
  const groups = advancedSubgroups(categoryHandler('Advanced').rows, 'Wireframes');
  assert.deepEqual(groups.map((group) => group.id), WIREFRAME_CHOICE_GROUPS.map((group) => group.label));
  assert.deepEqual(groups.map((group) => group.rows.map((row) => row.key)),
    WIREFRAME_CHOICE_GROUPS.map((group) => group.choices.map((choice) => choice.key)));
});

// ---- the words on the root, and the doors already open ---------------------

const stubElement = (className = '', dataset = {}) => ({ className, dataset });
const stubDocument = (nodes) => ({
  documentElement: stubElement('', {}),
  querySelectorAll(selector) {
    const [, cls, attr] = selector.match(/^\.([\w-]+)\[data-([\w-]+)\]$/);
    const key = attr.replace(/-(.)/g, (_, c) => c.toUpperCase());
    return nodes.filter((node) => String(node.className).split(/\s+/).includes(cls) && key in node.dataset);
  },
});

test('a choice reaches the page as one word per key, and a rotted one lands on auto', () => {
  const root = stubElement();
  applyWireframeChoices({ wireframeModalWidth: 'wide', wireframeSceneSkyline: 'nonsense' }, root);
  assert.equal(root.dataset.wireframeModalWidth, 'wide');
  assert.equal(root.dataset.wireframeSceneSkyline, AS_DESIGNED);
  assert.equal(activeWireframeChoice('wireframeModalWidth', root), 'wide');
  assert.deepEqual(activeWireframeChoices(root), wireframeChoices({ wireframeModalWidth: 'wide' }));
  applyWireframeChoices({}, root);
  for (const key of WIREFRAME_CHOICE_KEYS) assert.equal(root.dataset[key], AS_DESIGNED, `${key} went back`);
});

test('doors already open take the new answer, from what they asked for, however often it changes', () => {
  const panel = stubElement('modal settings-modal', { authoredSize: 'lg', size: 'lg' });
  const foot = stubElement('modal-foot-actions modal-btnrow', { authoredSize: 'short', size: 'short' });
  const doc = stubDocument([panel, foot]);

  applyWireframeChoices({ wireframeModalWidth: 'wide', wireframeModalFooter: 'fill' }, doc.documentElement);
  assert.equal(restampModalWireframes(doc), 2);
  assert.deepEqual([panel.dataset.size, foot.dataset.size], ['xl', 'fill']);

  // Twice in a row is the same answer, not a second step: the AUTHORED rung is
  // what is re-resolved, so the door cannot walk off the end of the ladder.
  restampModalWireframes(doc);
  assert.equal(panel.dataset.size, 'xl');

  applyWireframeChoices({ wireframeModalWidth: 'narrow' }, doc.documentElement);
  restampModalWireframes(doc);
  assert.deepEqual([panel.dataset.size, foot.dataset.size], ['md', 'short'], 'and back down from lg, not from xl');

  applyWireframeChoices({}, doc.documentElement);
  restampModalWireframes(doc);
  assert.deepEqual([panel.dataset.size, foot.dataset.size], ['lg', 'short'], 'as designed restores exactly what the door asked for');
});
