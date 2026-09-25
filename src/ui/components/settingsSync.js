// src/ui/components/settingsSync.js — Settings → Advanced → Defaults & sync.
//
// The panel over src/model/settingsSync.js: save this device's settings as the
// profile on GitHub, load the profile here (with a preview of exactly what will
// change before anything does), and optionally load it every time the game
// starts on this device. Debug builds only — the section is filed under
// Advanced, which a release build does not show (src/ui/buildChannel.js).

import { contentBundle } from '../../content/index.js';
import { SETTINGS_DEFAULTS } from '../../content/settingsDefaults.js';
import { SEED_KEY } from '../../model/settingsDefaults.js';
import { saveJsonFile } from '../services/saveJsonFile.js';
import {
  SYNC_STORAGE, syncConfig, syncConfigProblems, profileKeys, profileText, profileChanges, profileDiff,
  fetchProfile, pushProfile, profileWebUrl, listProfiles, profileName, profilePath, normalizeProfileName, DEVICE_KEYS,
} from '../../model/settingsSync.js';
import { esc } from './tooltip.js';

const DIFF_PREVIEW = 12;

function store() { try { return globalThis.localStorage || null; } catch { return null; } }
function read(key) { try { return store()?.getItem(key) ?? null; } catch { return null; } }
// A status that must outlive a repaint (Apply repaints Settings mid-handler).
let carriedStatus = '';

// The version marker could not be written: say what that costs, never claim it.
const UNNOTED = 'This device could not note that version (storage is off or full here), so a later start may load it again over changes you make here.';
const STORAGE_REFUSED = 'This browser would not save that choice (storage is off or full here), so it is unchanged.';

/** write(key, value) → true when storage now holds exactly that (or nothing, for a clear). */
function write(key, value) {
  const clear = value === null || value === undefined || value === '';
  try {
    const s = store();
    if (!s) return false;
    if (clear) s.removeItem(key); else s.setItem(key, value);
    return clear ? s.getItem(key) === null : s.getItem(key) === value;
  } catch { return false; } // storage refused
}
export function deviceSyncConfig() {
  try { return syncConfig(JSON.parse(read(SYNC_STORAGE.config) || '{}')); } catch { return syncConfig({}); }
}

function show(value) {
  if (value === undefined) return 'default';
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  const text = String(value);
  return text.length > 28 ? `${text.slice(0, 27)}…` : text;
}

// The owner's promoted defaults: where a key a profile leaves out goes back to.
const PROMOTED = SETTINGS_DEFAULTS.values || {};

/**
 * applyProfile(settings, onChange, parsed) — write a parsed profile through the
 * one save path. Returns the number of settings that moved.
 */
export function applyProfile(settings, onChange, parsed, promoted = PROMOTED) {
  const diff = profileDiff(settings, parsed, promoted);
  const changed = {};
  const had = {};
  const seedBefore = settings[SEED_KEY];
  for (const { key, to } of diff) {
    changed[key] = to;
    had[key] = Object.hasOwn(settings, key) ? { value: settings[key] } : null;
    if (to === undefined) delete settings[key]; else settings[key] = to;
  }
  // Who owns each value afterwards, in the seed record. A key the profile
  // leaves out goes back to the promotion, and is the promotion's again (as a
  // Reset makes it). A key the profile sets takes the ownership the saving
  // device gave it (`promotionOwned`), when the profile says; a profile saved
  // before that field leaves ownership alone. A key moved off its recorded
  // value is pruned, as the save path would, since sending the record
  // overrides that.
  const toPromotion = (parsed.cleared || []).filter((key) => Object.hasOwn(promoted, key));
  const listed = Array.isArray(parsed.promotionOwned) ? new Set(parsed.promotionOwned) : null;
  if (toPromotion.length || listed) {
    const record = seedBefore && typeof seedBefore === 'object' ? seedBefore : {};
    const next = { ...record };
    for (const [key, to] of Object.entries(changed)) if (Object.hasOwn(next, key) && next[key] !== to) delete next[key];
    for (const key of toPromotion) next[key] = promoted[key];
    if (listed) {
      for (const [key, value] of Object.entries(parsed.changes || {})) {
        if (listed.has(key) && Object.hasOwn(promoted, key) && promoted[key] === value) next[key] = value;
        else delete next[key];
      }
    }
    // Only when it changes: a load that moves nothing and owns nothing new
    // writes nothing.
    const same = JSON.stringify(Object.entries(next).sort()) === JSON.stringify(Object.entries(record).sort());
    if (!same || (seedBefore === undefined && Object.keys(next).length)) {
      settings[SEED_KEY] = next;
      changed[SEED_KEY] = next;
    }
  }
  // Nothing visible moved and no ownership changed: nothing to save.
  if (!Object.keys(changed).length) return 0;
  const result = onChange(changed);
  if (result?.ok === false) {
    // Not saved, so not applied: put every value back as it was — here, and
    // through the same onChange, so the game's own settings and the live
    // display and audio (applied before the save was refused) go back too.
    const back = {};
    for (const [key, before] of Object.entries(had)) {
      back[key] = before ? before.value : undefined;
      if (before) settings[key] = before.value; else delete settings[key];
    }
    // The save path dropped the moved keys from the seed record; hand it back.
    if (seedBefore !== undefined || Object.hasOwn(changed, SEED_KEY)) {
      back[SEED_KEY] = seedBefore;
      if (seedBefore === undefined) delete settings[SEED_KEY]; else settings[SEED_KEY] = seedBefore;
    }
    onChange(back);
    throw new Error('Settings could not be saved on this device.');
  }
  return diff.length;
}

