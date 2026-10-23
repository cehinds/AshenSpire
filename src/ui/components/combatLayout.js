import { desktopFooterEnabled, desktopFooterLayout } from '../models/DesktopCombatFooter.js';
import { allocateCombatBands, packCombatFooter } from '../models/CombatLayout.js';
import { footerArtHeight, footerArtWidth } from '../models/FooterLayoutModel.js';
import { footerSizing } from '../../content/footerLayout.js';
import { uiConfig } from '../../config/generated/ui.js';
import { combatantMeterGeometry } from '../models/CombatantMeterModel.js';
import { overlayGeometry, OVERLAY_ROLES } from '../models/CombatOverlayModel.js';
import { fitFooterCompactLabels } from './footerArt.js';
import { layoutMetrics } from '../layoutMetrics.js';

// Absolute caption rows are part of the header's occupied layout band. Move
// the field/grid with that band rather than squeezing figures at fixed feet.
export function combatHudBandHeight(header, allocated, zoom = 1) {
  if (!header) return allocated;
  const top = header.getBoundingClientRect().top;
  const rows = [...header.querySelectorAll('.hud-info-row')].filter(row => !row.hidden
    && row.getBoundingClientRect().height > 0 && !['hidden', 'collapse'].includes(getComputedStyle(row).visibility));
  const bottom = Math.max(top, ...rows.map(row => row.getBoundingClientRect().bottom));
  return Math.max(allocated, (bottom - top + (rows.length ? 4 : 0)) / zoom);
}

