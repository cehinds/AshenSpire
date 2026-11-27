// tools/score-studio/studioSaveFiles.js — the fixed files the Studio's own Save writes (SS-003).
//
// Shared by the browser Studio (studioSave.js) and the local server (tools/score-studio-save.mjs),
// so both name the same paths, kinds and keys. A new Save file is added here and nowhere else on
// the server side; the Studio registers how to read and apply it with registerStudioSaveFile.

export const STUDIO_SAVE_FORMAT_VERSION = 1;
export const STUDIO_SAVE_DIR = 'content/source/studio';
export const STUDIO_SAVE_ENDPOINT = '/__studio/studio-save';
export const STUDIO_SAVE_MAX_BYTES = 4 * 1024 * 1024;
export const STUDIO_SAVE_DOWNLOAD_NAME = 'ashenspire-studio-save.json';
export const STUDIO_SAVE_DOWNLOAD_KIND = 'ashenspire.studioSave';
export const STUDIO_SAVE_HEADER_KEYS = Object.freeze([
  'kind',
  'formatVersion',
  'savedAt',
]);

export const STUDIO_SAVE_FILE_NAMES = Object.freeze({
  cards: 'cards',
  artLayers: 'artLayers',
  templates: 'templates',
});

export const STUDIO_SAVE_FILES = Object.freeze({
  [STUDIO_SAVE_FILE_NAMES.cards]: Object.freeze({
    path: `${STUDIO_SAVE_DIR}/cards.json`,
    kind: 'ashenspire.studioCards',
    dataKeys: Object.freeze(['cards', 'removedCardIds']),
  }),
  [STUDIO_SAVE_FILE_NAMES.artLayers]: Object.freeze({
    path: `${STUDIO_SAVE_DIR}/artLayers.json`,
    kind: 'ashenspire.studioArtLayers',
    dataKeys: Object.freeze(['cardArtLayers', 'itemArtLayers']),
  }),
  [STUDIO_SAVE_FILE_NAMES.templates]: Object.freeze({
    path: `${STUDIO_SAVE_DIR}/templates.json`,
    kind: 'ashenspire.studioTemplates',
    dataKeys: Object.freeze(['templates']),
  }),
});

/** The file's JSON: the header keys first, then its data keys in their fixed order. */
export function studioSaveDocument(name, data, savedAt)
{
  const spec = STUDIO_SAVE_FILES[name];
  const document = {
    kind: spec.kind,
    formatVersion: STUDIO_SAVE_FORMAT_VERSION,
    savedAt,
  };
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