/**
 * autoLoadProfile({ settings, onChange, rows, fetch }) → { applied, reason }
 * Boot hook: when this device opted in, load the profile once per new version
 * of it (by blob sha), so a setting changed here afterwards is not overwritten
 * again until the profile itself changes.
 */
/** True when this device loads the profile at startup. */
export function autoLoadEnabled() { return read(SYNC_STORAGE.auto) === '1'; }

/** True when this device saves and loads its screen settings (DEVICE_KEYS) with the profile. */
export function includeDeviceEnabled() { return read(SYNC_STORAGE.includeDevice) === '1'; }

export async function autoLoadProfile({ settings, onChange, rows, fetch = globalThis.fetch, stillWanted = () => true }) {
  if (!autoLoadEnabled()) return { applied: 0, reason: 'off' };
  const cfg = deviceSyncConfig();
  const remote = await fetchProfile(cfg, { token: read(SYNC_STORAGE.token) || '', fetch });
  if (!remote) return { applied: 0, reason: 'missing' };
  if (remote.sha && remote.sha === read(SYNC_STORAGE.lastSha)) return { applied: 0, reason: 'unchanged' };
  // Arrived after the game went on without it: change nothing mid-session and
  // leave the sha unrecorded, so the next start loads it.
  if (!stillWanted()) return { applied: 0, reason: 'late' };
  const parsed = profileChanges(remote.text, contentBundle, settings, rows, profileKeys(rows, { includeDevice: includeDeviceEnabled() }));
  // Load once per version: if this device cannot record the version, loading
  // it now would load it again on every start and overwrite edits made here.
  const previous = read(SYNC_STORAGE.lastSha);
  if (!write(SYNC_STORAGE.lastSha, remote.sha || '')) return { applied: 0, reason: 'unrecorded' };
  let applied;
  try { applied = applyProfile(settings, onChange, parsed); } catch (error) { write(SYNC_STORAGE.lastSha, previous); throw error; }
  write(SYNC_STORAGE.lastAt, new Date().toISOString());
  return { applied, reason: 'loaded' };
}

