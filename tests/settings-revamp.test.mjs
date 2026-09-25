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

test('auto-load applies only while the game is still waiting for it', async () => {
  const { autoLoadProfile } = await import('../src/ui/components/settingsSync.js');
  const { SYNC_STORAGE } = await import('../src/model/settingsSync.js');
  const store = new Map([[SYNC_STORAGE.auto, '1']]);
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  try {
    const rows = settingsRows();
    const text = profileText({ screenShake: false }, profileKeys(rows));
    const fetch = async () => ({ status: 200, ok: true, json: async () => ({ content: toBase64(text), sha: 'p1' }) });
    const settings = {};
    const changes = [];
    const late = await autoLoadProfile({ settings, onChange: (c) => changes.push(c), rows, fetch, stillWanted: () => false });
    assert.equal(late.reason, 'late');
    assert.deepEqual(changes, []);
    assert.equal(store.get(SYNC_STORAGE.lastSha), undefined, 'a late profile is left for the next start');
    const onTime = await autoLoadProfile({ settings, onChange: (c) => changes.push(c), rows, fetch });
    assert.equal(onTime.applied, 1);
    assert.equal(settings.screenShake, false);
    assert.equal(store.get(SYNC_STORAGE.lastSha), 'p1');
    assert.equal((await autoLoadProfile({ settings, onChange: () => {}, rows, fetch })).reason, 'unchanged');
  } finally { globalThis.localStorage = saved; }
});

test('a resolved row shows its dot and Reset when clearing its key would change it', () => {
  const row = settingsRow('musicEnabled');
  assert.equal(typeof row.resolve, 'function');
  assert.equal(rowModified({}, row), false);
  assert.equal(rowModified({ musicEnabled: false }, row), true);
  const html = settingsRowHtml({ musicEnabled: false }, row);
  assert.ok(html.includes('data-reset-key="musicEnabled"') && html.includes('data-modified="true"'));
  assert.doesNotMatch(html, /data-reset-key="musicEnabled"[^>]*hidden/);
});

