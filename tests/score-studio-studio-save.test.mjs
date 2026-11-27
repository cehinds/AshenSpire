// tests/score-studio-studio-save.test.mjs — the Studio's own Save (SS-003): fixed files, schema,
// revision, all-or-nothing writes. Every case runs in a throwaway folder, never the checkout.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readStudioSave, saveStudioSave, STUDIO_SAVE_STALE_MESSAGE } from '../tools/score-studio-save.mjs';
import {
  STUDIO_SAVE_DIR,
  STUDIO_SAVE_FILES,
  STUDIO_SAVE_FILE_NAMES,
  STUDIO_SAVE_FORMAT_VERSION,
  studioSaveDocument,
} from '../tools/score-studio/studioSaveFiles.js';

const TEMP_PREFIX = 'ashen-studio-save-';
const FIXED_TIME = '2026-11-26T10:00:00.000Z';
const LATER_TIME = '2026-11-26T11:00:00.000Z';
const QA_CARD_ID = 'custom.qaSaveCard';
const STALE_REVISION = '0'.repeat(64);
const HTTP_CONFLICT = 409;
const CARD_ART_LAYERS = { version: 1, layers: [{ id: 'layer1', assetId: 'Z.effect.5', opacity: 50 }] };
const ITEM_ART_LAYERS = { version: 1, layers: [] };

function withTempRepo(run)
{
  const root = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
  try
  {
    return run(root);
  }
  finally
  {
    rmSync(root, { recursive: true, force: true });
  }
}

function cardsDocument(cardName = 'QA save card')
{
  return studioSaveDocument(STUDIO_SAVE_FILE_NAMES.cards, {
    cards: [{ id: QA_CARD_ID, name: cardName, _custom: true, _edited: true }],
    removedCardIds: ['reaver.strike'],
  });
}

function artLayersDocument()
{
  return studioSaveDocument(STUDIO_SAVE_FILE_NAMES.artLayers, {
    cardArtLayers: CARD_ART_LAYERS,
    itemArtLayers: ITEM_ART_LAYERS,
  });
}

function saveBody(revision, cardName)
{
  return {
    revision,
    files: {
      [STUDIO_SAVE_FILE_NAMES.cards]: cardsDocument(cardName),
      [STUDIO_SAVE_FILE_NAMES.artLayers]: artLayersDocument(),
    },
  };
}

const fileOf = (root, name) => join(root, ...STUDIO_SAVE_FILES[name].path.split('/'));
const bytesOf = (root, name) => readFileSync(fileOf(root, name), 'utf8');
const studioDirOf = (root) => join(root, ...STUDIO_SAVE_DIR.split('/'));
const fixedClock = { now: () => FIXED_TIME };

test('studio save: the fixed paths sit in content/source/studio/ and nothing else', () =>
{
  for (const spec of Object.values(STUDIO_SAVE_FILES))
  {
    assert.match(spec.path, /^content\/source\/studio\/[A-Za-z]+\.json$/);
  }
  assert.deepEqual(Object.values(STUDIO_SAVE_FILES).map((spec) => spec.path), [
    'content/source/studio/cards.json',
    'content/source/studio/artLayers.json',
    'content/source/studio/templates.json',
  ]);
});

test('studio save: a first save writes both files with kind, formatVersion and the data', () =>
{
  withTempRepo((root) =>
  {
    const empty = readStudioSave(root);
    assert.deepEqual(Object.values(empty.files), [null, null, null]);
    const result = saveStudioSave(root, saveBody(empty.revision), fixedClock);
    assert.deepEqual(result.written, [STUDIO_SAVE_FILE_NAMES.cards, STUDIO_SAVE_FILE_NAMES.artLayers]);
    assert.equal(result.savedAt, FIXED_TIME);
    const cards = JSON.parse(bytesOf(root, STUDIO_SAVE_FILE_NAMES.cards));
    assert.equal(cards.kind, 'ashenspire.studioCards');
    assert.equal(cards.formatVersion, STUDIO_SAVE_FORMAT_VERSION);
    assert.equal(cards.savedAt, FIXED_TIME);
    assert.deepEqual(Object.keys(cards), ['kind', 'formatVersion', 'savedAt', 'cards', 'removedCardIds']);
    assert.equal(cards.cards[0].id, QA_CARD_ID);
    assert.equal(cards.cards[0]._custom, true, 'Studio _ flags are kept, as the draft keeps them');
    const art = JSON.parse(bytesOf(root, STUDIO_SAVE_FILE_NAMES.artLayers));
    assert.equal(art.kind, 'ashenspire.studioArtLayers');
    assert.deepEqual(art.cardArtLayers, CARD_ART_LAYERS);
    assert.deepEqual(readdirSync(studioDirOf(root)).sort(), ['artLayers.json', 'cards.json'], 'no temp file is left');
    assert.notEqual(result.revision, empty.revision);
    assert.equal(readStudioSave(root).revision, result.revision);
  });
});

test('studio save: a save with no data change keeps every byte, savedAt included', () =>
{
  withTempRepo((root) =>
  {
    const first = saveStudioSave(root, saveBody(readStudioSave(root).revision), fixedClock);
    const before = bytesOf(root, STUDIO_SAVE_FILE_NAMES.cards);
    const again = saveStudioSave(root, saveBody(first.revision), { now: () => LATER_TIME });
    assert.deepEqual(again.written, []);
    assert.equal(again.savedAt, null);
    assert.equal(again.revision, first.revision);
    assert.equal(bytesOf(root, STUDIO_SAVE_FILE_NAMES.cards), before);
  });
});

