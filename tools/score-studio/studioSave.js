// tools/score-studio/studioSave.js — File > Save for the Studio's own config (SS-003).
// Hook: registerStudioSaveFile({ name, path, read, apply }) adds a file to Save, load on start, the Draft/Saved
// pill and the web-mode download. `name` and `path` must match STUDIO_SAVE_FILES (studioSaveFiles.js);
// read() returns the file's data keys, apply(data) gets them back on start (null when the file is absent).

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

const PILL_TEXT = Object.freeze({
  draft: 'Draft',
  saved: 'Saved',
  saving: 'Saving…',
  failed: 'Save failed',
  web: 'Web mode · Download',
});
const DRAFT_TITLE = 'Studio edits are in the local draft only. File > Save (Ctrl+S) writes:';
const SAVED_TITLE = 'Saved';
const WEB_TITLE = `No local server: File > Save (Ctrl+S) downloads ${STUDIO_SAVE_DOWNLOAD_NAME}.`;
const JSON_CONTENT_TYPE = 'application/json';
const HTTP_CONFLICT = 409;
const POST_METHOD = 'POST';

const registeredFiles = new Map();

export function registerStudioSaveFile({ name, path, read, apply })
{
  const spec = STUDIO_SAVE_FILES[name];
  if (!spec || spec.path !== path)
  {
    throw new Error(`Unknown Studio Save file "${name}" at "${path}". Add it to STUDIO_SAVE_FILES first.`);
  }
  if (typeof read !== 'function')
  {
    throw new Error(`Studio Save file "${name}" needs a read() function.`);
  }
  registeredFiles.set(name, { name, path, read, apply: typeof apply === 'function' ? apply : null });
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

/**
 * The Save controller. `fetchJson(url, init)` returns { status, json }; `download(name, value)` saves a file in
 * web mode; `now()` gives the ISO time a download carries.
 */
export function createStudioSave({ isLocalServer, fetchJson, download, now = () => new Date().toISOString() })
{
  let revision = null;
  let lastSavedAt = null;
  const lastSavedJson = new Map();
  const onDisk = new Map();
  const loadedData = new Map();

  const currentJson = (file) => stableJson(file.read());
  const files = () => registeredStudioSaveFiles();

  async function load()
  {
    if (!isLocalServer)
    {
      return null;
    }
    const reply = await fetchJson(STUDIO_SAVE_ENDPOINT, { cache: 'no-store' });
    if (reply.status !== 200 || !reply.json?.ok)
    {
      throw new Error(reply.json?.error || `Could not read the Studio save files (${reply.status}).`);
    }
    revision = reply.json.revision;
    for (const [name, document] of Object.entries(reply.json.files || {}))
    {
      if (!document || !STUDIO_SAVE_FILES[name])
      {
        continue;
      }
      const data = studioSaveData(name, document);
      loadedData.set(name, data);
      lastSavedJson.set(name, stableJson(data));
      onDisk.set(name, true);
      lastSavedAt = [lastSavedAt, document.savedAt].filter(Boolean).sort().at(-1) || null;
    }
    return { revision };
  }

  /** For each file not on disk, what the Studio holds now is the clean state. Call before any draft applies. */
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

  function loadedFile(name)
  {
    return loadedData.get(name) ?? null;
  }

  function anyOnDisk()
  {
    return files().some((file) => onDisk.get(file.name));
  }

  /** Hands each loaded file to its apply(), skipping `skipNames` (data a draft already carries). */
  function applyLoaded(skipNames = [])
  {
    for (const file of files())
    {
      if (file.apply && !skipNames.includes(file.name) && onDisk.get(file.name))
      {
        file.apply(loadedFile(file.name));
      }
    }
  }

  /** True when `data` for `name` equals the saved file (or the clean state when there is no file). */
  function matchesSaved(name, data)
  {
    return lastSavedJson.get(name) === stableJson(data);
  }

  function changedFiles()
  {
    return files().filter((file) => lastSavedJson.get(file.name) !== currentJson(file));
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
    return anyOnDisk() ? STUDIO_SAVE_STATUS.saved : STUDIO_SAVE_STATUS.none;
  }

  function pathList()
  {
    return files().map((file) => file.path).join('\n');
  }

  /** The pill's text and title for the Save scope, or null when there is nothing to say (no file, no edits). */
  function describe()
  {
    const current = status();
    if (current === STUDIO_SAVE_STATUS.web)
    {
      return { text: PILL_TEXT.web, title: WEB_TITLE, dirty: changedFiles().length > 0 };
    }
    if (current === STUDIO_SAVE_STATUS.draft)
    {
      return { text: PILL_TEXT.draft, title: `${DRAFT_TITLE}\n${pathList()}`, dirty: true };
    }
    if (current === STUDIO_SAVE_STATUS.saved)
    {
      const when = lastSavedAt ? ` ${new Date(lastSavedAt).toLocaleString()}` : '';
      return { text: PILL_TEXT.saved, title: `${SAVED_TITLE}${when}\n${pathList()}`, dirty: false };
    }
    return null;
  }

  function documentsToSave(savedAt)
  {
    return Object.fromEntries(files().map((file) => [file.name, studioSaveDocument(file.name, file.read(), savedAt)]));
  }

  function markSaved(savedAt)
  {
    for (const file of files())
    {
      lastSavedJson.set(file.name, currentJson(file));
      onDisk.set(file.name, true);
    }
    lastSavedAt = savedAt || lastSavedAt;
  }

  async function save()
  {
    if (!isLocalServer)
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
    if (status() === STUDIO_SAVE_STATUS.saved)
    {
      return { result: STUDIO_SAVE_RESULT.unchanged };
    }
    let reply;
    try
    {
      reply = await fetchJson(STUDIO_SAVE_ENDPOINT, {
        method: POST_METHOD,
        headers: { 'Content-Type': JSON_CONTENT_TYPE },
        body: JSON.stringify({ revision, files: documentsToSave(null) }),
      });
    }
    catch (error)
    {
      return { result: STUDIO_SAVE_RESULT.failed, message: error.message };
    }
    if (reply.status === HTTP_CONFLICT)
    {
      return { result: STUDIO_SAVE_RESULT.stale, message: reply.json?.error };
    }
    if (reply.status !== 200 || !reply.json?.ok)
    {
      return { result: STUDIO_SAVE_RESULT.failed, message: reply.json?.error || `Save failed (${reply.status}).` };
    }
    revision = reply.json.revision;
    markSaved(reply.json.savedAt);
    return { result: reply.json.written.length ? STUDIO_SAVE_RESULT.saved : STUDIO_SAVE_RESULT.unchanged, paths: reply.json.paths };
  }

  return {
    load,
    captureBaseline,
    loadedFile,
    anyOnDisk,
    applyLoaded,
    matchesSaved,
    status,
    describe,
    save,
    revision: () => revision,
    pillText: PILL_TEXT,
  };
}

/** One choice, Keep my draft or Use the saved file, in a modal dialog. Resolves with a STUDIO_SAVE_CHOICE. */
export function chooseDraftOrSavedFile(documentRef = document)
{
  const dialog = documentRef.createElement('dialog');
  dialog.className = 'studio-modal';
  dialog.innerHTML = `<form method="dialog">
      <h3>The Studio save files changed</h3>
      <p class="studio-muted">They changed after your local draft was made (another tab, or a git pull).</p>
      <div class="modal-actions">
        <button value="${STUDIO_SAVE_CHOICE.useSaved}" class="s-btn">Use the saved file</button>
        <button value="${STUDIO_SAVE_CHOICE.keepDraft}" class="s-btn s-btn-primary">Keep my draft</button>
      </div>
    </form>`;
  documentRef.body.append(dialog);
  return new Promise((resolveChoice) =>
  {
    dialog.addEventListener('close', () =>
    {
      const choice = dialog.returnValue === STUDIO_SAVE_CHOICE.useSaved ? STUDIO_SAVE_CHOICE.useSaved : STUDIO_SAVE_CHOICE.keepDraft;
      dialog.remove();
      resolveChoice(choice);
    });
    dialog.showModal();
  });
}
