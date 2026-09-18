// src/ui/components/dialogueStage.js — W4c's stage adapter (WGQ0–WGQ8).
//
// Measures the W4 frame once per frame and writes what CSS places by: the four
// bands (the W4 parent's plan, DialogueModel.dialogueBands), one percent of the
// frame's width and height, the reveal line (the context band's top edge) and
// the floor line. It fits both halves of the environment plate with the
// shared W4 fitter (sceneBackdrop.js), to the scene window between the HUD
// and the context, and places each portrait's whole figure with the figure
// zoom (PortraitCropModel.closeUpPlacement). CSS owns placement; the models,
// fed the scene config (`layout`, uiConfig.scenes.w4c) and its W4 parent,
// own every number.
import {
  dialogueBands, dialogueCompactHost, dialogueHudCompact, dialogueLanes, dialogueSceneConfig, dialogueResponsePlan,
} from '../models/DialogueModel.js';
import { closeUpPlacement } from '../models/PortraitCropModel.js';
import { visibleArtBox } from './combatSpriteGeometry.js';
import { fitSceneBackdrop } from './sceneBackdrop.js';

let releaseActive = null;

// How many times, and how far apart, the stage re-measures a figure it could
// not place. Art decodes asynchronously and `complete` is true before the
// pixels can be read, so one early frame used to leave the listener invisible
// for the whole conversation (844x390 and 740x372). Bounded on purpose: this
// retries a measurement, it does not poll the screen.

// EVERY FIGURE IS PLACED ONCE ITS ART EXISTS, NOT ONCE SOMETHING ELSE HAPPENS
// TO REDRAW THE SCREEN. A portrait is measured from the opaque pixels of its
// art, so a figure measured while its image is still decoding cannot be placed
// and waits — and on a host where nothing else resizes, it waited forever: the
// listener at 844x390 and 740x372 simply never appeared, which is the one
// defect this screen must not have (owner, 2026-09-15: both characters are
// visible at every size). The stage now re-fits when the art lands.
const awaitingArt = new WeakSet();