test('studio save: a stale revision is refused with 409 and the files keep their bytes', () =>
{
  withTempRepo((root) =>
  {
    const loadedByTabTwo = readStudioSave(root).revision;
    saveStudioSave(root, saveBody(loadedByTabTwo, 'Tab one'), fixedClock);
    const tabOneBytes = bytesOf(root, STUDIO_SAVE_FILE_NAMES.cards);
    assert.throws(
      () => saveStudioSave(root, saveBody(loadedByTabTwo, 'Tab two'), fixedClock),
      (error) => error.statusCode === HTTP_CONFLICT && error.message === STUDIO_SAVE_STALE_MESSAGE,
    );
    assert.throws(() => saveStudioSave(root, saveBody(STALE_REVISION), fixedClock), (error) => error.statusCode === HTTP_CONFLICT);
    assert.equal(bytesOf(root, STUDIO_SAVE_FILE_NAMES.cards), tabOneBytes);
  });
});

test('studio save: a path, an unknown file, extra keys and bad shapes are refused before any write', () =>
{
  withTempRepo((root) =>
  {
    const { revision } = readStudioSave(root);
    const refusals = [
      { ...saveBody(revision), path: '../package.json' },
      { revision, files: { '../package.json': cardsDocument() } },
      { revision, files: { scoring: cardsDocument() } },
      { revision, files: {} },
      { revision, files: { [STUDIO_SAVE_FILE_NAMES.cards]: { ...cardsDocument(), path: 'package.json' } } },
      { revision, files: { [STUDIO_SAVE_FILE_NAMES.cards]: { ...cardsDocument(), selectedCardId: QA_CARD_ID } } },
      { revision, files: { [STUDIO_SAVE_FILE_NAMES.cards]: { ...cardsDocument(), kind: 'ashenspire.studioArtLayers' } } },
      { revision, files: { [STUDIO_SAVE_FILE_NAMES.cards]: { ...cardsDocument(), formatVersion: 2 } } },
      { revision, files: { [STUDIO_SAVE_FILE_NAMES.cards]: { ...cardsDocument(), cards: [{ name: 'no id' }] } } },
      { revision, files: { [STUDIO_SAVE_FILE_NAMES.cards]: { ...cardsDocument(), removedCardIds: [7] } } },
      { revision, files: { [STUDIO_SAVE_FILE_NAMES.artLayers]: { ...artLayersDocument(), cardArtLayers: {} } } },
      { files: saveBody(revision).files },
      null,
    ];
    for (const body of refusals)
    {
      assert.throws(() => saveStudioSave(root, body, fixedClock), /Studio save refused/, JSON.stringify(body)?.slice(0, 120));
    }
    assert.equal(existsSync(studioDirOf(root)), false, 'nothing was written');
  });
});

test('studio save: a failed second write puts the first file back and leaves no temp file', () =>
{
  withTempRepo((root) =>
  {
    const first = saveStudioSave(root, saveBody(readStudioSave(root).revision, 'Saved name'), fixedClock);
    const cardsBefore = bytesOf(root, STUDIO_SAVE_FILE_NAMES.cards);
    const artBefore = bytesOf(root, STUDIO_SAVE_FILE_NAMES.artLayers);
    const changed = saveBody(first.revision, 'Unsaved name');
    changed.files[STUDIO_SAVE_FILE_NAMES.artLayers].itemArtLayers = { version: 1, layers: [{ id: 'itemLayer' }] };
    let writeCount = 0;
    const failingSecondWrite = (target, bytes) =>
    {
      writeCount += 1;
      if (writeCount === 2)
      {
        throw new Error('disk full');
      }
      writeFileSync(target, bytes);
    };
    assert.throws(() => saveStudioSave(root, changed, { now: () => LATER_TIME, writeFile: failingSecondWrite }), /rolled back: disk full/);
    assert.equal(bytesOf(root, STUDIO_SAVE_FILE_NAMES.cards), cardsBefore);
    assert.equal(bytesOf(root, STUDIO_SAVE_FILE_NAMES.artLayers), artBefore);
    assert.deepEqual(readdirSync(studioDirOf(root)).sort(), ['artLayers.json', 'cards.json']);
    assert.equal(readStudioSave(root).revision, first.revision);
  });
});

test('studio save: a failed write of a new file removes the half of the pair it wrote', () =>
{
  withTempRepo((root) =>
  {
    let writeCount = 0;
    const failingSecondWrite = (target, bytes) =>
    {
      writeCount += 1;
      if (writeCount === 2)
      {
        throw new Error('read-only');
      }
      writeFileSync(target, bytes);
    };
    assert.throws(() => saveStudioSave(root, saveBody(readStudioSave(root).revision), { ...fixedClock, writeFile: failingSecondWrite }), /rolled back/);
    assert.deepEqual(readdirSync(studioDirOf(root)), []);
  });
});

test('studio save: a symbolic link on the save path is refused', (context) =>
{
  withTempRepo((root) =>
  {
    const outside = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
    try
    {
      mkdirSync(join(root, 'content', 'source'), { recursive: true });
      try
      {
        symlinkSync(outside, studioDirOf(root), 'junction');
      }
      catch
      {
        context.skip('this system cannot create a directory link');
        return;
      }
      assert.throws(() => readStudioSave(root), /symbolic-link|outside the repository/);
      assert.throws(() => saveStudioSave(root, saveBody(STALE_REVISION), fixedClock), /symbolic-link|outside the repository/);
      assert.deepEqual(readdirSync(outside), []);
    }
    finally
    {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
