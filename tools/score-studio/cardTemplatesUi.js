// tools/score-studio/cardTemplatesUi.js — card templates in the Studio (SS-004): where they are stored, Save as
// template, the Add card picker and Tools > Card templates. The data rules live in cardTemplates.js.
import {
  CARD_TEMPLATES_PATH,
  TEMPLATE_NAME_LIMIT,
  TemplateFile,
  ParseTemplateFile,
  SaveCardAsTemplate,
  GroupTemplatesByType,
  MissingArtLayerIds,
  createMemoryTemplateStore,
} from './cardTemplates.js';

const SAVE_FILE_LABEL = 'Card templates';
const BLANK_CHOICE = 'blank';
const DEFAULT_COST = 0;
const DEFAULT_RARITY = 'common';
const NO_EFFECTS = 'no effects';
const OTHER_TYPE_LABEL = 'Other';

const EVENT_CLICK = 'click';
const EVENT_SUBMIT = 'submit';
const EVENT_CLOSE = 'close';
const EVENT_KEYDOWN = 'keydown';

const LIST_KEYS = Object.freeze([
  'ArrowDown',
  'ArrowUp',
  'Home',
  'End',
]);
const KEY_UP = 'ArrowUp';
const KEY_HOME = 'Home';
const KEY_END = 'End';

const CLASS_DIALOG = 'studio-modal card-template-dialog';
const CLASS_SAVE_DIALOG = 'card-template-save-dialog';
const CLASS_PICKER = 'card-template-picker';
const CLASS_CHOICE = 'card-template-choice';
const CLASS_BLANK_CHOICE = 'is-blank';
const CLASS_NAME = 'card-template-name';
const CLASS_NOTE = 'card-template-note';
const CLASS_GROUP_LABEL = 'card-template-group-label';
const CLASS_EMPTY = 'card-template-empty';

const ID_SAVE_TITLE = 'card-template-save-title';
const ID_REPLACE_TITLE = 'card-template-replace-title';
const ID_PICKER_TITLE = 'card-template-picker-title';

const ATTR_LABELLED_BY = 'aria-labelledby';
const SELECTOR_CANCEL = '[data-template-cancel]';
const SELECTOR_ERROR = '[data-template-error]';
const SELECTOR_SOURCE = '[data-template-source]';
const SELECTOR_NAME_FORM = '[data-template-name-form]';
const SELECTOR_REPLACE_FORM = '[data-template-replace-form]';
const SELECTOR_REPLACE_TITLE = '[data-template-replace-title]';
const SELECTOR_NAME_INPUT = '[name="template-name"]';
const SELECTOR_CHOICES = '[data-template-choices]';
const SELECTOR_CHOICE = '[data-template-choice]';
const SELECTOR_BLANK_CHOICE = `[data-template-choice="${BLANK_CHOICE}"]`;
const SELECTOR_ADD_CARD_BUTTON = '.studio-add-card-button';

const clone = value => structuredClone(value);
const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));
const typeLabel = type => (type ? type[0].toUpperCase() + type.slice(1) : OTHER_TYPE_LABEL);

function makeDialog(className, titleId, html)
{
  const dialog = document.createElement('dialog');
  dialog.className = `${CLASS_DIALOG} ${className}`;
  dialog.setAttribute(ATTR_LABELLED_BY, titleId);
  dialog.innerHTML = html;
  document.body.append(dialog);
  return dialog;
}

// The one-line summary shown on hover: type, costs, rarity and effects.
function templateDetails(template, missingLayerIds = [])
{
  const card = template.card || {};
  const costs = [`${card.staminaCost ?? card.cost ?? DEFAULT_COST} SP`];
  if (card.manaCost)
  {
    costs.push(`${card.manaCost} MP`);
  }
  const effects = (card.effects || []).map(effect => effect.op).join(', ') || NO_EFFECTS;
  const lines = [`${typeLabel(template.cardType)} · ${costs.join(' ')} · ${card.rarity || DEFAULT_RARITY} · ${effects}`];
  if (missingLayerIds.length)
  {
    lines.push(`Art layers no longer there: ${missingLayerIds.join(', ')}`);
  }
  return lines.join('\n');
}

