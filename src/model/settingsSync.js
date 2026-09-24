// src/model/settingsSync.js — YOUR DEFAULTS, KEPT ON GITHUB.
//
// Owner, 2026-09-24: "I should also have an option to set default
// configurations and send them to git hub so that I don't have to keep
// resetting those options between devices."
//
// THE FILE IS THE EXPORT FILE. A profile is exactly what Settings → Export
// configuration writes (`advancedConfigExport`) and is read back through the
// same all-or-nothing door (`parseAdvancedConfigFile`), so a profile can never
// hold a value an import would refuse, and a downloaded export can be
// committed by hand as a profile.
//
// WHERE IT LIVES. `settings-profiles/default.json` on its own branch,
// `settings-profiles`, created from `dev` on the first save. No workflow runs
// on that branch (pages-builds, tests and CI watch dev/test/release/main), so
// a save costs no Actions minutes and cannot turn a build red. The repository
// is public, so LOADING needs no token; SAVING needs a fine-grained token with
// Contents: read and write, kept on the device that saves and nowhere else —
// never in the profile, never in a save file, never in an export.
//
// Everything here is plain functions over (config, token, fetch). The screen
// owns the buttons; tests own a fake fetch.

import { advancedConfigExport, parseAdvancedConfigFile, ADVANCED_CONFIG_PREFIX } from './advancedConfig.js';

export const SYNC_DEFAULTS = Object.freeze({
  owner: 'cehinds',
  repo: 'AshenSpire',
  branch: 'settings-profiles',
  base: 'dev',
  path: 'settings-profiles/default.json',
});

export const SYNC_STORAGE = Object.freeze({
  config: 'ashenspire.sync.config',
  token: 'ashenspire.sync.token',
  auto: 'ashenspire.sync.auto',
  lastSha: 'ashenspire.sync.lastSha',
  lastAt: 'ashenspire.sync.lastAt',
});

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const SAFE_BRANCH = /^[A-Za-z0-9._/-]+$/;
const SAFE_PATH = /^settings-profiles\/[A-Za-z0-9._/-]+\.json$/;
// A profile never lands on a branch that builds or ships.
const PROTECTED_BRANCHES = new Set(['dev', 'test', 'release', 'main']);

/** syncConfig(raw) → a complete, validated config; bad fields fall back. */
export function syncConfig(raw = {}) {
  const pick = (key, test) => (typeof raw?.[key] === 'string' && test.test(raw[key]) && !raw[key].includes('..') ? raw[key] : SYNC_DEFAULTS[key]);
  return {
    owner: pick('owner', SAFE_SEGMENT),
    repo: pick('repo', SAFE_SEGMENT),
    branch: PROTECTED_BRANCHES.has(raw?.branch) ? SYNC_DEFAULTS.branch : pick('branch', SAFE_BRANCH),
    base: pick('base', SAFE_BRANCH),
    path: pick('path', SAFE_PATH),
  };
}

const api = (cfg) => `https://api.github.com/repos/${cfg.owner}/${cfg.repo}`;
const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

/** contentsUrl(cfg) → the GitHub contents API address of the profile. */
export function contentsUrl(cfg) {
  return `${api(cfg)}/contents/${encodePath(cfg.path)}`;
}

/** profileWebUrl(cfg) → the profile on github.com, for a person to open. */
export function profileWebUrl(cfg) {
  return `https://github.com/${cfg.owner}/${cfg.repo}/blob/${cfg.branch.split('/').map(encodeURIComponent).join('/')}/${encodePath(cfg.path)}`;
}

/** exportKeys(rows, controlTypes) → the non-`gameConfig.` keys a profile carries. */
export function profileKeys(rows, controlTypes = new Set(['button', 'action', 'sceneList'])) {
  return rows.filter((row) => !row.retired && !controlTypes.has(row.type) && !String(row.key).startsWith(ADVANCED_CONFIG_PREFIX)).map((row) => row.key);
}

/** profileText(settings, keys, build) → the JSON a profile file holds. */
export function profileText(settings, keys, build = {}) {
  return advancedConfigExport(settings, { ...build, profile: true }, keys);
}

/**
 * profileChanges(text, bundle, settings, rows, keys) → { changes, cleared, warnings }
 *
 * `changes` is what the profile sets. `cleared` is every key this device has
 * set that the profile does not mention — a profile is the WHOLE picture, so
 * loading it returns those to their defaults. Throws, changing nothing, on a
 * file the import door refuses.
 */
