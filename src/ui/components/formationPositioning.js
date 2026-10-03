import { FORMATION_GROUPS_KEY, formationGroups, formationGroupOptions, formationGroupContains, formationMember, snapFormationTranslation, FORMATION_SNAP_STEP, positioningConfiguration } from '../../model/formationGroups.js';
import { esc } from './tooltip.js';
import { presentationConfig } from '../../model/advancedConfig.js';
import { t } from '../strings.js';
import { anchorLocalBox, VIEWPORT_ORIGIN } from '../fx.js';
let positioningId = 0;

export function formationPositioningHtml() {
  return `<section class="formation-positioning" aria-label="Positioning editor">
    <label>Move together <select data-position-group aria-label="Move together"></select></label>
    <p class="formation-help">Drag a highlighted anchor or nudge the group. Positive X moves right; positive Y moves down.</p>
    <div class="position-inputs"><label>X · % width<input data-position-x type="number" step="0.5" min="-100" max="100" value="0"></label><label>Y · % height<input data-position-y type="number" step="0.5" min="-100" max="100" value="0"></label></div>
    <label class="position-snap"><input type="checkbox" data-position-snap checked> Snap to grid</label>
    <div class="position-nudges"><button type="button" data-nudge="-1,0" aria-label="Move group left">←</button><button type="button" data-nudge="0,-1" aria-label="Move group up">↑</button><button type="button" data-nudge="0,1" aria-label="Move group down">↓</button><button type="button" data-nudge="1,0" aria-label="Move group right">→</button><label>Grid / step · px<input data-position-step type="number" min="1" max="100" value="${FORMATION_SNAP_STEP}"></label></div>
    <button type="button" data-position-reset>Reset group offset</button>
    <label>Character size · multiplier<input data-position-scale type="number" min="0.25" max="3" step="0.05" value="1"></label>
    <p class="formation-help">Scales the characters in this group with their feet anchored. Parent and child size multipliers combine.</p>
    <details><summary>Custom groups</summary><label>Group name<input data-position-name maxlength="60" placeholder="My group"></label><label>Member positions<select data-position-members multiple size="4" aria-label="Member positions"></select></label><p class="formation-help">Select multiple positions with Ctrl / Command or Shift. Members keep their spacing when moved.</p><button type="button" data-position-create>Create group</button> <button type="button" data-position-delete>Delete selected group</button></details>
    <output data-position-measure aria-live="polite"></output>
    <p class="formation-help">Distances are CSS pixels to ground anchors. Offsets save as percentages for responsive layouts. Groups stop at battlefield edges.</p>
    <p data-position-status role="status"></p>
    <button type="button" data-position-export>Output positioning JSON</button>
    <div data-position-json-panel hidden><label>Positioning JSON<textarea data-position-json readonly rows="8"></textarea></label><button type="button" data-position-download>Download JSON</button></div>
  </section>`;
}

