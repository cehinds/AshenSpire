import { createSaveManager, createMemoryStorage, META_KEY, META_BACKUP_KEY, RUN_KEY, SLOTS } from './save.js';
import { offlinePlay } from '../content/offlinePlay.js';

const BACKUP_KEY = 'sote_transfer_backup_v1';
const keys = [META_KEY, ...Array.from({ length: SLOTS }, (_, i) => i ? `${RUN_KEY}_s${i + 1}` : RUN_KEY)];

/** Transfer only the profile and run slots; validation never touches live storage. */
export function createSaveTransfer(storage, registries) {
  const snapshot = () => ({ format: offlinePlay.saveFormat, version: offlinePlay.saveVersion,
    entries: Object.fromEntries(keys.map(key => [key, storage.getItem(key)])) });
  const encode = data => JSON.stringify(data, null, 2);
  const validate = text => {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > offlinePlay.maxSaveBytes) throw new Error('Save file is too large.');
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('This is not a readable save file.'); }
    if (data?.format !== offlinePlay.saveFormat || data.version !== offlinePlay.saveVersion
      || !data.entries || Array.isArray(data.entries)
      || Object.keys(data.entries).length !== keys.length
      || !keys.every(key => Object.hasOwn(data.entries, key) && (data.entries[key] === null || typeof data.entries[key] === 'string'))) {
      throw new Error('Unsupported save file. Export a backup from Download & saves.');
    }
    const temporary = createMemoryStorage();
    for (const key of keys) if (data.entries[key] !== null) temporary.setItem(key, data.entries[key]);
    const manager = createSaveManager(temporary);
    manager.loadMeta();
    if (!manager.profileStatus().ok) throw new Error(`Profile cannot be imported: ${manager.profileStatus().reason}`);
    for (let slot = 1; slot <= SLOTS; slot++) {
      if (data.entries[keys[slot]] !== null && !manager.loadRun(registries, slot)) {
        throw new Error(`Slot ${slot} cannot be imported: ${manager.runStatus().reason}`);
      }
    }
    return { data, slots: manager.listSlots(), hasProfile: data.entries[META_KEY] !== null };
  };
  return {
    slotCount: SLOTS,
    createBackup: () => encode(snapshot()),
    previous: () => storage.getItem(BACKUP_KEY),
    inspect: text => { const { slots, hasProfile } = validate(text); return { slots, hasProfile }; },
    restore(text) {
      const { data } = validate(text);
      const before = snapshot();
      const oldMirror = storage.getItem(META_BACKUP_KEY);
      const write = (key, value) => {
        if (value === null) storage.removeItem(key); else storage.setItem(key, value);
        if (storage.getItem(key) !== value) throw new Error('The browser could not save the imported data.');
      };
      // Durable recovery copy must succeed before a single live slot changes.
      write(BACKUP_KEY, encode(before));
      try {
        for (const key of keys) write(key, data.entries[key]);
        write(META_BACKUP_KEY, data.entries[META_KEY]);
      } catch (error) {
        try { for (const key of keys) write(key, before.entries[key]); write(META_BACKUP_KEY, oldMirror); }
        catch { throw new Error('Import stopped. Download the previous-save backup to recover your original progress.'); }
        throw error;
      }
      return { ok: true };
    },
  };
}
