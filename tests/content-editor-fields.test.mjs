// The content editor helpers: field paths, input parsing, templates, layout-keeping writes.
// writes. The indent and locked keys come from the editor's JSON config.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    CloneJson,
    FormatFieldInput,
    GetFieldValue,
    ParseFieldInput,
    SetFieldValue,
} from '../tools/score-studio/contentEditor/fieldPaths.js';
import { ResolveSections } from '../tools/score-studio/contentEditor/contentConfig.js';
import { TopLevelItems } from '../tools/score-studio/contentEditor/jsonScan.js';
import { FormatJsonLike } from '../tools/score-studio/contentEditor/jsonText.js';
import {
    WithLockedKeys,
    WithoutLockedKeys,
} from '../tools/score-studio/contentEditor/lockedKeys.js';
import { FillTemplate } from '../src/model/textTemplate.js';
import { EDITOR_CONFIG, UI_CONFIG } from './helpers/content-editor-config.mjs';

const JSON_INDENT = UI_CONFIG.sizes.jsonIndent;
const LOCKED = ResolveSections(EDITOR_CONFIG).find((section) => section.lockedKeys).lockedKeys;
const LOCKED_KEY = LOCKED[0];

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
        [LOCKED_KEY]: {
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
    assert.deepEqual(Object.keys(enemy), ['id', 'stats', LOCKED_KEY]);
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
    const expected = `${JSON.stringify(changed, null, JSON_INDENT)}\n`;
    assert.equal(FormatJsonLike(original, changed, JSON_INDENT), expected);
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
    const written = FormatJsonLike(original, value, JSON_INDENT);
    assert.ok(written.includes('"faceTemplate": ["One.", "Two."]'));
    assert.ok(written.includes('    "amount": 9\n'));
    assert.ok(!written.includes('\r'));
    assert.deepEqual(JSON.parse(written), value);
    const unchanged = FormatJsonLike(original, JSON.parse(original), JSON_INDENT);
    assert.equal(unchanged, original.replace(/\r\n/g, '\n'));
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
    assert.ok(FormatJsonLike(text, value, JSON_INDENT).includes('"b": { "c": "x,]}" }'));
});

test('a section takes its template keys, through a chain of extends, and its own keys win', () =>
{
    const editorConfig = {
        sectionTemplates: {
            arrayFile: {
                keyField: 'id',
                labelField: 'name',
            },
            cardFile: {
                extends: 'arrayFile',
                cardLimits: true,
                listValue: '{type}',
            },
        },
        sections: [
            {
                id: 'cards',
                extends: 'cardFile',
                listValue: '{cost}',
            },
        ],
    };
    const [cards] = ResolveSections(editorConfig);
    assert.deepEqual(cards, {
        keyField: 'id',
        labelField: 'name',
        cardLimits: true,
        listValue: '{cost}',
        id: 'cards',
    });
    const looping = {
        sectionTemplates: {
            loop: {
                extends: 'loop',
            },
        },
        sections: [
            {
                id: 'x',
                extends: 'loop',
            },
        ],
    };
    assert.throws(() => ResolveSections(looping));
});

test('list and message templates fill paths, list lengths and sums', () =>
{
    const deck = [
        {
            card: 'core.strike',
            copies: 3,
        },
        {
            card: 'core.defend',
            copies: 2,
        },
    ];
    assert.equal(FillTemplate('{sum:copies}', deck), '5');
    const levels = 'Lv {stats.levelProfile.min}-{stats.levelProfile.max}';
    assert.equal(FillTemplate(levels, huskBrute()), 'Lv 1-3');
    assert.equal(FillTemplate('{type} {cost}', { cost: 1 }), '{type} 1');
    assert.equal(FillTemplate('{type} {cost}', { cost: 1 }, { missing: '' }), ' 1');
    assert.equal(FillTemplate('{a}', { a: undefined }), 'undefined');
    assert.equal(FillTemplate('Saved {files}.', { files: 'cards.json' }), 'Saved cards.json.');
    assert.equal(FillTemplate('deck {count:deck}', { deck: ['a', 'b'] }), 'deck 2');
    assert.equal(FillTemplate('{count:name}', { name: 'x' }), '{count:name}');
});

test('the JSON view hides locked keys and an edit puts them back in place', () =>
{
    const enemy = huskBrute();
    const visible = WithoutLockedKeys(enemy, LOCKED);
    assert.deepEqual(Object.keys(visible), ['id', 'stats']);
    const edited = {
        ...visible,
        name: 'Husk Brute',
        [LOCKED_KEY]: {
            tier: 'boss',
        },
    };
    const merged = WithLockedKeys(enemy, edited, LOCKED);
    assert.deepEqual(Object.keys(merged), ['id', 'stats', LOCKED_KEY, 'name']);
    assert.deepEqual(merged[LOCKED_KEY], enemy[LOCKED_KEY]);
    assert.deepEqual(WithLockedKeys(enemy, [1, 2], LOCKED), [1, 2]);
});