// Shared by combat, Settings and the standalone measured preview.
export function wireFormationPositioning(host, surface, { read, write, getPlan, readPresentation = () => ({formationGroups:read()}), readSpawnTest = () => null, onDraw = () => {}, saveMessage = 'Layout saved.' }) {
  const $ = selector => host.querySelector(selector);
  let selected = 'player', drag = null;
  const gridId = `formation-snap-grid-${++positioningId}`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('position-guides');
  svg.setAttribute('aria-label', t('formation.positioning.dragAnchors'));
  surface.append(svg);
  const group = () => formationGroupOptions(getPlan().plan?.columns || 2, read(), getPlan().plan?.rows || 3).find(g => g.id === selected);
  function draw() {
    const { plan, width, height, viewBox } = getPlan();
    if (!plan || !width || !height) return;
    const groups = formationGroupOptions(plan.columns, read(), plan.rows);
    if (!groups.some(g => g.id === selected)) selected = 'player';
    const active = groups.find(g => g.id === selected);
    if (document.activeElement !== $('[data-position-scale]')) $('[data-position-scale]').value = active.scale;
    $('[data-position-group]').innerHTML = groups.map(g => `<option value="${esc(g.id)}"${g.id === selected ? ' selected' : ''}>${esc(g.name)}</option>`).join('');
    if (!host.contains(document.activeElement) || !document.activeElement.matches('[data-position-x],[data-position-y]')) {
      $('[data-position-x]').value = Number(active.x.toFixed(3)); $('[data-position-y]').value = Number(active.y.toFixed(3));
    }
    const memberSelect = $('[data-position-members]');
    const signature = plan.cells.map(formationMember).join(',');
    if (memberSelect.dataset.signature !== signature) {
      memberSelect.innerHTML = plan.cells.map(c => `<option value="${formationMember(c)}">${c.side} · ${c.cell}</option>`).join('');
      memberSelect.dataset.signature = signature;
    }
    $('[data-position-delete]').disabled = !selected.startsWith('custom-');
    const members = plan.cells.filter(c => formationGroupContains(active, c));
    svg.setAttribute('viewBox', viewBox || `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', viewBox ? 'xMidYMid meet' : 'none');
    const first = members[0];
    const step = Math.max(1, Math.min(100, Number($('[data-position-step]').value) || FORMATION_SNAP_STEP));
    const snapGrid = $('[data-position-snap]').checked ? `<defs><pattern id="${gridId}" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><path d="M ${step} 0 H 0 V ${step}" fill="none" stroke="#b8d3de" stroke-width=".5" opacity=".22"/></pattern></defs><rect width="${width}" height="${height}" fill="url(#${gridId})"/>` : '';
    svg.innerHTML = snapGrid + (first ? `<path d="M ${first.x} 0 V ${height} M 0 ${first.ground} H ${width}" fill="none" stroke="#ead38b" stroke-dasharray="5 5"/>` : '')
      + plan.cells.map(c => `<g data-position-anchor="${c.cell}" transform="translate(${c.x} ${c.ground})"><circle r="14" fill="${members.includes(c) ? '#ead38b' : '#1b303a'}" stroke="${c.side === 'player' ? '#82d5e7' : '#efaaa0'}" stroke-width="2"/><text text-anchor="middle" dy="4" font-size="11" fill="${members.includes(c) ? '#10212c' : '#fff'}">${c.cell}</text></g>`).join('');
    $('[data-position-measure]').textContent = first ? `${members.length} positions · ${first.cell} anchor: left ${first.x.toFixed(1)} px · right ${(width-first.x).toFixed(1)} px · top ${first.ground.toFixed(1)} px · bottom ${(height-first.ground).toFixed(1)} px` : 'This group has no positions in the current grid.';
  }
  function save(groups, message = saveMessage) {
    if (write(JSON.stringify(groups))?.ok === false) { $('[data-position-status]').textContent = t('formation.layout.saveFailed'); return; }
    $('[data-position-status]').textContent = message; onDraw(); draw();
  }
  function move(x, y) {
    const active = group(); if (!active) return;
    const { plan, width, height } = getPlan();
    const members = plan.cells.filter(c => formationGroupContains(active, c));
    if (members.length) {
      if ($('[data-position-snap]').checked) {
        const step = Math.max(1, Math.min(100, Number($('[data-position-step]').value) || FORMATION_SNAP_STEP));
        const delta = snapFormationTranslation(members, (x-active.x)*width/100, (y-active.y)*height/100, step);
        x = active.x + delta.dx/width*100; y = active.y + delta.dy/height*100;
      }
      x = active.x + Math.max(-Math.min(...members.map(c => c.x)), Math.min(width-Math.max(...members.map(c => c.x)), (x-active.x)*width/100))/width*100;
      y = active.y + Math.max(-Math.min(...members.map(c => c.ground)), Math.min(height-Math.max(...members.map(c => c.ground)), (y-active.y)*height/100))/height*100;
    }
    const groups = formationGroups(read());
    const value = { ...active, x: Math.max(-100, Math.min(100, x)), y: Math.max(-100, Math.min(100, y)) };
    const index = groups.findIndex(g => g.id === selected);
    if (index < 0) groups.push(value); else groups[index] = value;
    save(groups);
  }
  $('[data-position-group]').addEventListener('change', event => { selected = event.target.value; draw(); });
  $('[data-position-snap]').addEventListener('change', draw);
  $('[data-position-step]').addEventListener('change', draw);
  const changeScale = event => {
    if (event.target.value.trim() === '') return;
    const value = Number(event.target.value); if (!Number.isFinite(value)) return;
    if (event.type === 'input' && (value < .25 || value > 3)) return;
    const active = group(), groups = formationGroups(read());
    const next = { ...active, scale: Math.max(.25, Math.min(3, value)) };
    if (next.scale === active.scale) return;
    const index = groups.findIndex(g => g.id === active.id);
    if (index < 0) groups.push(next); else groups[index] = next;
    event.target.value = next.scale; save(groups);
  };
  $('[data-position-scale]').addEventListener('input', changeScale);
  $('[data-position-scale]').addEventListener('change', changeScale);
  function exportJson() {
    return JSON.stringify(positioningConfiguration(readPresentation(), { ...getPlan(),
      snapStep: Number($('[data-position-step]').value) || FORMATION_SNAP_STEP,
      snapToGrid: $('[data-position-snap]').checked, spawnTest: readSpawnTest() }), null, 2);
  }
  $('[data-position-export]').addEventListener('click', () => {
    $('[data-position-json-panel]').hidden = false; $('[data-position-json]').value = exportJson();
  });
  $('[data-position-download]').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'AshenSpire-positioning.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  for (const axis of ['x', 'y']) $('[data-position-'+axis+']').addEventListener('change', event => {
    const value = Number(event.target.value); if (!Number.isFinite(value)) return;
    const active = group(); move(axis === 'x' ? value : active.x, axis === 'y' ? value : active.y);
  });
  host.querySelectorAll('[data-nudge]').forEach(button => button.addEventListener('click', () => {
    const [x,y] = button.dataset.nudge.split(',').map(Number), active = group(), { width, height } = getPlan();
    const step = Math.max(1, Math.min(100, Number($('[data-position-step]').value) || FORMATION_SNAP_STEP));
    move(active.x + x * step / width * 100, active.y + y * step / height * 100);
  }));
  $('[data-position-reset]').addEventListener('click', () => save(formationGroups(read()).map(g => g.id === selected ? { ...g, x: 0, y: 0 } : g)));
  $('[data-position-create]').addEventListener('click', () => {
    const members = [...$('[data-position-members]').selectedOptions].map(o => o.value);
    if (!members.length) { $('[data-position-status]').textContent = t('formation.positioning.selectMembers'); return; }
    const groups = formationGroups(read());
    if (groups.length >= 32) { $('[data-position-status]').textContent = t('formation.positioning.groupLimit'); return; }
    selected = `custom-${Date.now()}`;
    groups.push({ id: selected, name: $('[data-position-name]').value.trim() || 'My group', members, x: 0, y: 0 }); save(groups, 'Group created.');
  });
  $('[data-position-delete]').addEventListener('click', () => { if (selected.startsWith('custom-')) save(formationGroups(read()).filter(g => g.id !== selected), 'Group deleted.'); });
  const pointerPoint = event => new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
  svg.addEventListener('pointerdown', event => {
    if (!event.target.closest('[data-position-anchor]')) return;
    const { plan, width, height } = getPlan(), active = group();
    const cell = plan.cells.find(c => c.cell === event.target.closest('[data-position-anchor]').dataset.positionAnchor);
    if (!formationGroupContains(active, cell)) return;
    const point = pointerPoint(event);
    drag = { point, clientX: event.clientX, clientY: event.clientY, x: active.x, y: active.y, width, height };
    svg.setPointerCapture(event.pointerId); event.preventDefault();
  });
  // Save once when released, so dragging does not continually write the profile.
  svg.addEventListener('pointermove', event => {
    if (!drag) return;
    const { plan } = getPlan(), point = pointerPoint(event);
    const members = plan.cells.filter(c => formationGroupContains(group(), c));
    let dx = point.x-drag.point.x, dy = point.y-drag.point.y;
    if ($('[data-position-snap]').checked) {
      const step = Math.max(1, Math.min(100, Number($('[data-position-step]').value) || FORMATION_SNAP_STEP));
      ({ dx, dy } = snapFormationTranslation(members, dx, dy, step));
    }
    for (const cell of members) {
      svg.querySelector(`[data-position-anchor="${cell.cell}"]`).setAttribute('transform', `translate(${cell.x+dx} ${cell.ground+dy})`);
    }
  });
  svg.addEventListener('pointerup', event => {
    if (!drag) return;
    const start = drag; drag = null; svg.style.transform = '';
    if (Math.hypot(event.clientX-start.clientX, event.clientY-start.clientY) < 3) { draw(); return; }
    const point = pointerPoint(event);
    move(start.x + (point.x-start.point.x)/start.width*100, start.y + (point.y-start.point.y)/start.height*100);
  });
  svg.addEventListener('pointercancel', () => { drag = null; draw(); });
  draw();
  return { draw, svg, release: () => svg.remove() };
}

export function wireCombatPositioning(root, { readSettings, onSettingsChange, onExpand }) {
  const field = root.querySelector('.field'), toggle = root.querySelector('[data-position-toggle]'), panel = root.querySelector('[data-position-panel]');
  let editor = null;
  toggle.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open; toggle.setAttribute('aria-pressed', String(open));
    field.dataset.positionEditing = String(open);
    if (!open) { editor?.release(); editor = null; return; }
    panel.innerHTML = `<header class="position-panel-heading"><button type="button" data-position-drag>Drag panel</button><button type="button" data-position-expand>Expand positioning &amp; sizing</button></header>` + formationPositioningHtml();
    wirePositionWindow(panel.querySelector('[data-position-drag]'), panel.parentElement);
    panel.querySelector('[data-position-expand]').addEventListener('click', () => onExpand?.());
    editor = wireFormationPositioning(panel, field, {
      read: () => readSettings()[FORMATION_GROUPS_KEY],
      write: value => onSettingsChange({ [FORMATION_GROUPS_KEY]: value }),
      readPresentation: () => presentationConfig(readSettings()),
      getPlan: () => field.formationPlan || { plan: null, columns: 2, width: 1, height: 1 },
    });
  });
  field.addEventListener('formationlayoutchange', () => editor?.draw());
}

export function wirePositionWindow(handle, target) {
  let windowDrag, dragZoom = 1;
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const rect = target.getBoundingClientRect(), parent = target.offsetParent?.getBoundingClientRect() || {left:0,top:0};
    const zoom = rect.width / target.offsetWidth || 1;
    const origin = anchorLocalBox(parent, rect, {zoom});
    const start = anchorLocalBox(VIEWPORT_ORIGIN, {left:event.clientX,top:event.clientY,width:0,height:0}, {zoom});
    windowDrag = { origin, start };
    dragZoom = zoom;
    target.style.margin = '0'; target.style.right = 'auto'; target.style.bottom = 'auto';
    target.style.left = `${origin.left}px`; target.style.top = `${origin.top}px`;
    handle.setPointerCapture(event.pointerId); event.preventDefault();
  });
  handle.addEventListener('pointermove', event => {
    if (!windowDrag) return;
    const parent = target.offsetParent;
    const view = anchorLocalBox(VIEWPORT_ORIGIN, {left:0,top:0,width:window.innerWidth,height:window.innerHeight}, {zoom:dragZoom});
    const point = anchorLocalBox(VIEWPORT_ORIGIN, {left:event.clientX,top:event.clientY,width:0,height:0}, {zoom:dragZoom});
    const grip = anchorLocalBox(VIEWPORT_ORIGIN, {left:0,top:0,width:0,height:48}, {zoom:dragZoom});
    const width = parent?.clientWidth || view.width, height = parent?.clientHeight || view.height;
    target.style.left = `${Math.max(0, Math.min(width-target.offsetWidth,windowDrag.origin.left+point.left-windowDrag.start.left))}px`;
    target.style.top = `${Math.max(0, Math.min(height-grip.height,windowDrag.origin.top+point.top-windowDrag.start.top))}px`;
  });
  for (const name of ['pointerup','pointercancel']) handle.addEventListener(name, () => { windowDrag = null; });
}
