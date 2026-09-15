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
import { dialogueBands, dialogueCompactHost, dialogueSceneConfig } from '../models/DialogueModel.js';
import { closeUpPlacement } from '../models/PortraitCropModel.js';
import { visibleArtBox } from './combatSpriteGeometry.js';
import { fitSceneBackdrop } from './sceneBackdrop.js';

let releaseActive = null;

export function wireDialogueStage(root, { layout, parent, scene }) {
  if (releaseActive) releaseActive();
  const sceneConfig = dialogueSceneConfig(layout, parent, scene);
  let frame = 0;
  let observer = null;

  // Each figure's host sits at the layer's origin; its placement is a
  // translate-then-scale about that origin, in the frame's local px.
  function placeFigures(rootRect, zoom, revealLine) {
    for (const portrait of root.querySelectorAll('.dialogue-portrait')) {
      const host = portrait.querySelector(':scope > .dialogue-portrait-art > *');
      const slotEl = portrait.querySelector(':scope > .dialogue-portrait-slot');
      if (!host || !slotEl || portrait.hidden) continue;
      host.style.transform = 'none';
      const artBox = visibleArtBox(host, schedule);
      const box = slotEl.getBoundingClientRect();
      const slot = { left: (box.left - rootRect.left) / zoom, top: (box.top - rootRect.top) / zoom, width: box.width / zoom };
      if (!artBox || !(slot.width > 0) || !(revealLine > slot.top)) {
        portrait.dataset.figureFit = 'pending';
        continue;
      }
      const placement = closeUpPlacement(artBox, slot, revealLine, layout);
      host.style.transform = `translate(${placement.x}px, ${placement.y}px) scale(${placement.scale})`;
      portrait.dataset.figureFit = 'fitted';
      portrait.dataset.figureScale = String(placement.scale);
    }
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
    placeFigures(rect, zoom, revealLine);
  }

  // ResizeObserver delivers during layout; defer writes to the next frame.
  function schedule() { if (!frame) frame = requestAnimationFrame(apply); }
  function release() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    observer = null;
    window.removeEventListener('resize', schedule);
    if (releaseActive === release) releaseActive = null;
  }
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(schedule);
    observer.observe(root);
  }
  window.addEventListener('resize', schedule);
  releaseActive = release;
  apply();
  return Object.freeze({ apply, release });
}
