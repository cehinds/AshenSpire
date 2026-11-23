// tools/score-studio/studio.js — Interactive Score Studio for AshenSpire.
// Uses the real in-game scoring engine, procedural card renderer, reviewed cutout assets, and combat engine.

import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';
import * as Profile from '../../src/model/gameProfile.js';
import { createRunState } from '../../src/model/state.js';
import { createRng } from '../../src/engine/rng.js';
import { createRunCombat } from '../../src/engine/runCombat.js';
import { dispatch } from '../../src/engine/combat.js';
import { renderCard } from '../../src/ui/components/card.js';
import { reviewedCardArtCatalog } from '../../src/content/reviewedCardArt.generated.js';
import { scoring as shippedScoring } from '../../src/content/generated/scoring.js';
import { BaseFace, ScoreCard, CombatPower, RankOf, RankName, ApplyScoringOverride } from '../../src/model/combatPower.js';
import { ValidateScoringConfig } from '../../src/model/activeScoring.js';

const DRAFT_STORAGE_KEY = 'ashenspire:scoreStudioDraft:v1';
const AB_STORAGE_KEY = 'ashenspire:scoreStudioAB:v1';
const PATH_STORAGE_KEY = 'ashenspire:scoreStudioPath:v1';
const DRAFT_SAVE_DELAY_MS = 300;
const TEXT_EDIT_BURST_MS = 1000;
const UNDO_DEPTH = 40;

// Bootstrap real game registries
const profile = Profile.resolveGameProfile('default');
const registries = Profile.bindGameProfileRegistries(
  createRegistries(Profile.applyGameProfileToContent(contentBundle, profile)),
  profile
);
const studioCardOverrides = new Map();
const studioRegistries = {
  ...registries,
  cards: {
    ...registries.cards,
    get: (id) => studioCardOverrides.get(id) ?? registries.cards.get(id),
    has: (id) => studioCardOverrides.has(id) || registries.cards.has(id),
    ids: () => [...new Set([...studioCardOverrides.keys(), ...registries.cards.ids()])],
    all: () => [...studioCardOverrides.values(), ...registries.cards.all().filter((c) => !studioCardOverrides.has(c.id))],
  },
};
const UNLOCK_META = { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } };
const previewRun = createRunState({ registries: studioRegistries, classId: 'reaver', seed: 31, profileMeta: UNLOCK_META });

const clone = (v) => structuredClone(v);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  repoScoring: clone(shippedScoring),
  scoring: clone(shippedScoring),
  repoPath: localStorage.getItem(PATH_STORAGE_KEY) || 'content/source/scoring.json',
  autosave: true,
  draftStorageFailed: false,
  undoStack: [],
  redoStack: [],
  cards: [],            // editable card definitions + derived faces
  baselineRanks: {},    // id -> baseline rank under repoScoring
  selectedCardId: null,
  viewMode: 'grid',
  artLayers: {
    version: 1,
    layers: [
      { id: 'layer-1', name: 'Fire Overlay', matchKind: 'tag', matchValue: 'school:fire', mode: 'stack', assetId: 'Z.effect.5', zIndex: 10, x: 50, y: 50, scale: 85, opacity: 35, blendMode: 'screen', enabled: true },
    ],
  },
  repoArtLayers: null,  // art layers as loaded from the repo (or the built-in default); set in boot
  abSlots: { A: null, B: null, activeLabel: 'Draft' },
  sandbox: { combat: null, classId: 'reaver', enemyId: 'wanderingSoldier', appliedScoring: null, customCardId: null, log: [] },
};

// ---------------------------------------------------------------------------
// Card <-> Face conversion
// ---------------------------------------------------------------------------
function cardDefToFace(def, scoringRef) {
  const f = BaseFace();
  const tags = Array.isArray(def.tags) ? [...def.tags] : [];
  f.name = def.name || def.id;
  f.cls = def.class || 'colorless';
  f.rarity = def.rarity || 'common';
  f.type = def.type || 'attack';
  f.camp = tags.includes('camp:spell') || (def.damageSchool && def.damageSchool !== 'physical') ? 'spell' : 'physical';
  f.sp = def.staminaCost ?? def.cost ?? 0;
  f.mp = def.manaCost ?? 0;
  f.kw = Array.isArray(def.keywords) ? [...def.keywords] : [];
  f.tags = tags;
  const statusIds = new Set(Object.keys(scoringRef.statuses || {}));
  for (const e of def.effects || []) {
    const amt = typeof e.amount === 'number' ? e.amount : 1;
    if (e.op === 'damage') { f.dmg += amt * (e.hits || 1); f.hits = Math.max(f.hits, e.hits || 1); }
    else if (e.op === 'block' || e.op === 'ward') f.blk += amt;
    else if (e.op === 'poiseDamage') f.poise += amt;
    else if (e.op === 'applyStatus' && statusIds.has(e.status)) f.statuses.push([e.status, e.stacks ?? 1, e.target === 'self' ? 'self' : 'enemy']);
    else if (e.op === 'draw') f.draw += amt;
    else if (e.op === 'heal') f.heal += amt;
    else if (e.op === 'loseHp') f.loseHp += amt;
    else if (e.op === 'discard') f.discard += amt;
    else if (e.op === 'restoreStamina' || e.op === 'gainEnergy') f.restoreSp += amt;
    else if (e.op === 'restoreMana') f.restoreMp += amt;
    else if (e.op === 'removeStatus' && e.target === 'self') f.cleanse += 1;
    else if (e.op === 'applyReflect') f.reflect += amt;
    else if (e.op === 'moveEngagement') f.move += 1;
    else if (e.op === 'pullEnemy' || e.op === 'swapRows') f.pull += 1;
  }
  return f;
}

function getCardTarget(def) {
  const tags = def.tags || [];
  if (tags.includes('targeting:area') || tags.includes('targeting.allEnemies')) return 'allEnemies';
  if (tags.includes('targeting.randomEnemy')) return 'randomEnemy';
  if (tags.includes('targeting.self')) return 'self';
  if (tags.includes('targeting.ally')) return 'ally';
  if (tags.includes('targeting.allAllies')) return 'allAllies';
  const first = (def.effects || []).find((e) => e.target);
  return first?.target || 'enemy';
}

function setCardTarget(def, target) {
  def.tags = (def.tags || []).filter((t) => !t.startsWith('targeting:') && !t.startsWith('targeting.'));
  if (target === 'allEnemies') def.tags.push('targeting:area', 'targeting.allEnemies');
  else if (target === 'randomEnemy') def.tags.push('targeting.randomEnemy');
  else if (target === 'self') def.tags.push('targeting.self');
  else if (target === 'ally') def.tags.push('targeting.ally');
  else if (target === 'allAllies') def.tags.push('targeting.allAllies');
  else def.tags.push('targeting:single', 'targeting.enemy');
  for (const e of def.effects || []) {
    if (e.op === 'damage' || e.op === 'poiseDamage' || (e.op === 'applyStatus' && e.target !== 'self')) {
      e.target = target;
    }
  }
}

function scoreCardEntry(def, scoringRef = state.scoring) {
  const face = cardDefToFace(def, scoringRef);
  const res = ScoreCard(face, scoringRef);
  const cp = CombatPower(res.raw, face.rarity, scoringRef);
  const baseRow = { raw: res.raw, cp, rank: RankOf(cp, scoringRef), rarity: face.rarity };
  const ovA = scoringRef.overrides?.[def.id];
  const ovB = def.scoringOverride;
  const mergedOv = (ovA || ovB) ? { ...(ovA || {}), ...(ovB || {}) } : null;
  const finalRow = ApplyScoringOverride(baseRow, mergedOv, scoringRef);
  return { ...finalRow, parts: res.parts, face };
}

function actForRank(rank, scoringRef = state.scoring) {
  const tiers = scoringRef.levelLists?.tiers || [];
  const hits = tiers.filter((t) => rank >= t.minRank && rank <= t.maxRank).map((t) => t.id.replace('act', 'Act '));
  return hits.length ? hits[0] : 'Beyond';
}

