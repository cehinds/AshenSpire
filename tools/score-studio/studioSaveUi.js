// The Studio side of File > Save: registers the card and art layer files, drives the
// #draft-status pill, settles the draft against the saved files, and runs a Save.

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
const draftCarriedFiles = Object.freeze([
  StudioSaveFileNames.Cards,
  StudioSaveFileNames.ArtLayers,
]);
const toastText = Object.freeze({
  [StudioSaveResult.Saved]: `Saved Studio cards and art to ${StudioSaveDir}/`,
  [StudioSaveResult.Unchanged]: 'No Studio changes since the last Save',
  [StudioSaveResult.Downloaded]: `Downloaded ${StudioSaveDownloadName}`,
  loadFailed: 'Could not read the Studio save files',
});

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

function arrayOrEmpty(value)
{
  return Array.isArray(value)
    ? value
    : [];
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
      cards: deps.editedCards(),
      removedCardIds: deps.removedCoreIds(),
    }),
    apply: (data) => deps.mergeStudioCards(deps.clone(data.cards), data.removedCardIds),
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
    this.#deps.toast(outcome.message ?? toastText[outcome.result]);
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

  #draftSaveScope(draft)
  {
    const { state } = this.#deps;
    return {
      [StudioSaveFileNames.Cards]: {
        cards: arrayOrEmpty(draft.customCards),
        removedCardIds: arrayOrEmpty(draft.removedCardIds),
      },
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
    const savedCards = this.#controller.loadedFile(StudioSaveFileNames.Cards) ?? {
      cards: [],
      removedCardIds: [],
    };
    const savedArt = this.#controller.loadedFile(StudioSaveFileNames.ArtLayers) ?? {
      cardArtLayers: state.repoArtLayers,
      itemArtLayers: state.repoItemArtLayers,
    };
    Object.assign(draft, clone({
      customCards: savedCards.cards,
      removedCardIds: savedCards.removedCardIds,
      artLayers: savedArt.cardArtLayers,
      itemArtLayers: savedArt.itemArtLayers,
    }));
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

// deps: state, editedCards, removedCoreIds, mergeStudioCards, isLocalServer, isTextEntry,
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
