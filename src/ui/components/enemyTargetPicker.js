import { tFull } from '../strings.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { anchorLocalBox, uiZoom } from '../fx.js';
import { enemyTargetGrid as classicEnemyTargetGrid } from '../models/EnemyTargetGridModel.js';
import { alternativeEnemyTargetGrid } from '../models/AlternativeEnemyTargetGridModel.js';
import { classicAppearance } from '../displayAppearance.js';
import { clearFocus, focusElement } from '../input.js';

// Placement follows fitted figures without intercepting inspection controls.
function watchTargetPlacement(host, picker) {
  let queued = null;
  let resize;
  let changes;
  const dispose = () => {
    if (queued != null) cancelAnimationFrame(queued);
    queued = null;
    resize?.disconnect();
    changes?.disconnect();
    picker.placement = null;
  };
  const place = () => {
    queued = null;
    if (!host.isConnected || picker.hidden) { dispose(); return; }
    const box = host.getBoundingClientRect();
    const zoom = uiZoom();
    const combat = host.closest('.combat');
    const localRect = rect => ({ left: rect.left - box.left, top: rect.top - box.top, width: rect.width, height: rect.height });
    // A box may cover its own foe's controls (intent, Inspect, HP, armor), which
    // stay clickable above it through combat-layers.css z-index. It never covers
    // another foe's controls, so those are obstacles with an owner.
    const visibleRects = nodes => nodes.map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.height);
    const obstacles = [
      ...visibleRects([combat?.querySelector('.combat-hud'), host.querySelector('.turn-ribbon')].filter(Boolean)).map(localRect),
      ...[...host.querySelectorAll('.combatant.enemy')].flatMap(figure => visibleRects([...figure.querySelectorAll(':is(.combatant-leading, .meters, .nm)')])
        .map(rect => ({ ...localRect(rect), owner: figure.dataset.eid }))),
    ];
    const playerRect = host.querySelector('.combatant.player .sprite')?.getBoundingClientRect();
    // The player's overhead controls and the cards, combat tools and action buttons
    // paint above the picker: never place a target under them.
    const playerControls = [...host.querySelectorAll('.combatant.player :is(.combatant-leading, .meters, .player-action-intent)')];
    const hardNodes = [playerRect, ...playerControls, ...(combat?.querySelectorAll('.combat-tools, .combat-action-row button, .hand .card') ?? [])];
    const hardObstacles = hardNodes.filter(Boolean)
      .map(node => (node.getBoundingClientRect ? node.getBoundingClientRect() : node))
      .filter(rect => rect.width && rect.height).map(localRect);
    const enemyTargetGrid = classicAppearance() ? classicEnemyTargetGrid : alternativeEnemyTargetGrid;
    const targets = [...picker.children].map(button => {
      const figure = [...host.querySelectorAll('.combatant.enemy')].find(node => node.dataset.eid === button.dataset.eid);
      // The stage trims .sprite to the painted ink (its marginTop drops the
      // transparent canvas); the img inside keeps that padding, so centre on .sprite.
      const rect = (figure?.querySelector('.sprite') || figure)?.getBoundingClientRect();
      // The box's bottom sits on the foe's ground anchor (its shadow point, groundY).
      const groundY = parseFloat(figure?.dataset.groundY);
      return { id: button.dataset.eid, x: rect ? rect.left + rect.width / 2 - box.left : box.width / 2,
        y: rect ? rect.top + rect.height / 2 - box.top : box.height / 2,
        ...(Number.isFinite(groundY) ? { ground: groundY - box.top } : {}) };
    });
    const placements = enemyTargetGrid({ width: box.width, height: box.height, targets, obstacles, hardObstacles });
    const placed = new Set(placements.map(placement => placement.id));
    // A foe the grid could not place keeps no stale coordinates: its button is
    // hidden (not focusable) and the enemy stays targetable through its sprite.
    for (const button of picker.children) {
      button.hidden = !placed.has(button.dataset.eid);
    }
    for (const placement of placements) {
      const button = [...picker.children].find(node => node.dataset.eid === placement.id);
      const local = anchorLocalBox(host, { left: box.left + placement.left, top: box.top + placement.top,
        width: placement.width, height: placement.height }, { zoom });
      Object.assign(button.style, { left: `${local.left}px`, top: `${local.top}px`, width: `${local.width}px`, height: `${local.height}px` });
    }
  };
  const schedule = () => { if (queued == null) queued = requestAnimationFrame(place); };
  if (globalThis.ResizeObserver) {
    resize = new ResizeObserver(schedule);
    resize.observe(host);
    resize.observe(picker);
  }
  changes = new MutationObserver(records => {
    if (records.some(record => !picker.contains(record.target))) schedule();
  });
  changes.observe(host, { attributes: true, childList: true, subtree: true, attributeFilter: ['style', 'class'] });
  picker.placement = { schedule, dispose };
  schedule();
}

