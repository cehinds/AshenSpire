// tests/wireframe-dialogue-frame.test.mjs — W4c's frame, headless: the W4
// parent's shared band plan (and that combat's is unchanged by it), the
// dialogue's bands, layers, stack, entrance and footer, the plate fitted to
// the scene window, and the figure zoom. Every model takes its scene config as
// a parameter, so these tests pin behaviour to fixture configs in the
// resolved uiConfig.scenes shape (tests/fixtures/w4-scene-layouts.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateCombatBands, allocateSceneBands } from '../src/ui/models/CombatLayout.js';
import { closeUpPlacement } from '../src/ui/models/PortraitCropModel.js';
import {
  dialogueBands, dialogueCompactHost, dialogueFooterPlan, dialogueLayers, dialogueStack, dialogueEntrance,
  dialogueSceneConfig, dialogueFrameVars, dialogueResponsePlan,
} from '../src/ui/models/DialogueModel.js';
import { sceneLayers, sceneWindowLayers } from '../src/ui/models/SceneLayerModel.js';
import { ENVIRONMENTS } from '../src/content/environments.js';
import { wireframeUi } from '../src/content/wireframeUi.js';
import { w4Parent, w4cLayout } from '../src/ui/sceneConfig.js';
import { W4_PARENT, W4C_LAYOUT, edited } from './fixtures/w4-scene-layouts.mjs';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const LAYER_IDS = ['skybox', 'floor', 'playerPortrait', 'npcPortrait', 'context', 'hud', 'footer'];

// ---------------------------------------------------------------------------
// The W4 parent's bands
// ---------------------------------------------------------------------------

// allocateCombatBands' stacked plan as it stood before the W4 extraction.
function legacyStacked({ height, zoom = 1, rem = 16 }, config = wireframeUi) {
  const shares = config.combat.bands.map((value) => value / 100);
  const [hudShare, , handShare, footerShare] = shares;
  const hud = height * hudShare;
  const hand = Math.max(height * handShare, config.hand.minimumHeightPx / zoom);
  const footer = Math.max(height * footerShare, config.combat.footerMinimumPx / zoom);
  const remaining = height - hud - hand - footer;
  const minimumBattlefield = config.formation.minimumSpritePx / zoom + config.formation.detailReserveRem * rem;
  return {
    hud, battlefield: Math.max(0, remaining), hand, footer, minimumBattlefield,
    arrangement: 'stacked', rails: null, supported: remaining >= minimumBattlefield,
  };
}

test('the shared W4 plan is a pure refactor: combat\'s stacked bands are identical', () => {
  for (const height of [300, 390, 480, 667, 700, 780, 800, 844, 860, 1080, 2000]) {
    for (const zoom of [0.67, 1, 1.25, 1.5]) {
      const local = height / zoom, rem = 16 / zoom;
      assert.deepStrictEqual({ ...allocateCombatBands({ height: local, zoom, rem }) }, legacyStacked({ height: local, zoom, rem }),
        `stacked ${height}@${zoom}`);
    }
  }
  // A host whose stacked plan fits never reaches the rails, whatever its width.
  for (const [width, height] of [[1280, 800], [390, 844], [1920, 1080]]) {
    assert.deepStrictEqual({ ...allocateCombatBands({ width, height }) }, legacyStacked({ height }), `${width}x${height}`);
  }
  // Short landscape still folds into rails with the band heights in px.
  const rails = allocateCombatBands({ width: 844, height: 390 });
  assert.equal(rails.arrangement, 'rails');
  assert.ok(near(rails.hud, 39) && near(rails.hud + rails.battlefield + rails.hand, 390), 'rails keep the HUD band in px');
});

