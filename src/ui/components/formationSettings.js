import { presentationConfig, ADVANCED_CONFIG_PREFIX } from '../../model/advancedConfig.js';
import { FORMATION_PRESETS } from '../../model/formationLayout.js';
import { combatFormation } from '../models/CombatFormationModel.js';
import { formationTileGeometry } from '../models/FormationGridModel.js';
import { formationTileOutline } from './formationGrid.js';
import { esc } from './tooltip.js';
import { UI_COMPONENTS, uiComponentAttrs } from './uiComponents.js';

const prefix = `${ADVANCED_CONFIG_PREFIX}presentation.`;

export function applyPendingFormationSettings(container) {
  const host = container.querySelector('.formation-editor[data-dirty="true"]');
  return !host || host.dispatchEvent(new Event('formationapply', { cancelable: true }));
}

// Miniatures are diagrams of the same formation geometry, not decorative icons.
function presetDiagram(preset) {
  const plan = combatFormation({ width: 100, height: 72, friends: [], enemies: [], preview: true,
    presentation: { formationPreset: preset, formationColumns: 1, formationRows: 4, formationWidth: 95, formationDepth: 95 } });
  return `<svg class="formation-preset-diagram" viewBox="0 0 100 72" aria-hidden="true">${plan.cells.map(cell =>
    `<rect x="${cell.x - 2}" y="${cell.ground - 2}" width="4" height="4"/>`).join('')}</svg>`;
}

function fieldHtml(row, value, slider = true) {
  const id = `formation-${row.presentationKey}`;
  return `<div class="set-row formation-control" data-formation-control="${row.presentationKey}">
    <label for="${id}">${esc(row.label)}</label>
    <div class="formation-inputs">${slider ? `<input type="range" min="${row.min}" max="${row.max}" step="${row.step}" value="${value}" data-formation-field="${row.presentationKey}" aria-label="${esc(row.label)} slider">` : ''}
    <input id="${id}" type="number" min="${row.min}" max="${row.max}" step="${row.step}" value="${value}" data-key="${prefix}${row.presentationKey}" data-formation-field="${row.presentationKey}" aria-label="${esc(row.label)}"><span>${row.suffix || ''}</span></div>
    </div>`;
}

export function formationSettingsHtml(settings, rows) {
  const values = presentationConfig(settings);
  const field = key => fieldHtml(rows.find(row => row.presentationKey === key), values[key], !['formationColumns', 'formationRows'].includes(key));
  const adjustments = rows.filter(row => /^(row[A-F]|front|back)/.test(row.presentationKey));
  return `<section class="formation-editor" ${uiComponentAttrs(UI_COMPONENTS.formationLayoutEditor)} aria-label="Formation layout">
    <div class="formation-workspace">
      <div class="formation-preview-panel">
        <h3>Battlefield preview</h3>
        <div class="formation-team-labels"><span>Allies <small>Your team</small></span><span>Enemies <small>Opposing team</small></span></div>
        <div class="formation-preview formation-grid" role="img" aria-label="Battlefield grid preview"></div>
        <p class="formation-dimensions" data-formation-summary></p>
        <p class="formation-preview-note">Preview changes before applying. Position labels stay upright.</p>
      </div>
      <div class="formation-inspector">
        <h3>Layout &amp; grid</h3>
        <div class="set-row formation-preset-field"><label for="formation-preset">Formation preset</label>
          <select id="formation-preset" data-formation-preset>${FORMATION_PRESETS.map(p => `<option value="${p.value}"${p.value === values.formationPreset ? ' selected' : ''}>${p.label}</option>`).join('')}</select>
        </div>
        <div class="formation-presets" role="group" aria-label="Formation presets">${FORMATION_PRESETS.map(p =>
          `<button type="button" data-preset="${p.value}" aria-label="${p.label}" aria-pressed="${p.value === values.formationPreset}">${presetDiagram(p.value)}<span>${p.short}</span></button>`).join('')}</div>
        <div class="formation-dimension-controls">${field('formationColumns')}${field('formationRows')}</div>
        <p class="formation-help">Per side: up to 3 columns and 6 rows.</p>
        <div class="formation-control-section"><h4>Battlefield footprint</h4>${field('formationWidth')}${field('formationDepth')}${field('formationGap')}</div>
        <div class="formation-control-section"><h4>Ground shape</h4>
          <div class="set-row formation-control"><label for="formation-outline">Tile outline</label><select id="formation-outline" data-formation-outline aria-label="Tile outline">${['rectangle', 'square', 'wide-rhombus', 'rhombus', 'ellipse', 'circle'].map(shape => `<option value="${shape}"${shape === values.gridShape ? ' selected' : ''}>${shape === 'wide-rhombus' ? 'Wide diamond' : shape[0].toUpperCase() + shape.slice(1)}</option>`).join('')}</select></div>
          ${field('groundTilt')}${field('groundSkew')}
          <p class="formation-help">Tilt flattens the tiles toward the ground; skew slants their edges. Characters remain upright.</p>
        </div>
        <label class="formation-visibility"><input type="checkbox" data-formation-visible${values.showFormationGrid ? ' checked' : ''}> Show grid in battle</label>
        <details class="formation-adjustments"><summary><span>Character adjustments<small>Row size, offsets and draw order</small></span></summary>
          <div class="formation-adjustment-fields">${adjustments.map(row => fieldHtml(row, values[row.presentationKey], false)).join('')}</div>
        </details>
        <p class="formation-apply-status" data-formation-status role="status">Changes apply to both sides.</p>
        <button type="button" class="as-btn formation-apply" data-formation-apply>Apply layout</button>
      </div>
    </div>
  </section>`;
}

