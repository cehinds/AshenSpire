// The Studio's own Save: fixed files, schema, revision and all-or-nothing writes.
// Every case runs in a throwaway folder, never the checkout.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { serve } from '../tools/serve.mjs';
import {
  ReadStudioSave,
  SaveStudioSave,
  StudioSaveStaleMessage,
} from '../tools/score-studio-save.mjs';
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

const tempPrefix = 'ashen-studio-save-';
const textEncoding = 'utf8';
const pathSeparator = '/';
const directoryLinkType = 'junction';
const storyCardsKind = 'ashenspire.studioCards';
const storyArtLayersKind = 'ashenspire.studioArtLayers';
const retiredTemplatesKind = 'ashenspire.studioTemplates';
const fixedTime = '2026-11-26T10:00:00.000Z';
const laterTime = '2026-11-26T11:00:00.000Z';
const qaCardId = 'custom.qaSaveCard';
const revisionLength = 64;
const staleRevision = '0'.repeat(revisionLength);
const refusalLabelLength = 120;
const requestLabelLength = 60;
const cardsName = StudioSaveFileNames.Cards;
const artLayersName = StudioSaveFileNames.ArtLayers;
const templatesName = StudioSaveFileNames.Templates;
const savedPairFiles = Object.freeze([
  'artLayers.json',
  'cards.json',
]);
const cardArtLayers = Object.freeze({
  version: 1,
  layers: [
    {
      id: 'layer1',
      assetId: 'Z.effect.5',
      opacity: 50,
    },
  ],
});
const itemArtLayers = Object.freeze({
  version: 1,
  layers: [],
});
const fixedClock = Object.freeze({
  now: () => fixedTime,
});
const loopback = '127.0.0.1';
const getMethod = 'GET';
const postMethod = 'POST';
const putMethod = 'PUT';
const jsonType = 'application/json';
const textType = 'text/plain';
const foreignOrigin = 'http://evil.example';
const unparsedStatus = 'unparsed';
const httpOk = 200;
const httpBadRequest = 400;
const httpForbidden = 403;
const httpConflict = 409;

async function withTempRepo(run)
{
  const root = mkdtempSync(join(tmpdir(), tempPrefix));
  try
  {
    return await run(root);
  }
  finally
  {
    rmSync(root, {
      recursive: true,
      force: true,
    });
  }
}

function cardsDocument(cardName = 'QA save card')
{
  return StudioSaveDocument(cardsName, {
    cards: [
      {
        id: qaCardId,
        name: cardName,
        _custom: true,
        _edited: true,
      },
    ],
    removedCardIds: ['reaver.strike'],
  });
}

function artLayersDocument()
{
  return StudioSaveDocument(artLayersName, {
    cardArtLayers,
    itemArtLayers,
  });
}

function saveBody(revision, cardName)
{
  return {
    revision,
    files: {
      [cardsName]: cardsDocument(cardName),
      [artLayersName]: artLayersDocument(),
    },
  };
}

// A request body with only the cards file, its document changed by overrides.
function cardsBody(revision, overrides)
{
  return {
    revision,
    files: {
      [cardsName]: {
        ...cardsDocument(),
        ...overrides,
      },
    },
  };
}

function fileOf(root, name)
{
  return join(root, ...StudioSaveFiles[name].path.split(pathSeparator));
}

function bytesOf(root, name)
{
  return readFileSync(fileOf(root, name), textEncoding);
}

function studioDirOf(root)
{
  return join(root, ...StudioSaveDir.split(pathSeparator));
}

function saveAt(root, body)
{
  return SaveStudioSave(
    root,
    body,
    fixedClock,
  );
}

// A write seam that fails on its second call and writes normally otherwise.
function failingSecondWrite(message)
{
  let writeCount = 0;
  return (target, bytes) =>
  {
    writeCount += 1;
    if (writeCount === 2)
    {
      throw new Error(message);
    }
    writeFileSync(target, bytes);
  };
}

function parseReplyText(text)
{
  try
  {
    return JSON.parse(text);
  }
  catch
  {
    return { text };
  }
}

function requestPayload(body)
{
  if (body === null)
  {
    return undefined;
  }
  return typeof body === 'string'
    ? body
    : JSON.stringify(body);
}

function collectReply(response, resolveReply)
{
  const chunks = [];
  response.on('data', (chunk) => chunks.push(chunk));
  response.on('end', () =>
  {
    const text = Buffer.concat(chunks).toString(textEncoding);
    resolveReply({
      status: response.statusCode,
      json: parseReplyText(text),
    });
  });
}

