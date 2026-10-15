import { t } from '../strings.js';
import { resolveGameProfile } from '../../model/gameProfile.js';

// Store author JSON rather than a resolved snapshot: the next build resolves it
// against its own catalog. A running save retains its immutable snapshot.
export function resolveNewGameProfile(value = 'default') {
  return resolveGameProfile(typeof value === 'string' && value.trim().startsWith('{') ? JSON.parse(value) : value);
}

export function readNewGameProfile(settings = {}, fallback = resolveGameProfile('default')) {
  if (!settings.newGameProfile) return fallback;
  try { return resolveNewGameProfile(settings.newGameProfile); }
  catch { return fallback; }
}

export function mountGameProfileSettings(host, { settings, onChange, gameProfile = null }) {
  const render = () => {
    host.replaceChildren();
    const query = new URLSearchParams(globalThis.location?.search || '');
    const fallback = query.get('gameProfile') || query.get('wb.gameProfile') || globalThis.__ASHEN_GAME_PROFILE_PREVIEW__ || 'default';
    const value = settings.newGameProfile || fallback;
    const profile = gameProfile?.read() || resolveNewGameProfile(value);
    let imported = settings.importedGameProfile || (typeof value === 'string' && value.trim().startsWith('{') ? value : null);
    // An imported author in an explicit preview URL is also a selectable import.
    if (fallback.trim().startsWith('{') && resolveNewGameProfile(fallback).hash === profile.hash) imported = fallback;
    mountGameProfileSelector(host, {
      profile, importedProfile: imported ? resolveNewGameProfile(imported) : null,
      onSelect: async selection => {
        const author = selection === 'imported' ? imported : typeof selection === 'object' ? JSON.stringify(selection) : selection;
        resolveNewGameProfile(author); // Resolve completely before a durable write.
        const changes = { newGameProfile: author };
        if (typeof selection === 'object') changes.importedGameProfile = author;
        if ((await onChange(changes))?.ok === false) throw new Error(t('gameProfile.settings.saveFailed'));
        Object.assign(settings, changes);
        render();
      },
    });
  };
  try { render(); }
  catch (error) {
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = t('gameProfile.settings.invalid', { error: error.message });
    host.append(status);
    // A stale imported author must not prevent selecting a built-in profile.
    mountGameProfileSelector(host, { profile: resolveGameProfile('default'), onSelect: async value => {
      resolveNewGameProfile(value);
      const changes = { newGameProfile: typeof value === 'object' ? JSON.stringify(value) : value, importedGameProfile: null };
      if (typeof value === 'object') changes.importedGameProfile = changes.newGameProfile;
      if ((await onChange(changes))?.ok === false) throw new Error(t('gameProfile.settings.saveFailed'));
      Object.assign(settings, changes); render();
    } });
  }
}

// New-run configuration only: selecting/importing never mutates a running save.
export function mountGameProfileSelector(host, { profile, importedProfile = null, onSelect }) {
  const panel = document.createElement('div');
  panel.className = 'game-profile-selector set-row set-row-wide';
  panel.style.cssText = 'display:flex;flex-wrap:wrap;gap:1rem;align-items:center;margin:.75rem 0';
  const label = document.createElement('label');
  label.textContent = t('gameProfile.selector.copy1');
  label.style.cssText = 'display:flex;flex-wrap:wrap;gap:.75rem;align-items:center';
  const select = document.createElement('select');
  select.className = 'set-choice-select';
  select.setAttribute('aria-label', t('gameProfile.selector.copy2'));
  const names = { current: t('gameProfile.settings.current'), core: t('gameProfile.settings.core'), imported: t('gameProfile.settings.imported') };
  for (const id of ['current', 'core']) select.append(new Option(names[id], id));
  if (importedProfile) select.append(new Option(names.imported, 'imported'));
  const chosen = importedProfile?.hash === profile.hash ? 'imported' : profile.id === 'core' ? 'core' : 'current';
  select.value = chosen;
  label.append(select);
  const upload = document.createElement('input');
  upload.type = 'file'; upload.accept = '.json,application/json';
  upload.setAttribute('aria-label', t('gameProfile.selector.copy3'));
  upload.hidden = true;
  const importButton = document.createElement('button');
  importButton.type = 'button'; importButton.className = 'as-btn';
  importButton.textContent = t('gameProfile.settings.import');
  importButton.addEventListener('click', () => upload.click());
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.style.cssText = 'width:100%;font-size:.9em;overflow-wrap:anywhere';
  status.textContent = t('gameProfile.settings.future', { profile: names[chosen] });
  let pending = false;
  const apply = async value => {
    if (pending) return;
    pending = true; select.disabled = true; upload.disabled = true; importButton.disabled = true;
    try { await onSelect(value); }
    catch (error) {
      status.textContent = t('gameProfile.settings.invalid', { error: error.message });
      select.value = chosen;
    } finally { pending = false; select.disabled = false; upload.disabled = false; importButton.disabled = false; }
  };
  select.addEventListener('change', () => apply(select.value));
  upload.addEventListener('change', async () => {
    try {
      const file = upload.files?.[0];
      if (!file) return;
      if (file.size > 1024 * 1024) throw new Error(t('gameProfile.settings.fileTooLarge'));
      await apply(JSON.parse(await file.text()));
    } catch (error) { status.textContent = t('gameProfile.settings.invalid', { error: error.message }); }
    finally { upload.value = ''; }
  });
  panel.append(label, importButton, upload, status); host.append(panel);
  return panel;
}
