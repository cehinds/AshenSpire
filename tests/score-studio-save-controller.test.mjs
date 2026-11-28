// studioSave.js: the register hook, load on start, Draft and Saved after Save, Undo and Redo,
// web-mode download, and that no view state is sent.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ClearStudioSaveFiles,
  CreateStudioSave,
  RegisterStudioSaveFile,
  ShortStudioSaveMessage,
  StudioSaveChoice,
  StudioSavePillText,
  StudioSaveResult,
  StudioSaveStatus,
} from '../tools/score-studio/studioSave.js';
import {
  InitStudioSaveUi,
} from '../tools/score-studio/studioSaveUi.js';
import {
  StudioCardTemplatesKind,
  StudioSaveDownloadKind,
  StudioSaveDownloadName,
  StudioSaveEndpoint,
  StudioSaveFiles,
  StudioSaveFileNames,
  StudioSaveDocument,
} from '../tools/score-studio/studioSaveFiles.js';

const revisionLength = 64;
const revisionOne = 'a'.repeat(revisionLength);
const revisionTwo = 'b'.repeat(revisionLength);
const savedAtTime = '2026-11-26T10:00:00.000Z';
const postMethod = 'POST';
const qaCard = Object.freeze({
  id: 'custom.qaSaveCard',
  name: 'QA card',
  _custom: true,
  _edited: true,
});
const viewStateCardId = 'view-state-only';
const httpOk = 200;
const httpConflict = 409;
const httpServerError = 500;
const retiredTemplatesKind = 'ashenspire.studioTemplates';
const gameScoringFile = Object.freeze({
  name: 'scoring',
  path: 'content/source/scoring.json',
});
const cardsName = StudioSaveFileNames.Cards;
const artLayersName = StudioSaveFileNames.ArtLayers;
const templatesName = StudioSaveFileNames.Templates;
const cardsPath = StudioSaveFiles[cardsName].path;
const artLayersPath = StudioSaveFiles[artLayersName].path;
const templatesPath = StudioSaveFiles[templatesName].path;

function createStudio()
{
  return {
    cards: [],
    removedCardIds: [],
    cardArtLayers: {
      layers: [],
    },
    itemArtLayers: {
      layers: [],
    },
    selectedCardId: viewStateCardId,
    applied: [],
  };
}

function registerCardsFile(studio)
{
  RegisterStudioSaveFile({
    name: cardsName,
    path: cardsPath,
    read: () => ({
      cards: studio.cards,
      removedCardIds: studio.removedCardIds,
    }),
    apply: (data) =>
    {
      studio.cards = data.cards;
      studio.removedCardIds = data.removedCardIds;
      studio.applied.push(cardsName);
    },
  });
}

function registerArtLayersFile(studio)
{
  RegisterStudioSaveFile({
    name: artLayersName,
    path: artLayersPath,
    read: () => ({
      cardArtLayers: studio.cardArtLayers,
      itemArtLayers: studio.itemArtLayers,
    }),
    apply: (data) =>
    {
      studio.cardArtLayers = data.cardArtLayers;
      studio.itemArtLayers = data.itemArtLayers;
      studio.applied.push(artLayersName);
    },
  });
}

function postReply(postStatus)
{
  if (postStatus !== httpOk)
  {
    return {
      status: postStatus,
      json: {
        ok: false,
        error: 'refused',
      },
    };
  }
  return {
    status: httpOk,
    json: {
      ok: true,
      revision: revisionTwo,
      savedAt: savedAtTime,
      written: [cardsName],
      paths: {},
    },
  };
}

// A fake server that records every request: GET reads savedFiles, POST answers postStatus.
function createFakeServer(savedFiles, postStatus)
{
  const requests = [];
  const fetchJson = async (url, init = {}) =>
  {
    requests.push({
      url,
      ...init,
    });
    if (init.method === postMethod)
    {
      return postReply(postStatus);
    }
    return {
      status: httpOk,
      json: {
        ok: true,
        revision: revisionOne,
        files: savedFiles,
      },
    };
  };
  return {
    requests,
    fetchJson,
  };
}