function send(port, request = {})
{
  const {
    method = getMethod,
    path = StudioSaveEndpoint,
    body = null,
    origin = `http://${loopback}:${port}`,
    contentType = jsonType,
  } = request;
  const options = {
    host: loopback,
    port,
    path,
    method,
    headers: {
      Origin: origin,
      'Content-Type': contentType,
    },
  };
  return new Promise((resolveReply, rejectReply) =>
  {
    const outgoing = httpRequest(options, (response) => collectReply(response, resolveReply));
    outgoing.on('error', rejectReply);
    outgoing.end(requestPayload(body));
  });
}

async function withServer(options, run)
{
  return withTempRepo(async (root) =>
  {
    const { server, port } = await serve({
      root,
      port: 0,
      open: false,
      quiet: true,
      host: loopback,
      ...options,
    });
    try
    {
      return await run({
        root,
        port,
      });
    }
    finally
    {
      server.closeAllConnections();
      await new Promise((resume) => server.close(resume));
    }
  });
}

test('studio save: the fixed paths sit in content/source/studio/ and nothing else', () =>
{
  const specs = Object.values(StudioSaveFiles);
  for (const spec of specs)
  {
    assert.match(spec.path, /^content\/source\/studio\/[A-Za-z]+\.json$/);
  }
  assert.deepEqual(specs.map((spec) => spec.path), [
    'content/source/studio/cards.json',
    'content/source/studio/artLayers.json',
    'content/source/studio/templates.json',
  ]);
});

test('studio save: a first save writes both files with kind, formatVersion '
  + 'and the data', async () =>
{
  await withTempRepo((root) =>
  {
    const empty = ReadStudioSave(root);
    assert.deepEqual(Object.values(empty.files), [
      null,
      null,
      null,
    ]);
    const result = saveAt(root, saveBody(empty.revision));
    assert.deepEqual(result.written, [cardsName, artLayersName]);
    assert.equal(result.savedAt, fixedTime);
    const cards = JSON.parse(bytesOf(root, cardsName));
    assert.equal(cards.kind, storyCardsKind);
    assert.equal(cards.formatVersion, StudioSaveFormatVersion);
    assert.equal(cards.savedAt, fixedTime);
    assert.deepEqual(Object.keys(cards), [
      'kind',
      'formatVersion',
      'savedAt',
      'cards',
      'removedCardIds',
    ]);
    assert.equal(cards.cards[0].id, qaCardId);
    assert.equal(
      cards.cards[0]._custom,
      true,
      'Studio _ flags are kept, as the draft keeps them',
    );
    const art = JSON.parse(bytesOf(root, artLayersName));
    assert.equal(art.kind, storyArtLayersKind);
    assert.deepEqual(art.cardArtLayers, cardArtLayers);
    assert.deepEqual(
      readdirSync(studioDirOf(root)).sort(),
      savedPairFiles,
      'no temp file is left',
    );
    assert.notEqual(result.revision, empty.revision);
    assert.equal(ReadStudioSave(root).revision, result.revision);
  });
});

test('studio save: a save with no data change keeps every byte, savedAt included', async () =>
{
  await withTempRepo((root) =>
  {
    const first = saveAt(root, saveBody(ReadStudioSave(root).revision));
    const before = bytesOf(root, cardsName);
    const again = SaveStudioSave(
      root,
      saveBody(first.revision),
      { now: () => laterTime },
    );
    assert.deepEqual(again.written, []);
    assert.equal(again.savedAt, null);
    assert.equal(again.revision, first.revision);
    assert.equal(bytesOf(root, cardsName), before);
  });
});

test('studio save: a stale revision is refused with 409 and the files keep their bytes', async () =>
{
  await withTempRepo((root) =>
  {
    const loadedByTabTwo = ReadStudioSave(root).revision;
    saveAt(root, saveBody(loadedByTabTwo, 'Tab one'));
    const tabOneBytes = bytesOf(root, cardsName);
    const isStaleRefusal = (error) =>
      error.statusCode === httpConflict && error.message === StudioSaveStaleMessage;
    assert.throws(
      () => saveAt(root, saveBody(loadedByTabTwo, 'Tab two')),
      isStaleRefusal,
    );
    assert.throws(
      () => saveAt(root, saveBody(staleRevision)),
      (error) => error.statusCode === httpConflict,
    );
    assert.equal(bytesOf(root, cardsName), tabOneBytes);
  });
});

