import { contentBundle } from '../content/index.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../model/gameProfile.js';
import { createRegistries } from '../model/registries.js';
import { retiredProfileReason } from '../model/retiredProfile.js';
import { validateContent } from '../model/validate.js';

/** Load a slot against its own Core2 pin without installing a live context. */
export function LoadSavedRunContext(manager, slot, {
  unpinnedRegistries = null,
  validate = (_profile, _configuration, authored) => validateContent(authored),
} = {}) {
  const savedProfile = manager.peekRunGameProfile(slot);
  // Only explicit headless callers can load fixtures that predate a profile pin.
  if (!savedProfile && unpinnedRegistries && !unpinnedRegistries.gameProfile) {
    const run = manager.loadRun(unpinnedRegistries, slot);
    return { run, reason: manager.runStatus().reason };
  }
  const retiredReason = manager.hasRun(slot) ? retiredProfileReason(savedProfile) : null;
  if (retiredReason) return { run: null, reason: 'retired game mode: ' + retiredReason, retiredReason };

  const gameProfile = savedProfile || resolveGameProfile('default');
  const authored = applyGameProfileToContent(contentBundle, gameProfile);
  const registries = bindGameProfileRegistries(createRegistries(authored), gameProfile);
  const run = manager.loadRun(registries, slot);
  if (!run) return { run: null, reason: manager.runStatus().reason };

  // Core2 mechanics come from the profile. The run keeps its saved opening settings.
  const configuration = run.advancedConfigSnapshot || { schemaVersion: 1, overrides: {} };
  const result = validate(gameProfile, configuration, authored);
  if (!result.ok) {
    const first = result.errors[0];
    throw new Error('Invalid game profile ' + gameProfile.id + ': ' + first.path + ': ' + first.msg);
  }
  return { run, registries, gameProfile, configuration };
}
