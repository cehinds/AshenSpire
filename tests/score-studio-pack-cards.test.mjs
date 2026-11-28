// The card half of a Studio Save: merge by id into the game's card file, refuse ids outside
// its namespaces, and put the build outputs back when a rebuild step fails.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MergedPackCardsText,
  PackCardDataProblem,
  PackCardsBuildSteps,
  RebuildFromPackCards,
} from '../tools/score-studio-pack-cards.mjs';
import { StudioPackCardsPath } from '../tools/score-studio/studioSaveFiles.js';

const textEncoding = 'utf8';
const jsonIndent = 2;
const tempPrefix = 'ashen-pack-cards-';
const strikeId = 'core.strike';
const newId = 'custom.qaPackCard';
const subclassId = 'subclass.qa.card';
const generatedFile = 'src/content/generated/qa.js';
const strayGeneratedFile = 'src/content/generated/stray.js';
const lockFile = 'games/ashenspire/game.lock.json';
const packPath = fileURLToPath(new URL(`../${StudioPackCardsPath}`, import.meta.url));
const packText = readFileSync(packPath, textEncoding);
const packCards = JSON.parse(packText);

// A card as it sits in the file: one array level deep.
function cardText(card)
{
  const indent = ' '.repeat(jsonIndent);
  return JSON.stringify(card, null, jsonIndent).replace(/^/gm, indent);
}

function emptyChange(id)
{
  return {
    id,
    set: {},
    unset: [],
  };
}

test('pack cards: a merge changes the edited card only; every other card keeps its bytes', () =>
{
  const removedId = packCards.at(-1).id;
  const data = {
    cards: [
      {
        ...emptyChange(strikeId),
        set: {
          name: 'QA Strike',
        },
        unset: ['flavor'],
      },
      {
        ...emptyChange(newId),
        set: {
          name: 'QA Pack Card',
          type: 'skill',
        },
      },
    ],
    removedCardIds: [removedId],
  };
  const merged = JSON.parse(MergedPackCardsText(packText, data));
  const strike = merged.find((card) => card.id === strikeId);
  const original = packCards.find((card) => card.id === strikeId);
  assert.equal(strike.name, 'QA Strike');
  assert.equal('flavor' in strike, false);
  const keptOrder = Object.keys(original).filter((key) => key !== 'flavor');
  assert.deepEqual(Object.keys(strike), keptOrder, 'key order is kept');
  assert.deepEqual(merged.at(-1), {
    id: newId,
    name: 'QA Pack Card',
    type: 'skill',
  });
  assert.equal(merged.some((card) => card.id === removedId), false);
  const untouched = packCards.filter((card) => card.id !== strikeId && card.id !== removedId);
  const mergedText = MergedPackCardsText(packText, data);
  for (const card of untouched)
  {
    assert.ok(mergedText.includes(cardText(card)), `${card.id} keeps its bytes`);
  }
});

test('pack cards: no change gives back the same bytes', () =>
{
  const data = {
    cards: [],
    removedCardIds: [],
  };
  assert.equal(MergedPackCardsText(packText, data), packText);
});

test('pack cards: ids outside core. and custom., private keys and bad shapes are refused', () =>
{
  const problems = [
    {
      cards: [emptyChange(subclassId)],
      removedCardIds: [],
    },
    {
      cards: [],
      removedCardIds: [subclassId],
    },
    {
      cards: [{
        ...emptyChange(strikeId),
        set: {
          _edited: true,
        },
      }],
      removedCardIds: [],
    },
    {
      cards: [{
        ...emptyChange(strikeId),
        set: {
          id: newId,
        },
      }],
      removedCardIds: [],
    },
    {
      cards: [{
        id: strikeId,
        name: 'whole card',
      }],
      removedCardIds: [],
    },
    {
      cards: [emptyChange(strikeId), emptyChange(strikeId)],
      removedCardIds: [],
    },
    {
      cards: [emptyChange(strikeId)],
      removedCardIds: [strikeId],
    },
  ];
  for (const data of problems)
  {
    assert.ok(PackCardDataProblem(data), JSON.stringify(data));
  }
  assert.equal(PackCardDataProblem({
    cards: [emptyChange(strikeId)],
    removedCardIds: [],
  }), null);
});

test('pack cards: a new card without a name is refused', () =>
{
  const data = {
    cards: [emptyChange(newId)],
    removedCardIds: [],
  };
  assert.throws(() => MergedPackCardsText(packText, data), /needs a name/);
});

function withTempRoot(run)
{
  const root = mkdtempSync(join(tmpdir(), tempPrefix));
  try
  {
    return run(root);
  }
  finally
  {
    rmSync(root, {
      recursive: true,
      force: true,
    });
  }
}

function put(root, relativePath, text)
{
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

test('pack cards: the build runs every step in order and a failed step restores the outputs', () =>
{
  withTempRoot((root) =>
  {
    const pathOf = (relativePath) => join(root, relativePath);
    put(root, generatedFile, 'before');
    put(root, lockFile, 'lock before');
    const ran = [];
    const rebuilt = RebuildFromPackCards(pathOf, (step) => ran.push(step));
    assert.deepEqual(ran, PackCardsBuildSteps);
    assert.equal(rebuilt.length, PackCardsBuildSteps.length);
    const failAtLast = (step) =>
    {
      put(root, generatedFile, 'after');
      put(root, strayGeneratedFile, 'new');
      put(root, lockFile, 'lock after');
      if (step === PackCardsBuildSteps.at(-1))
      {
        throw new Error('build broke');
      }
    };
    assert.throws(() => RebuildFromPackCards(pathOf, failAtLast), /build broke/);
    assert.equal(readFileSync(pathOf(generatedFile), textEncoding), 'before');
    assert.equal(readFileSync(pathOf(lockFile), textEncoding), 'lock before');
    assert.equal(existsSync(pathOf(strayGeneratedFile)), false);
  });
});
