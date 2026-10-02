// tests/art-tier.test.mjs — Settings → Display → Art quality Auto / Light / High
// (src/ui/artTier.js, docs/EXTERNAL-ASSETS-PLAN.md §5, step 8c): Auto's tier
// detection, the tier the boot load asks for, a switch in play, the loader's
// fallback, and the row in a build that pins no packs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  autoTier, requestedTier, artQualityChoice, tierChoiceDisabled, tierStatus, applyArtTier, onTierArrived,
  resetArtTier, LOW_MEMORY_GB,
} from '../src/ui/artTier.js';
import { loadBuiltInPacks, resetBuiltInArt, builtInArtStatus } from '../src/ui/assetPacks.js';
import { assetUrl } from '../src/ui/assetmap.js';
import {
  ART_QUALITY_KEY, ART_AUTO, ART_LIGHT, ART_HIGH, ART_LOCAL_HIGH, ART_BUILT_IN, ART_QUALITY_CHOICES, wantsHighRes,
} from '../src/ui/highResArt.js';
import { LOCAL_ONLY_KEYS } from '../src/model/settingsSync.js';
import { settingsRows } from '../src/ui/screens/settings.js';
import { indexText } from '../tools/asset-pack.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const A = 'a'.repeat(64);
const C = 'c'.repeat(64);
const ID = 'assets/bg/bg_act1.webp';
const set = (choice) => ({ [ART_QUALITY_KEY]: choice });
const wide = { documentElement: { getAttribute: (name) => (name === 'data-layout' ? 'wide' : null) } };
const narrow = { documentElement: { getAttribute: (name) => (name === 'data-layout' ? 'narrow' : null) } };
const desktop = { deviceMemory: 8, connection: { saveData: false } };

