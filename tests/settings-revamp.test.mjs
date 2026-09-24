import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChannel, debugEnabled, DEBUG_STORAGE_KEY } from '../src/ui/buildChannel.js';
import {
  visibleAdvancedGroups, RELEASE_ADVANCED_GROUP_IDS, ADVANCED_GROUP_IDS, settingsSearchHits,
  settingsRowHtml, settingsRow, sliderSpan, niceCeil, buttonStep, rowModified, settingsRows,
} from '../src/ui/screens/settings.js';
import {
  syncConfig, SYNC_DEFAULTS, profileKeys, profileText, profileChanges, profileDiff,
  fetchProfile, pushProfile, toBase64, fromBase64, contentsUrl,
} from '../src/model/settingsSync.js';
import { contentBundle } from '../src/content/index.js';

const at = (href) => { const u = new URL(href); return { pathname: u.pathname, hostname: u.hostname, protocol: u.protocol }; };

test('the channel is read from where the page was served or saved', () => {
  assert.equal(buildChannel(at('https://cehinds.github.io/AshenSpire/dev/449/'), 'standalone file'), 'dev');
  assert.equal(buildChannel(at('https://cehinds.github.io/AshenSpire/test/latest/mobile/'), 'standalone file'), 'test');
  assert.equal(buildChannel(at('https://cehinds.github.io/AshenSpire/main/12/'), 'standalone file'), 'main');
  assert.equal(buildChannel(at('https://cehinds.github.io/AshenSpire/release/3'), 'standalone file'), 'release');
  assert.equal(buildChannel(at('https://cehinds.github.io/AshenSpire/AshenSpire.html'), 'standalone file'), 'main', 'the site root is main’s tree');
  assert.equal(buildChannel(at('file:///sdcard/Download/AshenSpire-dev-0.7.1.449.html'), 'standalone file'), 'dev');
  assert.equal(buildChannel(at('file:///sdcard/Download/AshenSpire-mobile-test-0.7.1.2.html'), 'standalone file'), 'test');
  assert.equal(buildChannel(at('file:///C:/games/AshenSpire-main-0.7.1.9.html'), 'standalone file'), 'main');
  assert.equal(buildChannel(at('file:///home/me/AshenSpire.html'), 'standalone file'), 'unknown');
  assert.equal(buildChannel(at('http://localhost:8080/index.html'), 'UNPLACED'), 'dev');
  assert.equal(buildChannel(at('https://example.com/whatever.html'), 'source tree'), 'dev', 'the dev server is dev wherever it is');
  assert.equal(buildChannel(null), 'dev', 'no page (Node) is a developer’s seat');
});

test('debug opens on dev and test, never on main or release, and on unknown only when asked', () => {
  const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
  assert.equal(debugEnabled('dev', { search: '', storage: memory() }), true);
  assert.equal(debugEnabled('test', { search: '', storage: memory() }), true);
  assert.equal(debugEnabled('main', { search: '?debug=1', storage: memory() }), false, 'main ignores the flag');
  assert.equal(debugEnabled('release', { search: '?debug=1', storage: memory() }), false);
  const store = memory();
  assert.equal(debugEnabled('unknown', { search: '', storage: store }), false);
  assert.equal(debugEnabled('unknown', { search: '?debug=1', storage: store }), true);
  assert.equal(store.getItem(DEBUG_STORAGE_KEY), '1', 'remembered on the device');
  assert.equal(debugEnabled('unknown', { search: '', storage: store }), true);
  assert.equal(debugEnabled('unknown', { search: '?debug=0', storage: store }), false, '?debug=0 forgets it');
});

test('a release build shows only the player-facing Advanced sections, and search follows', () => {
  assert.deepEqual(visibleAdvancedGroups(true).map((g) => g.id), [...ADVANCED_GROUP_IDS]);
  assert.deepEqual(visibleAdvancedGroups(false).map((g) => g.id), [...RELEASE_ADVANCED_GROUP_IDS]);
  assert.ok(ADVANCED_GROUP_IDS.includes('Sync'), 'Defaults & sync is a debug section');
  const debugHits = settingsSearchHits('poise', true);
  const releaseHits = settingsSearchHits('poise', false);
  assert.ok(debugHits.some(({ row }) => row.key.startsWith('gameConfig.')), 'debug search reaches tuning rows');
  assert.ok(!releaseHits.some(({ row }) => row.key.startsWith('gameConfig.')), 'release search never offers a hidden row');
  assert.ok(settingsSearchHits('music volume', false).some(({ row }) => row.key === 'musicVolume'), 'every word must match, in any field');
  assert.deepEqual(settingsSearchHits('   '), []);
});

