// Character steps start at level 1; skill steps start at level 0.
// Callers pass the zero-based step so every track shares the same arithmetic.
export function xpStepCost(curve, step, { exponentialEpsilon = 1e-9 } = {}) {
  const { base, growth, roundTo, linear, multScaler } = curve;
  const raw = linear === true ? base + step * base * multScaler : base * Math.pow(growth, step);
  const unit = Number.isInteger(roundTo) && roundTo > 0 ? roundTo : 1;
  const epsilon = linear === true ? 1e-9 : exponentialEpsilon;
  return Math.max(unit, Math.round(raw / unit + epsilon) * unit);
}
