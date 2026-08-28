// Title/save-slot-only tooltip adapter.
//
// This deliberately owns presentation geometry only. The selected save-slot
// button remains the focus, input, activation, hold, and load authority.

export const TITLE_SAVE_SLOT_TOOLTIP_COPY = 'Activate again—or hold—to load.';

const TOOLTIP_ID = 'title-save-slot-tooltip';
const NARROW_MAX_WIDTH = 480;
const FLOAT_WIDTH = 252;
const GAP = 12;
let activeCleanup = null;

const numberValue = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

function measuredSafeInsets() {
  const rootStyle = getComputedStyle(document.documentElement);
  const explicit = (side) => numberValue(rootStyle.getPropertyValue(`--title-tooltip-safe-${side}`));
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  Object.assign(probe.style, {
    position: 'fixed',
    visibility: 'hidden',
    pointerEvents: 'none',
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingRight: 'env(safe-area-inset-right, 0px)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    paddingLeft: 'env(safe-area-inset-left, 0px)',
  });
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const safe = {
    top: Math.max(explicit('top'), numberValue(style.paddingTop)),
    right: Math.max(explicit('right'), numberValue(style.paddingRight)),
    bottom: Math.max(explicit('bottom'), numberValue(style.paddingBottom)),
    left: Math.max(explicit('left'), numberValue(style.paddingLeft)),
  };
  probe.remove();
  return safe;
}

function visualPlan() {
  const viewport = window.visualViewport || {
    offsetLeft: 0,
    offsetTop: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  const safe = measuredSafeInsets();
  return {
    width: viewport.width,
    height: viewport.height,
    safe,
    bounds: {
      left: viewport.offsetLeft + safe.left,
      top: viewport.offsetTop + safe.top,
      right: viewport.offsetLeft + viewport.width - safe.right,
      bottom: viewport.offsetTop + viewport.height - safe.bottom,
    },
  };
}

const intersects = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) > 0.01;

const inside = (candidate, size, bounds) => candidate.left >= bounds.left
  && candidate.top >= bounds.top
  && candidate.left + size.width <= bounds.right
  && candidate.top + size.height <= bounds.bottom;

