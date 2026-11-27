// tools/score-studio/studioSave.js — File > Save for the Studio's own config (SS-003).
// Hook: registerStudioSaveFile({ name, path, kind, read, apply }) adds a file to Save, load on start, the pill
// and the web download. name, path and kind match STUDIO_SAVE_FILES; read() gives the data keys, apply(data) takes them.

import {
  STUDIO_SAVE_DOWNLOAD_KIND,
  STUDIO_SAVE_DOWNLOAD_NAME,
  STUDIO_SAVE_ENDPOINT,
  STUDIO_SAVE_FILES,
  STUDIO_SAVE_FORMAT_VERSION,
  stableJson,
  studioSaveData,
  studioSaveDocument,
} from './studioSaveFiles.js';

export const STUDIO_SAVE_STATUS = Object.freeze({
  none: 'none',
  draft: 'draft',
  saved: 'saved',
  web: 'web',
});

export const STUDIO_SAVE_RESULT = Object.freeze({
  saved: 'saved',
  unchanged: 'unchanged',
  downloaded: 'downloaded',
  stale: 'stale',
  failed: 'failed',
});

export const STUDIO_SAVE_CHOICE = Object.freeze({
  keepDraft: 'keepDraft',
  useSaved: 'useSaved',
});

export const STUDIO_SAVE_PILL_TEXT = Object.freeze({
  draft: 'Draft',
  saved: 'Saved',
  saving: 'Saving…',
  failed: 'Save failed',
  web: 'Web mode · Download',
});

const DRAFT_TITLE = 'Studio edits are in the local draft only. File > Save (Ctrl+S) writes:';
const SAVED_TITLE = 'Saved';
const WEB_TITLE = `No local server: File > Save (Ctrl+S) downloads ${STUDIO_SAVE_DOWNLOAD_NAME}.`;
const CONTENT_TYPE_HEADER = 'Content-Type';
const JSON_CONTENT_TYPE = 'application/json';
const POST_METHOD = 'POST';
const NO_STORE = 'no-store';
const HTTP_OK = 200;
const HTTP_CONFLICT = 409;
const LINE_BREAK = '\n';
const CHOICE_DIALOG_CLASS = 'studio-modal';
const CHOICE_DIALOG_HTML = `<form method="dialog">
  <h3>The Studio save files changed</h3>
  <p class="studio-muted">They changed after your local draft was made (another tab, or a git pull).</p>
  <div class="modal-actions">
    <button value="${STUDIO_SAVE_CHOICE.useSaved}" class="s-btn">Use the saved file</button>
    <button value="${STUDIO_SAVE_CHOICE.keepDraft}" class="s-btn s-btn-primary">Keep my draft</button>
  </div>
</form>`;

const registeredFiles = new Map();

export function registerStudioSaveFile({ name, path, kind, read, apply })
{
  const spec = STUDIO_SAVE_FILES[name];
  const fileKind = kind ?? spec?.kind;
  if (!spec || spec.path !== path || spec.kind !== fileKind)
  {
    throw new Error(`Unknown Studio Save file "${name}" (${path}, ${fileKind}). Add it to STUDIO_SAVE_FILES first.`);
  }
  if (typeof read !== 'function')
  {
    throw new Error(`Studio Save file "${name}" needs a read() function.`);
  }
  registeredFiles.set(name, {
    name,
    path,
    kind: fileKind,
    read,
    apply: typeof apply === 'function'
      ? apply
      : null,
  });
}

export function registeredStudioSaveFiles()
{
  return [...registeredFiles.values()];
}

/** Test seam: forget every registration. */
export function clearStudioSaveFiles()
{
  registeredFiles.clear();
}

function latestTime(first, second)
{
  return [first, second].filter(Boolean).sort().at(-1) ?? null;
}