test('allocateSceneBands reads a scene config and its parent; the scene absorbs the shortfall', () => {
  const plan = allocateSceneBands({ height: 1000 }, W4C_LAYOUT, W4_PARENT);
  assert.deepEqual([plan.hud, plan.scene, plan.context, plan.footer], [100, 400, 350, 150]);
  const short = allocateSceneBands({ height: 300 }, W4C_LAYOUT, W4_PARENT, { contextPx: 120 });
  assert.ok(near(short.footer, 56) && near(short.context, 120) && near(short.hud, 30));
  assert.ok(near(short.scene, 300 - 30 - 120 - 56), 'only the scene gave up height');
  assert.ok(near(allocateSceneBands({ height: 200, zoom: 1.5 }, W4C_LAYOUT, W4_PARENT).footer * 1.5, 56), 'the floor is physical px');
  const broken = edited(W4C_LAYOUT, (l) => { l.sizing.bands.footer = 20; });
  assert.throws(() => allocateSceneBands({ height: 800 }, broken, W4_PARENT, { label: 'dialogue' }), /dialogue bands must be four shares summing to 100/);
  assert.equal(allocateSceneBands({ height: 800 }, W4C_LAYOUT, W4_PARENT, { scenePx: 400 }).supported, false, 'a scene below its floor is reported');
});

// ---------------------------------------------------------------------------
// W4c: bands, layers, stack, entrance, footer
// ---------------------------------------------------------------------------

test('W4c takes 10/40/35/15 of each host; the footer keeps 56 physical px', () => {
  const at = (width, height, zoom = 1) => dialogueBands({ width: width / zoom, height: height / zoom, zoom, rem: 16 / zoom }, W4C_LAYOUT, W4_PARENT);
  const rounded = (plan) => [plan.hud, plan.scene, plan.context, plan.footer].map((v) => +v.toFixed(4));
  assert.deepEqual(rounded(at(1280, 800)), [80, 320, 280, 120]);
  assert.deepEqual(rounded(at(390, 844)), [84.4, 337.6, 295.4, 126.6]);
  assert.deepEqual(rounded(at(844, 390)), [39, 156, 136.5, 58.5]);
  const short = at(1280, 300);
  assert.ok(near(short.footer, 56) && near(short.scene, 300 - 30 - 105 - 56), 'the scene absorbs the footer floor');
  assert.ok(near(at(1280, 300, 1.5).footer * 1.5, 56));
});

test('compact hosts are those narrower than the parent\'s compactBelowPx', () => {
  assert.deepEqual([390, 767, 768, 844, 1280].map((width) => dialogueCompactHost(width, W4_PARENT)), [true, true, false, false, false]);
});

test('the footer gives each of its actions an equal share after the insets and gaps', () => {
  const plan = dialogueFooterPlan(W4C_LAYOUT);
  assert.deepEqual([...plan.actions], ['back', 'skipSpeech', 'continue']);
  assert.ok(near(plan.actionWidthVw, 92 / 3) && plan.actionWidthVw.toFixed(2) === '30.67');
  assert.ok(near(plan.actionWidthVw * plan.count + plan.gapVw * (plan.count - 1) + plan.insetVw * 2, 100));
  const two = dialogueFooterPlan(edited(W4C_LAYOUT, (l) => { l.components.footer.actions = ['back', 'continue']; }));
  assert.ok(near(two.actionWidthVw, (100 - 5 - 1.5) / 2), 'the share follows the action count');
});

