// Production creation surfaces. The catalogue and the live flow share these
// DOM parts; text, trim, material and icon geometry remain independent.
import { el, railItem, categoryNav } from '../kit/index.js';
import { engravedIcon } from './engravedIcon.js';
import { assetUrl } from '../assetmap.js';
import { t } from '../strings.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

const MATERIAL = 'assets/player-polish/materials/soot-leather-material.webp';
const FRAME = 'assets/player-polish/ui/components/panel-frame.svg';
const FEAT_ICONS = Object.freeze({
  fieldStudy: 'compendium', weaponDrill: 'sword', armourPractice: 'armour',
  classInsight: 'progression', spoilsInstinct: 'cinders', vitalRenewal: 'regen',
});
const part = (node, id, kind) => {
  markUiComponent(node, id);
  node.dataset.creationPart = kind;
  return node;
};

/** The frame is a shipped kit vector, not a flattened illustrated UI tile. */
function cssAssetUrl(id) {
  return `url("${String(assetUrl(id)).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n\f]/g, '')}")`;
}
function surfaceLayers() {
  return [
    part(el('span', { class: 'cc-part-material', 'aria-hidden': 'true' }), UI.creationPartMaterial, 'material'),
    part(el('span', { class: 'cc-part-trim', style: `border-image-source:${cssAssetUrl(FRAME)}`, 'aria-hidden': 'true' }), UI.creationPartTrim, 'trim'),
  ];
}
function paintScope(node) {
  const url = assetUrl(MATERIAL);
  node.style.setProperty('--cc-part-material-url', `url("${String(url).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n\f]/g, '')}")`);
  return node;
}

export function creationPageHeading({ eyebrow = '', title = '', description = '', aside = null } = {}) {
  const copy = el('div', { class: 'cc-page-heading-copy' }, [
    eyebrow ? el('span', { class: 'as-eyebrow cc-page-eyebrow', text: eyebrow, dataset: { creationPart: 'eyebrow' } }) : null,
    el('h2', { class: 'as-title-l cc-page-title', text: title, dataset: { creationPart: 'heading' } }),
    description ? el('p', { class: 'as-subtitle cc-page-description', text: description, dataset: { creationPart: 'description' } }) : null,
  ]);
  return part(el('header', { class: 'cc-page-parts cc-page-heading' }, [copy, aside]), UI.creationPageHeading, 'page-heading');
}

export function creationPanel({ kind = 'panel', title = '', subtitle = '', children = [], attrs = {}, className = '' } = {}) {
  const body = part(el('div', { class: 'cc-part-body' }, children), UI.creationPartBody, 'body');
  const heading = title || subtitle ? el('header', { class: 'cc-panel-heading', dataset: { creationPart: 'panel-heading' } }, [
    title ? el('h3', { class: 'as-title-m', text: title, dataset: { creationPart: 'heading' } }) : null,
    subtitle ? el('p', { class: 'as-subtitle', text: subtitle, dataset: { creationPart: 'description' } }) : null,
  ]) : null;
  return paintScope(part(el('section', { ...attrs, class: `as-pane cc-page-parts cc-part cc-panel ${className}`.trim(), dataset: { ...(attrs.dataset || {}), creationPanel: kind } }, [...surfaceLayers(), heading, body]), UI.creationPanel, kind));
}

export function creationChoiceTile({ id = '', title = '', description = '', art = null, selected = false, onChoose = null, attrs = {} } = {}) {
  const artPart = part(el('span', { class: 'cc-choice-art' }, art), UI.creationChoiceArt, 'art');
  const copy = part(el('span', { class: 'cc-choice-copy' }, [
    el('span', { class: 'cc-choice-title', text: title, dataset: { creationPart: 'heading' } }),
    description ? el('span', { class: 'cc-choice-description', text: description, dataset: { creationPart: 'description' } }) : null,
  ]), UI.creationChoiceCopy, 'copy');
  const body = part(el('span', { class: 'cc-part-body cc-choice-body' }, [artPart, copy]), UI.creationPartBody, 'body');
  const node = paintScope(part(el('button', { ...attrs, type: 'button', class: `as-optioncard cc-page-parts cc-part cc-choice-tile${selected ? ' chosen' : ''}`, 'aria-pressed': selected ? 'true' : 'false', dataset: { ...(attrs.dataset || {}), creationChoice: id } }, [...surfaceLayers(), body]), UI.creationChoiceTile, 'choice'));
  if (onChoose) node.addEventListener('click', () => onChoose(id));
  return node;
}

