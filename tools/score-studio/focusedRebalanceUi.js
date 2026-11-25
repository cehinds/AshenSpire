// Staged Rebalance workspace. No live draft writes occur until Apply changes.
import { RebalanceSession, applyRebalanceSession } from './rebalanceSession.js';
import { rebalanceCardAsync, rebalanceItem, focusedCardMetrics, focusedChanges } from './focusedRebalance.js';
import { ScoreGeneratedItem } from '../../src/model/itemGenerator.js';

const clone = value => structuredClone(value);
const pause = () => new Promise(resolve => setTimeout(resolve, 25));
const formatMetrics = row => row ? `CP ${row.cp ?? '?'} · Rank ${row.rank ?? '?'} · ${row.rarity || 'common'}` : '';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function rebalanceMechanicalChanges(before = [], after = []) {
  const labels = { damage: 'Damage', block: 'Block', heal: 'Healing', poiseDamage: 'Poise damage', draw: 'Draw', restoreMana: 'Restore Mana', restoreStamina: 'Restore Stamina' };
  const display = value => value === undefined ? 'none' : typeof value === 'object' ? JSON.stringify(value) : value;
  const lines = [];
  for (let i = 0; i < Math.max(before.length, after.length); i++) {
    const first = before[i], next = after[i], effect = next || first;
    if (same(first, next)) continue;
    if (first?.op !== next?.op) {
      lines.push(`${labels[effect.op] || effect.op}: ${first ? JSON.stringify(first) : 'none'} → ${next ? JSON.stringify(next) : 'none'}`);
      continue;
    }
    for (const field of ['amount', 'stacks', 'damage', 'block', 'heal', 'break', 'buildup', 'manaDiscount', 'hits', 'repeat']) {
      if (same(first[field], next[field])) continue;
      const label = effect.op === 'grantCardCharge' ? `Next card ${field}` : field === 'stacks' ? `${effect.status} stacks` : field === 'amount' ? labels[effect.op] || effect.op : `${labels[effect.op] || effect.op} ${field}`;
      lines.push(`${label}${effect.if ? ' (conditional)' : ''}: ${display(first[field])} → ${display(next[field])}`);
    }
  }
  return lines;
}