test('every layer switches on its own, and the plate halves also answer to the scene toggles', () => {
  const all = dialogueLayers(W4C_LAYOUT, {}, wireframeUi.scene);
  assert.ok(LAYER_IDS.every((name) => all[name] === true), 'all layers on in the fixture');
  for (const name of LAYER_IDS) {
    const one = dialogueLayers(W4C_LAYOUT, { [name]: false }, wireframeUi.scene);
    assert.deepEqual(LAYER_IDS.filter((layer) => !one[layer]), [name], `${name} alone switches off`);
  }
  const hudless = edited(W4C_LAYOUT, (l) => { l.layering.layers.find((layer) => layer.id === 'hud').enabled = false; });
  assert.equal(dialogueLayers(hudless, {}, wireframeUi.scene).hud, false, 'layers[].enabled is the switch');
  assert.equal(dialogueLayers(W4C_LAYOUT, {}, { ...wireframeUi.scene, skyline: false }).skybox, false);
  assert.equal(dialogueLayers(W4C_LAYOUT, {}, { ...wireframeUi.scene, floor: false }).floor, false);
  assert.throws(() => dialogueLayers(W4C_LAYOUT, { sky: false }), /Unknown dialogue layer 'sky'/);
  assert.throws(() => dialogueLayers(W4C_LAYOUT, { hud: 'no' }), /true or false/);
  assert.ok(Object.isFrozen(all));
});

test('the stack is layering.layers sorted by z, the speaker lifted inside the portraits', () => {
  const stack = dialogueStack(W4C_LAYOUT);
  assert.deepEqual([...stack.order], LAYER_IDS);
  assert.equal(stack.portraitsZ, 4);
  assert.equal(stack.speakerLift, 1);
  assert.ok(stack.z.floor < stack.portraitsZ && stack.portraitsZ < stack.z.context && stack.z.context < stack.z.hud);
  const reordered = edited(W4C_LAYOUT, (l) => { l.layering.layers.reverse(); l.layering.speakerAbove = false; });
  assert.deepEqual([...dialogueStack(reordered).order].slice(0, 2), ['skybox', 'floor'], 'order comes from z, not list order');
  assert.equal(dialogueStack(reordered).speakerLift, 0);
});

test('the entrance plays motion.entrance, and the controls open when the last step has appeared', () => {
  const played = dialogueEntrance(W4C_LAYOUT);
  assert.equal(played.animated, true);
  assert.deepEqual(played.steps.map((step) => [[...step.layers], step.atMs, step.fadeMs, step.riseVh]), [
    [['skybox', 'floor', 'hud', 'footer'], 0, 0, 0],
    [['playerPortrait', 'npcPortrait'], 0, 400, 0],
    [['context'], 400, 300, 2],
  ]);
  assert.equal(played.readyAtMs, 700, 'max(atMs + fadeMs)');
  const slower = edited(W4C_LAYOUT, (l) => { l.motion.entrance[2].fadeMs = 500; });
  assert.equal(dialogueEntrance(slower).readyAtMs, 900, 'derived from the steps, never stored');
  for (const quiet of [dialogueEntrance(W4C_LAYOUT, { reducedMotion: true }), dialogueEntrance(W4C_LAYOUT, { replay: false })]) {
    assert.equal(quiet.animated, false);
    assert.equal(quiet.readyAtMs, 0, 'reduced motion and a remount show every layer at once');
    assert.ok(quiet.steps.every((step) => step.atMs === 0 && step.fadeMs === 0 && step.riseVh === 0));
  }
});

test('the frame vars refuse a config that cannot draw, by name', () => {
  assert.throws(() => dialogueFrameVars(edited(W4C_LAYOUT, (l) => { l.sizing.bands.footer = 20; }), W4_PARENT), /bands must sum to 100 \(got 105\)/);
  assert.throws(() => dialogueFrameVars(edited(W4C_LAYOUT, (l) => { l.positioning.portraits.visibleFraction = { numerator: 4, denominator: 3 }; }), W4_PARENT),
    /visibleFraction must satisfy 0 < numerator\/denominator ≤ 1 \(got 4\/3\)/);
  assert.throws(() => dialogueFrameVars(edited(W4C_LAYOUT, (l) => { l.sizing.context.captionLines = 1.5; }), W4_PARENT), /captionLines/);
  assert.throws(() => dialogueFooterPlan(edited(W4C_LAYOUT, (l) => { l.positioning.footer.gapVw = 60; })), /no room/);
});

