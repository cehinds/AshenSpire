// Named settings profiles and per-device keys (docs/SETTINGS-REVAMP.md §4 items 3 and 6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRows } from '../src/ui/screens/settings.js';
import {
  syncConfig, SYNC_DEFAULTS, SYNC_STORAGE, DEVICE_KEYS, DEFAULT_PROFILE, profileKeys, profileText, profileChanges, profileDiff,
  listProfiles, profilesListUrl, profileName, profilePath, validProfileName, normalizeProfileName, contentsUrl,
} from '../src/model/settingsSync.js';
import { contentBundle } from '../src/content/index.js';

const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const LIST_URL = 'https://api.github.com/repos/cehinds/AshenSpire/contents/settings-profiles?ref=settings-profiles';

test('the profile folder is listed as sorted names of its .json files', async () => {
  const seen = [];
  const fetch = async (url, init = {}) => {
    seen.push([url, init.headers?.Authorization || 'anonymous']);
    return reply(200, [
      { name: 'phone.json', type: 'file' },
      { name: 'default.json', type: 'file' },
      { name: 'README.md', type: 'file' },
      { name: 'old', type: 'dir' },
      { name: 'balance-a.json', type: 'file' },
      { name: 'bad name.json', type: 'file' },
    ]);
  };
  assert.deepEqual(await listProfiles(syncConfig({}), { fetch }), ['balance-a', 'default', 'phone']);
  assert.deepEqual(seen, [[LIST_URL, 'anonymous']]);
  assert.equal(profilesListUrl(syncConfig({ branch: 'prefs/me' })), 'https://api.github.com/repos/cehinds/AshenSpire/contents/settings-profiles?ref=prefs%2Fme');
});

test('a missing folder or branch lists as no profiles', async () => {
  assert.deepEqual(await listProfiles(syncConfig({}), { fetch: async () => reply(404, { message: 'Not Found' }) }), []);
  await assert.rejects(listProfiles(syncConfig({}), { fetch: async () => reply(500, { message: 'Boom' }) }), /Listing the profiles failed \(500: Boom\)/);
  await assert.rejects(listProfiles(syncConfig({}), { fetch: async () => reply(200, { content: 'x' }) }), /not a folder/);
});

test('a refused token does not stop the public list, exactly like a load', async () => {
  const seen = [];
  const fetch = async (url, init = {}) => {
    seen.push(init.headers?.Authorization || 'anonymous');
    if (init.headers?.Authorization) return reply(401, { message: 'Bad credentials' });
    return reply(200, [{ name: 'desk.json', type: 'file' }]);
  };
  assert.deepEqual(await listProfiles(syncConfig({}), { token: 'bad', fetch }), ['desk']);
  assert.deepEqual(seen, ['Bearer bad', 'anonymous']);
  // Without a token a 401 is not retried: it is reported.
  const refuse = async () => reply(401, { message: 'Bad credentials' });
  await assert.rejects(listProfiles(syncConfig({}), { fetch: refuse }), /401/);
});

test('profile names are one safe segment', () => {
  for (const name of ['default', 'desk', 'phone', 'balance-a', 'v1.2_test', 'x'.repeat(40)]) assert.ok(validProfileName(name), name);
  for (const name of ['', 'x'.repeat(41), 'a/b', '..', 'a..b', 'with space', 'ü', '../evil', null, undefined, 3]) assert.equal(validProfileName(name), false, String(name));
  assert.equal(normalizeProfileName('  phone.json '), 'phone');
  assert.equal(normalizeProfileName('../x'), null);
});

test('a profile name builds its path, and a path gives back its name', () => {
  assert.equal(DEFAULT_PROFILE, 'default');
  assert.equal(profilePath('desk'), 'settings-profiles/desk.json');
  assert.throws(() => profilePath('a/b'), /not a profile name/);
  assert.throws(() => profilePath('..'), /not a profile name/);
  assert.equal(profileName(syncConfig({})), 'default');
  const cfg = syncConfig({ ...SYNC_DEFAULTS, path: profilePath('balance-a') });
  assert.equal(cfg.path, 'settings-profiles/balance-a.json', 'the settings-profiles/ rule accepts a named profile');
  assert.equal(profileName(cfg), 'balance-a');
  assert.equal(contentsUrl(cfg), 'https://api.github.com/repos/cehinds/AshenSpire/contents/settings-profiles/balance-a.json');
});

test('every per-device key is a real settings row', () => {
  const keys = new Set(settingsRows().map((row) => row.key));
  for (const key of DEVICE_KEYS) assert.ok(keys.has(key), key);
  assert.equal(SYNC_STORAGE.includeDevice, 'ashenspire.sync.includeDevice');
});