// ---------------------------------------------------------------------------
// Toast & History & Autosave
// ---------------------------------------------------------------------------
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('studio-toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

function snapshotState() {
  return JSON.stringify({ scoring: state.scoring, cards: state.cards, artLayers: state.artLayers });
}

function updateUndoButtons() {
  document.getElementById('btn-undo').disabled = state.undoStack.length === 0;
  document.getElementById('btn-redo').disabled = state.redoStack.length === 0;
}

// Records an undo point for the state as it is now. Call before mutating; call saveDraft() after.
function pushHistory() {
  state.undoStack.push(snapshotState());
  if (state.undoStack.length > UNDO_DEPTH) state.undoStack.shift();
  state.redoStack = [];
  updateUndoButtons();
}

function editedCards() {
  return state.cards.filter((c) => c._edited || c._custom);
}

function weightChangeCount() {
  return buildScoringDiff().length;
}

function artLayersChanged() {
  return JSON.stringify(state.artLayers) !== JSON.stringify(state.repoArtLayers);
}

function isDirty() {
  return weightChangeCount() > 0 || editedCards().length > 0 || artLayersChanged();
}

function refreshDirtyStatus() {
  const pill = document.getElementById('draft-status');
  const dirty = isDirty();
  pill.classList.toggle('is-dirty', dirty);
  if (!dirty) pill.textContent = 'Synced with repo';
  else if (!state.autosave) pill.textContent = 'Unsaved edits';
  else if (state.draftStorageFailed) pill.textContent = 'Unsaved edits (storage full)';
  else pill.textContent = 'Draft auto-saved (local temp copy)';
}

function writeDraftNow() {
  state.draftStorageFailed = false;
  if (state.autosave) {
    try {
      if (isDirty()) {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          savedAt: new Date().toISOString(),
          scoring: state.scoring,
          artLayers: state.artLayers,
          customCards: editedCards(),
        }));
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch {
      state.draftStorageFailed = true;
    }
  }
  refreshDirtyStatus();
}

// Saves the local draft after a change has been applied, debounced so typing stays cheap.
let draftTimer = null;
function saveDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(writeDraftNow, DRAFT_SAVE_DELAY_MS);
}

function restoreSnapshot(snapStr) {
  const snap = JSON.parse(snapStr);
  state.scoring = snap.scoring;
  state.cards = snap.cards;
  state.artLayers = snap.artLayers;
  syncAllViews();
  saveDraft();
}

