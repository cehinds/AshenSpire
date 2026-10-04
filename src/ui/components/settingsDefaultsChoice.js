import { openConfirmationModal } from './confirmationModal.js';
import { t, tFull } from '../strings.js';

// Escape, close and the local-settings button all preserve this device's values.
export function openSettingsDefaultsChoice({ onDefaults, onLocal, returnFocusElement, failed = false }) {
  const choose = (callback) => {
    let result;
    try { result = callback(); } catch { result = { ok: false }; }
    if (result?.ok === false) queueMicrotask(() => openSettingsDefaultsChoice({ onDefaults, onLocal, returnFocusElement, failed: true }));
  };
  return openConfirmationModal({
    title: t('settings.defaults.choice'),
    message: (failed ? t('settings.defaults.failed') + '\n\n' : '') + tFull('settings.defaults.choice'),
    confirmLabel: t('settings.defaults.use'),
    cancelLabel: t('settings.defaults.local'),
    onConfirm: () => choose(onDefaults),
    onCancel: () => choose(onLocal),
    returnFocusElement,
  });
}
