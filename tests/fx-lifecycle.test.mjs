// The FX page listeners finish presentation of committed receipts. Backgrounding
// and resuming never dispatches another action or changes authoritative state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { affordableCards } from '../tools/simbot.mjs';
import { playTimeline, setAnimSpeed } from '../src/ui/fx.js';
import { setCombatPacing } from '../src/ui/animationPace.js';
import { withKitDom } from './helpers/dom.mjs';
import { registerStage } from '../src/ui/services/PoseAnimator.js';

const PageEvent = globalThis.Event;

test('ordered FX counts real watchdog expiry while normal, cancel and skip finishes do not count', async (t) => {
  // Load a browser-scoped instance so this exercises the actual window.__fx
  // counter binding, rather than a copied hook or a test-only counter.
  const previousWindow = globalThis.window;
  const browserWindow = {};
  let browserFx;
  globalThis.window = browserWindow;
  try { browserFx = await import('../src/ui/fx.js?watchdog-counter'); }
  finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  }
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  // The scheduler's monotonic clock must advance with these mocked timers.
  t.mock.method(globalThis.performance, 'now', () => Date.now());
  setAnimSpeed('normal'); setCombatPacing();
  try {
    withKitDom((dom) => {
      for (const exit of ['normal', 'cancel', 'skip', 'watchdog']) {
        const before = { ...browserWindow.__fx };
        let completed = 0, flushes = 0;
        const handle = browserFx.playTimeline([
          { type: 'cardPlayed', cardType: 'skill', cardInstanceId: 'test-card', targetId: 'player' },
        ], { layer: dom.document.createElement('div'), anchorFor: () => null, onFlush: () => flushes++ }, () => completed++);
        if (exit === 'watchdog') handle.pauseForSkip();
        else if (exit !== 'normal') handle[exit]();
        assert.equal(browserWindow.__fx.watchdog, before.watchdog, 'starting, pausing and explicit exits do not count');
        for (let ms = 0; ms < 60000 && !handle.finished; ms++) t.mock.timers.tick(1);
        assert.equal(handle.finished, true, `${exit} finishes within its existing budget`);
        assert.equal(browserWindow.__fx.watchdog, before.watchdog + (exit === 'watchdog' ? 1 : 0));
        assert.equal(browserWindow.__fx.open, before.open + 1);
        assert.equal(browserWindow.__fx.finished, before.finished + 1);
        assert.equal(flushes, exit === 'normal' ? 0 : 1); assert.equal(completed, 1);
        handle.cancel(); handle.skip(); t.mock.timers.tick(60000);
        assert.equal(browserWindow.__fx.watchdog, before.watchdog + (exit === 'watchdog' ? 1 : 0));
        assert.equal(completed, 1, 'late timer work and repeated exits cannot complete twice');
      }
    });
  } finally { setCombatPacing(); setAnimSpeed('normal'); }
});

// Preserve Maps, cycles and function identities while copying mutable state.
function snapshot(value, seen = new Map()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const out = value instanceof Map ? new Map() : value instanceof Set ? new Set() : Array.isArray(value) ? [] : {};
  seen.set(value, out);
  if (value instanceof Map) for (const [key, entry] of value) out.set(key, snapshot(entry, seen));
  else if (value instanceof Set) for (const entry of value) out.add(snapshot(entry, seen));
  else for (const key of Object.keys(value)) out[key] = snapshot(value[key], seen);
  return out;
}