// ---------------------------------------------------------------------------
// The plate: fitted to the scene window, continued behind the bands
// ---------------------------------------------------------------------------

test('the dialogue floor is the layout\'s floorPercent of its scene window; combat keeps its own', () => {
  const config = dialogueSceneConfig(W4C_LAYOUT, W4_PARENT, wireframeUi.scene);
  assert.equal(config.floorFraction, 0.6);
  assert.equal(config.bleedFraction, W4_PARENT.layering.plate.bleedFraction);
  assert.equal(wireframeUi.scene.floorFraction, 0.8, 'combat\'s battlefield is untouched');
  assert.deepEqual({ ...config, floorFraction: wireframeUi.scene.floorFraction }, { ...wireframeUi.scene });
});

test('the plate is fitted to the scene window and runs on behind the frame\'s other bands', () => {
  const scene = ENVIRONMENTS.flatMap((region) => region.scenes).find((row) => row.box && row.floorStart > 0 && row.floorStart < 1);
  assert.ok(scene, 'a shipped scene with a painted ground line');
  const config = dialogueSceneConfig(W4C_LAYOUT, W4_PARENT, wireframeUi.scene);
  for (const [width, height] of [[1280, 800], [390, 844], [844, 390]]) {
    const bands = dialogueBands({ width, height }, W4C_LAYOUT, W4_PARENT);
    const framed = sceneWindowLayers({ width, height, windowTop: bands.hud, windowHeight: bands.scene, scene, config });
    const window = sceneLayers({ width, height: bands.scene, scene, config });
    const [x, y, w] = window.skyline.viewBox;
    const scale = window.skyline.scale;
    assert.ok(framed.aligned, `${width}x${height} aligns the ground line`);
    assert.ok(near(framed.frame.floorLine, bands.hud + bands.scene * (1 - 0.6)), 'floor line: window top + 40% of the window');
    if (width === 1280) assert.ok(near(framed.frame.floorLine, 208), 'y 208 at 1280x800');
    const [fx, fy, fw, fh] = framed.frame.viewBox;
    assert.ok(near(fx, x) && near(fw, w), 'the same horizontal crop and scale as the window fit');
    assert.ok(near(fy, y - bands.hud / scale), 'extended up behind the HUD');
    assert.ok(near(fh, height / scale) && near(fw / fh, width / height), 'and down behind the context and footer');
  }
  const whole = sceneWindowLayers({ width: 1280, height: 800, scene });
  assert.deepEqual([...whole.frame.viewBox], [...sceneLayers({ width: 1280, height: 800, scene }).skyline.viewBox], 'a window that is the whole box is combat\'s fit');
});

// ---------------------------------------------------------------------------
// The figure zoom
// ---------------------------------------------------------------------------

test('closeUpPlacement zooms the whole figure so its visible fraction spans slot top to reveal line', () => {
  const art = { top: 20, height: 300, centerX: 60, width: 100 };
  const slot = { left: 32, top: 96, width: 256 };
  const revealLine = 400;
  const placed = closeUpPlacement(art, slot, revealLine, W4C_LAYOUT);
  assert.ok(near(placed.scale, 304 / 100), 'W4c shows the top third');
  assert.ok(near(placed.y + art.top * placed.scale, slot.top), 'the visible top sits on the slot top');
  assert.ok(near(placed.y + (art.top + art.height / 3) * placed.scale, revealLine), 'the top third ends on the reveal line');
  assert.ok(near(placed.x + art.centerX * placed.scale, slot.left + slot.width / 2), 'centred on the slot');
  assert.ok(placed.y + (art.top + art.height) * placed.scale > revealLine, 'the lower two thirds run on under the context band');
  assert.deepEqual(Object.keys(placed).sort(), ['scale', 'x', 'y']);
  assert.ok(Object.isFrozen(placed));
});