export function wireDialogueStage(root, { layout, parent, scene }) {
  if (releaseActive) releaseActive();
  const sceneConfig = dialogueSceneConfig(layout, parent, scene);
  let frame = 0;
  let observer = null;
  let artObserver = null;

  // Each figure's host sits at the layer's origin; its placement is a
  // translate-then-scale about that origin, in the frame's local px.
  function placeFigures(rootRect, zoom, revealLine, lanes) {
    for (const portrait of root.querySelectorAll('.dialogue-portrait')) {
      const host = portrait.querySelector(':scope > .dialogue-portrait-art > *');
      const slotEl = portrait.querySelector(':scope > .dialogue-portrait-slot');
      // A figure that cannot be placed says WHY, on itself. A bare 'pending'
      // cannot be told apart from a stale one left by an earlier frame, and a
      // figure that never appears is the one defect this screen must not have.
      if (portrait.hidden) { portrait.dataset.figurePending = 'hidden'; continue; }
      if (!host) { portrait.dataset.figurePending = 'no-art-host'; portrait.dataset.figureFit = 'pending'; continue; }
      if (!slotEl) { portrait.dataset.figurePending = 'no-slot'; portrait.dataset.figureFit = 'pending'; continue; }
      host.style.transform = 'none';
      // Any image of this figure that has not decoded yet re-fits the stage when
      // it does; `once` per image, so a figure costs one listener at most.
      for (const img of host.querySelectorAll('img')) {
        if (img.complete && img.naturalWidth) continue;
        if (awaitingArt.has(img)) continue;
        awaitingArt.add(img);
        img.addEventListener('load', schedule, { once: true });
        img.addEventListener('error', schedule, { once: true });
        // ASK for the pixels rather than waiting to be told. The figure's art
        // is hidden until it is placed, and a conversation redraws its
        // portraits as it moves, so an image can sit undecoded while nothing
        // else on the screen changes — which is how the listener went missing
        // at 844x390 and 740x372.
        img.loading = 'eager';
        img.decode?.().then(schedule, schedule);
      }
      const artBox = visibleArtBox(host, schedule);
      const box = slotEl.getBoundingClientRect();
      const slot = { left: (box.left - rootRect.left) / zoom, top: (box.top - rootRect.top) / zoom, width: box.width / zoom };
      // A FIGURE IS DRAWN NOW, NOT WHEN ITS PIXELS ARE CONVENIENT. Placement is
      // measured from the art's opaque pixels, which cannot be read until the
      // image decodes — but a character who never appears is the one outcome
      // this screen may not have (owner, 2026-09-15: both are visible at every
      // size). So an unmeasurable figure is placed from the box it occupies
      // straight away, and refined the moment its art can be measured: the
      // listeners above, the portrait observer and a resize all re-run this.
      // Waiting instead is what left the listener missing at 844x390.
      if (!(slot.width > 0) || !(revealLine > slot.top)) {
        portrait.dataset.figurePending = !(slot.width > 0) ? 'slot-has-no-width' : 'reveal-line-above-slot';
        portrait.dataset.figureFit = 'pending';
        continue;
      }
      if (!artBox) portrait.dataset.figurePending = 'placed-from-its-own-box';
      const measured = artBox || { top: 0, height: Math.max(1, host.offsetHeight), centerX: host.offsetWidth / 2, width: Math.max(1, host.offsetWidth) };
      // Each side keeps to its own lane, so the two figures cannot overlap
      // however narrow the host is (DialogueModel.dialogueLanes).
      const lane = portrait.dataset.side === 'right' ? lanes.right : lanes.left;
      const placement = closeUpPlacement(measured, slot, revealLine, layout, lane);
      host.style.transform = `translate(${placement.x}px, ${placement.y}px) scale(${placement.scale})`;
      portrait.dataset.figureFit = 'fitted';
      if (artBox) delete portrait.dataset.figurePending;
      portrait.dataset.figureScale = String(placement.scale);
      // The VISIBLE figure's box in frame px, published so an instrument (and a
      // person reading the DOM) can check what the owner asked for — that the
      // two figures never overlap — without re-deriving the transform or
      // measuring the art element, whose box includes transparent padding.
      if (placement.width != null) {
        portrait.dataset.figureWidth = String(placement.width);
        const centre = placement.x + measured.centerX * placement.scale;
        const box = {
          left: centre - placement.width / 2,
          right: centre + placement.width / 2,
          top: placement.y + measured.top * placement.scale,
          bottom: placement.y + (measured.top + measured.height) * placement.scale,
        };
        portrait.dataset.figureBox = [box.left, box.top, box.right, box.bottom].map((v) => Math.round(v * 100) / 100).join(',');
        portrait.dataset.figureLane = [lane.left, lane.left + lane.width].map((v) => Math.round(v * 100) / 100).join(',');
      }
    }
  }

  function applyResponseLayout(region, candidate) {
    region.dataset.responsePlacement = candidate.placement;
    region.style.setProperty('--dialogue-response-columns', String(candidate.columns));
    if (candidate.textShare == null) region.style.removeProperty('--dialogue-beside-text');
    else region.style.setProperty('--dialogue-beside-text', String(candidate.textShare));
  }

  // The context band shows behavior.maxVisibleResponses responses without
  // scrolling (DialogueModel.dialogueResponsePlan). With any further responses
  // set aside, the first of the layout's response grids whose band content
  // fits is used; only responses past the maximum then scroll the band.
  function fitResponses() {
    const region = root.querySelector('.dialogue-region');
    const box = region?.querySelector(':scope > .dialogue-responses');
    if (!region || !box) return;
    const buttons = [...box.children];
    const plan = dialogueResponsePlan(layout, buttons.length);
    region.dataset.responseScroll = String(plan.scrolls);
    if (!buttons.length || region.closest('[hidden]') || !(region.clientHeight > 0)) {
      applyResponseLayout(region, plan.candidates[0]);
      return;
    }
    buttons.forEach((button, index) => { if (index >= plan.visible) button.style.display = 'none'; });
    let chosen = plan.candidates[plan.candidates.length - 1];
    let fits = false;
    for (const candidate of plan.candidates) {
      applyResponseLayout(region, candidate);
      if (region.scrollHeight <= region.clientHeight) { chosen = candidate; fits = true; break; }
    }
    applyResponseLayout(region, chosen);
    buttons.forEach((button) => button.style.removeProperty('display'));
    region.dataset.responseLayout = `${chosen.columns}:${chosen.placement}`;
    region.dataset.responseFits = String(fits);
  }

  function apply() {
    frame = 0;
    if (!root.isConnected) { release(); return; }
    const rect = root.getBoundingClientRect();
    const zoom = rect.width / root.clientWidth || 1;
    const rem = Math.max(16 / zoom, parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    const width = root.clientWidth, height = root.clientHeight;
    if (!(width > 0) || !(height > 0)) return;
    const bands = dialogueBands({ width, height, zoom, rem }, layout, parent);
    root.style.setProperty('--w4-vw', `${width / 100}px`);
    root.style.setProperty('--w4-vh', `${height / 100}px`);
    root.style.setProperty('--w4-band-hud', `${bands.hud}px`);
    root.style.setProperty('--w4-band-scene', `${bands.scene}px`);
    root.style.setProperty('--w4-band-context', `${bands.context}px`);
    root.style.setProperty('--w4-band-footer', `${bands.footer}px`);
    root.dataset.w4Geometry = bands.supported ? 'supported' : 'unsupported';
    root.dataset.dialogueCompact = String(dialogueCompactHost(window.innerWidth, parent));
    // A short host draws the HUD's one-row compact form. The band itself never
    // gives way: it is always drawn (owner, 2026-09-15).
    root.dataset.hudCompact = String(dialogueHudCompact({ width: window.innerWidth, height: window.innerHeight }, layout, parent));
    const revealLine = bands.hud + bands.scene;
    root.style.setProperty('--dialogue-reveal-line', `${revealLine}px`);
    // The plate is fitted to the scene window and drawn over the whole frame;
    // its skybox and floor halves are two copies cut at the floor line.
    let floorLine = bands.hud + bands.scene * (1 - sceneConfig.floorFraction);
    for (const backdrop of root.querySelectorAll(':scope > .dialogue-plate-layer > .environment-backdrop')) {
      const layers = fitSceneBackdrop(backdrop, {
        width, height, zoom, windowTop: bands.hud, windowHeight: bands.scene, config: sceneConfig,
      });
      if (layers) floorLine = layers.frame.floorLine;
    }
    root.style.setProperty('--dialogue-floor-line', `${floorLine}px`);
    root.dataset.floorLine = String(floorLine);
    placeFigures(rect, zoom, revealLine, dialogueLanes(width, layout));
    fitResponses();
  }

  // ResizeObserver delivers during layout; defer writes to the next frame.
  function schedule() { if (!frame) frame = requestAnimationFrame(apply); }
  function release() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    observer = null;
    artObserver?.disconnect();
    artObserver = null;
    window.removeEventListener('resize', schedule);
    if (releaseActive === release) releaseActive = null;
  }
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(schedule);
    observer.observe(root);
  }
  // THE SCREEN REDRAWS ITS PORTRAITS AS THE CONVERSATION MOVES — a new beat
  // swaps who is speaking, and the figure elements are replaced under the
  // stage. Nothing about that is a resize, so the stage used to keep the
  // placement it made for elements that no longer exist, and a figure whose
  // art arrived with the new markup stayed unplaced for the rest of the scene.
  // The portrait layer is watched, and a change re-measures with a fresh
  // retry budget.
  const portraitLayer = root.querySelector('.dialogue-portraits') || root;
  if (typeof MutationObserver !== 'undefined') {
    // A redraw re-measures; it does NOT refill the retry budget. An animated
    // figure mutates continuously, so a budget that refilled on every mutation
    // never ran out — and the fallback that guarantees a visible figure could
    // never be reached (844x390, where the listener animates).
    artObserver = new MutationObserver(schedule);
    artObserver.observe(portraitLayer, { childList: true, subtree: true });
  }
  window.addEventListener('resize', schedule);
  // Text heights settle once the fonts land; the response grid refits then.
  document.fonts?.ready?.then(() => { if (root.isConnected) schedule(); });
  releaseActive = release;
  apply();
  return Object.freeze({ apply, release, fitResponses });
}
