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
export const SLOTS = 3; // save slots, one run each
const HISTORY_LIMIT = 20;

// Slot 1 keeps the legacy key (backward compatible: existing saves are slot 1);
// slots 2..N use suffixed keys. All slot-taking methods default to slot 1.
function runKey(slot = 1) {
  return slot === 1 ? RUN_KEY : `${RUN_KEY}_s${slot}`;
}

/**
 * createSaveManager(storage) → { saveRun, loadRun, clearRun, hasRun, slotSummary,
 *                                listSlots, loadMeta, saveMeta, recordResult }
 */
export function createSaveManager(storage) {
  if (!storage || typeof storage.getItem !== 'function') {
    throw new Error('createSaveManager requires a storage with getItem/setItem/removeItem');
  }

  function archive(json, reason, slot = 1) {
    storage.setItem(RUN_ARCHIVE_KEY, JSON.stringify({ reason, save: json }));
    storage.removeItem(runKey(slot));
  }

  return {
    /** Persist after every committed choice (SPEC §3.12). Stamps RNG counters. */
    saveRun(run, rng, slot = 1) {
      if (rng) run.streamCounters = rng.getCounters();
      storage.setItem(runKey(slot), serializeRun(run));
    },

    /**
     * loadRun(registries, slot?) → run | null. Refuses and archives: corrupt
     * JSON, unknown schemaVersion, or (on contentVersion mismatch) any deck/
     * relic/flask id that no longer resolves against the current registries.
     */
    loadRun(registries, slot = 1) {
      const json = storage.getItem(runKey(slot));
      if (!json) return null;
      let run;
      try {
        run = deserializeRun(json);
      } catch (e) {
        archive(json, e && e.message ? e.message : 'corrupt save', slot);
        return null;
      }
      if (run.contentVersion !== registries.contentVersion) {
        const dangling =
          (run.deck || []).find((c) => !registries.cards.has(c.cardId)) ||
          (run.relics || []).find((id) => !registries.relics.has(id)) ||
          (run.flasks || []).find((f) => !registries.flasks.has(f.flaskId));
        if (dangling) {
          archive(json, `contentVersion ${run.contentVersion} → ${registries.contentVersion}: dangling id`, slot);
          return null;
        }
        // Ids all still resolve: the run survives the content patch.
        run.contentVersion = registries.contentVersion;
      }
      return run;
    },

    hasRun(slot = 1) {
      return storage.getItem(runKey(slot)) != null;
    },

    clearRun(slot = 1) {
      storage.removeItem(runKey(slot));
    },

    /**
     * slotSummary(slot?) → a cheap descriptor for the slot picker (no content
     * validation), or null if empty/corrupt. Full validation happens on loadRun.
     */
    slotSummary(slot = 1) {
      const json = storage.getItem(runKey(slot));
      if (!json) return null;
      try {
        const r = JSON.parse(json);
        return {
          slot,
          class: r.class,
          actNumber: r.actNumber,
          floor: r.floor,
          seedString: r.seedString,
          hp: r.hp,
          maxHp: r.maxHp,
          customization: r.customization,
        };
      } catch (e) {
        return null;
      }
    },

    /** listSlots() → [{ slot, summary|null }] for every slot. */
    listSlots() {
      const out = [];
      for (let s = 1; s <= SLOTS; s++) out.push({ slot: s, summary: this.slotSummary(s) });
      return out;
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