/** The Save controller. fetchJson(url, init) gives { status, json }; download(name, value) saves a web-mode file. */
export function createStudioSave({ isLocalServer, fetchJson, download, now = () => new Date().toISOString() })
{
  let revision = null;
  let lastSavedAt = null;
  const lastSavedJson = new Map();
  const onDisk = new Map();
  const loadedData = new Map();

  const files = () => registeredStudioSaveFiles();
  const currentJson = (file) => stableJson(file.read());
  const changedFiles = () => files().filter((file) => lastSavedJson.get(file.name) !== currentJson(file));
  const pathList = () => files().map((file) => file.path).join(LINE_BREAK);

  function savedHeading()
  {
    return lastSavedAt
      ? `${SAVED_TITLE} ${new Date(lastSavedAt).toLocaleString()}`
      : SAVED_TITLE;
  }

  function rememberLoaded(file, document)
  {
    if (document.kind !== file.kind)
    {
      throw new Error(`${file.path} has kind "${document.kind}", expected "${file.kind}".`);
    }
    const data = studioSaveData(file.name, document);
    loadedData.set(file.name, data);
    lastSavedJson.set(file.name, stableJson(data));
    onDisk.set(file.name, true);
    lastSavedAt = latestTime(lastSavedAt, document.savedAt);
  }

  async function load()
  {
    if (!isLocalServer)
    {
      return null;
    }
    const reply = await fetchJson(STUDIO_SAVE_ENDPOINT, { cache: NO_STORE });
    if (reply.status !== HTTP_OK || !reply.json?.ok)
    {
      throw new Error(reply.json?.error || `Could not read the Studio save files (${reply.status}).`);
    }
    revision = reply.json.revision;
    for (const file of files())
    {
      const document = reply.json.files?.[file.name];
      if (document)
      {
        rememberLoaded(file, document);
      }
    }
    return { revision };
  }

  /** For each file not on disk, what the Studio holds now is the clean state. Call before a draft applies. */
  function captureBaseline()
  {
    for (const file of files())
    {
      if (!onDisk.get(file.name))
      {
        lastSavedJson.set(file.name, currentJson(file));
      }
    }
  }

  function anyOnDisk()
  {
    return files().some((file) => onDisk.get(file.name));
  }

  /** Hands each loaded file to its apply(), except the names in skipNames. */
  function applyLoaded(skipNames = [])
  {
    for (const file of files())
    {
      if (file.apply && onDisk.get(file.name) && !skipNames.includes(file.name))
      {
        file.apply(loadedData.get(file.name));
      }
    }
  }

  function matchesSaved(name, data)
  {
    return lastSavedJson.get(name) === stableJson(data);
  }

  function status()
  {
    if (!isLocalServer)
    {
      return STUDIO_SAVE_STATUS.web;
    }
    if (changedFiles().length)
    {
      return STUDIO_SAVE_STATUS.draft;
    }
    return anyOnDisk()
      ? STUDIO_SAVE_STATUS.saved
      : STUDIO_SAVE_STATUS.none;
  }

  /** The pill's text and title for the Save scope, or null when there is no file and no edit. */
  function describe()
  {
    const describers = {
      [STUDIO_SAVE_STATUS.web]: () => ({
        text: STUDIO_SAVE_PILL_TEXT.web,
        title: WEB_TITLE,
        dirty: changedFiles().length > 0,
      }),
      [STUDIO_SAVE_STATUS.draft]: () => ({
        text: STUDIO_SAVE_PILL_TEXT.draft,
        title: [DRAFT_TITLE, pathList()].join(LINE_BREAK),
        dirty: true,
      }),
      [STUDIO_SAVE_STATUS.saved]: () => ({
        text: STUDIO_SAVE_PILL_TEXT.saved,
        title: [savedHeading(), pathList()].join(LINE_BREAK),
        dirty: false,
      }),
      [STUDIO_SAVE_STATUS.none]: () => null,
    };
    return describers[status()]();
  }

  function documentsToSave(savedAt)
  {
    return Object.fromEntries(files().map((file) => [file.name, studioSaveDocument(file.name, file.read(), savedAt, file.kind)]));
  }

  function markSaved(savedAt)
  {
    for (const file of files())
    {
      lastSavedJson.set(file.name, currentJson(file));
      onDisk.set(file.name, true);
    }
    lastSavedAt = savedAt ?? lastSavedAt;
  }

  function downloadAll()
  {
    const savedAt = now();
    download(STUDIO_SAVE_DOWNLOAD_NAME, {
      kind: STUDIO_SAVE_DOWNLOAD_KIND,
      formatVersion: STUDIO_SAVE_FORMAT_VERSION,
      savedAt,
      files: documentsToSave(savedAt),
    });
    return { result: STUDIO_SAVE_RESULT.downloaded };
  }

  async function postAll()
  {
    try
    {
      return await fetchJson(STUDIO_SAVE_ENDPOINT, {
        method: POST_METHOD,
        headers: { [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE },
        body: JSON.stringify({ revision, files: documentsToSave(null) }),
      });
    }
    catch (error)
    {
      return { status: null, json: { error: error.message } };
    }
  }

  async function save()
  {
    if (!isLocalServer)
    {
      return downloadAll();
    }
    if (status() === STUDIO_SAVE_STATUS.saved)
    {
      return { result: STUDIO_SAVE_RESULT.unchanged };
    }
    const reply = await postAll();
    if (reply.status === HTTP_CONFLICT)
    {
      return { result: STUDIO_SAVE_RESULT.stale, message: reply.json?.error };
    }
    if (reply.status !== HTTP_OK || !reply.json?.ok)
    {
      return { result: STUDIO_SAVE_RESULT.failed, message: reply.json?.error || `Save failed (${reply.status}).` };
    }
    revision = reply.json.revision;
    markSaved(reply.json.savedAt);
    return {
      result: reply.json.written.length
        ? STUDIO_SAVE_RESULT.saved
        : STUDIO_SAVE_RESULT.unchanged,
    };
  }

  return {
    load,
    captureBaseline,
    loadedFile: (name) => loadedData.get(name) ?? null,
    anyOnDisk,
    applyLoaded,
    matchesSaved,
    status,
    describe,
    save,
    revision: () => revision,
  };
}

/** One choice, Keep my draft or Use the saved file. Escape keeps the draft. */
export function chooseDraftOrSavedFile(documentRef = document)
{
  const dialog = documentRef.createElement('dialog');
  dialog.className = CHOICE_DIALOG_CLASS;
  dialog.innerHTML = CHOICE_DIALOG_HTML;
  documentRef.body.append(dialog);
  return new Promise((resolveChoice) =>
  {
    dialog.addEventListener('close', () =>
    {
      const choice = dialog.returnValue === STUDIO_SAVE_CHOICE.useSaved
        ? STUDIO_SAVE_CHOICE.useSaved
        : STUDIO_SAVE_CHOICE.keepDraft;
      dialog.remove();
      resolveChoice(choice);
    });
    dialog.showModal();
  });
}
