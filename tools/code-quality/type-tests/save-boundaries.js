// @ts-check
// Compiled only. Expected errors prove the public boundary types stay checked.
import { createMemoryStorage, createSaveManager } from '../../../src/engine/save.js';
import { CreateSaveTransfer } from '../../../src/engine/saveTransfer.js';
import { LoadSavedRunContext } from '../../../src/engine/savedRunContext.js';

const storage = createMemoryStorage();
const transfer = CreateSaveTransfer(storage);
const inspection = transfer.Inspect(transfer.CreateBackup());
void inspection.hasProfile;

// @ts-expect-error The live transfer API uses PascalCase.
transfer.inspect('');
// @ts-expect-error The payload at the public door is JSON text.
transfer.Restore(123);
// @ts-expect-error The inspection exposes hasProfile.
void inspection.hasprofile;
// @ts-expect-error Rollback requires storage removal.
CreateSaveTransfer({ getItem: () => null, setItem: () => {} });
// @ts-expect-error A profile alone is not a registry.
CreateSaveTransfer(storage, { gameProfile: { id: 'core', hash: 'hash' } });

const manager = createSaveManager(storage);
const context = LoadSavedRunContext(manager, 1);
void context.reason;
// @ts-expect-error A save slot is a number.
LoadSavedRunContext(manager, '1');
// @ts-expect-error Validation issues name a textual field path.
LoadSavedRunContext(manager, 1, { validate: () => ({ ok: false, errors: [{ path: 1, msg: 'invalid' }] }) });
LoadSavedRunContext(manager, 1, {
  validate(_profile, configuration) {
    // @ts-expect-error An arbitrary saved override must be narrowed before use.
    configuration.overrides?.example.trim();
    return { ok: true, errors: [] };
  },
});
