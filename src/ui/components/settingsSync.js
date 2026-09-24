// src/ui/components/settingsSync.js — Settings → Advanced → Defaults & sync.
//
// The panel over src/model/settingsSync.js: save this device's settings as the
// profile on GitHub, load the profile here (with a preview of exactly what will
// change before anything does), and optionally load it every time the game
// starts on this device. Debug builds only — the section is filed under
// Advanced, which a release build does not show (src/ui/buildChannel.js).

import { contentBundle } from '../../content/index.js';
import { saveJsonFile } from '../../model/advancedConfig.js';
import {
  SYNC_STORAGE, syncConfig, profileKeys, profileText, profileChanges, profileDiff,
  fetchProfile, pushProfile, profileWebUrl,
} from '../../model/settingsSync.js';
import { esc } from './tooltip.js';

const DIFF_PREVIEW = 12;

function store() { try { return globalThis.localStorage || null; } catch { return null; } }
function read(key) { try { return store()?.getItem(key) ?? null; } catch { return null; } }
function write(key, value) {
  try { if (value === null || value === undefined || value === '') store()?.removeItem(key); else store()?.setItem(key, value); } catch { /* storage refused */ }
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

/**
 * applyProfile(settings, onChange, parsed) — write a parsed profile through the
 * one save path. Returns the number of settings that moved.
 */
export function applyProfile(settings, onChange, parsed) {
  const diff = profileDiff(settings, parsed);
  if (!diff.length) return 0;
  const changed = {};
  for (const { key, to } of diff) {
    changed[key] = to;
    if (to === undefined) delete settings[key]; else settings[key] = to;
  }
  const result = onChange(changed);
  if (result?.ok === false) throw new Error('Settings could not be saved on this device.');
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

export async function autoLoadProfile({ settings, onChange, rows, fetch = globalThis.fetch, stillWanted = () => true }) {
  if (!autoLoadEnabled()) return { applied: 0, reason: 'off' };
  const cfg = deviceSyncConfig();
  const remote = await fetchProfile(cfg, { token: read(SYNC_STORAGE.token) || '', fetch });
  if (!remote) return { applied: 0, reason: 'missing' };
  if (remote.sha && remote.sha === read(SYNC_STORAGE.lastSha)) return { applied: 0, reason: 'unchanged' };
  // Arrived after the game went on without it: change nothing mid-session and
  // leave the sha unrecorded, so the next start loads it.
  if (!stillWanted()) return { applied: 0, reason: 'late' };
  const parsed = profileChanges(remote.text, contentBundle, settings, rows, profileKeys(rows));
  const applied = applyProfile(settings, onChange, parsed);
  write(SYNC_STORAGE.lastSha, remote.sha || '');
  write(SYNC_STORAGE.lastAt, new Date().toISOString());
  return { applied, reason: 'loaded' };
}

export function renderSettingsSync(mount, { settings, onChange, rows, afterApply = () => {} }) {
  const keys = profileKeys(rows);
  const labelOf = new Map(rows.map((row) => [row.key, String(row.label || row.key).replace(/<[^>]*>/g, '')]));
  let cfg = deviceSyncConfig();
  let pending = null;
  // Each load and each location change takes a new generation; a load that
  // finishes under an older one is dropped, never shown under the new place.
  let generation = 0;

  const draw = () => {
    const token = read(SYNC_STORAGE.token);
    const auto = read(SYNC_STORAGE.auto) === '1';
    const lastAt = read(SYNC_STORAGE.lastAt);
    mount.innerHTML = `<div class="set-sync">
      <p class="set-note">Your defaults are one file on GitHub. Save them from any device, and every other device can load them —
        on request, or each time the game starts. Loading replaces this device's settings with the file's; a preview shows what will change first.</p>
      <div class="set-card-list">
        <div class="as-row setting set-row set-row-wide">
          <span class="as-labelstack"><span class="ls-label">Profile</span>
            <span class="ls-hint set-note"><a href="${esc(profileWebUrl(cfg))}" target="_blank" rel="noopener">${esc(`${cfg.owner}/${cfg.repo} · ${cfg.branch} · ${cfg.path}`)}</a>${lastAt ? ` · last loaded here ${esc(new Date(lastAt).toLocaleString())}` : ''}</span></span>
          <span class="r-trail set-sync-acts">
            <button type="button" class="as-btn" data-sync="save"${token ? '' : ' disabled title="Add a token below to save"'}>Save my settings to GitHub</button>
            <button type="button" class="as-btn" data-sync="load">Load from GitHub…</button>
          </span>
        </div>
        <div class="set-sync-preview" data-sync-preview hidden></div>
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
      const parsed = profileChanges(remote.text, contentBundle, settings, rows, keys);
      const diff = profileDiff(settings, parsed);
      pending = { parsed, sha: remote.sha };
      // Already matching IS loaded: record this version, or the next start
      // would treat it as new and overwrite edits made here since.
      if (!diff.length) {
        write(SYNC_STORAGE.lastSha, remote.sha || '');
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
          const moved = applyProfile(settings, onChange, pending.parsed);
          write(SYNC_STORAGE.lastSha, pending.sha || '');
          write(SYNC_STORAGE.lastAt, new Date().toISOString());
          pending = null;
          afterApply(moved);
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
      busy(btn, true, 'Saving…');
      try {
        const text = profileText(settings, keys, { contentVersion: contentBundle.version });
        // Never upload a file another device's import would refuse.
        profileChanges(text, contentBundle, {}, rows, keys);
        const result = await pushProfile(cfg, text, { token: read(SYNC_STORAGE.token), message: `Update settings profile (${Object.keys(JSON.parse(text).overrides).length} settings)` });
        write(SYNC_STORAGE.lastSha, result.sha || '');
        status(result.unchanged ? 'The profile on GitHub already matches this device.'
          : `Saved${result.branchCreated ? ` — created the ${cfg.branch} branch` : ''}. Other devices can load it now.`);
      } catch (error) { status(error.message); } finally { busy(btn, false, 'Save my settings to GitHub'); }
    });
    on('auto', (btn) => {
      const next = read(SYNC_STORAGE.auto) !== '1';
      write(SYNC_STORAGE.auto, next ? '1' : null);
      btn.classList.toggle('on', next);
      btn.setAttribute('aria-checked', String(next));
    });
    on('token', () => {
      const value = mount.querySelector('[data-sync-token]').value.trim();
      if (!value) { status('Paste a token first.'); return; }
      write(SYNC_STORAGE.token, value);
      draw();
      status('Token stored on this device.');
    });
    on('forget', () => { write(SYNC_STORAGE.token, null); draw(); status('Token removed from this device.'); });
    on('copy', async (btn) => {
      const text = profileText(settings, keys, { contentVersion: contentBundle.version });
      try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; } catch { console.log(text); btn.textContent = 'In console'; }
      setTimeout(() => { if (btn.isConnected) btn.textContent = 'Copy JSON'; }, 1800);
    });
    on('download', () => saveJsonFile(profileText(settings, keys, { contentVersion: contentBundle.version }), {
      filename: 'ashen-spire-settings-profile.json', description: 'Ashen Spire settings profile',
    }));
    on('where', () => {
      const raw = {};
      mount.querySelectorAll('[data-sync-field]').forEach((input) => { raw[input.dataset.syncField] = input.value.trim(); });
      cfg = syncConfig(raw);
      generation += 1;
      pending = null;
      write(SYNC_STORAGE.config, JSON.stringify(cfg));
      write(SYNC_STORAGE.lastSha, null);
      draw();
      status('Profile location saved on this device.');
    });
  }

  draw();
}
