// The owner's play, check, ship and sync commands: change wording, branch names and path rules.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DescribeFileChange } from '../tools/owner/contentDiff.mjs';
import { BranchNameFor } from '../tools/owner/shipText.mjs';
import {
    IsDerivedPath,
    IsEditableContentPath,
    IsNeverCommitPath,
    SameText,
} from '../tools/owner/ownerPaths.mjs';

const ENEMY_PATH = 'games/ashenspire/packs/core/enemies/ashGolem.json';
const CARDS_PATH = 'games/ashenspire/packs/core/cards.json';
const WEAPONS_PATH = 'content/source/weapons.csv';

function asText(value)
{
    return JSON.stringify(
        value,
        null,
        2,
    );
}

test('a raised enemy number reads as one plain subject', () =>
{
    const before = {
        id: 'ashGolem',
        name: 'Ash Golem',
        stats: {
            hp: 40,
        },
    };
    const after = {
        ...before,
        stats: {
            hp: 48,
        },
    };
    const described = DescribeFileChange(
        ENEMY_PATH,
        asText(before),
        asText(after),
    );
    assert.equal(described.subject, 'Raise Ash Golem hp 40→48');
    assert.deepEqual(described.lines, ['Raise Ash Golem hp 40→48']);
});

test('card list edits name each card by its name and its effect op', () =>
{
    const before = [
        {
            id: 'core.strike',
            name: 'Strike',
            effects: [
                {
                    op: 'damage',
                    amount: 6,
                },
            ],
        },
    ];
    const after = [
        {
            ...before[0],
            effects: [
                {
                    op: 'damage',
                    amount: 5,
                },
            ],
        },
        {
            id: 'core.jab',
            name: 'Jab',
        },
    ];
    const described = DescribeFileChange(
        CARDS_PATH,
        asText(before),
        asText(after),
    );
    assert.equal(described.subject, 'Edit 2 entries in cards');
    assert.deepEqual(described.lines, [
        'Lower Strike damage amount 6→5',
        'Add Jab',
    ]);
});

test('a list of plain values reports what was added and removed', () =>
{
    const before = {
        id: 'ashGolem',
        name: 'Ash Golem',
        deck: [
            'card:a',
            'card:b',
        ],
    };
    const after = {
        ...before,
        deck: [
            'card:a',
            'card:c',
        ],
    };
    const described = DescribeFileChange(
        ENEMY_PATH,
        asText(before),
        asText(after),
    );
    assert.equal(described.subject, 'Ash Golem deck: add card:c; remove card:b');
});

test('CSV rows are matched by id and numeric cells compare as numbers', () =>
{
    const before = 'id,name,dropWeight\nsword,Sword,10\n';
    const after = 'id,name,dropWeight\nsword,Sword,12\n';
    const described = DescribeFileChange(
        WEAPONS_PATH,
        before,
        after,
    );
    assert.equal(described.subject, 'Raise Sword dropWeight 10→12');
});

test('a new file and a long subject are handled', () =>
{
    const added = DescribeFileChange(
        CARDS_PATH,
        null,
        '[]',
    );
    assert.equal(added.subject, 'Add cards');
    const before = {
        id: 'x',
        name: 'A very long enemy name that keeps going and going',
        stats: {
            poiseMaximumWithAVeryLongFieldName: 1,
        },
    };
    const after = {
        ...before,
        stats: {
            poiseMaximumWithAVeryLongFieldName: 2,
        },
    };
    const long = DescribeFileChange(
        ENEMY_PATH,
        asText(before),
        asText(after),
    );
    assert.ok(long.subject.length <= 72);
    assert.ok(long.subject.endsWith('...'));
});

test('branch names are CamelCase under feature/Owner', () =>
{
    assert.equal(BranchNameFor('tougher ash golem!'), 'feature/OwnerTougherAshGolem');
    assert.equal(BranchNameFor(''), 'feature/OwnerContent');
});

test('path rules keep generated files and built HTML out of owner commits', () =>
{
    assert.ok(IsEditableContentPath(CARDS_PATH));
    assert.ok(IsEditableContentPath(WEAPONS_PATH));
    assert.ok(!IsEditableContentPath('games/ashenspire/game.lock.json'));
    assert.ok(!IsEditableContentPath('games/ashenspire/packs/core/enemies/_reference.json'));
    assert.ok(!IsEditableContentPath('src/content/generated/cards.js'));
    assert.ok(!IsEditableContentPath('games/ashenspire/derived/characters.json'));
    assert.ok(IsDerivedPath('games/ashenspire/derived/characters.json'));
    assert.ok(IsNeverCommitPath('buildordinal.json'));
    assert.ok(IsNeverCommitPath('dist/AshenSpire.html'));
    assert.ok(IsDerivedPath('src/content/generated/cards.js'));
    assert.ok(IsDerivedPath('games/ashenspire/game.lock.json'));
    assert.ok(!IsDerivedPath('src/engine/combat.js'));
});

test('duplicate entries are compared by position, not merged', () =>
{
    const before = {
        id: 'deck',
        name: 'Deck',
        cards: [
            {
                card: 'core.strike',
                copies: 1,
            },
        ],
    };
    const after = {
        ...before,
        cards: [
            ...before.cards,
            {
                card: 'core.strike',
                copies: 1,
            },
        ],
    };
    const described = DescribeFileChange(
        CARDS_PATH,
        asText(before),
        asText(after),
    );
    assert.equal(described.lines.length, 1);
    assert.match(described.lines[0], /^Set Deck cards core\.strike to /);
});

test('the same number written differently is a change, not a raise or lower', () =>
{
    const described = DescribeFileChange(
        WEAPONS_PATH,
        'id,name,scale\nsword,Sword,1\n',
        'id,name,scale\nsword,Sword,1.0\n',
    );
    assert.equal(described.subject, 'Change Sword scale 1→1.0');
});

test('text comparison ignores Windows line endings', () =>
{
    assert.ok(SameText('a\r\nb\r\n', 'a\nb'));
    assert.ok(!SameText('a\nb', 'a\nc'));
});
