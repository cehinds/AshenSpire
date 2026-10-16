import { uiConfig } from '../../config/generated/ui.js';

export const targetHudConfig = () => uiConfig.components.combatTargetHud;
export function targetHudEnabled({ formFactor, classic, layout = 'formation' }, config = targetHudConfig()) {
  return !classic && layout === 'formation' && config.behavior.formFactors.includes(formFactor);
}
export function targetHudSide(role, lane, config = targetHudConfig()) {
  const sides = role === 'player' ? config.positioning.playerLaneSides : config.positioning.enemyLaneSides;
  const index = typeof lane === 'string' && ['left', 'middle', 'right'].includes(lane) ? ['left', 'middle', 'right'].indexOf(lane) : Number(lane) || 0;
  return sides[Math.min(2, Math.max(0, index))];
}
const clamp = (value, low, high) => Math.min(Math.max(low, high), Math.max(low, value));
export const targetHudOverlaps = (a, b, gap = 0) => a.left < b.left + b.width + gap && a.left + a.width + gap > b.left
  && a.top < b.top + b.height + gap && a.top + a.height + gap > b.top;

// Physical pixels, including viewport scaling. A lane owns its preferred side;
// staggering and alternate sides are tried before a free-space lattice. Every
// candidate survives; no crowded target is omitted or docked over the hand.
export function placeTargetHudPanels({ bounds, panels, obstacles = [], config = targetHudConfig() }) {
  const gap = config.positioning.gapPx, step = config.positioning.staggerStepPx, inset = config.positioning.edgeInsetPx;
  const area = { left: bounds.left + inset, top: bounds.top + inset,
    width: bounds.width - inset * 2, height: bounds.height - inset * 2 };
  const requests = [];
  for (const panel of [...panels].sort((a, b) => (a.role === 'player') - (b.role === 'player') || a.anchor.top - b.anchor.top || a.anchor.left - b.anchor.left)) {
    const width = Math.min(panel.width, area.width), height = Math.min(panel.height, area.height), a = panel.anchor;
    const side = targetHudSide(panel.role, panel.lane, config);
    const point = direction => direction === 'below' ? { left: a.left + (a.width - width) / 2, top: a.top + a.height + gap }
      : { left: direction === 'left' ? a.left - width - gap : a.left + a.width + gap, top: a.top + Math.max(0, (a.height - height) / 3) };
    const choices = [], seen = new Set();
    function add(left, top, penalty) {
      const rect = { left: clamp(left, area.left, area.left + area.width - width), top: clamp(top, area.top, area.top + area.height - height), width, height };
      const key = `${rect.left}:${rect.top}`;
      if (!seen.has(key)) { seen.add(key); choices.push({ ...rect, penalty }); }
    }
    for (const [rank, direction] of [side, ...['left', 'below', 'right'].filter(value => value !== side)].entries()) {
      const p = point(direction);
      for (const offset of [0, -step, step, -height - gap, height + gap, -height * 2 - gap * 2, height * 2 + gap * 2]) add(p.left, p.top + offset, rank * 500 + Math.abs(offset));
    }
    for (let top = area.top; top <= area.top + area.height - height; top += step)
      for (let left = area.left; left <= area.left + area.width - width; left += width + gap) add(left, top, 1800 + Math.abs(left - a.left) + Math.abs(top - a.top));
    const obstacleCount = rect => obstacles.filter(other => targetHudOverlaps(rect, other, gap / 2)).length;
    choices.sort((a, b) => obstacleCount(a) - obstacleCount(b) || a.penalty - b.penalty);
    const clear = choices.filter(choice => obstacleCount(choice) === 0);
    requests.push({ id: panel.id, side, choices, clear });
  }
  // Backtracking with the most constrained remaining target first avoids an
  // early preferred panel consuming the only free space for a front-row pair.
  let attempts = 0;
  function solve(remaining, assigned) {
    if (!remaining.length) return assigned;
    if (++attempts > 5000) return null;
    const options = remaining.map(request => ({ request, choices: request.clear.filter(rect => !assigned.some(other => targetHudOverlaps(rect, other, gap))) }))
      .sort((a, b) => a.choices.length - b.choices.length);
    const next = options[0];
    for (const rect of next.choices) {
      const result = solve(remaining.filter(request => request !== next.request), [...assigned, { id: next.request.id, side: next.request.side, ...rect }]);
      if (result) return result;
    }
    return null;
  }
  const solved = solve(requests, []);
  if (solved) return solved;
  const placed = [];
  for (const request of requests) {
    const score = rect => rect.penalty + placed.filter(other => targetHudOverlaps(rect, other, gap)).length * 1e7
      + obstacles.filter(other => targetHudOverlaps(rect, other, gap / 2)).length * 1e5;
    const choices = [...request.choices].sort((a, b) => score(a) - score(b));
    placed.push({ id: request.id, side: request.side, ...choices[0] });
  }
  return placed;
}

// One stable-target clock, including leave grace. Updating content for the
// same IDs does not restart dwell; a switch is one delay, never exit+enter.
export function createTargetHudDwell({ onChange, delay = targetHudConfig().motion.dwellMs, schedule = setTimeout, cancel = clearTimeout }) {
  let current = [], pending = [], timer = null, disposed = false;
  const key = ids => [...ids].sort().join('\u0000');
  return {
    request(ids) {
      if (disposed || key(ids) === key(pending)) return;
      pending = [...ids];
      if (timer !== null) cancel(timer);
      timer = null;
      if (key(pending) === key(current)) return;
      timer = schedule(() => { timer = null; if (disposed) return; current = [...pending]; onChange(current); }, delay);
    },
    get current() { return [...current]; },
    reset() { if (timer !== null) cancel(timer); timer = null; current = []; pending = []; },
    dispose() { disposed = true; if (timer !== null) cancel(timer); timer = null; },
  };
}
