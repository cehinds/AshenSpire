// The Score Studio content editor's pure helpers.
// Field paths, input parsing and writes that keep a file's layout.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    CloneJson,
    FormatFieldInput,
    GetFieldValue,
    ParseFieldInput,
    SetFieldValue,
} from '../tools/score-studio/contentEditor/fieldPaths.js';
import { FormatJsonLike, TopLevelItems } from '../tools/score-studio/contentEditor/jsonText.js';

function huskBrute()
{
    return {
        id: 'huskBrute',
        stats: {
            levelProfile: {
                min: 1,
                max: 3,
            },
            poiseMax: 5,
        },
        derived: {
            tier: 'minion',
        },
    };
}

test('a dot path reads nested values, the entry itself, and missing parts', () =>
{
    const enemy = huskBrute();
    assert.equal(GetFieldValue(enemy, 'stats.levelProfile.max'), 3);
    assert.equal(GetFieldValue(enemy, ''), enemy);
    assert.equal(GetFieldValue(enemy, 'stats.hp'), undefined);
    assert.equal(GetFieldValue(enemy, 'stats.poiseMax.deeper'), undefined);
});

test('setting an existing field keeps every key in its place', () =>
{
    const enemy = SetFieldValue(huskBrute(), 'stats.poiseMax', 6);
    assert.deepEqual(Object.keys(enemy), ['id', 'stats', 'derived']);
    assert.deepEqual(Object.keys(enemy.stats), ['levelProfile', 'poiseMax']);
    assert.equal(enemy.stats.poiseMax, 6);
});

test('a new field goes last and undefined removes it again', () =>
{
    const enemy = SetFieldValue(huskBrute(), 'stats.hp', 40);
    assert.deepEqual(Object.keys(enemy.stats), ['levelProfile', 'poiseMax', 'hp']);
    SetFieldValue(enemy, 'stats.hp', undefined);
    assert.deepEqual(enemy, huskBrute());
});

test('missing parents are created for a value but not for a removal', () =>
{
    const card = SetFieldValue({ id: 'core.x' }, 'upgrade.cost', 0);
    const expected = {
        id: 'core.x',
        upgrade: {
            cost: 0,
        },
    };
    assert.deepEqual(card, expected);
    assert.deepEqual(SetFieldValue({ id: 'core.x' }, 'upgrade.cost', undefined), { id: 'core.x' });
    assert.throws(() => SetFieldValue({}, '', 1));
});

test('input text becomes a number, text or nothing', () =>
{
    assert.equal(ParseFieldInput('number', ' 7 '), 7);
    assert.equal(ParseFieldInput('number', '0.15'), 0.15);
    assert.equal(ParseFieldInput('number', ''), undefined);
    assert.equal(ParseFieldInput('number', 'seven'), undefined);
    assert.equal(ParseFieldInput('text', 'Strike'), 'Strike');
    assert.equal(ParseFieldInput('text', '   '), undefined);
    assert.equal(FormatFieldInput(undefined), '');
    assert.equal(FormatFieldInput(0), '0');
});

test('a clone is deep and leaves the original alone', () =>
{
    const enemy = huskBrute();
    const copy = CloneJson(enemy);
    copy.stats.levelProfile.min = 2;
    assert.equal(enemy.stats.levelProfile.min, 1);
});

test('a file already in standard layout is written in standard layout', () =>
{
    const value = {
        maxBranches: 3,
        restFloors: [1, 6],
    };
    const original = `${JSON.stringify(value, null, 2)}\n`;
    const changed = {
        ...value,
        maxBranches: 4,
    };
    assert.equal(FormatJsonLike(original, changed), `${JSON.stringify(changed, null, 2)}\n`);
});

test('unchanged items keep their own compact layout when one item changes', () =>
{
    const original = [
        '[',
        '  {',
        '    "id": "a",',
        '    "faceTemplate": ["One.", "Two."]',
        '  },',
        '  {',
        '    "id": "b",',
        '    "amount": 6',
        '  }',
        ']',
        '',
    ].join('\r\n');
    const value = JSON.parse(original);
    value[1].amount = 9;
    const written = FormatJsonLike(original, value);
    assert.ok(written.includes('"faceTemplate": ["One.", "Two."]'));
    assert.ok(written.includes('    "amount": 9\n'));
    assert.ok(!written.includes('\r'));
    assert.deepEqual(JSON.parse(written), value);
    assert.equal(FormatJsonLike(original, JSON.parse(original)), original.replace(/\r\n/g, '\n'));
});

test('top-level members of an object are found with their raw text', () =>
{
    const text = '{\n  "a": [1, 2],\n  "b": { "c": "x,]}" }\n}\n';
    const { isArray, items } = TopLevelItems(text);
    assert.equal(isArray, false);
    assert.deepEqual(items.map((item) => [item.key, item.raw]), [
        ['a', '[1, 2]'],
        ['b', '{ "c": "x,]}" }'],
    ]);
    const value = JSON.parse(text);
    value.a.push(3);
    assert.ok(FormatJsonLike(text, value).includes('"b": { "c": "x,]}" }'));
});
