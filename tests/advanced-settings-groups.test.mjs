import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryHandler } from '../src/ui/screens/settings.js';
import { advancedSection, advancedSubgroups } from '../src/ui/models/AdvancedSettingsGroups.js';

test('grouping keeps every Advanced option reachable exactly once', () => {
  const rows = categoryHandler('Advanced').rows;
  const sections = [...new Set(rows.map(advancedSection))];
  const grouped = sections.flatMap(section => advancedSubgroups(rows, section).flatMap(group => group.rows));
  assert.equal(grouped.length, rows.length);
  assert.equal(new Set(grouped.map(row => row.key)).size, rows.length);
  assert.deepEqual(grouped.map(row => row.key).sort(), rows.map(row => row.key).sort());
});

test('class groups contain only the selected class and keep shared controls separate', () => {
  const groups = advancedSubgroups(categoryHandler('Advanced').rows, 'Classes');
  assert.deepEqual(groups.map(group => group.id), ['General', 'Assign points', 'Reaver', 'Starseer', 'Rogue', 'Herald']);
  for (const group of groups.slice(2)) {
    assert.equal(group.rows.length, 8);
    assert.ok(group.rows.every(row => row.key.includes(`.${group.id.toLowerCase()}.`)));
  }
});
