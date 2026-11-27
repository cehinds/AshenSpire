// tools/score-studio/cardTemplatesUi.js — card templates in the Studio (SS-004): where they are stored, Save as
// template, the Add card picker and Tools > Card templates. The data rules live in cardTemplates.js.
import {
  CARD_TEMPLATES_PATH,
  TemplateFile,
  ParseTemplateFile,
  createMemoryTemplateStore,
} from './cardTemplates.js';

const clone = value => structuredClone(value);

/**
 * ctx: { state, checkCard(card) -> problem text or '' }. Templates live in `state.templates` (so Undo, the
 * snapshot and the local draft cover them); `state.savedTemplates` is the last stored copy.
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

  return { connectStore, markSaved, saveFile, changed, restoreDraft, revert };
}