// Up and Down move between the buttons of a list; Home and End jump to its ends.
function wireArrowKeys(container, selector)
{
  container.addEventListener(EVENT_KEYDOWN, event =>
  {
    if (!LIST_KEYS.includes(event.key))
    {
      return;
    }
    const nodes = [...container.querySelectorAll(selector)].filter(node => !node.disabled && node.getClientRects().length);
    const index = nodes.indexOf(document.activeElement);
    if (index < 0)
    {
      return;
    }
    event.preventDefault();
    const step = event.key === KEY_UP ? -1 : 1;
    const target = event.key === KEY_HOME ? nodes[0]
      : event.key === KEY_END ? nodes.at(-1)
        : nodes[(index + step + nodes.length) % nodes.length];
    target?.focus();
  });
}

/**
 * ctx: { state, checkCard(card) -> problem text or '', pushHistory, saveDraft, toast, artLayerIdsFor(card),
 * artLayers() -> the card art layers, createBlankCard(), createCardFromTemplate(template) }.
 * Templates live in `state.templates` (so Undo, the snapshot and the local draft cover them);
 * `state.savedTemplates` is the last stored copy.
 */
export function initCardTemplatesUi(ctx)
{
  const { state } = ctx;
  let store = createMemoryTemplateStore();

  // The one persistence adapter. The default store is in memory, so templates last for the session and in
  // the local draft.
  // SS-003 integration: register the committed file with the Studio Save path, roughly
  //   registerStudioSaveFile({ name: saveFile.name, path: saveFile.path, read: saveFile.read, apply: saveFile.apply })
  // so File > Save writes content/source/studio/templates.json, it loads on start and Draft/Saved counts it.
  function connectStore(nextStore)
  {
    store = nextStore;
    return applyStoredFile(store.load());
  }

  // Loads a stored file as the saved templates. A missing file means none; a broken one changes nothing.
  function applyStoredFile(raw)
  {
    const parsed = raw == null ? { templates: [] } : ParseTemplateFile(raw, { checkCard: ctx.checkCard });
    if (parsed.problem)
    {
      return parsed.problem;
    }
    state.templates = parsed.templates;
    state.savedTemplates = clone(parsed.templates);
    return '';
  }

  function markSaved()
  {
    store.save(TemplateFile(state.templates));
    state.savedTemplates = clone(state.templates);
  }

  const saveFile = Object.freeze({
    name: SAVE_FILE_LABEL,
    path: CARD_TEMPLATES_PATH,
    read: () => TemplateFile(state.templates),
    apply: raw => applyStoredFile(raw),
  });

  const changed = () => JSON.stringify(state.templates || []) !== JSON.stringify(state.savedTemplates || []);

  // Templates from the local draft: checked as a whole file first, so a bad draft keeps the saved ones.
  function restoreDraft(list)
  {
    if (!Array.isArray(list))
    {
      return false;
    }
    const parsed = ParseTemplateFile(TemplateFile(list), { checkCard: ctx.checkCard });
    if (parsed.problem)
    {
      return false;
    }
    state.templates = parsed.templates;
    return true;
  }

  function revert()
  {
    state.templates = clone(state.savedTemplates || []);
  }

  // Every template change is one Undo step and goes into the draft; no card changes.
  function commitTemplates(next)
  {
    ctx.pushHistory();
    state.templates = next;
    ctx.saveDraft({ autoName: false });
    refresh();
  }

  // Save as template… (card ⋮ menu): a name, the JSON dialog's checks, and a confirmed Replace for a taken name.
  let saveDialog = null;
  function saveDialogElement()
  {
    if (saveDialog)
    {
      return saveDialog;
    }
    saveDialog = makeDialog(CLASS_SAVE_DIALOG, ID_SAVE_TITLE, `
      <form data-template-name-form>
        <h3 id="${ID_SAVE_TITLE}">Save as template</h3>
        <p class="studio-muted" data-template-source></p>
        <label class="card-template-field">Template name <input name="template-name" maxlength="${TEMPLATE_NAME_LIMIT}" autocomplete="off" spellcheck="false" /></label>
        <p class="card-json-error" role="alert" data-template-error></p>
        <div class="card-template-actions"><button type="button" class="s-btn" data-template-cancel>Cancel</button><button type="submit" class="s-btn s-btn-primary">Save</button></div>
      </form>
      <form data-template-replace-form hidden>
        <h3 id="${ID_REPLACE_TITLE}" data-template-replace-title></h3>
        <p class="studio-muted">Cards made from it stay as they are.</p>
        <div class="card-template-actions"><button type="button" class="s-btn" data-template-cancel>Cancel</button><button type="submit" class="s-btn s-btn-primary">Replace</button></div>
      </form>`);
    for (const button of saveDialog.querySelectorAll(SELECTOR_CANCEL))
    {
      button.addEventListener(EVENT_CLICK, () => saveDialog.close());
    }
    saveDialog.querySelector(SELECTOR_NAME_FORM).addEventListener(EVENT_SUBMIT, event =>
    {
      event.preventDefault();
      submitSave(false);
    });
    saveDialog.querySelector(SELECTOR_REPLACE_FORM).addEventListener(EVENT_SUBMIT, event =>
    {
      event.preventDefault();
      submitSave(true);
    });
    return saveDialog;
  }

  function showSaveStep(replaceName = null)
  {
    const replacing = replaceName !== null;
    saveDialog.querySelector(SELECTOR_NAME_FORM).hidden = replacing;
    saveDialog.querySelector(SELECTOR_REPLACE_FORM).hidden = !replacing;
    saveDialog.setAttribute(ATTR_LABELLED_BY, replacing ? ID_REPLACE_TITLE : ID_SAVE_TITLE);
    if (replacing)
    {
      saveDialog.querySelector(SELECTOR_REPLACE_TITLE).textContent = `Replace template ${replaceName}?`;
      saveDialog.querySelector(`${SELECTOR_REPLACE_FORM} ${SELECTOR_CANCEL}`).focus();
    }
  }

  function openSaveAsTemplate(cardId)
  {
    const card = state.cards.find(entry => entry.id === cardId);
    if (!card)
    {
      return;
    }
    const dialog = saveDialogElement();
    dialog.dataset.cardId = cardId;
    showSaveStep();
    dialog.querySelector(SELECTOR_SOURCE).textContent = `Keeps the mechanics of "${card.name || card.id}". New cards from it get their own ID and name.`;
    dialog.querySelector(SELECTOR_ERROR).textContent = '';
    const input = dialog.querySelector(SELECTOR_NAME_INPUT);
    input.value = card.name || '';
    dialog.showModal();
    input.focus();
    input.select();
  }

  function submitSave(replace)
  {
    const error = saveDialog.querySelector(SELECTOR_ERROR);
    const card = state.cards.find(entry => entry.id === saveDialog.dataset.cardId);
    if (!card)
    {
      saveDialog.close();
      return;
    }
    const showProblem = problem =>
    {
      showSaveStep();
      error.textContent = problem;
    };
    // Same checks as the JSON dialog, before anything is stored.
    const cardProblem = ctx.checkCard(card);
    if (cardProblem)
    {
      showProblem(cardProblem);
      return;
    }
    const name = saveDialog.querySelector(SELECTOR_NAME_INPUT).value;
    const result = SaveCardAsTemplate(state.templates, card, { name, artLayerIds: ctx.artLayerIdsFor(card), replace });
    if (result.problem)
    {
      showProblem(result.problem);
      return;
    }
    if (result.taken)
    {
      showSaveStep(result.taken.name);
      return;
    }
    commitTemplates(result.templates);
    saveDialog.close();
    ctx.toast(`${result.replaced ? 'Replaced' : 'Saved'} template "${result.template.name}"`);
  }

  // The Add card picker: Blank first (today's New), then templates grouped by card type.
  let picker = null;
  let pickerOpener = null;
  let pickerChosen = false;
  function pickerElement()
  {
    if (picker)
    {
      return picker;
    }
    picker = makeDialog(CLASS_PICKER, ID_PICKER_TITLE, `
      <h3 id="${ID_PICKER_TITLE}">Add card</h3>
      <div class="card-template-choices" data-template-choices></div>
      <div class="card-template-actions"><button type="button" class="s-btn" data-template-cancel>Cancel</button></div>`);
    picker.querySelector(SELECTOR_CANCEL).addEventListener(EVENT_CLICK, () => picker.close());
    const choices = picker.querySelector(SELECTOR_CHOICES);
    choices.addEventListener(EVENT_CLICK, event => choose(event.target.closest(SELECTOR_CHOICE)));
    wireArrowKeys(choices, SELECTOR_CHOICE);
    // Escape or Cancel: nothing is made, and focus goes back to Add card.
    picker.addEventListener(EVENT_CLOSE, () =>
    {
      if (pickerChosen)
      {
        return;
      }
      const openerVisible = pickerOpener?.isConnected && pickerOpener.getClientRects().length;
      (openerVisible ? pickerOpener : document.querySelector(SELECTOR_ADD_CARD_BUTTON))?.focus();
    });
    return picker;
  }

  function choose(choice)
  {
    if (!choice)
    {
      return;
    }
    const id = choice.dataset.templateChoice;
    const template = id === BLANK_CHOICE ? null : state.templates.find(entry => entry.id === id);
    if (id !== BLANK_CHOICE && !template)
    {
      return;
    }
    pickerChosen = true;
    picker.close();
    if (template)
    {
      ctx.createCardFromTemplate(clone(template));
    }
    else
    {
      ctx.createBlankCard();
    }
  }

  function renderPickerChoices()
  {
    const layers = ctx.artLayers();
    const groups = GroupTemplatesByType(state.templates);
    const rows = [`<button type="button" class="${CLASS_CHOICE} ${CLASS_BLANK_CHOICE}" data-template-choice="${BLANK_CHOICE}" title="A blank Skill with New card defaults">Blank</button>`];
    for (const group of groups)
    {
      rows.push(`<div class="${CLASS_GROUP_LABEL}">${escapeHtml(typeLabel(group.type))}</div>`);
      for (const template of group.templates)
      {
        const missing = MissingArtLayerIds(template, layers);
        const note = missing.length ? `<span class="${CLASS_NOTE}">layers gone</span>` : '';
        rows.push(`<button type="button" class="${CLASS_CHOICE}" data-template-choice="${escapeHtml(template.id)}" title="${escapeHtml(templateDetails(template, missing))}">`
          + `<span class="${CLASS_NAME}">${escapeHtml(template.name)}</span>${note}</button>`);
      }
    }
    if (!groups.length)
    {
      rows.push(`<p class="studio-muted ${CLASS_EMPTY}">No templates yet. Use Save as template… in a card's ⋮ menu.</p>`);
    }
    picker.querySelector(SELECTOR_CHOICES).innerHTML = rows.join('');
  }

  function openPicker()
  {
    const dialog = pickerElement();
    pickerOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pickerChosen = false;
    renderPickerChoices();
    dialog.showModal();
    dialog.querySelector(SELECTOR_BLANK_CHOICE).focus();
  }

  // Redraws whatever template views are open (after Undo, Redo, imports and saves).
  function refresh()
  {
    if (picker?.open)
    {
      renderPickerChoices();
    }
  }

  return {
    connectStore,
    markSaved,
    saveFile,
    changed,
    restoreDraft,
    revert,
    openSaveAsTemplate,
    openPicker,
    refresh,
  };
}
