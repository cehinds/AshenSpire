// @ts-check
import { contentBundle } from '../content/index.js';
import {
    applyGameProfileToContent,
    bindGameProfileRegistries,
    resolveGameProfile,
} from '../model/gameProfile.js';
import { createRegistries } from '../model/registries.js';
import { retiredProfileReason } from '../model/retiredProfile.js';
import { validateContent } from '../model/validate.js';

/** @typedef {{ id: string, hash: string }} SavedProfile */
/** @typedef {{ schemaVersion: number, overrides?: Record<string, unknown> }} SavedConfiguration */
/** @typedef {{ advancedConfigSnapshot?: SavedConfiguration | null }} SavedRunHeader */
/** @typedef {ReturnType<typeof createRegistries> & { readonly gameProfile?: SavedProfile }} SaveContextRegistries */
/** @typedef {{ ok: boolean, errors: readonly { path: string, msg: string }[] }} ContentValidation */

/**
 * @template {SavedRunHeader} Run
 * @typedef {object} SaveContextManager
 * @property {(slot: number) => SavedProfile | null} peekRunGameProfile
 * @property {(slot: number) => boolean} hasRun
 * @property {(registries: SaveContextRegistries, slot: number) => Run | null} loadRun
 * @property {() => { reason: string | null }} runStatus
 */

/**
 * @typedef {object} SavedRunOptions
 * @property {SaveContextRegistries | null} [unpinnedRegistries]
 * @property {(profile: SavedProfile, configuration: SavedConfiguration, authored: object) => ContentValidation} [validate]
 */

/**
 * @template {SavedRunHeader} Run
 * @typedef {{ run: Run | null, reason: string | null, retiredReason?: string } |
 * { run: Run, registries: SaveContextRegistries, gameProfile: SavedProfile, configuration: SavedConfiguration, reason?: never }} SavedRunContext
 */

/**
 * Load a slot against its own Core 2 pin without installing a live context.
 * @template {SavedRunHeader} Run
 * @param {SaveContextManager<Run>} manager
 * @param {number} slot
 * @param {SavedRunOptions} [options]
 * @returns {SavedRunContext<Run>}
 */
export function LoadSavedRunContext(manager, slot, {
    unpinnedRegistries = null,
    validate = (_profile, _configuration, authored) => validateContent(authored),
} = {})
{
    const savedProfile = manager.peekRunGameProfile(slot);
    // Only explicit headless callers can load fixtures that predate a profile pin.
    if (!savedProfile && unpinnedRegistries && !unpinnedRegistries.gameProfile)
    {
        const run = manager.loadRun(unpinnedRegistries, slot);
        return { run, reason: manager.runStatus().reason };
    }
    const retiredReason = manager.hasRun(slot) ? retiredProfileReason(savedProfile) : null;
    if (retiredReason)
    {
        return { run: null, reason: `retired game mode: ${retiredReason}`, retiredReason };
    }

    /** @type {SavedProfile} */
    const gameProfile = savedProfile || resolveGameProfile('default');
    /** @type {object} */
    const authored = applyGameProfileToContent(contentBundle, gameProfile);
    /** @type {SaveContextRegistries} */
    const registries = bindGameProfileRegistries(createRegistries(authored), gameProfile);
    const run = manager.loadRun(registries, slot);
    if (!run)
    {
        return { run: null, reason: manager.runStatus().reason };
    }

    // The profile owns the mechanics. The run retains its opening settings.
    const configuration = run.advancedConfigSnapshot || { schemaVersion: 1, overrides: {} };
    const result = validate(gameProfile, configuration, authored);
    if (!result.ok)
    {
        const first = result.errors[0];
        const reason = first ? `${first.path}: ${first.msg}` : 'content validation failed';
        throw new Error(`Invalid game profile ${gameProfile.id}: ${reason}`);
    }
    return { run, registries, gameProfile, configuration };
}