// A Studio-like state, its registrations, and a fake server that records every request.
function setup({ isLocalServer = true, savedFiles = {}, postStatus = httpOk } = {})
{
  ClearStudioSaveFiles();
  const studio = createStudio();
  registerCardsFile(studio);
  registerArtLayersFile(studio);
  const { requests, fetchJson } = createFakeServer(savedFiles, postStatus);
  const downloads = [];
  const controller = CreateStudioSave({
    isLocalServer,
    fetchJson,
    download: (name, value) => downloads.push({
      name,
      value,
    }),
  });
  return {
    studio,
    controller,
    requests,
    downloads,
  };
}

async function loadWithBaseline(controller)
{
  await controller.load();
  controller.captureBaseline();
}

function findPost(requests)
{
  return requests.find((request) => request.method === postMethod);
}

function savedDocument(name, data)
{
  return {
    ...StudioSaveDocument(name, data),
    savedAt: savedAtTime,
  };
}

test('studio save hook: a file must match StudioSaveFiles by name and path', () =>
{
  ClearStudioSaveFiles();
  const read = () => ({});
  assert.throws(
    () => RegisterStudioSaveFile({
      ...gameScoringFile,
      read,
    }),
    /Unknown Studio Save file/,
  );
  assert.throws(
    () => RegisterStudioSaveFile({
      name: cardsName,
      path: 'package.json',
      read,
    }),
    /Unknown Studio Save file/,
  );
  assert.throws(
    () => RegisterStudioSaveFile({
      name: cardsName,
      path: cardsPath,
    }),
    /read\(\)/,
  );
  RegisterStudioSaveFile({
    name: templatesName,
    path: templatesPath,
    read: () => ({ templates: [] }),
  });
});

test('studio save: no file and no edits reads none; an edit reads Draft; '
  + 'Save sends the data keys only', async () =>
{
  const { studio, controller, requests } = setup();
  await loadWithBaseline(controller);
  assert.equal(controller.status(), StudioSaveStatus.None);
  assert.equal(controller.describe(), null);
  studio.cards = [qaCard];
  assert.equal(controller.status(), StudioSaveStatus.Draft);
  assert.equal(controller.describe().text, 'Draft');
  assert.match(controller.describe().title, /games\/ashenspire\/packs\/core\/cards\.json/);
  const saved = await controller.save();
  assert.equal(saved.result, StudioSaveResult.Saved);
  const post = findPost(requests);
  assert.equal(post.url, StudioSaveEndpoint);
  const body = JSON.parse(post.body);
  assert.deepEqual(Object.keys(body), ['revision', 'files']);
  assert.equal(body.revision, revisionOne);
  assert.deepEqual(Object.keys(body.files), [cardsName, artLayersName]);
  assert.deepEqual(Object.keys(body.files.cards), [
    'kind',
    'formatVersion',
    'cards',
    'removedCardIds',
  ]);
  assert.doesNotMatch(post.body, /view-state-only|selectedCardId/);
  assert.equal(controller.status(), StudioSaveStatus.Saved);
  assert.equal(controller.revision(), revisionTwo);
});

test('studio save: Undo away from the saved content reads Draft; '
  + 'Redo back reads Saved; neither saves', async () =>
{
  const { studio, controller, requests } = setup();
  await loadWithBaseline(controller);
  studio.cards = [qaCard];
  await controller.save();
  const requestCount = requests.length;
  const savedCards = studio.cards;
  studio.cards = [];
  assert.equal(controller.status(), StudioSaveStatus.Draft);
  studio.cards = structuredClone(savedCards);
  assert.equal(controller.status(), StudioSaveStatus.Saved);
  assert.equal(requests.length, requestCount);
});

