// tests/score-studio-save-controller.test.mjs — studioSave.js, the browser half of the Studio Save (SS-003):
// the register hook, load on start, the Draft/Saved status, Undo back to the saved content, web-mode
// download, and that only the registered data keys are sent (never view state).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearStudioSaveFiles,
  createStudioSave,
  registerStudioSaveFile,
  STUDIO_SAVE_RESULT,
  STUDIO_SAVE_STATUS,
} from '../tools/score-studio/studioSave.js';
import {
  STUDIO_CARD_TEMPLATES_KIND,
  STUDIO_SAVE_DOWNLOAD_KIND,
  STUDIO_SAVE_DOWNLOAD_NAME,
  STUDIO_SAVE_ENDPOINT,
  STUDIO_SAVE_FILES,
  STUDIO_SAVE_FILE_NAMES,
  studioSaveDocument,
} from '../tools/score-studio/studioSaveFiles.js';

const REVISION_ONE = 'a'.repeat(64);
const REVISION_TWO = 'b'.repeat(64);
const SAVED_AT = '2026-11-26T10:00:00.000Z';
const QA_CARD = { id: 'custom.qaSaveCard', name: 'QA card', _custom: true, _edited: true };
const HTTP_OK = 200;
const HTTP_CONFLICT = 409;
const HTTP_SERVER_ERROR = 500;

/** A Studio-like state, its registrations, and a fake server that records every request. */
function setup({ isLocalServer = true, savedFiles = {}, postStatus = HTTP_OK } = {})
{
  clearStudioSaveFiles();
  const studio = {
    cards: [],
    removedCardIds: [],
    cardArtLayers: { layers: [] },
    itemArtLayers: { layers: [] },
    selectedCardId: 'view-state-only',
    applied: [],
  };
  registerStudioSaveFile({
    name: STUDIO_SAVE_FILE_NAMES.cards,
    path: STUDIO_SAVE_FILES.cards.path,
    read: () => ({ cards: studio.cards, removedCardIds: studio.removedCardIds }),
    apply: (data) =>
    {
      studio.cards = data.cards;
      studio.removedCardIds = data.removedCardIds;
      studio.applied.push(STUDIO_SAVE_FILE_NAMES.cards);
    },
  });
  registerStudioSaveFile({
    name: STUDIO_SAVE_FILE_NAMES.artLayers,
    path: STUDIO_SAVE_FILES.artLayers.path,
    read: () => ({ cardArtLayers: studio.cardArtLayers, itemArtLayers: studio.itemArtLayers }),
    apply: (data) =>
    {
      studio.cardArtLayers = data.cardArtLayers;
      studio.itemArtLayers = data.itemArtLayers;
      studio.applied.push(STUDIO_SAVE_FILE_NAMES.artLayers);
    },
  });
  const requests = [];
  const downloads = [];
  const fetchJson = async (url, init = {}) =>
  {
    requests.push({ url, ...init });
    if (init.method !== 'POST')
    {
      return { status: HTTP_OK, json: { ok: true, revision: REVISION_ONE, files: savedFiles } };
    }
    if (postStatus !== HTTP_OK)
    {
      return { status: postStatus, json: { ok: false, error: 'refused' } };
    }
    return { status: HTTP_OK, json: { ok: true, revision: REVISION_TWO, savedAt: SAVED_AT, written: ['cards'], paths: {} } };
  };
  const controller = createStudioSave({ isLocalServer, fetchJson, download: (name, value) => downloads.push({ name, value }) });
  return { studio, controller, requests, downloads };
}

