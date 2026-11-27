// File > Save for the Studio's own config. RegisterStudioSaveFile({ name, path, kind, read,
// apply }) adds a StudioSaveFiles entry; read() gives its data keys, apply(data) takes them.

import {
  StudioSaveDownloadKind,
  StudioSaveDownloadName,
  StudioSaveEndpoint,
  StudioSaveFiles,
  StudioSaveFormatVersion,
  StableJson,
  StudioSaveData,
  StudioSaveDocument,
} from './studioSaveFiles.js';

export const StudioSaveStatus = Object.freeze({
  None: 'none',
  Draft: 'draft',
  Saved: 'saved',
  Web: 'web',
});

export const StudioSaveResult = Object.freeze({
  Saved: 'saved',
  Unchanged: 'unchanged',
  Downloaded: 'downloaded',
  Stale: 'stale',
  Failed: 'failed',
});

export const StudioSaveChoice = Object.freeze({
  KeepDraft: 'keepDraft',
  UseSaved: 'useSaved',
});

export const StudioSavePillText = Object.freeze({
  Draft: 'Draft',
  Saved: 'Saved',
  Saving: 'Saving…',
  Failed: 'Save failed',
  Web: 'Web mode · Download',
  WebShort: 'Web · Download',
});

const draftTitle = 'Studio edits are in the local draft only. File > Save (Ctrl+S) writes:';
const savedTitle = 'Saved';
const webTitle = `No local server: File > Save (Ctrl+S) downloads ${StudioSaveDownloadName}.`;
const contentTypeHeader = 'Content-Type';
const jsonContentType = 'application/json';
const postMethod = 'POST';
const noStore = 'no-store';
const httpOk = 200;
const httpConflict = 409;
const lineBreak = '\n';
const closeEvent = 'close';
const dialogFormMethod = 'dialog';
const elementTag = Object.freeze({
  dialog: 'dialog',
  form: 'form',
  heading: 'h3',
  paragraph: 'p',
  actions: 'div',
  button: 'button',
});
const choiceDialogClass = Object.freeze({
  dialog: 'studio-modal',
  note: 'studio-muted',
  actions: 'modal-actions',
  button: 's-btn',
  primaryButton: 's-btn s-btn-primary',
});
const choiceDialogText = Object.freeze({
  heading: 'The Studio save files changed',
  note: 'They changed after your local draft was made (another tab, or a git pull).',
  useSaved: 'Use the saved file',
  keepDraft: 'Keep my draft',
});

