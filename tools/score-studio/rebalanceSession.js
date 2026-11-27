// Detached, cancellable preview history. This module never writes the live Studio draft.
const clone = value => structuredClone(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pause = () => new Promise(resolve => setTimeout(resolve, 0));

export class RebalanceSession {
  constructor({ entries, target = 'cards', settings = {}, tune, measure = () => null, yieldToUi = pause }) {
    if (!Array.isArray(entries) || !entries.length) throw new Error('No entries in this scope.');
    if (typeof tune !== 'function') throw new Error('A rebalance tuner is required.');
    this.target = target === 'items' ? 'items' : 'cards'; this.key = this.target === 'items' ? 'key' : 'id';
    this.ids = Object.freeze(entries.map(entry => entry[this.key]));
    if (this.ids.some(id => typeof id !== 'string' || !id) || new Set(this.ids).size !== this.ids.length) throw new Error('Rebalance scope must contain unique existing IDs.');
    this.originals = new Map(entries.map(entry => [entry[this.key], clone(entry)]));
    this.history = new Map(this.ids.map(id => [id, [{ entry: clone(this.originals.get(id)), original: true, revision: 0, report: null }]]));
    this.cursors = new Map(this.ids.map(id => [id, 0])); this.rerolls = new Map(this.ids.map(id => [id, 0]));
    this.settings = clone(settings); this.revision = 0; this.job = 0; this.index = 0;
    this.busy = false; this.closed = false; this.previewReady = false; this.settingsInvalidated = false;
    this.progress = { completed: 0, total: this.ids.length }; this.error = null;
    this.tune = tune; this.measure = measure; this.yieldToUi = yieldToUi;
  }
  get currentId() { return this.ids[this.index]; }
  get stale() {
    return this.settingsInvalidated || this.ids.some(id => { const variant = this.currentVariant(id); return !variant.original && variant.revision !== this.revision; });
  }
  get invalidCandidates() {
    return this.ids.filter(id => {
      const variant = this.currentVariant(id), report = variant.report;
      return !variant.original && report && (report.feasible === false || report.constraintErrors?.length || report.errors?.length);
    });
  }
  get canApply() { return !this.closed && !this.busy && this.previewReady && !this.stale && !this.invalidCandidates.length && this.changedEntries().length > 0; }
  currentVariant(id = this.currentId) { return this.history.get(id)[this.cursors.get(id)]; }
  setSettings(settings) {
    if (same(this.settings, settings)) return false;
    this.cancel(); this.settings = clone(settings); this.revision++; this.settingsInvalidated = true; this.error = null;
    return true;
  }
  cancel() { this.job++; this.busy = false; }
  close() { this.cancel(); this.closed = true; }
  navigateCard(delta) { this.index = Math.max(0, Math.min(this.ids.length - 1, this.index + delta)); return this.view(); }
  navigateVariation(delta) {
    const id = this.currentId;
    this.cursors.set(id, Math.max(0, Math.min(this.history.get(id).length - 1, this.cursors.get(id) + delta)));
    return this.view();
  }
  revertCurrent() { this.cancel(); this.cursors.set(this.currentId, 0); return this.view(); }
  revertAll() { this.cancel(); for (const id of this.ids) this.cursors.set(id, 0); return this.view(); }
  changedEntries() {
    return this.ids.flatMap(id => {
      const entry = this.currentVariant(id).entry;
      return same(entry, this.originals.get(id)) ? [] : [clone(entry)];
    });
  }
  view() {
    const id = this.currentId, cursor = this.cursors.get(id), variants = this.history.get(id), variant = variants[cursor];
    const original = clone(this.originals.get(id)), candidate = clone(variant.entry);
    return { id, index: this.index, total: this.ids.length, original, candidate,
      previous: clone(variants[Math.max(0, cursor - 1)].entry), variationIndex: cursor, variationTotal: variants.length - 1,
      report: clone(variant.report), originalMetrics: this.measure(original), candidateMetrics: this.measure(candidate),
      busy: this.busy, stale: this.stale, canApply: this.canApply, progress: { ...this.progress }, error: this.error };
  }
  async run({ currentOnly = false, onProgress = () => {} } = {}) {
    if (this.closed) return { cancelled: true };
    this.cancel(); const job = this.job, revision = this.revision, settings = clone(this.settings);
    const ids = currentOnly ? [this.currentId] : [...this.ids], results = [];
    const current = () => !this.closed && this.job === job && this.revision === revision;
    this.busy = true; this.error = null; this.progress = { completed: 0, total: ids.length }; onProgress(this.view());
    try {
      for (const id of ids) {
        await this.yieldToUi(); if (!current()) return { cancelled: true };
        const reroll = this.rerolls.get(id) + 1;
        const result = await this.tune(clone(this.originals.get(id)), { ...settings, seed: `${settings.seed ?? '42'}|${id}|${reroll}`, reroll }, { isCurrent: current, yieldToUi: this.yieldToUi });
        if (!current()) return { cancelled: true };
        const entry = result?.card ?? result?.item ?? result?.entry;
        if (!entry || entry[this.key] !== id) throw new Error(`Rebalance cannot replace the identity of '${id}'.`);
        const report = clone({ ...result, card: undefined, item: undefined, entry: undefined });
        if (currentOnly && same(entry, this.currentVariant(id).entry)) report.warnings = [...(report.warnings || []), 'This seed found the same legal result.'];
        results.push({ id, reroll, entry: clone(entry), report });
        this.progress = { completed: results.length, total: ids.length }; onProgress(this.view());
        await this.yieldToUi(); if (!current()) return { cancelled: true };
      }
      if (!current()) return { cancelled: true };
      for (const row of results) {
        const variants = this.history.get(row.id);
        variants.push({ entry: row.entry, report: row.report, revision, original: false });
        this.cursors.set(row.id, variants.length - 1); this.rerolls.set(row.id, row.reroll);
      }
      this.previewReady = true; this.settingsInvalidated = false;
      return { cancelled: false, count: results.length };
    } catch (error) { if (!current()) return { cancelled: true }; this.error = error.message; throw error; }
    finally { if (current()) this.busy = false; }
  }
}

/** Validate and normalize every replacement before taking one undo point and committing exact changed IDs. */
export function applyRebalanceSession(session, state, { pushHistory, normalize = value => value } = {}) {
  if (!session.canApply) throw new Error('Create a current preview before applying changes.');
  const list = state[session.target], key = session.key, byId = new Map(list.map(entry => [entry[key], entry]));
  for (const id of session.ids) {
    if (!byId.has(id)) throw new Error(`'${id}' is no longer in the draft. Reopen the rebalance dialog.`);
    if (!same(byId.get(id), session.originals.get(id))) throw new Error(`'${id}' changed outside this preview. Reopen the rebalance dialog.`);
  }
  const updates = new Map(session.changedEntries().map(entry => {
    const id = entry[key], replacement = normalize({ ...entry, _edited: true, _newDraft: false });
    if (!replacement || replacement[key] !== id) throw new Error(`Cannot apply changed identity '${id}'.`);
    return [id, replacement];
  }));
  const next = list.map(entry => updates.get(entry[key]) || entry);
  pushHistory?.(); state[session.target] = next;
  return { count: updates.size, ids: [...updates.keys()] };
}
