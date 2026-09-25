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
// WHERE IT LIVES. `settings-profiles/<name>.json` (`default` unless this
// device picked another named profile) on its own branch,
// `settings-profiles`, created from `dev` on the first save. No workflow runs
// on that branch (pages-builds, tests and CI watch dev/test/release/main), so
// a save costs no Actions minutes and cannot turn a build red. The repository
// is public, so LOADING needs no token; SAVING needs a fine-grained token with
// Contents: read and write, kept on the device that saves and nowhere else —
// never in the profile, never in a save file, never in an export.
//
// Everything here is plain functions over (config, token, fetch). The screen
// owns the buttons; tests own a fake fetch.

import { SEED_KEY } from './settingsDefaults.js';
import { advancedConfigExport, advancedConfigProblems, parseAdvancedConfigFile, ADVANCED_CONFIG_PREFIX } from './advancedConfig.js';

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
  includeDevice: 'ashenspire.sync.includeDevice',
});

// NAMED PROFILES. Each profile is `settings-profiles/<name>.json` on the sync
// branch (desk, phone, balance-a…); `default` is the one a new device uses.
export const PROFILE_DIR = 'settings-profiles';
export const DEFAULT_PROFILE = 'default';
const PROFILE_NAME = /^[A-Za-z0-9._-]{1,40}$/;

/** validProfileName(name) → true for a bare name that is safe as one path segment. */
export function validProfileName(name) {
  // No leading or trailing dot: `desk.` would make `desk..json`, which
  // syncConfig refuses and silently swaps for the default profile's path.
  return typeof name === 'string' && PROFILE_NAME.test(name) && !name.includes('..') && !name.startsWith('.') && !name.endsWith('.');
}

/** normalizeProfileName(text) → the typed name without spaces or a trailing `.json`, or null when unsafe. */
export function normalizeProfileName(text) {
  const name = String(text ?? '').trim().replace(/\.json$/i, '');
  return validProfileName(name) ? name : null;
}

/** profilePath(name) → `settings-profiles/<name>.json`; throws on an unsafe name. */
export function profilePath(name) {
  if (!validProfileName(name)) throw new Error(`“${name}” is not a profile name — use 1–40 letters, digits, dot, dash or underscore.`);
  return `${PROFILE_DIR}/${name}.json`;
}

/** profileName(cfg) → the name of the profile `cfg.path` points at (`default` for the stock path). */
export function profileName(cfg) {
  const path = String(cfg?.path || SYNC_DEFAULTS.path);
  return path.slice(PROFILE_DIR.length + 1).replace(/\.json$/, '');
}

// PER-DEVICE KEYS. These describe the screen and the hands holding it, not the
// player: a profile saved on a desktop must not shrink a phone's text. They are
// left out of a profile, and a profile that carries them does not move them,
// unless this device opts in (SYNC_STORAGE.includeDevice).
export const DEVICE_KEYS = Object.freeze(['uiScale', 'textSize', 'tapFloor', 'fullscreen', 'quickNav', 'armamentsPhonePlacement']);
const DEVICE_KEY_SET = new Set(DEVICE_KEYS);

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const SAFE_BRANCH = /^[A-Za-z0-9._/-]+$/;
const SAFE_PATH = /^settings-profiles\/[A-Za-z0-9._/-]+\.json$/;
// A profile never lands on a branch that builds or ships.
const PROTECTED_BRANCHES = new Set(['dev', 'test', 'release', 'main']);

/**
 * validBranchName(name) → true when git would accept `name` as a branch
 * (`git check-ref-format --branch`): no empty, `.`-led or `.lock`-ending
 * component, no leading, trailing or doubled `/`, no trailing `.`, no `..` or
 * `@{`, not `@` or `HEAD`, not `-`-led, and no space, control character or any of
 * ~ ^ : ? * [ \. SAFE_BRANCH alone let `foo/`, `/foo`, `.foo` and `foo.lock`
 * through, and every request to GitHub then failed on them.
 */
