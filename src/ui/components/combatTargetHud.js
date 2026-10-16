import { t } from '../strings.js';
import { setCombatantTargetHud } from './combatantFrame.js';
import { targetHudConfig, targetHudEnabled, placeTargetHudPanels, createTargetHudDwell } from '../models/TargetHudModel.js';
import { classicAppearance } from '../displayAppearance.js';
import { combatIntentPresentation } from '../models/CombatIntentModel.js';
import { intentIcon } from './intentIcon.js';
import { attachTooltip, esc } from './tooltip.js';
import { reducedMotionRequested } from '../motion.js';

const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
const contains = (r, x, y, pad = 0) => x >= r.left - pad && x <= r.left + r.width + pad && y >= r.top - pad && y <= r.top + r.height + pad;
function corridor(a, b, x, y, radius) {
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2, bx = b.left + b.width / 2, by = b.top + b.height / 2;
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy) <= radius;
}
function node(tag, className, text) { const n = document.createElement(tag); n.className = className; if (text != null) n.textContent = text; return n; }

function intentRow(entry) {
  const row = node('div', 'target-hud-intent');
  const badge = entry.intent ? combatIntentPresentation(entry.intent) : null;
  const action = entry.action?.maneuver || 'ready';
  const playerIcon = ({ attack: 'attack', smash: 'smash', sweep: 'sweep', counter: 'counter', defend: 'defend', evade: 'evade' })[action] || 'prepare';
  const title = badge?.title || (['casting', 'prepared'].includes(action) ? t('combat.targetHud.prepare') : action === 'ready' ? t('combat.targetHud.ready') : action === 'defend' ? t('combat.targetHud.defend') : action[0].toUpperCase() + action.slice(1));
  row.append(intentIcon(badge?.parts[0]?.icon || (badge ? 'prepare' : playerIcon)), node('span', 'target-hud-intent-name', title));
  const damage = badge?.parts.filter(part => part.value != null).map(part => part.value).join(' · ');
  if (damage || badge?.visibility !== 'known' && badge) row.append(node('strong', 'target-hud-damage', damage || '?'));
  row.dataset.intentVisibility = badge?.visibility || 'known';
  if (badge?.projectedDamage?.tone) row.dataset.damageTone = badge.projectedDamage.tone;
  row.tabIndex = 0;
  attachTooltip(row, () => `<div class="tt-title">${esc(title)}</div>${badge && badge.visibility !== 'known' ? t('combat.targetHud.unknown') : esc(entry.intent?.projectedDamage ? t('combat.targetHud.damageScope') : entry.intent?.label || title)}`);
  return row;
}

function panelFor(entry) {
  const shell = node('section', 'target-hud-detail');
  shell.dataset.eid = entry.id;
  shell.dataset.role = entry.role;
  shell.setAttribute('aria-label', t('combat.targetHud.namedDetails', { name: entry.name }));
  const panel = node('div', 'target-hud-panel');
  panel.append(node('div', 'target-hud-name', entry.name));
  const meters = entry.createMeters();
  meters.classList.add('target-hud-meters');
  for (const child of [...meters.children]) if (child.dataset.meterRow !== 'hp' && child.dataset.res !== 'poise') child.remove();
  panel.append(meters, intentRow(entry));
  const statuses = entry.createStatuses();
  statuses.classList.add('target-hud-statuses');
  statuses.hidden = !statuses.querySelector('.status-icon');
  shell.append(panel, statuses);
  return shell;
}

