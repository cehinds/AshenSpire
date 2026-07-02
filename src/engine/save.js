// src/engine/save.js — run persistence with schema + content versioning
// (SPEC §3.12)
//
// Storage is injected so the module stays headless: the UI passes
// window.localStorage; tests pass a plain in-memory stub with the same
// getItem/setItem/removeItem shape. Saves that can't be trusted (unknown
// schemaVersion, corrupt JSON, dangling content ids after a content change)
// are ARCHIVED — moved aside, never silently deleted — and load returns null.

import { serializeRun, deserializeRun } from '../model/state.js';

export const RUN_KEY = 'sote_run_v1';
export const RUN_ARCHIVE_KEY = 'sote_run_archived';
export const META_KEY = 'sote_meta_v1';
const HISTORY_LIMIT = 20;

/**
 * createSaveManager(storage) → { saveRun, loadRun, clearRun, hasRun,
 *                                loadMeta, saveMeta, recordResult }
 */
export function createSaveManager(storage) {
  if (!storage || typeof storage.getItem !== 'function') {
    throw new Error('createSaveManager requires a storage with getItem/setItem/removeItem');
  }

  function archive(json, reason) {
    storage.setItem(RUN_ARCHIVE_KEY, JSON.stringify({ reason, save: json }));
    storage.removeItem(RUN_KEY);
  }

  return {
    /** Persist after every committed choice (SPEC §3.12). Stamps RNG counters. */
    saveRun(run, rng) {
      if (rng) run.streamCounters = rng.getCounters();
      storage.setItem(RUN_KEY, serializeRun(run));
    },

    /**
     * loadRun(registries) → run | null. Refuses and archives: corrupt JSON,
     * unknown schemaVersion, or (on contentVersion mismatch) any deck/relic/
     * flask id that no longer resolves against the current registries.
     */
    loadRun(registries) {
      const json = storage.getItem(RUN_KEY);
      if (!json) return null;
      let run;
      try {
        run = deserializeRun(json);
      } catch (e) {
        archive(json, e && e.message ? e.message : 'corrupt save');
        return null;
      }
      if (run.contentVersion !== registries.contentVersion) {
        const dangling =
          (run.deck || []).find((c) => !registries.cards.has(c.cardId)) ||
          (run.relics || []).find((id) => !registries.relics.has(id)) ||
          (run.flasks || []).find((f) => !registries.flasks.has(f.flaskId));
        if (dangling) {
          archive(json, `contentVersion ${run.contentVersion} → ${registries.contentVersion}: dangling id`);
          return null;
        }
        // Ids all still resolve: the run survives the content patch.
        run.contentVersion = registries.contentVersion;
      }
      return run;
    },

    hasRun() {
      return storage.getItem(RUN_KEY) != null;
    },

    clearRun() {
      storage.removeItem(RUN_KEY);
    },

    // ---- meta: settings + last N run results (SPEC §3.12) -------------------
    loadMeta() {
      try {
        const meta = JSON.parse(storage.getItem(META_KEY) || 'null');
        if (meta && typeof meta === 'object') return meta;
      } catch (e) {
        /* fall through to fresh meta */
      }
      return { settings: {}, results: [] };
    },

    saveMeta(meta) {
      storage.setItem(META_KEY, JSON.stringify(meta));
    },

    /** Append a run result (victory, floor, seed, class, …), capped at 20. */
    recordResult(result) {
      const meta = this.loadMeta();
      meta.results.push(result);
      if (meta.results.length > HISTORY_LIMIT) {
        meta.results.splice(0, meta.results.length - HISTORY_LIMIT);
      }
      this.saveMeta(meta);
      return meta;
    },
  };
}

/** Plain in-memory storage stub (tests, or environments without localStorage). */
export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}
