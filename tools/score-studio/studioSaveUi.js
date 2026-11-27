// tools/score-studio/studioSaveUi.js — the Studio side of File > Save (SS-003): registers the card and art
// layer files, drives the #draft-status pill, settles the draft against the saved files, and runs a Save.

import {
  chooseDraftOrSavedFile,
  createStudioSave,
  registerStudioSaveFile,
  STUDIO_SAVE_CHOICE,
  STUDIO_SAVE_PILL_TEXT,
  STUDIO_SAVE_RESULT,
  STUDIO_SAVE_STATUS,
} from './studioSave.js';
import {
  STUDIO_SAVE_DIR,
  STUDIO_SAVE_DOWNLOAD_NAME,
  STUDIO_SAVE_FILES,
  STUDIO_SAVE_FILE_NAMES,
} from './studioSaveFiles.js';

const DRAFT_STATUS_ID = 'draft-status';
const DIRTY_CLASS = 'is-dirty';
const LOADING_CLASS = 'is-loading';
const FAILED_PILL_MS = 2500;
const DRAFT_CARRIED_FILES = Object.freeze([
  STUDIO_SAVE_FILE_NAMES.cards,
  STUDIO_SAVE_FILE_NAMES.artLayers,
]);
const TOAST_TEXT = Object.freeze({
  [STUDIO_SAVE_RESULT.saved]: `Saved Studio cards and art to ${STUDIO_SAVE_DIR}/`,
  [STUDIO_SAVE_RESULT.unchanged]: 'No Studio changes since the last Save',
  [STUDIO_SAVE_RESULT.downloaded]: `Downloaded ${STUDIO_SAVE_DOWNLOAD_NAME}`,
  loadFailed: 'Could not read the Studio save files',
});

export const STUDIO_SAVE_MENU_LABEL = Object.freeze({
  local: 'Save Studio cards and art (Ctrl+S)',
  web: 'Download Studio cards and art (Ctrl+S)',
});

async function fetchJson(url, init)
{
  const response = await fetch(url, init);
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
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

/**
 * deps: state, editedCards, removedCoreIds, mergeStudioCards, isLocalServer, isTextEntry,
 * flushDraft, writeDraftNow, refreshDirtyStatus, toast, download and clone.
 */
export function initStudioSaveUi(deps)
{
  const { state, clone } = deps;
  const controller = createStudioSave({
    isLocalServer: deps.isLocalServer,
    fetchJson,
    download: deps.download,
  });
  let failedUntil = 0;

  registerStudioSaveFile({
    name: STUDIO_SAVE_FILE_NAMES.cards,
    path: STUDIO_SAVE_FILES.cards.path,
    read: () => ({
      cards: deps.editedCards(),
      removedCardIds: deps.removedCoreIds(),
    }),
    apply: (data) => deps.mergeStudioCards(clone(data.cards), data.removedCardIds),
  });
  registerStudioSaveFile({
    name: STUDIO_SAVE_FILE_NAMES.artLayers,
    path: STUDIO_SAVE_FILES.artLayers.path,
    read: () => ({
      cardArtLayers: state.artLayers,
      itemArtLayers: state.itemArtLayers,
    }),
    apply: (data) => Object.assign(state, clone({
      artLayers: data.cardArtLayers,
      itemArtLayers: data.itemArtLayers,
    })),
  });

  function paintPill(pill, { text, title, dirty })
  {
    pill.classList.remove(LOADING_CLASS);
    pill.classList.toggle(DIRTY_CLASS, dirty);
    pill.textContent = text;
    pill.title = title;
  }

  /** Writes the Save status into the pill; false when the Save scope has nothing to say. */
  function decoratePill(pill)
  {
    if (Date.now() < failedUntil)
    {
      return true;
    }
    const description = controller.describe();
    if (description)
    {
      paintPill(pill, description);
    }
    return Boolean(description);
  }

  async function loadSavedFiles()
  {
    try
    {
      await controller.load();
    }
    catch (error)
    {
      deps.toast(`${TOAST_TEXT.loadFailed}: ${error.message}`);
    }
    controller.captureBaseline();
  }

  function draftSaveScope(draft)
  {
    return {
      cards: {
        cards: arrayOrEmpty(draft.customCards),
        removedCardIds: arrayOrEmpty(draft.removedCardIds),
      },
      artLayers: {
        cardArtLayers: layersOr(draft.artLayers, state.artLayers),
        itemArtLayers: layersOr(draft.itemArtLayers, state.itemArtLayers),
      },
    };
  }

  function draftNeedsChoice(draft)
  {
    const scope = draftSaveScope(draft);
    const madeFromThisSave = Boolean(draft.studioSaveRevision) && draft.studioSaveRevision === controller.revision();
    const noSaveYet = !draft.studioSaveRevision && !controller.anyOnDisk();
    const sameContent = controller.matchesSaved(STUDIO_SAVE_FILE_NAMES.cards, scope.cards)
      && controller.matchesSaved(STUDIO_SAVE_FILE_NAMES.artLayers, scope.artLayers);
    return deps.isLocalServer && !madeFromThisSave && !noSaveYet && !sameContent;
  }

  function putSavedFilesIntoDraft(draft)
  {
    const savedCards = controller.loadedFile(STUDIO_SAVE_FILE_NAMES.cards) ?? { cards: [], removedCardIds: [] };
    const savedArt = controller.loadedFile(STUDIO_SAVE_FILE_NAMES.artLayers) ?? {
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

  /** A draft made from other saved content than the files hold now asks one question before it applies. */
  async function reconcileDraft(draft)
  {
    if (!draftNeedsChoice(draft))
    {
      return;
    }
    if (await chooseDraftOrSavedFile() === STUDIO_SAVE_CHOICE.useSaved)
    {
      putSavedFilesIntoDraft(draft);
    }
  }

  /** With a draft, the files it carries (cards, art layers) come from the draft. */
  function applySavedFiles({ draftApplies })
  {
    controller.applyLoaded(draftApplies
      ? DRAFT_CARRIED_FILES
      : []);
  }

  function showFailed(pill, message)
  {
    failedUntil = Date.now() + FAILED_PILL_MS;
    paintPill(pill, {
      text: STUDIO_SAVE_PILL_TEXT.failed,
      title: message ?? '',
      dirty: true,
    });
    setTimeout(() =>
    {
      failedUntil = 0;
      deps.refreshDirtyStatus();
    }, FAILED_PILL_MS);
  }

  /** Blurring and refocusing the field commits its value and ends its edit burst. */
  function commitFocusedField()
  {
    const focused = document.activeElement;
    if (deps.isTextEntry(focused))
    {
      focused.blur();
      focused.focus();
    }
  }

  async function save()
  {
    commitFocusedField();
    deps.flushDraft();
    const pill = document.getElementById(DRAFT_STATUS_ID);
    if (deps.isLocalServer)
    {
      pill.textContent = STUDIO_SAVE_PILL_TEXT.saving;
    }
    const outcome = await controller.save();
    deps.toast(outcome.message ?? TOAST_TEXT[outcome.result]);
    if (outcome.result === STUDIO_SAVE_RESULT.failed)
    {
      showFailed(pill, outcome.message);
      return outcome;
    }
    deps.writeDraftNow();
    return outcome;
  }

  return {
    decoratePill,
    loadSavedFiles,
    reconcileDraft,
    applySavedFiles,
    save,
    revision: () => controller.revision(),
    hasStatus: () => controller.status() !== STUDIO_SAVE_STATUS.none,
  };
}
