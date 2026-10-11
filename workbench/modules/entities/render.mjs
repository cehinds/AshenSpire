// workbench/modules/entities/render.mjs — the Entity Browser's render page. Served
// by the GAME server (the Workbench origin cannot import /src/*), it draws game
// objects with the real renderers and talks to the Workbench module over
// postMessage. Both directions are origin-checked: the parent origin comes from
// the ?po= parameter the module passes, and only messages from window.parent at
// that origin are obeyed.
//
// Parent -> page:  { source:'ashen-entities-module', type:'set', params:{kind,view,id,q,sort,class,type,tag,rarity,density,layout,pose} }
// Page -> parent:  type 'ready' | 'counts' | 'index' | 'shown' | 'select' (see post())

import { contentBundle } from '../../../src/content/index.js';
import { createRegistries } from '../../../src/model/registries.js';
import { renderEquipmentCard, renderEquipmentInspection } from '../../../src/ui/components/equipmentCard.js';
import { renderCollectibleCard, renderCollectibleInspection } from '../../../src/ui/components/collectibleCard.js';
import { renderCard, cardDetailHtml } from '../../../src/ui/components/card.js';
import { configureTooltipGlossary, inspectionTag } from '../../../src/ui/components/tooltipGlossary.js';
import { statusTooltipText } from '../../../src/ui/uiContent.js';
import { createPaintedStage } from '../../../src/ui/paintedOutfits.js';
import { inventoryItemCardModel, inventoryDetailCardModel } from '../../../src/ui/models/ArmouryModels.js';
import { renderInventoryItemCard, renderInventoryDetailCard } from '../../../src/ui/components/armouryComponents.js';
import { cardLevelCssProperties, cardShapeCssProperties } from '../../../src/ui/models/CardSizeModel.js';
import { KINDS, entryOf, filterEntries, sortEntries, parseDeepLink } from './model.mjs';

const SOURCE = 'ashen-entities';
const params = new URLSearchParams(location.search);
const parentOrigin = params.get('po') || '';
const stage = document.getElementById('stage');
const note = stage.querySelector('.ent-note');

// The card sizes and shapes the game projects onto :root (armament-kits-preview does the same).
for (const [name, value] of Object.entries({ ...cardLevelCssProperties(), ...cardShapeCssProperties() })) {
  document.documentElement.style.setProperty(name, value);
}

const registries = createRegistries(contentBundle);
configureTooltipGlossary(registries);

/** The definitions of one kind, as an array. Armaments and armour are tables, not registries. */
function defsOf(kind) {
  const r = registries;
  const source = {
    armaments: () => r.equipment.armaments,
    armor: () => r.equipment.armour,
    potions: () => r.flasks.all(),
    relics: () => r.relics.all(),
    cards: () => r.cards.all(),
    statuses: () => r.statuses.all(),
    stances: () => r.stances.all(),
    keywords: () => r.keywords.all(),
    enemies: () => r.enemies.all(),
    classes: () => r.classes.all(),
  }[kind];
  if (!source) return [];
  return [...(source() || [])];
}

/** Armour ids repeat across classes, so an armour entity is named by its class and id. */
const keyOf = (kind, def) => (kind === 'armor' && def.classId ? `${def.classId}:${def.id}` : def.id);
const findDef = (kind, id) => defsOf(kind).find((d) => keyOf(kind, d) === id) || null;

function indexOf(kind) {
  return defsOf(kind).map((def) => ({ ...entryOf(kind, def), id: keyOf(kind, def) }));
}