test('studio save: a path, an unknown file, extra keys and bad shapes '
  + 'are refused before any write', async () =>
{
  await withTempRepo((root) =>
  {
    const { revision } = ReadStudioSave(root);
    const refusals = [
      {
        ...saveBody(revision),
        path: '../package.json',
      },
      {
        revision,
        files: {
          '../package.json': cardsDocument(),
        },
      },
      {
        revision,
        files: {
          scoring: cardsDocument(),
        },
      },
      {
        revision,
        files: {},
      },
      cardsBody(revision, { path: 'package.json' }),
      cardsBody(revision, { selectedCardId: qaCardId }),
      cardsBody(revision, { kind: storyArtLayersKind }),
      cardsBody(revision, { formatVersion: 2 }),
      cardsBody(revision, { cards: [{ name: 'no id' }] }),
      cardsBody(revision, { removedCardIds: [7] }),
      {
        revision,
        files: {
          [artLayersName]: {
            ...artLayersDocument(),
            cardArtLayers: {},
          },
        },
      },
      {
        files: saveBody(revision).files,
      },
      null,
    ];
    for (const body of refusals)
    {
      assert.throws(
        () => saveAt(root, body),
        /Studio save refused/,
        JSON.stringify(body)?.slice(0, refusalLabelLength),
      );
    }
    assert.equal(
      existsSync(studioDirOf(root)),
      false,
      'nothing was written',
    );
  });
});

test('studio save: a failed second write puts the first file back '
  + 'and leaves no temp file', async () =>
{
  await withTempRepo((root) =>
  {
    const firstBody = saveBody(ReadStudioSave(root).revision, 'Saved name');
    const first = saveAt(root, firstBody);
    const cardsBefore = bytesOf(root, cardsName);
    const artBefore = bytesOf(root, artLayersName);
    const changed = saveBody(first.revision, 'Unsaved name');
    changed.files[artLayersName].itemArtLayers = {
      version: 1,
      layers: [{ id: 'itemLayer' }],
    };
    const seams = {
      now: () => laterTime,
      writeFile: failingSecondWrite('disk full'),
    };
    const saveChanged = () => SaveStudioSave(
      root,
      changed,
      seams,
    );
    assert.throws(saveChanged, /rolled back: disk full/);
    assert.equal(bytesOf(root, cardsName), cardsBefore);
    assert.equal(bytesOf(root, artLayersName), artBefore);
    assert.deepEqual(readdirSync(studioDirOf(root)).sort(), savedPairFiles);
    assert.equal(ReadStudioSave(root).revision, first.revision);
  });
});

test('studio save: a failed write of a new file removes the half of the pair it wrote', async () =>
{
  await withTempRepo((root) =>
  {
    const seams = {
      ...fixedClock,
      writeFile: failingSecondWrite('read-only'),
    };
    const body = saveBody(ReadStudioSave(root).revision);
    const saveFirst = () => SaveStudioSave(
      root,
      body,
      seams,
    );
    assert.throws(saveFirst, /rolled back/);
    assert.deepEqual(readdirSync(studioDirOf(root)), []);
  });
});

test('studio save: a symbolic link on the save path is refused', async (context) =>
{
  await withTempRepo(async (root) =>
  {
    await withTempRepo((outside) =>
    {
      mkdirSync(dirname(studioDirOf(root)), { recursive: true });
      try
      {
        symlinkSync(
          outside,
          studioDirOf(root),
          directoryLinkType,
        );
      }
      catch
      {
        context.skip('this system cannot create a directory link');
        return;
      }
      const linkRefusal = /symbolic-link|outside the repository/;
      assert.throws(() => ReadStudioSave(root), linkRefusal);
      assert.throws(() => saveAt(root, saveBody(staleRevision)), linkRefusal);
      assert.deepEqual(readdirSync(outside), []);
    });
  });
});

// The endpoint, through the real server in this process.

