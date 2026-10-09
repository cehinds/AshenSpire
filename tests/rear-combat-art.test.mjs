import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCombatAnimation } from '../src/model/combatAnimation.js';
import { CARD_ACTION_CLASSES, CARD_ACTIONS, durationFor, sampleSequence } from '../src/model/alternativeCardAnimation.js';
import { createStanceLedger } from '../src/model/alternativeStance.js';
import { alternativeCardAnimations as actions } from '../src/content/alternativeCardAnimations.js';
import { alternativeSelectedStances as stances } from '../src/content/alternativeSelectedStances.js';
import { ANIM_SPEEDS, getAnimSpeed, setAnimSpeed } from '../src/ui/animationPace.js';
import { getAnimSpeed as effectSpeed, setAnimSpeed as setEffectSpeed } from '../src/ui/fx.js';
import { withAlternativeArt } from '../tools/asset-pack.mjs';
import { rewardDom } from './helpers/reward-dom.mjs';
import { createAlternativeCardStage } from '../src/ui/alternativeCardStage.js';

test('rear class choreography follows resolved cards with stationary guard and ranged families', () => {
  for (const classId of CARD_ACTION_CLASSES) for (const action of CARD_ACTIONS) {
    const magical = ['spell', 'rangedMagic'].includes(action);
    const maneuver = action === 'spell' ? 'attack' : action === 'rangedMagic' ? 'ranged' : action;
    const card = { cardTags: ['maneuver:' + maneuver, 'camp:' + (magical ? 'spell' : 'physical')] };
    const plan = resolveCombatAnimation(card, [], { classId });
    assert.equal(plan.technique, action);
    assert.equal(plan.family, ['counter', 'defend'].includes(action) ? 'guard'
      : action.startsWith('ranged') ? 'projectile' : action === 'spell' ? 'spell' : 'strike');
    const sequence = actions.classes[classId].sequences[action];
    assert(sequence.poses.every(pose => actions.classes[classId].frames[pose]));
    for (const pace of Object.values(ANIM_SPEEDS).filter(Boolean)) {
      const duration = durationFor(sequence, pace);
      assert.equal(duration, pace.lungeMs);
      assert.equal(sampleSequence(sequence, duration, duration).x, 0);
      assert.equal(sampleSequence(sequence, duration / 2, duration, { reduced: true }).x, 0);
    }
  }
  setEffectSpeed('fast'); assert.equal(getAnimSpeed(), 'fast');
  setAnimSpeed('instant'); assert.equal(effectSpeed(), 'instant');
  setAnimSpeed('invalid'); assert.equal(getAnimSpeed(), 'normal');
});

test('confirmed card stances persist per player until their next turn', () => {
  const ledger = createStanceLedger();
  ledger.accept({ type: 'cardPlayed', playerId: 'one' }, { cardTags: ['maneuver:attack', 'camp:physical'] });
  ledger.accept({ type: 'cardPlayed', playerId: 'two' }, { cardTags: ['maneuver:defend', 'camp:physical'] });
  assert.deepEqual(ledger.snapshot(), { one: 'offensive', two: 'defensive' });
  ledger.accept({ type: 'hpLost', targetId: 'one' });
  assert.equal(ledger.get('one'), 'offensive');
  ledger.accept({ type: 'playerTurnStart', playerId: 'one' });
  assert.equal(ledger.get('one'), null);
  assert.equal(ledger.get('two'), 'defensive');
  ledger.accept({ type: 'combatStarted' });
  assert.deepEqual(ledger.snapshot(), {});
});

test('all action and stance frames ship with verified hashes and a common foot anchor', () => {
  const records = withAlternativeArt({ assets: {} }).assets;
  for (const catalog of [actions, stances]) for (const { frames } of Object.values(catalog.classes)) {
    for (const frame of Object.values(frames)) {
      assert.deepEqual(frame.anchor, [256, 464]);
      for (const path of [frame.path, frame.lite]) {
        assert(path.startsWith('assets-display/alternative/'), path);
        assert(records[path]?.common.bytes > 0, path);
        assert.equal(records[path].common.sha256, catalog.hashes[path.slice('assets-display/alternative/'.length)], path);
      }
    }
  }
});

test('rear stages keep fixed frame geometry and held stances during automatic counter attacks', async () => {
  const dom = rewardDom();
  const create = dom.document.createElement.bind(dom.document);
  dom.document.createElement = tag => {
    const node = create(tag);
    if (tag === 'canvas') node.getContext = () => ({
      clearRect() {}, save() {}, restore() {}, drawImage() {}, fillRect() {},
      getImageData() { return { data: new Uint8ClampedArray(4) }; },
    });
    return node;
  };
  const globals = { ...dom,
    Image: class { set src(value) { this.url = value; queueMicrotask(() => this.onload?.()); } },
    matchMedia: query => ({ matches: query.includes('max-width') }),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  };
  const saved = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  let stage;
  try {
    for (const classId of CARD_ACTION_CLASSES) {
      stage = createAlternativeCardStage(classId);
      assert.equal(await stage.ready, true);
      const dimensions = stage.el.style.cssText;
      stage.setStance('defensive');
      stage.play('attack', 260); // The reaction runtime uses this for an automatic Counter.
      assert.equal(stage.stance, 'defensive');
      stage.settle();
      assert.equal(stage.pose, 'stance-defensive');
      for (const action of CARD_ACTIONS) {
        const positions = [];
        for (const fraction of [0, .2, .4, .6, .8, 1]) {
          stage.seek(action, fraction * 260);
          const art = stage.currentArt;
          positions.push(art.left);
          assert.equal(stage.el.style.cssText, dimensions);
          assert.deepEqual([art.top, art.width, art.height], [16, 512, 512]);
          assert(!art.image.url.includes('-mobile.webp'), 'fixed foreground artwork uses the full source on phones');
        }
        if (['attack', 'smash', 'sweep'].includes(action)) assert(positions.some(x => x > 128));
        else assert(positions.every(x => x === 128), `${action} must stay anchored`);
        stage.settle();
        assert.equal(stage.currentArt.left, 128);
        assert.equal(stage.pose, 'stance-defensive');
      }
      stage.dispose();
    }
  } finally {
    stage?.dispose();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