export function renderSettingsSync(mount, { settings, onChange, rows, afterApply = () => {} }) {
  // Read at each use: the per-device toggle changes which keys a profile owns.
  const profileKeysNow = () => profileKeys(rows, { includeDevice: includeDeviceEnabled() });
  const labelOf = new Map(rows.map((row) => [row.key, String(row.label || row.key).replace(/<[^>]*>/g, '')]));
  let cfg = deviceSyncConfig();
  let pending = null;
  // Each load and each location change takes a new generation; a load that
  // finishes under an older one is dropped, never shown under the new place.
  let generation = 0;
  // The named profiles on the sync branch: null until listed. A listing that
  // finishes after the location changed is dropped, like a stale load.
  let profiles = null;
  let listGeneration = 0;
  let listNote = '';
  const deviceLabels = DEVICE_KEYS.filter((key) => labelOf.has(key)).map((key) => labelOf.get(key)).join(', ');

  const pickerOptions = () => {
    const active = profileName(cfg);
    const names = [...new Set([...(profiles || []), active])].sort((a, b) => a.localeCompare(b));
    return names.map((name) => `<option value="${esc(name)}"${name === active ? ' selected' : ''}>${esc(name)}${profiles && !profiles.includes(name) ? ' (not saved yet)' : ''}</option>`).join('');
  };
  const fillPicker = () => {
    const select = mount.querySelector('[data-sync-profile]');
    if (select) select.innerHTML = pickerOptions();
    const note = mount.querySelector('[data-sync-list-note]');
    if (note) note.textContent = listNote;
  };
  const refreshProfiles = async () => {
    const mine = ++listGeneration;
    const from = cfg;
    listNote = 'Listing profiles…';
    fillPicker();
    try {
      const names = await listProfiles(from, { token: read(SYNC_STORAGE.token) || '' });
      if (mine !== listGeneration || [from.owner, from.repo, from.branch].join('/') !== [cfg.owner, cfg.repo, cfg.branch].join('/')) return;
      profiles = names;
      listNote = names.length ? `${names.length} profile${names.length === 1 ? '' : 's'} on ${from.branch}.` : `No profiles on ${from.branch} yet.`;
    } catch (error) {
      if (mine !== listGeneration) return;
      listNote = error.message;
    }
    fillPicker();
  };
  const useProfile = (name) => {
    let path;
    try { path = profilePath(name); } catch (error) { status(error.message); return; }
    if (path === cfg.path) { status(`Already using the “${name}” profile.`); return; }
    const next = syncConfig({ ...cfg, path });
    if (!write(SYNC_STORAGE.config, JSON.stringify(next))) { status(STORAGE_REFUSED); return; }
    cfg = next;
    generation += 1;
    pending = null;
    write(SYNC_STORAGE.lastSha, null);
    write(SYNC_STORAGE.lastAt, null);
    draw();
    status(`Now using the “${name}” profile. Save, Load and start-up loading use it on this device.`);
  };

  const draw = () => {
    const token = read(SYNC_STORAGE.token);
    const auto = read(SYNC_STORAGE.auto) === '1';
    const includeDevice = includeDeviceEnabled();
    const active = profileName(cfg);
    const lastAt = read(SYNC_STORAGE.lastAt);
    mount.innerHTML = `<div class="set-sync">
      <p class="set-note">Your defaults are one file on GitHub. Save them from any device, and every other device can load them —
        on request, or each time the game starts. Loading replaces this device's settings with the file's; a preview shows what will change first.</p>
      <div class="set-card-list">
        <div class="as-row setting set-row set-row-wide">
          <span class="as-labelstack"><span class="ls-label">Profile: <b class="set-sync-active" data-sync-active>${esc(active)}</b></span>
            <span class="ls-hint set-note"><a href="${esc(profileWebUrl(cfg))}" target="_blank" rel="noopener">${esc(`${cfg.owner}/${cfg.repo} · ${cfg.branch} · ${cfg.path}`)}</a>${lastAt ? ` · last loaded here ${esc(new Date(lastAt).toLocaleString())}` : ''}</span></span>
          <span class="r-trail set-sync-acts">
            <button type="button" class="as-btn" data-sync="save"${token ? '' : ' disabled title="Add a token below to save"'}>Save my settings to GitHub</button>
            <button type="button" class="as-btn" data-sync="load">Load from GitHub…</button>
          </span>
        </div>
        <div class="set-sync-preview" data-sync-preview hidden></div>
        <div class="as-row setting set-row set-row-wide">
          <span class="as-labelstack"><span class="ls-label">Named profile</span>
            <span class="ls-hint set-note">Keep several (desk, phone, balance-a…). Pick one, or type a new name — it is created on the first save.
              <span data-sync-list-note>${esc(listNote)}</span></span></span>
          <span class="r-trail set-sync-acts">
            <select class="set-sync-select" data-sync-profile aria-label="Named profile">${pickerOptions()}</select>
            <button type="button" class="as-btn" data-sync="list">Refresh list</button>
            <input type="text" class="set-text" data-sync-name autocomplete="off" spellcheck="false" maxlength="45" placeholder="new name, e.g. phone" aria-label="Profile name">
            <button type="button" class="as-btn" data-sync="name">Use name</button>
          </span>
        </div>
        <div class="as-row setting set-row">
          <span class="as-labelstack"><span class="ls-label">Include this device's screen settings</span>
            <span class="ls-hint set-note">On this device only. Off: ${esc(deviceLabels || 'screen settings')} stay out of what you save and are left alone when you load. On: they are saved and loaded like everything else.</span></span>
          <span class="r-trail"><button type="button" class="as-toggle toggle${includeDevice ? ' on' : ''}" role="switch" aria-checked="${includeDevice}" data-sync="device" aria-label="Include this device's screen settings"><span class="knob"></span></button></span>
        </div>
        <div class="as-row setting set-row">
          <span class="as-labelstack"><span class="ls-label">Load when the game starts</span>
            <span class="ls-hint set-note">On this device only. Loads a new version of the file once; changes you make here afterwards stay until the file changes again.</span></span>
          <span class="r-trail"><button type="button" class="as-toggle toggle${auto ? ' on' : ''}" role="switch" aria-checked="${auto}" data-sync="auto" aria-label="Load when the game starts"><span class="knob"></span></button></span>
        </div>
        <div class="as-row setting set-row set-row-wide">
          <span class="as-labelstack"><span class="ls-label">GitHub token (for saving)</span>
            <span class="ls-hint set-note">${token ? 'A token is stored on this device.' : 'None on this device. Loading works without one.'}
              Make a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">fine-grained token</a> for this repository with
              <b>Contents: read and write</b>. It stays in this browser; it is never exported, synced, or put in a save.</span></span>
          <span class="r-trail set-sync-acts">
            <input type="password" class="set-text" data-sync-token autocomplete="off" spellcheck="false" placeholder="${token ? '•••••••• stored' : 'github_pat_…'}" aria-label="GitHub token">
            <button type="button" class="as-btn" data-sync="token">Store</button>
            ${token ? '<button type="button" class="as-btn" data-sync="forget">Forget</button>' : ''}
          </span>
        </div>
        <div class="as-row setting set-row set-row-wide">
          <span class="as-labelstack"><span class="ls-label">Without GitHub</span>
            <span class="ls-hint set-note">The same file, by hand: copy it, or download it and load it with Load settings.</span></span>
          <span class="r-trail set-sync-acts">
            <button type="button" class="as-btn" data-sync="copy">Copy JSON</button>
            <button type="button" class="as-btn" data-sync="download">Download JSON</button>
          </span>
        </div>
        <details class="set-sync-where">
          <summary class="as-btn">Where the profile lives</summary>
          <div class="set-sync-fields">
            ${['owner', 'repo', 'branch', 'base', 'path'].map((field) => `<label><span>${{ owner: 'Owner', repo: 'Repository', branch: 'Branch', base: 'New branch starts from', path: 'File' }[field]}</span>
              <input type="text" class="set-text" data-sync-field="${field}" value="${esc(cfg[field])}" spellcheck="false"></label>`).join('')}
            <button type="button" class="as-btn" data-sync="where">Use these</button>
          </div>
        </details>
      </div>
      <p class="set-note" data-sync-status role="status" aria-live="polite"></p>
    </div>`;
    wire();
  };

  const status = (text) => { const el = mount.querySelector('[data-sync-status]'); if (el) el.textContent = text; };
  const busy = (btn, on, label) => { btn.disabled = on; if (label) btn.textContent = label; };

  const previewLoad = async (btn) => {
    // A new request retires the old answer: no Apply may install a profile
    // fetched before this one, whatever this request turns out to be.
    pending = null;
    const mine = ++generation;
    const from = cfg;
    const stale = mount.querySelector('[data-sync-preview]');
    if (stale) { stale.hidden = true; stale.innerHTML = ''; }
    busy(btn, true, 'Loading…');
    try {
      const remote = await fetchProfile(from, { token: read(SYNC_STORAGE.token) || '' });
      if (mine !== generation || !btn.isConnected) return;
      if (!remote) { status('There is no profile there yet. Save one from a device first.'); return; }
      const parsed = profileChanges(remote.text, contentBundle, settings, rows, profileKeysNow());
      const diff = profileDiff(settings, parsed, PROMOTED);
      pending = { parsed, sha: remote.sha };
      // Already matching IS loaded: record this version, or the next start
      // would treat it as new and overwrite edits made here since.
      if (!diff.length) {
        // Nothing visible moves, but a key the profile leaves out may still go
        // back to the promotion: save that ownership before calling it loaded.
        try { applyProfile(settings, onChange, parsed); } catch (error) { status(error.message); return; }
        if (!write(SYNC_STORAGE.lastSha, remote.sha || '')) {
          status('This device already matches the profile, but it could not note that (storage is off or full here), so a later start may load it again over changes you make.');
          return;
        }
        write(SYNC_STORAGE.lastAt, new Date().toISOString());
      }
      const box = mount.querySelector('[data-sync-preview]');
      box.hidden = false;
      box.innerHTML = diff.length
        ? `<p><b>${diff.length} setting${diff.length === 1 ? '' : 's'} will change on this device.</b></p>
          <ul class="set-sync-diff">${diff.slice(0, DIFF_PREVIEW).map(({ key, from, to }) => `<li><span>${esc(labelOf.get(key) || key)}</span> <s>${esc(show(from))}</s> → <b>${esc(show(to))}</b></li>`).join('')}</ul>
          ${diff.length > DIFF_PREVIEW ? `<p class="set-note">…and ${diff.length - DIFF_PREVIEW} more.</p>` : ''}
          ${parsed.warnings.length ? `<p class="set-note">${esc(parsed.warnings.join(' '))}</p>` : ''}
          <div class="set-sync-acts"><button type="button" class="as-btn" data-sync="apply">Apply</button><button type="button" class="as-btn" data-sync="cancel">Cancel</button></div>`
        : '<p>This device already matches the profile.</p>';
      box.querySelector('[data-sync="apply"]')?.addEventListener('click', () => {
        try {
          // What every key held before, so Settings can offer Undo.
          const before = Object.fromEntries(profileDiff(settings, pending.parsed, PROMOTED).map(({ key, from }) => [key, from]));
          // …and which of them the promotion owned, so Undo hands those back too.
          before[SEED_KEY] = settings[SEED_KEY];
          const moved = applyProfile(settings, onChange, pending.parsed);
          const noted = write(SYNC_STORAGE.lastSha, pending.sha || '');
          write(SYNC_STORAGE.lastAt, new Date().toISOString());
          pending = null;
          // afterApply repaints Settings and mounts a new panel: carry the
          // warning across so the panel the player sees shows it.
          if (!noted) carriedStatus = UNNOTED;
          afterApply(moved, before);
          if (!noted && mount.isConnected) { status(UNNOTED); carriedStatus = ''; }
        } catch (error) { status(error.message); }
      });
      box.querySelector('[data-sync="cancel"]')?.addEventListener('click', () => { pending = null; box.hidden = true; box.innerHTML = ''; });
      status('');
    } catch (error) {
      status(error.message);
    } finally { busy(btn, false, 'Load from GitHub…'); }
  };

  function wire() {
    const on = (name, fn) => mount.querySelector(`[data-sync="${name}"]`)?.addEventListener('click', (event) => fn(event.currentTarget));
    on('load', previewLoad);
    on('save', async (btn) => {
      // A preview loaded before this save is of the version it replaces:
      // drop it (and any load still in flight) rather than offer to apply it.
      generation += 1;
      pending = null;
      const box = mount.querySelector('[data-sync-preview]');
      if (box) { box.hidden = true; box.innerHTML = ''; }
      busy(btn, true, 'Saving…');
      try {
        const keys = profileKeysNow();
        const text = profileText(settings, keys, { contentVersion: contentBundle.version });
        // Never upload a file another device's import would refuse.
        profileChanges(text, contentBundle, {}, rows, keys);
        // Saved against a snapshot of the location; if the location changes
        // before GitHub answers, this answer belongs to the old one and is
        // dropped rather than recorded (or announced) under the new one.
        const target = cfg;
        const mine = generation;
        const result = await pushProfile(target, text, { token: read(SYNC_STORAGE.token), message: `Update settings profile ${profileName(target)} (${Object.keys(JSON.parse(text).overrides).length} settings)` });
        if (mine !== generation || target !== cfg) return;
        const noted = write(SYNC_STORAGE.lastSha, result.sha || '');
        status((result.unchanged ? 'The profile on GitHub already matches this device.'
          : `Saved the “${profileName(target)}” profile${result.branchCreated ? ` — created the ${target.branch} branch` : ''}. Other devices can load it now.`)
          + (noted ? '' : ` ${UNNOTED}`));
        if (profiles && !profiles.includes(profileName(target))) { profiles = [...profiles, profileName(target)].sort((a, b) => a.localeCompare(b)); fillPicker(); }
      } catch (error) { status(error.message); } finally { busy(btn, false, 'Save my settings to GitHub'); }
    });
    on('auto', (btn) => {
      const next = read(SYNC_STORAGE.auto) !== '1';
      if (!write(SYNC_STORAGE.auto, next ? '1' : null)) { status(STORAGE_REFUSED); return; }
      btn.classList.toggle('on', next);
      btn.setAttribute('aria-checked', String(next));
    });
    on('device', (btn) => {
      const next = !includeDeviceEnabled();
      if (!write(SYNC_STORAGE.includeDevice, next ? '1' : null)) { status(STORAGE_REFUSED); return; }
      // What a load would do has changed: an open preview is no longer true,
      // and the loaded version must be read again under the new scope.
      write(SYNC_STORAGE.lastSha, null);
      generation += 1;
      pending = null;
      const box = mount.querySelector('[data-sync-preview]');
      if (box) { box.hidden = true; box.innerHTML = ''; }
      btn.classList.toggle('on', next);
      btn.setAttribute('aria-checked', String(next));
    });
    on('list', () => { refreshProfiles(); });
    mount.querySelector('[data-sync-profile]')?.addEventListener('change', (event) => useProfile(event.currentTarget.value));
    on('name', () => {
      const typed = mount.querySelector('[data-sync-name]').value;
      const name = normalizeProfileName(typed);
      if (!name) { status(typed.trim() ? 'Use 1–40 letters, digits, dot, dash or underscore for a profile name.' : 'Type a profile name first.'); return; }
      useProfile(name);
    });
    on('token', () => {
      const value = mount.querySelector('[data-sync-token]').value.trim();
      if (!value) { status('Paste a token first.'); return; }
      if (!write(SYNC_STORAGE.token, value)) {
        status('This browser would not store the token (storage is off or full here), so saving is unavailable on this device. Loading still works.');
        return;
      }
      draw();
      status('Token stored on this device.');
    });
    on('forget', () => {
      if (!write(SYNC_STORAGE.token, null)) { status('The token could not be removed: this browser refused to change its storage. Clear this site\'s data in the browser to remove it.'); return; }
      draw();
      status('Token removed from this device.');
    });
    on('copy', async (btn) => {
      const text = profileText(settings, profileKeysNow(), { contentVersion: contentBundle.version });
      try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; } catch { console.log(text); btn.textContent = 'In console'; }
      setTimeout(() => { if (btn.isConnected) btn.textContent = 'Copy JSON'; }, 1800);
    });
    on('download', () => saveJsonFile(profileText(settings, profileKeysNow(), { contentVersion: contentBundle.version }), {
      filename: `ashen-spire-settings-${profileName(cfg)}.json`, description: 'Ashen Spire settings profile',
    }));
    on('where', () => {
      const raw = {};
      mount.querySelectorAll('[data-sync-field]').forEach((input) => { raw[input.dataset.syncField] = input.value.trim(); });
      // A mistyped field is refused by name, never swapped for the default
      // location (a Save there would overwrite the default profile).
      const problems = syncConfigProblems(raw);
      if (problems.length) { status(`Not saved: check ${problems.join(', ')}. Profiles live under settings-profiles/ on a branch other than dev, test, release or main.`); return; }
      const next = syncConfig(raw);
      if (!write(SYNC_STORAGE.config, JSON.stringify(next))) { status(STORAGE_REFUSED); return; }
      cfg = next;
      generation += 1;
      pending = null;
      write(SYNC_STORAGE.lastSha, null);
      write(SYNC_STORAGE.lastAt, null);
      profiles = null;
      listNote = '';
      draw();
      refreshProfiles();
      status('Profile location saved on this device.');
    });
  }

  draw();
  // A warning a previous panel could not show before Settings repainted.
  if (carriedStatus) { status(carriedStatus); carriedStatus = ''; }
  // Listed once on open, without holding the panel up.
  refreshProfiles();
}
