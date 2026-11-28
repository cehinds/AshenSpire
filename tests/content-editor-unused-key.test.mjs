// Adding map rows twice before renaming them gives each a fresh key, keeping entered values.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UnusedKey } from '../tools/score-studio/contentEditor/unusedKey.js';
import { UI_CONFIG } from './helpers/content-editor-config.mjs';

const BASE = UI_CONFIG.newMapKey;

test('each added row gets a key no other row uses, and entered values are kept', () =>
{
    const odds = {
        fight: 70,
    };
    odds[UnusedKey(odds, BASE)] = 5;
    odds[UnusedKey(odds, BASE)] = '';
    odds[UnusedKey(odds, BASE)] = '';
    const keys = Object.keys(odds);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(keys.length, 4);
    assert.equal(odds[BASE], 5);
    assert.equal(UnusedKey({}, BASE), BASE);
});
