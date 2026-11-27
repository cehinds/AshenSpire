// Owner commands: change wording, branch names and path rules. Every expected string is built
// from ownerDiff.json, ownerText.json and ownerTools.json, so retuning them needs no test edit.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DescribeFileChange } from '../tools/owner/contentDiff.mjs';
import {
    FormatText,
    OWNER_DIFF,
    OWNER_TEXT,
    OWNER_TOOLS,
} from '../tools/owner/ownerConfig.mjs';
import { BranchNameFor } from '../tools/owner/shipText.mjs';
import {
    IsDerivedPath,
    IsEditableContentPath,
    IsNeverCommitPath,
    SameText,
} from '../tools/owner/ownerPaths.mjs';

const ENEMY_PATH = `${OWNER_TOOLS.editableRoots[2]}packs/core/enemies/ashGolem.json`;
const CARDS_PATH = `${OWNER_TOOLS.editableRoots[2]}packs/core/cards.json`;
const WEAPONS_PATH = `${OWNER_TOOLS.editableRoots[0]}weapons${OWNER_DIFF.csv.extension}`;
const JOIN = OWNER_DIFF.segmentJoiner;

function asText(value)
{
    return JSON.stringify(
        value,
        null,
        2,
    );
}

function expected(key, values)
{
    return FormatText(OWNER_DIFF.phrases[key], {
        arrow: OWNER_DIFF.arrow,
        ...values,
    });
}

function describeJson(path, before, after)
{
    return DescribeFileChange(
        path,
        asText(before),
        asText(after),
    );
}

function golem(stats)
{
    return {
        id: 'ashGolem',
        name: 'Ash Golem',
        stats,
    };
}

test('a raised enemy number reads as one plain subject', () =>
{
    const described = describeJson(
        ENEMY_PATH,
        golem({ hp: 40 }),
        golem({ hp: 48 }),
    );
    const line = expected('raise', {
        where: ['Ash Golem', 'hp'].join(JOIN),
        before: 40,
        after: 48,
    });
    assert.equal(described.subject, line);
    assert.deepEqual(described.lines, [line]);
});

test('card list edits name each card by its name and its effect op', () =>
{
    const strike = {
        id: 'core.strike',
        name: 'Strike',
        effects: [
            {
                op: 'damage',
                amount: 6,
            },
        ],
    };
    const weaker = {
        ...strike,
        effects: [
            {
                op: 'damage',
                amount: 5,
            },
        ],
    };
    const jab = {
        id: 'core.jab',
        name: 'Jab',
    };
    const described = describeJson(CARDS_PATH, [strike], [
        weaker,
        jab,
    ]);
    const lower = expected('lower', {
        where: ['Strike', 'damage', 'amount'].join(JOIN),
        before: 6,
        after: 5,
    });
    assert.equal(described.subject, expected('editMany', {
        count: 2,
        file: 'cards',
    }));
    assert.deepEqual(described.lines, [
        lower,
        expected('add', { where: 'Jab' }),
    ]);
});

test('a list of plain values reports what was added and removed', () =>
{
    const before = {
        ...golem({}),
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
    const parts = [
        expected('listAdd', { items: 'card:c' }),
        expected('listRemove', { items: 'card:b' }),
    ].join(OWNER_DIFF.partJoiner);
    const described = describeJson(
        ENEMY_PATH,
        before,
        after,
    );
    assert.equal(described.subject, expected('list', {
        entity: 'Ash Golem',
        field: 'deck',
        parts,
    }));
});

test('CSV rows are matched by id and numeric cells compare as numbers', () =>
{
    const described = DescribeFileChange(
        WEAPONS_PATH,
        'id,name,dropWeight\nsword,Sword,10\n',
        'id,name,dropWeight\nsword,Sword,12\n',
    );
    assert.equal(described.subject, expected('raise', {
        where: ['Sword', 'dropWeight'].join(JOIN),
        before: 10,
        after: 12,
    }));
});

test('a new file and a long subject are handled', () =>
{
    const added = DescribeFileChange(
        CARDS_PATH,
        null,
        '[]',
    );
    assert.equal(added.subject, expected('add', { where: 'cards' }));
    const longName = 'x'.repeat(OWNER_DIFF.subjectLimit);
    const long = describeJson(
        ENEMY_PATH,
        golem({ [longName]: 1 }),
        golem({ [longName]: 2 }),
    );
    assert.ok(long.subject.length <= OWNER_DIFF.subjectLimit);
    assert.ok(long.subject.endsWith(OWNER_DIFF.ellipsis));
});

test('branch names are CamelCase under the configured prefix', () =>
{
    const prefix = OWNER_TOOLS.git.branchPrefix;
    assert.equal(BranchNameFor('tougher ash golem!'), `${prefix}TougherAshGolem`);
    assert.equal(BranchNameFor(''), `${prefix}${OWNER_TEXT.branch.defaultTitleWord}`);
});

test('path rules follow ownerTools.json', () =>
{
    const generatedFolder = OWNER_TOOLS.generatedFolders[0];
    OWNER_TOOLS.editableRoots.forEach((root) =>
    {
        assert.ok(IsEditableContentPath(`${root}example.json`));
    });
    OWNER_TOOLS.generatedNames.forEach((name) =>
    {
        assert.ok(!IsEditableContentPath(`${OWNER_TOOLS.editableRoots[2]}${name}`));
    });
    assert.ok(!IsEditableContentPath(`${generatedFolder}characters.json`));
    assert.ok(IsDerivedPath(`${generatedFolder}characters.json`));
    OWNER_TOOLS.neverCommit.forEach((rule) => assert.ok(IsNeverCommitPath(`dist/x${rule}`)));
    OWNER_TOOLS.generatedLocations.forEach((location) => assert.ok(IsDerivedPath(location)));
    assert.ok(!IsDerivedPath('src/engine/combat.js'));
});

test('duplicate entries are compared by position, not merged', () =>
{
    const strike = {
        card: 'core.strike',
        copies: 1,
    };
    const before = {
        id: 'deck',
        name: 'Deck',
        cards: [strike],
    };
    const after = {
        ...before,
        cards: [
            strike,
            strike,
        ],
    };
    const described = describeJson(
        CARDS_PATH,
        before,
        after,
    );
    const prefix = expected('set', {
        where: ['Deck', 'cards', 'core.strike'].join(JOIN),
        after: '',
    });
    assert.equal(described.lines.length, 1);
    assert.ok(described.lines[0].startsWith(prefix));
});

test('the same number written differently is a change, not a raise or lower', () =>
{
    const described = DescribeFileChange(
        WEAPONS_PATH,
        'id,name,scale\nsword,Sword,1\n',
        'id,name,scale\nsword,Sword,1.0\n',
    );
    assert.equal(described.subject, expected('change', {
        where: ['Sword', 'scale'].join(JOIN),
        before: '1',
        after: '1.0',
    }));
});

test('text comparison ignores Windows line endings', () =>
{
    assert.ok(SameText('a\r\nb\r\n', 'a\nb'));
    assert.ok(!SameText('a\nb', 'a\nc'));
});
