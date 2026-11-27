// tools/score-studio/cardTemplatesUi.js — card templates in the Studio (SS-004): where they are stored, Save as
// template, the Add card picker and Tools > Card templates. The data rules live in cardTemplates.js.
import {
  CARD_TEMPLATES_PATH,
  CARD_TEMPLATES_FILE_NAME,
  TEMPLATE_NAME_LIMIT,
  TemplateFile,
  ParseTemplateFile,
  SaveCardAsTemplate,
  RenameTemplate,
  DeleteTemplate,
  MergeImportedTemplates,
  GroupTemplatesByType,
  MissingArtLayerIds,
  createMemoryTemplateStore,
} from './cardTemplates.js';

// The Studio Save file name SS-003 lists for content/source/studio/templates.json (STUDIO_SAVE_FILE_NAMES.templates).
const SAVE_FILE_NAME = 'templates';
const BLANK_CHOICE = 'blank';
const DEFAULT_COST = 0;
const DEFAULT_RARITY = 'common';
const NO_EFFECTS = 'no effects';
const OTHER_TYPE_LABEL = 'Other';

const EVENT_CLICK = 'click';
const EVENT_SUBMIT = 'submit';
const EVENT_CLOSE = 'close';
const EVENT_KEYDOWN = 'keydown';
const EVENT_CHANGE = 'change';
const EVENT_CANCEL = 'cancel';
const KEY_ESCAPE = 'Escape';

const MODE_LIST = 'list';
const MODE_RENAME = 'rename';
const MODE_DELETE = 'delete';
const ACTION_RENAME = 'rename';
const ACTION_DELETE = 'delete';
const ACTION_CANCEL = 'cancel';

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
const CLASS_MANAGER = 'card-template-manager';
const CLASS_ROW = 'card-template-row';
const CLASS_ROW_ACTION = 's-btn card-template-row-action';
const CLASS_ROW_PROMPT = 'card-template-row-prompt';
const CLASS_RENAME_INPUT = 'card-template-rename-input';

const ID_SAVE_TITLE = 'card-template-save-title';
const ID_REPLACE_TITLE = 'card-template-replace-title';
const ID_PICKER_TITLE = 'card-template-picker-title';
const ID_MANAGER_TITLE = 'card-template-manager-title';

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
const SELECTOR_LIST = '[data-template-list]';
const SELECTOR_ROW_ID = '[data-template-id]';
const SELECTOR_ROW_ACTION = '[data-template-action]';
const SELECTOR_RENAME_FORM = '[data-template-rename-form]';
const SELECTOR_RENAME_INPUT = '[data-template-rename-input]';
const SELECTOR_IMPORT_INPUT = '[data-template-import-input]';
const SELECTOR_IMPORT = '[data-template-import]';
const SELECTOR_EXPORT = '[data-template-export]';
const SELECTOR_CLOSE = '[data-template-close]';
const rowActionSelector = (id, action) => `[data-template-id="${CSS.escape(id)}"] [data-template-action="${action}"]`;

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
 * artLayers() -> the card art layers, createBlankCard(), createCardFromTemplate(template),
 * downloadJsonFile(name, data) }.
 * Templates live in `state.templates` (so Undo, the snapshot and the local draft cover them);
 * `state.savedTemplates` is the last stored copy.
 */
