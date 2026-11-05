import { uiConfig } from '../../config/generated/ui.js';

export const targetHudConfig = () => uiConfig.components.combatTargetHud;
export function targetHudEnabled({ formFactor, layout = 'formation' }, config = targetHudConfig()) {
  return layout === 'formation' && config.behavior.formFactors.includes(formFactor);
}
// Owner 2026-10-31: a lone living enemy's card sits to its left; with several enemies it sits below the selected
// one. The lane table is only the fallback when the config lacks the two keys or the count is unknown.
export function targetHudSide(role, lane, config = targetHudConfig(), enemyCount) {
  if (role !== 'player' && Number.isFinite(enemyCount) && enemyCount >= 1) {
    const side = enemyCount === 1 ? config.positioning.loneEnemySide : config.positioning.crowdedEnemySide;
    if (side) return side;
  }
  const sides = role === 'player' ? config.positioning.playerLaneSides : config.positioning.enemyLaneSides;
  const index = typeof lane === 'string' && ['left', 'middle', 'right'].includes(lane) ? ['left', 'middle', 'right'].indexOf(lane) : Number(lane) || 0;
  return sides[Math.min(2, Math.max(0, index))];
}
// Owner 2026-11-04: the player's panel sits immediately right of the player's visible body. When the room to the
// right is narrower than the panel (a phone), the panel narrows to fit (never below `pinnedMinWidthPx`) so the
// clamp cannot slide it back over the player. `width` includes the 25px info-button lead the caller adds.
export function targetHudPinnedWidth({ bounds, anchor, width, config = targetHudConfig(), tightTop = false }) {
  const { gapPx, edgeInsetPx, pinnedMinWidthPx = 0 } = config.positioning;
  const room = bounds.left + bounds.width - edgeInsetPx - (anchor.left + anchor.width + gapPx);
  // The floor is on the visible panel, so the 25px info-button lead is added to it.
  return Math.max(Math.min(width, pinnedMinWidthPx + 25), Math.min(width, room));
}
const clamp = (value, low, high) => Math.min(Math.max(low, high), Math.max(low, value));
export const targetHudOverlaps = (a, b, gap = 0) => a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 && a.left < b.left + b.width + gap && a.left + a.width + gap > b.left
  && a.top < b.top + b.height + gap && a.top + a.height + gap > b.top;