export function initFocusedRebalanceUi(ctx) {
  const { state, getTarget, scopedEntries, pushHistory, normalizeStudioCard, saveDraft, syncAllViews, toast } = ctx;
  const el = id => document.getElementById(id);
  const dialog = el('rebalance-modal');
  let session = null, opening = 0, returnFocus = null, renderedKey = '', statusMessage = '';
  const poolMode = () => !!el('rebal-pool-mode')?.checked && !['selected', 'current'].includes(el('rebal-scope')?.value);
  const optionalNumber = id => el(id)?.validity?.badInput ? 'invalid' : el(id)?.value.trim() ? Number(el(id).value) : null;
  const readSettings = () => ({
    targetRank: el('rebal-target-rank')?.value === 'keep' ? 'keep' : Number(el('rebal-target-rank')?.value),
    targetRarity: el('rebal-target-rarity')?.value || 'keep', targetCp: optionalNumber('rebal-target-cp'),
    effectCount: getTarget() === 'cards' ? optionalNumber('rebal-effect-count') : null,
    sp: getTarget() === 'cards' ? optionalNumber('rebal-sp') : null, mp: getTarget() === 'cards' ? optionalNumber('rebal-mp') : null,
    preferredEffects: getTarget() === 'cards' ? [...document.querySelectorAll('[data-rebal-effect]:checked')].map(input => input.value) : [],
    preferredStances: getTarget() === 'cards' ? [...document.querySelectorAll('[data-rebal-stance]:checked')].map(input => input.value) : [],
    generateNames: !!el('rebal-generate-names')?.checked, seed: el('rebal-seed')?.value.trim() || '42',
  });
  const stagedCard = entry => ({ ...clone(entry), _edited: true });
  function metrics(entry, original = false) {
    if (getTarget() === 'items') { const row = ScoreGeneratedItem(entry, state.scoring, state.itemRules); return { cp: row.cp, rank: row.rank, rarity: entry.rarity || 'common' }; }
    return focusedCardMetrics(entry, { scoring: state.scoring, faceOf: def => ctx.deriveFaceFromDef(original ? clone(def) : stagedCard(def)) });
  }
  function reset({ defaults = false } = {}) {
    opening++; session?.close(); session = null; statusMessage = ''; renderedKey = '';
    if (defaults) {
      if (el('rebal-advanced')) el('rebal-advanced').open = false;
      for (const id of ['rebal-target-rank', 'rebal-target-rarity']) if (el(id)) el(id).value = 'keep';
      for (const id of ['rebal-target-cp', 'rebal-effect-count', 'rebal-sp', 'rebal-mp']) if (el(id)) el(id).value = '';
      for (const input of document.querySelectorAll('[data-rebal-effect], [data-rebal-stance]')) input.checked = false;
      if (el('rebal-pool-mode')) el('rebal-pool-mode').checked = false;
      if (el('rebal-compare-original')) el('rebal-compare-original').checked = true;
      if (el('rebal-other-changes')) el('rebal-other-changes').open = false;
    }
    const entries = scopedEntries(), target = getTarget();
    if (entries.length) session = new RebalanceSession({ entries, target, settings: readSettings(), yieldToUi: pause,
      tune: (entry, settings, job) => target === 'items' ? rebalanceItem(entry, settings, { scoring: state.scoring, rules: state.itemRules }) : rebalanceCardAsync(entry, settings, {
        scoring: state.scoring, shouldCancel: () => !job.isCurrent(), yieldToUi: job.yieldToUi,
        // Authored originals keep their real opening projection; every detached candidate uses its edited definition.
        faceOf: def => ctx.deriveFaceFromDef(def === entry ? clone(def) : stagedCard(def)),
      }),
    });
    render();
  }
  function addDiff(text) { const li = document.createElement('li'); li.textContent = text; el('rebal-diff')?.append(li); }
  function addOtherDiff(text) {
    if (!el('rebal-other-diff')) { addDiff(text); return; }
    const li = document.createElement('li'); li.textContent = text; el('rebal-other-diff').append(li);
    el('rebal-other-changes').hidden = false;
    el('rebal-other-summary').textContent = `Other changes (${el('rebal-other-diff').children.length})`;
  }
  function render() {
    const target = getTarget(), view = session?.view(), busy = !!view?.busy, pool = poolMode();
    if (el('rebal-pool-mode')) { el('rebal-pool-mode').disabled = ['selected', 'current'].includes(el('rebal-scope')?.value); if (el('rebal-pool-mode').disabled) el('rebal-pool-mode').checked = false; }
    for (const id of ['rebal-costs-section', 'rebal-effects-section', 'rebal-stances-section']) if (el(id)) el(id).hidden = target === 'items';
    if (el('btn-rebal-revert')) { const label = `Revert current ${target === 'items' ? 'item' : 'card'}`; el('btn-rebal-revert').setAttribute('aria-label', label); el('btn-rebal-revert').title = label; }
    for (const [id, direction, arrow] of [['btn-rebal-prev-card', 'Previous', '‹'], ['btn-rebal-next-card', 'Next', '›']]) if (el(id)) { el(id).textContent = arrow; const label = `${direction} ${target === 'items' ? 'item' : 'card'}`; el(id).setAttribute('aria-label', label); el(id).title = label; }
    const hasCards = !!view && view.total > 1, hasHistory = !!view && view.variationTotal > 0;
    if (el('rebal-card-navigation')) { el('rebal-card-navigation').hidden = !hasCards; el('rebal-card-navigation').setAttribute('aria-label', target === 'items' ? 'Items' : 'Cards'); }
    if (el('rebal-version-navigation')) el('rebal-version-navigation').hidden = !hasHistory;
    if (el('rebal-navigation')) el('rebal-navigation').hidden = !hasCards && !hasHistory;
    const disable = (id, value) => { if (el(id)) el(id).disabled = value; };
    disable('btn-rebal-preview', busy || (!view && !pool));
    disable('btn-rebal-reroll', busy || !view || pool);
    disable('btn-rebal-revert', busy || !view || pool || view.variationIndex === 0);
    disable('btn-rebal-apply', busy || (pool ? !scopedEntries().length && !el('rebal-gen-shortage')?.checked : !session?.canApply));
    disable('btn-rebal-prev-card', busy || !view || view.index === 0);
    disable('btn-rebal-next-card', busy || !view || view.index + 1 === view.total);
    disable('btn-rebal-prev-variation', busy || !view || view.variationIndex === 0);
    disable('btn-rebal-next-variation', busy || !view || view.variationIndex === view.variationTotal);
    if (el('rebal-spinner')) el('rebal-spinner').hidden = !busy;
    dialog?.setAttribute('aria-busy', String(busy));
    if (el('btn-rebal-apply')) el('btn-rebal-apply').textContent = pool ? 'Apply pool changes' : 'Apply changes';
    if (el('btn-rebal-preview')) el('btn-rebal-preview').textContent = pool ? 'Preview pool quotas' : 'Rebalance';
    if (el('rebal-card-position')) el('rebal-card-position').textContent = view ? `${target === 'cards' ? 'Card' : 'Item'} ${view.index + 1} of ${view.total}` : 'Empty scope';
    if (el('rebal-variation-position')) el('rebal-variation-position').textContent = view ? view.variationIndex ? `Variation ${view.variationIndex} of ${view.variationTotal}` : `Original · ${view.variationTotal} variations` : '';
    const status = busy ? `Preparing ${target}: ${view.progress.completed} of ${view.progress.total}…` : statusMessage || (pool ? 'Pool mode can generate or trim entries using the Advanced quotas.' : view?.error || (view?.stale ? 'Settings changed. Rebalance again before applying.' : session?.invalidCandidates.length ? `${session.invalidCandidates.length} previews cannot meet these constraints. Adjust settings or revert those entries.` : session?.canApply ? `${session.changedEntries().length} staged changes. Apply changes to update the draft.` : view ? 'Choose settings, then Rebalance to preview changes.' : 'No entries in this scope.'));
    if (el('rebal-status')) el('rebal-status').textContent = status;
    if (!view) { el('rebal-card-before')?.replaceChildren(); el('rebal-card-after')?.replaceChildren(); el('rebal-diff')?.replaceChildren(); el('rebal-other-diff')?.replaceChildren(); if (el('rebal-other-changes')) el('rebal-other-changes').hidden = true; return; }
    const compareOriginal = el('rebal-compare-original')?.checked !== false;
    const before = compareOriginal ? view.original : view.previous;
    const candidateOriginal = same(view.candidate, view.original);
    const key = JSON.stringify([view.id, view.variationIndex, compareOriginal, view.candidate, before]);
    if (key !== renderedKey) {
      renderedKey = key;
      const candidate = target === 'cards' && !candidateOriginal ? stagedCard(view.candidate) : clone(view.candidate);
      const previousOriginal = same(before, view.original);
      const original = target === 'cards' && !previousOriginal ? stagedCard(before) : clone(before);
      let rows;
      try {
        rows = ctx.renderRebalancePreview?.({ target, original, candidate, beforeElement: el('rebal-card-before'), afterElement: el('rebal-card-after'), metrics: view.report?.metrics });
      } catch (error) { statusMessage = `Preview could not render: ${error.message}`; if (el('rebal-status')) el('rebal-status').textContent = statusMessage; }
      const beforeMetrics = rows?.before || metrics(before, previousOriginal), afterMetrics = rows?.after || metrics(view.candidate, candidateOriginal);
      if (el('rebal-before-metrics')) el('rebal-before-metrics').textContent = formatMetrics({ ...beforeMetrics, rarity: before.rarity });
      if (el('rebal-after-metrics')) el('rebal-after-metrics').textContent = formatMetrics({ ...afterMetrics, rarity: view.candidate.rarity });
      if (el('rebal-before-label')) el('rebal-before-label').textContent = compareOriginal ? 'Original' : 'Previous variation';
      el('rebal-diff')?.replaceChildren();
      el('rebal-other-diff')?.replaceChildren(); if (el('rebal-other-changes')) el('rebal-other-changes').hidden = true;
      for (const [field, label] of [['cp', 'CP'], ['rank', 'Rank']]) if (beforeMetrics[field] !== afterMetrics[field]) addDiff(`${label}: ${beforeMetrics[field]} → ${afterMetrics[field]}`);
      for (const change of focusedChanges(before, view.candidate)) {
        if (['name', 'rarity', 'staminaCost', 'manaCost', 'cost'].includes(change.field)) addDiff(`${({ staminaCost: 'SP cost', manaCost: 'MP cost', cost: 'Cost' })[change.field] || change.field}: ${change.before ?? 0} → ${change.after ?? 0}`);
        else if (change.field === 'effects') {
          const actualBefore = beforeMetrics.projectedEffects || change.before, actualAfter = afterMetrics.projectedEffects || change.after;
          for (const line of rebalanceMechanicalChanges(actualBefore, actualAfter)) addDiff(line);
        }
        else if (change.field === 'upgradeMenu') addOtherDiff('Upgrade choices updated');
        else if (change.field === 'tags') addOtherDiff('Tags updated');
        else if (!['upgrade', 'textTemplate', 'faceTemplate', 'kindIds', 'cardRatingValues', 'resourceCosts', 'face'].includes(change.field)) addDiff(`${({ damageSchool: 'Damage school', abilityKind: 'Ability category', keywords: 'Keywords' })[change.field] || change.field} updated`);
      }
      for (const warning of [...(view.report?.constraintErrors || []), ...(view.report?.errors || []), ...(view.report?.warnings || [])]) addDiff(warning);
      if (!el('rebal-diff')?.children.length) addDiff('No mechanical changes.');
    }
  }
  async function run(currentOnly = false) {
    if (poolMode()) { ctx.refreshLegacy(); statusMessage = 'Pool quota preview updated. Apply pool changes commits the Advanced settings.'; render(); return; }
    if (!session || session.busy) return;
    const launcher = document.activeElement;
    const launchedFromButton = launcher === el('btn-rebal-preview') || launcher === el('btn-rebal-reroll');
    session.setSettings(readSettings()); statusMessage = ''; const active = session;
    let result;
    try { result = await active.run({ currentOnly, onProgress: render }); }
    catch (error) { if (session === active && !active.closed) statusMessage = `Rebalance failed: ${error.message}`; }
    if (session === active && !active.closed) {
      render();
      if (result && !result.cancelled && launchedFromButton && (document.activeElement === document.body || document.activeElement === dialog)) launcher.focus({ preventScroll: true });
      const viewport = document.defaultView;
      if (result && !result.cancelled && viewport?.matchMedia?.('(max-width: 650px)').matches) {
        const body = dialog.querySelector('.rebalance-body');
        const behavior = viewport.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
        if (body?.scrollTo) body.scrollTo({ top: 0, behavior });
        else if (body) body.scrollTop = 0;
      }
    }
  }
  async function open() {
    const editor = el('card-editor-modal');
    returnFocus = document.activeElement;
    if (editor?.open && editor.contains(returnFocus)) {
      const target = getTarget(), id = target === 'items' ? state.selectedItemKey : state.selectedCardId;
      const tile = [...document.querySelectorAll(target === 'items' ? '.item-grid-tile' : '.studio-card-tile')].find(node => (target === 'items' ? node.dataset.itemKey : node.dataset.cardId) === id);
      returnFocus = tile?.querySelector('.card-editor-edit-button') || tile || el(target === 'items' ? 'btn-auto-balance-items' : 'btn-auto-balance-cards');
    }
    reset({ defaults: true }); const token = opening;
    if (editor?.open) editor.close();
    await pause();
    if (token !== opening) return;
    if (!dialog.open) dialog.showModal();
    renderedKey = ''; render();
  }
  function apply() {
    if (poolMode()) { session?.close(); ctx.applyPool(); return; }
    try {
      const result = applyRebalanceSession(session, state, { pushHistory, normalize: entry => {
        if (getTarget() === 'items') return entry;
        const card = normalizeStudioCard(entry); ctx.prepareSubclassEdit?.(card); return card;
      } });
      const committedIds = new Set(result.ids), key = getTarget() === 'items' ? 'key' : 'id';
      for (const entry of state[getTarget()]) if (committedIds.has(entry[key])) ctx.prepareRebalanceCommit?.(entry, getTarget());
      ctx.studioCardOverrides?.clear(); syncAllViews(); saveDraft({ autoName: false }); dialog.close();
      toast(`Applied ${result.count} ${getTarget()} changes.`);
    } catch (error) { statusMessage = error.message; render(); }
  }
  function changed() { statusMessage = ''; session?.setSettings(readSettings()); render(); }
  for (const id of ['rebal-target-rank', 'rebal-target-rarity', 'rebal-target-cp', 'rebal-effect-count', 'rebal-sp', 'rebal-mp', 'rebal-generate-names', 'rebal-seed']) {
    el(id)?.addEventListener('input', changed); el(id)?.addEventListener('change', changed);
  }
  for (const id of ['rebal-effect-options', 'rebal-stance-options']) el(id)?.addEventListener('change', changed);
  el('rebal-scope')?.addEventListener('change', () => reset());
  el('rebal-pool-mode')?.addEventListener('change', () => { session?.cancel(); statusMessage = ''; render(); });
  el('rebal-compare-original')?.addEventListener('change', render);
  el('btn-rebal-preview')?.addEventListener('click', () => run(false));
  el('btn-rebal-reroll')?.addEventListener('click', () => run(true));
  el('btn-rebal-revert')?.addEventListener('click', () => { session?.revertCurrent(); statusMessage = ''; render(); });
  for (const [id, kind, delta] of [['btn-rebal-prev-card', 'Card', -1], ['btn-rebal-next-card', 'Card', 1], ['btn-rebal-prev-variation', 'Variation', -1], ['btn-rebal-next-variation', 'Variation', 1]]) {
    el(id)?.addEventListener('click', () => { session?.[`navigate${kind}`](delta); statusMessage = ''; render(); });
  }
  el('rebalance-form')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && ['INPUT', 'SELECT'].includes(event.target.tagName)) { event.preventDefault(); if (!session?.busy) run(false); }
  });
  dialog?.addEventListener('cancel', () => { opening++; session?.close(); });
  dialog?.addEventListener('close', () => {
    opening++; session?.close(); session = null; renderedKey = '';
    if (returnFocus?.isConnected) returnFocus.focus(); returnFocus = null;
  });
  return { open, reset, render, apply, run, getSession: () => session };
}