test('closeUpPlacement reads the fraction from the layout and refuses impossible geometry', () => {
  const art = { top: 0, height: 90, centerX: 45 };
  const slot = { left: 0, top: 10, width: 60 };
  assert.ok(near(closeUpPlacement(art, slot, 40, W4C_LAYOUT).scale, 1), '30 px of reveal over a 90 px figure\'s third');
  const whole = edited(W4C_LAYOUT, (l) => { l.positioning.portraits.visibleFraction = { numerator: 1, denominator: 1 }; });
  assert.ok(near(closeUpPlacement(art, slot, 40, whole).scale, 1 / 3), 'a fraction of 1 fits the whole figure');
  assert.throws(() => closeUpPlacement(art, slot, 10, W4C_LAYOUT), /below the slot top/);
  assert.throws(() => closeUpPlacement({ ...art, height: 0 }, slot, 40, W4C_LAYOUT), /art.height/);
  const broken = edited(W4C_LAYOUT, (l) => { l.positioning.portraits.visibleFraction = { numerator: 3, denominator: 2 }; });
  assert.throws(() => closeUpPlacement(art, slot, 40, broken), /visibleFraction must satisfy/);
  assert.throws(() => closeUpPlacement(art, slot, 40), /visibleFraction must satisfy/, 'no layout, no fraction');
  assert.throws(() => closeUpPlacement(null, slot, 40, W4C_LAYOUT), /needs the art box/);
});

test('up to maxVisibleResponses responses are planned to show; only more scroll', () => {
  const four = dialogueResponsePlan(W4C_LAYOUT, 4);
  assert.deepEqual([four.maxVisible, four.visible, four.scrolls], [4, 4, false]);
  assert.deepEqual(four.candidates.map((c) => [c.columns, c.placement, c.rows]), [[1, 'below', 4], [2, 'below', 2], [2, 'beside', 2]]);
  assert.equal(four.candidates[2].textShare, 0.45);
  const five = dialogueResponsePlan(W4C_LAYOUT, 5);
  assert.deepEqual([five.visible, five.scrolls], [4, true], 'the fifth response is what scrolls');
  assert.deepEqual(five.candidates.map((c) => c.rows), [4, 2, 2], 'layouts are planned for the visible four');
  assert.deepEqual([dialogueResponsePlan(W4C_LAYOUT, 0).visible, dialogueResponsePlan(W4C_LAYOUT, 0).scrolls], [0, false]);
  assert.throws(() => dialogueResponsePlan(edited(W4C_LAYOUT, (l) => { l.behavior.maxVisibleResponses = 0; }), 4), /maxVisibleResponses/);
  assert.throws(() => dialogueResponsePlan(edited(W4C_LAYOUT, (l) => { l.behavior.responseLayouts = []; }), 4), /at least one layout/);
  assert.throws(() => dialogueResponsePlan(edited(W4C_LAYOUT, (l) => { l.behavior.responseLayouts[0].placement = 'above'; }), 4), /placement must be one of below, beside/);
  assert.throws(() => dialogueResponsePlan(edited(W4C_LAYOUT, (l) => { l.behavior.responseLayouts[2].textShare = 1.2; }), 4), /textShare/);
  assert.throws(() => dialogueFrameVars(edited(W4C_LAYOUT, (l) => { l.sizing.responses.maxLines = 0; }), W4_PARENT), /maxLines/);
});

// ---------------------------------------------------------------------------
// The seam
// ---------------------------------------------------------------------------

test('the screen\'s scene config has the fixture\'s shape and draws', () => {
  const layout = w4cLayout();
  const parent = w4Parent();
  for (const key of ['sizing', 'positioning', 'layering', 'motion', 'components']) assert.ok(layout[key], `w4c.${key}`);
  assert.ok(parent.sizing.minimums && parent.sizing.compactBelowPx > 0);
  assert.doesNotThrow(() => dialogueFrameVars(layout, parent));
  assert.deepEqual([...dialogueStack(layout).order], LAYER_IDS);
});
