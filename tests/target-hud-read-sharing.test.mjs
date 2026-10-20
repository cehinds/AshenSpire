import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { targetBodyHudPlacement } from '../src/ui/models/TargetHudModel.js';

const source = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
const begin = source.indexOf('  function readHitBadges(');
const end = source.indexOf('\n  function placePlayerHud(', begin);
function fixture({ badges = 2, partial = false, plain = false } = {}) {
  const operations = [], counters = { body: 0, frame: 0 }, frames = [];
  let pose = 0;
  for (let id = 0; id < 3; id++) {
    const values = new Map();
    const sprite = { id };
    const leading = { style: {}, getBoundingClientRect() { operations.push('post-reset-leading'); return { left: 0, top: 0, width: 40, height: 20 }; } };
    const rack = { querySelector: () => ({ getBoundingClientRect: () => ({ height: 37 }) }) };
    frames.push({ id, values, dataset: {}, style: {
      getPropertyValue: key => values.get(key) || '',
      setProperty(key, value) { operations.push(`write:${id}`); values.set(key, value); },
    }, getBoundingClientRect() { counters.frame++; operations.push(`frame:${id}`); return { left: id * 100, top: 50 }; },
    querySelector(selector) {
      if (selector === ':scope > .combat-hit-chance') return id < badges ? {} : null;
      if (selector === '.sprite') return sprite;
      if (selector === '.combatant-leading') return leading;
      if (selector === ':scope > .target-hud-overhead-meters') return plain && id === 0 ? null : rack;
      throw Error(selector);
    } });
  }
  if (partial) frames.push({ dataset: {}, values: new Map(), querySelector: selector => selector === ':scope > .combat-hit-chance' ? {} : null });
  const funcs = runInNewContext(source.slice(begin, end) + '\n({ centerTargetOverheads, placeHitBadges })', {
    uiZoom: () => 1.25, schedule() {}, field: { querySelectorAll: () => frames, closest: () => ({ dataset: {}, querySelector: () => null }) },
    uiConfig: { presentation: { combatFormationModel: { positioning: { perspectiveGrid: { miniHudGroupHeightPx: 61, miniHudSpriteGapPx: 5 } } } } },
    currentSpriteBodyBounds(sprite) { counters.body++; operations.push(`body:${sprite.id}`); return { left: sprite.id * 100 + 20, right: sprite.id * 100 + 80, top: 180 - pose, bottom: 360 - pose, headY: 200 - pose, feetY: 360 - pose }; },
    currentSpriteArtBounds() { operations.push('post-reset-art'); return { left: 20, right: 80, top: 180 - pose, bottom: 360 - pose }; },
    targetBodyHudPlacement, targetOverheadPlacement: () => ({ dx: 0, dy: -10 }),
  });
  return { ...funcs, frames, counters, operations, pose(value) { pose = value; } };
}

test('hit badges and racked HUDs share one read per actor before any writes', () => {
  const f = fixture({ partial: true });
  f.centerTargetOverheads();
  assert.deepEqual(f.counters, { body: 3, frame: 3 }, 'two badge actors must not be measured a second time by their racks');
  const firstWrite = f.operations.findIndex(row => row.startsWith('write:'));
  assert.ok(firstWrite > 0);
  assert.ok(f.operations.slice(firstWrite).every(row => row.startsWith('write:')), 'all body/frame reads precede the write phase');
  for (const frame of f.frames.slice(0, 3)) {
    assert.equal(frame.dataset.miniHudHeadY, '200');
    assert.equal(frame.values.get('--combat-mini-hud-top'), '67.2px');
    assert.equal(frame.values.get('--combat-selected-intent-top'), '86.4px');
    if (frame.id < 2) {
      assert.equal(frame.values.get('--combat-body-center-x'), '40px');
      assert.equal(frame.values.get('--combat-body-center-y'), '184px');
    }
  }
  assert.equal(f.frames[3].values.size, 0, 'partial mounts remain untouched');
});

test('the next alignment call reads the changed pose afresh, never a retained frame cache', () => {
  const f = fixture();
  f.centerTargetOverheads(); f.pose(25); f.centerTargetOverheads();
  assert.deepEqual(f.counters, { body: 6, frame: 6 });
  assert.equal(f.frames[0].dataset.miniHudHeadY, '175');
  assert.equal(f.frames[0].values.get('--combat-body-center-y'), '164px');
  assert.equal(f.frames[0].values.get('--combat-mini-hud-top'), '47.2px');
});

test('standalone hit badges and no-badge HUDs retain their fresh-read behavior', () => {
  const only = fixture(); only.placeHitBadges(); only.pose(25); only.placeHitBadges();
  assert.deepEqual(only.counters, { body: 4, frame: 4 });
  assert.equal(only.frames[0].values.get('--combat-body-center-y'), '164px');
  assert.equal(only.frames[0].dataset.miniHudHeadY, undefined);
  const none = fixture({ badges: 0 }); none.centerTargetOverheads();
  assert.deepEqual(none.counters, { body: 3, frame: 3 });
  assert.equal(none.frames[0].values.has('--combat-body-center-y'), false);
});

test('plain overhead geometry is still read after its reset writes', () => {
  const f = fixture({ plain: true }); f.centerTargetOverheads();
  const art = f.operations.indexOf('post-reset-art');
  const leading = f.operations.indexOf('post-reset-leading');
  assert.ok(art > f.operations.findIndex(row => row.startsWith('write:')));
  assert.ok(leading > art);
});