test('every number is − slider field + with a Reset that shows only when changed', () => {
  const row = settingsRow('touchFlickDistance');
  const plain = settingsRowHtml({}, row);
  for (const part of ['data-step="-1"', 'class="set-num-slider"', 'class="set-num"', 'data-step="1"', 'data-reset-key="touchFlickDistance"']) {
    assert.ok(plain.includes(part), `number row carries ${part}`);
  }
  assert.match(plain, /data-reset-key="touchFlickDistance"[^>]*hidden/, 'Reset is hidden at the default');
  assert.ok(!plain.includes('data-modified'), 'no dot at the default');
  const changed = settingsRowHtml({ touchFlickDistance: row.def + 8 }, row);
  assert.ok(changed.includes('data-modified="true"'));
  assert.doesNotMatch(changed, /data-reset-key="touchFlickDistance"[^>]*hidden/);
  const volume = settingsRowHtml({ musicVolume: 30 }, settingsRow('musicVolume'));
  for (const part of ['class="set-range"', 'class="set-range-num"', 'data-step="-1"', 'data-step="1"', 'data-reset-key="musicVolume"']) {
    assert.ok(volume.includes(part), `volume row carries ${part}`);
  }
  const toggle = settingsRowHtml({ screenShake: false }, settingsRow('screenShake'));
  assert.ok(toggle.includes('data-reset-key="screenShake"') && toggle.includes('data-modified="true"'), 'toggles share the same Reset');
});

test('rowModified compares with the declared default, not with presence', () => {
  const row = settingsRow('screenShake');
  assert.equal(rowModified({}, row), false);
  assert.equal(rowModified({ screenShake: row.def }, row), false);
  assert.equal(rowModified({ screenShake: !row.def }, row), true);
});

test('sliders use a useful span and the buttons a useful step', () => {
  assert.deepEqual(sliderSpan({ min: 0, max: 100, step: 5, def: 50 }, 50), [0, 100]);
  assert.deepEqual(sliderSpan({ min: 0, max: 999, step: 0.01, def: 1 }, 1), [0, 5], 'a 0–999 multiplier gets a slider near its value');
  assert.deepEqual(sliderSpan({ min: 0, max: 999, step: 1, def: 3 }, 3), [0, 50]);
  assert.deepEqual(sliderSpan({ min: 0, max: 999, step: 1, def: 3, slider: true }, 3), [0, 999], 'an authored slider keeps its range');
  assert.equal(niceCeil(30), 50);
  assert.equal(niceCeil(0.3), 0.5);
  assert.equal(niceCeil(100), 100);
  assert.equal(buttonStep({ step: 1 }), 1);
  assert.equal(buttonStep({ step: 0.01, def: 1 }), 0.05);
  assert.equal(buttonStep({ step: 0.01, def: 5 }), 0.1);
  assert.equal(buttonStep({ step: 0.01, def: 40 }), 1);
});

test('a sync config falls back field by field and refuses path tricks', () => {
  assert.deepEqual(syncConfig({}), { ...SYNC_DEFAULTS });
  const cfg = syncConfig({ owner: 'me', repo: 'Game', branch: 'prefs/phone', path: 'x/../../evil.json' });
  assert.equal(cfg.owner, 'me');
  assert.equal(cfg.branch, 'prefs/phone');
  assert.equal(cfg.path, SYNC_DEFAULTS.path);
  assert.equal(syncConfig({ owner: 'a b' }).owner, SYNC_DEFAULTS.owner);
  assert.equal(syncConfig({ path: 'p.txt' }).path, SYNC_DEFAULTS.path, 'a profile is a .json file');
  for (const branch of ['dev', 'test', 'release', 'main']) assert.equal(syncConfig({ branch }).branch, SYNC_DEFAULTS.branch, `never ${branch}`);
  assert.equal(syncConfig({ path: 'package.json' }).path, SYNC_DEFAULTS.path, 'a profile lives under settings-profiles/');
  assert.equal(syncConfig({ path: 'settings-profiles/phone.json' }).path, 'settings-profiles/phone.json');
});

test('a profile round-trips through the import door, and loading clears what it does not name', () => {
  const rows = settingsRows();
  const keys = profileKeys(rows);
  assert.ok(keys.includes('screenShake') && !keys.some((key) => key.startsWith('gameConfig.')));
  const source = { screenShake: false, musicVolume: 30, 'gameConfig.combatRatings.multiplier': 1.5 };
  const text = profileText(source, keys, { contentVersion: contentBundle.version });
  const device = { reducedMotion: true, musicVolume: 80, settingsCategory: 'Advanced' };
  const parsed = profileChanges(text, contentBundle, device, rows, keys);
  assert.deepEqual(parsed.changes, source);
  assert.deepEqual(parsed.cleared, ['reducedMotion'], 'a key the profile omits goes back to default; navigation state is left alone');
  const diff = profileDiff(device, parsed);
  assert.deepEqual(diff.map((d) => d.key).sort(), ['gameConfig.combatRatings.multiplier', 'musicVolume', 'reducedMotion', 'screenShake']);
  assert.throws(() => profileChanges('{"game":"Ashen Spire","schemaVersion":1,"overrides":{"settings.nope":1}}', contentBundle, {}, rows, keys), /Unknown setting/);
});