test('studio save: Save with nothing changed since the last Save sends no request', async () =>
{
  const { studio, controller, requests } = setup();
  await loadWithBaseline(controller);
  studio.cards = [qaCard];
  await controller.save();
  const requestCount = requests.length;
  assert.equal((await controller.save()).result, StudioSaveResult.Unchanged);
  assert.equal(requests.length, requestCount);
});

test('studio save: load on start applies the saved files and reads Saved', async () =>
{
  const savedCardsData = {
    cards: [qaCard],
    removedCardIds: [],
  };
  const savedArtData = {
    cardArtLayers: {
      layers: [{ id: 'layer1' }],
    },
    itemArtLayers: {
      layers: [],
    },
  };
  const savedFiles = {
    cards: savedDocument(cardsName, savedCardsData),
    artLayers: savedDocument(artLayersName, savedArtData),
    templates: null,
  };
  const { studio, controller } = setup({ savedFiles });
  await loadWithBaseline(controller);
  assert.equal(controller.anyOnDisk(), true);
  controller.applyLoaded();
  assert.deepEqual(studio.applied, [cardsName, artLayersName]);
  assert.deepEqual(studio.cards, [qaCard]);
  assert.equal(controller.status(), StudioSaveStatus.Saved);
  assert.equal(controller.matchesSaved(cardsName, savedCardsData), true);
  const emptyCardsData = {
    cards: [],
    removedCardIds: [],
  };
  assert.equal(controller.matchesSaved(cardsName, emptyCardsData), false);
  studio.applied = [];
  controller.applyLoaded([cardsName]);
  assert.deepEqual(
    studio.applied,
    [artLayersName],
    'a file the draft carries is skipped',
  );
});

test('studio save: a stale or failed save keeps the Draft status and the revision', async () =>
{
  const cases = [
    [httpConflict, StudioSaveResult.Stale],
    [httpServerError, StudioSaveResult.Failed],
  ];
  for (const [postStatus, expected] of cases)
  {
    const { studio, controller } = setup({ postStatus });
    await loadWithBaseline(controller);
    studio.cards = [qaCard];
    assert.equal((await controller.save()).result, expected);
    assert.equal(controller.status(), StudioSaveStatus.Draft);
    assert.equal(controller.revision(), revisionOne);
  }
});

test('studio save: web mode downloads one file with both sections and sends no request', async () =>
{
  const { studio, controller, requests, downloads } = setup({ isLocalServer: false });
  assert.equal(await controller.load(), null);
  controller.captureBaseline();
  studio.cards = [qaCard];
  assert.equal(controller.status(), StudioSaveStatus.Web);
  assert.match(controller.describe().text, /Web mode/);
  assert.equal(
    controller.describe().shortText,
    StudioSavePillText.WebShort,
    'narrow screens get a short web-mode label',
  );
  assert.equal((await controller.save()).result, StudioSaveResult.Downloaded);
  assert.equal(requests.length, 0);
  assert.equal(downloads.length, 1);
  const [download] = downloads;
  assert.equal(download.name, StudioSaveDownloadName);
  assert.equal(download.value.kind, StudioSaveDownloadKind);
  assert.deepEqual(Object.keys(download.value.files), [cardsName, artLayersName]);
  assert.deepEqual(download.value.files.cards.cards, [qaCard]);
});

test('studio save hook: a file carries its own kind; SS-004 templates register without one '
  + 'and save in their own shape', async () =>
{
  const templates = [
    {
      id: 'qaTemplate',
      name: 'QA template',
    },
  ];
  const { studio, controller, requests } = setup();
  assert.throws(
    () => RegisterStudioSaveFile({
      name: templatesName,
      path: templatesPath,
      kind: retiredTemplatesKind,
      read: () => ({ templates }),
    }),
    /Unknown Studio Save file/,
  );
  RegisterStudioSaveFile({
    name: templatesName,
    path: templatesPath,
    read: () => ({ templates }),
    apply: () => undefined,
  });
  await loadWithBaseline(controller);
  studio.cards = [qaCard];
  await controller.save();
  const body = JSON.parse(findPost(requests).body);
  assert.deepEqual(body.files.templates, {
    kind: StudioCardTemplatesKind,
    formatVersion: 1,
    templates,
  });
});