export function creationFeatEmblem(featId) {
  const symbol = engravedIcon(FEAT_ICONS[featId] || 'progression');
  if (symbol) symbol.dataset.creationPart = 'symbol';
  return part(el('span', { class: 'cc-feat-emblem', 'aria-hidden': 'true', dataset: { feat: featId } }, [
    part(el('span', { class: 'cc-feat-medallion-material' }), UI.creationPartMaterial, 'medallion-material'),
    part(el('span', { class: 'cc-feat-medallion-trim' }), UI.creationPartTrim, 'medallion-trim'),
    symbol,
  ]), UI.creationFeatEmblem, 'emblem');
}

/** Inspection is local UI state. Level gates describe eligibility, never a starting grant. */
export function createCreationFeatBrowser({ feats = [], groups = null, selectedId = null, onInspect = null, labels = {}, allowance = 0 } = {}) {
  let grouped = Array.isArray(groups);
  let entries = [];
  let currentGroup = null;
  let inspectedKey = null;
  const tiles = new Map();
  const filters = el('div', { class: 'cc-feat-groups', role: 'group', 'aria-label': labels.groupLabel || labels.title || '' });
  const tileList = el('div', { class: 'cc-feat-choices', role: 'group', 'aria-label': labels.listLabel || labels.title || '' });
  const detail = creationPanel({ kind: 'feat-detail', className: 'cc-feat-detail', attrs: { role: 'region', tabindex: '-1', 'aria-label': labels.detailLabel || labels.title || '' } });
  markUiComponent(detail, UI.creationFeatDetail);
  const detailBody = detail.querySelector('.cc-part-body');
  const status = labels.availability ? el('p', { class: 'cc-feat-availability', text: labels.availability, dataset: { creationPart: 'availability' } }) : null;
  const node = part(el('section', { class: 'cc-page-parts cc-feat-browser', dataset: { birthFeatAllowance: String(allowance) } }, [
    labels.title ? creationPageHeading({ eyebrow: labels.eyebrow, title: labels.title, description: labels.description, aside: status }) : status,
    filters,
    el('div', { class: 'cc-feat-layout' }, [tileList, detail]),
  ]), UI.creationFeatBrowser, 'feat-browser');
  const keyOf = (row, group) => grouped ? `${group.id}:${row.trackId || ''}:${row.id}` : row.id;
  const allRows = () => entries.flatMap(group => group.rows.map(row => ({ row, group, key: keyOf(row, group) })));
  function requirement(row) {
    if (row.requiredLevel === undefined) return '';
    if (row.requiredLevel === null) return labels.unavailableRequirement?.(row) || labels.lockedRequirement?.(row) || labels.unavailable || labels.locked || '';
    const profileUnlocked = row.unlockedByProfile && row.currentLevel < row.requiredLevel;
    if (profileUnlocked && labels.profileUnlockedRequirement) return labels.profileUnlockedRequirement(row);
    const format = !row.locked && labels.availableRequirement ? labels.availableRequirement : labels.lockedRequirement;
    return format?.(row) || `${row.trackLabel || row.trackId || ''} · ${row.currentLevel} / ${row.requiredLevel}`;
  }
  function levelStatus(row) {
    if (row.requiredLevel === undefined) return null;
    const profileUnlocked = row.unlockedByProfile && row.currentLevel < row.requiredLevel;
    const stateLabel = row.locked ? labels.locked || requirement(row) : profileUnlocked ? labels.profileUnlocked || requirement(row) : labels.available || requirement(row);
    const icon = engravedIcon(row.locked ? 'lock' : 'check');
    const badge = el('span', { class: `cc-feat-lock-status${row.locked ? ' locked' : ' available'}`, dataset: { creationPart: 'level-status' } }, [
      icon,
      el('span', { text: stateLabel }),
    ]);
    return el('span', { class: 'cc-feat-level-requirement', dataset: { creationPart: 'level-requirement' } }, [
      badge,
      el('span', { class: 'cc-feat-level-copy', text: requirement(row) }),
    ]);
  }
  function inspect(id, { notify = true } = {}) {
    const active = allRows().filter(entry => entry.group.id === currentGroup);
    const entry = active.find(value => value.key === id || value.row.id === id) || allRows().find(value => value.key === id || value.row.id === id);
    if (!entry) return false;
    if (entry.group.id !== currentGroup) {
      currentGroup = entry.group.id;
      renderFilters();
      renderTiles();
    }
    const { row, key } = entry;
    inspectedKey = key;
    node.dataset.inspectedFeat = row.id;
    node.dataset.inspectedFeatKey = key;
    node.dataset.featGroup = currentGroup;
    for (const [tileKey, tile] of tiles) {
      const selected = tileKey === key;
      tile.classList.toggle('chosen', selected);
      tile.dataset.inspected = String(selected);
      tile.setAttribute('aria-pressed', String(selected));
    }
    detailBody.replaceChildren(
      creationFeatEmblem(row.id),
      el('h3', { class: 'as-title-l cc-feat-detail-title', text: row.name, dataset: { creationPart: 'heading' } }),
      el('span', { class: 'as-hairline cc-feat-detail-divider', 'aria-hidden': 'true', dataset: { creationPart: 'divider' } }),
      el('p', { class: 'cc-feat-detail-description', text: row.description, dataset: { creationPart: 'description' } }),
    );
    const requirements = levelStatus(row);
    if (requirements) detailBody.append(requirements);
    detail.dataset.feat = row.id;
    detail.dataset.locked = String(!!row.locked);
    detail.style.setProperty('--cc-inspector-order', String([...tiles.keys()].indexOf(key) * 2 + 1));
    const returnButton = el('button', { type: 'button', class: 'as-btn cc-feat-return', text: t('creation.feats.return') });
    returnButton.addEventListener('click', () => { node.dataset.detailOpen = 'false'; const tile = tiles.get(inspectedKey); tile?.scrollIntoView({ block: 'nearest' }); tile?.focus({ preventScroll: true }); });
    detailBody.append(returnButton);
    if (notify) {
      node.dataset.detailOpen = 'true';
      onInspect?.(row.id, row);
      if (globalThis.matchMedia?.('(max-width: 960px)').matches) requestAnimationFrame(() => {
        detail.focus({ preventScroll: true });
        detail.scrollIntoView({ block: 'nearest', behavior: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      });
    }
    return true;
  }
  function renderTiles() {
    tiles.clear();
    tileList.replaceChildren();
    const group = entries.find(entry => entry.id === currentGroup);
    for (const row of group?.rows || []) {
      const key = keyOf(row, group);
      const tile = creationChoiceTile({ id: row.id, title: row.name,
        description: labels.shortDescriptions?.[row.id] || (FEAT_ICONS[row.id] ? t(`creation.feats.summary.${row.id}`) : String(row.description || '').split(/(?<=[.!?])\s/)[0]),
        art: creationFeatEmblem(row.id), onChoose: () => inspect(key),
        attrs: { 'aria-controls': labels.detailId || null, dataset: { feat: row.id, featKey: key, featGroup: group.id, locked: String(!!row.locked) } },
      });
      markUiComponent(tile, UI.creationFeatTile);
      tile.style.setProperty('--cc-choice-order', String(tiles.size * 2));
      if (row.requiredLevel !== undefined) {
        const stateLabel = row.locked ? labels.locked || requirement(row) : row.unlockedByProfile ? labels.profileUnlocked || requirement(row) : labels.available || requirement(row);
        const icon = engravedIcon(row.locked ? 'lock' : 'check');
        tile.querySelector('.cc-choice-body').append(el('span', { class: 'cc-feat-tile-status', title: stateLabel, 'aria-label': stateLabel, dataset: { creationPart: 'level-status' } }, icon));
      }
      tiles.set(key, tile);
      tileList.append(tile);
    }
    if (!group?.rows.length && labels.emptyGroup) tileList.append(el('p', { class: 'cc-feat-empty', text: labels.emptyGroup }));
  }
  function renderFilters() {
    filters.replaceChildren();
    filters.hidden = !grouped;
    filters.style.display = grouped ? '' : 'none';
    if (!grouped) return;
    for (const group of entries) {
      const active = group.id === currentGroup;
      const button = el('button', { type: 'button', class: `as-tab cc-feat-group-filter${active ? ' on' : ''}`, 'aria-pressed': String(active), dataset: { featGroup: group.id, creationPart: 'group-filter' }, text: labels.groups?.[group.id] || group.title || group.id });
      button.addEventListener('click', () => {
        currentGroup = group.id;
        node.dataset.featGroup = currentGroup;
        for (const peer of filters.querySelectorAll('button')) {
          const selected = peer.dataset.featGroup === currentGroup;
          peer.classList.toggle('on', selected);
          peer.setAttribute('aria-pressed', String(selected));
        }
        renderTiles();
        const candidate = group.rows.find(row => keyOf(row, group) === inspectedKey) || group.rows[0];
        if (candidate) inspect(keyOf(candidate, group));
        else { inspectedKey = null; detailBody.replaceChildren(); delete node.dataset.inspectedFeat; delete node.dataset.inspectedFeatKey; }
      });
      filters.append(button);
    }
  }
  function setGroups(next, { selectedId: nextSelected = null } = {}) {
    const oldGroup = currentGroup, oldKey = inspectedKey;
    grouped = true;
    entries = Array.from(next || []).map(group => ({ ...group, rows: Array.from(group.rows || []) }));
    currentGroup = entries.some(group => group.id === oldGroup) ? oldGroup : entries[0]?.id || null;
    renderFilters();
    renderTiles();
    const group = entries.find(entry => entry.id === currentGroup);
    const candidate = nextSelected || oldKey;
    const currentRows = group?.rows || [];
    const row = currentRows.find(row => keyOf(row, group) === candidate || row.id === candidate) || currentRows[0];
    if (row) inspect(keyOf(row, group), { notify: false });
    else { inspectedKey = null; detailBody.replaceChildren(); delete node.dataset.inspectedFeat; delete node.dataset.inspectedFeatKey; }
    return node;
  }
  if (labels.detailId) detail.id = labels.detailId;
  node.inspect = inspect;
  node.setGroups = setGroups;
  if (grouped) setGroups(groups, { selectedId });
  else {
    entries = [{ id: 'character', rows: Array.from(feats) }];
    currentGroup = 'character';
    renderFilters();
    renderTiles();
    inspect(selectedId || entries[0].rows[0]?.id, { notify: false });
  }
  return node;
}

/** Scope the live screen and mark existing parts without moving legacy DOM hooks. */
export function decorateCreationWorkspace(root) {
  if (!root) return root;
  root.classList.add('cc-design-workspace');
  paintScope(root);
  const hooks = [
    ['.modal-head', 'header'], ['.modal-foot', 'footer'], ['.cz-scroll', 'page-body'],
    ['.cz-stage', 'page'], ['.cc-attribute-card', 'attribute-row'], ['.as-row', 'row'],
    ['.as-seg', 'mode-control'], ['.cc-review', 'review-summary'],
    ['.card', 'card'], ['.card .card-art', 'card-art'], ['.card .card-body', 'card-body'],
  ];
  for (const [selector, kind] of hooks) {
    for (const node of root.querySelectorAll(selector)) if (!node.dataset.creationPart) node.dataset.creationPart = kind;
  }
  for (const nav of root.querySelectorAll('.cz-railed')) markUiComponent(nav, UI.creationStepNavigation);
  return root;
}

/** The same kit navigation used by the live screen, available independently. */
export function createCreationStepNavigation({ steps = [], currentId = null, onSelect = null, labels = {} } = {}) {
  const entries = Array.from(steps);
  const items = entries.map(step => railItem({ label: step.label, current: step.id === currentId,
    attrs: { dataset: { creationStep: step.id, member: step.id } },
  }));
  const host = part(el('div', { class: 'as-railed cc-page-parts cc-step-navigation' }), UI.creationStepNavigation, 'navigation');
  const currentLabel = item => {
    const index = items.indexOf(item), step = entries[index];
    return labels.currentStep?.(step, index, entries.length) || `${index + 1} / ${entries.length} · ${step?.label || ''}`;
  };
  const update = id => {
    for (const item of items) {
      const selected = item.dataset.creationStep === id;
      item.classList.toggle('on', selected);
      item.setAttribute('aria-selected', String(selected));
      if (selected) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    }
    nav.sync();
  };
  const nav = categoryNav({ items, ariaLabel: labels.title || '', face: currentLabel,
    label: text => [labels.allSteps, text].filter(Boolean).join(' · '),
    choose: id => { update(id); onSelect?.(id); },
  });
  nav.attach(host);
  host.update = update;
  host.destroy = () => nav.release();
  host.navigation = nav;
  if (currentId || entries[0]) update(currentId || entries[0].id);
  return host;
}