/** A high-default (or light-default) pack tree whose fetch can be cut off. */
function packTree(tier = 'high') {
  const indexes = {
    light: indexText({ [ID]: [A, 10, 'image/webp'] }),
    high: indexText({ [ID]: [C, 99, 'image/webp'] }),
  };
  const packs = {};
  const files = new Map();
  for (const [pack, text] of Object.entries(indexes)) {
    if (tier === 'light' && pack === 'high') continue;
    const name = `packs/${pack}-${sha(text).slice(0, 12)}.json`;
    packs[pack] = { index: name, sha256: sha(text), ids: 1, objects: 1, bytes: 1 };
    files.set(name, text);
  }
  const tree = { pin: { schema: 1, tier, packs, fonts: null }, asked: [], offline: false };
  tree.fetchImpl = async (url) => {
    tree.asked.push(url);
    const body = tree.offline ? undefined : files.get(url.replace(/^\.\//, ''));
    if (body === undefined) return { ok: false, status: 404 };
    const bytes = new TextEncoder().encode(body);
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(0), json: async () => JSON.parse(body) };
  };
  tree.load = { inlineMap: {}, fetchImpl: tree.fetchImpl, protocol: 'http:' };
  return tree;
}
const tierOf = () => (assetUrl(ID).includes(`/${C.slice(0, 2)}/`) ? 'high' : assetUrl(ID).includes(`/${A.slice(0, 2)}/`) ? 'light' : 'none');
const fresh = () => { resetBuiltInArt(); resetArtTier(); };

test('Auto is the build’s default tier, and light on a narrow layout, with Save-Data or on little memory', () => {
  assert.deepEqual(autoTier({ defaultTier: 'high', doc: wide, nav: desktop }), { tier: 'high', reason: '' });
  assert.equal(autoTier({ defaultTier: 'high', doc: narrow, nav: desktop }).tier, 'light');
  assert.equal(autoTier({ defaultTier: 'high', doc: wide, nav: { ...desktop, connection: { saveData: true } } }).tier, 'light');
  assert.equal(autoTier({ defaultTier: 'high', doc: wide, nav: { deviceMemory: LOW_MEMORY_GB } }).tier, 'light');
  assert.equal(autoTier({ defaultTier: 'high', doc: wide, nav: { deviceMemory: LOW_MEMORY_GB * 2 } }).tier, 'high');
  assert.equal(autoTier({ defaultTier: 'high', doc: wide, nav: {} }).tier, 'high', 'a browser that reports nothing keeps the default');
  // A phone booted in landscape: the layout is wide, but its short side is a phone's.
  const landscapePhone = { width: 844, height: 390 };
  assert.deepEqual(autoTier({ defaultTier: 'high', doc: wide, nav: {}, scr: landscapePhone }), { tier: 'light', reason: 'the screen is small' });
  assert.equal(autoTier({ defaultTier: 'high', doc: wide, nav: {}, scr: { width: 1366, height: 768 } }).tier, 'high', 'a laptop screen');
  assert.equal(autoTier({ defaultTier: 'high', doc: wide, nav: {}, scr: { width: 1024, height: 768 } }).tier, 'high', 'a tablet screen');
  for (const doc of [wide, narrow]) assert.equal(autoTier({ defaultTier: 'light', doc, nav: desktop }).tier, 'light', 'a light build never asks for high');
  assert.match(autoTier({ defaultTier: 'high', doc: narrow, nav: desktop }).reason, /narrow/);
});

test('Light and High force a tier; Auto, Local high-res and the old Built-in follow Auto', () => {
  const env = { defaultTier: 'high', doc: narrow, nav: desktop };
  assert.equal(requestedTier(set(ART_LIGHT), { ...env, doc: wide }), 'light');
  assert.equal(requestedTier(set(ART_HIGH), env), 'high', 'High is high even on a narrow screen');
  for (const choice of [ART_AUTO, ART_LOCAL_HIGH, ART_BUILT_IN, undefined, 'nonsense']) {
    assert.equal(requestedTier(set(choice), env), 'light', String(choice));
    assert.equal(requestedTier(set(choice), { ...env, doc: wide }), 'high', String(choice));
  }
  assert.equal(artQualityChoice(set(ART_BUILT_IN)), ART_AUTO, 'a value stored before 8c reads as Auto');
  assert.equal(wantsHighRes(set(ART_HIGH)), false, 'High is the built-in pack, not the local folder');
});

test('the row: Auto by default, four choices, Built-in read as Auto, per-device', () => {
  const row = settingsRows().find((r) => r.key === ART_QUALITY_KEY);
  assert.equal(row.def, ART_AUTO);
  assert.deepEqual([...row.choices], [ART_AUTO, ART_LIGHT, ART_HIGH, ART_LOCAL_HIGH]);
  assert.deepEqual([...ART_QUALITY_CHOICES], [...row.choices]);
  assert.equal(row.legacyChoices[ART_BUILT_IN], ART_AUTO);
  assert.match(row.note, /Auto/);
  assert.match(row.note, /Light and High/);
  assert.ok(LOCAL_ONLY_KEYS.includes(ART_QUALITY_KEY), 'never synced');
});

test('a single file and the source tree disable Light and High and say why', () => {
  const pinned = packTree('high').pin;
  const inline = { [ID]: 'data:image/webp;base64,AA' };
  for (const choice of [ART_LIGHT, ART_HIGH]) {
    assert.equal(tierChoiceDisabled(choice, null, inline), true, `${choice}: single file`);
    assert.equal(tierChoiceDisabled(choice, null, {}), true, `${choice}: source tree`);
    assert.equal(tierChoiceDisabled(choice, pinned, {}), false, `${choice}: web edition`);
  }
  for (const choice of [ART_AUTO, ART_LOCAL_HIGH]) assert.equal(tierChoiceDisabled(choice, null, inline), false, choice);
  // The settings row consults it with the build's own pin, which is null here.
  const row = settingsRows().find((r) => r.key === ART_QUALITY_KEY);
  assert.equal(row.choiceDisabled(ART_HIGH), true);
  assert.equal(row.choiceDisabled(ART_AUTO), false);
  assert.match(tierStatus(set(ART_HIGH), { pin: null, inlineMap: inline }), /carries its art inside it.*Light and High apply to the web edition/);
  assert.match(tierStatus(set(ART_AUTO), { pin: null, inlineMap: {} }), /no tiers to choose/);
});

test('the boot load asks for the setting’s tier, and High on a light build falls back to light', async () => {
  fresh();
  const high = packTree('high');
  let s = await loadBuiltInPacks({ pin: high.pin, ...high.load, tier: 'light' });
  assert.equal(s.tier, 'light');
  assert.equal(high.asked.some((u) => u.includes('high-')), false, 'Light never fetches the high index');
  fresh();
  s = await loadBuiltInPacks({ pin: high.pin, ...high.load, tier: 'high' });
  assert.equal(s.tier, 'high');
  fresh();
  s = await loadBuiltInPacks({ pin: high.pin, ...high.load });
  assert.equal(s.tier, 'high', 'no tier: the build default');
  fresh();
  const light = packTree('light');
  s = await loadBuiltInPacks({ pin: light.pin, ...light.load, tier: 'high' });
  assert.equal(s.tier, 'light');
  assert.equal(s.requested, 'high');
  assert.match(s.failed.join(';'), /high: not pinned/);
  assert.match(tierStatus(set(ART_HIGH), { pin: light.pin, inlineMap: {} }), /Showing light art: this build carries no high art/);
  fresh();
});

test('a change in play reloads the indexes, re-points through onTierArrived, and the status line follows', async () => {
  fresh();
  const tree = packTree('high');
  const opts = { pin: tree.pin, inlineMap: {}, load: tree.load, env: { doc: wide, nav: desktop } };
  assert.equal(await applyArtTier(set(ART_AUTO), opts), null, 'before the boot load starts, the boot load decides');
  await loadBuiltInPacks({ pin: tree.pin, ...tree.load, tier: 'high' });
  assert.equal(tierOf(), 'high');
  const arrived = [];
  onTierArrived((map) => arrived.push(map.get(ID)));
  let s = await applyArtTier(set(ART_LIGHT), opts);
  assert.equal(s.tier, 'light');
  assert.equal(tierOf(), 'light');
  assert.equal(arrived.length, 1);
  assert.match(tierStatus(set(ART_LIGHT), { pin: tree.pin, inlineMap: {} }), /^Showing light art\.$/);
  assert.equal(await applyArtTier(set(ART_LIGHT), opts), null, 'the same tier again loads nothing');
  s = await applyArtTier(set(ART_AUTO), opts);
  assert.equal(s.tier, 'high', 'Auto on a wide desktop is the build default');
  assert.equal(tierOf(), 'high');
  assert.equal(await applyArtTier({ ...set(ART_AUTO), other: 1 }, { ...opts, env: { doc: narrow, nav: desktop } }), null,
    'another setting changing does not re-decide Auto after the window narrowed');
  assert.equal(tierOf(), 'high');
  await applyArtTier(set(ART_HIGH), opts);
  s = await applyArtTier(set(ART_AUTO), { ...opts, env: { doc: narrow, nav: desktop } });
  assert.equal(s.tier, 'light', 'choosing Auto again decides it again');
  assert.match(tierStatus(set(ART_AUTO), { pin: tree.pin, inlineMap: {}, env: { doc: narrow, nav: desktop } }), /light art, because the screen is narrow/);
  fresh();
});

test('a switch that cannot load keeps the art on screen; quick switches load only the last', async () => {
  fresh();
  const tree = packTree('high');
  const opts = { pin: tree.pin, inlineMap: {}, load: tree.load, env: { doc: wide, nav: desktop } };
  await applyArtTier(set(ART_LIGHT), opts);
  await loadBuiltInPacks({ pin: tree.pin, ...tree.load, tier: 'light' });
  tree.offline = true;
  const s = await applyArtTier(set(ART_HIGH), opts);
  assert.equal(s.state, 'loaded');
  assert.equal(s.tier, 'light');
  assert.ok(s.failed.length >= 2, 'both tiers were tried');
  assert.equal(tierOf(), 'light', 'the light art stays');
  assert.equal(builtInArtStatus().state, 'loaded');
  assert.equal(builtInArtStatus().requested, 'high', 'the attempted tier is kept');
  assert.match(tierStatus(set(ART_HIGH), { pin: tree.pin, inlineMap: {} }), /^Showing light art: the high art could not be loaded\.$/);
  fresh();
});

test('quick switches run only the last: a superseded switch never fetches', async () => {
  fresh();
  const tree = packTree('high');
  const opts = { pin: tree.pin, inlineMap: {}, load: tree.load, env: { doc: wide, nav: desktop } };
  await applyArtTier(set(ART_LIGHT), opts);
  await loadBuiltInPacks({ pin: tree.pin, ...tree.load, tier: 'light' });
  tree.asked.length = 0;
  const first = applyArtTier(set(ART_HIGH), opts);  // a real change: queued, round 1
  const second = applyArtTier(set(ART_LIGHT), opts); // round 2 supersedes it before it runs
  assert.equal(await first, null, 'superseded by round');
  assert.equal(await second, null, 'light is already on screen');
  assert.equal(tree.asked.length, 0, 'the superseded switch to High never fetched an index');
  assert.equal(tierOf(), 'light');
  fresh();
});

test('a switch still loading when the player picks again publishes nothing', async () => {
  fresh();
  const tree = packTree('high');
  let release;
  const gate = new Promise((r) => { release = r; });
  const slow = async (url, init) => { if (url.includes('high-')) await gate; return tree.fetchImpl(url, init); };
  const opts = { pin: tree.pin, inlineMap: {}, load: { ...tree.load, fetchImpl: slow }, env: { doc: wide, nav: desktop } };
  await applyArtTier(set(ART_LIGHT), opts);
  await loadBuiltInPacks({ pin: tree.pin, ...tree.load, tier: 'light' });
  const arrived = [];
  onTierArrived((map) => arrived.push(map.get(ID)));
  const toHigh = applyArtTier(set(ART_HIGH), opts);
  await new Promise((r) => setTimeout(r, 10)); // the High load is in flight, waiting on its index
  const toLight = applyArtTier(set(ART_LIGHT), opts);
  release();
  assert.equal(await toHigh, null, 'the obsolete High load is discarded');
  await toLight;
  assert.equal(arrived.length, 0, 'High was never published: no source change, no onSource');
  assert.equal(tierOf(), 'light');
  assert.equal(builtInArtStatus().tier, 'light');
  fresh();
});

test('Auto is decided after the batch that set it has applied the new layout', async () => {
  fresh();
  const tree = packTree('high');
  let layout = 'wide';
  const doc = { documentElement: { getAttribute: (name) => (name === 'data-layout' ? layout : null) } };
  const opts = { pin: tree.pin, inlineMap: {}, load: tree.load, env: { doc, nav: desktop } };
  await applyArtTier(set(ART_HIGH), opts);
  await loadBuiltInPacks({ pin: tree.pin, ...tree.load, tier: 'high' });
  // A profile load: applyDisplaySettings (Auto) runs, then applyUiScale writes narrow.
  const pending = applyArtTier(set(ART_AUTO), opts);
  layout = 'narrow';
  const s = await pending;
  assert.equal(s.tier, 'light', 'Auto read the layout the same batch wrote');
  fresh();
});

test('a tier switch in play refills the CSS assets from the new tier (step 3b)', async () => {
  fresh();
  const tree = packTree('high');
  const styles = [];
  const make = () => { const el = { attrs: {}, textContent: '', setAttribute(k, v) { el.attrs[k] = v; }, replaceWith(next) { styles.splice(styles.indexOf(el), 1, next); } }; return el; };
  const doc = {
    head: { appendChild: (el) => styles.push(el) }, baseURI: 'https://example.com/AshenSpire/', createElement: make,
    querySelector: (sel) => (sel === 'style[data-asset-css]' ? styles.find((el) => 'data-asset-css' in el.attrs) || null : null),
  };
  const css = { schema: 1, rules: [`:root{--as-css-bg:url("{{${ID}}}")}`] };
  const load = { ...tree.load, css, doc };
  const opts = { pin: tree.pin, inlineMap: {}, load, env: { doc: wide, nav: desktop } };
  await applyArtTier(set(ART_LIGHT), opts);
  await loadBuiltInPacks({ pin: tree.pin, ...load, tier: 'light' });
  assert.equal(styles.length, 1);
  assert.match(styles[0].textContent, new RegExp(`objects/${A.slice(0, 2)}/${A}`), 'light backdrop at boot');
  await applyArtTier(set(ART_HIGH), opts);
  assert.equal(styles.length, 1, 'the one <style data-asset-css> is replaced, not added to');
  assert.match(styles[0].textContent, new RegExp(`objects/${C.slice(0, 2)}/${C}`), 'high backdrop after the switch');
  tree.offline = true;
  await applyArtTier(set(ART_LIGHT), opts);
  assert.match(styles[0].textContent, new RegExp(C), 'a failed switch leaves the CSS as it was');
  fresh();
});