test('base64 of UTF-8 survives the trip', () => {
  const text = 'Reaver — “Ash” ⚔ ✓';
  assert.equal(fromBase64(toBase64(text)), text);
});

function fakeGitHub({ branch = false, file = null } = {}) {
  const calls = [];
  const state = { branch, file };
  const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
  const fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    calls.push(`${method} ${url.replace('https://api.github.com/repos/cehinds/AshenSpire', '')}`);
    if (url.includes('/git/ref/heads/settings-profiles')) return state.branch ? reply(200, { object: { sha: 'b1' } }) : reply(404, { message: 'Not Found' });
    if (url.includes('/git/ref/heads/dev')) return reply(200, { object: { sha: 'dev-sha' } });
    if (url.endsWith('/git/refs') && method === 'POST') { state.branch = true; return reply(201, {}); }
    if (url.includes('/contents/') && method === 'GET') return state.file ? reply(200, { content: toBase64(state.file), sha: 'f1' }) : reply(404, { message: 'Not Found' });
    if (url.includes('/contents/') && method === 'PUT') {
      const body = JSON.parse(init.body);
      state.file = fromBase64(body.content);
      state.put = body;
      return reply(state.put.sha ? 200 : 201, { content: { sha: 'f2' } });
    }
    return reply(500, {});
  };
  return { fetch, calls, state };
}

test('the first save makes the branch from dev, then the file; later saves replace it', async () => {
  const cfg = syncConfig({});
  const gh = fakeGitHub();
  assert.equal(await fetchProfile(cfg, { fetch: gh.fetch }), null, 'nothing there yet');
  const first = await pushProfile(cfg, '{"a":1}\n', { token: 't', fetch: gh.fetch });
  assert.deepEqual([first.branchCreated, first.created], [true, true]);
  assert.ok(gh.calls.includes('POST /git/refs'));
  assert.equal(gh.state.put.branch, 'settings-profiles');
  assert.equal(gh.state.put.sha, undefined, 'a new file carries no sha');
  const again = await pushProfile(cfg, '{"a":2}\n', { token: 't', fetch: gh.fetch });
  assert.deepEqual([again.branchCreated, again.created, again.unchanged], [false, false, false]);
  assert.equal(gh.state.put.sha, 'f1', 'a replacement names the blob it replaces');
  const same = await pushProfile(cfg, '{"a":2}\n', { token: 't', fetch: gh.fetch });
  assert.equal(same.unchanged, true, 'an identical profile is not committed again');
  assert.deepEqual(await fetchProfile(cfg, { fetch: gh.fetch }), { text: '{"a":2}\n', sha: 'f1' });
  await assert.rejects(pushProfile(cfg, 'x', { token: '', fetch: gh.fetch }), /needs a token/);
  assert.equal(contentsUrl(cfg), 'https://api.github.com/repos/cehinds/AshenSpire/contents/settings-profiles/default.json');
});

test('a refused token does not stop a public profile loading; a refused save says what to fix', async () => {
  const seen = [];
  const fetch = async (url, init = {}) => {
    seen.push(init.headers?.Authorization || 'anonymous');
    if (init.headers?.Authorization) return { status: 401, ok: false, json: async () => ({ message: 'Bad credentials' }) };
    return { status: 200, ok: true, json: async () => ({ content: toBase64('{}'), sha: 's' }) };
  };
  assert.deepEqual(await fetchProfile(syncConfig({}), { token: 'bad', fetch }), { text: '{}', sha: 's' });
  assert.deepEqual(seen, ['Bearer bad', 'anonymous']);
  const refuse = async () => ({ status: 401, ok: false, json: async () => ({ message: 'Bad credentials' }) });
  await assert.rejects(pushProfile(syncConfig({}), 'x', { token: 'bad', fetch: refuse }), /401: Bad credentials.*token was refused/);
});

test('the sync panel’s token field and switch are never wired as settings', async () => {
  const { readFileSync } = await import('node:fs');
  const screen = readFileSync(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../src/ui/components/settingsSync.js', import.meta.url), 'utf8');
  assert.ok(screen.includes("querySelectorAll('.set-text[data-key]')"), 'generic text handler needs a key');
  assert.ok(screen.includes("querySelectorAll('.toggle[data-key]')"), 'generic toggle handler needs a key');
  assert.doesNotMatch(screen, /querySelectorAll\('\.(set-text|toggle)'\)/);
  for (const hook of ['data-sync-token', 'data-sync="auto"']) {
    const tag = panel.slice(panel.lastIndexOf('<', panel.indexOf(hook)), panel.indexOf('>', panel.indexOf(hook)));
    assert.ok(!tag.includes('data-key'), `${hook} carries no setting key`);
  }
});

test('a malformed page path does not break channel detection', () => {
  assert.equal(buildChannel({ pathname: '/AshenSpire/dev/12/%E0%A4%A', hostname: 'cehinds.github.io', protocol: 'https:' }, 'standalone file'), 'dev');
});
