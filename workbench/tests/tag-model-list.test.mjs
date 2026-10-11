// node --test workbench/tests/tag-model-list.test.mjs — Data Studio lists the tag model
// proposal's CSVs under their own group, only when the folder is there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { listTables, TAG_MODEL_GROUP } from '../modules/data/model.mjs';

test('without the tag model folder, nothing from it is listed', () => {
  const names = listTables(['content/source/nodes.csv', 'content/framework/x.json']).map((t) => t.path);
  assert.deepEqual(names, ['content/source/nodes.csv', 'content/framework/x.json']);
  assert.equal(names.some((p) => p.startsWith('docs/')), false);
  assert.equal(listTables([]).length, 0);
});

test('with the folder present, its CSVs form a Tag model (proposal) group after Source and Framework', () => {
  const tables = listTables([
    'docs/tag-model/tables/values.csv',
    'docs/tag-model/tables/presentation/layouts.csv',
    'content/framework/x.json',
    'content/source/nodes.csv',
    'docs/tag-model/tables/tags.csv',
  ]);
  assert.equal(TAG_MODEL_GROUP, 'Tag model (proposal)');
  assert.deepEqual(tables.map((t) => [t.group, t.name, t.format]), [
    ['Source', 'nodes', 'csv'],
    ['Framework', 'x', 'json'],
    [TAG_MODEL_GROUP, 'presentation/layouts', 'csv'],
    [TAG_MODEL_GROUP, 'tags', 'csv'],
    [TAG_MODEL_GROUP, 'values', 'csv'],
  ]);
  assert.equal(tables[2].path, 'docs/tag-model/tables/presentation/layouts.csv');
});

test('a tag-model path that is not a CSV in the tables folder is not listed', () => {
  assert.deepEqual(listTables(['docs/tag-model/README.md', 'docs/tag-model/tables/values.json', 'docs/tag-model/tag-tree.txt']), []);
});