test('studio save: a loaded file whose kind is not the registered kind is refused', async () =>
{
  const emptyCardsData = {
    cards: [],
    removedCardIds: [],
  };
  const savedFiles = {
    cards: {
      ...StudioSaveDocument(cardsName, emptyCardsData),
      kind: StudioCardTemplatesKind,
    },
  };
  const { controller } = setup({ savedFiles });
  const kindMismatch =
    /has kind "ashenspire.studioCardTemplates", expected "ashenspire.studioCards"/;
  await assert.rejects(controller.load(), kindMismatch);
});

// The Studio side with a fake server, a fake draft store and a choice that counts its asks.
function setupSaveUi({ savedFiles, choice, storage, asked })
{
  ClearStudioSaveFiles();
  const emptyLayers = {
    layers: [],
  };
  const { fetchJson } = createFakeServer(savedFiles, httpOk);
  return InitStudioSaveUi({
    state: {
      artLayers: emptyLayers,
      itemArtLayers: emptyLayers,
      repoArtLayers: emptyLayers,
      repoItemArtLayers: emptyLayers,
    },
    packCardChanges: () => [],
    packRemovedIds: () => [],
    heldBackCardCount: () => 0,
    isLocalServer: true,
    clone: structuredClone,
    toast: () => undefined,
    fetchJson,
    chooseDraftOrSaved: async () =>
    {
      asked.count += 1;
      return choice;
    },
    storeDraft: (draft) =>
    {
      storage.draft = JSON.stringify(draft);
    },
  });
}

test('studio save: once Keep my draft or Use the saved file is chosen, the next load asks nothing',
  async () =>
  {
    const savedLayers = {
      layers: [{ id: 'savedLayer' }],
    };
    const savedFiles = {
      artLayers: savedDocument(artLayersName, {
        cardArtLayers: savedLayers,
        itemArtLayers: savedLayers,
      }),
    };
    const draftCard = {
      ...qaCard,
      name: 'Draft edit',
    };
    const draftLayers = {
      layers: [{ id: 'draftLayer' }],
    };
    // Saved cards are the game's, so Use the saved file drops the draft's card edits.
    const expected = {
      [StudioSaveChoice.KeepDraft]: {
        customCards: [draftCard],
        artLayers: draftLayers,
      },
      [StudioSaveChoice.UseSaved]: {
        customCards: [],
        artLayers: savedLayers,
      },
    };
    for (const choice of Object.values(StudioSaveChoice))
    {
      const storage = {
        draft: null,
      };
      const asked = {
        count: 0,
      };
      const options = {
        savedFiles,
        choice,
        storage,
        asked,
      };
      const firstUi = setupSaveUi(options);
      await firstUi.loadSavedFiles();
      await firstUi.reconcileDraft({
        customCards: [draftCard],
        removedCardIds: [],
        artLayers: draftLayers,
        itemArtLayers: draftLayers,
        studioSaveRevision: revisionTwo,
      });
      assert.equal(asked.count, 1, `${choice}: the first load asks once`);
      const storedDraft = JSON.parse(storage.draft);
      assert.equal(storedDraft.studioSaveRevision, revisionOne);
      assert.deepEqual(storedDraft.customCards, expected[choice].customCards);
      assert.deepEqual(storedDraft.artLayers, expected[choice].artLayers);
      const secondUi = setupSaveUi(options);
      await secondUi.loadSavedFiles();
      await secondUi.reconcileDraft(storedDraft);
      assert.equal(asked.count, 1, `${choice}: the second load asks nothing`);
    }
  });