// ---------------------------------------------------------------------------
// Procedural Art Layer Overlay
// ---------------------------------------------------------------------------
function matchingCustomLayers(def) {
  const tags = def.tags || [];
  const statuses = (def.effects || []).filter((e) => e.op === 'applyStatus').map((e) => e.status);
  return (state.artLayers.layers || [])
    .filter((l) => l.enabled !== false && l.assetId)
    .filter((l) => {
      if (l.matchKind === 'default') return true;
      if (l.matchKind === 'type') return def.type === l.matchValue;
      if (l.matchKind === 'tag') return tags.includes(l.matchValue);
      if (l.matchKind === 'status') return statuses.includes(l.matchValue);
      return false;
    })
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

const STUDIO_ONLY_FIELDS = ['_edited', '_custom', 'scoringOverride'];

// The game draws core cards from the profile's own card list (projectGameCard in src/model/gameProfile.js),
// not from the registry, so an edited card would show its shipped face. Project the edited copy the same
// way, from a profile whose card list holds it, and hand the result to renderCard as its definition.
function projectEditedCard(def) {
  const profile = previewRun.gameProfile;
  const content = profile?.content;
  if (!content) return def;
  const authored = Object.fromEntries(Object.entries(def).filter(([key]) => !STUDIO_ONLY_FIELDS.includes(key)));
  // A resource variant for this card would overwrite the edited costs, so leave it out.
  const { [def.id]: _shippedVariants, ...otherVariants } = content.resourceVariants || {};
  const subject = { gameProfile: { ...profile, content: { ...content, cards: [authored], resourceVariants: otherVariants } } };
  try {
    return Profile.projectGameCard(subject, def.id) || def;
  } catch {
    return def;
  }
}

function renderCardWithLayers(def, container) {
  container.innerHTML = '';
  studioCardOverrides.set(def.id, def);
  const edited = def._edited || def._custom;
  try {
    const el = renderCard(studioRegistries, { cardId: def.id }, { rules: previewRun, showArt: true, ...(edited ? { definition: projectEditedCard(def) } : {}) });
    if (el) container.appendChild(el);
  } catch {
    container.innerHTML = `<div style="padding:10px;text-align:center;"><strong>${esc(def.name)}</strong><div class="studio-muted">${esc(def.type)}</div></div>`;
  }
  const layers = matchingCustomLayers(def);
  if (layers.length) {
    const overlay = document.createElement('div');
    overlay.className = 'studio-custom-layer-overlay';
    for (const l of layers) {
      const asset = reviewedCardArtCatalog.assets[l.assetId];
      if (!asset) continue;
      const img = document.createElement('img');
      img.src = asset.path;
      img.alt = '';
      img.style.cssText = `position:absolute;left:${l.x ?? 50}%;top:${l.y ?? 50}%;width:${l.scale ?? 80}%;height:${l.scale ?? 80}%;object-fit:contain;transform:translate(-50%,-50%);opacity:${(l.opacity ?? 100) / 100};mix-blend-mode:${l.blendMode || 'normal'};z-index:${l.zIndex ?? 1};pointer-events:none;`;
      overlay.appendChild(img);
    }
    container.appendChild(overlay);
  }
}

// ---------------------------------------------------------------------------
// Gallery & Targeted Async Card Updates
// ---------------------------------------------------------------------------
function computeShiftCount() {
  let shifted = 0;
  for (const c of state.cards) {
    const now = scoreCardEntry(c).rank;
    const base = state.baselineRanks[c.id];
    if (base !== undefined && now !== base) shifted++;
  }
  const badge = document.getElementById('shift-count-badge');
  badge.textContent = String(shifted);
  badge.classList.toggle('hidden', shifted === 0);
  const summary = document.getElementById('weights-impact-summary');
  if (summary) summary.textContent = shifted ? `${shifted} card(s) shifted rank vs. repo baseline` : 'No rank shifts vs. repo baseline';
  return shifted;
}

function updateCardTileInPlace(cardId) {
  const tile = document.querySelector(`.studio-card-tile[data-card-id="${CSS.escape(cardId)}"]`);
  const def = state.cards.find((c) => c.id === cardId);
  if (!tile || !def) return;
  const sc = scoreCardEntry(def);
  const baseRank = state.baselineRanks[def.id];
  const shiftHtml = (baseRank !== undefined && baseRank !== sc.rank)
    ? `<span class="${sc.rank > baseRank ? 'shift-up' : 'shift-down'}">${sc.rank > baseRank ? '↑' : '↓'} R${baseRank}→R${sc.rank}</span>`
    : '';
  renderCardWithLayers(def, tile.querySelector('.studio-card-stage'));
  tile.querySelector('.studio-card-meta').innerHTML = `
    <span class="cp-chip" title="${esc(def.name)}">${esc(def.name)} · CP ${sc.cp}${sc.overridden ? '*' : ''}</span>
    <span class="rank-chip">${esc(RankName(sc.rank))} · ${esc(actForRank(sc.rank))}</span>
    ${shiftHtml}
  `;
}

function renderCardsGrid() {
  const grid = document.getElementById('cards-grid');
  grid.classList.toggle('is-single', state.viewMode === 'single');
  const q = document.getElementById('card-search').value.trim().toLowerCase();
  const typeF = document.getElementById('filter-type').value;
  const clsF = document.getElementById('filter-class').value;
  const rankF = document.getElementById('filter-rank').value;
  const shiftF = document.getElementById('filter-shift').value;

  const filtered = state.cards.filter((c) => {
    const sc = scoreCardEntry(c);
    if (typeF !== 'all' && c.type !== typeF) return false;
    if (clsF !== 'all' && (c.class || 'colorless') !== clsF) return false;
    if (rankF !== 'all' && String(sc.rank) !== rankF) return false;
    if (shiftF === 'shifted' && sc.rank === state.baselineRanks[c.id]) return false;
    if (q) {
      const hay = `${c.name} ${c.id} ${c.type} ${(c.tags || []).join(' ')} ${(c.keywords || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  grid.innerHTML = '';
  for (const def of filtered) {
    const sc = scoreCardEntry(def);
    const baseRank = state.baselineRanks[def.id];
    const shiftHtml = (baseRank !== undefined && baseRank !== sc.rank)
      ? `<span class="${sc.rank > baseRank ? 'shift-up' : 'shift-down'}">${sc.rank > baseRank ? '↑' : '↓'} R${baseRank}→R${sc.rank}</span>`
      : '';
    const tile = document.createElement('div');
    tile.className = 'studio-card-tile' + (def.id === state.selectedCardId ? ' is-selected' : '');
    tile.dataset.cardId = def.id;
    tile.innerHTML = `<div class="studio-card-stage"></div><div class="studio-card-meta"><span class="cp-chip" title="${esc(def.name)}">${esc(def.name)} · CP ${sc.cp}${sc.overridden ? '*' : ''}</span><span class="rank-chip">${esc(RankName(sc.rank))} · ${esc(actForRank(sc.rank))}</span>${shiftHtml}</div>`;
    renderCardWithLayers(def, tile.querySelector('.studio-card-stage'));
    tile.addEventListener('click', () => {
      state.selectedCardId = def.id;
      document.querySelectorAll('.studio-card-tile.is-selected').forEach((n) => n.classList.remove('is-selected'));
      tile.classList.add('is-selected');
      renderInspector();
    });
    grid.appendChild(tile);
  }
  computeShiftCount();
}

// ---------------------------------------------------------------------------
// Single Card Inspector (Grouped + Add Feature)
// ---------------------------------------------------------------------------
function populateAddFeatureDropdown() {
  const sel = document.getElementById('add-feature-select');
  const groups = {
    'Effects': [
      ['effect:damage', 'Damage'],
      ['effect:block', 'Block'],
      ['effect:poiseDamage', 'Poise Damage'],
      ['effect:draw', 'Draw Cards'],
      ['effect:heal', 'Heal HP'],
      ['effect:restoreStamina', 'Restore SP'],
      ['effect:restoreMana', 'Restore MP'],
      ['effect:applyReflect', 'Reflect'],
      ['effect:removeStatus', 'Cleanse Debuff'],
      ['effect:moveEngagement', 'Move Engagement'],
      ['effect:pullEnemy', 'Pull Enemy'],
    ],
    'Statuses': Object.keys(state.scoring.statuses || {}).sort().map((id) => [`status:${id}`, `Status: ${id}`]),
    'Keywords': Object.keys(state.scoring.keywords || {}).sort().map((id) => [`kw:${id}`, `Keyword: ${id}`]),
    'Weighted Tags': Object.entries(state.scoring.tags || {})
      .filter(([k, v]) => k[0] !== '$' && v && (v.weight || v.multiplier || v.pMultiplier || k.startsWith('school:') || k.startsWith('maneuver:')))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [`tag:${k}`, `${v.label || k} (${k})`]),
  };
  sel.innerHTML = '<option value="">+ Add Feature...</option>';
  for (const [label, opts] of Object.entries(groups)) {
    const og = document.createElement('optgroup');
    og.label = label;
    for (const [val, text] of opts) {
      const o = document.createElement('option');
      o.value = val;
      o.textContent = text;
      og.appendChild(o);
    }
    sel.appendChild(og);
  }
}

function renderInspector() {
  const def = state.cards.find((c) => c.id === state.selectedCardId) || state.cards[0];
  if (!def) return;
  state.selectedCardId = def.id;

  renderCardWithLayers(def, document.getElementById('inspector-card-preview'));
  const sc = scoreCardEntry(def);
  renderScoreSummary(def, sc);

  document.getElementById('edit-name').value = def.name || '';
  document.getElementById('edit-type').value = def.type || 'attack';
  document.getElementById('edit-class').value = def.class || 'colorless';
  document.getElementById('edit-rarity').value = def.rarity || 'common';
  document.getElementById('edit-camp').value = (def.tags || []).includes('camp:spell') ? 'spell' : 'physical';
  document.getElementById('edit-target').value = getCardTarget(def);
  document.getElementById('edit-sp').value = def.staminaCost ?? def.cost ?? 0;
  document.getElementById('edit-mp').value = def.manaCost ?? 0;
  const hpEff = (def.effects || []).find((e) => e.op === 'loseHp');
  document.getElementById('edit-loseHp').value = hpEff ? (hpEff.amount || 0) : 0;

  // Override fields
  const ov = def.scoringOverride || state.scoring.overrides?.[def.id] || null;
  const ovToggle = document.getElementById('edit-override-enabled');
  ovToggle.checked = Boolean(ov);
  document.getElementById('override-fields').classList.toggle('hidden', !ov);
  document.getElementById('edit-override-rank').value = Number.isInteger(ov?.rank) ? ov.rank : '';
  document.getElementById('edit-override-cp').value = Number.isFinite(ov?.cp) ? ov.cp : '';

  // Active features list (only what is on this card). Each row carries a score chip.
  const list = document.getElementById('active-features-list');
  list.innerHTML = '';
  const chips = featureScoreChips(featureScoreRows(def), sc.parts || {});
  let rowIndex = 0;
  const chipFor = () => chipHtml(chips[rowIndex++]);

  (def.effects || []).forEach((eff, idx) => {
    if (eff.op === 'loseHp') return;
    const row = document.createElement('div');
    row.className = 'feature-row';
    if (eff.op === 'applyStatus') {
      row.innerHTML = `
        <span>Status: <strong>${esc(eff.status)}</strong></span>
        <div class="feature-controls">
          ${chipFor()}
          <input type="number" min="1" max="30" value="${eff.stacks ?? 1}" data-eff-stacks="${idx}" />
          <select data-eff-target="${idx}">
            <option value="enemy" ${eff.target !== 'self' ? 'selected' : ''}>Enemy</option>
            <option value="self" ${eff.target === 'self' ? 'selected' : ''}>Self</option>
          </select>
          <button class="s-btn s-btn-sm" data-rm-eff="${idx}">×</button>
        </div>`;
    } else {
      row.innerHTML = `
        <span>Effect: <strong>${esc(eff.op)}</strong></span>
        <div class="feature-controls">
          ${chipFor()}
          <input type="number" min="1" max="99" value="${eff.amount ?? 1}" data-eff-amt="${idx}" />
          <button class="s-btn s-btn-sm" data-rm-eff="${idx}">×</button>
        </div>`;
    }
    list.appendChild(row);
  });

  (def.keywords || []).forEach((kw, idx) => {
    const row = document.createElement('div');
    row.className = 'feature-row';
    const w = state.scoring.keywords?.[kw];
    const note = w ? (w.flat !== undefined ? `${w.flat}` : `×${w.multiplier}`) : '';
    row.innerHTML = `<span>Keyword: <strong>${esc(kw)}</strong> <span class="studio-muted">${esc(note)}</span></span><div class="feature-controls">${chipFor()}<button class="s-btn s-btn-sm" data-rm-kw="${idx}">×</button></div>`;
    list.appendChild(row);
  });

  shownTagsOf(def).forEach((tag) => {
    const row = document.createElement('div');
    row.className = 'feature-row';
    row.innerHTML = `<span>Tag: <strong>${esc(tag)}</strong></span><div class="feature-controls">${chipFor()}<button class="s-btn s-btn-sm" data-rm-tag="${esc(tag)}">×</button></div>`;
    list.appendChild(row);
  });

  if (!list.children.length) {
    list.innerHTML = '<div class="studio-muted">No active features. Use "+ Add Feature" above.</div>';
  }

  renderCostChips(def, sc);
  renderScoreParts(def, sc);
}

// ---------------------------------------------------------------------------
// Score chips: how much each feature row adds to the card's raw score
// ---------------------------------------------------------------------------
// ScoreCard part key (src/model/combatPower.js) and scoring.effects weight entry for each effect op.
const EFFECT_SCORE_KEYS = Object.freeze({
  damage:         { part: 'damage',     weight: 'damage' },
  block:          { part: 'block',      weight: 'block' },
  ward:           { part: 'block',      weight: 'block' },
  poiseDamage:    { part: 'poise',      weight: 'poiseDamage' },
  draw:           { part: 'draw',       weight: 'draw' },
  heal:           { part: 'heal',       weight: 'heal' },
  discard:        { part: 'discard',    weight: 'discard' },
  restoreStamina: { part: 'SP restore', weight: 'restoreStamina' },
  gainEnergy:     { part: 'SP restore', weight: 'restoreStamina' },
  restoreMana:    { part: 'MP restore', weight: 'restoreMana' },
  removeStatus:   { part: 'cleanse',    weight: 'removeStatus' },
  applyReflect:   { part: 'reflect',    weight: 'applyReflect' },
  pullEnemy:      { part: 'pull',       weight: 'pullEnemy' },
  swapRows:       { part: 'pull',       weight: 'pullEnemy' },
  moveEngagement: { part: 'move',       weight: 'moveEngagement' },
});
// Effects the scorer counts once per effect, whatever the amount (see cardDefToFace).
const COUNTED_ONCE_OPS = new Set(['removeStatus', 'pullEnemy', 'swapRows', 'moveEngagement']);
// Statuses ScoreCard values with a closed form instead of weight x stacks (exactStatus in combatPower.js).
const EXACT_SCORED_STATUSES = new Set(['burn', 'venom', 'shock', 'chill']);
const SCORE_CHIP_TITLE = 'raw score points (before the rarity discount)';
const SCORE_MATCH_TOLERANCE = 0.05;

function shownTagsOf(def) {
  return (def.tags || []).filter((t) => !t.startsWith('camp:') && !t.startsWith('classification.') && !t.startsWith('targeting'));
}

function formatScore(value) {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

function scoreClass(value) {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? 'is-pos' : rounded < 0 ? 'is-neg' : 'is-zero';
}

// One entry per Active Features row, in render order: which part it feeds and how to explain it.
function featureScoreRows(def) {
  const rows = [];
  for (const eff of def.effects || []) {
    if (eff.op === 'loseHp') continue;
    if (eff.op === 'applyStatus') {
      const status = state.scoring.statuses?.[eff.status];
      const selfTarget = eff.target === 'self';
      const helpsPlayer = status ? (status.target === 'self') === selfTarget : true;
      rows.push({
        part: status ? eff.status : null,
        count: eff.stacks ?? 1,
        unitWeight: status?.weight,
        per: 1,
        sign: helpsPlayer ? 1 : -1,
        exact: EXACT_SCORED_STATUSES.has(eff.status),
        capAt: state.scoring.cardModel?.decayOneStatuses?.includes(eff.status) ? state.scoring.model?.R : null,
      });
      continue;
    }
    const keys = EFFECT_SCORE_KEYS[eff.op];
    const effectWeight = keys ? state.scoring.effects?.[keys.weight] : null;
    const counted = eff.op === 'removeStatus' && eff.target !== 'self' ? 0 : COUNTED_ONCE_OPS.has(eff.op) ? 1 : (eff.amount ?? 1) * (eff.op === 'damage' ? (eff.hits || 1) : 1);
    rows.push({
      part: keys?.part ?? null,
      count: counted,
      unitWeight: effectWeight?.weight,
      per: effectWeight?.per ?? 1,
      sign: 1,
    });
  }
  for (const kw of def.keywords || []) rows.push({ part: kw, count: null });
  for (const tag of shownTagsOf(def)) rows.push({ part: tag, count: null });
  return rows;
}

// Turns rows into chips. The total always comes from ScoreCard's parts, so a chip matches the real score.
// Rows sharing a part key (two damage effects) show the total on the first row only.
function featureScoreChips(rows, parts) {
  const firstRowForPart = new Map();
  return rows.map((row, index) => {
    if (!row.part) return null;
    if (firstRowForPart.has(row.part)) return { count: row.count, shared: true };
    firstRowForPart.set(row.part, index);
    const total = parts[row.part] || 0;
    return { count: row.count, total, title: scoreChipTitle(row, rows, total) };
  });
}

function scoreChipTitle(row, rows, total) {
  const totalText = `${formatScore(total)} ${SCORE_CHIP_TITLE}`;
  if (row.count === null || row.unitWeight === undefined) return `${totalText[0].toUpperCase()}${totalText.slice(1)}`;
  if (row.exact) return `${row.count} stacks = ${totalText} (grows faster per stack)`;
  const sameRows = rows.filter((r) => r.part === row.part);
  const count = sameRows.reduce((sum, r) => sum + r.count, 0);
  const expected = sameRows.reduce((sum, r) => sum + r.sign * r.unitWeight * r.count / r.per, 0);
  const capped = row.capAt && count > row.capAt;
  const adjusted = Math.abs(expected - total) > SCORE_MATCH_TOLERANCE;
  const note = capped ? ' (capped)' : adjusted ? ' (adjusted by targeting)' : '';
  return `${row.unitWeight} per ${row.per} × ${count} = ${totalText}${note}`;
}

function chipHtml(chip) {
  if (!chip) return '';
  const countHtml = chip.count === null || chip.count === undefined ? '' : `<span class="feature-count">×${chip.count}</span>`;
  if (chip.shared) return `<span class="feature-score is-zero" title="Counted in the row above">${countHtml}<span class="feature-total">in ↑</span></span>`;
  return `<span class="feature-score ${scoreClass(chip.total)}" title="${esc(chip.title)}">${countHtml}<span class="feature-total">${formatScore(chip.total)}</span></span>`;
}

// Score chips beside the SP, MP and HP cost inputs in Card Basics.
function renderCostChips(def, sc) {
  const parts = sc.parts || {};
  const hpEffect = (def.effects || []).find((e) => e.op === 'loseHp');
  const loseHpWeight = state.scoring.effects?.loseHp;
  const costRows = [
    { id: 'cost-score-sp', part: 'SP', count: def.staminaCost ?? def.cost ?? 0, unitWeight: state.scoring.costs?.sp?.weight, per: 1, sign: 1 },
    { id: 'cost-score-mp', part: 'MP', count: def.manaCost ?? 0, unitWeight: state.scoring.costs?.mp?.weight, per: 1, sign: 1 },
    { id: 'cost-score-hp', part: 'HP cost', count: hpEffect?.amount ?? 0, unitWeight: loseHpWeight?.weight, per: loseHpWeight?.per ?? 1, sign: 1 },
  ];
  for (const row of costRows) {
    const el = document.getElementById(row.id);
    if (!el) continue;
    const total = parts[row.part] || 0;
    el.outerHTML = chipHtml({ count: row.count, total, title: scoreChipTitle(row, [row], total) }).replace('<span class="feature-score', `<span id="${row.id}" class="feature-score`);
  }
}

function renderScoreSummary(def, sc) {
  const baseRank = state.baselineRanks[def.id];
  const shiftTxt = (baseRank !== undefined && baseRank !== sc.rank) ? ` (was ${RankName(baseRank)})` : '';
  document.getElementById('inspector-score-summary').innerHTML = `
    <div class="inspector-score-big">CP ${sc.cp}</div>
    <div><strong>${esc(RankName(sc.rank))}</strong> · ${esc(actForRank(sc.rank))}${esc(shiftTxt)}</div>
    <div class="studio-muted">Raw: ${sc.raw} · Rarity: ${esc(sc.rarity)}${sc.overridden ? ' · Overridden' : ''}</div>
  `;
}

function renderScoreParts(def, sc) {
  const partsEl = document.getElementById('score-parts-list');
  partsEl.innerHTML = '';
  // The rank comes first, then the parts that add up to it.
  const baseRank = state.baselineRanks[def.id];
  const shifted = baseRank !== undefined && baseRank !== sc.rank;
  const rankPill = document.createElement('span');
  rankPill.className = 'part-pill rank-pill';
  rankPill.textContent = `Rank: ${RankName(sc.rank)}${shifted ? ` (was ${RankName(baseRank)})` : ''}`;
  rankPill.title = `CP ${sc.cp} · ${actForRank(sc.rank)}`;
  partsEl.appendChild(rankPill);
  for (const [k, v] of Object.entries(sc.parts || {})) {
    const pill = document.createElement('span');
    pill.className = `part-pill ${v >= 0 ? 'pos' : 'neg'}`;
    pill.textContent = `${k}: ${formatScore(v)}`;
    partsEl.appendChild(pill);
  }
}

// Live rescore while a number is being typed or spun: updates chips, summary and breakdown in place,
// never rebuilding the feature list, so focus and a held spinner survive.
function refreshInspectorScoreInPlace(def) {
  const sc = scoreCardEntry(def);
  renderScoreSummary(def, sc);
  renderScoreParts(def, sc);
  renderCostChips(def, sc);
  const chips = featureScoreChips(featureScoreRows(def), sc.parts || {});
  const rowsEls = [...document.querySelectorAll('#active-features-list .feature-row')];
  rowsEls.forEach((rowEl, index) => {
    const oldChip = rowEl.querySelector('.feature-score');
    const html = chipHtml(chips[index]);
    if (oldChip && html) oldChip.outerHTML = html;
  });
}

function selectedCardDef() {
  return state.cards.find((c) => c.id === state.selectedCardId);
}

// One undo step per burst of typing or spinner ticks; the burst ends after a pause or a new focus.
function createEditBurst() {
  let open = false;
  let timer = null;
  return {
    begin() {
      if (!open) {
        pushHistory();
        open = true;
      }
      clearTimeout(timer);
      timer = setTimeout(() => { open = false; }, TEXT_EDIT_BURST_MS);
    },
    end() {
      open = false;
      clearTimeout(timer);
    },
  };
}

// Applies a typed or spun number without rebuilding the inspector, then rescores in place.
function applyLiveCardEdit(burst, fn) {
  const def = selectedCardDef();
  if (!def) return;
  burst.begin();
  fn(def);
  def._edited = true;
  refreshInspectorScoreInPlace(def);
  saveDraft();
}

// Refreshes what sits outside the feature list once a number edit is committed.
function commitLiveCardEdit() {
  const def = selectedCardDef();
  if (!def) return;
  renderCardWithLayers(def, document.getElementById('inspector-card-preview'));
  updateCardTileInPlace(def.id);
  computeShiftCount();
}

function mutateSelectedCard(fn, { recordHistory = true } = {}) {
  const def = selectedCardDef();
  if (!def) return;
  if (recordHistory) pushHistory();
  fn(def);
  def._edited = true;
  // Targeted update: refresh only the inspector and this one card tile.
  renderInspector();
  updateCardTileInPlace(def.id);
  computeShiftCount();
  saveDraft();
}

// ---------------------------------------------------------------------------
// Weights Tab
// ---------------------------------------------------------------------------
function renderWeights() {
  const q = document.getElementById('weights-search').value.trim().toLowerCase();
  const groupF = document.getElementById('weights-group-filter').value;
  const container = document.getElementById('weights-container');
  container.innerHTML = '';

  const groups = [
    { key: 'costs', title: 'Costs (SP / MP)', entries: Object.entries(state.scoring.costs || {}).map(([k, v]) => ({ id: k, label: k.toUpperCase(), val: v.weight, set: (n) => { state.scoring.costs[k].weight = n; } })) },
    { key: 'effects', title: 'Effects', entries: Object.entries(state.scoring.effects || {}).map(([k, v]) => ({ id: k, label: `${k} (per ${v.per})`, val: v.weight, set: (n) => { state.scoring.effects[k].weight = n; } })) },
    { key: 'statuses', title: 'Statuses', entries: Object.entries(state.scoring.statuses || {}).map(([k, v]) => ({ id: k, label: `${k} (${v.target})`, val: v.weight, set: (n) => { state.scoring.statuses[k].weight = n; } })) },
    { key: 'keywords', title: 'Keywords', entries: Object.entries(state.scoring.keywords || {}).map(([k, v]) => ({ id: k, label: k + (v.flat !== undefined ? ' (flat)' : ' (mult)'), val: v.flat ?? v.multiplier, step: v.flat !== undefined ? 1 : 0.05, set: (n) => { if (v.flat !== undefined) state.scoring.keywords[k].flat = n; else state.scoring.keywords[k].multiplier = n; } })) },
    { key: 'rarity', title: 'Rarity Discounts', entries: Object.entries(state.scoring.rarity?.discount || {}).map(([k, v]) => ({ id: k, label: k, val: v, set: (n) => { state.scoring.rarity.discount[k] = n; } })) },
    { key: 'rank', title: 'Rank Bands', entries: [
      { id: 'unrankedMax', label: 'Unranked Max CP', val: state.scoring.rank.unrankedMax, set: (n) => { state.scoring.rank.unrankedMax = n; } },
      { id: 'width', label: 'Band Width', val: state.scoring.rank.width, set: (n) => { state.scoring.rank.width = Math.max(1, n); } },
      { id: 'maxRank', label: 'Max Rank', val: state.scoring.rank.maxRank, set: (n) => { state.scoring.rank.maxRank = Math.max(1, Math.round(n)); } },
      { id: 'effectCount', label: 'Multi-Effect Bonus', val: state.scoring.effectCount?.weight ?? 5, set: (n) => { (state.scoring.effectCount ||= {}).weight = n; } },
    ] },
    { key: 'tags', title: 'Weighted Tags', entries: Object.entries(state.scoring.tags || {}).filter(([k, v]) => k[0] !== '$' && v && (v.weight !== 0 || v.multiplier || v.pMultiplier)).map(([k, v]) => ({ id: k, label: `${v.label || k} (${k})`, val: v.weight || v.multiplier || v.pMultiplier, step: v.weight !== 0 ? 1 : 0.05, set: (n) => { if (v.multiplier !== undefined) state.scoring.tags[k].multiplier = n; else if (v.pMultiplier !== undefined) state.scoring.tags[k].pMultiplier = n; else state.scoring.tags[k].weight = n; } })) },
  ];

  for (const g of groups) {
    if (groupF !== 'all' && g.key !== groupF) continue;
    const rows = g.entries.filter((e) => !q || `${g.title} ${e.id} ${e.label}`.toLowerCase().includes(q));
    if (!rows.length) continue;
    const card = document.createElement('div');
    card.className = 'weight-group-card';
    card.innerHTML = `<h3>${esc(g.title)}</h3>`;
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'weight-row';
      row.innerHTML = `<span>${esc(r.label)}</span><input type="number" step="${r.step || 1}" value="${r.val}" />`;
      row.querySelector('input').addEventListener('change', (ev) => {
        const n = Number(ev.target.value);
        if (!Number.isFinite(n)) return;
        pushHistory();
        r.set(n);
        computeShiftCount();
        renderInspector();
        renderCardsGrid();
        saveDraft();
      });
      card.appendChild(row);
    }
    container.appendChild(card);
  }
  computeShiftCount();
}

// ---------------------------------------------------------------------------
// Art & Layers Tab
// ---------------------------------------------------------------------------
function renderArtTab() {
  const list = document.getElementById('art-layers-list');
  const assets = Object.values(reviewedCardArtCatalog.assets || {});
  document.getElementById('asset-count').textContent = String(assets.length);

  // Preview card selector
  const cardSel = document.getElementById('art-preview-card-select');
  if (!cardSel.options.length) {
    for (const c of state.cards) {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name;
      cardSel.appendChild(o);
    }
  }
  cardSel.value = state.selectedCardId || state.cards[0]?.id || '';
  const previewDef = state.cards.find((c) => c.id === cardSel.value) || state.cards[0];
  if (previewDef) renderCardWithLayers(previewDef, document.getElementById('art-live-preview'));

  list.innerHTML = '';
  state.artLayers.layers.forEach((layer, idx) => {
    const el = document.createElement('div');
    el.className = 'layer-card';
    el.innerHTML = `
      <div class="layer-card-head">
        <strong>#${idx + 1} · ${esc(layer.name || layer.id)}</strong>
        <div>
          <label class="studio-toggle"><input type="checkbox" data-l-enabled="${idx}" ${layer.enabled !== false ? 'checked' : ''} /> On</label>
          <button class="s-btn s-btn-sm" data-l-up="${idx}" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="s-btn s-btn-sm" data-l-down="${idx}" ${idx === state.artLayers.layers.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="s-btn s-btn-sm s-btn-warn" data-l-del="${idx}">×</button>
        </div>
      </div>
      <div class="layer-grid">
        <label>Name <input type="text" data-l-field="name" data-l-idx="${idx}" value="${esc(layer.name)}" /></label>
        <label>Match Rule
          <select data-l-field="matchKind" data-l-idx="${idx}">
            <option value="tag" ${layer.matchKind === 'tag' ? 'selected' : ''}>Tag</option>
            <option value="status" ${layer.matchKind === 'status' ? 'selected' : ''}>Status</option>
            <option value="type" ${layer.matchKind === 'type' ? 'selected' : ''}>Card Type</option>
            <option value="default" ${layer.matchKind === 'default' ? 'selected' : ''}>Always (Default)</option>
          </select>
        </label>
        <label>Match Value <input type="text" data-l-field="matchValue" data-l-idx="${idx}" value="${esc(layer.matchValue)}" placeholder="e.g. school:fire" /></label>
        <label>PNG Asset ID <input type="text" data-l-field="assetId" data-l-idx="${idx}" value="${esc(layer.assetId)}" placeholder="click thumbnail →" /></label>
        <label>Mode
          <select data-l-field="mode" data-l-idx="${idx}">
            <option value="stack" ${layer.mode === 'stack' ? 'selected' : ''}>Stack on top</option>
            <option value="replace" ${layer.mode === 'replace' ? 'selected' : ''}>Replace slot</option>
          </select>
        </label>
        <label>Blend Mode
          <select data-l-field="blendMode" data-l-idx="${idx}">
            ${['normal', 'screen', 'multiply', 'overlay', 'color'].map((m) => `<option value="${m}" ${layer.blendMode === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </label>
        <label>Z-Index <input type="number" data-l-num="zIndex" data-l-idx="${idx}" value="${layer.zIndex ?? 1}" /></label>
        <label>X % / Scale % <input type="number" data-l-num="scale" data-l-idx="${idx}" min="10" max="150" value="${layer.scale ?? 80}" /></label>
        <label>Opacity (${layer.opacity ?? 100}%) <input type="range" data-l-num="opacity" data-l-idx="${idx}" min="0" max="100" value="${layer.opacity ?? 100}" /></label>
      </div>`;
    list.appendChild(el);
  });

  // Asset gallery
  const aq = document.getElementById('asset-search').value.trim().toLowerCase();
  const gal = document.getElementById('asset-gallery');
  gal.innerHTML = '';
  for (const a of assets.filter((x) => !aq || `${x.id} ${x.name}`.toLowerCase().includes(aq)).slice(0, 60)) {
    const t = document.createElement('div');
    t.className = 'asset-thumb';
    t.title = `${a.id} — ${a.name} (click to assign to top layer)`;
    t.innerHTML = `<img src="${esc(a.path)}" loading="lazy" alt="" /><div>${esc(a.id)}</div>`;
    t.addEventListener('click', () => {
      if (!state.artLayers.layers.length) return;
      pushHistory();
      state.artLayers.layers[0].assetId = a.id;
      renderArtTab();
      renderCardsGrid();
      renderInspector();
      saveDraft();
      toast(`Assigned ${a.id} to layer #1`);
    });
    gal.appendChild(t);
  }
}

// ---------------------------------------------------------------------------
// Live Combat Sandbox (Real Engine + A/B Slots)
// ---------------------------------------------------------------------------
function initSandboxEnemies() {
  const sel = document.getElementById('sandbox-enemy');
  sel.innerHTML = '';
  for (const e of registries.enemies.all()) {
    const o = document.createElement('option');
    o.value = e.id;
    o.textContent = `${e.name || e.id} (HP ${Array.isArray(e.hp) ? e.hp[0] : e.hp})`;
    sel.appendChild(o);
  }
  if (registries.enemies.has('wanderingSoldier')) sel.value = 'wanderingSoldier';
}

function startSandboxCombat() {
  const classId = document.getElementById('sandbox-class').value || 'reaver';
  const enemyId = document.getElementById('sandbox-enemy').value || 'wanderingSoldier';
  const activeCard = state.cards.find((c) => c.id === state.selectedCardId) || state.cards[0];
  if (activeCard) studioCardOverrides.set(activeCard.id, activeCard);

  const run = createRunState({ registries: studioRegistries, classId, seed: 42, profileMeta: UNLOCK_META });
  const combat = createRunCombat({ registries: studioRegistries, run, rng: createRng(42), enemyIds: [enemyId] });
  if (activeCard) {
    // Inject the edited/selected card straight into the front of the opening hand!
    combat.piles.hand.unshift({ instanceId: 'studio-test-card', cardId: activeCard.id, upgraded: false });
  }
  state.sandbox = {
    combat,
    classId,
    enemyId,
    appliedScoring: clone(state.scoring),
    customCardId: activeCard?.id || null,
    log: [`Combat started: ${classId} vs ${enemyId}. Injected "${activeCard?.name || 'none'}" into opening hand.`],
  };
  renderSandbox();
}

function renderSandbox() {
  const { combat, log, customCardId } = state.sandbox;
  if (!combat) return;
  const p = combat.player;
  const e = combat.enemies[0];
  document.getElementById('sandbox-turn-info').textContent = `Turn ${combat.turn} · Phase: ${combat.phase} · Config: ${state.abSlots.activeLabel}`;

  document.getElementById('sandbox-player-panel').innerHTML = `
    <h4>Player (${esc(state.sandbox.classId)})</h4>
    <div class="stat-line">
      <span>HP: <strong>${p.hp}/${p.maxHp}</strong></span>
      <span>Block: <strong>${p.block || 0}</strong></span>
      <span>SP: <strong>${p.stamina ?? p.energy ?? 0}</strong></span>
      <span>MP: <strong>${p.mana ?? 0}</strong></span>
    </div>
    <div class="studio-muted">Statuses: ${esc(Object.entries(p.statuses || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(', ') || 'None')}</div>
  `;

  document.getElementById('sandbox-enemy-panel').innerHTML = e ? `
    <h4>${esc(e.name || e.enemyId)} ${e.hp <= 0 ? '(DEFEATED)' : ''}</h4>
    <div class="stat-line">
      <span>HP: <strong>${e.hp}/${e.maxHp}</strong></span>
      <span>Block: <strong>${e.block || 0}</strong></span>
      <span>Poise: <strong>${e.poiseMeter?.current ?? 0}/${e.poiseMeter?.max ?? 0}</strong></span>
    </div>
    <div class="studio-muted">Statuses: ${esc(Object.entries(e.statuses || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(', ') || 'None')}</div>
  ` : '<div class="studio-muted">No enemies remaining.</div>';

  const handEl = document.getElementById('sandbox-hand');
  handEl.innerHTML = '';
  for (const inst of combat.piles.hand) {
    const def = studioRegistries.cards.get(inst.cardId);
    if (!def) continue;
    const wrap = document.createElement('div');
    wrap.className = 'sandbox-hand-card' + (inst.instanceId === 'studio-test-card' ? ' is-custom' : '');
    const stage = document.createElement('div');
    stage.className = 'studio-card-stage';
    renderCardWithLayers(def, stage);
    wrap.appendChild(stage);
    const foot = document.createElement('div');
    foot.className = 'studio-card-meta';
    foot.innerHTML = `<span>${inst.instanceId === 'studio-test-card' ? '★ Edited Card' : esc(def.name)}</span><span class="cp-chip">Play</span>`;
    wrap.appendChild(foot);
    wrap.addEventListener('click', () => {
      try {
        const targetId = combat.enemies.find((x) => x.hp > 0)?.id || null;
        const res = dispatch(combat, { type: 'playCard', cardInstanceId: inst.instanceId, targetId });
        if (res && res.error) state.sandbox.log.unshift(`Cannot play ${def.name}: ${res.error}`);
        else state.sandbox.log.unshift(`Played ${def.name}${targetId ? ` → ${e?.name || targetId}` : ''}`);
      } catch (err) {
        state.sandbox.log.unshift(`Play error: ${err.message}`);
      }
      renderSandbox();
    });
    handEl.appendChild(wrap);
  }

  document.getElementById('sandbox-log').innerHTML = log.slice(0, 20).map((line) => `<div>${esc(line)}</div>`).join('');
}

// ---------------------------------------------------------------------------
// Repo Sync, Export Diff Modal, Revert, Download/Upload
// ---------------------------------------------------------------------------
function buildScoringDiff() {
  const lines = [];
  const walk = (a, b, prefix = '') => {
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const k of keys) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (a?.[k] && b?.[k] && typeof a[k] === 'object' && typeof b[k] === 'object' && !Array.isArray(a[k])) {
        walk(a[k], b[k], p);
      } else if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) {
        lines.push(`${p}: ${JSON.stringify(a?.[k])}  →  ${JSON.stringify(b?.[k])}`);
      }
    }
  };
  walk(state.repoScoring, state.scoring);
  return lines;
}