export function initCardTemplatesUi(ctx)
{
  const { state } = ctx;
  let store = createMemoryTemplateStore();

  // The one persistence adapter. The default store is in memory, so templates last for the session and in
  // the local draft.
  // SS-003 integration: registerStudioSaveFile(cardTemplatesUi.saveFile) in studio.js, so File > Save writes
  // content/source/studio/templates.json, it loads on start and the Draft/Saved pill counts it.
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

  // The SS-003 Save file shape: read() returns the data keys, apply(data) gets them back (null when absent).
  const saveFile = Object.freeze({
    name: SAVE_FILE_NAME,
    path: CARD_TEMPLATES_PATH,
    read: () => ({ templates: clone(state.templates) }),
    apply: data => applyStoredFile(data ? TemplateFile(data.templates) : null),
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

  // Tools > Card templates…: the list by card type, Rename and Delete on each row, Import and Export JSON.
  let manager = null;
  let managerMode = MODE_LIST;
  let managerTargetId = null;
  function managerElement()
  {
    if (manager)
    {
      return manager;
    }
    manager = makeDialog(CLASS_MANAGER, ID_MANAGER_TITLE, `
      <h3 id="${ID_MANAGER_TITLE}">Card templates</h3>
      <div class="card-template-list" data-template-list></div>
      <p class="card-json-error" role="alert" data-template-error></p>
      <div class="card-template-actions">
        <input type="file" accept=".json,application/json" hidden data-template-import-input />
        <button type="button" class="s-btn" data-template-import>Import JSON…</button>
        <button type="button" class="s-btn" data-template-export>Export JSON</button>
        <button type="button" class="s-btn s-btn-primary" data-template-close>Close</button>
      </div>`);
    const list = manager.querySelector(SELECTOR_LIST);
    list.addEventListener(EVENT_CLICK, event => runRowAction(event.target.closest(SELECTOR_ROW_ACTION)));
    list.addEventListener(EVENT_SUBMIT, event =>
    {
      event.preventDefault();
      submitRename();
    });
    // Escape leaves a rename or a delete question first; only then does it close the dialog.
    manager.addEventListener(EVENT_CANCEL, event =>
    {
      if (managerMode === MODE_LIST)
      {
        return;
      }
      event.preventDefault();
      leaveRowMode();
    });
    const importInput = manager.querySelector(SELECTOR_IMPORT_INPUT);
    manager.querySelector(SELECTOR_IMPORT).addEventListener(EVENT_CLICK, () => importInput.click());
    importInput.addEventListener(EVENT_CHANGE, async () =>
    {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (file)
      {
        importTemplates(await file.text());
      }
    });
    manager.querySelector(SELECTOR_EXPORT).addEventListener(EVENT_CLICK, () => ctx.downloadJsonFile(CARD_TEMPLATES_FILE_NAME, TemplateFile(state.templates)));
    manager.querySelector(SELECTOR_CLOSE).addEventListener(EVENT_CLICK, () => manager.close());
    return manager;
  }

  function rowHtml(template, layers)
  {
    const id = escapeHtml(template.id);
    const name = escapeHtml(template.name);
    if (managerTargetId === template.id && managerMode === MODE_RENAME)
    {
      return `<form class="${CLASS_ROW}" data-template-id="${id}" data-template-rename-form>`
        + `<input class="${CLASS_RENAME_INPUT}" data-template-rename-input maxlength="${TEMPLATE_NAME_LIMIT}" value="${name}" aria-label="New name for ${name}" autocomplete="off" spellcheck="false" />`
        + `<button type="submit" class="${CLASS_ROW_ACTION} s-btn-primary">Save</button>`
        + `<button type="button" class="${CLASS_ROW_ACTION}" data-template-action="${ACTION_CANCEL}">Cancel</button></form>`;
    }
    if (managerTargetId === template.id && managerMode === MODE_DELETE)
    {
      return `<div class="${CLASS_ROW}" data-template-id="${id}"><span class="${CLASS_ROW_PROMPT}">Delete template ${name}?</span>`
        + `<button type="button" class="${CLASS_ROW_ACTION} is-danger" data-template-action="${ACTION_DELETE}">Delete</button>`
        + `<button type="button" class="${CLASS_ROW_ACTION}" data-template-action="${ACTION_CANCEL}">Cancel</button></div>`;
    }
    const missing = MissingArtLayerIds(template, layers);
    const note = missing.length ? `<span class="${CLASS_NOTE}">layers gone</span>` : '';
    return `<div class="${CLASS_ROW}" data-template-id="${id}">`
      + `<span class="${CLASS_NAME}" title="${escapeHtml(templateDetails(template, missing))}">${name}</span>${note}`
      + `<button type="button" class="${CLASS_ROW_ACTION}" data-template-action="${ACTION_RENAME}" aria-label="Rename ${name}">Rename</button>`
      + `<button type="button" class="${CLASS_ROW_ACTION}" data-template-action="${ACTION_DELETE}" aria-label="Delete ${name}">Delete</button></div>`;
  }

  function renderManagerList()
  {
    const layers = ctx.artLayers();
    const groups = GroupTemplatesByType(state.templates);
    if (managerTargetId && !state.templates.some(template => template.id === managerTargetId))
    {
      managerMode = MODE_LIST;
      managerTargetId = null;
    }
    const rows = [];
    for (const group of groups)
    {
      rows.push(`<div class="${CLASS_GROUP_LABEL}">${escapeHtml(typeLabel(group.type))}</div>`);
      for (const template of group.templates)
      {
        rows.push(rowHtml(template, layers));
      }
    }
    if (!groups.length)
    {
      rows.push(`<p class="studio-muted ${CLASS_EMPTY}">No templates yet. Use Save as template… in a card's ⋮ menu, or Import JSON.</p>`);
    }
    manager.querySelector(SELECTOR_LIST).innerHTML = rows.join('');
  }

  function setRowMode(mode, id, focusSelector)
  {
    managerMode = mode;
    managerTargetId = id;
    renderManagerList();
    const target = manager.querySelector(focusSelector);
    target?.focus();
    if (mode === MODE_RENAME)
    {
      target?.select();
    }
  }

  function leaveRowMode()
  {
    const id = managerTargetId;
    const action = managerMode === MODE_DELETE ? ACTION_DELETE : ACTION_RENAME;
    setRowMode(MODE_LIST, null, id ? rowActionSelector(id, action) : SELECTOR_CLOSE);
  }

  function runRowAction(button)
  {
    if (!button)
    {
      return;
    }
    const id = button.closest(SELECTOR_ROW_ID).dataset.templateId;
    const action = button.dataset.templateAction;
    manager.querySelector(SELECTOR_ERROR).textContent = '';
    if (action === ACTION_CANCEL)
    {
      leaveRowMode();
    }
    else if (action === ACTION_RENAME)
    {
      setRowMode(MODE_RENAME, id, SELECTOR_RENAME_INPUT);
    }
    else if (action === ACTION_DELETE && managerMode === MODE_DELETE && managerTargetId === id)
    {
      deleteTemplate(id);
    }
    else if (action === ACTION_DELETE)
    {
      setRowMode(MODE_DELETE, id, rowActionSelector(id, ACTION_CANCEL));
    }
  }

  function submitRename()
  {
    const form = manager.querySelector(SELECTOR_RENAME_FORM);
    if (!form)
    {
      return;
    }
    const id = form.dataset.templateId;
    const result = RenameTemplate(state.templates, id, form.querySelector(SELECTOR_RENAME_INPUT).value);
    if (result.problem)
    {
      manager.querySelector(SELECTOR_ERROR).textContent = result.problem;
      return;
    }
    managerMode = MODE_LIST;
    commitTemplates(result.templates);
    manager.querySelector(rowActionSelector(id, ACTION_RENAME))?.focus();
    ctx.toast(`Renamed template to "${state.templates.find(template => template.id === id)?.name}"`);
  }

  function deleteTemplate(id)
  {
    const removed = state.templates.find(template => template.id === id);
    managerMode = MODE_LIST;
    managerTargetId = null;
    commitTemplates(DeleteTemplate(state.templates, id));
    const nextFocus = manager.querySelector(`${SELECTOR_LIST} ${SELECTOR_ROW_ACTION}`) || manager.querySelector(SELECTOR_IMPORT);
    nextFocus.focus();
    ctx.toast(`Deleted template "${removed?.name}". Undo brings it back.`);
  }

  // The whole file is checked before anything changes; a broken file names its first problem.
  function importTemplates(text)
  {
    const error = manager.querySelector(SELECTOR_ERROR);
    const parsed = ParseTemplateFile(text, { checkCard: ctx.checkCard });
    if (parsed.problem)
    {
      error.textContent = `Not imported: ${parsed.problem}`;
      return;
    }
    error.textContent = '';
    if (!parsed.templates.length)
    {
      ctx.toast('The file has no templates');
      return;
    }
    const merged = MergeImportedTemplates(state.templates, parsed.templates);
    commitTemplates(merged.templates);
    ctx.toast(`Imported ${merged.added.length} template${merged.added.length === 1 ? '' : 's'}`);
  }

  function openManager()
  {
    const dialog = managerElement();
    managerMode = MODE_LIST;
    managerTargetId = null;
    dialog.querySelector(SELECTOR_ERROR).textContent = '';
    renderManagerList();
    dialog.showModal();
    (dialog.querySelector(`${SELECTOR_LIST} ${SELECTOR_ROW_ACTION}`) || dialog.querySelector(SELECTOR_IMPORT)).focus();
  }

  // Redraws whatever template views are open (after Undo, Redo, imports and saves).
  function refresh()
  {
    if (picker?.open)
    {
      renderPickerChoices();
    }
    if (manager?.open)
    {
      renderManagerList();
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
    openManager,
    refresh,
  };
}
