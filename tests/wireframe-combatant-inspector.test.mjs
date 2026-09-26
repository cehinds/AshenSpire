import test from 'node:test';
import assert from 'node:assert/strict';
import { projectCombatantInspector as projectSections, INSPECTOR_SECTION_ORDER, INSPECTOR_PREVIEW_METERS, previewMeters } from '../src/ui/models/CombatantInspectorSections.js';
import { t } from '../src/ui/strings.js';

// The component passes the copy table's lookup; so does this test.
const projectCombatantInspector = (subject) => projectSections(subject, t);

test('every title and label comes from the copy table', () => {
  const view = projectSections({ name: 'X', resources: [] });
  assert.deepEqual(view.sections.map((s) => s.title), INSPECTOR_SECTION_ORDER.map((id) => `inspector.section.${id}`));
  assert.notEqual(t('inspector.empty.none'), t('inspector.empty.unknown'));
});

const enemy = {
  name: 'Blight Hound',
  resources: [{ label: 'HP', value: 12, max: 19 }, { label: 'Poise', value: 3, max: 8 }, { label: 'Block', value: 4 }],
  intent: { name: 'Bite', detail: '6 damage' },
  moveCards: [{ name: 'Bite' }, { name: 'Howl' }],
  statuses: [{ name: 'Weak', detail: '1 turn' }],
  history: [{ name: 'Howl' }, { name: 'Bite' }, { name: 'Lunge' }],
  traits: [{ name: 'Beast' }],
  lore: null,
};

test('sections follow the W1w order with lore last', () => {
  const view = projectCombatantInspector(enemy);
  assert.deepEqual(view.sections.map((s) => s.id), [...INSPECTOR_SECTION_ORDER]);
  assert.equal(view.sections.at(-1).id, 'lore');
  assert.ok(Object.isFrozen(view) && Object.isFrozen(view.sections[0].rows));
});

test('summary is HP, intent, defense; the preview carries name, HP and the pool meters', () => {
  const view = projectCombatantInspector(enemy);
  assert.deepEqual(view.sections[0].rows.map((r) => [r.label, r.value]), [['HP', '12 / 19'], ['Intent', 'Bite'], ['Defense', '4 Block']]);
  assert.deepEqual(Object.keys(view.preview), ['name', 'hp', 'meters']);
  assert.equal(view.preview.hp.max, 19);
  assert.ok(Object.isFrozen(view.preview.meters));
});

test('preview meters are HP, MP, Poise in that order, only the pools the combatant has', () => {
  const labels = (resources) => previewMeters(resources).map((r) => r.label);
  // An enemy: no MP pool at all, so no MP meter; Block is never a preview meter.
  assert.deepEqual(labels(enemy.resources), ['HP', 'Poise']);
  // A caster: every pool, arriving out of order, stacks HP, MP, Poise.
  const caster = [{ label: 'Block', value: 2 }, { label: 'Poise', value: 1, max: 6 }, { label: 'MP', value: 3, max: 5 }, { label: 'HP', value: 30, max: 40 }];
  assert.deepEqual(labels(caster), ['HP', 'MP', 'Poise']);
  // A zero-maximum pool is one the combatant does not have; an empty current is still shown.
  assert.deepEqual(labels([{ label: 'HP', value: 0, max: 40 }, { label: 'MP', value: 0, max: 0 }, { label: 'Poise', value: 0, max: 0 }]), ['HP']);
  assert.deepEqual(labels([{ label: 'HP', value: 40, max: 40 }, { label: 'MP', value: 0, max: 5 }]), ['HP', 'MP']);
  assert.deepEqual(labels([]), []);
  // The meters carry the live values through unchanged.
  const mp = previewMeters(caster).find((r) => r.label === 'MP');
  assert.deepEqual([mp.value, mp.max], [3, 5]);
  assert.deepEqual(INSPECTOR_PREVIEW_METERS, ['HP', 'MP', 'Poise', 'Ward']);
  assert.deepEqual(labels([...caster, { label: 'Ward', value: 0, max: 9 }]), ['HP', 'MP', 'Poise', 'Ward']);
});

test('current state lists active pools and effects; previous actions are newest first', () => {
  const byId = Object.fromEntries(projectCombatantInspector(enemy).sections.map((s) => [s.id, s]));
  assert.deepEqual(byId.state.rows.map((r) => r.label), ['Poise', 'Weak']);
  assert.deepEqual(byId.history.rows.map((r) => r.label), ['Lunge', 'Bite', 'Howl']);
});

test('unknown and none are distinct', () => {
  const byId = (subject) => Object.fromEntries(projectCombatantInspector(subject).sections.map((s) => [s.id, s.knowledge]));
  const unrevealed = byId({ ...enemy, history: null, traits: null, lore: null });
  assert.deepEqual([unrevealed.history, unrevealed.traits, unrevealed.lore], ['unknown', 'unknown', 'unknown']);
  const empty = byId({ ...enemy, history: [], traits: [], lore: [], statuses: [], resources: [{ label: 'HP', value: 5, max: 5 }] });
  assert.deepEqual([empty.history, empty.traits, empty.lore, empty.state], ['none', 'none', 'none', 'none']);
  assert.equal(byId({ name: 'X', resources: [] }).abilities, 'unknown');
});

test('a subject that lists effects as abilities does not repeat them in current state', () => {
  const player = { name: 'REAVER', resources: [{ label: 'HP', value: 40, max: 40 }], abilities: [{ name: 'Gorefire' }], statuses: [{ name: 'Gorefire' }] };
  const byId = Object.fromEntries(projectCombatantInspector(player).sections.map((s) => [s.id, s]));
  assert.equal(byId.state.knowledge, 'none');
  assert.deepEqual(byId.abilities.rows.map((r) => r.label), ['Gorefire']);
  assert.throws(() => projectCombatantInspector({}), /named subject/);
});