async function loadFromRepo(customPath = state.repoPath) {
  try {
    const r = await fetch(`/__studio/config?scoringPath=${encodeURIComponent(customPath)}`);
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'Failed to read repo config.');
    if (data.scoring) {
      state.repoScoring = clone(data.scoring);
      state.scoring = clone(data.scoring);
    }
    if (data.artLayers?.layers) {
      state.artLayers = clone(data.artLayers);
      state.repoArtLayers = clone(data.artLayers);
    }
    state.repoPath = data.scoringPath;
    localStorage.setItem(PATH_STORAGE_KEY, state.repoPath);
    document.getElementById('repo-path-input').value = state.repoPath;
    document.getElementById('path-status').textContent = data.scoringExists ? `Loaded: ${data.scoringPath}` : `New path (will create): ${data.scoringPath}`;
    recomputeBaselineRanks();
    syncAllViews();
    toast(`Loaded ${data.scoringPath}`);
  } catch (err) {
    document.getElementById('path-status').textContent = `Offline / fallback to shipped scoring (${err.message})`;
  }
}

function discardSummaryHtml() {
  const weightChanges = weightChangeCount();
  const cardsEdited = editedCards().length;
  const lines = [
    `${weightChanges} weight change(s)`,
    `${cardsEdited} edited or new card(s)`,
    artLayersChanged() ? 'Art layer changes' : 'No art layer changes',
  ];
  return `<ul>${lines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>`;
}

