// src/framework/presentation/fitText.js — typography fitting (framework
// contract: Theme and layout data). NEVER shrinks below the role minimum; at
// minimum the component's overflow policy (wrap | expand | scroll) takes over.

/**
 * fitText({role, fits}) — role from ThemeRegistry; fits(sizeRem) reports
 * whether the text fits the container at that size (the DOM adapter measures).
 * Returns {sizeRem, overflow: null | rolePolicy}.
 */
export function fitText({ role, fits }) {
  const step = 0.05;
  let size = Math.min(Math.max(role.preferredRem, role.minimumRem), role.maximumRem);
  while (size > role.minimumRem && !fits(size)) {
    size = Math.max(role.minimumRem, Math.round((size - step) * 100) / 100);
  }
  if (!fits(size)) {
    // Overflows at minimum: wrap, expand, or internally scroll per policy —
    // never shrink further.
    return { sizeRem: role.minimumRem, overflow: role.overflowPolicy };
  }
  return { sizeRem: size, overflow: null };
}

/** The CSS clamp() expression for a role — for stylesheet consumers. */
export function clampExpression(role) {
  return `clamp(${role.minimumRem}rem, ${role.preferredRem}rem, ${role.maximumRem}rem)`;
}