// Sprite artwork may overlap without making a living enemy unreachable. This
// independent target grid uses the same legal IDs and command as the figures.
// Reuse its buttons so combat repaints do not discard keyboard focus.
export function renderEnemyTargetPicker(host, { targets = [], disabled = false, onActivate, onPreview } = {}) {
  let picker = host.querySelector(':scope > .enemy-target-picker');
  if (!picker && !targets.length) return null;
  if (!picker) {
    picker = document.createElement('div');
    picker.className = 'enemy-target-picker';
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-label', tFull('combat.enemyTarget.choose'));
    markUiComponent(picker, UI.enemyTargetPicker);
    host.appendChild(picker);
  }
  picker.hidden = !targets.length;
  const present = new Set(targets.map(target => target.id));
  for (const button of [...picker.children]) if (!present.has(button.dataset.eid)) button.remove();
  targets.forEach((target, index) => {
    let button = [...picker.children].find(node => node.dataset.eid === target.id);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'enemy-target-button';
      button.dataset.eid = target.id;
      button.dataset.focusable = '';
      button.innerHTML = '<span class="enemy-target-name"></span><span class="enemy-target-health"></span>';
      // A pointer press after keyboard navigation changes input modes. Clear
      // the unified cursor (wherever it sits, this target or another) before
      // activation so its enemy key cannot be restored onto a combatant after
      // the picker leaves the DOM. Keyboard Enter/Space never fires pointerdown.
      button.addEventListener('pointerdown', () => clearFocus());
      button.addEventListener('click', event => {
        event.stopPropagation();
        if (!button.disabled) picker.activate?.(button.dataset.eid);
      });
      for (const event of ['pointerenter', 'focus']) button.addEventListener(event, () => picker.preview?.(button.dataset.eid));
      // Keyboard focus (Tab) brings the unified cursor along. A pointer press
      // also focuses the button but must not move the cursor: after the play,
      // cursor restore would select that enemy and refit the stage (a script
      // reflow the reduced-motion probe sees), as combatant boxes already avoid.
      button.addEventListener('focus', () => { if (button.matches(':focus-visible')) focusElement(button); });
      for (const event of ['pointerleave', 'blur']) button.addEventListener(event, () => picker.preview?.(null));
      picker.appendChild(button);
    }
    button.disabled = disabled;
    button.dataset.number = String(index + 1);
    button.querySelector('.enemy-target-name').textContent = `${index + 1}. ${target.name}`;
    button.querySelector('.enemy-target-health').textContent = tFull('combat.enemyTarget.health', { hp: target.hp, maxHp: target.maxHp });
    button.setAttribute('aria-label', tFull('combat.enemyTarget.label', { number: index + 1, name: target.name, hp: target.hp, maxHp: target.maxHp }));
  });
  picker.activate = onActivate;
  picker.preview = onPreview;
  if (picker.hidden) picker.placement?.dispose();
  else if (picker.placement) picker.placement.schedule();
  else watchTargetPlacement(host, picker);
  return picker;
}