// Physical pixels, including viewport scaling. A lane owns its preferred side;
// staggering and alternate sides are tried before a free-space lattice. Every
// candidate survives; no crowded target is omitted or docked over the hand.
export function placeTargetHudPanels({ bounds, panels, obstacles = [], config = targetHudConfig(), tightTop = false, enemyCount = panels.filter(panel => panel.role === 'enemy').length }) {
  const gap = config.positioning.gapPx, step = config.positioning.staggerStepPx, inset = config.positioning.edgeInsetPx;
  // Owner 2026-10-28: on phones and portrait the top edge is tighter than the sides so a panel can sit above an
  // enemy's overhead intent instead of covering it (topInsetPx); desktop and widescreen keep the common inset.
  const topInset = tightTop ? config.positioning.topInsetPx ?? inset : inset;
  const area = { left: bounds.left + inset, top: bounds.top + topInset,
    width: Math.max(0, bounds.width - inset * 2), height: Math.max(0, bounds.height - topInset - inset) };
  const requests = [];
  // Owner (2026-10-17): the player's panel is pinned to the player's right. It
  // is placed first and never falls back to another side or the free-space
  // lattice, so it cannot drift beside an enemy; enemies route around it.
  for (const panel of [...panels].sort((a, b) => (b.role === 'player') - (a.role === 'player') || a.anchor.top - b.anchor.top || a.anchor.left - b.anchor.left)) {
    const pinned = panel.role === 'player';
    const width = Math.min(panel.width, area.width), height = Math.min(panel.height, area.height), a = panel.anchor;
    const side = targetHudSide(panel.role, panel.lane, config, enemyCount);
    // A pinned (player) panel's top is the anchor's top, the player's overhead meters; it shifts vertically, never across.
    // Too little room right of the body even at the floor width: sit above the player, never over the body or enemy.
    const above = pinned && side === 'right' && width > area.left + area.width - (a.left + a.width + gap) + 0.5;
    const point = direction => direction === 'above' ? { left: a.left, top: a.top - height - gap }
      : direction === 'below' ? { left: a.left + (a.width - width) / 2, top: a.top + a.height + gap }
      : { left: direction === 'left' ? a.left - width - gap : a.left + a.width + gap, top: pinned ? a.top : a.top - height / 3 };
    const choices = [], seen = new Set();
    function add(left, top, penalty, chosen = side) {
      const rect = { left: clamp(left, area.left, area.left + area.width - width), top: clamp(top, area.top, area.top + area.height - height), width, height };
      const key = `${rect.left}:${rect.top}`;
      if (!seen.has(key)) { seen.add(key); choices.push({ ...rect, penalty, side: chosen }); }
    }
    for (const [rank, direction] of (pinned ? [above ? 'above' : side] : [side, ...['left', 'below', 'right'].filter(value => value !== side)]).entries()) {
      const p = point(direction);
      for (const offset of [0, -step, step, -height - gap, height + gap, -height * 2 - gap * 2, height * 2 + gap * 2]) add(p.left, p.top + offset, rank * 500 + Math.abs(offset), direction);
    }
    if (!pinned) for (let top = area.top; top <= area.top + area.height - height; top += Math.max(1, step))
      for (let left = area.left; left <= area.left + area.width - width; left += Math.max(1, width + gap)) add(left, top, 1800 + Math.abs(left - a.left) + Math.abs(top - a.top), 'free');
    // A narrow free strip can fall between lattice rows. Try measured
    // obstacle edges so an available sprite-safe slot survives quantization.
    if (!pinned) for (const obstacle of obstacles.filter(other => other.width > 0 && other.height > 0))
      for (const top of [obstacle.top + obstacle.height + gap, obstacle.top - height - gap])
        for (const left of [area.left, area.left + area.width - width])
          add(left, top, 1200 + Math.abs(left - a.left) + Math.abs(top - a.top), 'obstacle');
    // A player-side panel's own sprite box (mostly transparent canvas) is not an obstacle: the panel is anchored to the body beside it.
    // Player-only obstacles (enemy HP bars) never move an enemy's panel, so enemy placement is as before.
    const mine = obstacles.filter(other => pinned ? other.id !== panel.id : !other.playerOnly);
    // Owner 2026-11-05: when an enemy's sprite stands right beside the player (a landscape phone), the pinned panel
    // takes the nearest clear slot to the right of that obstacle, still right of the player and never on the figure.
    if (pinned && !above && side === 'right') for (const obstacle of mine.filter(other => other.width > 0 && other.height > 0 && other.left + other.width > a.left + a.width))
      for (const offset of [0, -step, step])
        add(obstacle.left + obstacle.width + gap, a.top + offset, 300 + Math.abs(obstacle.left + obstacle.width - (a.left + a.width)) + Math.abs(offset), 'right');
    const obstacleCount = rect => mine.filter(other => targetHudOverlaps(rect, other)).length;
    choices.sort((a, b) => obstacleCount(a) - obstacleCount(b) || a.penalty - b.penalty);
    const free = choices.filter(choice => obstacleCount(choice) === 0);
    // A pinned panel overlaps a decoration before it leaves the player's side.
    const clear = pinned && !free.length ? choices.slice(0, 1) : free;
    requests.push({ id: panel.id, mine, choices, clear });
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
      const result = solve(remaining.filter(request => request !== next.request), [...assigned, { id: next.request.id, ...rect }]);
      if (result) return result;
    }
    return null;
  }
  const solved = solve(requests, []);
  const finish = result => {
    const enemies = panels.filter(panel => panel.role === 'enemy');
    const pinned = result.filter(row => panels.find(panel => panel.id === row.id)?.role === 'player');
    // Player-only obstacles (enemy HP bars) stay out, as for every enemy panel: a selected enemy's panel replaces its bar.
    const rowed = placeEnemyPanelRows({ area, panels: enemies, gap, avoid: pinned, obstacles: obstacles.filter(other => !other.playerOnly) });
    return rowed ? [...pinned, ...rowed] : result;
  };
  if (solved) return finish(solved);
  const placed = [];
  for (const request of requests) {
    const score = rect => rect.penalty + placed.filter(other => targetHudOverlaps(rect, other, gap)).length * 1e7
      + request.mine.filter(other => targetHudOverlaps(rect, other)).length * 1e5;
    const choices = [...request.choices].sort((a, b) => score(a) - score(b));
    placed.push({ id: request.id, ...choices[0] });
  }
  return finish(placed);
}