async function revertToRepo() {
  clearTimeout(draftTimer);
  try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* storage unavailable */ }
  const keepSelection = state.selectedCardId;
  studioCardOverrides.clear();
  state.cards = buildCardList();
  state.selectedCardId = state.cards.some((c) => c.id === keepSelection) ? keepSelection : state.cards[0]?.id || null;
  state.undoStack = [];
  state.redoStack = [];
  updateUndoButtons();
  await loadFromRepo(state.repoPath);
  state.artLayers = clone(state.repoArtLayers);
  syncAllViews();
  refreshDirtyStatus();
  toast('Reverted to the repo version');
}

function recomputeBaselineRanks() {
  state.baselineRanks = {};
  for (const c of state.cards) state.baselineRanks[c.id] = scoreCardEntry(c, state.repoScoring).rank;
}

function populateRankFilter() {
  const sel = document.getElementById('filter-rank');
  const prev = sel.value;
  sel.innerHTML = '<option value="all">All Ranks</option>';
  for (let r = 0; r <= (state.scoring.rank?.maxRank ?? 10); r++) {
    const o = document.createElement('option');
    o.value = String(r);
    o.textContent = RankName(r);
    sel.appendChild(o);
  }
  sel.value = prev || 'all';
}

function syncAllViews() {
  populateRankFilter();
  populateAddFeatureDropdown();
  renderCardsGrid();
  renderInspector();
  renderWeights();
  renderArtTab();
}

