// The compact Victory receipt's presentation dials. The fight owns the XP;
// these settings only decide how its saved integer terms are revealed.
export const VICTORY_XP_DEFAULTS = Object.freeze({
  seconds: 1,
  pauseMs: 80,
  readySeconds: 0.5,
  formulaTerms: 5,
  visibleRows: 4,
});

function bounded(value, fallback, min, max) {
  const n = Number(value);
  return value === '' || value == null || !Number.isFinite(n) ? fallback : Math.max(min, Math.min(max, n));
}

export function victoryXpPresentation(settings = {}, reducedMotion = false) {
  const d = VICTORY_XP_DEFAULTS;
  return {
    totalMs: reducedMotion ? 0 : bounded(settings.victoryReceiptSeconds, d.seconds, 0, 12) * 1000,
    pauseMs: reducedMotion ? 0 : bounded(settings.victoryReceiptPauseMs, d.pauseMs, 0, 500),
    readyMs: reducedMotion ? 0 : bounded(settings.victoryReceiptReadySeconds, d.readySeconds, 0, 5) * 1000,
    formulaTerms: Math.round(bounded(settings.victoryReceiptFormulaTerms, d.formulaTerms, 1, 20)),
    visibleRows: Math.round(bounded(settings.victoryReceiptVisibleRows, d.visibleRows, 2, 8)),
  };
}

export function victoryXpTiming(count, { totalMs, pauseMs }) {
  if (count < 1 || totalMs <= 0) return { tickMs: 0, pauseMs: 0 };
  // Pauses take at most a quarter of the budget. Large encounters still fit
  // the chosen total time instead of making each enemy add another delay.
  const gap = count > 1 ? Math.min(pauseMs, totalMs * 0.25 / (count - 1)) : 0;
  return { tickMs: (totalMs - gap * (count - 1)) / count, pauseMs: gap };
}

export function victoryXpFormula(rows, revealed, limit) {
  const terms = rows.slice(0, revealed).map((row) => row.amount);
  const visible = terms.slice(0, limit);
  const format = (values) => values.map((value, index) => index === 0 ? String(value)
    : value < 0 ? `− ${Math.abs(value)}` : `+ ${value}`).join(' ');
  return {
    shown: format(visible),
    collapsed: terms.length > limit,
    full: `${format(rows.map((row) => row.amount))} = ${rows.reduce((sum, row) => sum + row.amount, 0)} XP`,
  };
}