// A value for each device key that differs from its default and passes the import door.
function deviceValues(rows) {
  const out = {};
  for (const key of DEVICE_KEYS) {
    const row = rows.find((r) => r.key === key);
    if (row.type === 'choice') out[key] = row.choices.find((choice) => choice !== row.def);
  }
  return out;
}

test('device keys stay out of a profile and are left alone on load by default', () => {
  const rows = settingsRows();
  const keys = profileKeys(rows);
  for (const key of DEVICE_KEYS) assert.ok(!keys.includes(key), `${key} is not saved by default`);
  assert.ok(keys.includes('screenShake'));
  const device = deviceValues(rows);
  assert.ok(Object.keys(device).length >= 4, 'the choice-type device keys have test values');

  // Saving: a device's screen settings are not written.
  const text = profileText({ screenShake: false, ...device }, keys, { contentVersion: contentBundle.version });
  const overrides = JSON.parse(text).overrides;
  for (const key of DEVICE_KEYS) assert.ok(!(`settings.${key}` in overrides), `${key} not in the file`);

  // Loading: not cleared although the file does not name them.
  const here = { musicVolume: 40, ...device };
  const parsed = profileChanges(text, contentBundle, here, rows, keys);
  assert.deepEqual(parsed.cleared, ['musicVolume']);
  assert.deepEqual(profileDiff(here, parsed).map((d) => d.key).sort(), ['musicVolume', 'screenShake']);

  // Loading a file that DOES carry them (saved elsewhere with the opt-in) does not apply them.
  const withDevice = profileText({ screenShake: false, ...device }, profileKeys(rows, { includeDevice: true }));
  assert.ok(Object.keys(JSON.parse(withDevice).overrides).some((k) => k === `settings.${Object.keys(device)[0]}`));
  const fromOther = profileChanges(withDevice, contentBundle, {}, rows, keys);
  for (const key of DEVICE_KEYS) assert.ok(!(key in fromOther.changes), `${key} not applied`);
  assert.equal(fromOther.changes.screenShake, false);
});

test('opted in, device keys are saved, loaded and cleared like any other key', () => {
  const rows = settingsRows();
  const keys = profileKeys(rows, { includeDevice: true });
  const choiceKeys = DEVICE_KEYS.filter((key) => rows.find((r) => r.key === key).type === 'choice');
  for (const key of choiceKeys) assert.ok(keys.includes(key), `${key} is saved when opted in`);
  assert.ok(!keys.includes('fullscreen'), 'fullscreen is an action row, never a stored profile value');
  const device = deviceValues(rows);
  const text = profileText({ screenShake: false, ...device }, keys);
  const parsed = profileChanges(text, contentBundle, {}, rows, keys);
  for (const [key, value] of Object.entries(device)) assert.equal(parsed.changes[key], value, key);
  const [one] = Object.keys(device);
  const cleared = profileChanges(profileText({ screenShake: false }, keys), contentBundle, { [one]: device[one] }, rows, keys).cleared;
  assert.deepEqual(cleared, [one], 'a device key the file omits goes back to default when opted in');
});

test('profileKeys still takes a control-type Set as its second argument', () => {
  const rows = settingsRows();
  const all = profileKeys(rows, new Set());
  assert.ok(all.includes('fullscreen') === false, 'device keys stay out by default either way');
  assert.ok(all.length >= profileKeys(rows).length);
});

test('the profile picker and device switch are never wired as settings', async () => {
  const { readFileSync } = await import('node:fs');
  const panel = readFileSync(new URL('../src/ui/components/settingsSync.js', import.meta.url), 'utf8');
  for (const hook of ['data-sync-profile', 'data-sync-name', 'data-sync="device"', 'data-sync="list"']) {
    assert.ok(panel.includes(hook), hook);
    const tag = panel.slice(panel.lastIndexOf('<', panel.indexOf(hook)), panel.indexOf('>', panel.indexOf(hook)));
    assert.ok(!tag.includes('data-key'), `${hook} carries no setting key`);
  }
  // Switching profile retires any load in flight, like changing the location.
  const start = panel.indexOf('const useProfile = ');
  const body = panel.slice(start, panel.indexOf('};', start));
  for (const step of ['generation += 1;', 'pending = null;', 'write(SYNC_STORAGE.config', 'write(SYNC_STORAGE.lastSha, null);', 'draw();']) assert.ok(body.includes(step), step);
});
