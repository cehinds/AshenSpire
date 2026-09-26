import { allocateCombatBands, packCombatFooter } from '../models/CombatLayout.js';
import { combatantMeterGeometry } from '../models/CombatantMeterModel.js';
import { overlayGeometry, OVERLAY_ROLES } from '../models/CombatOverlayModel.js';

// Horizontal padding of a band host, in its local px. kit.css pads the hand
// band by the device's safe-area insets (zero on hosts without a notch).
function inlinePadding(el) {
  if (!el) return 0;
  const style = getComputedStyle(el);
  return (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
}

// Measures the combat root once per frame and writes the band and footer plans
// as custom properties. CSS owns placement; the model owns every number.
export function wireCombatLayout(combatEl) {
  const row = combatEl.querySelector('.combat-action-row');
  const handArea = combatEl.querySelector(':scope > .hand-area');
  let frame = 0;
  let observer = null;

  function apply() {
    frame = 0;
    if (!combatEl.isConnected) { release(); return; }
    const zoom = combatEl.getBoundingClientRect().width / combatEl.clientWidth || 1;
    const rem = Math.max(16 / zoom, parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    // The plan gets the width between the safe-area insets, so the rails and
    // the hand they wrap stay clear of a notch.
    const width = combatEl.clientWidth - inlinePadding(handArea);
    const bands = allocateCombatBands({ width, height: combatEl.clientHeight, zoom, rem });
    // The W4 parent's bands (kit.css, shared with the quest dialogue): the
    // battlefield is the scene band, the grid's flexible row; the hand is the
    // context band.
    combatEl.style.setProperty('--w4-band-hud', bands.hud + 'px');
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
    // Measure the band's host, not the row: the row's own width is what this
    // plan sets, and a pre-plan cap on it would otherwise feed back.
    const host = row.parentElement || combatEl;
    const footer = bands.rails || packCombatFooter({ width: host.clientWidth - inlinePadding(host), height: bands.footer, zoom, rem });
    row.style.setProperty('--footer-gap', footer.gap + 'px');
    row.style.setProperty('--footer-circle', footer.diameter + 'px');
    row.style.setProperty('--footer-pile-width', footer.pileWidth + 'px');
    row.style.setProperty('--footer-pile-height', footer.pileHeight + 'px');
    row.style.setProperty('--footer-end-width', footer.endWidth + 'px');
    row.dataset.footerGeometry = footer.supported ? 'supported' : 'unsupported';
  }

  // ResizeObserver delivers during layout; defer writes to the next frame.
  const schedule = () => { if (!frame) frame = requestAnimationFrame(apply); };
  function release() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    observer = null;
  }
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(schedule);
    observer.observe(combatEl);
    // Its content box narrows when the safe-area padding arrives or changes.
    if (handArea) observer.observe(handArea);
  }
  apply();
  return { apply, release };
}
