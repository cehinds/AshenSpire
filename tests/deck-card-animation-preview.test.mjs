import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { alternativeCardAnimations } from '../src/content/alternativeCardAnimations.js';
import { deckCardAnimationPlan, deckCardAnimationPreview } from '../src/ui/components/deckCardAnimationPreview.js';
import { rewardDom } from './helpers/reward-dom.mjs';

const registries = createRegistries(contentBundle);
const freshRun = () => createRunState({ seed: 21, classId: 'reaver', registries });
const equip = (run, right, left) => {
  for (const [slot, id] of [['rightHand', right], ['leftHand', left]]) {
    run.loadout.active[slot] = 0;
    run.loadout.sets[slot][0] = id;
  }
};

test('preview routes card types through the same class defaults as combat without mutating the run', () => {
  const run = freshRun();
  for (const [right, left, ref, technique] of [
    ['straightSword', 'roundShield', { cardId: 'strike', profileId: 'bladeAttack', sourceArmamentId: 'straightSword' }, 'attack'],
    ['straightSword', 'roundShield', { cardId: 'strike', profileId: 'shieldAttack', sourceArmamentId: 'roundShield' }, 'attack'],
    ['straightSword', 'roundShield', { cardId: 'defend', profileId: 'shieldGuard', sourceArmamentId: 'roundShield' }, 'defend'],
    ['shortbow', 'parryDagger', { cardId: 'strike', profileId: 'bowPierceAttack', sourceArmamentId: 'shortbow' }, 'ranged'],
    ['shortbow', 'parryDagger', { cardId: 'strike', profileId: 'bowPierceAttack', sourceArmamentId: 'parryDagger' }, 'ranged'],
    ['greatsword', null, { cardId: 'starstonePebble' }, 'spell'],
  ]) {
    equip(run, right, left);
    const before = structuredClone(run);
    const playback = deckCardAnimationPlan(registries, run, ref);
    assert.equal(playback.plan.technique, technique);
    assert.deepEqual(playback.frames, alternativeCardAnimations.classes.reaver.sequences[technique].poses);
    assert.equal(playback.duration, 260);
    assert.deepEqual(run, before);
  }
});

function withPreview(options, check) {
  const dom = rewardDom();
  const proto = Object.getPrototypeOf(dom.document.body);
  proto.replaceChildren = function (...nodes) { this.innerHTML = ''; this.append(...nodes); };
  const eventSource = (matches) => {
    const listeners = new Set();
    return { matches, listeners,
      addEventListener(_type, fn) { listeners.add(fn); },
      removeEventListener(_type, fn) { listeners.delete(fn); },
      change(value) { this.matches = value; for (const fn of [...listeners]) fn(); },
    };
  };
  const desktop = eventSource(options.desktop ?? true), reduced = eventSource(options.reduced ?? false);
  const visibility = new Set(), raf = new Map(), stages = [], pauses = [], observers = [];
  let serial = 0;
  dom.document.hidden = false;
  dom.document.addEventListener = (_type, fn) => visibility.add(fn);
  dom.document.removeEventListener = (_type, fn) => visibility.delete(fn);
  const globals = {
    ...dom,
    matchMedia: query => query.includes('prefers-reduced-motion') ? reduced : desktop,
    requestAnimationFrame: fn => { const id = ++serial; raf.set(id, fn); return id; },
    cancelAnimationFrame: id => raf.delete(id),
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() { this.connected = true; }
      disconnect() { this.connected = false; }
    },
  };
  const saved = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  let preview;
  try {
    const run = freshRun();
    const before = structuredClone(run);
    const ref = options.ref || { cardId: 'strike', profileId: 'bladeAttack', sourceArmamentId: 'straightSword' };
    const plan = deckCardAnimationPlan(registries, run, ref);
    preview = deckCardAnimationPreview({ registries, run, ref, paused: options.paused, onPaused: value => pauses.push(value) }, {
      createStage() {
        if (options.unavailable) return null;
        const stage = { el: document.createElement('div'), poses: plan.frames, painted: [],
          setPose(pose) { this.painted.push(pose); }, dispose() { this.disposed = true; } };
        stages.push(stage);
        return stage;
      },
    });
    document.body.append(preview.root);
    check({ preview, plan, desktop, reduced, raf, stages, pauses, observers, visibility,
      button: preview.root.querySelector('button'),
      step(time) { const callbacks = [...raf.values()]; raf.clear(); for (const fn of callbacks) fn(time); },
      hide(value) { document.hidden = value; for (const fn of [...visibility]) fn(); },
    });
    preview.dispose();
    assert.deepEqual(run, before, 'preview playback, lifecycle changes and disposal never mutate the run');
  } finally {
    preview?.dispose();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
}

