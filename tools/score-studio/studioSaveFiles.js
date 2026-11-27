// tools/score-studio/studioSaveFiles.js — the fixed files the Studio's own Save writes (SS-003).
// Shared by the browser Studio and tools/score-studio-save.mjs, so both name the same paths, kinds and keys.

export const STUDIO_SAVE_FORMAT_VERSION = 1;
export const STUDIO_SAVE_DIR = 'content/source/studio';
export const STUDIO_SAVE_ENDPOINT = '/__studio/studio-save';
export const STUDIO_SAVE_MAX_BYTES = 4 * 1024 * 1024;
export const STUDIO_SAVE_DOWNLOAD_NAME = 'ashenspire-studio-save.json';
export const STUDIO_SAVE_DOWNLOAD_KIND = 'ashenspire.studioSave';
export const STUDIO_CARDS_KIND = 'ashenspire.studioCards';
export const STUDIO_ART_LAYERS_KIND = 'ashenspire.studioArtLayers';
export const STUDIO_CARD_TEMPLATES_KIND = 'ashenspire.studioCardTemplates';

const KIND_KEY = 'kind';
const FORMAT_VERSION_KEY = 'formatVersion';
const SAVED_AT_KEY = 'savedAt';

export const STUDIO_SAVE_FILE_NAMES = Object.freeze({
  cards: 'cards',
  artLayers: 'artLayers',
  templates: 'templates',
});

export const STUDIO_SAVE_FILES = Object.freeze({
  [STUDIO_SAVE_FILE_NAMES.cards]: Object.freeze({
    path: `${STUDIO_SAVE_DIR}/cards.json`,
    kind: STUDIO_CARDS_KIND,
    dataKeys: Object.freeze(['cards', 'removedCardIds']),
    stampsSavedAt: true,
  }),
  [STUDIO_SAVE_FILE_NAMES.artLayers]: Object.freeze({
    path: `${STUDIO_SAVE_DIR}/artLayers.json`,
    kind: STUDIO_ART_LAYERS_KIND,
    dataKeys: Object.freeze(['cardArtLayers', 'itemArtLayers']),
    stampsSavedAt: true,
  }),
  // SS-004 owns this format: the same shape as template Import and Export, with no savedAt.
  [STUDIO_SAVE_FILE_NAMES.templates]: Object.freeze({
    path: `${STUDIO_SAVE_DIR}/templates.json`,
    kind: STUDIO_CARD_TEMPLATES_KIND,
    dataKeys: Object.freeze(['templates']),
    stampsSavedAt: false,
  }),
});

/** The header keys a file's document carries before its data keys. */
export function studioSaveHeaderKeys(name)
{
  const headerKeys = [KIND_KEY, FORMAT_VERSION_KEY];
  if (STUDIO_SAVE_FILES[name].stampsSavedAt)
  {
    headerKeys.push(SAVED_AT_KEY);
  }
  return headerKeys;
}

/** The file's JSON: the header first, then its data keys in their fixed order. */
export function studioSaveDocument(name, data, savedAt, kind = STUDIO_SAVE_FILES[name].kind)
{
  const spec = STUDIO_SAVE_FILES[name];
  const document = {
    [KIND_KEY]: kind,
    [FORMAT_VERSION_KEY]: STUDIO_SAVE_FORMAT_VERSION,
  };
  if (spec.stampsSavedAt)
  {
    document[SAVED_AT_KEY] = savedAt;
  }
  for (const key of spec.dataKeys)
  {
    document[key] = data[key];
  }
  return document;
}

/** The data keys of a saved document, without its header: what a Save compares and applies. */
export function studioSaveData(name, document)
{
  const data = {};
  for (const key of STUDIO_SAVE_FILES[name].dataKeys)
  {
    data[key] = document[key];
  }
  return data;
}

/** JSON with object keys sorted, so equal content compares equal whatever order it was built in. */
export function stableJson(value)
{
  if (Array.isArray(value))
  {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object')
  {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}