test('while searching, the scoped reset resets the shown results and says so', async () => {
  const { readFileSync } = await import('node:fs');
  const screen = readFileSync(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8');
  assert.match(screen, /filtering\(\) \? settingsSearchHits\(query, pageDebug\(\), settings, \{ changedOnly: changedOnly\(\) \}\)\.slice\(0, SEARCH_LIMIT\)/);
  assert.ok(screen.includes("'Reset these results'"));
});

test('a volume slider takes every whole percent, and a compact slider widens for values outside it', async () => {
  const html = settingsRowHtml({ musicVolume: 33 }, settingsRow('musicVolume'));
  assert.match(html, /class="set-range"[^>]*step="1"[^>]*value="33"/, 'a typed 33 is a slider position');
  assert.match(html, /data-step="1" data-step-by="5"/, 'the buttons still move by 5');
  const { readFileSync } = await import('node:fs');
  const screen = readFileSync(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8');
  assert.match(screen, /if \(v > Number\(slider\.max\)\) slider\.max = /, 'a committed value past the span widens it');
});

test('a profile that already matches is recorded as loaded', async () => {
  const { readFileSync } = await import('node:fs');
  const panel = readFileSync(new URL('../src/ui/components/settingsSync.js', import.meta.url), 'utf8');
  assert.match(panel, /if \(!diff\.length\) \{\s*write\(SYNC_STORAGE\.lastSha, remote\.sha/);
});

test('the dev-preview standalone files are named so they open as dev builds', async () => {
  const { readFileSync } = await import('node:fs');
  const workflow = readFileSync(new URL('../.github/workflows/dev-preview.yml', import.meta.url), 'utf8');
  const names = [...workflow.matchAll(/standalone\/(AshenSpire[^\s]*\.html)/g)].map((m) => m[1]);
  assert.ok(names.length >= 2, 'the workflow still writes the standalone files');
  for (const name of names) {
    assert.equal(buildChannel({ pathname: `/Downloads/dev-standalone/${name}`, hostname: '', protocol: 'file:' }, 'standalone file'), 'dev', name);
  }
});

test('a fractional slider can stand on an off-step authored value', () => {
  const html = settingsRowHtml({}, { key: 'x.frac', label: 'Frac', type: 'number', def: 0.01, min: 0, max: 5, step: 0.05, integer: false });
  assert.match(html, /class="set-num-slider"[^>]*step="any"[^>]*value="0.01"/);
  const whole = settingsRowHtml({}, { key: 'x.int', label: 'Int', type: 'number', def: 3, min: 0, max: 10, step: 1 });
  assert.match(whole, /class="set-num-slider"[^>]*step="1"/);
});

test('−/+ step from an off-grid value instead of snapping to the grid', async () => {
  const { readFileSync } = await import('node:fs');
  const screen = readFileSync(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8');
  assert.match(screen, /const round = \(v\) => Number\(v\.toFixed\(10\)\);/);
  assert.doesNotMatch(screen, /Math\.round\(v \/ step\) \* step/);
});

test('a compact slider over a signed range is centred on its value', () => {
  assert.deepEqual(sliderSpan({ min: -999, max: 999, step: 1, def: 5 }, 5), [-50, 50]);
  assert.deepEqual(sliderSpan({ min: -500, max: 500, step: 1, def: 0 }, 0), [-50, 50]);
  assert.deepEqual(sliderSpan({ min: -3, max: 999, step: 1, def: 5 }, 5), [-3, 50], 'a shallow negative floor is kept');
});

test('search leaves out rows the hand rules hide, so the count and the reset match the screen', () => {
  const fill = { 'gameConfig.handRules.drawMode': 'fill' };
  const shown = settingsSearchHits('turn draw base', true, fill).map((hit) => hit.row.key);
  assert.ok(!shown.includes('gameConfig.handRules.turn.base'), 'a fixed-draw row is hidden while drawing to a hand size');
  assert.ok(settingsSearchHits('turn draw base', true, {}).some((hit) => hit.row.key === 'gameConfig.handRules.turn.base'), 'and found in fixed mode');
});

test('a new profile load retires the previous preview first', async () => {
  const { readFileSync } = await import('node:fs');
  const panel = readFileSync(new URL('../src/ui/components/settingsSync.js', import.meta.url), 'utf8');
  const start = panel.indexOf('const previewLoad = async');
  assert.ok(panel.indexOf('pending = null;', start) < panel.indexOf('fetchProfile(', start));
});

test('a dev preview served to a phone over the LAN opens as dev', () => {
  for (const host of ['192.168.1.20', '10.0.0.5', '172.20.3.4', 'workstation.local']) {
    assert.equal(buildChannel({ pathname: '/index.html', hostname: host, protocol: 'http:' }, 'standalone file'), 'dev', host);
  }
  assert.equal(buildChannel({ pathname: '/index.html', hostname: '172.40.3.4', protocol: 'http:' }, 'standalone file'), 'main', 'a public 172.x is not private');
});

test('?debug=1 still opens an unknown file when storage is unavailable', () => {
  assert.equal(debugEnabled('unknown', { search: '?debug=1', storage: null }), true);
  assert.equal(debugEnabled('unknown', { search: '', storage: null }), false);
  assert.equal(debugEnabled('main', { search: '?debug=1', storage: null }), false);
});

test('a profile load that finishes after the location changed is dropped', async () => {
  const { readFileSync } = await import('node:fs');
  const panel = readFileSync(new URL('../src/ui/components/settingsSync.js', import.meta.url), 'utf8');
  assert.match(panel, /if \(mine !== generation \|\| !btn\.isConnected\) return;/);
  assert.match(panel, /cfg = next;\s*generation \+= 1;/);
});

test('Changed lists every modified row from every section, and nothing else', async () => {
  const { rowDefault } = await import('../src/ui/screens/settings.js');
  const hits = settingsSearchHits('', true, { screenShake: false, 'gameConfig.combatRatings.multiplier': 1.5 }, { changedOnly: true });
  assert.deepEqual(hits.map((hit) => hit.row.key).sort(), ['gameConfig.combatRatings.multiplier', 'screenShake']);
  assert.deepEqual(settingsSearchHits('', true, {}, { changedOnly: true }), [], 'a fresh profile has nothing changed');
  assert.deepEqual(settingsSearchHits('shake', true, { screenShake: false, reducedMotion: true }, { changedOnly: true }).map((h) => h.row.key), ['screenShake'], 'words narrow it');
  assert.equal(rowDefault(settingsRow('screenShake')), settingsRow('screenShake').def, 'no promoted default: the row default');
});

test('a reset offers Undo with exactly what it moved', async () => {
  const { resetKeys } = await import('../src/ui/screens/settings.js');
  const settings = { screenShake: false, reducedMotion: true };
  const seen = [];
  const snapshot = resetKeys(settings, (c) => seen.push(c), ['screenShake', 'musicVolume'], 'Group reset');
  assert.deepEqual(snapshot, { screenShake: false, musicVolume: undefined });
  assert.equal(settings.screenShake, undefined);
  assert.equal(settings.reducedMotion, true, 'keys outside the reset stay');
  assert.deepEqual(seen, [{ screenShake: undefined, musicVolume: undefined }]);
});

test('a release build can see and clear tuning it hides', async () => {
  const { hiddenTuningKeys } = await import('../src/ui/screens/settings.js');
  const settings = { 'gameConfig.combatRatings.multiplier': 2, screenShake: false };
  assert.deepEqual(hiddenTuningKeys(settings, false), ['gameConfig.combatRatings.multiplier']);
  assert.deepEqual(hiddenTuningKeys(settings, true), [], 'a debug build shows every row, so nothing is hidden');
});

test('an authored slider range wins over the heuristic, and still holds the value', () => {
  assert.deepEqual(sliderSpan({ min: 0, max: 999, step: 0.01, def: 1, sliderRange: [0.5, 2] }, 1), [0.5, 2]);
  assert.deepEqual(sliderSpan({ min: 0, max: 999, step: 0.01, def: 1, sliderRange: [0.5, 2] }, 3), [0.5, 3]);
});

test('promoted defaults seed a profile once, follow a new promotion, and never override a choice', async () => {
  const { seedSettingsDefaults, SEED_KEY } = await import('../src/model/settingsDefaults.js');
  const first = { digest: 'a', values: { screenShake: false, musicVolume: 40 } };
  const fresh = {};
  Object.assign(fresh, seedSettingsDefaults(fresh, first));
  assert.equal(fresh.screenShake, false);
  assert.equal(fresh.musicVolume, 40);
  assert.deepEqual(fresh[SEED_KEY], first.values);
  const chose = { ...fresh, musicVolume: 70 };
  const second = { digest: 'b', values: { screenShake: true, musicVolume: 55 } };
  const moved = seedSettingsDefaults(chose, second);
  assert.equal(moved.screenShake, true, 'an untouched default follows the new promotion');
  assert.ok(!('musicVolume' in moved), 'the player’s own value stays');
  const dropped = seedSettingsDefaults({ ...fresh }, { digest: 'c', values: {} });
  assert.ok('screenShake' in dropped && dropped.screenShake === undefined, 'a dropped promotion hands the key back to the code default');
  assert.deepEqual(seedSettingsDefaults({}, { digest: 'none', values: {} }), {}, 'no promotion, no change');
});

test('a profile save that finishes after the location changed is not recorded', async () => {
  const { readFileSync } = await import('node:fs');
  const panel = readFileSync(new URL('../src/ui/components/settingsSync.js', import.meta.url), 'utf8');
  assert.match(panel, /const target = cfg;\s*const mine = generation;\s*const result = await pushProfile\(target,/);
  assert.match(panel, /if \(mine !== generation \|\| target !== cfg\) return;\s*write\(SYNC_STORAGE\.lastSha/);
});

test('a resolved row set to its promoted default is not changed', async () => {
  const { rowModified } = await import('../src/ui/screens/settings.js');
  const row = settingsRow('musicEnabled');
  const promoted = { musicEnabled: false };
  assert.equal(rowModified({ musicEnabled: false }, row, promoted), false, 'the promoted value is the default');
  assert.equal(rowModified({ musicEnabled: true }, row, promoted), true, 'moving off the promoted value is a change');
  assert.equal(rowModified({ musicEnabled: false }, row, {}), true, 'with no promoted default, off is a change');
});

test('a key a profile leaves out goes back to its promoted default, not the code default', async () => {
  const { profileDiff } = await import('../src/model/settingsSync.js');
  const parsed = { changes: {}, cleared: ['screenShake', 'reducedMotion'] };
  const here = { screenShake: false, reducedMotion: true };
  assert.deepEqual(profileDiff(here, parsed, { screenShake: false }), [{ key: 'reducedMotion', from: true, to: undefined }],
    'already at the promoted value: nothing moves');
  assert.deepEqual(profileDiff({ screenShake: true }, { changes: {}, cleared: ['screenShake'] }, { screenShake: false }),
    [{ key: 'screenShake', from: true, to: false }]);
  assert.deepEqual(profileDiff(here, parsed).map((d) => d.to), [undefined, undefined], 'no promoted default: cleared');
});

test('changing the device-key scope forgets the loaded version, and Changed counts only what it can show', async () => {
  const { readFileSync } = await import('node:fs');
  const panel = readFileSync(new URL('../src/ui/components/settingsSync.js', import.meta.url), 'utf8');
  assert.match(panel, /write\(SYNC_STORAGE\.includeDevice[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*write\(SYNC_STORAGE\.lastSha, null\);/);
  const screen = readFileSync(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8');
  assert.match(screen, /const count = settingsSearchHits\('', pageDebug\(\), settings, \{ changedOnly: true \}\)\.length;/);
  const hidden = settingsSearchHits('', false, { 'gameConfig.combatRatings.multiplier': 1.5 }, { changedOnly: true });
  assert.deepEqual(hidden, [], 'release: hidden tuning is not in Changed');
});

test('a player value that happens to equal a promotion is not recorded as seeded', async () => {
  const { seedSettingsDefaults, SEED_KEY } = await import('../src/model/settingsDefaults.js');
  const chose = { musicVolume: 40 };
  Object.assign(chose, seedSettingsDefaults(chose, { digest: 'a', values: { musicVolume: 40, screenShake: false } }));
  assert.deepEqual(chose[SEED_KEY], { screenShake: false }, 'only the absent key was seeded');
  const moved = seedSettingsDefaults(chose, { digest: 'b', values: { musicVolume: 50, screenShake: false } });
  assert.equal(Object.hasOwn(moved, 'musicVolume'), false, 'the player\'s 40 survives the next promotion');
});

test('a release build neither applies nor keeps promoted hidden tuning', async () => {
  const { promotionFor, resetKeys, hiddenTuningKeys } = await import('../src/ui/screens/settings.js');
  const defaults = { digest: 'x', values: { screenShake: false, 'gameConfig.combatRatings.multiplier': 1.5 } };
  assert.deepEqual(promotionFor(defaults, true), defaults, 'debug builds apply all of it');
  assert.deepEqual(promotionFor(defaults, false).values, { screenShake: false }, 'release leaves hidden tuning out');
  const settings = { 'gameConfig.combatRatings.multiplier': 1.5 };
  const keys = hiddenTuningKeys(settings, false);
  resetKeys(settings, () => ({ ok: true }), keys, 'clear', { promoted: {} });
  assert.equal(Object.hasOwn(settings, 'gameConfig.combatRatings.multiplier'), false, 'cleared, not reset to the promotion');
  const { seedSettingsDefaults, SEED_KEY } = await import('../src/model/settingsDefaults.js');
  const seeded = { 'gameConfig.combatRatings.multiplier': 1.5, [SEED_KEY]: { 'gameConfig.combatRatings.multiplier': 1.5 } };
  const moved = seedSettingsDefaults(seeded, promotionFor(defaults, false));
  assert.equal(moved['gameConfig.combatRatings.multiplier'], undefined, 'an earlier seed of it is withdrawn on release');
  assert.equal(Object.hasOwn(moved, 'gameConfig.combatRatings.multiplier'), true);
});

test('pad directions, profile switches and cleared volumes reach the live state', async () => {
  const { readFileSync } = await import('node:fs');
  const input = readFileSync(new URL('../src/ui/input.js', import.meta.url), 'utf8');
  assert.doesNotMatch(input, /else if \(i === 1[2-5]\) moveFocus\(/, 'the D-pad goes through navigate()');
  assert.match(input, /if \(Math\.abs\(ax\) > Math\.abs\(ay\)\) navigate\(/, 'so does the stick');
  const panel = readFileSync(new URL('../src/ui/components/settingsSync.js', import.meta.url), 'utf8');
  assert.equal((panel.match(/write\(SYNC_STORAGE\.lastSha, null\);\s*write\(SYNC_STORAGE\.lastAt, null\);/g) || []).length, 2);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /musicVolume: settings\.musicVolume \?\? AUDIO_DEFAULTS\.musicVolume/);
  assert.match(main, /sfxVolume: settings\.sfxVolume \?\? AUDIO_DEFAULTS\.sfxVolume/);
});

test('a profile that cannot be saved is not left applied', async () => {
  const { applyProfile } = await import('../src/ui/components/settingsSync.js');
  const settings = { screenShake: false, reducedMotion: true };
  const parsed = { changes: { screenShake: true, musicVolume: 20 }, cleared: ['reducedMotion'] };
  const calls = [];
  assert.throws(() => applyProfile(settings, (c) => { calls.push(c); return { ok: false }; }, parsed, {}), /could not be saved/);
  assert.deepEqual(settings, { screenShake: false, reducedMotion: true });
  assert.deepEqual(calls[1], { screenShake: false, musicVolume: undefined, reducedMotion: true },
    'the old values go back through onChange too, so the live state follows');
});

test('navigate() reads its own cursor, and a refused token write is reported', async () => {
  const { readFileSync } = await import('node:fs');
  const input = readFileSync(new URL('../src/ui/input.js', import.meta.url), 'utf8');
  const body = input.slice(input.indexOf('function navigate('), input.indexOf('function nudgeRange('));
  assert.match(body, /function navigate\(dir, on = null\)/, 'navigate is module-level, so each caller hands it the control');
  const panel = readFileSync(new URL('../src/ui/components/settingsSync.js', import.meta.url), 'utf8');
  assert.match(panel, /if \(!write\(SYNC_STORAGE\.token, value\)\) \{/);
});

test('release promotions and Clear hidden tuning cover every debug-only row, not only gameConfig.*', async () => {
  const { promotionFor, hiddenTuningKeys } = await import('../src/ui/screens/settings.js');
  const values = { shrineMultiUse: true, screenShake: false, 'gameConfig.combatRatings.multiplier': 2 };
  assert.deepEqual(promotionFor({ digest: 'x', values }, false).values, { screenShake: false });
  assert.deepEqual(hiddenTuningKeys(values, false).sort(), ['gameConfig.combatRatings.multiplier', 'shrineMultiUse']);
  assert.deepEqual(hiddenTuningKeys(values, true), [], 'debug builds show them all');
  const { readFileSync } = await import('node:fs');
  const panel = readFileSync(new URL('../src/ui/components/settingsSync.js', import.meta.url), 'utf8');
  assert.match(panel, /if \(!write\(SYNC_STORAGE\.auto, [^)]*\)\) \{ status\(STORAGE_REFUSED\); return; \}/);
  assert.match(panel, /if \(!write\(SYNC_STORAGE\.includeDevice, [^)]*\)\) \{ status\(STORAGE_REFUSED\); return; \}/);
});

test('a profile location is adopted only once storage kept it', async () => {
  const { readFileSync } = await import('node:fs');
  const panel = readFileSync(new URL('../src/ui/components/settingsSync.js', import.meta.url), 'utf8');
  const guarded = panel.match(/if \(!write\(SYNC_STORAGE\.config, JSON\.stringify\(next\)\)\) \{ status\(STORAGE_REFUSED\); return; \}\s*cfg = next;/g) || [];
  assert.equal(guarded.length, 2, 'both the named-profile picker and Use these');
});

test('auto-load leaves a profile alone when this device cannot record its version', async () => {
  const { autoLoadProfile } = await import('../src/ui/components/settingsSync.js');
  const { SYNC_STORAGE } = await import('../src/model/settingsSync.js');
  const store = new Map([[SYNC_STORAGE.auto, '1']]);
  const saved = globalThis.localStorage;
  // Reads work; every write is refused (a full or locked store).
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => {} };
  try {
    const rows = settingsRows();
    const text = profileText({ screenShake: false }, profileKeys(rows));
    const fetch = async () => ({ status: 200, ok: true, json: async () => ({ content: toBase64(text), sha: 'p1' }) });
    const settings = {};
    const changes = [];
    const result = await autoLoadProfile({ settings, onChange: (c) => changes.push(c), rows, fetch });
    assert.equal(result.reason, 'unrecorded');
    assert.deepEqual(changes, [], 'nothing applied that would be re-applied on every start');
  } finally { globalThis.localStorage = saved; }
});

test('each input steers the control it is on', async () => {
  const { readFileSync } = await import('node:fs');
  const input = readFileSync(new URL('../src/ui/input.js', import.meta.url), 'utf8');
  assert.match(input, /navigate\(\{ ArrowUp[^}]*\}\[ev\.key\], ev\.target\);/, 'keys act on the keyboard target');
  for (const d of ['up', 'down', 'left', 'right']) assert.match(input, new RegExp(`navigate\\('${d}', current\\(\\)\\);`), `D-pad ${d} acts on the game cursor`);
  const body = input.slice(input.indexOf('function navigate('), input.indexOf('function nudgeRange('));
  assert.doesNotMatch(body, /document\.activeElement|current\(\)/, 'navigate uses only the control it is given');
});

test('−/+ ask for the button step of the value they step from', async () => {
  const { buttonStep } = await import('../src/ui/screens/settings.js');
  const row = settingsRow('gameConfig.combatRatings.multiplier');
  assert.equal(buttonStep(row, 1), 0.05);
  assert.equal(buttonStep(row, 40), 1, 'a typed 40 steps by 1, not the 0.05 it was drawn with');
  const { readFileSync } = await import('node:fs');
  const screen = readFileSync(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8');
  assert.match(screen, /const by = \(stepFor \? stepFor\(base\) : Number\(b\.dataset\.stepBy\)\) \|\| step;/);
  assert.match(screen, /stepFor: \(v\) => buttonStep\(row, v\)/);
});

test('a Reset goes back to the promotion this build applies, never hidden tuning on release', async () => {
  const { readFileSync } = await import('node:fs');
  const screen = readFileSync(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8');
  assert.match(screen, /export function resetKeys\(settings, onChange, keys, label = 'Reset', \{ promoted = buildPromotion\(\) \} = \{\}\)/);
  assert.match(screen, /return debug \? PROMOTED_DEFAULTS : promotionFor\(SETTINGS_DEFAULTS, false\)\.values;/);
  const { resetKeys } = await import('../src/ui/screens/settings.js');
  const settings = { shrineMultiUse: true, screenShake: true };
  resetKeys(settings, () => ({ ok: true }), ['shrineMultiUse', 'screenShake'], 'all', { promoted: { screenShake: false } });
  assert.deepEqual(settings, { screenShake: false }, 'a key the promotion leaves out is cleared');
});
