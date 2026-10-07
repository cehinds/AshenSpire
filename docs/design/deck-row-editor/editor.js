import { assetUrl } from '../../../src/ui/assetmap.js';

const KEY = 'ashenspire.deck-row-layout.v1';
export const COMPONENTS = Object.freeze(['harness', 'grip', 'art', 'title', 'type', 'description', 'manaIcon', 'manaValue', 'staminaIcon', 'staminaValue', 'actionSigil', 'inspect', 'count']);
const LABELS = { grip: 'Reorder grip', art: 'Card artwork', title: 'Title', type: 'Card type', description: 'Description', manaIcon: 'MP diamond', manaValue: 'MP number', staminaIcon: 'SP orb', staminaValue: 'SP number', harness: 'Cost harness', actionSigil: 'Action sigil', inspect: 'Inspect', count: 'Number in deck' };
const box = (x, y, width, height, fontSize = 12) => ({ x, y, width, height, fontSize, visible: true });
export function defaultLayout() {
  return { version: 1, row: { width: 520, height: 86 }, grid: 4, snap: true, elements: {
    harness: { ...box(368, 9, 136, 46), visible: false }, actionSigil: { ...box(494, 20, 20, 25), visible: false },
    grip: box(8, 25, 14, 34, 20), art: box(31, 14, 58, 58),
    title: box(102, 10, 168, 23, 16), type: box(276, 13, 72, 17, 10),
    description: box(102, 37, 280, 33, 11), manaIcon: box(406, 11, 38, 38), manaValue: box(406, 11, 38, 38, 19),
    staminaIcon: box(458, 11, 38, 38), staminaValue: box(458, 11, 38, 38, 19), inspect: box(406, 55, 64, 20, 10), count: box(478, 55, 30, 20, 11),
  } };
}
export function clampBox(value, row) {
  const width = Math.min(row.width, Math.max(8, value.width));
  const height = Math.min(row.height, Math.max(8, value.height));
  return { ...value, width, height, x: Math.max(0, Math.min(row.width - width, value.x)), y: Math.max(0, Math.min(row.height - height, value.y)) };
}
export function validateLayout(input) {
  if (!input || input.version !== 1 || !input.row || !input.elements) throw new Error('Expected a version 1 card row layout.');
  const finite = (v, lo, hi, label) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) throw new Error(`${label} must be between ${lo} and ${hi}.`); return v; };
  const row = { width: finite(input.row.width, 200, 1600, 'Row width'), height: finite(input.row.height, 48, 400, 'Row height') };
  if (Object.keys(input.elements).length !== COMPONENTS.length || Object.keys(input.elements).some(id => !COMPONENTS.includes(id))) throw new Error(`The layout must contain all ${COMPONENTS.length} known components.`);
  if (input.snap !== undefined && typeof input.snap !== 'boolean') throw new Error('Snap must be true or false.');
  const elements = {};
  for (const id of COMPONENTS) {
    const item = input.elements[id];
    if (!item || typeof item.visible !== 'boolean') throw new Error(`${LABELS[id]} needs a visibility setting.`);
    elements[id] = clampBox({ x: finite(item.x, 0, row.width, `${id} X`), y: finite(item.y, 0, row.height, `${id} Y`), width: finite(item.width, 8, row.width, `${id} width`), height: finite(item.height, 8, row.height, `${id} height`), fontSize: finite(item.fontSize, 6, 72, `${id} font size`), visible: item.visible }, row);
  }
  return { version: 1, row, grid: finite(input.grid ?? 4, 1, 64, 'Grid size'), snap: input.snap !== false, elements };
}

/** Snap a moving box to grid, row edges, and the edges/centres of visible peers. */
export function snapBox(value, layout, id, resizing = false, tolerance = 5) {
  let result = clampBox(value, layout.row);
  const guides = [];
  if (!layout.snap) return { box: result, guides };
  const peers = Object.entries(layout.elements).filter(([key, item]) => key !== id && item.visible).map(([, item]) => item);
  for (const axis of ['x', 'y']) {
    const size = axis === 'x' ? 'width' : 'height';
    const edge = layout.row[size];
    const targets = [0, edge / 2, edge, ...peers.flatMap(item => [item[axis], item[axis] + item[size] / 2, item[axis] + item[size]])];
    const current = resizing ? [result[axis] + result[size]] : [result[axis], result[axis] + result[size] / 2, result[axis] + result[size]];
    let best = null;
    for (const target of targets) for (const point of current) {
      const delta = target - point;
      if (Math.abs(delta) <= tolerance && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, target };
    }
    if (best) {
      result[resizing ? size : axis] += best.delta;
      guides.push({ axis, position: best.target });
    } else if (resizing) result[size] = Math.round(result[size] / layout.grid) * layout.grid;
    else result[axis] = Math.round(result[axis] / layout.grid) * layout.grid;
  }
  return { box: clampBox(result, layout.row), guides };
}

