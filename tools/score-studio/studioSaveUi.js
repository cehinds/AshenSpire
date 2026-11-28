// The Studio side of File > Save: registers the card and art layer files, drives the
// #draft-status pill, settles the draft against the saved files, and runs a Save.
// Card changes go into the game's card file, so the game plays the cards the Studio shows.

import {
  ChooseDraftOrSavedFile,
  CreateStudioSave,
  RegisterStudioSaveFile,
  StudioSaveChoice,
  StudioSavePillText,
  StudioSaveResult,
  StudioSaveStatus,
} from './studioSave.js';
import {
  StudioSaveDir,
  StudioSaveDownloadName,
  StudioSaveFiles,
  StudioSaveFileNames,
  StudioPackCardsPath,
} from './studioSaveFiles.js';

export const StudioSaveMenuLabel = Object.freeze({
  Local: 'Save Studio cards and art (Ctrl+S)',
  Web: 'Download Studio cards and art (Ctrl+S)',
});

const draftStatusId = 'draft-status';
const dirtyClass = 'is-dirty';
const loadingClass = 'is-loading';
const pillTextClass = Object.freeze({
  long: 'pill-long',
  short: 'pill-short',
});
const spanTag = 'span';
const failedPillMs = 2500;
// Saved cards are the game's cards, so only the art layers can differ from a draft.
const draftCarriedFiles = Object.freeze([StudioSaveFileNames.ArtLayers]);
const toastText = Object.freeze({
  [StudioSaveResult.Saved]: `Saved cards to ${StudioPackCardsPath} and rebuilt the game;`
    + ` art to ${StudioSaveDir}/. Reload to play them.`,
  [StudioSaveResult.Unchanged]: 'No Studio changes since the last Save',
  [StudioSaveResult.Downloaded]: `Downloaded ${StudioSaveDownloadName}`,
  loadFailed: 'Could not read the Studio save files',
  heldBack: (count) => ` ${count} card change(s) outside core. and custom. stay in the draft.`,
});
const savedResults = Object.freeze([
  StudioSaveResult.Saved,
  StudioSaveResult.Unchanged,
]);

async function fetchJson(url, init)
{
  const response = await fetch(url, init);
  const json = await response.json().catch(() => null);
  return {
    status: response.status,
    json,
  };
}

function hasLayers(layerSet)
{
  return Array.isArray(layerSet?.layers);
}

function layersOr(layerSet, fallback)
{
  return hasLayers(layerSet)
    ? layerSet
    : fallback;
}

function renderPillText(className, text)
{
  const span = document.createElement(spanTag);
  span.className = className;
  span.textContent = text;
  return span;
}

// A description with shortText gets both texts; the CSS shows the short one on narrow screens.
function paintPill(pill, description)
{
  pill.classList.remove(loadingClass);
  pill.classList.toggle(dirtyClass, description.dirty);
  pill.title = description.title;
  if (!description.shortText)
  {
    pill.textContent = description.text;
    return;
  }
  pill.replaceChildren(
    renderPillText(pillTextClass.long, description.text),
    renderPillText(pillTextClass.short, description.shortText),
  );
}

// Blurring and refocusing the field commits its value and ends its edit burst.
function commitFocusedField(isTextEntry)
{
  const focused = document.activeElement;
  if (isTextEntry(focused))
  {
    focused.blur();
    focused.focus();
  }
}

function registerCardsFile(deps)
{
  const cardsName = StudioSaveFileNames.Cards;
  RegisterStudioSaveFile({
    name: cardsName,
    path: StudioSaveFiles[cardsName].path,
    read: () => ({
      cards: deps.packCardChanges(),
      removedCardIds: deps.packRemovedIds(),
    }),
  });
}

function registerArtLayersFile(deps)
{
  const artLayersName = StudioSaveFileNames.ArtLayers;
  const { state, clone } = deps;
  RegisterStudioSaveFile({
    name: artLayersName,
    path: StudioSaveFiles[artLayersName].path,
    read: () => ({
      cardArtLayers: state.artLayers,
      itemArtLayers: state.itemArtLayers,
    }),
    apply: (data) =>
    {
      Object.assign(state, clone({
        artLayers: data.cardArtLayers,
        itemArtLayers: data.itemArtLayers,
      }));
    },
  });
}

class StudioSaveUi
{
  #deps;
  #controller;
  #failedUntil = 0;

  constructor(deps, controller)
  {
    this.#deps = deps;
    this.#controller = controller;
  }