export function mountFormationSettings(container, settings, onChange, rows) {
  const host = container.querySelector('.formation-editor');
  if (!host || host.dataset.mounted) return;
  host.dataset.mounted = 'true';
  const draft = presentationConfig(settings);
  const editable = new Set([...rows.map(row => row.presentationKey), 'gridShape', 'showFormationGrid']);
  const fields = new Map(rows.map(row => [row.presentationKey, row]));
  const preview = host.querySelector('.formation-preview');
  const status = host.querySelector('[data-formation-status]');
  const draw = () => {
    const width = preview.clientWidth, height = preview.clientHeight;
    if (!width || !height) return;
    const plan = combatFormation({ width, height, friends: [], enemies: [], presentation: draft, preview: true });
    preview.dataset.columns = String(draft.formationColumns);
    preview.dataset.rows = String(draft.formationRows);
    preview.dataset.preset = draft.formationPreset;
    preview.dataset.shape = draft.gridShape;
    preview.style.setProperty('--player-grid-color', draft.playerGridColor);
    preview.style.setProperty('--enemy-grid-color', draft.enemyGridColor);
    preview.innerHTML = plan.cells.map(cell => {
      const tile = formationTileGeometry(cell, plan, draft);
      return `<div class="formation-grid-cell" data-cell="${cell.cell}" data-side="${cell.side}" style="left:${cell.x}px;top:${cell.ground}px;width:${tile.width}px;height:${tile.height}px;--tile-transform:${tile.transform}">${formationTileOutline()}<span>${cell.cell}</span></div>`;
    }).join('');
    const summary = `${plan.columns} columns × ${plan.rows} ${plan.rows === 1 ? 'row' : 'rows'} per side / ${plan.columns * 2} × ${plan.rows} battlefield`;
    host.querySelector('[data-formation-summary]').textContent = summary;
    preview.setAttribute('aria-label', `${summary}. ${FORMATION_PRESETS.find(p => p.value === draft.formationPreset).label}. Positions A1 to ${'ABCDEF'[plan.rows - 1]}${plan.columns * 2}.`);
  };
  const update = () => {
    host.dataset.dirty = 'true';
    status.textContent = 'Preview only — apply to save your layout.';
    host.querySelectorAll('[data-preset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.preset === draft.formationPreset)));
    draw();
  };
  const preset = host.querySelector('[data-formation-preset]');
  preset.addEventListener('change', () => { draft.formationPreset = preset.value; update(); });
  host.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
    draft.formationPreset = button.dataset.preset; preset.value = draft.formationPreset; update();
  }));
  host.querySelectorAll('[data-formation-field]').forEach(input => {
    const commit = () => {
      const key = input.dataset.formationField, row = fields.get(key);
      let value = input.value.trim() === '' ? draft[key] : Number(input.value);
      if (!Number.isFinite(value)) value = draft[key];
      value = Math.min(row.max, Math.max(row.min, row.integer ? Math.round(value) : value));
      draft[key] = value;
      host.querySelectorAll(`[data-formation-field="${key}"]`).forEach(control => { control.value = value; });
      update();
    };
    input.addEventListener(input.type === 'range' ? 'input' : 'change', commit);
    if (input.type === 'number') {
      input.addEventListener('blur', commit);
      input.addEventListener('input', () => {
        const key = input.dataset.formationField, row = fields.get(key), value = Number(input.value);
        // Preview valid typed values without clamping a partially typed number.
        if (input.value === '' || !Number.isFinite(value) || value < row.min || value > row.max || (row.integer && !Number.isInteger(value))) return;
        draft[key] = value;
        const slider = host.querySelector(`input[type="range"][data-formation-field="${key}"]`);
        if (slider) slider.value = value;
        update();
      });
    }
  });
  host.querySelector('[data-formation-outline]').addEventListener('change', event => { draft.gridShape = event.target.value; update(); });
  host.querySelector('[data-formation-visible]').addEventListener('change', event => { draft.showFormationGrid = event.target.checked; update(); });
  const apply = () => {
    const changes = Object.fromEntries([...editable].map(key => [`${prefix}${key}`, draft[key]]));
    if (onChange(changes)?.ok === false) {
      status.textContent = 'The layout could not be saved. Your preview is still available; try applying again.';
      return false;
    }
    Object.assign(settings, changes);
    host.dataset.dirty = 'false';
    const actors = Math.max(document.querySelectorAll('.field .combatant.player').length, document.querySelectorAll('.field .combatant.enemy').length);
    status.textContent = actors > draft.formationColumns * draft.formationRows
      ? 'Layout saved. This battle keeps enough positions for every character.' : 'Layout applied and saved.';
    return true;
  };
  host.querySelector('[data-formation-apply]').addEventListener('click', apply);
  host.addEventListener('formationapply', event => { if (!apply()) event.preventDefault(); });
  // ResizeObserver also catches the panel becoming visible after topic switching.
  const resize = new ResizeObserver(draw);
  resize.observe(preview);
  // Search exposes matching adjustment controls instead of hiding them in a fold.
  const search = new MutationObserver(() => {
    if (host.closest('[data-searching="true"]')) host.querySelector('.formation-adjustments').open = true;
  });
  search.observe(host.parentElement, { attributes: true, attributeFilter: ['data-searching'] });
  const cleanup = new MutationObserver(() => {
    if (host.isConnected) return;
    resize.disconnect(); search.disconnect(); cleanup.disconnect();
  });
  cleanup.observe(document.body, { childList: true, subtree: true });
  draw();
}
