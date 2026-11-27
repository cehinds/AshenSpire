// tests/score-studio-studio-save.test.mjs — the Studio's own Save (SS-003): fixed files, schema,
// revision, all-or-nothing writes. Every case runs in a throwaway folder, never the checkout.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { serve } from '../tools/serve.mjs';
import { readStudioSave, saveStudioSave, STUDIO_SAVE_STALE_MESSAGE } from '../tools/score-studio-save.mjs';
import {
  StudioCardTemplatesKind,
  StudioSaveDir,
  StudioSaveEndpoint,
  StudioSaveFiles,
  StudioSaveFileNames,
  StudioSaveFormatVersion,
  StudioSaveMaxBytes,
  StudioSaveDocument,
} from '../tools/score-studio/studioSaveFiles.js';

const TEMP_PREFIX = 'ashen-studio-save-';
const STORY_CARDS_KIND = 'ashenspire.studioCards';
const STORY_ART_LAYERS_KIND = 'ashenspire.studioArtLayers';
const RETIRED_TEMPLATES_KIND = 'ashenspire.studioTemplates';
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
  return StudioSaveDocument(StudioSaveFileNames.Cards, {
    cards: [{ id: QA_CARD_ID, name: cardName, _custom: true, _edited: true }],
    removedCardIds: ['reaver.strike'],
  });
}

function artLayersDocument()
{
  return StudioSaveDocument(StudioSaveFileNames.ArtLayers, {
    cardArtLayers: CARD_ART_LAYERS,
    itemArtLayers: ITEM_ART_LAYERS,
  });
}

function saveBody(revision, cardName)
{
  return {
    revision,
    files: {
      [StudioSaveFileNames.Cards]: cardsDocument(cardName),
      [StudioSaveFileNames.ArtLayers]: artLayersDocument(),
    },
  };
}

const fileOf = (root, name) => join(root, ...StudioSaveFiles[name].path.split('/'));
const bytesOf = (root, name) => readFileSync(fileOf(root, name), 'utf8');
const studioDirOf = (root) => join(root, ...StudioSaveDir.split('/'));
const fixedClock = { now: () => FIXED_TIME };

test('studio save: the fixed paths sit in content/source/studio/ and nothing else', () =>
{
  for (const spec of Object.values(StudioSaveFiles))
  {
    assert.match(spec.path, /^content\/source\/studio\/[A-Za-z]+\.json$/);
  }
  assert.deepEqual(Object.values(StudioSaveFiles).map((spec) => spec.path), [
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
    assert.deepEqual(result.written, [StudioSaveFileNames.Cards, StudioSaveFileNames.ArtLayers]);
    assert.equal(result.savedAt, FIXED_TIME);
    const cards = JSON.parse(bytesOf(root, StudioSaveFileNames.Cards));
    assert.equal(cards.kind, STORY_CARDS_KIND);
    assert.equal(cards.formatVersion, StudioSaveFormatVersion);
    assert.equal(cards.savedAt, FIXED_TIME);
    assert.deepEqual(Object.keys(cards), ['kind', 'formatVersion', 'savedAt', 'cards', 'removedCardIds']);
    assert.equal(cards.cards[0].id, QA_CARD_ID);
    assert.equal(cards.cards[0]._custom, true, 'Studio _ flags are kept, as the draft keeps them');
    const art = JSON.parse(bytesOf(root, StudioSaveFileNames.ArtLayers));
    assert.equal(art.kind, STORY_ART_LAYERS_KIND);
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
    const before = bytesOf(root, StudioSaveFileNames.Cards);
    const again = saveStudioSave(root, saveBody(first.revision), { now: () => LATER_TIME });
    assert.deepEqual(again.written, []);
    assert.equal(again.savedAt, null);
    assert.equal(again.revision, first.revision);
    assert.equal(bytesOf(root, StudioSaveFileNames.Cards), before);
  });
});

