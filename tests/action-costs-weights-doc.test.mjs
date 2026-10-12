// docs/alternative-combat-rounds/COST-WEIGHTS.md and src/content/actionCosts.js agree (SPEC §4.3a): every tag weight and
// side, every range, every status weight and every tunable the doc prints is the shipped one, and the doc lists every
// combat tag of the tag model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COST_BUDGET, COST_TAGS, RANGE_TAGS, RANGE_WEIGHTS, STATUS_STACK_CAP, STATUS_WEIGHT, STATUS_WEIGHTS } from '../src/content/actionCosts.js';
import { statuses } from '../src/content/statuses.js';
import { tagsAllowedFor } from '../src/content/tags.js';

const doc = readFileSync(fileURLToPath(new URL('../docs/alternative-combat-rounds/COST-WEIGHTS.md', import.meta.url)), 'utf8');
const section = (title) => {
  const start = doc.indexOf(`\n## ${title}\n`);
  assert.ok(start >= 0, `the doc has a "${title}" section`);
  const end = doc.indexOf('\n## ', start + 4);
  return doc.slice(start, end < 0 ? undefined : end);
};
// Table rows whose first cell is a `code` name: [name, ...other cells].
const rows = (text) => text.split('\n')
  .map((line) => line.match(/^\| `([^`]+)` \|(.*)\|$/))
  .filter(Boolean)
  .map(([, name, rest]) => [name, ...rest.split('|').map((cell) => cell.trim())]);
const subsection = (text, title) => {
  const start = text.indexOf(`\n### ${title}\n`);
  assert.ok(start >= 0, `the doc has a "${title}" table`);
  const end = text.indexOf('\n### ', start + 5);
  return text.slice(start, end < 0 ? undefined : end);
};

const COMBAT_DOMAINS = ['damageType', 'delivery', 'reach', 'maneuver', 'camp', 'attackSource', 'counterMode', 'targeting', 'school', 'technique', 'trait', 'lifecycle', 'card'];

test('every tag weight and side in the doc is the shipped one, and every weighted tag is in the doc once', () => {
  const tagText = section('Tag weights');
  // The weight tables: every table but Range and Statuses, which have their own columns.
  const weightText = tagText.replace(subsection(tagText, 'Range'), '\n').replace(subsection(tagText, 'Statuses'), '\n');
  const seen = new Map();
  for (const [name, ...cells] of rows(weightText)) {
    assert.ok(!seen.has(name), `${name} is listed once`);
    seen.set(name, cells);
    assert.ok(COST_TAGS[name], `${name} is in the doc but not in COST_TAGS`);
    assert.equal(Number(cells[0]), COST_TAGS[name].weight, `${name}: weight`);
    assert.equal(cells[1], COST_TAGS[name].side.toUpperCase(), `${name}: side`);
    assert.ok(cells[2].length > 0, `${name}: a reason`);
  }
  for (const tag of Object.keys(COST_TAGS)) assert.ok(seen.has(tag), `${tag} is in COST_TAGS but not in the doc`);
  for (const group of ['Damage types', 'Maneuvers and counter modes', 'Magic schools', 'Keywords', 'Drawbacks', 'Range', 'Statuses']) subsection(tagText, group);
});

test('the range table is the shipped range weights', () => {
  const table = rows(subsection(section('Tag weights'), 'Range'));
  assert.deepEqual(table.map(([tag]) => tag).sort(), Object.keys(RANGE_TAGS).sort());
  for (const [tag, range, weight, side] of table) {
    assert.equal(range, RANGE_TAGS[tag], tag);
    assert.equal(Number(weight), RANGE_WEIGHTS[range], tag);
    assert.equal(side, 'SP', tag);
  }
  assert.deepEqual({ ...RANGE_WEIGHTS }, { melee: 1, reach: 2, ranged: 3 }, 'the owner\'s range weights');
});

test('the status table lists every status at its shipped weight', () => {
  const table = rows(subsection(section('Tag weights'), 'Statuses'));
  assert.deepEqual(table.map(([id]) => id).sort(), statuses.map((s) => s.id).sort());
  for (const [id, weight] of table) {
    assert.equal(Number(weight), STATUS_WEIGHTS[id] ?? STATUS_WEIGHT, id);
    assert.ok(Number(weight) >= 2, `${id}: a status weighs 2 or more (owner)`);
  }
});

test('the tunables table is the shipped budget', () => {
  const shipped = { ...COST_BUDGET, statusWeight: STATUS_WEIGHT, statusStackCap: STATUS_STACK_CAP };
  const table = rows(section('Tunables'));
  assert.deepEqual(table.map(([name]) => name).sort(), Object.keys(shipped).sort());
  for (const [name, value] of table) {
    const expected = shipped[name];
    if (Array.isArray(expected)) assert.deepEqual(value.split(',').map((v) => Number(v.trim())), [...expected], name);
    else assert.equal(Number(value), expected, name);
  }
});

test('every combat tag of the tag model is priced (a weight, or a range)', () => {
  const combat = tagsAllowedFor('card').filter((t) => COMBAT_DOMAINS.includes(t.domain) && !t.id.startsWith('ability:'));
  assert.ok(combat.length > 50, 'fixture: the tag model holds the combat tags');
  for (const tag of combat) assert.ok(COST_TAGS[tag.id] || RANGE_TAGS[tag.id], `${tag.domain} tag ${tag.id} has no cost weight`);
});