/** Scoped presentation owner. It never selects, targets, plays, or mutates combat. */
export function mountCombatTargetHud(combat, { field = combat.querySelector('.field'), config = targetHudConfig() } = {}) {
  const layer = node('div', 'target-hud-layer'), cells = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  layer.setAttribute('aria-label', t('combat.targetHud.details'));
  cells.classList.add('target-hud-cells'); cells.setAttribute('aria-hidden', 'true');
  field.append(cells, layer);
  let entries = new Map(), eligible = [], focused = null, hover = null, focusWithin = null, shown = [], enabled = false, disposed = false, raf = null;
  const panels = new Map();
  const dwell = createTargetHudDwell({ delay: config.motion.dwellMs, onChange: ids => { shown = ids; paint(); } });
  const desired = () => [...new Set([...eligible, focused, hover, focusWithin].filter(id => entries.has(id)))];
  const refreshDesired = () => dwell.request(enabled ? desired() : []);
  function gate() {
    const next = targetHudEnabled({ formFactor: document.documentElement.dataset.formFactor,
      classic: classicAppearance(), layout: combat.dataset.layout || 'formation' }, config);
    enabled = next;
    if (combat.dataset.targetHud !== String(next)) combat.dataset.targetHud = String(next);
    layer.hidden = cells.hidden = !next;
    for (const frame of field.querySelectorAll('.combatant')) setCombatantTargetHud(frame, next);
    if (!next) { hover = null; shown = []; dwell.reset(); clearPanels(); }
    refreshDesired();
  }
  function clearPanels() {
    for (const panel of panels.values()) panel.node.remove();
    panels.clear();
    for (const frame of field.querySelectorAll('.combatant')) frame.classList.remove('target-hud-selected', 'target-hud-focused', 'target-hud-candidate');
    cells.replaceChildren();
  }
  function frameFor(id) { return [...field.querySelectorAll('.combatant')].find(frame => frame.dataset.eid === id); }
  function paint() {
    if (disposed || !enabled) return;
    const next = new Set(shown.filter(id => entries.has(id)));
    for (const [id, panel] of panels) if (!next.has(id)) {
      panels.delete(id); panel.node.classList.add('leaving');
      const remove = () => panel.node.remove();
      if (reducedMotionRequested()) remove(); else panel.node.addEventListener('transitionend', remove, { once: true });
      // A disconnected mount or a suppressed CSS transition still owns removal.
      panel.node.ashenRemove = setTimeout(remove, config.motion.fadeMs);
    }
    for (const id of next) {
      const entry = entries.get(id), old = panels.get(id);
      if (old && old.key === entry.key) continue;
      const shell = panelFor(entry);
      if (old) old.node.replaceWith(shell); else layer.append(shell);
      panels.set(id, { node: shell, key: entry.key });
      shell.addEventListener('pointerenter', () => { hover = id; refreshDesired(); });
      shell.addEventListener('pointerleave', event => pointer(event));
      shell.addEventListener('focusin', () => { focusWithin = id; refreshDesired(); });
      shell.addEventListener('focusout', event => { if (!shell.contains(event.relatedTarget)) { focusWithin = null; refreshDesired(); } });
      shell.addEventListener('click', event => event.stopPropagation());
    }
    for (const frame of field.querySelectorAll('.combatant')) {
      const id = frame.dataset.eid;
      frame.classList.toggle('target-hud-selected', next.has(id));
      frame.classList.toggle('target-hud-focused', id === focused || id === hover);
      frame.classList.toggle('target-hud-candidate', eligible.includes(id));
    }
    scheduleGeometry();
  }
  function scheduleGeometry() { if (!disposed && raf === null) raf = requestAnimationFrame(geometry); }
  function geometry() {
    raf = null;
    if (disposed || !enabled || !field.isConnected) return;
    const fieldBox = rect(field), zoom = fieldBox.width / field.clientWidth || 1;
    const hand = combat.querySelector('.hand'), handTop = hand?.getBoundingClientRect().top;
    const rootBox = combat.getBoundingClientRect();
    const bottom = Math.min(fieldBox.top + fieldBox.height, Number.isFinite(handTop) ? handTop - config.positioning.gapPx : rootBox.bottom);
    const bounds = { ...fieldBox, height: Math.max(0, bottom - fieldBox.top) };
    const frames = [...field.querySelectorAll('.combatant:not(.dead)')];
    const sprites = frames.map(frame => ({ id: frame.dataset.eid, ...rect(frame.querySelector('.sprite')) }));
    const obstacles = [...sprites, ...frames.map(frame => frame.querySelector('.combatant-leading')).filter(Boolean).map(rect),
      ...combat.querySelectorAll(':scope > .topbar, .combat-hud, .combat-tools, .combat-action-row, .turn-ribbon, .hand .card')].map(value => value?.nodeType ? rect(value) : value);
    for (const frame of frames) {
      const style = getComputedStyle(frame), box = rect(frame);
      const x = parseFloat(style.getPropertyValue('--enemy-core-x')), y = parseFloat(style.getPropertyValue('--enemy-core-y'));
      if (Number.isFinite(x) && Number.isFinite(y)) obstacles.push({ left: box.left + x * zoom - 22, top: box.top + y * zoom - 22, width: 44, height: 44 });
    }
    // The active target pseudo-element can extend past the sprite. Reserve
    // its exact computed box; inactive legacy proxies do not consume room.
    for (const frame of frames) {
      const pseudo = getComputedStyle(frame, '::after');
      if (pseudo.display === 'none' || pseudo.visibility === 'hidden' || pseudo.pointerEvents === 'none' || ['none', 'normal'].includes(pseudo.content)) continue;
      const width = parseFloat(pseudo.width), height = parseFloat(pseudo.height), left = parseFloat(pseudo.left), top = parseFloat(pseudo.top);
      if (![width, height, left, top].every(Number.isFinite)) continue;
      const matrix = new DOMMatrixReadOnly(pseudo.transform === 'none' ? undefined : pseudo.transform), box = rect(frame);
      obstacles.push({ left: box.left + (left + matrix.e) * zoom, top: box.top + (top + matrix.f) * zoom, width: width * zoom, height: height * zoom });
    }
    const requests = [...panels].flatMap(([id, panel]) => {
      const frame = frameFor(id), entry = entries.get(id); if (!frame || !entry) return [];
      const anchor = rect(frame.querySelector('.sprite'));
      const lane = frame.dataset.targetHudLane != null ? frame.dataset.targetHudLane
        : Math.max(0, Math.min(2, 'ABCDEF'.indexOf(frame.dataset.formationCell?.[0])));
      const crowded = panels.size >= config.sizing.crowdedFrom;
      const width = crowded ? config.sizing.crowdedPanelWidthPx : rootBox.width < config.sizing.compactBelowPx ? config.sizing.compactPanelWidthPx : config.sizing.panelWidthPx;
      panel.node.dataset.crowded = String(crowded);
      panel.node.style.setProperty('--target-hud-padding-block', `${crowded ? config.sizing.crowdedPaddingBlockEm : .65}em`);
      panel.node.style.setProperty('--target-hud-padding-inline', `${crowded ? config.sizing.crowdedPaddingInlineEm : .75}em`);
      panel.node.style.width = `${width / zoom}px`;
      panel.node.style.setProperty('--target-hud-font', `${config.sizing.fontPx / zoom}px`);
      panel.node.style.setProperty('--target-hud-status-size', `${config.sizing.statusIconPx / zoom}px`);
      return [{ id, role: entry.role, lane, anchor, width, height: panel.node.getBoundingClientRect().height || config.sizing.panelHeightPx + config.sizing.statusHeightPx }];
    });
    const placed = placeTargetHudPanels({ bounds, panels: requests, obstacles, config });
    for (const box of placed) {
      const panel = panels.get(box.id)?.node; if (!panel) continue;
      panel.style.left = `${(box.left - fieldBox.left) / zoom}px`; panel.style.top = `${(box.top - fieldBox.top) / zoom}px`;
      panel.dataset.side = box.side; panel.classList.add('visible');
    }
    cells.setAttribute('viewBox', `0 0 ${fieldBox.width} ${fieldBox.height}`);
    cells.replaceChildren();
    for (const id of new Set([...shown, ...eligible, focused].filter(Boolean))) {
      const frame = frameFor(id), entry = entries.get(id); if (!frame || !entry) continue;
      if (frame.dataset.targetHudCellPolygon) {
        const shape = document.createElementNS(cells.namespaceURI, 'polygon');
        shape.setAttribute('points', JSON.parse(frame.dataset.targetHudCellPolygon).map(point => point.join(',')).join(' '));
        shape.setAttribute('fill', entry.role === 'player' ? config.behavior.playerTint : config.behavior.enemyTint);
        shape.setAttribute('fill-opacity', id === focused ? config.behavior.focusedTintOpacity : config.behavior.candidateTintOpacity);
        cells.append(shape); continue;
      }
      const tile = field.querySelector(`.formation-grid-cell[data-cell="${frame.dataset.formationCell}"]`);
      const path = tile?.querySelector('[data-perspective-outline]');
      if (!tile || !path) continue;
      const tileBox = tile.getBoundingClientRect(), svg = document.createElementNS(cells.namespaceURI, 'svg');
      svg.setAttribute('x', tileBox.left - fieldBox.left); svg.setAttribute('y', tileBox.top - fieldBox.top);
      svg.setAttribute('width', tileBox.width); svg.setAttribute('height', tileBox.height); svg.setAttribute('viewBox', '0 0 100 100');
      const shape = path.cloneNode();
      shape.setAttribute('fill', entry.role === 'player' ? config.behavior.playerTint : config.behavior.enemyTint);
      shape.setAttribute('fill-opacity', id === focused ? config.behavior.focusedTintOpacity : config.behavior.candidateTintOpacity);
      shape.setAttribute('stroke', 'none'); svg.append(shape); cells.append(svg);
    }
  }
  function pointer(event) {
    if (!enabled || event.pointerType === 'touch') return;
    const direct = event.target.closest?.('.target-hud-detail, .combatant');
    const id = direct?.dataset.eid;
    if (id && entries.has(id) && !direct.classList.contains('dead') && !direct.inert) {
      if (hover !== id) { hover = id; refreshDesired(); paint(); } return;
    }
    if (hover && panels.has(hover)) {
      const frame = frameFor(hover), panel = panels.get(hover).node;
      const a = frame && rect(frame.querySelector('.sprite')), b = rect(panel);
      if (a && (contains(a, event.clientX, event.clientY, 5) || contains(b, event.clientX, event.clientY, 5)
        || corridor(a, b, event.clientX, event.clientY, config.positioning.gapPx * 1.5))) return;
    }
    if (hover != null) { hover = null; refreshDesired(); }
  }
  function focus(event) {
    const frame = event.target.closest?.('.combatant, .target-hud-detail');
    if (frame && entries.has(frame.dataset.eid)) { focusWithin = frame.dataset.eid; refreshDesired(); }
  }
  function focusOut(event) { if (!field.contains(event.relatedTarget)) { focusWithin = null; refreshDesired(); } }
  field.addEventListener('pointermove', pointer);
  field.addEventListener('pointerleave', pointer);
  field.addEventListener('focusin', focus);
  field.addEventListener('focusout', focusOut);
  field.addEventListener('formationlayoutchange', scheduleGeometry);
  field.addEventListener('battlefieldgeometrychange', scheduleGeometry);
  const resized = () => { gate(); paint(); scheduleGeometry(); };
  window.addEventListener('resize', resized);
  const observer = new MutationObserver(resized);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-form-factor', 'data-display-appearance', 'data-view-preset'] });
  observer.observe(combat, { attributes: true, attributeFilter: ['data-layout'] });
  const resize = new ResizeObserver(scheduleGeometry); resize.observe(field);
  for (const [name, value] of Object.entries({ fade: config.motion.fadeMs, 'enemy-tint': config.behavior.enemyTint, 'player-tint': config.behavior.playerTint })) layer.style.setProperty(`--target-hud-${name}`, name === 'fade' ? `${value}ms` : value);
  gate();
  return {
    update({ combatants = [], eligibleIds = [], focusedId = null } = {}) {
      if (disposed) return;
      entries = new Map(combatants.map(entry => [entry.id, entry])); eligible = [...eligibleIds]; focused = focusedId;
      gate(); refreshDesired(); paint();
    },
    release() {
      if (disposed) return; disposed = true; dwell.dispose(); if (raf !== null) cancelAnimationFrame(raf);
      for (const node of layer.querySelectorAll('.target-hud-detail')) clearTimeout(node.ashenRemove);
      field.removeEventListener('pointermove', pointer); field.removeEventListener('pointerleave', pointer);
      field.removeEventListener('focusin', focus); field.removeEventListener('focusout', focusOut);
      field.removeEventListener('battlefieldgeometrychange', scheduleGeometry);
      field.removeEventListener('formationlayoutchange', scheduleGeometry); window.removeEventListener('resize', resized);
      observer.disconnect(); resize.disconnect(); clearPanels(); layer.remove(); cells.remove(); delete combat.dataset.targetHud;
    },
  };
}