  // Writes the Save status into the pill; false when the Save scope has nothing to say.
  decoratePill(pill)
  {
    if (Date.now() < this.#failedUntil)
    {
      return true;
    }
    const description = this.#controller.describe();
    if (description)
    {
      paintPill(pill, description);
    }
    return Boolean(description);
  }

  async loadSavedFiles()
  {
    try
    {
      await this.#controller.load();
    }
    catch (error)
    {
      this.#deps.toast(`${toastText.loadFailed}: ${error.message}`);
    }
    this.#controller.captureBaseline();
  }

  // A draft made from other saved content than the files hold now asks one question first.
  // The answer is stored with the draft at once, so the next load does not ask again.
  async reconcileDraft(draft)
  {
    if (!this.#draftNeedsChoice(draft))
    {
      return;
    }
    const chooseDraftOrSaved = this.#deps.chooseDraftOrSaved ?? ChooseDraftOrSavedFile;
    if (await chooseDraftOrSaved() === StudioSaveChoice.UseSaved)
    {
      this.#putSavedFilesIntoDraft(draft);
    }
    draft.studioSaveRevision = this.#controller.revision();
    this.#deps.storeDraft(draft);
  }

  // With a draft, the files it carries (cards, art layers) come from the draft.
  applySavedFiles({ draftApplies })
  {
    const skipNames = draftApplies
      ? draftCarriedFiles
      : [];
    this.#controller.applyLoaded(skipNames);
  }

  async save()
  {
    commitFocusedField(this.#deps.isTextEntry);
    this.#deps.flushDraft();
    const pill = document.getElementById(draftStatusId);
    if (this.#deps.isLocalServer)
    {
      pill.textContent = StudioSavePillText.Saving;
    }
    const outcome = await this.#controller.save();
    this.#deps.toast(this.#outcomeText(outcome));
    if (outcome.result === StudioSaveResult.Failed)
    {
      this.#showFailed(pill, outcome.detail);
      return outcome;
    }
    this.#deps.writeDraftNow();
    return outcome;
  }

  revision()
  {
    return this.#controller.revision();
  }

  hasStatus()
  {
    return this.#controller.status() !== StudioSaveStatus.None;
  }

  // True when the Studio differs from its saved files, even if it matches the game baseline.
  hasUnsavedChanges()
  {
    return this.#controller.status() === StudioSaveStatus.Draft;
  }

  #draftSaveScope(draft)
  {
    const { state } = this.#deps;
    return {
      [StudioSaveFileNames.ArtLayers]: {
        cardArtLayers: layersOr(draft.artLayers, state.artLayers),
        itemArtLayers: layersOr(draft.itemArtLayers, state.itemArtLayers),
      },
    };
  }

  #draftMatchesSavedFiles(draft)
  {
    const scope = this.#draftSaveScope(draft);
    return draftCarriedFiles.every((name) => this.#controller.matchesSaved(name, scope[name]));
  }

  #draftNeedsChoice(draft)
  {
    if (!this.#deps.isLocalServer)
    {
      return false;
    }
    const draftRevision = draft.studioSaveRevision;
    const madeFromThisSave = Boolean(draftRevision)
      && draftRevision === this.#controller.revision();
    const noSaveYet = !draftRevision && !this.#controller.anyOnDisk();
    if (madeFromThisSave || noSaveYet)
    {
      return false;
    }
    return !this.#draftMatchesSavedFiles(draft);
  }

  #putSavedFilesIntoDraft(draft)
  {
    const { state, clone } = this.#deps;
    const savedArt = this.#controller.loadedFile(StudioSaveFileNames.ArtLayers) ?? {
      cardArtLayers: state.repoArtLayers,
      itemArtLayers: state.repoItemArtLayers,
    };
    // Saved cards already live in the game's card file, so the draft drops its card edits.
    Object.assign(draft, clone({
      customCards: [],
      removedCardIds: [],
      artLayers: savedArt.cardArtLayers,
      itemArtLayers: savedArt.itemArtLayers,
    }));
  }

  #outcomeText(outcome)
  {
    const text = outcome.message ?? toastText[outcome.result];
    const heldBack = this.#deps.heldBackCardCount?.() ?? 0;
    const notesHeldBack = heldBack > 0 && savedResults.includes(outcome.result);
    return notesHeldBack
      ? `${text}${toastText.heldBack(heldBack)}`
      : text;
  }

  #showFailed(pill, message)
  {
    this.#failedUntil = Date.now() + failedPillMs;
    paintPill(pill, {
      text: StudioSavePillText.Failed,
      title: message ?? '',
      dirty: true,
    });
    setTimeout(() =>
    {
      this.#failedUntil = 0;
      this.#deps.refreshDirtyStatus();
    }, failedPillMs);
  }
}

// deps: state, packCardChanges, packRemovedIds, heldBackCardCount, isLocalServer, isTextEntry,
// flushDraft, writeDraftNow, storeDraft, refreshDirtyStatus, toast, download and clone.
export function InitStudioSaveUi(deps)
{
  const controller = CreateStudioSave({
    isLocalServer: deps.isLocalServer,
    fetchJson: deps.fetchJson ?? fetchJson,
    download: deps.download,
  });
  registerCardsFile(deps);
  registerArtLayersFile(deps);
  return new StudioSaveUi(deps, controller);
}
