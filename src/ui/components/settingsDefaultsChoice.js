import { OpenConfirmationModal } from './confirmationModal.js';
import { t, UiFullText } from '../strings.js';

// Escape, close and the local-settings button all preserve this device's values.
export function openSettingsDefaultsChoice({ onDefaults, onLocal, returnFocusElement, failed = false }) {
  const choose = async (callback) => {
    let result;
    try { result = await callback(); } catch { result = { ok: false }; }
    if (result?.ok === false) queueMicrotask(() => openSettingsDefaultsChoice({ onDefaults, onLocal, returnFocusElement, failed: true }));
  };
  return OpenConfirmationModal({
    title: t('settings.defaults.choice'),
    message: (failed ? t('settings.defaults.failed') + '\n\n' : '') + UiFullText('settings.defaults.choice'),
    confirmLabel: t('settings.defaults.use'),
    cancelLabel: t('settings.defaults.local'),
    onConfirm: () => choose(onDefaults),
    onCancel: () => choose(onLocal),
    returnFocusElement,
  });
}