test('studio save: a stale revision is refused with 409 and the files keep their bytes', () =>
{
  withTempRepo((root) =>
  {
    const loadedByTabTwo = readStudioSave(root).revision;
    saveStudioSave(root, saveBody(loadedByTabTwo, 'Tab one'), fixedClock);
    const tabOneBytes = bytesOf(root, StudioSaveFileNames.Cards);
    assert.throws(
      () => saveStudioSave(root, saveBody(loadedByTabTwo, 'Tab two'), fixedClock),
      (error) => error.statusCode === HTTP_CONFLICT && error.message === STUDIO_SAVE_STALE_MESSAGE,
    );
    assert.throws(() => saveStudioSave(root, saveBody(STALE_REVISION), fixedClock), (error) => error.statusCode === HTTP_CONFLICT);
    assert.equal(bytesOf(root, StudioSaveFileNames.Cards), tabOneBytes);
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
      { revision, files: { [StudioSaveFileNames.Cards]: { ...cardsDocument(), path: 'package.json' } } },
      { revision, files: { [StudioSaveFileNames.Cards]: { ...cardsDocument(), selectedCardId: QA_CARD_ID } } },
      { revision, files: { [StudioSaveFileNames.Cards]: { ...cardsDocument(), kind: STORY_ART_LAYERS_KIND } } },
      { revision, files: { [StudioSaveFileNames.Cards]: { ...cardsDocument(), formatVersion: 2 } } },
      { revision, files: { [StudioSaveFileNames.Cards]: { ...cardsDocument(), cards: [{ name: 'no id' }] } } },
      { revision, files: { [StudioSaveFileNames.Cards]: { ...cardsDocument(), removedCardIds: [7] } } },
      { revision, files: { [StudioSaveFileNames.ArtLayers]: { ...artLayersDocument(), cardArtLayers: {} } } },
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
    const cardsBefore = bytesOf(root, StudioSaveFileNames.Cards);
    const artBefore = bytesOf(root, StudioSaveFileNames.ArtLayers);
    const changed = saveBody(first.revision, 'Unsaved name');
    changed.files[StudioSaveFileNames.ArtLayers].itemArtLayers = { version: 1, layers: [{ id: 'itemLayer' }] };
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
    assert.equal(bytesOf(root, StudioSaveFileNames.Cards), cardsBefore);
    assert.equal(bytesOf(root, StudioSaveFileNames.ArtLayers), artBefore);
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

// ---------------------------------------------------------------------------
// The endpoint, through the real server in this process.
// ---------------------------------------------------------------------------

const LOOPBACK = '127.0.0.1';
const JSON_TYPE = 'application/json';
const TEXT_TYPE = 'text/plain';
const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;

async function withServer(options, run)
{
  return withTempRepoAsync(async (root) =>
  {
    const { server, port } = await serve({
      root,
      port: 0,
      open: false,
      quiet: true,
      host: LOOPBACK,
      ...options,
    });
    try
    {
      return await run({ root, port });
    }
    finally
    {
      server.closeAllConnections();
      await new Promise((resume) => server.close(resume));
    }
  });
}

async function withTempRepoAsync(run)
{
  const root = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
  try
  {
    return await run(root);
  }
  finally
  {
    rmSync(root, { recursive: true, force: true });
  }
}

function send(port, { method = 'GET', path = StudioSaveEndpoint, body = null, origin = `http://${LOOPBACK}:${port}`, contentType = JSON_TYPE } = {})
{
  return new Promise((resolveReply, rejectReply) =>
  {
    const headers = { Origin: origin, 'Content-Type': contentType };
    const request = httpRequest({ host: LOOPBACK, port, path, method, headers }, (response) =>
    {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () =>
      {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try
        {
          json = JSON.parse(text);
        }
        catch
        {
          json = { text };
        }
        resolveReply({ status: response.statusCode, json });
      });
    });
    request.on('error', rejectReply);
    request.end(body === null ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)));
  });
}

test('studio save endpoint: GET reads, POST saves the two fixed files and nothing else', async () =>
{
  await withServer({ editorWrite: true }, async ({ root, port }) =>
  {
    const loaded = await send(port);
    assert.equal(loaded.status, HTTP_OK);
    assert.equal(loaded.json.paths.cards, StudioSaveFiles.cards.path);
    const saved = await send(port, { method: 'POST', body: saveBody(loaded.json.revision) });
    assert.equal(saved.status, HTTP_OK, JSON.stringify(saved.json));
    assert.deepEqual(saved.json.written, [StudioSaveFileNames.Cards, StudioSaveFileNames.ArtLayers]);
    assert.deepEqual(readdirSync(studioDirOf(root)).sort(), ['artLayers.json', 'cards.json']);
    assert.deepEqual(readdirSync(root).sort(), ['content']);
    const stale = await send(port, { method: 'POST', body: saveBody(loaded.json.revision, 'Stale tab') });
    assert.equal(stale.status, HTTP_CONFLICT);
    assert.equal(stale.json.error, STUDIO_SAVE_STALE_MESSAGE);
  });
});

test('studio save endpoint: paths, .. segments, extra keys, oversize bodies and foreign requests are refused', async () =>
{
  await withServer({ editorWrite: true }, async ({ root, port }) =>
  {
    const { revision } = (await send(port)).json;
    const oversize = JSON.stringify({ ...saveBody(revision), padding: 'x'.repeat(StudioSaveMaxBytes) });
    const refusals = [
      { method: 'POST', body: { ...saveBody(revision), path: 'package.json' }, status: HTTP_BAD_REQUEST },
      { method: 'POST', body: { revision, files: { '../../package.json': cardsDocument() } }, status: HTTP_BAD_REQUEST },
      { method: 'POST', path: `${StudioSaveEndpoint}?path=../package.json`, body: { revision, files: { [StudioSaveFileNames.Cards]: { ...cardsDocument(), extra: true } } }, status: HTTP_BAD_REQUEST },
      { method: 'POST', path: `${StudioSaveEndpoint}/../package.json`, body: saveBody(revision), status: null },
      { method: 'POST', body: oversize, status: HTTP_BAD_REQUEST },
      { method: 'POST', body: saveBody(revision), origin: 'http://evil.example', status: HTTP_FORBIDDEN },
      { method: 'POST', body: saveBody(revision), contentType: TEXT_TYPE, status: HTTP_FORBIDDEN },
      { method: 'PUT', body: saveBody(revision), status: HTTP_FORBIDDEN },
    ];
    for (const { status, ...request } of refusals)
    {
      const reply = await send(port, request).catch(() => ({ status: 'unparsed' }));
      if (status !== null)
      {
        assert.equal(reply.status, status, `${request.method} ${request.path || ''} ${String(request.body).slice(0, 60)}`);
      }
      assert.notEqual(reply.status, HTTP_OK);
    }
    assert.equal(existsSync(studioDirOf(root)), false, 'no request wrote a file');
    assert.deepEqual(readdirSync(root), []);
  });
});

test('studio save endpoint: without --editor-write the save is refused but the read works', async () =>
{
  await withServer({ editorWrite: false }, async ({ root, port }) =>
  {
    const loaded = await send(port);
    assert.equal(loaded.status, HTTP_OK);
    const refused = await send(port, { method: 'POST', body: saveBody(loaded.json.revision) });
    assert.equal(refused.status, HTTP_FORBIDDEN);
    assert.equal(existsSync(studioDirOf(root)), false);
  });
});

test('studio save: templates.json is saved in its own shape, kind and no savedAt', () =>
{
  withTempRepo((root) =>
  {
    const templates = [{ id: 'qaTemplate' }];
    const document = StudioSaveDocument(StudioSaveFileNames.Templates, { templates });
    assert.deepEqual(document, { kind: StudioCardTemplatesKind, formatVersion: StudioSaveFormatVersion, templates });
    const { revision } = readStudioSave(root);
    assert.throws(() => saveStudioSave(root, { revision, files: { templates: { ...document, savedAt: FIXED_TIME } } }, fixedClock), /keys that are not allowed: savedAt/);
    assert.throws(() => saveStudioSave(root, { revision, files: { templates: { ...document, kind: RETIRED_TEMPLATES_KIND } } }, fixedClock), /must have kind "ashenspire.studioCardTemplates"/);
    saveStudioSave(root, { revision, files: { templates: document } }, fixedClock);
    assert.deepEqual(JSON.parse(bytesOf(root, StudioSaveFileNames.Templates)), document);
  });
});