if (typeof document !== 'undefined' && document.getElementById('row')) {
  const $ = (id) => document.getElementById(id);
  let layout = defaultLayout();
  let selected = 'title';
  let gesture = null;
  let scale = 1;
  const nodes = new Map();
  const layers = new Map();
  const status = (text, error = false) => { $('status').textContent = text; $('status').classList.toggle('error', error); };
  try { const stored = localStorage.getItem(KEY); if (stored) layout = validateLayout(JSON.parse(stored)); } catch { status('Saved draft could not be read. Loaded the default layout.', true); }
  const picture = (id, alt) => { const img = document.createElement('img'); img.src = new URL(assetUrl(id), new URL('../../../', import.meta.url)).href; img.alt = alt; img.draggable = false; return img; };
  const text = (value, className = '') => { const node = document.createElement('span'); node.textContent = value; node.className = className; return node; };
  for (const id of COMPONENTS) {
    const node = document.createElement('div'); node.className = `component ${id}`; node.dataset.id = id; node.dataset.label = LABELS[id]; node.tabIndex = 0; node.setAttribute('role', 'button'); node.setAttribute('aria-label', `Select ${LABELS[id]}`);
    const visual = document.createElement('div'); visual.className = 'visual';
    if (id === 'art') visual.append(picture('assets/cards/gorefire-slash-512.webp', 'Gorefire Slash artwork'));
    else if (['manaIcon', 'staminaIcon', 'harness', 'actionSigil'].includes(id)) visual.append(picture(`assets/ui/stamina-orb/${({ manaIcon: 'diamond', staminaIcon: 'orb', harness: 'frame', actionSigil: 'sigil' })[id]}.webp`, LABELS[id]));
    else visual.append(text(({ manaValue: '1', staminaValue: '2', grip: '⠿', title: 'Gorefire Slash', type: 'ATTACK', description: 'Deal 8 damage. Apply 2 Bleed. In Gorefire, deal 3 additional damage.', inspect: 'Inspect', count: '×1' })[id], id === 'description' ? 'text' : ''));
    const handle = document.createElement('span'); handle.className = 'resize'; handle.setAttribute('aria-hidden', 'true');
    node.append(visual, handle); $('row').append(node); nodes.set(id, node);
    const layer = document.createElement('div'); layer.className = 'layer';
    const visible = document.createElement('input'); visible.type = 'checkbox'; visible.setAttribute('aria-label', `Show ${LABELS[id]}`); visible.addEventListener('change', () => { layout.elements[id].visible = visible.checked; render(); save(); });
    const button = document.createElement('button'); button.textContent = LABELS[id]; button.addEventListener('click', () => select(id)); layer.append(visible, button); $('layers').append(layer); layers.set(id, { visible, button });
    node.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault(); select(id); node.focus({ preventScroll: true });
      gesture = { id, x: event.clientX, y: event.clientY, initial: { ...layout.elements[id] }, resize: event.target === handle, pointer: event.pointerId };
      node.setPointerCapture(event.pointerId);
    });
    node.addEventListener('pointermove', event => {
      if (!gesture || gesture.id !== id || gesture.pointer !== event.pointerId) return;
      const dx = (event.clientX - gesture.x) / scale, dy = (event.clientY - gesture.y) / scale;
      const value = { ...gesture.initial };
      if (gesture.resize) { value.width += dx; value.height += dy; }
      else { value.x += dx; value.y += dy; }
      const moved = snapBox(value, event.altKey ? { ...layout, snap: false } : layout, id, gesture.resize);
      layout.elements[id] = moved.box; render(moved.guides);
    });
    const finish = () => { if (gesture?.id !== id) return; gesture = null; render(); save(); };
    node.addEventListener('pointerup', finish); node.addEventListener('pointercancel', finish); node.addEventListener('lostpointercapture', finish);
    node.addEventListener('focus', () => select(id));
  }
  function select(id) { selected = id; render(); }
  function fit() {
    scale = Math.min(1.65, ($('stage').clientWidth - 60) / layout.row.width, ($('stage').clientHeight - 125) / layout.row.height);
    scale = Math.max(.15, scale); $('canvas-wrap').style.width = `${layout.row.width * scale}px`; $('canvas-wrap').style.height = `${layout.row.height * scale}px`; $('row').style.transform = `scale(${scale})`;
  }
  function render(guides = []) {
    $('row').style.width = `${layout.row.width}px`; $('row').style.height = `${layout.row.height}px`;
    for (const [id, node] of nodes) {
      const item = layout.elements[id]; Object.assign(node.style, { left: `${item.x}px`, top: `${item.y}px`, width: `${item.width}px`, height: `${item.height}px`, fontSize: `${item.fontSize}px`, display: item.visible ? '' : 'none' });
      node.classList.toggle('selected', id === selected); node.setAttribute('aria-pressed', String(id === selected)); layers.get(id).button.classList.toggle('active', id === selected); layers.get(id).visible.checked = item.visible;
    }
    $('row').querySelectorAll('.guide').forEach(node => node.remove());
    for (const guide of guides) { const node = document.createElement('div'); node.className = `guide ${guide.axis}`; node.style[guide.axis === 'x' ? 'left' : 'top'] = `${guide.position}px`; $('row').append(node); }
    $('selected-name').textContent = LABELS[selected];
    document.querySelectorAll('[data-field]').forEach(input => { const value = layout.elements[selected][input.dataset.field]; if (input.type === 'checkbox') input.checked = value; else if (document.activeElement !== input) input.value = Math.round(value * 100) / 100; });
    for (const field of ['width', 'height']) if (document.activeElement !== $(`row-${field}`)) $(`row-${field}`).value = layout.row[field];
    $('snap').checked = layout.snap; if (document.activeElement !== $('grid')) $('grid').value = layout.grid;
    $('size-label').textContent = `${layout.row.width} × ${layout.row.height}`;
    if (document.activeElement !== $('json')) $('json').value = JSON.stringify(layout, null, 2);
    fit();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(layout)); status('Draft saved in this browser.'); } catch { status('Browser storage is unavailable. Download JSON to keep this layout.', true); } }
  document.querySelectorAll('[data-field]').forEach(input => input.addEventListener('change', () => {
    const field = input.dataset.field, value = input.type === 'checkbox' ? input.checked : Number(input.value);
    if (typeof value === 'number' && !Number.isFinite(value)) { status('Enter a finite number.', true); render(); return; }
    let next = { ...layout.elements[selected], [field]: value };
    next.fontSize = Math.max(6, Math.min(72, next.fontSize)); layout.elements[selected] = clampBox(next, layout.row); input.blur(); render(); save();
  }));
  for (const field of ['width', 'height']) $(`row-${field}`).addEventListener('change', event => { const range = field === 'width' ? [200, 1600] : [48, 400]; const value = Number(event.target.value); if (!Number.isFinite(value)) return; layout.row[field] = Math.max(range[0], Math.min(range[1], value)); for (const id of COMPONENTS) layout.elements[id] = clampBox(layout.elements[id], layout.row); event.target.blur(); render(); save(); });
  $('row').addEventListener('keydown', event => { const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]; if (!delta) return; event.preventDefault(); const item = layout.elements[selected], step = event.shiftKey ? 10 : 1; layout.elements[selected] = clampBox({ ...item, x: item.x + delta[0] * step, y: item.y + delta[1] * step }, layout.row); render(); save(); });
  $('wireframe').addEventListener('change', () => $('row').classList.toggle('wireframe', $('wireframe').checked));
  $('snap').addEventListener('change', () => { layout.snap = $('snap').checked; render(); save(); });
  $('grid').addEventListener('change', () => { layout.grid = Math.max(1, Math.min(64, Number($('grid').value) || 4)); $('grid').blur(); render(); save(); });
  $('reset').addEventListener('click', () => { layout = defaultLayout(); render(); save(); });
  const importText = value => { try { const next = validateLayout(JSON.parse(value)); layout = next; $('json').blur(); render(); save(); status('Layout imported and saved.'); } catch (error) { status(`Import refused: ${error.message}`, true); } };
  $('import').addEventListener('click', () => importText($('json').value));
  $('file').addEventListener('change', async event => { const file = event.target.files[0]; if (file) { if (file.size > 100000) status('Import refused: file exceeds 100 KB.', true); else importText(await file.text()); } event.target.value = ''; });
  $('copy').addEventListener('click', async () => { const value = JSON.stringify(layout, null, 2); $('json').value = value; try { await navigator.clipboard.writeText(value); status('Layout JSON copied.'); } catch { $('json').focus(); $('json').select(); status('Select-all is ready. Press Ctrl+C to copy.'); } });
  $('download').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'ashenspire-deck-row-layout.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); status('Layout JSON downloaded.'); });
  new ResizeObserver(fit).observe($('stage')); render();
}
