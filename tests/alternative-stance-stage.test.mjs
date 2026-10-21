import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardDom } from './helpers/reward-dom.mjs';
import { createAlternativeStanceStage, withAlternativeStance } from '../src/ui/alternativeStanceStage.js';

test('held artwork reuses pending and painted images but reloads changed URLs and retries failures', async () => {
  const dom = rewardDom(), assigned = [];
  const Element = dom.document.createElement('img').constructor;
  const globals = { ...dom, Image: class extends Element {
    constructor() { super('img'); }
    set src(value) { assigned.push(value); this.setAttribute('src', value); }
  } };
  const saved = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  const catalog = { actors: { actor: { frames: {
    offensive: { path: 'attack.webp', lite: 'attack-lite.webp' },
    defensive: { path: 'guard.webp', lite: 'guard-lite.webp' },
  } } } };
  let base = 'first/';
  try {
    const stage = createAlternativeStanceStage('actor', { catalog, resolveUrl: path => base + path });
    const image = stage.el.firstElementChild;
    assert.equal(stage.setStance(null), false);
    assert.equal(stage.el.dataset.stance, 'neutral', 'initial neutral still initializes its presentation');
    const neutral = stage.ready;
    stage.setStance(null); assert.equal(stage.ready, neutral);
    stage.setStance('offensive'); const pending = stage.ready;
    stage.setStance('offensive'); assert.equal(stage.ready, pending);
    assert.deepEqual(assigned, ['first/attack.webp']);
    image.onload(); assert.equal(await pending, true);
    stage.setStance('offensive'); assert.equal(image.style.visibility, 'visible');
    assert.equal(stage.el.dataset.frameReady, 'true'); assert.equal(stage.ready, pending);
    assert.equal(assigned.length, 1, 'a loaded repeated stance does not reset src');
    stage.setLite(true); assert.equal(assigned.at(-1), 'first/attack-lite.webp');
    const light = stage.ready; stage.setLite(true); assert.equal(stage.ready, light);
    image.onload(); await light;
    base = 'second/'; stage.setStance('offensive'); assert.equal(assigned.at(-1), 'second/attack-lite.webp');
    const failed = stage.ready; image.onerror(); assert.equal(await failed, false);
    stage.setStance('offensive'); assert.notEqual(stage.ready, failed, 'same failed URL can retry');
    image.onload(); assert.equal(await stage.ready, true);
    stage.setStance('defensive'); const superseded = stage.ready, staleLoad = image.onload;
    stage.setStance('offensive'); assert.equal(await superseded, false);
    staleLoad(); assert.equal(stage.el.dataset.frameReady, undefined, 'old load cannot mark new art ready');
    image.onload(); await stage.ready;
    stage.setStance(null); assert.equal(image.getAttribute('src'), null);
    stage.setStance('defensive'); const disposed = stage.ready, lateLoad = image.onload;
    stage.dispose(); assert.equal(await disposed, false);
    const before = assigned.length; lateLoad();
    assert.equal(stage.setStance('offensive'), false); stage.setLite(false);
    assert.equal(assigned.length, before, 'disposed stages cannot restart image work');

    // The static wrapper never overrides the original action/reaction owner.
    const host = document.createElement('div'), original = document.createElement('canvas');
    original.style.visibility = 'visible'; host.append(original);
    const wrapped = withAlternativeStance({ el: host, play: () => true, react: () => true, setRestPose() {}, dispose() {} }, 'actor', { catalog });
    wrapped.setStance('offensive'); const held = host.children[1], heldImage = held.firstElementChild;
    heldImage.onload(); await Promise.resolve();
    assert.equal(original.style.visibility, 'hidden');
    wrapped.play('attack'); wrapped.setStance('offensive');
    assert.equal(original.style.visibility, 'visible', 'repeat stance does not replace active action');
    wrapped.resumeStance(); assert.equal(original.style.visibility, 'hidden');
    wrapped.react('hit'); wrapped.setStance('offensive');
    assert.equal(original.style.visibility, 'visible', 'repeat stance does not replace active reaction');
    wrapped.resumeStance(); wrapped.setRestPose('defeated'); wrapped.setStance('offensive');
    assert.equal(original.style.visibility, 'visible', 'death remains visible');
    wrapped.dispose();
  } finally {
    for (const [key, value] of Object.entries(saved)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
});