const isEquipment = (kind) => kind === 'armaments' || kind === 'armor';
const isCollectible = (kind) => kind === 'potions' || kind === 'relics';
const isTag = (kind) => kind === 'statuses' || kind === 'stances' || kind === 'keywords';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** A data card: name and the scalar fields of a definition, for kinds with no card renderer. */
function dataCard(def) {
  const card = document.createElement('div');
  card.className = 'ent-data-card';
  const rows = Object.entries(def)
    .filter(([k, v]) => !['id', 'name', 'flavor', 'art', 'moves'].includes(k) && (typeof v !== 'object' || v === null || Array.isArray(v)))
    .slice(0, 14)
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(Array.isArray(v) ? v.join(' – ') : v ?? '—')}</dd>`)
    .join('');
  const moves = def.moves && typeof def.moves === 'object' ? `<p class="ent-faint">${Object.keys(def.moves).length} moves</p>` : '';
  card.innerHTML = `<p class="ent-glyph" aria-hidden="true">${esc(def.art || def.glyph || '◆')}</p><h3>${esc(def.name || def.id)}</h3><p class="ent-faint">${esc(def.id)}</p>${moves}<dl>${rows}</dl>`;
  return card;
}

/** The grid's and the card tab's face for one entity: the game's own renderer where one exists. */
function cardFor(kind, def) {
  const r = registries;
  if (isEquipment(kind)) return renderEquipmentCard(r, def).card;
  if (kind === 'potions') return renderCollectibleCard(r, def, 'Potion').card;
  if (kind === 'relics') return renderCollectibleCard(r, def, 'Relic').card;
  if (kind === 'cards') return renderCard(r, { cardId: def.id, upgraded: false }, { inspectReadOnly: true });
  if (isTag(kind)) {
    const sample = inspectionTag(def.name, statusTooltipText(def));
    sample.classList.add('status-sample');
    sample.dataset.contentId = def.id;
    return sample;
  }
  return dataCard(def);
}

function inventoryFor(kind, def) {
  const category = kind === 'armor' ? 'Armor' : def.kind === 'shield' ? 'Shield' : def.kind === 'staff' ? 'Staff' : 'Weapon';
  const row = { key: def.id, id: def.id, name: def.name, item: def, category, count: 1, equippedLabels: [] };
  const mods = kind === 'armor'
    ? [`Defense ${def.defenseRating ?? '—'}`, `Weight ${def.weight ?? '—'}`]
    : [`Attack ${def.attackRating ?? '—'}`, `Defense ${def.defenseRating ?? '—'}`, `Weight ${def.weight ?? '—'}`];
  const wrap = document.createElement('div');
  wrap.className = 'ent-inventory';
  const face = renderInventoryItemCard(inventoryItemCardModel(row, { selected: true }));
  const detail = renderInventoryDetailCard(inventoryDetailCardModel({
    row, art: { kind: 'image', value: `assets/equipment/icon_${def.id}.webp` }, description: def.blurb || '', mods,
  }));
  wrap.append(face, detail);
  return wrap;
}

function tooltipFor(kind, def) {
  const r = registries;
  if (isEquipment(kind)) return renderEquipmentInspection(r, def);
  if (isCollectible(kind)) return renderCollectibleInspection(r, def, kind === 'potions' ? 'Potion' : 'Relic');
  if (kind === 'cards') {
    const box = document.createElement('div');
    box.className = 'ent-html';
    box.innerHTML = cardDetailHtml(r, { cardId: def.id, upgraded: false });
    return box;
  }
  if (isTag(kind)) {
    const box = document.createElement('div');
    box.className = 'ent-tip';
    const tag = inspectionTag(def.name, statusTooltipText(def));
    const text = document.createElement('p');
    text.textContent = statusTooltipText(def);
    box.append(tag, text);
    return box;
  }
  return dataCard(def);
}

/** Worn by class: a painted figure per class, posed with the chosen rest pose. */
function wornFor(kind, def, pose) {
  const box = document.createElement('div');
  box.className = 'ent-worn';
  if (kind === 'armaments') {
    box.innerHTML = '<p class="ent-note">Armaments are held, not worn. Open Try in fight to see one in a class’s hands.</p>';
    return box;
  }
  if (!(kind === 'armor' || kind === 'classes')) {
    box.innerHTML = '<p class="ent-note">Only armour and classes are worn on a figure.</p>';
    return box;
  }
  const all = registries.classes.all();
  const classes = kind === 'classes' ? [def] : def.sharedSet ? all : all.filter((c) => c.id === def.classId);
  for (const cls of classes) {
    const figure = document.createElement('figure');
    const caption = document.createElement('figcaption');
    caption.textContent = cls.name;
    const stagePose = kind === 'armor' ? createPaintedStage(cls.id, def.id) : createPaintedStage(cls.id);
    if (stagePose) {
      stagePose.el.style.cssText = 'position:relative;width:100%;height:180px';
      stagePose.el.setAttribute('aria-label', `${cls.name} wearing ${def.name}`);
      stagePose.setRestPose(pose, { immediate: true });
      figure.append(stagePose.el);
    } else {
      figure.append(Object.assign(document.createElement('p'), { className: 'ent-note', textContent: 'No painted figure' }));
    }
    figure.append(caption);
    box.append(figure);
  }
  return box;
}

/** The view for one entity (detail-style views). */
function entityView(kind, def, view, pose) {
  if (view === 'inventory') return isEquipment(kind) ? inventoryFor(kind, def) : messageBox('The inventory view is for armaments and armour.');
  if (view === 'worn') return wornFor(kind, def, pose);
  if (view === 'tooltip') return tooltipFor(kind, def);
  if (view === 'data') {
    const pre = document.createElement('pre');
    pre.className = 'ent-json';
    pre.textContent = JSON.stringify(def, null, 2);
    return pre;
  }
  const big = document.createElement('div');
  big.className = 'ent-detail';
  big.append(cardFor(kind, def));
  return big;
}

function messageBox(text) {
  const p = document.createElement('p');
  p.className = 'ent-note';
  p.textContent = text;
  return p;
}

// The page's state: what the parent last asked for.
let current = parseDeepLink({});
let indexedKind = null;

function post(type, body = {}) {
  if (!parentOrigin || window.parent === window) return;
  window.parent.postMessage({ source: SOURCE, type, ...body }, parentOrigin);
}

function drawGrid(state) {
  const all = indexOf(state.kind);
  const shown = sortEntries(filterEntries(all, state), state.sort);
  const grid = document.createElement('div');
  grid.className = `ent-grid density-${state.density} layout-${state.layout}`;
  grid.dataset.kind = state.kind;
  for (const entry of shown) {
    const def = findDef(state.kind, entry.id);
    if (!def) continue;
    const article = document.createElement('article');
    article.dataset.entityId = entry.id;
    article.setAttribute('aria-label', entry.name);
    article.tabIndex = 0;
    article.append(cardFor(state.kind, def));
    article.addEventListener('click', () => post('select', { kind: state.kind, id: entry.id }));
    article.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') post('select', { kind: state.kind, id: entry.id }); });
    grid.append(article);
  }
  stage.replaceChildren(grid);
  if (!shown.length) stage.append(messageBox('Nothing matches these filters.'));
  return { shown: shown.length, total: all.length };
}

function drawOne(state) {
  const def = state.id ? findDef(state.kind, state.id) : null;
  if (!def) {
    stage.replaceChildren(messageBox(state.id ? `No ${state.kind} entry named “${state.id}”.` : 'Choose an entity.'));
    return { shown: 0, total: 1 };
  }
  stage.replaceChildren(entityView(state.kind, def, state.view, state.pose || 'idle'));
  return { shown: 1, total: 1 };
}

/** Renders the state the parent sent. The index is posted again only when the kind changes. */
function apply(next) {
  current = { ...parseDeepLink({}), ...next };
  if (current.kind !== indexedKind) {
    indexedKind = current.kind;
    post('index', { kind: current.kind, entries: indexOf(current.kind) });
  }
  const counts = current.view === 'grid' ? drawGrid(current) : drawOne(current);
  document.body.dataset.entitiesReady = 'true';
  post('shown', { kind: current.kind, view: current.view, ...counts });
}

window.addEventListener('message', (event) => {
  if (!parentOrigin || event.origin !== parentOrigin || event.source !== window.parent) return;
  const data = event.data;
  if (!data || data.source !== 'ashen-entities-module') return;
  if (data.type === 'set') apply(parseDeepLink(data.params || {}));
});

if (!parentOrigin) {
  stage.replaceChildren(messageBox('Open this page from the Entity Browser (it passes its origin in ?po=).'));
} else {
  post('counts', {
    counts: Object.fromEntries(KINDS.map((k) => [k.id, defsOf(k.id).length])),
    classes: defsOf('classes').map((c) => ({ id: c.id, name: c.name })),
    armaments: defsOf('armaments').map((a) => ({ id: a.id, name: a.name })),
  });
  post('ready', {});
  apply(parseDeepLink(params));
}