test('studio save: a failed save gives a plain message, and the full detail',
  async () =>
  {
    const tempPath = String.raw`C:\Users\qa\AppData\Local\Temp\studio save\.cards.json.tmp`;
    const detail = `Studio save failed and was rolled back: EPERM: open '${tempPath}'`;
    const { studio } = setup();
    const fetchJson = async (url, init = {}) =>
    {
      if (init.method !== postMethod)
      {
        return {
          status: httpOk,
          json: {
            ok: true,
            revision: revisionOne,
            files: {},
          },
        };
      }
      return {
        status: httpServerError,
        json: {
          ok: false,
          error: detail,
        },
      };
    };
    const controller = CreateStudioSave({
      isLocalServer: true,
      fetchJson,
      download: () => undefined,
    });
    await loadWithBaseline(controller);
    studio.cards = [qaCard];
    const outcome = await controller.save();
    assert.equal(outcome.result, StudioSaveResult.Failed);
    assert.equal(outcome.detail, detail);
    assert.match(outcome.message, /^Save failed\./);
    assert.doesNotMatch(outcome.message, /EPERM|tmp|[\\/]/);
    assert.equal(
      ShortStudioSaveMessage('EACCES: open \'/tmp/qa/artLayers.json\''),
      'EACCES: open \'artLayers.json\'',
    );
  });

test('studio save: an edit made while a save is in flight stays Draft and is sent next time',
  async () =>
  {
    const { studio } = setup();
    let releaseReply = null;
    const fetchJson = async (url, init = {}) =>
    {
      if (init.method !== postMethod)
      {
        return {
          status: httpOk,
          json: {
            ok: true,
            revision: revisionOne,
            files: {},
          },
        };
      }
      await new Promise((resolve) =>
      {
        releaseReply = resolve;
      });
      return postReply(httpOk);
    };
    const controller = CreateStudioSave({
      isLocalServer: true,
      fetchJson,
      download: () => undefined,
    });
    await loadWithBaseline(controller);
    studio.cards = [qaCard];
    const pendingSave = controller.save();
    const laterCard = {
      ...qaCard,
      name: 'QA card edited during save',
    };
    studio.cards = [laterCard];
    releaseReply();
    const outcome = await pendingSave;
    assert.equal(outcome.result, StudioSaveResult.Saved);
    assert.equal(
      controller.status(),
      StudioSaveStatus.Draft,
      'the edit made in flight is not marked as saved',
    );
  });

test('studio save: deleting a saved card back to the game baseline still counts as unsaved',
  async () =>
  {
    const savedCardsData = {
      cards: [qaCard],
      removedCardIds: [],
    };
    const options = {
      choice: StudioSaveChoice.KeepDraft,
      storage: {
        draft: null,
      },
      asked: {
        count: 0,
      },
    };
    const savedUi = setupSaveUi({
      ...options,
      savedFiles: {
        cards: savedDocument(cardsName, savedCardsData),
      },
    });
    await savedUi.loadSavedFiles();
    assert.equal(savedUi.hasUnsavedChanges(), true, 'the deletion keeps the draft');
    const unsavedUi = setupSaveUi({
      ...options,
      savedFiles: {},
    });
    await unsavedUi.loadSavedFiles();
    assert.equal(unsavedUi.hasUnsavedChanges(), false, 'no save files, nothing unsaved');
  });

test('studio save: Revert to in-game is stored as a draft, so a reload keeps it', () =>
{
  const source = readFileSync(
    new URL('../tools/score-studio/studio.js', import.meta.url),
    'utf8',
  );
  const start = source.indexOf('async function revertToRepo()');
  const end = source.indexOf('\n}', start);
  assert.ok(start > 0 && end > start);
  assert.match(source.slice(start, end), /writeDraftNow\(\);/);
});