// ---------------------------------------------------------------------------
// Wire Events & Boot
// ---------------------------------------------------------------------------
function wireEvents() {
  // Tabs
  document.querySelectorAll('.studio-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.studio-tab').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-selected', String(b === btn)); });
      document.querySelectorAll('.studio-panel').forEach((p) => p.classList.toggle('is-active', p.id === `tab-${tab}`));
      if (tab === 'sandbox' && !state.sandbox.combat) startSandboxCombat();
      if (tab === 'art') renderArtTab();
    });
  });

  // Filters & view toggle
  ['card-search', 'filter-type', 'filter-class', 'filter-rank', 'filter-shift'].forEach((id) => {
    document.getElementById(id).addEventListener('input', renderCardsGrid);
    document.getElementById(id).addEventListener('change', renderCardsGrid);
  });
  document.getElementById('view-grid').addEventListener('click', () => { state.viewMode = 'grid'; document.getElementById('view-grid').classList.add('is-active'); document.getElementById('view-single').classList.remove('is-active'); renderCardsGrid(); });
  document.getElementById('view-single').addEventListener('click', () => { state.viewMode = 'single'; document.getElementById('view-single').classList.add('is-active'); document.getElementById('view-grid').classList.remove('is-active'); renderCardsGrid(); });

  // New card
  document.getElementById('btn-new-card').addEventListener('click', () => {
    pushHistory();
    const id = `custom.card_${Date.now().toString(36)}`;
    const card = { id, name: 'New Custom Card', class: 'colorless', rarity: 'uncommon', type: 'attack', staminaCost: 1, manaCost: 0, effects: [{ op: 'damage', target: 'enemy', amount: 8 }], keywords: [], tags: ['camp:physical', 'classification.attack', 'targeting:single'], textTemplate: 'Deal {damage} damage.', _custom: true };
    state.cards.unshift(card);
    state.selectedCardId = id;
    renderCardsGrid();
    renderInspector();
    saveDraft();
    toast('Created custom card');
  });

  // Card inspector edits
  // Typing and spinner holds record one undo step per editing burst, not one per keystroke or tick.
  const nameBurst = createEditBurst();
  const nameInput = document.getElementById('edit-name');
  nameInput.addEventListener('focus', () => nameBurst.end());
  nameInput.addEventListener('input', (e) => {
    nameBurst.begin();
    mutateSelectedCard((d) => { d.name = e.target.value; }, { recordHistory: false });
  });
  document.getElementById('edit-type').addEventListener('change', (e) => mutateSelectedCard((d) => { d.type = e.target.value; }));
  document.getElementById('edit-class').addEventListener('change', (e) => mutateSelectedCard((d) => { d.class = e.target.value; }));
  document.getElementById('edit-rarity').addEventListener('change', (e) => mutateSelectedCard((d) => { d.rarity = e.target.value; }));
  document.getElementById('edit-camp').addEventListener('change', (e) => mutateSelectedCard((d) => {
    d.tags = (d.tags || []).filter((t) => !t.startsWith('camp:'));
    d.tags.push(`camp:${e.target.value}`);
  }));
  document.getElementById('edit-target').addEventListener('change', (e) => mutateSelectedCard((d) => setCardTarget(d, e.target.value)));
  // Cost inputs rescore live on every keystroke or spinner tick; the tile and preview refresh on change.
  const costBurst = createEditBurst();
  const nonNegative = (input) => Math.max(0, Number(input.value) || 0);
  const costSetters = {
    'edit-sp': (d, n) => { d.staminaCost = n; d.cost = n; },
    'edit-mp': (d, n) => { d.manaCost = n; },
    // Edits the HP cost effect in place so the feature rows' effect indexes stay valid while typing.
    'edit-loseHp': (d, n) => {
      d.effects ||= [];
      const hpEffect = d.effects.find((x) => x.op === 'loseHp');
      if (hpEffect) hpEffect.amount = n;
      else if (n > 0) d.effects.push({ op: 'loseHp', target: 'self', amount: n });
    },
  };
  for (const [inputId, setCost] of Object.entries(costSetters)) {
    const input = document.getElementById(inputId);
    input.addEventListener('focus', () => costBurst.end());
    input.addEventListener('input', () => applyLiveCardEdit(costBurst, (d) => setCost(d, nonNegative(input))));
    input.addEventListener('change', () => {
      applyLiveCardEdit(costBurst, (d) => setCost(d, nonNegative(input)));
      commitLiveCardEdit();
    });
  }
  // A zero HP cost removes the effect; that reorders effects, so rebuild the inspector once editing ends.
  document.getElementById('edit-loseHp').addEventListener('blur', () => {
    const def = selectedCardDef();
    if (def?.effects?.some((x) => x.op === 'loseHp' && !x.amount)) {
      mutateSelectedCard((d) => { d.effects = d.effects.filter((x) => !(x.op === 'loseHp' && !x.amount)); }, { recordHistory: false });
    }
  });

  // Add / edit / remove active features
  document.getElementById('btn-add-feature').addEventListener('click', () => {
    const val = document.getElementById('add-feature-select').value;
    if (!val) return;
    const [kind, key] = [val.slice(0, val.indexOf(':')), val.slice(val.indexOf(':') + 1)];
    mutateSelectedCard((d) => {
      d.effects ||= [];
      d.keywords ||= [];
      d.tags ||= [];
      if (kind === 'effect') d.effects.push({ op: key, target: getCardTarget(d), amount: key === 'damage' ? 6 : 2 });
      else if (kind === 'status') d.effects.push({ op: 'applyStatus', status: key, stacks: 2, target: state.scoring.statuses?.[key]?.target || 'enemy' });
      else if (kind === 'kw' && !d.keywords.includes(key)) d.keywords.push(key);
      else if (kind === 'tag' && !d.tags.includes(key)) d.tags.push(key);
    });
    document.getElementById('add-feature-select').value = '';
  });

  document.getElementById('active-features-list').addEventListener('click', (e) => {
    const rmEff = e.target.dataset.rmEff;
    const rmKw = e.target.dataset.rmKw;
    const rmTag = e.target.dataset.rmTag;
    if (rmEff !== undefined) mutateSelectedCard((d) => { d.effects.splice(Number(rmEff), 1); });
    else if (rmKw !== undefined) mutateSelectedCard((d) => { d.keywords.splice(Number(rmKw), 1); });
    else if (rmTag !== undefined) mutateSelectedCard((d) => { d.tags = d.tags.filter((t) => t !== rmTag); });
  });
  // Amount and stack inputs rescore live without rebuilding the list, so focus and spinner holds survive.
  const featureBurst = createEditBurst();
  const featureList = document.getElementById('active-features-list');
  const applyFeatureNumber = (target) => {
    if (target.dataset.effAmt !== undefined) {
      applyLiveCardEdit(featureBurst, (d) => { d.effects[Number(target.dataset.effAmt)].amount = Number(target.value) || 0; });
      return true;
    }
    if (target.dataset.effStacks !== undefined) {
      applyLiveCardEdit(featureBurst, (d) => { d.effects[Number(target.dataset.effStacks)].stacks = Number(target.value) || 1; });
      return true;
    }
    return false;
  };
  featureList.addEventListener('focusin', () => featureBurst.end());
  featureList.addEventListener('input', (e) => applyFeatureNumber(e.target));
  featureList.addEventListener('change', (e) => {
    if (applyFeatureNumber(e.target)) {
      commitLiveCardEdit();
      return;
    }
    if (e.target.dataset.effTarget !== undefined) mutateSelectedCard((d) => { d.effects[Number(e.target.dataset.effTarget)].target = e.target.value; });
  });

  // Scoring override toggle
  const applyOv = () => mutateSelectedCard((d) => {
    const on = document.getElementById('edit-override-enabled').checked;
    if (!on) {
      delete d.scoringOverride;
      if (state.scoring.overrides) delete state.scoring.overrides[d.id];
      return;
    }
    const rVal = document.getElementById('edit-override-rank').value;
    const cVal = document.getElementById('edit-override-cp').value;
    const ov = {};
    if (rVal !== '') ov.rank = Math.round(Number(rVal));
    if (cVal !== '') ov.cp = Number(cVal);
    d.scoringOverride = ov;
    state.scoring.overrides ||= {};
    state.scoring.overrides[d.id] = ov;
  });
  document.getElementById('edit-override-enabled').addEventListener('change', applyOv);
  document.getElementById('edit-override-rank').addEventListener('change', applyOv);
  document.getElementById('edit-override-cp').addEventListener('change', applyOv);

  // Send to sandbox
  document.getElementById('btn-send-sandbox').addEventListener('click', () => {
    document.querySelector('.studio-tab[data-tab="sandbox"]').click();
    startSandboxCombat();
  });

  // Weights search
  document.getElementById('weights-search').addEventListener('input', renderWeights);
  document.getElementById('weights-group-filter').addEventListener('change', renderWeights);

  // Art & Layers events
  document.getElementById('btn-add-layer').addEventListener('click', () => {
    pushHistory();
    state.artLayers.layers.push({ id: `layer-${Date.now().toString(36)}`, name: 'New Layer', matchKind: 'default', matchValue: '', mode: 'stack', assetId: 'Z.effect.5', zIndex: state.artLayers.layers.length + 1, x: 50, y: 50, scale: 80, opacity: 60, blendMode: 'screen', enabled: true });
    renderArtTab();
    saveDraft();
  });
  document.getElementById('art-preview-card-select').addEventListener('change', (e) => {
    state.selectedCardId = e.target.value;
    renderArtTab();
  });
  document.getElementById('asset-search').addEventListener('input', renderArtTab);
  document.getElementById('art-layers-list').addEventListener('click', (e) => {
    const idx = Number(e.target.dataset.lUp ?? e.target.dataset.lDown ?? e.target.dataset.lDel);
    if (Number.isNaN(idx)) return;
    pushHistory();
    if (e.target.dataset.lUp !== undefined && idx > 0) [state.artLayers.layers[idx - 1], state.artLayers.layers[idx]] = [state.artLayers.layers[idx], state.artLayers.layers[idx - 1]];
    if (e.target.dataset.lDown !== undefined && idx < state.artLayers.layers.length - 1) [state.artLayers.layers[idx + 1], state.artLayers.layers[idx]] = [state.artLayers.layers[idx], state.artLayers.layers[idx + 1]];
    if (e.target.dataset.lDel !== undefined) state.artLayers.layers.splice(idx, 1);
    renderArtTab();
    renderCardsGrid();
    renderInspector();
    saveDraft();
  });
  document.getElementById('art-layers-list').addEventListener('input', (e) => {
    const idx = Number(e.target.dataset.lIdx ?? e.target.dataset.lEnabled);
    if (Number.isNaN(idx)) return;
    const layer = state.artLayers.layers[idx];
    if (!layer) return;
    if (e.target.dataset.lEnabled !== undefined) layer.enabled = e.target.checked;
    else if (e.target.dataset.lField) layer[e.target.dataset.lField] = e.target.value;
    else if (e.target.dataset.lNum) layer[e.target.dataset.lNum] = Number(e.target.value) || 0;
    saveDraft();
    // Update live preview in place without rebuilding #art-layers-list (preserves focus & slider drag)
    const cardSel = document.getElementById('art-preview-card-select');
    const previewDef = state.cards.find((c) => c.id === cardSel.value) || state.cards[0];
    if (previewDef) renderCardWithLayers(previewDef, document.getElementById('art-live-preview'));
    renderInspector();
    if (state.selectedCardId) updateCardTileInPlace(state.selectedCardId);
  });
  document.getElementById('btn-save-art').addEventListener('click', async () => {
    try {
      const r = await fetch('/__studio/art-layers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artLayers: state.artLayers }) });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error);
      toast(`Saved ${data.layerCount} art layer(s) to ${data.path}`);
    } catch (err) { toast(`Save failed: ${err.message}`); }
  });
  document.getElementById('btn-download-art').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.artLayers, null, 2) + '\n'], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'cardArtLayers.json' });
    a.click();
  });

  // Sandbox + A/B Testing
  const saveAB = (slot) => {
    state.abSlots[slot] = clone(state.scoring);
    localStorage.setItem(AB_STORAGE_KEY, JSON.stringify({ A: state.abSlots.A, B: state.abSlots.B }));
    toast(`Saved current weights → Slot ${slot}`);
  };
  const loadAB = (slot) => {
    if (!state.abSlots[slot]) { toast(`Slot ${slot} is empty`); return; }
    pushHistory();
    state.scoring = clone(state.abSlots[slot]);
    state.abSlots.activeLabel = `Slot ${slot}`;
    document.getElementById('ab-active-label').textContent = `Slot ${slot}`;
    syncAllViews();
    saveDraft();
    toast(`Loaded Slot ${slot}`);
  };
  document.getElementById('btn-slot-a-save').addEventListener('click', () => saveAB('A'));
  document.getElementById('btn-slot-b-save').addEventListener('click', () => saveAB('B'));
  document.getElementById('btn-slot-a-load').addEventListener('click', () => loadAB('A'));
  document.getElementById('btn-slot-b-load').addEventListener('click', () => loadAB('B'));
  document.getElementById('btn-apply-sandbox').addEventListener('click', () => { startSandboxCombat(); toast('Applied current config to Combat Sandbox'); });
  document.getElementById('btn-sandbox-reset').addEventListener('click', startSandboxCombat);
  document.getElementById('sandbox-class').addEventListener('change', startSandboxCombat);
  document.getElementById('sandbox-enemy').addEventListener('change', startSandboxCombat);
  document.getElementById('btn-sandbox-endturn').addEventListener('click', () => {
    if (!state.sandbox.combat) return;
    try {
      dispatch(state.sandbox.combat, { type: 'endTurn' });
      state.sandbox.log.unshift(`Ended turn → Turn ${state.sandbox.combat.turn}`);
    } catch (err) {
      state.sandbox.log.unshift(`End turn error: ${err.message}`);
    }
    renderSandbox();
  });

  // Topbar Undo / Redo / Revert / Export / Download / Upload / Path
  document.getElementById('btn-undo').addEventListener('click', () => {
    if (!state.undoStack.length) return;
    state.redoStack.push(snapshotState());
    restoreSnapshot(state.undoStack.pop());
    updateUndoButtons();
  });
  document.getElementById('btn-redo').addEventListener('click', () => {
    if (!state.redoStack.length) return;
    state.undoStack.push(snapshotState());
    restoreSnapshot(state.redoStack.pop());
    updateUndoButtons();
  });
  document.getElementById('toggle-autosave').addEventListener('change', (e) => {
    state.autosave = e.target.checked;
    writeDraftNow();
  });
  document.getElementById('btn-load-path').addEventListener('click', () => loadFromRepo(document.getElementById('repo-path-input').value));

  // Revert asks first, in the page, and says what will be thrown away.
  document.getElementById('btn-revert').addEventListener('click', () => {
    document.getElementById('revert-modal-summary').innerHTML = discardSummaryHtml();
    document.getElementById('revert-modal').showModal();
  });
  document.getElementById('btn-confirm-revert').addEventListener('click', revertToRepo);

  document.getElementById('btn-export-repo').addEventListener('click', () => {
    const errors = ValidateScoringConfig(state.scoring);
    if (errors.length) { toast(`Validation failed: ${errors[0]}`); return; }
    const path = document.getElementById('repo-path-input').value.trim() || 'content/source/scoring.json';
    const diff = buildScoringDiff();
    document.getElementById('export-modal-path').textContent = `Target: ${path} (${diff.length} change(s))`;
    document.getElementById('export-modal-diff').textContent = diff.length ? diff.slice(0, 80).join('\n') : 'No weight differences from the loaded repo file.';
    document.getElementById('export-modal').showModal();
  });

  document.getElementById('btn-confirm-export').addEventListener('click', async () => {
    const path = document.getElementById('repo-path-input').value.trim() || 'content/source/scoring.json';
    try {
      const r = await fetch('/__studio/scoring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, scoring: state.scoring, rebuild: true }) });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error);
      state.repoScoring = clone(state.scoring);
      recomputeBaselineRanks();
      syncAllViews();
      writeDraftNow();
      toast(`Exported to ${data.path} and rebuilt tables (${data.rebuilt.length} script(s))`);
    } catch (err) {
      toast(`Export failed: ${err.message}`);
    }
  });

  document.getElementById('btn-download-json').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.scoring, null, 2) + '\n'], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'scoring.json' });
    a.click();
    toast('Downloaded scoring.json');
  });

  document.getElementById('input-upload-json').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const errors = ValidateScoringConfig(parsed);
      if (errors.length) throw new Error(errors.join(' '));
      pushHistory();
      state.scoring = parsed;
      syncAllViews();
      saveDraft();
      toast(`Loaded ${file.name}`);
    } catch (err) {
      toast(`Invalid JSON: ${err.message}`);
    }
    e.target.value = '';
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
// The studio works on the core card pool only (owner, 2026-11-22).
function buildCardList() {
  return registries.cards.all()
    .filter((c) => c && c.id && c.name && !c.ruleTemplate && c.id.startsWith('core.'))
    .map((c) => clone(c))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function boot() {
  state.cards = buildCardList();
  state.selectedCardId = state.cards[0]?.id || null;
  state.repoArtLayers = clone(state.artLayers);

  try {
    const ab = JSON.parse(localStorage.getItem(AB_STORAGE_KEY) || 'null');
    if (ab) { state.abSlots.A = ab.A || null; state.abSlots.B = ab.B || null; }
  } catch { /* ignore */ }

  initSandboxEnemies();
  wireEvents();
  await loadFromRepo(state.repoPath);

  // Restore local draft temp copy if present
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || 'null');
    if (draft?.scoring && ValidateScoringConfig(draft.scoring).length === 0) {
      state.scoring = draft.scoring;
      if (draft.artLayers?.layers) state.artLayers = draft.artLayers;
      if (Array.isArray(draft.customCards)) {
        for (const cc of draft.customCards) {
          const i = state.cards.findIndex((c) => c.id === cc.id);
          if (i >= 0) state.cards[i] = cc;
          else state.cards.unshift(cc);
        }
      }
      syncAllViews();
      refreshDirtyStatus();
      if (isDirty()) document.getElementById('draft-status').textContent = 'Restored local draft temp copy';
      return;
    }
  } catch { /* ignore */ }
  refreshDirtyStatus();
}

boot();
