// The fixed files the Studio's own Save writes. The browser Studio and
// tools/score-studio-save.mjs share them, so both name the same paths, kinds and keys.

const bytesPerMebibyte = 1024 * 1024;
const jsonExtension = '.json';
const kindKey = 'kind';
const formatVersionKey = 'formatVersion';
const savedAtKey = 'savedAt';

export const StudioSaveFormatVersion = 1;
export const StudioSaveDir = 'content/source/studio';
export const StudioSaveEndpoint = '/__studio/studio-save';
export const StudioSaveMaxBytes = 4 * bytesPerMebibyte;
export const StudioSaveDownloadName = 'ashenspire-studio-save.json';
export const StudioSaveDownloadKind = 'ashenspire.studioSave';
export const StudioCardsKind = 'ashenspire.studioCards';
export const StudioArtLayersKind = 'ashenspire.studioArtLayers';
export const StudioCardTemplatesKind = 'ashenspire.studioCardTemplates';

// Card edits go straight into the game's card file; only these id namespaces live there.
export const StudioPackCardsPath = 'games/ashenspire/packs/core/cards.json';
export const StudioPackCardIdPrefixes = Object.freeze([
  'core.',
  'custom.',
]);
export const StudioCardChangeKeys = Object.freeze([
  'id',
  'set',
  'unset',
]);

export const StudioSaveFileNames = Object.freeze({
  Cards: 'cards',
  ArtLayers: 'artLayers',
  Templates: 'templates',
});

export const StudioSaveFiles = Object.freeze({
  // Card changes are merged into the game's card file, which has no header of its own.
  [StudioSaveFileNames.Cards]: Object.freeze({
    path: StudioPackCardsPath,
    kind: StudioCardsKind,
    dataKeys: Object.freeze([
      'cards',
      'removedCardIds',
    ]),
    stampsSavedAt: false,
    savesToGame: true,
  }),
  [StudioSaveFileNames.ArtLayers]: Object.freeze({
    path: studioSavePath(StudioSaveFileNames.ArtLayers),
    kind: StudioArtLayersKind,
    dataKeys: Object.freeze([
      'cardArtLayers',
      'itemArtLayers',
    ]),
    stampsSavedAt: true,
  }),
  // Templates keep the template Import and Export shape, with no savedAt.
  [StudioSaveFileNames.Templates]: Object.freeze({
    path: studioSavePath(StudioSaveFileNames.Templates),
    kind: StudioCardTemplatesKind,
    dataKeys: Object.freeze(['templates']),
    stampsSavedAt: false,
  }),
});

/** The names of the files the Save keeps in StudioSaveDir, not in the game. */
export const StudioSaveDirFileNames = Object.freeze(
  Object.keys(StudioSaveFiles).filter((name) => !StudioSaveFiles[name].savesToGame),
);

function studioSavePath(fileName)
{
  return `${StudioSaveDir}/${fileName}${jsonExtension}`;
}

/** The header keys a file's document carries before its data keys. */
export function StudioSaveHeaderKeys(name)
{
  const headerKeys = [
    kindKey,
    formatVersionKey,
  ];
  if (StudioSaveFiles[name].stampsSavedAt)
  {
    headerKeys.push(savedAtKey);
  }
  return headerKeys;
}

/** The file's JSON: the header first, then its data keys in their fixed order. */
export function StudioSaveDocument(
  name,
  data,
  savedAt,
  kind = StudioSaveFiles[name].kind,
)
{
  const spec = StudioSaveFiles[name];
  const document = {
    [kindKey]: kind,
    [formatVersionKey]: StudioSaveFormatVersion,
  };
  if (spec.stampsSavedAt)
  {
    document[savedAtKey] = savedAt;
  }
  for (const key of spec.dataKeys)
  {
    document[key] = data[key];
  }
  return document;
}

/** The data keys of a saved document, without its header: what a Save compares and applies. */
export function StudioSaveData(name, document)
{
  const data = {};
  for (const key of StudioSaveFiles[name].dataKeys)
  {
    data[key] = document[key];
  }
  return data;
}

/** JSON with object keys sorted, so equal content compares equal whatever order it was built in. */
export function StableJson(value)
{
  if (Array.isArray(value))
  {
    return `[${value.map(StableJson).join(',')}]`;
  }
  if (value && typeof value === 'object')
  {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${StableJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}
