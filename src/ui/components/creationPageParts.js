// Production creation surfaces. The catalogue and the live flow share these
// DOM parts; text, trim, material and icon geometry remain independent.
import { el, railItem, categoryNav } from '../kit/index.js';
import { engravedIcon } from './engravedIcon.js';
import { assetUrl } from '../assetmap.js';
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

/** Inspection is a local UI choice. This renderer never modifies a run or grants a feat. */
export function createCreationFeatBrowser({ feats = [], selectedId = null, onInspect = null, labels = {}, allowance = 0 } = {}) {
  const list = Array.from(feats);
  const tiles = new Map();
  const tileList = el('div', { class: 'cc-feat-choices', role: 'group', 'aria-label': labels.listLabel || labels.title || '' });
  const detail = creationPanel({ kind: 'feat-detail', className: 'cc-feat-detail', attrs: { role: 'region', 'aria-label': labels.detailLabel || labels.title || '' } });
  markUiComponent(detail, UI.creationFeatDetail);
  const detailBody = detail.querySelector('.cc-part-body');
  const status = labels.availability ? el('p', { class: 'cc-feat-availability', text: labels.availability, dataset: { creationPart: 'availability' } }) : null;
  const node = part(el('section', { class: 'cc-page-parts cc-feat-browser', dataset: { birthFeatAllowance: String(allowance) } }, [
    labels.title ? creationPageHeading({ eyebrow: labels.eyebrow, title: labels.title, description: labels.description, aside: status }) : status,
    el('div', { class: 'cc-feat-layout' }, [tileList, detail]),
  ]), UI.creationFeatBrowser, 'feat-browser');
  function inspect(id, { notify = true } = {}) {
    const feat = list.find(entry => entry.id === id);
    if (!feat) return false;
    node.dataset.inspectedFeat = id;
    for (const [key, tile] of tiles) {
      const selected = key === id;
      tile.classList.toggle('chosen', selected);
      tile.dataset.inspected = String(selected);
      tile.setAttribute('aria-pressed', String(selected));
    }
    detailBody.replaceChildren(
      creationFeatEmblem(id),
      el('h3', { class: 'as-title-l cc-feat-detail-title', text: feat.name, dataset: { creationPart: 'heading' } }),
      el('span', { class: 'as-hairline cc-feat-detail-divider', 'aria-hidden': 'true', dataset: { creationPart: 'divider' } }),
      el('p', { class: 'cc-feat-detail-description', text: feat.description, dataset: { creationPart: 'description' } }),
    );
    detail.dataset.feat = id;
    if (notify) onInspect?.(id);
    return true;
  }
  for (const feat of list) {
    const tile = creationChoiceTile({ id: feat.id, title: feat.name,
      description: labels.shortDescriptions?.[feat.id] || feat.description,
      art: creationFeatEmblem(feat.id), onChoose: id => inspect(id),
      attrs: { 'aria-controls': labels.detailId || null, dataset: { feat: feat.id } },
    });
    markUiComponent(tile, UI.creationFeatTile);
    tiles.set(feat.id, tile);
    tileList.append(tile);
  }
  if (labels.detailId) detail.id = labels.detailId;
  node.inspect = inspect;
  inspect(selectedId || list[0]?.id, { notify: false });
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