test('studio save hook: a file must match STUDIO_SAVE_FILES by name and path', () =>
{
  clearStudioSaveFiles();
  const read = () => ({});
  assert.throws(() => registerStudioSaveFile({ name: 'scoring', path: 'content/source/scoring.json', read }), /Unknown Studio Save file/);
  assert.throws(() => registerStudioSaveFile({ name: STUDIO_SAVE_FILE_NAMES.cards, path: 'package.json', read }), /Unknown Studio Save file/);
  assert.throws(() => registerStudioSaveFile({ name: STUDIO_SAVE_FILE_NAMES.cards, path: STUDIO_SAVE_FILES.cards.path }), /read\(\)/);
  registerStudioSaveFile({ name: STUDIO_SAVE_FILE_NAMES.templates, path: STUDIO_SAVE_FILES.templates.path, read: () => ({ templates: [] }) });
});

test('studio save: no file and no edits reads none; an edit reads Draft; Save sends the data keys only', async () =>
{
  const { studio, controller, requests } = setup();
  await controller.load();
  controller.captureBaseline();
  assert.equal(controller.status(), STUDIO_SAVE_STATUS.none);
  assert.equal(controller.describe(), null);
  studio.cards = [QA_CARD];
  assert.equal(controller.status(), STUDIO_SAVE_STATUS.draft);
  assert.equal(controller.describe().text, 'Draft');
  assert.match(controller.describe().title, /content\/source\/studio\/cards\.json/);
  const saved = await controller.save();
  assert.equal(saved.result, STUDIO_SAVE_RESULT.saved);
  const post = requests.find((request) => request.method === 'POST');
  assert.equal(post.url, STUDIO_SAVE_ENDPOINT);
  const body = JSON.parse(post.body);
  assert.deepEqual(Object.keys(body), ['revision', 'files']);
  assert.equal(body.revision, REVISION_ONE);
  assert.deepEqual(Object.keys(body.files), ['cards', 'artLayers']);
  assert.deepEqual(Object.keys(body.files.cards), ['kind', 'formatVersion', 'savedAt', 'cards', 'removedCardIds']);
  assert.doesNotMatch(post.body, /view-state-only|selectedCardId/);
  assert.equal(controller.status(), STUDIO_SAVE_STATUS.saved);
  assert.equal(controller.revision(), REVISION_TWO);
});

test('studio save: Undo away from the saved content reads Draft; Redo back reads Saved; neither saves', async () =>
{
  const { studio, controller, requests } = setup();
  await controller.load();
  controller.captureBaseline();
  studio.cards = [QA_CARD];
  await controller.save();
  const requestCount = requests.length;
  const savedCards = studio.cards;
  studio.cards = [];
  assert.equal(controller.status(), STUDIO_SAVE_STATUS.draft);
  studio.cards = structuredClone(savedCards);
  assert.equal(controller.status(), STUDIO_SAVE_STATUS.saved);
  assert.equal(requests.length, requestCount);
});

test('studio save: Save with nothing changed since the last Save sends no request', async () =>
{
  const { studio, controller, requests } = setup();
  await controller.load();
  controller.captureBaseline();
  studio.cards = [QA_CARD];
  await controller.save();
  const requestCount = requests.length;
  assert.equal((await controller.save()).result, STUDIO_SAVE_RESULT.unchanged);
  assert.equal(requests.length, requestCount);
});

test('studio save: load on start applies the saved files and reads Saved', async () =>
{
  const savedFiles = {
    cards: { ...studioSaveDocument(STUDIO_SAVE_FILE_NAMES.cards, { cards: [QA_CARD], removedCardIds: [] }), savedAt: SAVED_AT },
    artLayers: { ...studioSaveDocument(STUDIO_SAVE_FILE_NAMES.artLayers, { cardArtLayers: { layers: [{ id: 'layer1' }] }, itemArtLayers: { layers: [] } }), savedAt: SAVED_AT },
    templates: null,
  };
  const { studio, controller } = setup({ savedFiles });
  await controller.load();
  controller.captureBaseline();
  assert.equal(controller.anyOnDisk(), true);
  controller.applyLoaded();
  assert.deepEqual(studio.applied, ['cards', 'artLayers']);
  assert.deepEqual(studio.cards, [QA_CARD]);
  assert.equal(controller.status(), STUDIO_SAVE_STATUS.saved);
  assert.equal(controller.matchesSaved(STUDIO_SAVE_FILE_NAMES.cards, { cards: [QA_CARD], removedCardIds: [] }), true);
  assert.equal(controller.matchesSaved(STUDIO_SAVE_FILE_NAMES.cards, { cards: [], removedCardIds: [] }), false);
  studio.applied = [];
  controller.applyLoaded([STUDIO_SAVE_FILE_NAMES.cards]);
  assert.deepEqual(studio.applied, ['artLayers'], 'a file the draft carries is skipped');
});