// Absolute paths, quoted as Node errors quote them, or bare Windows paths.
const quotedAbsolutePath = /'(?:[A-Za-z]:[\\/]|\/)[^']*'/g;
const bareWindowsPath = /\b[A-Za-z]:[\\/][^\s'"]*/g;
const pathSeparator = /[\\/]/;
const quoteMark = "'";
const failedMessage = 'Save failed. The save files may be read-only or open elsewhere.';

const registeredFiles = new Map();

function isoNow()
{
  return new Date().toISOString();
}

function latestTime(first, second)
{
  return [first, second].filter(Boolean).sort().at(-1) ?? null;
}

function currentJson(file)
{
  return StableJson(file.read());
}

function currentJsonByName()
{
  const entries = RegisteredStudioSaveFiles().map((file) => [
    file.name,
    currentJson(file),
  ]);
  return new Map(entries);
}

function pathList()
{
  return RegisteredStudioSaveFiles().map((file) => file.path).join(lineBreak);
}

function fileNameOf(path)
{
  return path.split(pathSeparator).filter(Boolean).at(-1) ?? path;
}

function quotedFileNameOf(quotedPath)
{
  const path = quotedPath.slice(1, -1);
  return `${quoteMark}${fileNameOf(path)}${quoteMark}`;
}

function isOkReply(reply)
{
  return reply.status === httpOk && Boolean(reply.json?.ok);
}

function documentsToSave(savedAt)
{
  const entries = RegisteredStudioSaveFiles().map((file) =>
  {
    const document = StudioSaveDocument(
      file.name,
      file.read(),
      savedAt,
      file.kind,
    );
    return [file.name, document];
  });
  return Object.fromEntries(entries);
}

// message is short, with each absolute path cut to its file name; detail is the full text.
function refusedOutcome(result, detail)
{
  const message = detail === undefined
    ? undefined
    : ShortStudioSaveMessage(detail);
  return {
    result,
    message,
    detail,
  };
}

// spec is { tag, ...properties }; the properties are set on the new element.
function renderElement(documentRef, spec)
{
  const {
    tag,
    ...properties
  } = spec;
  const element = documentRef.createElement(tag);
  Object.assign(element, properties);
  return element;
}

function renderChoiceActions(documentRef)
{
  const actions = renderElement(documentRef, {
    tag: elementTag.actions,
    className: choiceDialogClass.actions,
  });
  const useSavedButton = renderElement(documentRef, {
    tag: elementTag.button,
    value: StudioSaveChoice.UseSaved,
    className: choiceDialogClass.button,
    textContent: choiceDialogText.useSaved,
  });
  const keepDraftButton = renderElement(documentRef, {
    tag: elementTag.button,
    value: StudioSaveChoice.KeepDraft,
    className: choiceDialogClass.primaryButton,
    textContent: choiceDialogText.keepDraft,
  });
  actions.append(useSavedButton, keepDraftButton);
  return actions;
}

function renderChoiceForm(documentRef)
{
  const form = renderElement(documentRef, {
    tag: elementTag.form,
    method: dialogFormMethod,
  });
  const heading = renderElement(documentRef, {
    tag: elementTag.heading,
    textContent: choiceDialogText.heading,
  });
  const note = renderElement(documentRef, {
    tag: elementTag.paragraph,
    className: choiceDialogClass.note,
    textContent: choiceDialogText.note,
  });
  form.append(
    heading,
    note,
    renderChoiceActions(documentRef),
  );
  return form;
}

class StudioSaveController
{
  #isLocalServer;
  #fetchJson;
  #download;
  #now;
  #revision = null;
  #lastSavedAt = null;
  #lastSavedJson = new Map();
  #onDisk = new Map();
  #loadedData = new Map();

  constructor(options)
  {
    this.#isLocalServer = options.isLocalServer;
    this.#fetchJson = options.fetchJson;
    this.#download = options.download;
    this.#now = options.now;
  }

  async load()
  {
    if (!this.#isLocalServer)
    {
      return null;
    }
    const reply = await this.#fetchJson(StudioSaveEndpoint, { cache: noStore });
    if (!isOkReply(reply))
    {
      const fallbackError = `Could not read the Studio save files (${reply.status}).`;
      throw new Error(reply.json?.error || fallbackError);
    }
    this.#revision = reply.json.revision;
    const savedFiles = reply.json.files;
    for (const file of RegisteredStudioSaveFiles())
    {
      const document = savedFiles?.[file.name];
      if (document)
      {
        this.#rememberLoaded(file, document);
      }
    }
    return { revision: this.#revision };
  }

  // For each file not on disk, what the Studio holds now is the clean state.
  // Call it before a draft applies.
  captureBaseline()
  {
    for (const file of RegisteredStudioSaveFiles())
    {
      if (!this.#onDisk.get(file.name))
      {
        this.#lastSavedJson.set(file.name, currentJson(file));
      }
    }
  }

  loadedFile(name)
  {
    return this.#loadedData.get(name) ?? null;
  }

  anyOnDisk()
  {
    return RegisteredStudioSaveFiles().some((file) => this.#onDisk.get(file.name));
  }

  /** Hands each loaded file to its apply(), except the names in skipNames. */
  applyLoaded(skipNames = [])
  {
    for (const file of RegisteredStudioSaveFiles())
    {
      const isSkipped = skipNames.includes(file.name);
      const appliesNow = file.apply && this.#onDisk.get(file.name) && !isSkipped;
      if (appliesNow)
      {
        file.apply(this.#loadedData.get(file.name));
      }
    }
  }

  matchesSaved(name, data)
  {
    return this.#lastSavedJson.get(name) === StableJson(data);
  }

  status()
  {
    if (!this.#isLocalServer)
    {
      return StudioSaveStatus.Web;
    }
    if (this.#changedFiles().length)
    {
      return StudioSaveStatus.Draft;
    }
    return this.anyOnDisk()
      ? StudioSaveStatus.Saved
      : StudioSaveStatus.None;
  }

  // The pill's text, optional narrow-screen shortText and title for the Save scope,
  // or null when there is no file and no edit.
  describe()
  {
    const describers = {
      [StudioSaveStatus.Web]: () => this.#webPill(),
      [StudioSaveStatus.Draft]: () => this.#draftPill(),
      [StudioSaveStatus.Saved]: () => this.#savedPill(),
      [StudioSaveStatus.None]: () => null,
    };
    return describers[this.status()]();
  }

  async save()
  {
    if (!this.#isLocalServer)
    {
      return this.#downloadAll();
    }
    if (this.status() === StudioSaveStatus.Saved)
    {
      return { result: StudioSaveResult.Unchanged };
    }
    const submittedJson = currentJsonByName();
    const reply = await this.#postAll();
    if (reply.status === httpConflict)
    {
      return refusedOutcome(StudioSaveResult.Stale, reply.json?.error);
    }
    if (!isOkReply(reply))
    {
      const detail = reply.json?.error || `Save failed (${reply.status}).`;
      return {
        result: StudioSaveResult.Failed,
        message: failedMessage,
        detail,
      };
    }
    return this.#acceptSaved(
      reply.json,
      submittedJson,
    );
  }

  revision()
  {
    return this.#revision;
  }

  #changedFiles()
  {
    return RegisteredStudioSaveFiles()
      .filter((file) => this.#lastSavedJson.get(file.name) !== currentJson(file));
  }

  #rememberLoaded(file, document)
  {
    if (document.kind !== file.kind)
    {
      throw new Error(`${file.path} has kind "${document.kind}", expected "${file.kind}".`);
    }
    const data = StudioSaveData(file.name, document);
    this.#loadedData.set(file.name, data);
    this.#lastSavedJson.set(file.name, StableJson(data));
    this.#onDisk.set(file.name, true);
    this.#lastSavedAt = latestTime(this.#lastSavedAt, document.savedAt);
  }

  #savedHeading()
  {
    return this.#lastSavedAt
      ? `${savedTitle} ${new Date(this.#lastSavedAt).toLocaleString()}`
      : savedTitle;
  }

  #webPill()
  {
    return {
      text: StudioSavePillText.Web,
      shortText: StudioSavePillText.WebShort,
      title: webTitle,
      dirty: this.#changedFiles().length > 0,
    };
  }

  #draftPill()
  {
    return {
      text: StudioSavePillText.Draft,
      title: [draftTitle, pathList()].join(lineBreak),
      dirty: true,
    };
  }

  #savedPill()
  {
    return {
      text: StudioSavePillText.Saved,
      title: [this.#savedHeading(), pathList()].join(lineBreak),
      dirty: false,
    };
  }

  // submittedJson holds what the request sent; edits made while it was in flight stay Draft.
  #markSaved(savedAt, submittedJson)
  {
    for (const [name, json] of submittedJson)
    {
      this.#lastSavedJson.set(name, json);
      this.#onDisk.set(name, true);
    }
    this.#lastSavedAt = savedAt ?? this.#lastSavedAt;
  }

  #acceptSaved(replyJson, submittedJson)
  {
    this.#revision = replyJson.revision;
    this.#markSaved(
      replyJson.savedAt,
      submittedJson,
    );
    return {
      result: replyJson.written.length
        ? StudioSaveResult.Saved
        : StudioSaveResult.Unchanged,
    };
  }

  #downloadAll()
  {
    const savedAt = this.#now();
    this.#download(StudioSaveDownloadName, {
      kind: StudioSaveDownloadKind,
      formatVersion: StudioSaveFormatVersion,
      savedAt,
      files: documentsToSave(savedAt),
    });
    return { result: StudioSaveResult.Downloaded };
  }

  async #postAll()
  {
    try
    {
      return await this.#fetchJson(StudioSaveEndpoint, {
        method: postMethod,
        headers: {
          [contentTypeHeader]: jsonContentType,
        },
        body: JSON.stringify({
          revision: this.#revision,
          files: documentsToSave(null),
        }),
      });
    }
    catch (error)
    {
      return {
        status: null,
        json: {
          error: error.message,
        },
      };
    }
  }
}

export function RegisterStudioSaveFile(file)
{
  const {
    name,
    path,
    kind,
    read,
    apply,
  } = file;
  const spec = StudioSaveFiles[name];
  const fileKind = kind ?? spec?.kind;
  const matchesSpec = Boolean(spec) && spec.path === path && spec.kind === fileKind;
  if (!matchesSpec)
  {
    const fileLabel = `"${name}" (${path}, ${fileKind})`;
    throw new Error(`Unknown Studio Save file ${fileLabel}. Add it to StudioSaveFiles first.`);
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

/** The message with every absolute path cut to its file name, so it stays short. */
export function ShortStudioSaveMessage(message)
{
  return String(message)
    .replace(quotedAbsolutePath, quotedFileNameOf)
    .replace(bareWindowsPath, fileNameOf);
}

export function RegisteredStudioSaveFiles()
{
  return [...registeredFiles.values()];
}

/** Test seam: forget every registration. */
export function ClearStudioSaveFiles()
{
  registeredFiles.clear();
}

// The Save controller. fetchJson(url, init) gives { status, json };
// download(name, value) saves a web-mode file.
export function CreateStudioSave({
  isLocalServer,
  fetchJson,
  download,
  now = isoNow,
})
{
  return new StudioSaveController({
    isLocalServer,
    fetchJson,
    download,
    now,
  });
}

/** One choice, Keep my draft or Use the saved file. Escape keeps the draft. */
export function ChooseDraftOrSavedFile(documentRef = document)
{
  const dialog = renderElement(documentRef, {
    tag: elementTag.dialog,
    className: choiceDialogClass.dialog,
  });
  dialog.append(renderChoiceForm(documentRef));
  documentRef.body.append(dialog);
  return new Promise((resolveChoice) =>
  {
    dialog.addEventListener(closeEvent, () =>
    {
      const choice = dialog.returnValue === StudioSaveChoice.UseSaved
        ? StudioSaveChoice.UseSaved
        : StudioSaveChoice.KeepDraft;
      dialog.remove();
      resolveChoice(choice);
    });
    dialog.showModal();
  });
}
