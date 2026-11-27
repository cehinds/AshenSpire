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

const clone = value => structuredClone(value);
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const typeLabel = type => (type ? type[0].toUpperCase() + type.slice(1) : 'Other');

// The one-line summary shown on hover: type, costs, rarity and effects.
function templateDetails(template, missing = [])
{
  const card = template.card || {};
  const costs = [`${card.staminaCost ?? card.cost ?? 0} SP`];
  if (card.manaCost) costs.push(`${card.manaCost} MP`);
  const effects = (card.effects || []).map(effect => effect.op).join(', ') || 'no effects';
  const lines = [`${typeLabel(template.cardType)} · ${costs.join(' ')} · ${card.rarity || 'common'} · ${effects}`];
  if (missing.length) lines.push(`Art layers no longer there: ${missing.join(', ')}`);
  return lines.join('\n');
}

// Up and Down move between the buttons of a list; Home and End jump to its ends.
function wireArrowKeys(container, selector)
{
  container.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const nodes = [...container.querySelectorAll(selector)].filter(node => !node.disabled && node.getClientRects().length);
    const index = nodes.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? nodes[0] : event.key === 'End' ? nodes.at(-1) : nodes[(index + (event.key === 'ArrowUp' ? -1 : 1) + nodes.length) % nodes.length];
    next?.focus();
  });
}