export function profileChanges(text, bundle, settings, rows, keys) {
  const warnings = [];
  const changes = parseAdvancedConfigFile(text, bundle, {}, rows, warnings);
  const owned = new Set(keys);
  const cleared = Object.keys(settings || {}).filter((key) => settings[key] !== undefined
    && !(key in changes) && (key.startsWith(ADVANCED_CONFIG_PREFIX) || owned.has(key)));
  return { changes, cleared, warnings };
}

/** profileDiff(settings, { changes, cleared }) → [{ key, from, to }] that would actually move. */
export function profileDiff(settings, { changes, cleared }) {
  const out = [];
  for (const [key, to] of Object.entries(changes)) {
    if (settings?.[key] !== to) out.push({ key, from: settings?.[key], to });
  }
  for (const key of cleared) out.push({ key, from: settings[key], to: undefined });
  return out;
}

// ---- base64 of UTF-8, both ways, without Buffer (browser) or btoa (old Node) -
export function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return globalThis.btoa(binary);
}
export function fromBase64(b64) {
  const binary = globalThis.atob(String(b64).replace(/\s+/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function headers(token, extra = {}) {
  const out = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...extra };
  if (token) out.Authorization = `Bearer ${token}`;
  return out;
}

async function failure(res, what) {
  let detail = '';
  try { detail = (await res.json())?.message || ''; } catch { /* body was not JSON */ }
  const hint = res.status === 401 ? ' The token was refused — check it or make a new one.'
    : res.status === 403 ? ' The token cannot write here, or GitHub is rate-limiting — it needs Contents: read and write on this repository.'
      : res.status === 404 ? ' Not found — check the owner, repository, branch and path.' : '';
  return new Error(`${what} failed (${res.status}${detail ? `: ${detail}` : ''}).${hint}`);
}

/**
 * fetchProfile(cfg, { token, fetch }) → { text, sha } or null when the profile
 * (or its branch) does not exist yet.
 */
export async function fetchProfile(cfg, { token = '', fetch = globalThis.fetch } = {}) {
  const res = await fetch(`${contentsUrl(cfg)}?ref=${encodeURIComponent(cfg.branch)}`, { headers: headers(token), cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw await failure(res, 'Loading the profile');
  const body = await res.json();
  if (typeof body?.content !== 'string') throw new Error('GitHub answered with something that is not a file.');
  return { text: fromBase64(body.content), sha: body.sha };
}

async function ensureBranch(cfg, token, fetch) {
  const ref = (branch) => `${api(cfg)}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`;
  const have = await fetch(ref(cfg.branch), { headers: headers(token) });
  if (have.ok) return false;
  if (have.status !== 404) throw await failure(have, 'Checking the branch');
  const base = await fetch(ref(cfg.base), { headers: headers(token) });
  if (!base.ok) throw await failure(base, `Reading ${cfg.base} to start the branch`);
  const sha = (await base.json())?.object?.sha;
  const made = await fetch(`${api(cfg)}/git/refs`, {
    method: 'POST', headers: headers(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ref: `refs/heads/${cfg.branch}`, sha }),
  });
  if (!made.ok) throw await failure(made, 'Creating the branch');
  return true;
}

/**
 * pushProfile(cfg, text, { token, fetch, message }) → { sha, created, branchCreated }
 * Creates the branch (from `cfg.base`) and the file when missing; otherwise
 * replaces the file in one commit. Needs a token.
 */
export async function pushProfile(cfg, text, { token, fetch = globalThis.fetch, message = 'Update settings profile' } = {}) {
  if (!token) throw new Error('Saving to GitHub needs a token on this device.');
  const branchCreated = await ensureBranch(cfg, token, fetch);
  const existing = await fetchProfile(cfg, { token, fetch });
  if (existing && existing.text === text) return { sha: existing.sha, created: false, branchCreated, unchanged: true };
  const res = await fetch(contentsUrl(cfg), {
    method: 'PUT', headers: headers(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message, content: toBase64(text), branch: cfg.branch, ...(existing ? { sha: existing.sha } : {}) }),
  });
  if (!res.ok) throw await failure(res, 'Saving the profile');
  const body = await res.json();
  return { sha: body?.content?.sha, created: !existing, branchCreated, unchanged: false };
}