test('desktop preview loops authored frames and Pause/Play preserves the exact frame and fractional time', () => {
  withPreview({}, ({ plan, stages, raf, button, pauses, step }) => {
    const stage = stages[0], dt = plan.frameMs;
    assert.equal(stage.painted.at(-1), plan.frames[0]);
    step(1000); step(1000 + dt * 2.5);
    assert.equal(stage.painted.at(-1), plan.frames[2]);
    const count = stage.painted.length;
    button.click();
    assert.equal(raf.size, 0);
    step(20000);
    assert.equal(stage.painted.length, count);
    button.click(); step(30000);
    assert.equal(stage.painted.length, count, 'resume does not jump due to paused wall time');
    step(30000 + dt * .8);
    assert.equal(stage.painted.at(-1), plan.frames[3]);
    step(30000 + dt * (plan.frames.length - 1.1));
    assert.equal(stage.painted.at(-1), plan.frames[1], 'sequence wraps without changing its order');
    assert.deepEqual(pauses, [true, false]);
  });
});

test('phone construction is lazy; desktop resize creates and disposes playback without leaking frames', () => {
  withPreview({ desktop: false }, ({ preview, stages, desktop, raf, step, plan }) => {
    assert.equal(preview.root.hidden, true);
    assert.equal(stages.length, 0);
    assert.equal(raf.size, 0);
    desktop.change(true); step(0); step(plan.frameMs * 2);
    assert.equal(stages.length, 1);
    const pose = stages[0].painted.at(-1);
    desktop.change(false);
    assert.equal(stages[0].disposed, true);
    assert.equal(raf.size, 0);
    desktop.change(true);
    assert.equal(stages[1].painted.at(-1), pose, 'resize resumes the displayed frame');
    assert.equal(raf.size, 1);
  });
});

test('visibility and live reduced-motion changes suspend playback; disposal removes owned listeners', () => {
  withPreview({}, ({ preview, stages, raf, button, reduced, desktop, visibility, observers, pauses, step, hide }) => {
    step(0); step(250);
    const frame = stages[0].painted.at(-1);
    hide(true);
    assert.equal(raf.size, 0);
    hide(false); step(20000);
    assert.equal(stages[0].painted.at(-1), frame);
    reduced.change(true);
    assert.equal(raf.size, 0);
    assert.equal(pauses.at(-1), true);
    reduced.change(false);
    assert.equal(raf.size, 0, 'a preference change cannot unexpectedly restart motion');
    button.click();
    assert.equal(raf.size, 1);
    document.body.classList.add('reduced-motion');
    observers[0].callback();
    assert.equal(raf.size, 0, 'in-game reduced motion also stops the timeline');
    preview.dispose(); preview.dispose();
    assert.equal(stages[0].disposed, true);
    assert.equal(desktop.listeners.size + reduced.listeners.size + visibility.size, 0);
    assert.equal(observers[0].connected, false);
    const prior = pauses.length;
    button.click();
    assert.equal(pauses.length, prior, 'disposed controls have no callbacks');
  });
});

test('visibility resume preserves an explicit Pause and disposal prevents future resumes', () => {
  withPreview({}, ({ preview, stages, raf, button, pauses, step, hide }) => {
    step(0); step(250);
    button.click();
    const painted = [...stages[0].painted];
    hide(true); hide(false); step(20000);
    assert.equal(raf.size, 0, 'foregrounding cannot override the player Pause');
    assert.deepEqual(stages[0].painted, painted);
    assert.deepEqual(pauses, [true], 'visibility changes emit no player action');
    preview.dispose();
    hide(true); hide(false); step(40000);
    assert.equal(raf.size, 0, 'a disposed preview cannot resume');
    assert.deepEqual(stages[0].painted, painted);
  });
});

test('reduced motion starts paused; defend cards have the authored guard sequence', () => {
  withPreview({ reduced: true }, ({ raf, stages, button }) => {
    assert.equal(raf.size, 0);
    assert.equal(stages[0].painted.length, 1);
    button.click();
    assert.equal(raf.size, 1, 'explicit Play opts into motion');
  });
  withPreview({ ref: { cardId: 'dodgeRoll' } }, ({ plan, stages, button, raf }) => {
    assert.equal(plan.plan.technique, 'defend');
    assert.equal(plan.frames.length, 5);
    assert.deepEqual(stages[0].painted, [plan.frames[0]]);
    assert.equal(button.disabled, false);
    assert.equal(raf.size, 1);
  });
  withPreview({ unavailable: true }, ({ preview, button, raf }) => {
    assert.equal(preview.root.querySelector('.deck-editor-animation-stage').hidden, true);
    assert.equal(button.disabled, true);
    assert.equal(raf.size, 0);
  });
});