for (const exit of ['hidden', 'blur']) {
  test(`ordered FX ${exit} exit finishes once, removes listeners and preserves the committed fight on resume`, (t) => {
    const registries = createRegistries(contentBundle);
    const run = createRunState({ seed: 83, classId: 'reaver', registries });
    const combat = createRunCombat({ registries, rng: createRng(83), run, enemyIds: ['wanderingSoldier'], settings: {} });
    let receipts;
    for (const card of affordableCards(registries, combat)) {
      try {
        const result = dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id });
        if (result.events.some(event => event.type === 'cardPlayed')) { receipts = result.events; break; }
      } catch { /* A self card can refuse an enemy target. */ }
    }
    assert.ok(receipts, 'a real card has committed before presentation begins');
    assert.ok(!combat.result, 'the real fight remains in progress');
    const before = snapshot({ run, combat, receipts });
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
    // The scheduler's monotonic clock must advance with these mocked timers.
    t.mock.method(globalThis.performance, 'now', () => Date.now());
    setAnimSpeed('normal'); setCombatPacing();
    withKitDom((dom, _win, listeners) => {
      const page = new EventTarget(), documentListeners = new Set();
      dom.document.addEventListener = (type, handler, options) => {
        if (type === 'visibilitychange') documentListeners.add(handler);
        page.addEventListener(type, handler, options);
      };
      dom.document.removeEventListener = (type, handler, options) => {
        if (type === 'visibilitychange') documentListeners.delete(handler);
        page.removeEventListener(type, handler, options);
      };
      dom.document.hidden = false; dom.document.visibilityState = 'visible';
      const stages = [];
      let flushes = 0, completed = 0, applied = 0;
      const handle = playTimeline(receipts, {
        layer: dom.document.createElement('div'), anchorFor: () => null,
        onStage: stage => stages.push(stage), onFlush: () => flushes++, onBeatApplied: () => applied++,
      }, () => completed++);
      for (const event of ['pointerdown', 'pointerup', 'pointercancel', 'blur']) assert.equal(listeners.get(event)?.length, 1);
      assert.equal(documentListeners.size, 1);
      assert.equal(handle.finished, false, 'the timeline is still presenting the committed action');
      if (exit === 'blur') for (const handler of [...listeners.get('blur')]) handler(new PageEvent('blur'));
      dom.document.hidden = true; dom.document.visibilityState = 'hidden';
      page.dispatchEvent(new PageEvent('visibilitychange'));
      dom.document.hidden = false; dom.document.visibilityState = 'visible';
      page.dispatchEvent(new PageEvent('visibilitychange'));
      const afterExit = [...stages];
      t.mock.timers.tick(30000);
      assert.deepEqual(stages, afterExit, 'resuming cannot restart an abandoned stage');
      assert.equal(handle.finished, true);
      assert.equal(flushes, 1); assert.equal(completed, 1); assert.equal(applied, 0);
      for (const event of ['pointerdown', 'pointerup', 'pointercancel', 'blur']) assert.equal(listeners.get(event)?.length, 0, `${event} listener removed`);
      assert.equal(documentListeners.size, 0, 'document lifecycle listener removed');
      assert.deepEqual(snapshot({ run, combat, receipts }), before, 'HP, piles, intents, resources and committed receipts are unchanged');
    });
  });
}

for (const trigger of ['explicit cancel', 'pointerdown before observer']) {
  test(`outgoing FX ${trigger} settles only the originating combat sprites`, () => {
    withKitDom(({ document }, _, listeners) => {
      const app = document.createElement('main');
      document.body.append(app);
      function mount() {
        const combat = document.createElement('section');
        const sprite = document.createElement('div');
        const original = combat.querySelectorAll.bind(combat);
        combat.querySelectorAll = selector => selector === '.combatant .sprite' ? [sprite] : original(selector);
        combat.append(sprite);
        return { combat, sprite };
      }
      const outgoing = mount(), replacement = mount();
      app.append(outgoing.combat);
      const original = document.querySelectorAll.bind(document);
      document.querySelectorAll = selector => selector === '.combatant .sprite' ?
        [outgoing.sprite, replacement.sprite].filter(sprite => sprite.isConnected) : original(selector);
      let current = true, own = 0, unrelated = 0, flushed = 0, finished = 0;
      registerStage(outgoing.sprite, { endReaction: () => own++ });
      registerStage(replacement.sprite, { endReaction: () => unrelated++ });
      const handle = playTimeline([{ type: 'cardPlayed', cardType: 'skill', targetId: 'player' }], {
        combatEl: outgoing.combat, layer: outgoing.combat, anchorFor: () => null,
        isCurrent: trigger === 'explicit cancel' ? undefined : () => current,
        figureAnimations: false, onFlush: () => flushed++,
      }, () => finished++);
      app.replaceChildren(replacement.combat);
      current = false;
      if (trigger === 'explicit cancel') handle.cancel();
      else for (const listener of [...listeners.get('pointerdown')]) listener(new PageEvent('pointerdown'));
      assert.equal(unrelated, 0);
      assert.equal(own, 1);
      assert.equal(flushed, trigger === 'explicit cancel' ? 1 : 0);
      assert.equal(handle.finished, true);
      assert.equal(finished, 1);
      assert.equal(listeners.get('pointerdown').length, 0);
    });
  });
}