function addDescription(owner, id) {
  const ids = new Set((owner.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  ids.add(id);
  owner.setAttribute('aria-describedby', [...ids].join(' '));
}

function removeDescription(owner, id) {
  const ids = (owner.getAttribute('aria-describedby') || '').split(/\s+/).filter((entry) => entry && entry !== id);
  if (ids.length) owner.setAttribute('aria-describedby', ids.join(' '));
  else owner.removeAttribute('aria-describedby');
}

function resetNaturalSize(tip) {
  tip.style.width = 'auto';
  tip.style.height = 'auto';
  tip.style.maxWidth = 'none';
  tip.style.maxHeight = 'none';
}

function hardExclusions(root, owner) {
  return [...root.querySelectorAll(
    '[data-slot-pick], [data-slot-delete], .title-modal-close, .title-modal-actions button, #title-modal-heading, .title-modal-rule, .hold-hint',
  )].filter((element) => element !== owner && element.getClientRects().length);
}

function sideCandidates(ownerRect, size, bounds, gap) {
  return [
    { side: 'block-end', left: Math.min(ownerRect.right - size.width, bounds.right - size.width), top: ownerRect.bottom + gap },
    { side: 'inline-end', left: ownerRect.right + gap, top: ownerRect.top + (ownerRect.height - size.height) / 2 },
    { side: 'inline-start', left: ownerRect.left - size.width - gap, top: ownerRect.top + (ownerRect.height - size.height) / 2 },
    { side: 'block-start', left: Math.min(ownerRect.right - size.width, bounds.right - size.width), top: ownerRect.top - size.height - gap },
  ];
}

function baseStyles(tip) {
  Object.assign(tip.style, {
    boxSizing: 'border-box',
    zIndex: '940',
    minHeight: '44px',
    padding: '8px 12px',
    border: '1px solid rgba(200, 155, 76, 0.72)',
    borderRadius: '10px',
    background: 'rgba(18, 14, 10, 0.98)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.38)',
    color: '#f4e7c8',
    font: '600 14px/1.35 system-ui, sans-serif',
    letterSpacing: '0.01em',
    textAlign: 'left',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
  });
  tip.style.overflow = 'visible';
  tip.style.pointerEvents = 'none';
  tip.style.transition = 'none';
  tip.style.setProperty('transition', 'none', 'important');
  tip.style.animation = 'none';
  tip.style.setProperty('animation', 'none', 'important');
}

function mountReserve({ tip, owner, root, visual, natural }) {
  const row = owner.closest('.title-slot-row');
  const modal = owner.closest('.title-menu-modal');
  const zoom = numberValue(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  if (!row) return false;
  tip.remove();
  row.appendChild(tip);
  Object.assign(row.style, { flexWrap: 'wrap', rowGap: '0px' });
  Object.assign(tip.style, {
    position: 'relative',
    inset: 'auto',
    flex: '1 0 100%',
    width: '100%',
    height: `${Math.ceil(natural.height) / zoom}px`,
    maxWidth: '100%',
    margin: '0',
  });
  tip.dataset.placement = 'reserve';
  if (modal) {
    modal.style.boxSizing = 'border-box';
    modal.style.maxHeight = `${Math.max(1, visual.bounds.bottom - visual.bounds.top) / zoom}px`;
    modal.style.overflowY = 'auto';
    modal.style.overflowX = 'hidden';
    const rect = tip.getBoundingClientRect();
    if (rect.bottom > visual.bounds.bottom) modal.scrollTop += rect.bottom - visual.bounds.bottom + GAP;
    if (rect.top < visual.bounds.top) modal.scrollTop -= visual.bounds.top - rect.top + GAP;
    requestAnimationFrame(() => {
      if (!tip.isConnected) return;
      const settled = tip.getBoundingClientRect();
      if (settled.bottom > visual.bounds.bottom) modal.scrollTop += settled.bottom - visual.bounds.bottom;
      if (settled.top < visual.bounds.top) modal.scrollTop -= visual.bounds.top - settled.top;
    });
  }
  return true;
}

function mountFloat({ tip, root, owner, visual, natural }) {
  const zoom = numberValue(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  tip.remove();
  root.appendChild(tip);
  Object.assign(tip.style, {
    position: 'fixed',
    width: `${Math.ceil(natural.width) / zoom}px`,
    height: `${Math.ceil(natural.height) / zoom}px`,
    maxWidth: `${Math.ceil(natural.width) / zoom}px`,
    margin: '0',
  });
  const ownerRect = owner.getBoundingClientRect();
  const gap = GAP;
  const candidates = sideCandidates(ownerRect, natural, visual.bounds, gap);
  const exclusions = hardExclusions(root, owner);
  const chosen = candidates.find((candidate) => {
    const rect = {
      left: candidate.left,
      top: candidate.top,
      right: candidate.left + natural.width,
      bottom: candidate.top + natural.height,
    };
    return inside(candidate, natural, visual.bounds)
      && !intersects(rect, ownerRect)
      && exclusions.every((element) => !intersects(rect, element.getBoundingClientRect()));
  });
  if (!chosen) {
    if (visual.width <= NARROW_MAX_WIDTH) {
      const forced = candidates[0];
      tip.style.left = `${forced.left / zoom}px`;
      tip.style.top = `${forced.top / zoom}px`;
      tip.dataset.placement = forced.side;
      return true;
    }
    return false;
  }
  tip.style.left = `${chosen.left / zoom}px`;
  tip.style.top = `${chosen.top / zoom}px`;
  tip.dataset.placement = chosen.side;
  return true;
}

function plan(context) {
  const { tip, owner, root } = context;
  const zoom = numberValue(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  if (!owner.isConnected || !root.isConnected) return false;
  owner.style.removeProperty('min-height');
  resetNaturalSize(tip);
  tip.remove();
  root.appendChild(tip);
  Object.assign(tip.style, {
    position: 'fixed',
    visibility: 'hidden',
    width: `${Math.min(FLOAT_WIDTH, Math.max(44, visualPlan().width - 2 * GAP)) / zoom}px`,
  });
  const measured = tip.getBoundingClientRect();
  const visual = visualPlan();
  const natural = {
    width: Math.min(FLOAT_WIDTH, Math.max(44, visual.bounds.right - visual.bounds.left - 2 * GAP)),
    height: Math.ceil(measured.height),
  };
  tip.dataset.safeInsets = JSON.stringify(visual.safe);
  tip.style.visibility = 'visible';
  const next = { ...context, visual, natural };
  if (visual.width <= NARROW_MAX_WIDTH) return mountReserve(next);
  if (mountFloat(next)) return true;
  return mountReserve(next);
}

export function mountTitleSaveSlotTooltip({ root, owner } = {}) {
  activeCleanup?.();
  if (!(root instanceof HTMLElement) || !(owner instanceof HTMLButtonElement) || !owner.isConnected) return () => {};

  const tip = document.createElement('div');
  tip.id = TOOLTIP_ID;
  tip.dataset.titleSaveSlotTooltip = '';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('data-component', 'tooltip');
  tip.textContent = TITLE_SAVE_SLOT_TOOLTIP_COPY;
  baseStyles(tip);
  addDescription(owner, TOOLTIP_ID);

  const row = owner.closest('.title-slot-row');
  const modal = owner.closest('.title-menu-modal');
  const saved = {
    rowFlexWrap: row?.style.flexWrap || '',
    rowGap: row?.style.rowGap || '',
    modalBoxSizing: modal?.style.boxSizing || '',
    modalMaxHeight: modal?.style.maxHeight || '',
    modalOverflowY: modal?.style.overflowY || '',
    modalOverflowX: modal?.style.overflowX || '',
  };
  let frame = 0;
  const replan = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => plan({ tip, owner, root }));
  };
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(replan) : null;
  resizeObserver?.observe(owner);
  window.addEventListener('resize', replan);
  window.visualViewport?.addEventListener('resize', replan);
  window.visualViewport?.addEventListener('scroll', replan);
  plan({ tip, owner, root });
  document.fonts?.ready.then(replan).catch(() => {});

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    window.removeEventListener('resize', replan);
    window.visualViewport?.removeEventListener('resize', replan);
    window.visualViewport?.removeEventListener('scroll', replan);
    removeDescription(owner, TOOLTIP_ID);
    tip.remove();
    if (row) {
      row.style.flexWrap = saved.rowFlexWrap;
      row.style.rowGap = saved.rowGap;
    }
    if (modal) {
      modal.style.boxSizing = saved.modalBoxSizing;
      modal.style.maxHeight = saved.modalMaxHeight;
      modal.style.overflowY = saved.modalOverflowY;
      modal.style.overflowX = saved.modalOverflowX;
    }
    if (activeCleanup === cleanup) activeCleanup = null;
  };
  activeCleanup = cleanup;
  return cleanup;
}