export function validBranchName(name) {
  if (typeof name !== 'string' || !name || name === '@' || name === 'HEAD' || name.startsWith('-')) return false;
  if (/[\x00-\x20\x7f~^:?*[\\]/.test(name) || name.includes('..') || name.includes('@{')) return false;
  if (name.startsWith('/') || name.endsWith('/') || name.endsWith('.')) return false;
  return name.split('/').every((part) => part && !part.startsWith('.') && !part.endsWith('.lock'));
}

/** syncConfig(raw) → a complete, validated config; bad fields fall back. */
export function syncConfig(raw = {}) {
  const pick = (key, test, valid = () => true) => (typeof raw?.[key] === 'string' && test.test(raw[key]) && !raw[key].includes('..') && valid(raw[key]) ? raw[key] : SYNC_DEFAULTS[key]);
  return {
    owner: pick('owner', SAFE_SEGMENT),
    repo: pick('repo', SAFE_SEGMENT),
    branch: PROTECTED_BRANCHES.has(raw?.branch) ? SYNC_DEFAULTS.branch : pick('branch', SAFE_BRANCH, validBranchName),
    base: pick('base', SAFE_BRANCH, validBranchName),
    path: pick('path', SAFE_PATH),
  };
}

/**
 * syncConfigProblems(raw) → the fields syncConfig would replace with a default,
 * by name ([] when every field stands). A typed location is refused rather
 * than quietly swapped for the default profile, which a Save would overwrite.
 * An empty field is not a problem: it asks for the default.
 */
export function syncConfigProblems(raw = {}) {
  const cfg = syncConfig(raw);
  return Object.keys(cfg).filter((key) => typeof raw?.[key] === 'string' && raw[key] !== '' && raw[key] !== cfg[key]);
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

const CONTROL_TYPES = new Set(['button', 'action', 'sceneList']);

/**
 * profileKeys(rows, { includeDevice, controlTypes }) → the non-`gameConfig.`
 * keys a profile carries. DEVICE_KEYS are left out unless `includeDevice`.
 * (A Set as the second argument is still read as `controlTypes`.)
 */
export function profileKeys(rows, options = {}) {
  const { includeDevice = false, controlTypes = CONTROL_TYPES } = options instanceof Set ? { controlTypes: options } : (options || {});
  return rows.filter((row) => !row.retired && !controlTypes.has(row.type) && !String(row.key).startsWith(ADVANCED_CONFIG_PREFIX)
    && (includeDevice || !DEVICE_KEY_SET.has(row.key))).map((row) => row.key);
}

/** profileText(settings, keys, build) → the JSON a profile file holds. */
export function profileText(settings, keys, build = {}) {
  const text = advancedConfigExport(settings, { ...build, profile: true }, keys);
  // Which of these values are the owner's promoted defaults rather than the
  // player's own choice: a device loading the profile takes that over too, so
  // a later promotion moves exactly what it would have moved here.
  const record = settings?.[SEED_KEY] && typeof settings[SEED_KEY] === 'object' ? settings[SEED_KEY] : {};
  const file = JSON.parse(text);
  // Every key the file carries: the profile's own rows and the gameConfig.*
  // overrides advancedConfigExport always writes.
  const exported = new Set([...keys, ...Object.keys(settings || {}).filter((key) => key.startsWith(ADVANCED_CONFIG_PREFIX))]);
  const promotionOwned = [...exported].filter((key) => settings?.[key] !== undefined && Object.hasOwn(record, key) && record[key] === settings[key]).sort();
  return JSON.stringify({ ...file, promotionOwned }, null, 2) + '\n';
}

/**
 * promotionProblem(bundle, settings, changed) → the first rule the settings
 * would break once `changed` is written (undefined = cleared), or null.
 *
 * A profile's values were checked as a set when it was read. Putting this
 * build's promoted value in place of a promotion-owned one can split a pair
 * the file kept whole — a promoted energy minimum of 10 against the player's
 * own maximum of 6 — so the load is checked again with the values it will
 * really write, and refused whole rather than saved broken. (Keeping the
 * file's value for that key instead would quietly give the promotion's key an
 * old value it then owns, and the next start's seeding would split the pair
 * anyway.)
 */
export function promotionProblem(bundle, settings, changed) {
  const effective = { ...(settings || {}) };
  for (const [key, value] of Object.entries(changed || {})) {
    if (value === undefined) delete effective[key]; else effective[key] = value;
  }
  return advancedConfigProblems(bundle, effective)[0] || null;
}

/**
 * importOwnership(text, changes, settings) → { [SEED_KEY]: record } to save
 * with a file imported by hand, or {} when ownership is left to the save path.
 *
 * A profile downloaded from the sync panel can be loaded with Load settings
 * too, and it says which of its values are promoted defaults
 * (`promotionOwned`). The import takes that over for every key it sets, as a
 * sync load does: a listed key is the promotion's at the file's value (so
 * seeding moves it on, or back to its code default), any other key it sets is
 * the player's. A file without the field (an ordinary export, or a profile
 * from before it) changes nothing here: the save path's pruning applies.
 * An import only merges, so keys the file leaves out keep their ownership.
 */
export function importOwnership(text, changes, settings, promoted = {}) {
  let listed = null;
  try { listed = JSON.parse(text)?.promotionOwned; } catch { return {}; }
  if (!Array.isArray(listed)) return {};
  const owned = new Set(listed.filter((key) => typeof key === 'string'));
  const record = settings?.[SEED_KEY] && typeof settings[SEED_KEY] === 'object' ? settings[SEED_KEY] : {};
  const next = { ...record };
  const values = {};
  for (const key of Object.keys(changes || {})) {
    if (!owned.has(key)) { delete next[key]; continue; }
    // The promotion's value is THIS build's: one saved under an older
    // promotion lands at the current one, or at the code default if this build
    // no longer promotes the key — what seeding would do at the next start.
    const to = promotedValue(key, promoted);
    if (changes[key] !== to) values[key] = to;
    if (to === undefined) delete next[key]; else next[key] = to;
  }
  const same = JSON.stringify(Object.entries(next).sort()) === JSON.stringify(Object.entries(record).sort());
  return same ? values : { ...values, [SEED_KEY]: next };
}

/**
 * profileChanges(text, bundle, settings, rows, keys) → { changes, cleared, warnings }
 *
 * `changes` is what the profile sets. `cleared` is every key this device has
 * set that the profile does not mention — a profile is the WHOLE picture, so
 * loading it returns those to their defaults. Throws, changing nothing, on a
 * file the import door refuses. A per-device key (DEVICE_KEYS) that `keys`
 * does not own is neither applied from the file nor cleared.
 */
export function profileChanges(text, bundle, settings, rows, keys) {
  const warnings = [];
  const changes = parseAdvancedConfigFile(text, bundle, {}, rows, warnings);
  const owned = new Set(keys);
  for (const key of DEVICE_KEYS) if (!owned.has(key)) delete changes[key];
  const cleared = Object.keys(settings || {}).filter((key) => settings[key] !== undefined
    && !(key in changes) && (key.startsWith(ADVANCED_CONFIG_PREFIX) || owned.has(key)));
  // Absent in a profile saved before this field existed: then ownership is
  // left as it is (null), rather than guessed.
  let promotionOwned = null;
  try {
    const listed = JSON.parse(text).promotionOwned;
    if (Array.isArray(listed)) promotionOwned = listed.filter((key) => typeof key === 'string' && key in changes);
  } catch { /* parseAdvancedConfigFile already accepted the text */ }
  return { changes, cleared, warnings, promotionOwned };
}

/**
 * promotedValue(key, promoted) → what a promotion-owned key holds in this
 * build: its current promoted value, or undefined (the code default) when this
 * build no longer promotes it. A profile saved under an older promotion is
 * applied at the current one straight away, not only at the next start's
 * seeding (seedSettingsDefaults), which has already run by then.
 */
export function promotedValue(key, promoted = {}) {
  return Object.hasOwn(promoted, key) ? promoted[key] : undefined;
}

/**
 * profileDiff(settings, { changes, cleared, promotionOwned }, promoted) → [{ key, from, to }]
 * that would actually move. A key the profile leaves out goes back to the
 * owner's promoted default when there is one (what Reset and boot use), and is
 * cleared otherwise. A key the profile lists in `promotionOwned` takes this
 * build's promoted value, not the one it was saved with.
 */
export function profileDiff(settings, { changes, cleared, promotionOwned }, promoted = {}) {
  const out = [];
  const listed = new Set(Array.isArray(promotionOwned) ? promotionOwned : []);
  for (const [key, value] of Object.entries(changes)) {
    // A promotion-owned value lands at this build's promotion (see promotedValue).
    const to = listed.has(key) ? promotedValue(key, promoted) : value;
    if (settings?.[key] !== to) out.push({ key, from: settings?.[key], to });
  }
  for (const key of cleared) {
    const to = Object.hasOwn(promoted, key) ? promoted[key] : undefined;
    if (settings?.[key] !== to) out.push({ key, from: settings?.[key], to });
  }
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
  const url = `${contentsUrl(cfg)}?ref=${encodeURIComponent(cfg.branch)}`;
  let res = await fetch(url, { headers: headers(token), cache: 'no-store' });
  // A token is only needed to save. An expired or revoked one must not stop a
  // public profile from loading, so a refused read is retried without it.
  if (res.status === 401 && token) res = await fetch(url, { headers: headers(''), cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw await failure(res, 'Loading the profile');
  const body = await res.json();
  if (typeof body?.content !== 'string') throw new Error('GitHub answered with something that is not a file.');
  return { text: fromBase64(body.content), sha: body.sha };
}

/** profilesListUrl(cfg) → the contents API address of the profile folder on the sync branch. */
export function profilesListUrl(cfg) {
  return `${api(cfg)}/contents/${PROFILE_DIR}?ref=${encodeURIComponent(cfg.branch)}`;
}

/**
 * listProfiles(cfg, { token, fetch }) → sorted names of the `*.json` profiles
 * on the sync branch; [] when the folder (or the branch) does not exist yet.
 */
export async function listProfiles(cfg, { token = '', fetch = globalThis.fetch } = {}) {
  const url = profilesListUrl(cfg);
  let res = await fetch(url, { headers: headers(token), cache: 'no-store' });
  // Same as fetchProfile: a refused token must not hide a public list.
  if (res.status === 401 && token) res = await fetch(url, { headers: headers(''), cache: 'no-store' });
  if (res.status === 404) return [];
  if (!res.ok) throw await failure(res, 'Listing the profiles');
  const body = await res.json();
  if (!Array.isArray(body)) throw new Error('GitHub answered with something that is not a folder.');
  const names = body
    .filter((entry) => (entry?.type ?? 'file') === 'file' && typeof entry?.name === 'string' && entry.name.endsWith('.json'))
    .map((entry) => entry.name.slice(0, -'.json'.length))
    .filter(validProfileName);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
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