function makeDialog(className, titleId, html)
{
  const dialog = document.createElement('dialog');
  dialog.className = `studio-modal card-template-dialog ${className}`;
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.innerHTML = html;
  document.body.append(dialog);
  return dialog;
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
  //   registerStudioSaveFile({ name: 'Card templates', path: CARD_TEMPLATES_PATH, read: saveFile.read, apply: saveFile.apply })
  // so File > Save writes content/source/studio/templates.json, it loads on start and the Draft/Saved state counts it.
  function connectStore(nextStore)
  {
    store = nextStore;
    return applyStoredFile(store.load());
  }

  // Loads a stored file as the saved templates. A missing file means none; a broken one changes nothing.
  function applyStoredFile(raw)
  {
    const parsed = raw == null ? { templates: [] } : ParseTemplateFile(raw, { checkCard: ctx.checkCard });
    if (parsed.problem) return parsed.problem;
    state.templates = parsed.templates;
    state.savedTemplates = clone(parsed.templates);
    return '';
  }

  // The file the Save path writes, and marks the templates saved once written.
  function markSaved()
  {
    store.save(TemplateFile(state.templates));
    state.savedTemplates = clone(state.templates);
  }

  const saveFile = Object.freeze({
    name: 'Card templates',
    path: CARD_TEMPLATES_PATH,
    read: () => TemplateFile(state.templates),
    apply: raw => applyStoredFile(raw),
  });

  const changed = () => JSON.stringify(state.templates || []) !== JSON.stringify(state.savedTemplates || []);

  // Templates from the local draft: checked as a whole file first, so a bad draft keeps the saved ones.
  function restoreDraft(list)
  {
    if (!Array.isArray(list)) return false;
    const parsed = ParseTemplateFile(TemplateFile(list), { checkCard: ctx.checkCard });
    if (parsed.problem) return false;
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

  // ---------------------------------------------------------------------------
  // Save as template… (card ⋮ menu): a name, the JSON dialog's checks, and a confirmed Replace for a taken name.
  // ---------------------------------------------------------------------------
  let saveDialog = null;
  function saveDialogElement()
  {
    if (saveDialog) return saveDialog;
    saveDialog = makeDialog('card-template-save-dialog', 'card-template-save-title', `
      <form data-template-name-form>
        <h3 id="card-template-save-title">Save as template</h3>
        <p class="studio-muted" data-template-source></p>
        <label class="card-template-field">Template name <input name="template-name" maxlength="${TEMPLATE_NAME_LIMIT}" autocomplete="off" spellcheck="false" /></label>
        <p class="card-json-error" role="alert" data-template-error></p>
        <div class="card-template-actions"><button type="button" class="s-btn" data-template-cancel>Cancel</button><button type="submit" class="s-btn s-btn-primary">Save</button></div>
      </form>
      <form data-template-replace-form hidden>
        <h3 id="card-template-replace-title" data-template-replace-title></h3>
        <p class="studio-muted">Cards made from it stay as they are.</p>
        <div class="card-template-actions"><button type="button" class="s-btn" data-template-cancel>Cancel</button><button type="submit" class="s-btn s-btn-primary" data-template-replace>Replace</button></div>
      </form>`);
    for (const button of saveDialog.querySelectorAll('[data-template-cancel]')) button.addEventListener('click', () => saveDialog.close());
    saveDialog.querySelector('[data-template-name-form]').addEventListener('submit', event => { event.preventDefault(); submitSave(false); });
    saveDialog.querySelector('[data-template-replace-form]').addEventListener('submit', event => { event.preventDefault(); submitSave(true); });
    return saveDialog;
  }

  function openSaveAsTemplate(cardId)
  {
    const card = state.cards.find(entry => entry.id === cardId);
    if (!card) return;
    const dialog = saveDialogElement();
    dialog.dataset.cardId = cardId;
    const nameForm = dialog.querySelector('[data-template-name-form]'), replaceForm = dialog.querySelector('[data-template-replace-form]');
    nameForm.hidden = false; replaceForm.hidden = true;
    dialog.setAttribute('aria-labelledby', 'card-template-save-title');
    dialog.querySelector('[data-template-source]').textContent = `Keeps the mechanics of "${card.name || card.id}". New cards from it get their own ID and name.`;
    dialog.querySelector('[data-template-error]').textContent = '';
    const input = dialog.querySelector('[name="template-name"]');
    input.value = card.name || '';
    dialog.showModal();
    input.focus(); input.select();
  }

  function submitSave(replace)
  {
    const dialog = saveDialog, error = dialog.querySelector('[data-template-error]');
    const card = state.cards.find(entry => entry.id === dialog.dataset.cardId);
    if (!card) { dialog.close(); return; }
    // Same checks as the JSON dialog, before anything is stored.
    const problem = ctx.checkCard(card);
    if (problem) { showNameForm(); error.textContent = problem; return; }
    const name = dialog.querySelector('[name="template-name"]').value;
    const result = SaveCardAsTemplate(state.templates, card, { name, artLayerIds: ctx.artLayerIdsFor(card), replace });
    if (result.problem) { showNameForm(); error.textContent = result.problem; return; }
    if (result.taken)
    {
      dialog.querySelector('[data-template-name-form]').hidden = true;
      const replaceForm = dialog.querySelector('[data-template-replace-form]');
      replaceForm.hidden = false;
      dialog.querySelector('[data-template-replace-title]').textContent = `Replace template ${result.taken.name}?`;
      dialog.setAttribute('aria-labelledby', 'card-template-replace-title');
      replaceForm.querySelector('[data-template-cancel]').focus();
      return;
    }
    commitTemplates(result.templates);
    dialog.close();
    ctx.toast(`${result.replaced ? 'Replaced' : 'Saved'} template "${result.template.name}"`);
  }

  function showNameForm()
  {
    saveDialog.querySelector('[data-template-name-form]').hidden = false;
    saveDialog.querySelector('[data-template-replace-form]').hidden = true;
    saveDialog.setAttribute('aria-labelledby', 'card-template-save-title');
  }

  // ---------------------------------------------------------------------------
  // The Add card picker: Blank first (today's New), then templates grouped by card type.
  // ---------------------------------------------------------------------------
  let picker = null, pickerOpener = null, pickerChosen = false;
  function pickerElement()
  {
    if (picker) return picker;
    picker = makeDialog('card-template-picker', 'card-template-picker-title', `
      <h3 id="card-template-picker-title">Add card</h3>
      <div class="card-template-choices" data-template-choices></div>
      <div class="card-template-actions"><button type="button" class="s-btn" data-template-cancel>Cancel</button></div>`);
    picker.querySelector('[data-template-cancel]').addEventListener('click', () => picker.close());
    picker.querySelector('[data-template-choices]').addEventListener('click', event => {
      const choice = event.target.closest('[data-template-choice]');
      if (!choice) return;
      const id = choice.dataset.templateChoice;
      const template = id === 'blank' ? null : state.templates.find(entry => entry.id === id);
      if (id !== 'blank' && !template) return;
      pickerChosen = true;
      picker.close();
      if (template) ctx.createCardFromTemplate(clone(template)); else ctx.createBlankCard();
    });
    wireArrowKeys(picker.querySelector('[data-template-choices]'), '[data-template-choice]');
    // Escape or Cancel: nothing is made, and focus goes back to Add card.
    picker.addEventListener('close', () => {
      if (pickerChosen) return;
      const opener = pickerOpener?.isConnected && pickerOpener.getClientRects().length ? pickerOpener : document.querySelector('.studio-add-card-button');
      opener?.focus();
    });
    return picker;
  }

  function renderPickerChoices()
  {
    const layers = ctx.artLayers();
    const groups = GroupTemplatesByType(state.templates);
    const rows = ['<button type="button" class="card-template-choice is-blank" data-template-choice="blank" title="A blank Skill with New card defaults">Blank</button>'];
    for (const group of groups)
    {
      rows.push(`<div class="card-template-group-label">${esc(typeLabel(group.type))}</div>`);
      for (const template of group.templates)
      {
        const missing = MissingArtLayerIds(template, layers);
        rows.push(`<button type="button" class="card-template-choice" data-template-choice="${esc(template.id)}" title="${esc(templateDetails(template, missing))}">`
          + `<span class="card-template-name">${esc(template.name)}</span>${missing.length ? '<span class="card-template-note">layers gone</span>' : ''}</button>`);
      }
    }
    if (!groups.length) rows.push('<p class="studio-muted card-template-empty">No templates yet. Use Save as template… in a card\'s ⋮ menu.</p>');
    picker.querySelector('[data-template-choices]').innerHTML = rows.join('');
  }

  function openPicker()
  {
    const dialog = pickerElement();
    pickerOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pickerChosen = false;
    renderPickerChoices();
    dialog.showModal();
    dialog.querySelector('[data-template-choice="blank"]').focus();
  }

  // Redraws whatever template views are open (after Undo, Redo, imports and saves).
  function refresh()
  {
    if (picker?.open) renderPickerChoices();
  }

  return { connectStore, markSaved, saveFile, changed, restoreDraft, revert, openSaveAsTemplate, openPicker, refresh };
}
