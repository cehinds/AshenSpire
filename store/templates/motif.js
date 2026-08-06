// store/templates/motif.js — the climbing map-graph constellation, drawn once.
//
// The single home for the motif's geometry: every template that shows the
// graph calls drawMotif() so the roads and rings are the same drawing on every
// canvas — a second copy of these coordinates would be a composition nothing
// syncs. Deterministic on purpose (fixed seed, mulberry32 — the same PRNG
// family the game uses for seeded runs): re-running the generator must produce
// the same art, or a diff of store/ means nothing.
//
// The drawing is the game's own language: node rings on roads, climbing
// upward, one traveled line in gold — the act map as constellation. Colours
// come entirely from the CSS classes in store.css (m-edge / m-ring /
// m-traveled), so the palette stays token-driven and this file holds only
// geometry.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw the constellation into `el` (an empty block element).
 * opts.rows/cols shape the climb; opts.traveled marks one gold path;
 * opts.opacity dims the whole layer into the composition.
 */
function drawMotif(el, opts = {}) {
  const rows = opts.rows ?? 6;
  const cols = opts.cols ?? 5;
  const opacity = opts.opacity ?? 0.5;
  const rnd = mulberry32(opts.seed ?? 0x45); // #45 — where the roads earned their contrast
  const W = 1000;
  const H = 600;
  const nodes = []; // grid of {x, y} per row

  for (let r = 0; r < rows; r++) {
    const row = [];
    const y = H - 60 - (r * (H - 140)) / (rows - 1);
    for (let c = 0; c < cols; c++) {
      const x = 120 + (c * (W - 240)) / (cols - 1) + (rnd() - 0.5) * 70;
      row.push({ x, y: y + (rnd() - 0.5) * 36 });
    }
    nodes.push(row);
  }

  // Edges: each node links to 1-2 neighbours a row up, the way the act map
  // branches. The traveled path walks one column drift bottom to top.
  let edges = '';
  const links = []; // [r][c] -> array of target cols in row r+1
  for (let r = 0; r < rows - 1; r++) {
    links.push(nodes[r].map((_, c) => {
      const t = new Set([Math.max(0, Math.min(cols - 1, c + Math.round((rnd() - 0.5) * 2)))]);
      if (rnd() > 0.55) t.add(Math.max(0, Math.min(cols - 1, c + (rnd() > 0.5 ? 1 : -1))));
      return [...t];
    }));
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      for (const t of links[r][c]) {
        const a = nodes[r][c];
        const b = nodes[r + 1][t];
        edges += `<line class="m-edge" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`;
      }
    }
  }

  // One traveled line, gold, following real edges so the story is honest.
  let travel = '';
  const lit = [];
  let c = Math.floor(cols / 2);
  for (let r = 0; r < rows - 1; r++) {
    const t = links[r][c][0];
    const a = nodes[r][c];
    const b = nodes[r + 1][t];
    travel += `<line class="m-traveled" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`;
    lit.push([r, c]);
    c = t;
  }
  lit.push([rows - 1, c]);

  let rings = '';
  const litKey = new Set(lit.map(([r, cc]) => `${r}:${cc}`));
  for (let r = 0; r < rows; r++) {
    for (let cc = 0; cc < cols; cc++) {
      const n = nodes[r][cc];
      const cls = litKey.has(`${r}:${cc}`) ? 'm-ring lit' : 'm-ring';
      rings += `<circle class="${cls}" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${(9 + rnd() * 4).toFixed(1)}"/>`;
    }
  }

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" style="opacity:${opacity}">${edges}${travel}${rings}</svg>`;
}

window.drawMotif = drawMotif;