// Horizontal padding of a band host, in its local px. kit.css pads the hand
// band by the device's safe-area insets (zero on hosts without a notch).
function inlinePadding(el) {
  if (!el) return 0;
  const style = getComputedStyle(el);
  return (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
}

// Attach only the live combat turn to the shared header on every form factor.
// The shared renderer owns HP, relics, quick controls and the purse; these never
// move. Disabling the overlay restores the turn to its original sibling slot.
export function wireDesktopCombatHeader(combatEl) {
  const anchors = new Map();
  const restore = () => {
    for (const [node, anchor] of anchors) {
      if (anchor.parentNode && combatEl.contains(node)) anchor.parentNode.insertBefore(node, anchor);
      anchor.remove();
    }
    anchors.clear();
    delete combatEl.dataset.desktopHeader;
  };
  const move = (node, host, before = null) => {
    if (!node || !host || node.parentNode === host) return;
    if (!anchors.has(node)) {
      const anchor = combatEl.ownerDocument.createComment('combat HUD original slot');
      node.parentNode.insertBefore(anchor, node);
      anchors.set(node, anchor);
    }
    host.insertBefore(node, before);
  };
  return {
    apply(enabled) {
      if (!enabled) { restore(); return; }
      // Re-query on each pass: a host repaint can replace header children.
      for (const [node, anchor] of anchors) if (!combatEl.contains(node)) { anchor.remove(); anchors.delete(node); }
      const header = combatEl.querySelector(':scope > .combat-hud.shared-hud');
      if (!header) { restore(); return; }
      move(combatEl.querySelector('.turn-ribbon'), header);
      combatEl.dataset.desktopHeader = 'true';
    },
    release: restore,
  };
}

// Measures the combat root once per frame and writes the band and footer plans
// as custom properties. CSS owns placement; the model owns every number.
export function wireCombatLayout(combatEl) {
  const row = combatEl.querySelector('.combat-action-row');
  const handArea = combatEl.querySelector(':scope > .hand-area');
  let frame = 0;
  let observer = null;
  let formFactorObserver = null;
  let headerObserver = null;
  const desktopHeader = wireDesktopCombatHeader(combatEl);

  function apply() {
    frame = 0;
    if (!combatEl.isConnected) { release(); return; }
    // Every box this pass needs is read here, before the first write: a read after
    // the custom-property writes below forces a style and layout flush (one 149 ms
    // recalc on a phone profile at the footer host's clientWidth).
    const clientWidth = combatEl.clientWidth, clientHeight = combatEl.clientHeight;
    const zoom = combatEl.getBoundingClientRect().width / clientWidth || 1;
    const host = row ? row.parentElement || combatEl : null;
    const hostWidth = host ? host.clientWidth - inlinePadding(host) : 0;
    const rem = Math.max(16 / zoom, parseFloat(layoutMetrics().fontSize) || 16);
    // The plan gets the width between the safe-area insets, so the rails and
    // the hand they wrap stay clear of a notch.
    const width = clientWidth - inlinePadding(handArea);
    // The HUD form factor main.js writes to <html> (widescreen | mobile | tablet
    // | desktop). The plan reads it; it is mirrored on the combat root for CSS.
    const formFactor = document.documentElement.dataset.formFactor || null;
    combatEl.dataset.formFactor = formFactor || '';
    const split = desktopFooterEnabled({ formFactor, appearance: document.documentElement.dataset.displayAppearance, layout: combatEl.dataset.layout });
    combatEl.dataset.desktopFooter = String(split);
    desktopHeader.apply(document.documentElement.dataset.displayAppearance === 'alternative');
    if (combatEl.dataset.desktopHeader === 'true') {
      const ribbonWidth = combatEl.querySelector('.combat-hud > .turn-ribbon')?.getBoundingClientRect().width / zoom || 0;
      combatEl.style.setProperty('--desktop-header-left-width', Math.max(0, width / 2 - ribbonWidth / 2 - 32 / zoom) + 'px');
    }
    if (split && row && handArea) {
      const plan = desktopFooterLayout({ width: clientWidth, height: clientHeight, zoom });
      const areaTop = (handArea.getBoundingClientRect().top - combatEl.getBoundingClientRect().top) / zoom;
      for (const [name, value] of Object.entries({ 'area-top': areaTop, 'hand-top': plan.handTop - areaTop, 'hand-height': plan.handHeight, 'background-top': plan.backgroundTop - areaTop, 'background-fade-height': plan.backgroundFadeHeight, 'tools-top': plan.toolsTop, 'corner-inset': plan.corner, 'end-art-width': plan.endArtWidth, 'end-art-height': plan.endArtHeight })) combatEl.style.setProperty('--desktop-' + name, value + 'px');
      const selectors = { sp: '.energy-orb', draw: '.draw', end: '.end-turn', discard: '.spent', potions: '.combat-potions' };
      for (const [role, box] of Object.entries(plan.controls)) {
        const control = row.querySelector(selectors[role]);
        if (control) for (const [key, value] of Object.entries(box)) control.style.setProperty('--desktop-' + key, value + 'px');
      }
    }
    const compact = width * zoom <= uiConfig.scenes.w4a.sizing.compactCombat.maxWidthPx;
    combatEl.dataset.compactCombat = String(compact);
    const allocatedBands = allocateCombatBands({ width, height: clientHeight, zoom, rem, compact, footerArtPx: footerArtHeight(width, zoom, formFactor) * zoom });
    // Mobile gives the original controls a shallow dock; the freed height
    // returns to the battlefield rather than an opaque hand backing.
    const footer = formFactor === 'mobile' ? Math.max(76 / zoom, Math.min(84 / zoom, clientHeight * .095)) : allocatedBands.footer;
    const bands = { ...allocatedBands, footer, battlefield: allocatedBands.battlefield + allocatedBands.footer - footer };
    // The W4 parent's bands (kit.css, shared with the quest dialogue): the
    // battlefield is the scene band, the grid's flexible row; the hand is the
    // context band.
    combatEl.style.setProperty('--w4-band-hud', combatHudBandHeight(combatEl.querySelector(':scope > .topbar'), bands.hud, zoom) + 'px');
    combatEl.style.setProperty('--w4-band-context', bands.hand + 'px');
    combatEl.style.setProperty('--w4-band-footer', bands.footer + 'px');
    combatEl.dataset.combatGeometry = bands.supported ? 'supported' : 'unsupported';
    // WCM0: every combatant's meter rows share one geometry.
    const meters = combatantMeterGeometry({ zoom, rem });
    combatEl.style.setProperty('--combatant-hp-h', meters.hp + 'px');
    combatEl.style.setProperty('--combatant-secondary-h', meters.secondary + 'px');
    combatEl.style.setProperty('--combatant-stance-h', meters.stance + 'px');
    combatEl.style.setProperty('--combatant-value-text', meters.valueText + 'px');
    combatEl.style.setProperty('--combatant-meter-gap', meters.gap + 'px');
    // WCO0: the guard badge and intent read one overlay geometry.
    const overlay = overlayGeometry({ zoom, rem });
    combatEl.style.setProperty('--defense-min', overlay.defenseMin + 'px');
    combatEl.style.setProperty('--intent-min', overlay.intentMin + 'px');
    combatEl.style.setProperty('--overlay-value-font', overlay.valueFont + 'px');
    combatEl.style.setProperty('--defense-gap', overlay.gap + 'px');
    for (const role of OVERLAY_ROLES) {
      const { side, heightFraction } = overlay.anchors[role];
      // Unitless, so the stylesheet can blend the art's two edges in calc().
      combatEl.style.setProperty(`--defense-right-${role}`, side === 'right' ? '1' : '0');
      combatEl.style.setProperty(`--defense-fraction-${role}`, String(heightFraction));
    }
    combatEl.dataset.combatArrangement = bands.arrangement;
    if (bands.rails) {
      combatEl.style.setProperty('--wireframe-rail-width', bands.rails.railWidth + 'px');
      combatEl.style.setProperty('--wireframe-rail-gap', bands.rails.gap + 'px');
    }
    if (!row) return;
    row.style.setProperty('--footer-art-width', footerArtWidth(width, zoom, formFactor) + 'px');
    // Measure the band's host, not the row: the row's own width is what this
    // plan sets, and a pre-plan cap on it would otherwise feed back.
    const packedFooter = bands.rails || packCombatFooter({ width: hostWidth, height: bands.footer, zoom, rem });
    row.style.setProperty('--footer-gap', packedFooter.gap + 'px');
    row.style.setProperty('--footer-circle', packedFooter.diameter + 'px');
    row.style.setProperty('--footer-pile-width', packedFooter.pileWidth + 'px');
    row.style.setProperty('--footer-spent-width', packedFooter.spentWidth + 'px');
    row.style.setProperty('--footer-pile-height', packedFooter.pileHeight + 'px');
    row.style.setProperty('--footer-end-width', packedFooter.endWidth + 'px');
    row.dataset.footerGeometry = packedFooter.supported ? 'supported' : 'unsupported';
    row.dataset.footerCompact = String(bands.arrangement === 'rails' || width * zoom < footerSizing.compactBelowPx);
    fitFooterCompactLabels(row);
  }

  // ResizeObserver delivers during layout; defer writes to the next frame.
  const schedule = () => { if (!frame) frame = requestAnimationFrame(apply); };
  function release() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    observer = null;
    desktopHeader.release();
    headerObserver?.disconnect();
    headerObserver = null;
    formFactorObserver?.disconnect();
    formFactorObserver = null;
  }
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(schedule);
    observer.observe(combatEl);
    // Its content box narrows when the safe-area padding arrives or changes.
    if (handArea) observer.observe(handArea);
  }
  // main.js writes data-form-factor after its 150ms resize debounce, so a fight
  // that stays mounted across the 1100px boundary can measure with the old
  // form factor. Re-plan when the attribute changes.
  if (typeof MutationObserver !== 'undefined') {
    headerObserver = new MutationObserver(schedule);
    headerObserver.observe(combatEl, { attributes: true, attributeFilter: ['data-target-hud', 'data-layout'], childList: true });
    formFactorObserver = new MutationObserver(schedule);
    formFactorObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-form-factor', 'data-display-appearance'] });
  }
  apply();
  return { apply, release };
}