// Owner 2026-11-05: with two or more enemy panels, narrow each (never below `enemyRowMinWidthPx`, visible width) so as
// many as possible share a row; `width` includes the 25px info-button lead the caller adds.
export function targetHudEnemyRowWidth({ bounds, count, width, config = targetHudConfig() }) {
  const { gapPx, edgeInsetPx, enemyRowMinWidthPx = 0 } = config.positioning;
  if (count < 2 || !enemyRowMinWidthPx) return width;
  const room = bounds.width - edgeInsetPx * 2, floor = enemyRowMinWidthPx + 25;
  const perRow = Math.max(1, Math.min(count, Math.floor((room + gapPx) / (floor + gapPx))));
  return Math.max(Math.min(width, floor), Math.min(width, (room - (perRow - 1) * gapPx) / perRow));
}
// Owner 2026-11-05: several enemy panels try to sit side by side, each under its own enemy, instead of in a column.
// They split into rows only when one row is wider than the field (rows stack, left to right inside each), and the
// block takes the free slot nearest the enemies. With no clear slot the caller keeps its per-panel placement.
export function placeEnemyPanelRows({ area, panels, obstacles = [], avoid = [], gap }) {
  if (panels.length < 2) return null;
  const sorted = [...panels].sort((p, q) => p.anchor.left + p.anchor.width / 2 - (q.anchor.left + q.anchor.width / 2));
  const rows = [[]]; let used = 0;
  for (const panel of sorted) {
    const width = Math.min(panel.width, area.width);
    if (rows.at(-1).length && used + gap + width > area.width + 1e-6) { rows.push([]); used = 0; }
    used += (rows.at(-1).length ? gap : 0) + width; rows.at(-1).push(panel);
  }
  const clear = (rect, near) => !near.some(other => targetHudOverlaps(rect, other)) && !avoid.some(other => targetHudOverlaps(rect, other, gap));
  const placedRows = [];
  for (const row of rows) {
    const height = Math.max(...row.map(panel => Math.min(panel.height, area.height)));
    // Desired lefts centre each panel under its enemy; push apart, then pull back from the right edge.
    const layoutAt = (top, minLeft) => {
      const items = row.map(panel => ({ panel, width: Math.min(panel.width, area.width), left: panel.anchor.left + panel.anchor.width / 2 - Math.min(panel.width, area.width) / 2 }));
      items.forEach((item, i) => { item.left = Math.max(item.left, i ? items[i - 1].left + items[i - 1].width + gap : minLeft); });
      for (let i = items.length - 1; i >= 0; i--) {
        const limit = i === items.length - 1 ? area.left + area.width : items[i + 1].left - gap;
        items[i].left = Math.min(items[i].left, limit - items[i].width);
      }
      return items.map(item => ({ id: item.panel.id, left: item.left, top, width: item.width, height: Math.min(item.panel.height, area.height), penalty: 0, side: 'below' }));
    };
    const anchorBottom = Math.max(...row.map(panel => panel.anchor.top + panel.anchor.height)), anchorTop = Math.min(...row.map(panel => panel.anchor.top));
    const distance = top => Math.min(Math.abs(top - (anchorBottom + gap)), Math.abs(top + height + gap - anchorTop));
    // A panel's centre must stay within its own enemy's span, give or take half a panel, so it never lands under a neighbour.
    const ownsCentre = placed => placed.every((rect, i) => {
      const { anchor } = row[i], centre = rect.left + rect.width / 2, slack = rect.width / 2;
      return centre >= anchor.left - slack && centre <= anchor.left + anchor.width + slack;
    });
    const sideways = placed => placed.reduce((sum, rect, i) => sum + Math.abs(rect.left + rect.width / 2 - (row[i].anchor.left + row[i].anchor.width / 2)), 0);
    const tops = [];
    for (let top = area.top; top + height <= area.top + area.height + 1e-6; top += 4) tops.push(top);
    tops.push(area.top + area.height - height);
    // Each band's obstacles are found once per top, then reused by every start in it.
    let found = null, best = Infinity;
    for (const top of tops) {
      if (top < area.top - 1e-6) continue;
      // Start at the field edge, or just right of an obstacle in this band (a row can sit beside the player, not over it).
      const band = { left: area.left, width: area.width, top, height };
      const near = obstacles.filter(other => targetHudOverlaps(band, other));
      const starts = [area.left, ...near.map(other => other.left + other.width + gap)].sort((a, b) => a - b);
      for (const minLeft of starts) {
        if (minLeft > area.left + area.width) continue;
        const placed = layoutAt(top, minLeft);
        if (!placed.every(rect => rect.left >= area.left - 1e-6 && rect.left + rect.width <= area.left + area.width + 1e-6) || !ownsCentre(placed)
          || !placed.every(rect => clear(rect, near)) || placedRows.flat().some(other => placed.some(rect => targetHudOverlaps(rect, other, gap)))) continue;
        // Total sideways drift plus the vertical distance from the enemies: the nearest, least-shifted layout wins.
        const score = sideways(placed) + distance(top);
        if (score < best) { best = score; found = placed; }
      }
    }
    if (!found) return null;
    placedRows.push(found);
  }
  return placedRows.flat();
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

export const TARGET_HUD_AURA = Object.freeze({ advantage: '#72d78c', neutral: '#e4cd59', disadvantage: '#f07870' });
export function targetHudMatchup(action, intent, rules = {}) {
  if (!action || !intent || intent.hidden || intent.revealed === false) return 'neutral';
  const normalize = value => ({ casting: 'prepared', preparing: 'prepared', cast: 'prepared', ranged: 'attack', attacking: 'attack', smashing: 'smash', sweeping: 'sweep', defending: 'defend', countering: 'counter', evading: 'evade', block: 'defend' })[value] || value;
  const attack = normalize(action.maneuver || 'prepared'), defense = normalize(intent.profile?.maneuver || intent.stance);
  const table = rules?.matchups || {};
  if (table[attack]?.includes(defense)) return 'advantage';
  if (table[defense]?.includes(attack)) return 'disadvantage';
  return 'neutral';
}

// Reserve enough horizontal room for two narrow detail/control groups before
// the placement solver considers its overlap fallback. Single details keep
// the original readable width and type scale. Values are physical pixels.
export function targetHudPanelSizing({ viewportWidth, count }, config = targetHudConfig()) {
  const sizing = config.sizing;
  const narrow = viewportWidth < (sizing.narrowCrowdedBelowPx ?? 600) && count >= (sizing.narrowCrowdedFrom ?? 2);
  const crowded = narrow || count >= sizing.crowdedFrom;
  return { crowded, narrow, width: narrow ? sizing.narrowCrowdedPanelWidthPx ?? 145
    : crowded ? sizing.crowdedPanelWidthPx : viewportWidth < sizing.compactBelowPx ? sizing.compactPanelWidthPx : sizing.panelWidthPx,
  font: narrow ? sizing.narrowCrowdedFontPx ?? 11 : sizing.fontPx,
  statusSize: narrow ? sizing.narrowCrowdedStatusIconPx ?? 22 : sizing.statusIconPx };
}

// Body landmarks exclude raised weapons and transparent stage canvas. Both
// readouts retain a fixed physical gap when a true pose changes its head.
export function targetBodyHudPlacement({ body, frame, groupHeight = 61, intentHeight = 37, gap = 5, zoom = 1 }) {
  const head = Number.isFinite(body.headY) ? body.headY : body.top;
  return { miniTop: (head - frame.top - gap - groupHeight) / zoom,
    selectedTop: (head - frame.top - gap - intentHeight) / zoom,
    center: ((body.left + body.right) / 2 - frame.left) / zoom };
}

// The rect a panel must keep clear for one enemy's overhead intent, in screen px. A selected frame's intent is moved
// to `selectedTop` over the body centre by the placement written after the panels; an unselected one is not moved,
// so its rendered box is the truth (its group height is per profile and, on phone landscape, its rack is centred on
// the lane rather than the body).
export function targetHudIntentObstacle({ selected, box, placement, intentBox, intentWidth, intentHeight, zoom = 1 }) {
  if (selected) return { left: box.left + placement.center * zoom - intentWidth / 2, top: box.top + placement.selectedTop * zoom, width: intentWidth, height: intentHeight };
  return { left: intentBox.left, top: intentBox.top, width: intentBox.width, height: intentBox.height };
}
