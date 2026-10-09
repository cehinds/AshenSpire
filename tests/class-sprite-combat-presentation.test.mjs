import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { equippedPieces } from '../src/model/loadout.js';
import { equipmentAnimationForLoadout, animationClip } from '../src/model/equipmentAnimation.js';
import { resolveCombatAnimation } from '../src/model/combatAnimation.js';
import { resolveCombatPose } from '../src/model/combatPose.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';

// Exercise the actual sprite factory and painted stage, rather than reproducing
// the still-routing condition. Art decoding and browser painting remain native QA.
class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {};
    this.attrs = {}; this.className = ''; this.style = { setProperty() {}, removeProperty() {} };
    this.classList = { contains: name => this.className.split(' ').includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...names])].join(' '); } };
  }
  setAttribute(name, value) { this.attrs[name] = String(value); if (name === 'src') this.src = String(value); }
  getAttribute(name) { return name === 'src' ? this.src ?? null : this.attrs[name] ?? null; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  addEventListener() {}
  getAnimations() { return []; }
  animate() { return { cancel() {} }; }
  cloneNode() { const copy = new Element(this.tagName); copy.className = this.className; copy.src = this.src; return copy; }
  querySelector(selector) {
    for (const child of this.children) {
      if (selector === 'img' && child.tagName === 'IMG') return child;
      const match = child.querySelector(selector); if (match) return match;
    }
    return null;
  }
}
globalThis.document = { createElement: tag => new Element(tag), documentElement: new Element('html'), body: new Element('body') };
globalThis.window = globalThis;
globalThis.matchMedia = () => ({ matches: false });
globalThis.getComputedStyle = element => ({ opacity: element.style.opacity || '0' });
const { classSprite } = await import('../src/ui/assets.js');
const { stageFor } = await import('../src/ui/services/PoseAnimator.js');

const registries = createRegistries(contentBundle);
function fixture() {
  const run = createRunState({ registries, seed: 11, classId: 'reaver', combatExpansionVersion: 2 });
  const card = run.deck.find(card => card.cardId === 'shieldBash' && card.grantedBy === 'roundShield');
  assert.ok(card, 'the production starter mounted Shield Bash');
  card.abilityRank = 1;
  const animation = equipmentAnimationForLoadout(registries, run.loadout, run.class);
  assert.equal(animation.setId, 'reaverSwordShield');
  const context = { registries, player: run, combatExpansionVersion: 2, breakMeterVersion: 2 };
  return { run, card, animation, context };
}
function sprite(animation, style = 'animated', view = 'combat') {
  return classSprite('reaver', '#c9a227', null, 'gold', style, null, 'default', { animation, view });
}

test('actual Classic animated combat stage plays mounted Shield Counter and settles at its shield guard', () => {
  const { run, card, animation, context } = fixture();
  const before = structuredClone({ run, card });
  const definition = resolveCombatCard(context, card, { upcastTier: 2 });
  const plan = resolveCombatAnimation(definition, equippedPieces(registries, run.loadout, run.class),
    { combatExpansionVersion: 2, classId: run.class, appearance: 'classic' });
  assert.deepEqual([plan.group, plan.technique, plan.rest], ['defend', 'shieldGuard', 'shieldGuard']);
  const host = sprite(animation); const stage = stageFor(host);
  try {
    assert.ok(stage.el.classList.contains('painted-stage'));
    assert.equal(stage.el.classList.contains('rendered-stage'), false);
    assert.equal(stage.animationSetId, animation.setId);
    assert.equal(stage.play(plan.technique, 260), true, 'normal combat can play its authored equipment sequence');
    assert.equal(stage.pose, 'shieldGuard1', 'painted Shield Guard uses its authored technique sequence');
    stage.setRestPose(resolveCombatPose({ hp: 20 }, plan.rest), { immediate: true });
    assert.equal(stage.rest, 'shieldGuard');
    assert.equal(stage.pose, 'shieldGuard3');
    assert.deepEqual({ run, card }, before, 'sprite presentation never edits the mounted card or run');
  } finally { stage.dispose(); }
});

test('actual Classic combat Spell Counter can play casting before the configured ready rest', () => {
  const { run, animation, context } = fixture();
  const definition = resolveCombatCard(context, { cardId: 'barrageCounter' });
  const plan = resolveCombatAnimation(definition, equippedPieces(registries, run.loadout, run.class),
    { combatExpansionVersion: 2, classId: run.class, appearance: 'classic' });
  assert.deepEqual([plan.group, plan.technique, plan.rest], ['cast', 'cast', 'cast']);
  const stage = stageFor(sprite(animation));
  try {
    assert.equal(stage.play(plan.technique, 260), true);
    assert.equal(stage.pose, animationClip(animation, 'cast').frames[0]);
    stage.setRestPose(resolveCombatPose({ hp: 20 }, plan.rest), { immediate: true });
    stage.settle(); // The combat flush preserves a playing cast until its action finishes.
    assert.equal(stage.rest, 'idle', 'casting is a transient action, not a persistent resting pose');
    assert.equal(stage.pose, animationClip(animation, 'idle').frames.at(-1));
  } finally { stage.dispose(); }
});

for (const view of ['portrait', 'menu', 'stand']) test(`animated ${view} presentation remains a still stage`, () => {
  const { animation } = fixture(); const stage = stageFor(sprite(animation, 'animated', view));
  try {
    assert.ok(stage.el.classList.contains('rendered-stage'));
    assert.equal(stage.play('shieldGuard', 260), false);
    stage.setRestPose('shieldGuard');
    assert.equal(stage.pose, 'idle');
  } finally { stage.dispose(); }
});

test('explicit rendered combat remains still while an ordinary animated sprite remains live', () => {
  const { animation } = fixture();
  const still = stageFor(sprite(animation, 'rendered', 'combat'));
  const live = stageFor(classSprite('reaver', '#c9a227', null, 'gold', 'animated', null, 'default', { animation }));
  try {
    assert.ok(still.el.classList.contains('rendered-stage'));
    assert.equal(still.play('cast', 260), false);
    assert.ok(live.el.classList.contains('painted-stage'));
    assert.equal(live.play('shieldGuard', 260), true);
  } finally { still.dispose(); live.dispose(); }
});