test('studio save: a stale or failed save keeps the Draft status and the revision', async () =>
{
  for (const [postStatus, expected] of [[HTTP_CONFLICT, STUDIO_SAVE_RESULT.stale], [HTTP_SERVER_ERROR, STUDIO_SAVE_RESULT.failed]])
  {
    const { studio, controller } = setup({ postStatus });
    await controller.load();
    controller.captureBaseline();
    studio.cards = [QA_CARD];
    assert.equal((await controller.save()).result, expected);
    assert.equal(controller.status(), STUDIO_SAVE_STATUS.draft);
    assert.equal(controller.revision(), REVISION_ONE);
  }
});

test('studio save: web mode downloads one file with both sections and sends no request', async () =>
{
  const { studio, controller, requests, downloads } = setup({ isLocalServer: false });
  assert.equal(await controller.load(), null);
  controller.captureBaseline();
  studio.cards = [QA_CARD];
  assert.equal(controller.status(), STUDIO_SAVE_STATUS.web);
  assert.match(controller.describe().text, /Web mode/);
  assert.equal((await controller.save()).result, STUDIO_SAVE_RESULT.downloaded);
  assert.equal(requests.length, 0);
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].name, STUDIO_SAVE_DOWNLOAD_NAME);
  assert.equal(downloads[0].value.kind, STUDIO_SAVE_DOWNLOAD_KIND);
  assert.deepEqual(Object.keys(downloads[0].value.files), ['cards', 'artLayers']);
  assert.deepEqual(downloads[0].value.files.cards.cards, [QA_CARD]);
});

test('studio save hook: a file carries its own kind; SS-004 templates register without one and save in their own shape', async () =>
{
  const templates = [{ id: 'qaTemplate', name: 'QA template' }];
  const { studio, controller, requests } = setup();
  assert.throws(() => registerStudioSaveFile({
    name: STUDIO_SAVE_FILE_NAMES.templates,
    path: STUDIO_SAVE_FILES.templates.path,
    kind: 'ashenspire.studioTemplates',
    read: () => ({ templates }),
  }), /Unknown Studio Save file/);
  registerStudioSaveFile({
    name: STUDIO_SAVE_FILE_NAMES.templates,
    path: STUDIO_SAVE_FILES.templates.path,
    read: () => ({ templates }),
    apply: () => {},
  });
  await controller.load();
  controller.captureBaseline();
  studio.cards = [QA_CARD];
  await controller.save();
  const body = JSON.parse(requests.find((request) => request.method === 'POST').body);
  assert.deepEqual(body.files.templates, {
    kind: STUDIO_CARD_TEMPLATES_KIND,
    formatVersion: 1,
    templates,
  });
});

test('studio save: a loaded file whose kind is not the registered kind is refused', async () =>
{
  const savedFiles = {
    cards: { ...studioSaveDocument(STUDIO_SAVE_FILE_NAMES.cards, { cards: [], removedCardIds: [] }), kind: STUDIO_CARD_TEMPLATES_KIND },
  };
  const { controller } = setup({ savedFiles });
  await assert.rejects(controller.load(), /has kind "ashenspire.studioCardTemplates", expected "ashenspire.studioCards"/);
});