test('studio save endpoint: GET reads, POST saves the two fixed files and nothing else', async () =>
{
  await withServer({ editorWrite: true }, async ({ root, port }) =>
  {
    const loaded = await send(port);
    assert.equal(loaded.status, httpOk);
    assert.equal(loaded.json.paths.cards, StudioSaveFiles[cardsName].path);
    const saved = await send(port, {
      method: postMethod,
      body: saveBody(loaded.json.revision),
    });
    assert.equal(
      saved.status,
      httpOk,
      JSON.stringify(saved.json),
    );
    assert.deepEqual(saved.json.written, [cardsName, artLayersName]);
    assert.deepEqual(readdirSync(studioDirOf(root)).sort(), savedPairFiles);
    assert.deepEqual(readdirSync(root).sort(), ['content']);
    const stale = await send(port, {
      method: postMethod,
      body: saveBody(loaded.json.revision, 'Stale tab'),
    });
    assert.equal(stale.status, httpConflict);
    assert.equal(stale.json.error, StudioSaveStaleMessage);
  });
});

function endpointRefusals(revision)
{
  const oversize = JSON.stringify({
    ...saveBody(revision),
    padding: 'x'.repeat(StudioSaveMaxBytes),
  });
  const extraKeyBody = cardsBody(revision, { extra: true });
  return [
    {
      method: postMethod,
      body: {
        ...saveBody(revision),
        path: 'package.json',
      },
      status: httpBadRequest,
    },
    {
      method: postMethod,
      body: {
        revision,
        files: {
          '../../package.json': cardsDocument(),
        },
      },
      status: httpBadRequest,
    },
    {
      method: postMethod,
      path: `${StudioSaveEndpoint}?path=../package.json`,
      body: extraKeyBody,
      status: httpBadRequest,
    },
    {
      method: postMethod,
      path: `${StudioSaveEndpoint}/../package.json`,
      body: saveBody(revision),
      status: null,
    },
    {
      method: postMethod,
      body: oversize,
      status: httpBadRequest,
    },
    {
      method: postMethod,
      body: saveBody(revision),
      origin: foreignOrigin,
      status: httpForbidden,
    },
    {
      method: postMethod,
      body: saveBody(revision),
      contentType: textType,
      status: httpForbidden,
    },
    {
      method: putMethod,
      body: saveBody(revision),
      status: httpForbidden,
    },
  ];
}

function refusalLabel(request)
{
  const bodyLabel = String(request.body).slice(0, requestLabelLength);
  return `${request.method} ${request.path || ''} ${bodyLabel}`;
}

test('studio save endpoint: paths, .. segments, extra keys, oversize bodies and foreign requests '
  + 'are refused', async () =>
{
  await withServer({ editorWrite: true }, async ({ root, port }) =>
  {
    const { revision } = (await send(port)).json;
    for (const { status, ...request } of endpointRefusals(revision))
    {
      const reply = await send(port, request).catch(() => ({ status: unparsedStatus }));
      if (status !== null)
      {
        assert.equal(
          reply.status,
          status,
          refusalLabel(request),
        );
      }
      assert.notEqual(reply.status, httpOk);
    }
    assert.equal(
      existsSync(studioDirOf(root)),
      false,
      'no request wrote a file',
    );
    assert.deepEqual(readdirSync(root), []);
  });
});

test('studio save endpoint: without --editor-write the save is refused '
  + 'but the read works', async () =>
{
  await withServer({ editorWrite: false }, async ({ root, port }) =>
  {
    const loaded = await send(port);
    assert.equal(loaded.status, httpOk);
    const refused = await send(port, {
      method: postMethod,
      body: saveBody(loaded.json.revision),
    });
    assert.equal(refused.status, httpForbidden);
    assert.equal(existsSync(studioDirOf(root)), false);
  });
});

test('studio save: templates.json is saved in its own shape, kind and no savedAt', async () =>
{
  await withTempRepo((root) =>
  {
    const templates = [{ id: 'qaTemplate' }];
    const document = StudioSaveDocument(templatesName, { templates });
    assert.deepEqual(document, {
      kind: StudioCardTemplatesKind,
      formatVersion: StudioSaveFormatVersion,
      templates,
    });
    const { revision } = ReadStudioSave(root);
    const templatesBody = (overrides) => ({
      revision,
      files: {
        templates: {
          ...document,
          ...overrides,
        },
      },
    });
    assert.throws(
      () => saveAt(root, templatesBody({ savedAt: fixedTime })),
      /keys that are not allowed: savedAt/,
    );
    assert.throws(
      () => saveAt(root, templatesBody({ kind: retiredTemplatesKind })),
      /must have kind "ashenspire.studioCardTemplates"/,
    );
    saveAt(root, templatesBody({}));
    assert.deepEqual(JSON.parse(bytesOf(root, templatesName)), document);
  });
});
