// @ts-check
import {
    createSaveManager,
    createMemoryStorage,
    inlineRunJson,
    META_KEY,
    META_BACKUP_KEY,
    RUN_KEY,
    SLOTS,
} from './save.js';
import { offlinePlay } from '../content/offlinePlay.js';
import { LoadSavedRunContext } from './savedRunContext.js';

/** @typedef {import('./savedRunContext.js').SaveContextRegistries} SaveContextRegistries */
/** @typedef {Record<string, string | null>} BackupEntries */
/** @typedef {ReturnType<ReturnType<typeof createSaveManager>['listSlots']>} TransferSlots */

/**
 * @typedef {object} TransferStorage
 * @property {(key: string) => string | null} getItem
 * @property {(key: string, value: string) => void} setItem
 * @property {(key: string) => void} removeItem
 */

/**
 * @typedef {object} BackupEnvelope
 * @property {typeof offlinePlay.saveFormat} format
 * @property {typeof offlinePlay.saveVersion} version
 * @property {BackupEntries} entries
 */

/** @typedef {{ slots: TransferSlots, hasProfile: boolean }} TransferInspection */

/**
 * @typedef {object} SaveTransfer
 * @property {number} SlotCount
 * @property {() => string} CreateBackup
 * @property {() => string | null} Previous
 * @property {(text: string) => TransferInspection} Inspect
 * @property {(text: string) => { ok: true }} Restore
 */

const BACKUP_KEY = 'sote_transfer_backup_v1';
const keys = [
    META_KEY,
    ...Array.from({ length: SLOTS }, (_, i) => i ? `${RUN_KEY}_s${i + 1}` : RUN_KEY),
];

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value)
{
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is BackupEnvelope} */
function isBackupEnvelope(value)
{
    if (
        !isRecord(value) || value.format !== offlinePlay.saveFormat
        || value.version !== offlinePlay.saveVersion || !isRecord(value.entries)
    )
    {
        return false;
    }
    const entries = value.entries;
    return Object.keys(entries).length === keys.length
        && keys.every(key =>
            Object.hasOwn(entries, key)
            && (entries[key] === null || typeof entries[key] === 'string')
        );
}

/**
 * Transfer only the profile and run slots. Validation uses isolated storage.
 * @param {TransferStorage} storage
 * @param {SaveContextRegistries | null} [unpinnedRegistries]
 * @returns {SaveTransfer}
 */
export function CreateSaveTransfer(storage, unpinnedRegistries = null)
{
    const readEntries = () => Object.fromEntries(keys.map(key => [key, storage.getItem(key)]));
    /** @returns {BackupEnvelope} */
    const snapshot = (entries = readEntries()) => ({
        format: offlinePlay.saveFormat,
        version: offlinePlay.saveVersion,
        entries: Object.fromEntries(
            keys.map(
                key => [
                    key,
                    key === META_KEY ? entries[key] : inlineRunJson(entries[key], storage),
                ],
            ),
        ),
    });
    /** @param {BackupEnvelope} data */
    const encode = data => JSON.stringify(data, null, 2);
    /** @param {string} text */
    const validate = text =>
    {
        if (
            typeof text !== 'string'
            || new TextEncoder().encode(text).length > offlinePlay.maxSaveBytes
        )
        {
            throw new Error('Save file is too large.');
        }
        /** @type {unknown} */
        let data;
        try
        {
            data = JSON.parse(text);
        }
        catch
        {
            throw new Error('This is not a readable save file.');
        }
        if (!isBackupEnvelope(data))
        {
            throw new Error('Unsupported save file. Export a backup from Download & saves.');
        }

        const temporary = createMemoryStorage();
        for (const key of keys)
        {
            if (data.entries[key] !== null)
            {
                temporary.setItem(key, data.entries[key]);
            }
        }
        const manager = createSaveManager(temporary);
        manager.loadMeta();
        if (!manager.profileStatus().ok)
        {
            throw new Error(`Profile cannot be imported: ${manager.profileStatus().reason}`);
        }
        for (let slot = 1; slot <= SLOTS; slot++)
        {
            if (data.entries[keys[slot]] === null)
            {
                continue;
            }
            try
            {
                const { run, reason } = LoadSavedRunContext(manager, slot, { unpinnedRegistries });
                if (!run)
                {
                    throw new Error(String(reason));
                }
            }
            catch (error)
            {
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`Slot ${slot} cannot be imported: ${message}`);
            }
        }
        return { data, slots: manager.listSlots(), hasProfile: data.entries[META_KEY] !== null };
    };
    return {
        SlotCount: SLOTS,
        CreateBackup: () => encode(snapshot()),
        Previous: () => storage.getItem(BACKUP_KEY),
        Inspect: text =>
        {
            const { slots, hasProfile } = validate(text);
            return { slots, hasProfile };
        },
        Restore(text)
        {
            const { data } = validate(text);
            const before = readEntries();
            const oldMirror = storage.getItem(META_BACKUP_KEY);
            /** @param {string} key @param {string | null} value */
            const write = (key, value) =>
            {
                if (value === null)
                {
                    storage.removeItem(key);
                }
                else
                {
                    storage.setItem(key, value);
                }
                if (storage.getItem(key) !== value)
                {
                    throw new Error('The browser could not save the imported data.');
                }
            };
            // Preserve a portable backup before replacing any live slots.
            write(BACKUP_KEY, encode(snapshot(before)));
            try
            {
                for (const key of keys)
                {
                    write(key, data.entries[key]);
                }
                write(META_BACKUP_KEY, data.entries[META_KEY]);
            }
            catch (error)
            {
                try
                {
                    for (const key of keys)
                    {
                        write(key, before[key]);
                    }
                    write(META_BACKUP_KEY, oldMirror);
                }
                catch
                {
                    throw new Error(
                        'Import stopped. Download the previous-save backup to recover your original progress.',
                    );
                }
                throw error;
            }
            return { ok: true };
        },
    };
}

/**
 * @deprecated Use CreateSaveTransfer. This adapter keeps the archived QA entry point.
 * @param {TransferStorage} storage
 * @param {SaveContextRegistries | null} [unpinnedRegistries]
 */
export function createSaveTransfer(storage, unpinnedRegistries = null)
{
    const transfer = CreateSaveTransfer(storage, unpinnedRegistries);
    return {
        slotCount: transfer.SlotCount,
        createBackup: transfer.CreateBackup,
        previous: transfer.Previous,
        inspect: transfer.Inspect,
        restore: transfer.Restore,
    };
}
