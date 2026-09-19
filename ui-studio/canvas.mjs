// ui-studio/canvas.mjs — the wireframe as SVG text. Pure: it takes a view and
// returns markup; app.mjs owns the pointer state machine and reads the
// `data-hit` attributes this file writes to know what was pressed.
//
//   data-hit="bg"                         empty canvas
//   data-hit="region:<id>"                a config region (select)
//   data-hit="bandEdge:<index>:<id>"      the lower edge of band <index>
//   data-hit="edge:<id>:<axis>"           a region's editable edge (w or h)
//   data-hit="box:<id>"                   a sketch box (select / move)
//   data-hit="grip:<id>:<dir>"            a sketch box's resize grip

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (n) => (Math.round(n * 100) / 100).toString();

/**
 * canvasSvg(view) → SVG markup.
 * view: { viewport, scale, grid, canvas, mode: 'config'|'sketch', regions, boxes,
 *         selection: Set<string>, guides: [{axis, at}], marquee, tool, compact }
 * `boxes` are sketch boxes already resolved to viewport px: { id, label, x, y, w, h, locked, hidden, overridden }.
 * `compact` drops rulers, grips and grid for thumbnails.
 */
export function canvasSvg(view) {
  const { viewport, scale, grid, canvas = {}, regions = [], boxes = [], selection = new Set(), guides = [], marquee = null, compact = false } = view;
  const W = viewport.width, H = viewport.height;
  const rulers = !compact && canvas.showRulers !== false;
  const R = rulers ? 20 : 0;
  const width = R + W * scale, height = R + H * scale;
  const parts = [];
  const px = (v) => f(v * scale);

  // Grid: minor lines every sizePx / subdivisions, major every sizePx, in device px.
  const minor = grid.sizePx / Math.max(1, grid.subdivisions);
  const showGrid = !compact && grid.show && grid.sizePx * scale >= 4;
  if (showGrid) {
    const minorFill = minor * scale >= 4 ? `<rect width="${px(grid.sizePx)}" height="${px(grid.sizePx)}" fill="url(#minor)"/>` : '';
    parts.push(`<defs><pattern id="minor" width="${px(minor)}" height="${px(minor)}" patternUnits="userSpaceOnUse"><path d="M ${px(minor)} 0 L 0 0 0 ${px(minor)}" fill="none" stroke="var(--grid)" stroke-width="1"/></pattern>` +
      `<pattern id="major" width="${px(grid.sizePx)}" height="${px(grid.sizePx)}" patternUnits="userSpaceOnUse">${minorFill}<path d="M ${px(grid.sizePx)} 0 L 0 0 0 ${px(grid.sizePx)}" fill="none" stroke="var(--grid-major)" stroke-width="1"/></pattern></defs>`);
  }

  parts.push(`<g transform="translate(${R} ${R})">`);
  parts.push(`<rect class="frame" data-hit="bg" x="0" y="0" width="${px(W)}" height="${px(H)}"/>`);
  if (showGrid) parts.push(`<rect data-hit="bg" x="0" y="0" width="${px(W)}" height="${px(H)}" fill="url(#major)"/>`);
  const s = viewport.safeArea || {};
  if (canvas.showSafeArea !== false && (s.top || s.bottom || s.left || s.right)) {
    if (s.top) parts.push(`<rect class="safe" data-hit="bg" x="0" y="0" width="${px(W)}" height="${px(s.top)}"/>`);
    if (s.bottom) parts.push(`<rect class="safe" data-hit="bg" x="0" y="${px(H - s.bottom)}" width="${px(W)}" height="${px(s.bottom)}"/>`);
    if (s.left) parts.push(`<rect class="safe" data-hit="bg" x="0" y="0" width="${px(s.left)}" height="${px(H)}"/>`);
    if (s.right) parts.push(`<rect class="safe" data-hit="bg" x="${px(W - s.right)}" y="0" width="${px(s.right)}" height="${px(H)}"/>`);
  }

  // Config regions. Handles are collected and emitted after every region, so
  // the next band's fill never covers the previous band's edge handle.
  const handles = [];
  for (const r of regions) {
    const sel = selection.has(r.id);
    if (r.line) {
      parts.push(`<line class="region line${sel ? ' selected' : ''}" data-hit="region:${esc(r.id)}" x1="${px(r.x)}" y1="${px(r.y)}" x2="${px(r.x + r.w)}" y2="${px(r.y)}" vector-effect="non-scaling-stroke"/>`);
      if (r.edit && !compact) handles.push(`<rect class="handle-h" data-hit="edge:${esc(r.id)}:h" x="${px(r.x)}" y="${f(r.y * scale - 4)}" width="${px(r.w)}" height="8"/>`);
      if (canvas.showLabels !== false) parts.push(`<text class="label" x="${f(r.x * scale + 4)}" y="${f(r.y * scale - 3)}">${esc(r.label)}</text>`);
      continue;
    }
    parts.push(`<rect class="region${r.dashed ? ' dashed' : ''}${sel ? ' selected' : ''}" data-hit="region:${esc(r.id)}" x="${px(r.x)}" y="${px(r.y)}" width="${px(Math.max(0, r.w))}" height="${px(Math.max(0, r.h))}" vector-effect="non-scaling-stroke"/>`);
    if (canvas.showLabels !== false && (!compact || (r.h * scale > 12 && !r.dashed))) {
      // Dashed overlays label at their foot so they do not sit on the band's own label.
      parts.push(r.dashed
        ? `<text class="label" x="${f(r.x * scale + 5)}" y="${f((r.y + r.h) * scale - 5)}">${esc(r.label)}</text>`
        : `<text class="label" x="${f(r.x * scale + 5)}" y="${f(r.y * scale + 13)}">${esc(r.label)}</text>`);
      if (r.note && !compact) parts.push(`<text class="label note" x="${f(r.x * scale + 5)}" y="${f(r.y * scale + 26)}">⚠ ${esc(r.note)}</text>`);
    }
    if (r.edit && !compact) {
      if (r.edit.kind === 'bandEdge') handles.push(`<rect class="handle-h" data-hit="bandEdge:${r.edit.index}:${esc(r.id)}" x="${px(r.x)}" y="${f((r.y + r.h) * scale - 4)}" width="${px(r.w)}" height="8"/>`);
      else if (r.edit.axis === 'w') handles.push(`<rect class="handle-v" data-hit="edge:${esc(r.id)}:w" x="${f((r.x + r.w) * scale - 4)}" y="${px(r.y)}" width="8" height="${px(r.h)}"/>`);
      else if (r.edit.axis === 'h' || r.edit.kind === 'path') handles.push(`<rect class="handle-h" data-hit="edge:${esc(r.id)}:h" x="${px(r.x)}" y="${f((r.edit.anchor === 'bottom' ? r.y : r.y + r.h) * scale - 4)}" width="${px(r.w)}" height="8"/>`);
      if (r.edit.pathH) handles.push(`<rect class="handle-h" data-hit="edge:${esc(r.id)}:h" x="${px(r.x)}" y="${f((r.y + r.h) * scale - 4)}" width="${px(r.w)}" height="8"/>`);
    }
  }

  parts.push(...handles);

  // Sketch boxes, in layer order (last on top).
  for (const b of boxes) {
    if (b.hidden) continue;
    const sel = selection.has(b.id);
    parts.push(`<rect class="box${sel ? ' selected' : ''}${b.locked ? ' locked' : ''}${b.overridden ? ' overridden' : ''}" data-hit="box:${esc(b.id)}" x="${px(b.x)}" y="${px(b.y)}" width="${px(Math.max(1, b.w))}" height="${px(Math.max(1, b.h))}" vector-effect="non-scaling-stroke"/>`);
    if (canvas.showLabels !== false && (!compact || b.h * scale > 10)) parts.push(`<text class="label" x="${f(b.x * scale + 5)}" y="${f(b.y * scale + 13)}">${esc(b.label)}${compact ? '' : ` <tspan fill="var(--text-dim)">${f(b.w)}×${f(b.h)}</tspan>`}</text>`);
    if (sel && !compact && !b.locked) {
      const g = 4;
      const grips = { nw: [b.x, b.y], n: [b.x + b.w / 2, b.y], ne: [b.x + b.w, b.y], e: [b.x + b.w, b.y + b.h / 2], se: [b.x + b.w, b.y + b.h], s: [b.x + b.w / 2, b.y + b.h], sw: [b.x, b.y + b.h], w: [b.x, b.y + b.h / 2] };
      for (const [dir, [gx, gy]] of Object.entries(grips)) parts.push(`<rect class="grip ${dir}" data-hit="grip:${esc(b.id)}:${dir}" x="${f(gx * scale - g)}" y="${f(gy * scale - g)}" width="${g * 2}" height="${g * 2}"/>`);
    }
  }

  for (const g of guides) {
    if (g.axis === 'x') parts.push(`<line class="guide" x1="${px(g.at)}" y1="0" x2="${px(g.at)}" y2="${px(H)}"/>`);
    else parts.push(`<line class="guide" x1="0" y1="${px(g.at)}" x2="${px(W)}" y2="${px(g.at)}"/>`);
  }
  if (marquee) parts.push(`<rect class="marquee" x="${px(Math.min(marquee.x0, marquee.x1))}" y="${px(Math.min(marquee.y0, marquee.y1))}" width="${px(Math.abs(marquee.x1 - marquee.x0))}" height="${px(Math.abs(marquee.y1 - marquee.y0))}"/>`);
  parts.push('</g>');

  if (rulers) {
    parts.push(`<rect class="ruler" x="0" y="0" width="${f(width)}" height="${R}"/><rect class="ruler" x="0" y="0" width="${R}" height="${f(height)}"/>`);
    const step = rulerStep(scale);
    for (let v = 0; v <= W; v += step) {
      const major = v % (step * 5) === 0;
      parts.push(`<line class="tick" x1="${f(R + v * scale)}" y1="${major ? 8 : 14}" x2="${f(R + v * scale)}" y2="${R}"/>`);
      if (major) parts.push(`<text class="ruler-label" x="${f(R + v * scale + 2)}" y="8">${v}</text>`);
    }
    for (let v = 0; v <= H; v += step) {
      const major = v % (step * 5) === 0;
      parts.push(`<line class="tick" x1="${major ? 8 : 14}" y1="${f(R + v * scale)}" x2="${R}" y2="${f(R + v * scale)}"/>`);
      if (major) parts.push(`<text class="ruler-label" transform="translate(8 ${f(R + v * scale + 2)}) rotate(90)">${v}</text>`);
    }
  }
  const cls = `canvas${view.tool ? ` tool-${view.tool}` : ''}${compact ? ' compact' : ''}`;
  return `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" width="${f(width)}" height="${f(height)}" viewBox="0 0 ${f(width)} ${f(height)}" data-ruler="${R}" data-scale="${scale}">${parts.join('')}</svg>`;
}

/** A ruler step in device px that keeps ticks at least ~6 screen px apart. */
export function rulerStep(scale) {
  for (const step of [2, 5, 10, 20, 25, 50, 100, 200, 500, 1000]) if (step * scale >= 6) return step;
  return 1000;
}

/** Turn a pointer event into device-px coordinates on the canvas SVG. */
export function pointerToDevice(svg, event) {
  const rect = svg.getBoundingClientRect();
  const R = Number(svg.dataset.ruler || 0), scale = Number(svg.dataset.scale || 1);
  return { x: (event.clientX - rect.left - R) / scale, y: (event.clientY - rect.top - R) / scale };
}
