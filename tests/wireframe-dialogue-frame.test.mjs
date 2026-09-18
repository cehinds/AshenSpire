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
  dialogueBands, dialogueCompactHost, dialogueCompactBand, dialogueHudCompact, dialogueLanes, dialogueFooterPlan, dialogueLayers,
  dialogueStack, dialogueEntrance, dialogueSceneConfig, dialogueFrameVars, dialogueResponsePlan,
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
  assert.throws(() => dialogueFrameVars(edited(W4C_LAYOUT, (l) => { l.positioning.portraits.visibleFraction = 1.25; }), W4_PARENT),
    /visibleFraction must satisfy 0 < f ≤ 1 \(got 1\.25\)/);
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
  // The placement also reports the figure's own width: the lane rule needs it,
  // and so does any instrument checking that two figures do not overlap.
  assert.deepEqual(Object.keys(placed).sort(), ['clipTo', 'scale', 'width', 'x', 'y']);
  assert.equal(placed.clipTo, null, 'nothing is cut while the config shrinks instead');
  assert.ok(near(placed.width, art.width * placed.scale), 'the reported width is the scaled art width');
  assert.ok(Object.isFrozen(placed));
});

test('closeUpPlacement reads the fraction from the layout and refuses impossible geometry', () => {
  const art = { top: 0, height: 90, centerX: 45 };
  const slot = { left: 0, top: 10, width: 60 };
  assert.ok(near(closeUpPlacement(art, slot, 40, W4C_LAYOUT).scale, 1), '30 px of reveal over a 90 px figure\'s third');
  const whole = edited(W4C_LAYOUT, (l) => { l.positioning.portraits.visibleFraction = 1; });
  assert.ok(near(closeUpPlacement(art, slot, 40, whole).scale, 1 / 3), 'a fraction of 1 fits the whole figure');
  assert.throws(() => closeUpPlacement(art, slot, 10, W4C_LAYOUT), /below the slot top/);
  assert.throws(() => closeUpPlacement({ ...art, height: 0 }, slot, 40, W4C_LAYOUT), /art.height/);
  const broken = edited(W4C_LAYOUT, (l) => { l.positioning.portraits.visibleFraction = 1.5; });
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

// ---------------------------------------------------------------------------
// THE LANE RULE (#1117). Both speakers stay wholly visible at every size.
// ---------------------------------------------------------------------------

// The four hosts the owner named, and the geometry the stylesheet gives a slot:
// the slot is inset from its own edge, is compactWidthVw wide on a compact host
// and widthVw otherwise, starts topOffsetVh below the HUD, and runs to the
// reveal line (the context band's top edge).
const HOSTS = [
  { label: '390x844', width: 390, height: 844 },
  { label: '740x372', width: 740, height: 372 },
  { label: '844x390', width: 844, height: 390 },
  { label: '1280x800', width: 1280, height: 800 },
];

// Two standing figures in the proportions the game's art has (about two fifths
// as wide as it is tall). At 1280x800 the height zoom leaves both inside their
// lanes; at 390x844 it does not, so the lane rule has to fire. A test whose
// figures never shrink, or always shrink, would prove nothing.
const FIGURES = {
  player: { top: 12, height: 300, width: 120, centerX: 60 },
  npc: { top: 8, height: 280, width: 132, centerX: 66 },
};

function frameGeometry({ width, height }, layout = W4C_LAYOUT, parent = W4_PARENT) {
  const bands = dialogueBands({ width, height, zoom: 1, rem: 16 }, layout, parent);
  const compact = dialogueCompactHost(width, parent);
  const slotWidth = width * ((compact ? layout.sizing.portraitSlot.compactWidthVw : layout.sizing.portraitSlot.widthVw) / 100);
  const inset = width * (layout.positioning.portraitSlot.insetVw / 100);
  const slotTop = bands.hud + height * (layout.positioning.portraitSlot.topOffsetVh / 100);
  return {
    bands,
    revealLine: bands.hud + bands.scene,
    lanes: dialogueLanes(width, layout),
    slots: {
      left: { left: inset, top: slotTop, width: slotWidth },
      right: { left: width - inset - slotWidth, top: slotTop, width: slotWidth },
    },
  };
}

// The figure's visible box in frame px, which is what a player sees and what a
// screenshot measures: the placement's own transform applied to the art box.
function visibleBox(art, placement) {
  return {
    left: placement.x + art.centerX * placement.scale - (art.width * placement.scale) / 2,
    right: placement.x + art.centerX * placement.scale + (art.width * placement.scale) / 2,
    top: placement.y + art.top * placement.scale,
    bottom: placement.y + (art.top + art.height) * placement.scale,
  };
}

test('at every host the two figures never share a pixel, and each stands in its own lane', () => {
  for (const host of HOSTS) {
    const { revealLine, lanes, slots } = frameGeometry(host);
    const placed = {
      left: closeUpPlacement(FIGURES.player, slots.left, revealLine, W4C_LAYOUT, lanes.left),
      right: closeUpPlacement(FIGURES.npc, slots.right, revealLine, W4C_LAYOUT, lanes.right),
    };
    const boxes = {
      left: visibleBox(FIGURES.player, placed.left),
      right: visibleBox(FIGURES.npc, placed.right),
    };
    const where = `${host.label}: `;
    assert.ok(boxes.left.right <= boxes.right.left + 1e-6, `${where}the two figures overlap`);
    for (const side of ['left', 'right']) {
      const box = boxes[side], lane = lanes[side];
      assert.ok(box.left >= lane.left - 1e-6, `${where}the ${side} figure starts before its lane`);
      assert.ok(box.right <= lane.left + lane.width + 1e-6, `${where}the ${side} figure runs past its lane`);
      assert.ok(box.left >= 0 && box.right <= host.width + 1e-6, `${where}the ${side} figure leaves the frame`);
      assert.ok(box.top >= 0, `${where}the ${side} figure starts above the frame`);
      // Its top share stands ON the reveal line: visible above the band, and
      // never hovering clear of it.
      const visibleTopShare = box.top + (box.bottom - box.top) / 3;
      assert.ok(near(visibleTopShare, revealLine, 1e-6), `${where}the ${side} figure does not stand on the reveal line`);
    }
  }
});

test('a lane is half the frame less the insets and the configured gap, and the two never meet', () => {
  const lanes = dialogueLanes(1000, W4C_LAYOUT);
  const inset = 1000 * (W4C_LAYOUT.positioning.portraitSlot.insetVw / 100);
  const gap = Math.max(1000 * (W4C_LAYOUT.positioning.portraits.minGapVw / 100), W4C_LAYOUT.positioning.portraits.minGapPx);
  assert.ok(near(lanes.left.width, (1000 - inset * 2 - gap) / 2));
  assert.ok(near(lanes.left.left, inset));
  assert.ok(near(lanes.right.left + lanes.right.width, 1000 - inset));
  assert.ok(near(lanes.right.left - (lanes.left.left + lanes.left.width), gap), 'the gap between the lanes is minGapVw');
  assert.throws(() => dialogueLanes(0, W4C_LAYOUT), /positive frame width/);
  assert.throws(
    () => dialogueLanes(100, edited(W4C_LAYOUT, (d) => { d.positioning.portraits.minGapVw = 96; })),
    /leave no lane/,
  );
});

test('a wide host keeps the height zoom; only a figure wider than its lane shrinks', () => {
  const wide = frameGeometry(HOSTS[3]);
  const narrow = frameGeometry(HOSTS[0]);
  const byHeight = (geometry, art) => (geometry.revealLine - geometry.slots.left.top) / (art.height / 3);
  const wideScale = closeUpPlacement(FIGURES.player, wide.slots.left, wide.revealLine, W4C_LAYOUT, wide.lanes.left).scale;
  assert.ok(near(wideScale, byHeight(wide, FIGURES.player)), '1280x800 is unchanged: the height rule still sets the zoom');
  const narrowScale = closeUpPlacement(FIGURES.player, narrow.slots.left, narrow.revealLine, W4C_LAYOUT, narrow.lanes.left).scale;
  assert.ok(narrowScale < byHeight(narrow, FIGURES.player), '390x844 shrinks the figure to its lane');
  assert.ok(near(narrowScale, narrow.lanes.left.width / FIGURES.player.width), 'shrunk exactly to the lane width');
});

test('the HUD folds to one line when the screen is short OR narrow, and always draws', () => {
  const compact = (width, height) => dialogueHudCompact({ width, height }, W4C_LAYOUT, W4_PARENT);
  assert.equal(compact(740, 372), true, '740x372: short');
  assert.equal(compact(390, 844), true, '390x844: narrow — two rows do not fit 94px of band');
  assert.equal(compact(844, 390), true, '844x390: short');
  assert.equal(compact(1280, 800), false, '1280x800: the band holds the HUD as it is');
});

test('the HUD draws its compact form on a short host and always draws', () => {
  // The screen's own height, not the zoomed frame's: a 740x372 screen draws a
  // 1194x600 frame, and asking the frame would call that short screen roomy.
  assert.equal(dialogueCompactBand(372, W4C_LAYOUT), true, '740x372 is short: one row');
  assert.equal(dialogueCompactBand(390, W4C_LAYOUT), true);
  assert.equal(dialogueCompactBand(800, W4C_LAYOUT), false);
  assert.equal(dialogueCompactBand(844, W4C_LAYOUT), false);
  assert.throws(
    () => dialogueCompactBand(400, edited(W4C_LAYOUT, (d) => { d.sizing.hud.compactBelowHeightPx = 0; })),
    /compactBelowHeightPx must be > 0/,
  );
  // The band is a share of the host and is never dropped, however short it is.
  for (const host of HOSTS) {
    const { bands } = frameGeometry(host);
    assert.ok(bands.hud > 0, `${host.label}: the HUD band must always have height`);
  }
});

// THE GAP'S FLOOR (#1127). A share of the frame is not a gap on a phone: at 390
// wide 1.5vw is 6.5px and the two figures read as one crowd, against 80px on a
// desktop. positioning.portraits.minGapPx is the gap's real minimum, and the
// share takes over once it is the wider of the two.
test('the gap between the lanes is never under its pixel floor, at any width', () => {
  const floor = W4C_LAYOUT.positioning.portraits.minGapPx;
  for (const host of HOSTS) {
    const { lanes } = frameGeometry(host);
    const gap = lanes.right.left - (lanes.left.left + lanes.left.width);
    assert.ok(gap >= floor - 1e-6, `${host.label}: the lanes are ${gap.toFixed(1)}px apart, under the ${floor}px floor`);
    assert.ok(lanes.left.width > 0 && lanes.right.width > 0, `${host.label}: the floor left no lane`);
  }
  // Wide frames keep the share, which is wider than the floor there.
  const wide = dialogueLanes(4000, W4C_LAYOUT);
  assert.ok(near(wide.right.left - (wide.left.left + wide.left.width), 4000 * 0.015), 'the share wins on a wide frame');
  assert.throws(
    () => dialogueLanes(400, edited(W4C_LAYOUT, (d) => { d.positioning.portraits.minGapPx = -1; })),
    /minGapPx must be ≥ 0/,
  );
});

test('the two figures are at least the floor apart at every host', () => {
  const floor = W4C_LAYOUT.positioning.portraits.minGapPx;
  for (const host of HOSTS) {
    const { revealLine, lanes, slots } = frameGeometry(host);
    const left = visibleBox(FIGURES.player, closeUpPlacement(FIGURES.player, slots.left, revealLine, W4C_LAYOUT, lanes.left));
    const right = visibleBox(FIGURES.npc, closeUpPlacement(FIGURES.npc, slots.right, revealLine, W4C_LAYOUT, lanes.right));
    assert.ok(right.left - left.right >= floor - 1e-6, `${host.label}: the figures are ${(right.left - left.right).toFixed(1)}px apart`);
  }
});

// The quest's name is drawn whole: the line it sits on is at least as tall as
// the display face needs, so the panel (which clips, for its ellipsis) cannot
// cut the ascenders (owner, 2026-09-18).
test('the title line leaves room for the display face at the configured size', () => {
  const { titleRem, titleLineHeight, paddingRem } = W4C_LAYOUT.sizing.context;
  // Cinzel reports a font box of 1.125em (ascent 0.9375 + descent 0.25).
  const faceNeeds = 1.125;
  assert.ok(titleLineHeight >= faceNeeds, `a title line of ${titleLineHeight} cannot hold a face needing ${faceNeeds}`);
  assert.ok(titleRem > 0 && paddingRem > 0);
});

// The second way to keep a figure in its lane, which the config can choose:
// the spec's zoom is kept and the lane cuts the figure's sides.
test('clipToLane keeps the spec zoom and reports the lane to cut to', () => {
  const clipping = edited(W4C_LAYOUT, (d) => { d.positioning.portraits.fit = 'clipToLane'; });
  for (const host of HOSTS) {
    const { revealLine, lanes, slots } = frameGeometry(host, clipping);
    const placed = closeUpPlacement(FIGURES.player, slots.left, revealLine, clipping, lanes.left);
    const span = revealLine - slots.left.top;
    // The top share fills slot top to reveal line, at every size.
    assert.ok(near(FIGURES.player.height * placed.scale / 3, span, 1e-6), `${host.label}: the top third does not fill the band`);
    const width = FIGURES.player.width * placed.scale;
    if (width > lanes.left.width) {
      assert.ok(placed.clipTo, `${host.label}: a figure wider than its lane must be cut to it`);
      assert.ok(near(placed.clipTo.width, lanes.left.width));
    } else {
      assert.equal(placed.clipTo, null, `${host.label}: a figure inside its lane is not cut`);
    }
  }
});

// A COMPACT HOST GETS ITS OWN BAND PLAN (#1127). The shared HUD draws two rows
// of facts, and a 10% band holds them on a desktop but not on a phone; the room
// comes from the context band, which had an empty strip under its responses.
test('a compact host takes the compact band plan, and both plans sum to 100', () => {
  const frame = { width: 433, height: 824, zoom: 1, rem: 16 };
  const roomy = dialogueBands(frame, W4C_LAYOUT, W4_PARENT, false);
  const compact = dialogueBands(frame, W4C_LAYOUT, W4_PARENT, true);
  assert.ok(near(roomy.hud, frame.height * 0.10), 'a roomy host keeps the 10% band');
  assert.ok(near(compact.hud, frame.height * 0.12), 'a compact host gets 12%');
  assert.ok(compact.hud > roomy.hud && compact.context < roomy.context, 'the room comes from the context band');
  for (const shares of [W4C_LAYOUT.sizing.bands, W4C_LAYOUT.sizing.bandsCompact]) {
    assert.equal(shares.hud + shares.scene + shares.context + shares.footer, 100);
  }
  assert.throws(
    () => dialogueBands(frame, edited(W4C_LAYOUT, (d) => { d.sizing.bandsCompact.hud = 20; }), W4_PARENT, true),
    /sum to 108, not 100/,
  );
});

// A NARROW HOST SHOWS THE WHOLE FIGURE (#1127). A third of the figure filling
// the band is a close-up a desktop can carry; half a 433px frame cannot, and
// shrinking that zoom to fit left both speakers a third of the height the spec
// asks for.
test('a narrow host shows the whole figure, filling the same band', () => {
  const host = { label: '411x783', width: 433, height: 824 };
  const { revealLine, lanes, slots } = frameGeometry(host);
  const span = revealLine - slots.left.top;
  const wide = closeUpPlacement(FIGURES.player, slots.left, revealLine, W4C_LAYOUT, lanes.left, false);
  const narrow = closeUpPlacement(FIGURES.player, slots.left, revealLine, W4C_LAYOUT, lanes.left, true);
  // What the band SHOWS is the point, not the raw zoom: the close-up shows a
  // third of a figure that had to shrink to fit its lane, and on a narrow host
  // that third is half the band. The whole-figure rule fills the band instead.
  const shown = (placement, fraction) => FIGURES.player.height * placement.scale * fraction;
  assert.ok(near(shown(narrow, 1), span, 1e-6), 'the whole figure fills slot top to reveal line');
  assert.ok(shown(narrow, 1) > shown(wide, 1 / 3), 'and it shows more of the speaker than the shrunken close-up did');
  assert.ok(FIGURES.player.width * narrow.scale <= lanes.left.width + 1e-6, 'while still inside its lane');
});
