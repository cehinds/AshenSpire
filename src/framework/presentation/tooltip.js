// src/framework/presentation/tooltip.js — the tooltip placement engine
// (framework contract: Tooltip behavior).
//
// Pure geometry: rectangles in, a placement or a compact-summary decision out.
// The DOM adapter measures and renders; nothing here touches targeting or
// selection, and a tooltip is never the sole source of critical information —
// compileTooltip always returns an accessible fallback string alongside.

function intersects(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function clampToViewport(rect, viewport) {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= viewport.w && rect.y + rect.h <= viewport.h;
}

const GAP = 8;

/**
 * Candidate order per contract: top controls prefer below and away from the
 * finger; bottom controls prefer above; right-side controls prefer leftward
 * space, left-side controls rightward.
 */
function candidateOrder(owner, viewport, inputMode) {
  const nearTop = owner.y + owner.h / 2 < viewport.h / 2;
  const nearLeft = owner.x + owner.w / 2 < viewport.w / 2;
  const vertical = nearTop ? ['below', 'above'] : ['above', 'below'];
  const horizontal = nearLeft ? ['right', 'left'] : ['left', 'right'];
  // Touch keeps the vertical preference first (finger occludes horizontally
  // adjacent space around the touch point); pointer may lead horizontal.
  return inputMode === 'touch' ? [...vertical, ...horizontal] : [vertical[0], horizontal[0], vertical[1], horizontal[1]];
}

function rectFor(side, owner, content, viewport) {
  const cx = Math.min(Math.max(owner.x + owner.w / 2 - content.w / 2, 0), viewport.w - content.w);
  const cy = Math.min(Math.max(owner.y + owner.h / 2 - content.h / 2, 0), viewport.h - content.h);
  switch (side) {
    case 'below': return { x: cx, y: owner.y + owner.h + GAP, w: content.w, h: content.h };
    case 'above': return { x: cx, y: owner.y - GAP - content.h, w: content.w, h: content.h };
    case 'right': return { x: owner.x + owner.w + GAP, y: cy, w: content.w, h: content.h };
    case 'left': return { x: owner.x - GAP - content.w, y: cy, w: content.w, h: content.h };
    default: throw new Error(`tooltip: unknown side ${side}`);
  }
}

/**
 * placeTooltip({owner, content, viewport, inputMode, exclusions}) →
 * {placement: {side, rect}} for the first zero-intersection candidate, or
 * {compactSummary: true} when no candidate fits (the accessible fallback).
 * exclusions must already include the owner, the active finger/pointer rect,
 * critical controls, the card lane, combatant-critical info, and unsafe
 * viewport regions — the caller owns that list; the engine only honors it.
 */
export function placeTooltip({ owner, content, viewport, inputMode = 'pointer', exclusions = [] }) {
  const blocked = [owner, ...exclusions];
  for (const side of candidateOrder(owner, viewport, inputMode)) {
    const rect = rectFor(side, owner, content, viewport);
    if (!clampToViewport(rect, viewport)) continue;
    if (blocked.some((ex) => intersects(rect, ex))) continue;
    return { placement: { side, rect } };
  }
  return { compactSummary: true };
}

/**
 * compileTooltip(registries, compiled) — canonical tooltip content for a
 * compiled entity: one line per visible property, words resolved only through
 * TermRegistry, plus the accessible fallback text that always exists.
 */
export function compileTooltip(registries, compiled) {
  const lines = [];
  for (const prop of compiled.properties) {
    if (prop.visibility === 'INTERNAL' || prop.visibility === 'DEBUG') continue;
    if (!prop.playerTermId) continue;
    const name = registries.terms.displayTerm(prop.playerTermId);
    const body = prop.tooltipTermId ? registries.terms.displayTerm(prop.tooltipTermId) : '';
    lines.push({ name, body });
  }
  const title = registries.terms.displayTerm(compiled.nameTermId);
  return {
    title,
    lines,
    accessibleFallback: [title, ...lines.map((l) => `${l.name}. ${l.body}`)].join(' '),
  };
}

/** Explicit per-input open/dismiss/focus-return rules (framework contract). */
export const TOOLTIP_INPUT_RULES = Object.freeze({
  pointer: { open: 'hover 300ms or focus', dismiss: 'pointer leaves owner and tooltip, or Escape', focusReturn: 'owner keeps focus' },
  touch: { open: 'long-press 350ms', dismiss: 'release outside, tap elsewhere, or Close', focusReturn: 'owner regains focus' },
  keyboard: { open: 'focus + tooltip key', dismiss: 'Escape or focus moves', focusReturn: 'focus never leaves owner' },
  controller: { open: 'focus + inspect button', dismiss: 'back button or focus moves', focusReturn: 'focus never leaves owner' },
});
