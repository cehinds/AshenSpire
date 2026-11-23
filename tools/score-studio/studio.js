// tools/score-studio/studio.js — Interactive Score Studio for AshenSpire.
// Uses the real in-game scoring engine, procedural card renderer, reviewed cutout assets, and combat engine.

import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';
import * as Profile from '../../src/model/gameProfile.js';
import { createRunState } from '../../src/model/state.js';
import { createRng } from '../../src/engine/rng.js';
import { createRunCombat } from '../../src/engine/runCombat.js';
import { dispatch, previewCard, cardPlayCosts } from '../../src/engine/combat.js';
import { renderCard, fitCardFace } from '../../src/ui/components/card.js';
import { cardShapeCssProperties } from '../../src/ui/models/CardSizeModel.js';
import { reviewedCardArtCatalog } from '../../src/content/reviewedCardArt.generated.js';
import { scoring as shippedScoring } from '../../src/content/generated/scoring.js';
import { BaseFace, ScoreCard, CombatPower, RankOf, RankName, CardName, ApplyScoringOverride } from '../../src/model/combatPower.js';
import { ValidateScoringConfig } from '../../src/model/activeScoring.js';
import { staticCardTokens } from '../../src/model/playingCard.js';
import { tokenRe } from '../../src/model/validate.js';

const DRAFT_STORAGE_KEY = 'ashenspire:scoreStudioDraft:v1';
const AB_STORAGE_KEY = 'ashenspire:scoreStudioAB:v1';
const PATH_STORAGE_KEY = 'ashenspire:scoreStudioPath:v1';
const DRAFT_SAVE_DELAY_MS = 300;
const TEXT_EDIT_BURST_MS = 1000;
const UNDO_DEPTH = 40;
const INSPECTOR_WIDTH_KEY = 'ashenspire:studioInspectorW';
const INSPECTOR_WIDTH_MIN = 340;
const INSPECTOR_WIDTH_MAX = 780;
// On GitHub Pages there is no local server: the studio runs on shipped scoring and exports by Download JSON.
const isLocalServer = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

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
const REF_CLASSES = ['reaver', 'starseer', 'rogue', 'herald'];
const refContexts = new Map();
// One reference run and combat per class: scoring measures each card's final in-play values here, and card
// faces are drawn under the same run, so a card reads as its class would see it.
function refContextFor(def) {
  const isSpell = (def.tags || []).includes('camp:spell') || (def.damageSchool && def.damageSchool !== 'physical');
  const cls = REF_CLASSES.includes(def.class) ? def.class : (isSpell ? 'starseer' : 'reaver');
  if (!refContexts.has(cls)) {
    const run = createRunState({ registries: studioRegistries, classId: cls, seed: 31, profileMeta: UNLOCK_META });
    run.relics = [];
    const combat = createRunCombat({ registries: studioRegistries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
    dispatch(combat, { type: 'setReactions', enabled: false });
    const enemy = combat.enemies[0];
    enemy.actorIntentRevealed = true;
    enemy.weaknesses = [];
    enemy.hp = enemy.maxHp = 5000;
    enemy.ratings = { ...enemy.ratings, poise: 1000 };
    enemy.persistentPoise = { value: 1000, max: 1000 };
    Object.assign(combat.player, { stamina: 10, maxStamina: 10, mana: 10, maxMana: 10, energy: 10, energyMax: 10 });
    refContexts.set(cls, { cls, run, combat, enemy });
  }
  return refContexts.get(cls);
}
const CARD_SHAPE_PROPS = cardShapeCssProperties();

const clone = (v) => structuredClone(v);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeNum = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
const ALLOWED_BLEND_MODES = new Set(['normal', 'screen', 'multiply', 'overlay', 'color']);
const offenseAmount = (hit) => {
  const rows = (hit?.sources || []).filter((s) => s.stage === 'offense' && typeof s.effective === 'number' && Number.isFinite(s.effective));
  return rows.length ? rows[rows.length - 1].effective : (hit?.incoming ?? 0);
};
function safeCardName(face, scoringRef) {
  const withNaming = scoringRef?.naming ? scoringRef : { ...scoringRef, naming: shippedScoring.naming };
  return CardName(face, 0, withNaming);
}

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
  selectedLayerIdx: 0,
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
const KIND_BY_TYPE = {
  attack: 'classification.attack',
  skill: 'classification.skill',
  power: 'classification.power',
  guard: 'classification.guard',
  strike: 'classification.strike',
  curse: 'classification.curse',
  status: 'classification.statusCard',
};

function normalizeStudioCard(def) {
  if (!def || Object.isFrozen(def)) return def;
  const kind = KIND_BY_TYPE[def.type] || 'classification.attack';
  def.tags = Array.isArray(def.tags) ? def.tags.filter((t) => !t.startsWith('classification.')) : [];
  def.tags.push(kind);
  def.kindIds = [kind];
  def.icon = def.icon || (def.type === 'attack' || def.type === 'strike' ? 'attack' : 'skill');
  const isSpell = def.tags.includes('camp:spell');
  def.damageSchool = isSpell ? 'magic' : 'physical';
  def.staminaCost = Math.max(0, Number(def.staminaCost ?? def.cost ?? 0) || 0);
  def.cost = def.staminaCost;
  def.manaCost = Math.max(0, Number(def.manaCost ?? 0) || 0);
  def.effects = Array.isArray(def.effects) ? def.effects : [];
  def.keywords = Array.isArray(def.keywords) ? def.keywords : [];
  return def;
}

const LIVE_ID_PREFIX = '__studio_live_';

// An edited or custom card is registered under a live id the game profile does not know, so previewCard,
// dispatch and renderCard all read the studio's copy instead of the shipped profile card.
function liveCardIdFor(def) {
  normalizeStudioCard(def);
  if (!def._edited && !def._custom) {
    studioCardOverrides.set(def.id, def);
    return def.id;
  }
  const liveId = `${LIVE_ID_PREFIX}${def.id}`;
  const liveDef = { ...clone(def), id: liveId };
  studioCardOverrides.set(def.id, def);
  studioCardOverrides.set(liveId, liveDef);
  return liveId;
}

// The card's final in-play numbers (cost, damage, block, poise...) measured by previewCard in its class's
// reference combat, so the score matches what the card does in a fight.
function measureFinalValues(def) {
  const liveId = liveCardIdFor(def);
  const isSpell = (def.tags || []).includes('camp:spell') || (def.damageSchool && def.damageSchool !== 'physical');
  const { combat, enemy } = refContextFor(def);
  const probeId = '__studio_probe';
  combat.piles.hand.push({ instanceId: probeId, cardId: liveId, upgraded: false });
  const measured = {
    sp: def.staminaCost ?? def.cost ?? 0,
    mp: def.manaCost ?? 0,
    dmg: 0,
    hits: 1,
    blk: 0,
    poise: 0,
    counter: (def.tags || []).includes('maneuver:counter') ? 1 : 0,
    reflect: 0,
    evade: 0,
    authoredDmg: 0,
    authoredBlk: 0,
    usedPreview: false,
  };
  for (const e of def.effects || []) {
    const amt = typeof e.amount === 'number' ? e.amount : 0;
    if (e.op === 'damage') measured.authoredDmg += amt * (e.hits || 1);
    else if (e.op === 'block' || e.op === 'ward') measured.authoredBlk += amt;
  }
  try {
    const prev = previewCard(combat, probeId, enemy.id);
    if (prev?.costs) {
      if (Number.isFinite(prev.costs.stamina)) measured.sp = prev.costs.stamina;
      if (Number.isFinite(prev.costs.mana)) measured.mp = prev.costs.mana;
    }
    if (prev && Array.isArray(prev.values) && prev.values.length) {
      measured.usedPreview = true;
      for (const v of prev.values) {
        if (v.op === 'damage') {
          const r = v.damageReceipt?.hits || [];
          const perHit = r.length ? r.map(offenseAmount) : (v.hitDamages || []);
          const hits = Math.max(1, perHit.length || v.hits || 1);
          measured.hits = Math.max(measured.hits, hits);
          measured.dmg += perHit.length
            ? perHit.reduce((n, x) => n + x, 0)
            : (Number.isFinite(v.totalDamage) ? v.totalDamage : ((v.faceValue ?? v.value ?? 0) * hits));
          measured.poise += Object.values(v.perTargetPoise || {}).reduce((n, x) => n + (Number.isFinite(x?.removed) ? x.removed : 0), 0);
        } else if (v.op === 'block' || v.op === 'ward') {
          measured.blk += safeNum(v.value, 0);
        } else if (v.op === 'poiseDamage') {
          const pRemoved = Object.values(v.perTargetPoise || {}).reduce((n, x) => n + (Number.isFinite(x?.removed) ? x.removed : 0), 0);
          measured.poise += (isSpell && pRemoved > 0) ? pRemoved : safeNum(v.value, 0);
        } else if (v.op === 'applyStatus' && v.status === 'evade') {
          measured.evade += safeNum(v.value, 0);
        } else if (v.op === 'applyReflect') {
          measured.reflect += safeNum(v.value, 0);
        }
      }
    }
  } catch { /* fallback below */ } finally {
    const i = combat.piles.hand.findIndex((c) => c.instanceId === probeId);
    if (i >= 0) combat.piles.hand.splice(i, 1);
  }
  if (!measured.usedPreview) {
    for (const e of def.effects || []) {
      const amt = typeof e.amount === 'number' ? e.amount : 1;
      if (e.op === 'damage') { measured.dmg += amt * (e.hits || 1); measured.hits = Math.max(measured.hits, e.hits || 1); }
      else if (e.op === 'block' || e.op === 'ward') measured.blk += amt;
      else if (e.op === 'poiseDamage') measured.poise += amt;
      else if (e.op === 'applyReflect') measured.reflect += amt;
    }
  }
  return measured;
}

function cardDefToFace(def, scoringRef) {
  const f = BaseFace();
  const tags = Array.isArray(def.tags) ? [...def.tags] : [];
  const m = measureFinalValues(def);
  f.name = def.name || def.id;
  f.cls = def.class || 'colorless';
  f.rarity = def.rarity || 'common';
  f.type = def.type || 'attack';
  f.camp = tags.includes('camp:spell') || (def.damageSchool && def.damageSchool !== 'physical') ? 'spell' : 'physical';
  f.sp = m.sp;
  f.mp = m.mp;
  f.dmg = m.dmg;
  f.hits = m.hits;
  f.blk = m.blk;
  f.poise = m.poise;
  f.counter = m.counter;
  f.reflect = m.reflect;
  f.kw = Array.isArray(def.keywords) ? [...def.keywords] : [];
  f.tags = tags;
  f._meta = m;
  if (m.evade > 0) f.statuses.push(['evade', m.evade, 'self']);
  const statusIds = new Set(Object.keys(scoringRef.statuses || {}));
  for (const e of def.effects || []) {
    const amt = typeof e.amount === 'number' ? e.amount : 1;
    if (e.op === 'applyStatus' && statusIds.has(e.status) && typeof e.stacks === 'number' && Number.isFinite(e.stacks)) {
      if (e.status === 'evade' && m.evade > 0) continue;
      f.statuses.push([e.status, e.stacks, e.target === 'self' ? 'self' : 'enemy']);
    } else if (e.op === 'restorePoise') f.blk += amt;
    else if (e.op === 'draw') f.draw += amt;
    else if (e.op === 'heal') f.heal += amt;
    else if (e.op === 'loseHp') f.loseHp += amt;
    else if (e.op === 'discard') f.discard += amt;
    else if (e.op === 'restoreStamina' || e.op === 'gainEnergy') f.restoreSp += amt;
    else if (e.op === 'restoreMana') f.restoreMp += amt;
    else if (e.op === 'removeStatus' && e.target === 'self') f.cleanse += 1;
    else if (e.op === 'applyReflect' && !m.usedPreview && m.reflect === 0) f.reflect += amt;
    else if (e.op === 'moveEngagement') f.move += 1;
    else if (e.op === 'pullEnemy' || e.op === 'swapRows') f.pull += 1;
  }
  if (def.ramp && !f.tags.includes('ramp.honed')) f.tags.push('ramp.honed');
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
  clearTimeout(draftTimer);
  draftPending = false;
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
let draftPending = false;
function saveDraft() {
  clearTimeout(draftTimer);
  draftPending = true;
  draftTimer = setTimeout(writeDraftNow, DRAFT_SAVE_DELAY_MS);
}

// Writes a pending draft at once, so closing or hiding the tab inside the debounce loses nothing.
function flushDraft() {
  if (draftPending) writeDraftNow();
}

function restoreSnapshot(snapStr) {
  const snap = JSON.parse(snapStr);
  state.scoring = snap.scoring;
  state.cards = snap.cards;
  state.artLayers = snap.artLayers;
  studioCardOverrides.clear();
  if (!state.cards.some((c) => c.id === state.selectedCardId)) state.selectedCardId = state.cards[0]?.id || null;
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
  const profile = refContextFor(def).run.gameProfile;
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

// ---------------------------------------------------------------------------
// Card text: tokens in textTemplate that no longer resolve
// ---------------------------------------------------------------------------
// The game fills {tokens} in a card's text from its effects (staticCardTokens). A token whose effect was
// removed has nothing to fill it, so the face would print the raw {token}. The same function decides here.
function staleTextTokens(def) {
  const template = def.textTemplate || '';
  if (!template.includes('{')) return [];
  let tokens;
  try {
    tokens = staticCardTokens(projectEditedCard(def), studioRegistries, refContextFor(def).run);
  } catch {
    return [];
  }
  const mentioned = [...new Set([...template.matchAll(tokenRe())].map((match) => match[1]))];
  return mentioned.filter((token) => tokens[token] === undefined || tokens[token] === null);
}

function tokenLabel(token) {
  const root = token.split('.')[0];
  const status = registries.statuses?.has?.(root) ? registries.statuses.get(root) : null;
  return status?.name || capitalise(root);
}

// Only edited cards can have gone stale; shipped cards are checked by the content build.
function hasStaleText(def) {
  return Boolean(def._edited || def._custom) && staleTextTokens(def).length > 0;
}

const STALE_TEXT_CHIP = '<span class="text-warn-chip" title="Card text has a {token} with no matching effect">⚠ text</span>';

function renderTextWarnings(def) {
  const warnings = staleTextTokens(def).map((token) => `Card text mentions {${token}}, but the card has no ${tokenLabel(token)} effect.`);
  document.getElementById('text-warnings').innerHTML = warnings.map((line) => `<div>${esc(line)}</div>`).join('');
}

// Plain clauses + Add Feature appends when the card text does not mention the new token yet.
function clauseForNewFeature(kind, key) {
  if (kind === 'status') return { token: key, clause: `Apply {${key}} ${tokenLabel(key)}.` };
  if (kind === 'effect' && key === 'damage') return { token: 'damage', clause: 'Deal {damage} damage.' };
  if (kind === 'effect' && key === 'block') return { token: 'block', clause: 'Gain {block} Block.' };
  if (kind === 'effect' && key === 'draw') return { token: 'draw', clause: 'Draw {draw}.' };
  return null;
}

function appendClauseForFeature(def, kind, key) {
  const addition = clauseForNewFeature(kind, key);
  if (!addition) return;
  const template = def.textTemplate || '';
  if (template.includes(`{${addition.token}}`)) return;
  def.textTemplate = `${template.trim()} ${addition.clause}`.trim();
}

// One card face path for the gallery, inspector, Art preview and sandbox hand: the card under its live id
// (so edits reach the face and the engine), projected the way the game projects profile cards, drawn under
// its class's reference run, then fitted.
function renderCardWithLayers(def, container) {
  container.innerHTML = '';
  const liveId = liveCardIdFor(def);
  try {
    const { run } = refContextFor(def);
    const liveDef = studioCardOverrides.get(liveId) || def;
    const definition = liveId === def.id ? liveDef : projectEditedCard(liveDef);
    const el = renderCard(studioRegistries, { cardId: liveId }, { inspection: false, level: 'inspect', definition, rules: run, showArt: true });
    if (el) {
      for (const [k, v] of Object.entries(CARD_SHAPE_PROPS)) el.style.setProperty(k, v);
      container.appendChild(el);
      requestAnimationFrame(() => { if (el.isConnected) fitCardFace(el); });
    }
  } catch (err) {
    container.innerHTML = `<div style="padding:10px;text-align:center;"><strong>${esc(def.name)}</strong><div class="studio-muted">${esc(def.type)} (${esc(err.message)})</div></div>`;
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
      img.style.position = 'absolute';
      img.style.left = `${safeNum(l.x, 50)}%`;
      img.style.top = `${safeNum(l.y, 50)}%`;
      img.style.width = `${safeNum(l.scale, 80)}%`;
      img.style.height = `${safeNum(l.scale, 80)}%`;
      img.style.objectFit = 'contain';
      img.style.transform = 'translate(-50%,-50%)';
      img.style.opacity = String(Math.max(0, Math.min(100, safeNum(l.opacity, 100))) / 100);
      img.style.mixBlendMode = ALLOWED_BLEND_MODES.has(l.blendMode) ? l.blendMode : 'normal';
      img.style.zIndex = String(Math.round(safeNum(l.zIndex, 1)));
      img.style.pointerEvents = 'none';
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
  tile.querySelector('.studio-card-meta').innerHTML = tileMetaHtml(def, sc, shiftHtml);
}

// Tile caption: the name on its own line, then CP, rank and act, the rank shift, and the stale-text marker.
function tileMetaHtml(def, sc, shiftHtml) {
  return `<div class="studio-card-meta-title" title="${esc(def.name)}">${esc(def.name)}</div>
    <div class="studio-card-meta-row">
      <span class="cp-chip">CP ${esc(sc.cp)}${sc.overridden ? '*' : ''}</span>
      <span class="rank-chip">${esc(RankName(sc.rank))} · ${esc(actForRank(sc.rank))}</span>
      ${shiftHtml}
      ${hasStaleText(def) ? STALE_TEXT_CHIP : ''}
    </div>`;
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
    tile.innerHTML = `<div class="studio-card-stage"></div><div class="studio-card-meta">${tileMetaHtml(def, sc, shiftHtml)}</div>`;
    renderCardWithLayers(def, tile.querySelector('.studio-card-stage'));
    tile.tabIndex = 0;
    const selectTile = () => {
      state.selectedCardId = def.id;
      document.querySelectorAll('.studio-card-tile.is-selected').forEach((n) => n.classList.remove('is-selected'));
      tile.classList.add('is-selected');
      renderInspector();
      if (isNarrowLayout()) openInspectorSheet();
    };
    tile.addEventListener('click', selectTile);
    tile.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTile(); } });
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
  document.getElementById('inspector-sheet-title').textContent = def.name || '';
  const sc = scoreCardEntry(def);
  renderScoreSummary(def, sc);

  document.getElementById('edit-name').value = def.name || '';
  document.getElementById('btn-delete-card').classList.toggle('hidden', !def._custom);
  document.getElementById('btn-reset-card').classList.toggle('hidden', !def._edited || Boolean(def._custom));
  const textInput = document.getElementById('edit-text');
  if (textInput.value !== (def.textTemplate || '')) textInput.value = def.textTemplate || '';
  renderTextWarnings(def);
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
      // A formula-driven count has no number to edit.
      const stacksIsNum = eff.stacks == null || (typeof eff.stacks === 'number' && Number.isFinite(eff.stacks));
      const stacksCtrl = stacksIsNum
        ? `<input type="number" min="1" max="30" value="${esc(safeNum(eff.stacks, 1))}" data-eff-stacks="${idx}" />`
        : '<span class="studio-muted" title="Formula-computed stack count">formula</span>';
      row.innerHTML = `
        <span>Status: <strong>${esc(eff.status)}</strong></span>
        <div class="feature-controls">
          ${chipFor()}
          ${stacksCtrl}
          <select data-eff-target="${idx}">
            <option value="enemy" ${eff.target !== 'self' ? 'selected' : ''}>Enemy</option>
            <option value="self" ${eff.target === 'self' ? 'selected' : ''}>Self</option>
          </select>
          <button class="s-btn s-btn-sm" data-rm-eff="${idx}">×</button>
        </div>`;
    } else {
      const amtIsNum = eff.amount == null || (typeof eff.amount === 'number' && Number.isFinite(eff.amount));
      const amtCtrl = amtIsNum
        ? `<input type="number" min="1" max="99" value="${esc(safeNum(eff.amount, 1))}" data-eff-amt="${idx}" />`
        : '<span class="studio-muted" title="Formula-computed value">formula</span>';
      row.innerHTML = `
        <span>Effect: <strong>${esc(eff.op)}</strong></span>
        <div class="feature-controls">
          ${chipFor()}
          ${amtCtrl}
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
  partsEl.insertAdjacentHTML('beforeend', scoreMathTableHtml(sc));
}

// Every scoring term with the formula behind it, then raw score, rarity discount and CP.
function scoreMathTableHtml(sc) {
  const S = state.scoring;
  const area = (sc.face.tags || []).includes(S.cardModel?.areaTag || 'targeting:area') ? (S.model?.ENEMIES || 2) : 1;
  const formulaNote = (k) => {
    if (k === 'SP') return `${sc.face.sp} SP × ${S.costs.sp.weight}`;
    if (k === 'MP') return `${sc.face.mp} MP × ${S.costs.mp.weight}`;
    if (k === 'damage') return `${sc.face.dmg} final (authored ${sc.face._meta?.authoredDmg ?? sc.face.dmg}) × ${S.effects.damage.weight}/${S.effects.damage.per}${area > 1 ? ` × ${area} AoE` : ''}`;
    if (k === 'block') return `${sc.face.blk} final (authored ${sc.face._meta?.authoredBlk ?? sc.face.blk}) × ${S.effects.block.weight}/${S.effects.block.per}`;
    if (k === 'poise') return `${sc.face.poise} Poise × ${S.effects.poiseDamage.weight}/${S.effects.poiseDamage.per}${area > 1 ? ` × ${area} AoE` : ''}`;
    if (k === 'effect count') return `multi-effect bonus (+${S.effectCount?.weight ?? 5}/extra)`;
    if (S.keywords?.[k]) return S.keywords[k].flat !== undefined ? `flat ${S.keywords[k].flat}` : `×${S.keywords[k].multiplier}`;
    if (S.statuses?.[k]) return `status over ${S.model?.R || 3}R${area > 1 && S.statuses[k].target === 'enemy' ? ` × ${area} AoE` : ''}`;
    return 'weight';
  };
  const discount = safeNum(S.rarity?.discount?.[sc.rarity] ?? S.items?.rarityDiscount?.[sc.rarity], 0);
  const rowsHtml = Object.entries(sc.parts || {}).map(([k, v]) => {
    const val = Math.round(safeNum(v, 0) * 10) / 10;
    return `<tr><td>${esc(k)}</td><td class="formula">${esc(formulaNote(k))}</td><td class="num ${val >= 0 ? 'pos' : 'neg'}">${val > 0 ? '+' : ''}${esc(val)}</td></tr>`;
  }).join('');
  return `<table class="score-math-table"><tbody>
    ${rowsHtml}
    <tr class="total"><td>Raw score</td><td class="formula">rounded sum</td><td class="num">${esc(sc.raw)}</td></tr>
    <tr><td>Rarity discount</td><td class="formula">${esc(sc.rarity)} (−${esc(discount)})</td><td class="num neg">${discount ? `−${esc(discount)}` : '0'}</td></tr>
    <tr class="total"><td>Combat Power (CP)</td><td class="formula">${esc(RankName(sc.rank))} · ${esc(actForRank(sc.rank))}${sc.overridden ? ' (override)' : ''}</td><td class="num">${esc(sc.cp)}</td></tr>
  </tbody></table>`;
}

// A plain text written from the card's effects. Only used when the designer asks for it ("Write from
// effects"); the card text is otherwise the designer's own and is never rewritten behind their back.
function textFromEffects(def) {
  const parts = [];
  const area = (def.tags || []).includes('targeting:area') ? ' to ALL enemies' : '';
  for (const e of def.effects || []) {
    const amt = typeof e.amount === 'number' ? e.amount : 1;
    if (e.op === 'damage') parts.push(`Deal {damage} damage${e.hits > 1 ? ` ${e.hits} times` : ''}${area}.`);
    else if (e.op === 'block') parts.push('Gain {block} Block.');
    else if (e.op === 'ward') parts.push(`Gain ${amt} Ward.`);
    else if (e.op === 'gainBarrier') parts.push(`Gain ${amt} Barrier.`);
    else if (e.op === 'poiseDamage') parts.push(`Deal {poiseDamage} Poise damage${area}.`);
    else if (e.op === 'restorePoise') parts.push(`Restore ${amt} Poise.`);
    else if (e.op === 'applyStatus') parts.push(`${e.target === 'self' ? 'Gain' : 'Apply'} {${e.status}} ${tokenLabel(e.status)}${e.target !== 'self' ? area : ''}.`);
    else if (e.op === 'draw') parts.push('Draw {draw}.');
    else if (e.op === 'discard') parts.push(`Discard ${amt} card${amt === 1 ? '' : 's'}.`);
    else if (e.op === 'heal') parts.push(`Heal ${amt} HP.`);
    else if (e.op === 'loseHp') parts.push(`Lose ${amt} HP.`);
    else if (e.op === 'restoreStamina' || e.op === 'gainEnergy') parts.push(`Gain ${amt} SP.`);
    else if (e.op === 'restoreMana') parts.push(`Gain ${amt} MP.`);
    else if (e.op === 'applyReflect') parts.push(`Gain ${amt} Reflect.`);
    else if (e.op === 'removeStatus') parts.push('Remove a debuff.');
    else if (e.op === 'moveEngagement') parts.push('Shift engagement.');
    else if (e.op === 'pullEnemy') parts.push('Pull enemy.');
    else if (e.op === 'swapRows') parts.push('Swap rows.');
    else parts.push(`${e.op}${typeof e.amount === 'number' ? ` ${e.amount}` : ''}.`);
  }
  for (const kw of def.keywords || []) parts.push(`${capitalise(kw)}.`);
  return parts.join(' ') || 'No effect.';
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
  // A change event that repeats the value the input already applied records no undo step.
  const probe = clone(def);
  fn(probe);
  if (JSON.stringify(probe) === JSON.stringify(def)) return;
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

function mutateSelectedCard(fn, { recordHistory = true, autoName = true } = {}) {
  const def = selectedCardDef();
  if (!def) return;
  if (recordHistory) pushHistory();
  fn(def);
  def._edited = true;
  if (autoName && document.getElementById('toggle-auto-name')?.checked) {
    def.name = safeCardName(scoreCardEntry(def).face, state.scoring);
  }
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

  const R = state.repoScoring;
  const groups = [
    { key: 'costs', title: 'Costs (SP / MP)', entries: Object.entries(state.scoring.costs || {}).map(([k, v]) => ({ id: k, label: k.toUpperCase(), val: v.weight, base: R.costs?.[k]?.weight, set: (n) => { state.scoring.costs[k].weight = n; } })) },
    { key: 'effects', title: 'Effects', entries: Object.entries(state.scoring.effects || {}).map(([k, v]) => ({ id: k, label: `${k} (per ${v.per})`, val: v.weight, base: R.effects?.[k]?.weight, set: (n) => { state.scoring.effects[k].weight = n; } })) },
    { key: 'statuses', title: 'Statuses', entries: Object.entries(state.scoring.statuses || {}).map(([k, v]) => ({ id: k, label: `${k} (${v.target})`, val: v.weight, base: R.statuses?.[k]?.weight, set: (n) => { state.scoring.statuses[k].weight = n; } })) },
    { key: 'keywords', title: 'Keywords', entries: Object.entries(state.scoring.keywords || {}).map(([k, v]) => ({ id: k, label: k + (v.flat !== undefined ? ' (flat)' : ' (mult)'), val: v.flat ?? v.multiplier, base: R.keywords?.[k]?.flat ?? R.keywords?.[k]?.multiplier, step: v.flat !== undefined ? 1 : 0.05, set: (n) => { if (v.flat !== undefined) state.scoring.keywords[k].flat = n; else state.scoring.keywords[k].multiplier = n; } })) },
    { key: 'rarity', title: 'Rarity Discounts', entries: Object.entries(state.scoring.rarity?.discount || {}).map(([k, v]) => ({ id: k, label: k, val: v, base: R.rarity?.discount?.[k], set: (n) => { state.scoring.rarity.discount[k] = n; } })) },
    { key: 'rank', title: 'Rank Bands', entries: [
      { id: 'unrankedMax', label: 'Unranked Max CP', val: state.scoring.rank.unrankedMax, base: R.rank?.unrankedMax, set: (n) => { state.scoring.rank.unrankedMax = n; } },
      { id: 'width', label: 'Band Width', val: state.scoring.rank.width, base: R.rank?.width, set: (n) => { state.scoring.rank.width = Math.max(1, n); } },
      { id: 'maxRank', label: 'Max Rank', val: state.scoring.rank.maxRank, base: R.rank?.maxRank, set: (n) => { state.scoring.rank.maxRank = Math.max(1, Math.round(n)); } },
      { id: 'effectCount', label: 'Multi-Effect Bonus', val: state.scoring.effectCount?.weight ?? 5, base: R.effectCount?.weight ?? 5, set: (n) => { (state.scoring.effectCount ||= {}).weight = n; } },
    ] },
    { key: 'tags', title: 'Weighted Tags', entries: Object.entries(state.scoring.tags || {}).filter(([k, v]) => {
      if (k[0] === '$' || !v) return false;
      const bv = R.tags?.[k];
      return v.weight !== 0 || v.multiplier !== undefined || v.pMultiplier !== undefined || (bv && (bv.weight !== 0 || bv.multiplier !== undefined || bv.pMultiplier !== undefined));
    }).map(([k, v]) => {
      const bv = R.tags?.[k];
      const isMult = v.multiplier !== undefined || v.pMultiplier !== undefined;
      return {
        id: k,
        label: `${v.label || k} (${k})`,
        val: v.multiplier ?? v.pMultiplier ?? v.weight ?? 0,
        base: bv ? (bv.multiplier ?? bv.pMultiplier ?? bv.weight ?? 0) : undefined,
        step: isMult ? 0.05 : 1,
        set: (n) => { if (v.multiplier !== undefined) state.scoring.tags[k].multiplier = n; else if (v.pMultiplier !== undefined) state.scoring.tags[k].pMultiplier = n; else state.scoring.tags[k].weight = n; },
      };
    }) },
  ];

  for (const g of groups) {
    if (groupF !== 'all' && g.key !== groupF) continue;
    const rows = g.entries.filter((e) => !q || `${g.title} ${e.id} ${e.label}`.toLowerCase().includes(q));
    if (!rows.length) continue;
    const card = document.createElement('div');
    card.className = 'weight-group-card';
    card.innerHTML = `<h3>${esc(g.title)}</h3>`;
    for (const r of rows) {
      const numVal = safeNum(r.val, 0);
      const baseNum = r.base !== undefined ? safeNum(r.base, 0) : undefined;
      const modified = baseNum !== undefined && numVal !== baseNum;
      const row = document.createElement('div');
      row.className = 'weight-row' + (modified ? ' is-modified' : '');
      row.innerHTML = `<span>${esc(r.label)}</span><input type="number" step="${esc(safeNum(r.step, 1))}" value="${esc(numVal)}" /><button type="button" class="weight-reset-btn ${modified ? '' : 'is-clean'}" title="${esc(`Reset to ${baseNum ?? numVal}`)}">↺</button>`;
      row.querySelector('input').addEventListener('change', (ev) => {
        const n = Number(ev.target.value);
        if (!Number.isFinite(n) || n === numVal) return;
        pushHistory();
        r.set(n);
        saveDraft();
        computeShiftCount();
        renderWeights();
        renderInspector();
        renderCardsGrid();
      });
      row.querySelector('.weight-reset-btn').addEventListener('click', () => {
        if (baseNum === undefined) return;
        pushHistory();
        r.set(baseNum);
        saveDraft();
        computeShiftCount();
        renderWeights();
        renderInspector();
        renderCardsGrid();
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

  // Preview card selector (always synced with current card roster)
  const cardSel = document.getElementById('art-preview-card-select');
  const prevVal = cardSel.value;
  cardSel.innerHTML = '';
  for (const c of state.cards) {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.name || c.id;
    cardSel.appendChild(o);
  }
  const preferredId = state.cards.some((c) => c.id === state.selectedCardId)
    ? state.selectedCardId
    : (state.cards.some((c) => c.id === prevVal) ? prevVal : (state.cards[0]?.id || ''));
  cardSel.value = preferredId;
  const previewDef = state.cards.find((c) => c.id === cardSel.value) || state.cards[0];
  if (previewDef) renderCardWithLayers(previewDef, document.getElementById('art-live-preview'));

  if (state.selectedLayerIdx >= state.artLayers.layers.length) state.selectedLayerIdx = Math.max(0, state.artLayers.layers.length - 1);
  list.innerHTML = '';
  state.artLayers.layers.forEach((layer, idx) => {
    const el = document.createElement('div');
    el.className = 'layer-card' + (idx === state.selectedLayerIdx ? ' is-selected' : '');
    el.dataset.layerCardIdx = String(idx);
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
        <label>X % <input type="number" data-l-num="x" data-l-idx="${idx}" min="0" max="100" value="${esc(safeNum(layer.x, 50))}" /></label>
        <label>Y % <input type="number" data-l-num="y" data-l-idx="${idx}" min="0" max="100" value="${esc(safeNum(layer.y, 50))}" /></label>
        <label>Scale % <input type="number" data-l-num="scale" data-l-idx="${idx}" min="10" max="150" value="${esc(safeNum(layer.scale, 80))}" /></label>
        <label>Z-Index <input type="number" data-l-num="zIndex" data-l-idx="${idx}" value="${esc(safeNum(layer.zIndex, 1))}" /></label>
        <label style="grid-column: span 2;"><span style="white-space:nowrap;">Opacity (<span class="opacity-val">${esc(safeNum(layer.opacity, 100))}%</span>)</span><input type="range" data-l-num="opacity" data-l-idx="${idx}" min="0" max="100" value="${esc(safeNum(layer.opacity, 100))}" /></label>
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
    t.title = `${a.id} — ${a.name} (click to assign to selected layer #${state.selectedLayerIdx + 1})`;
    t.innerHTML = `<img src="${esc(a.path)}" loading="lazy" alt="" /><div title="${esc(a.id)}">${esc(a.id)}</div>`;
    t.addEventListener('click', () => {
      const targetLayer = state.artLayers.layers[state.selectedLayerIdx] || state.artLayers.layers[0];
      if (!targetLayer) return;
      pushHistory();
      targetLayer.assetId = a.id;
      saveDraft();
      renderArtTab();
      renderCardsGrid();
      renderInspector();
      toast(`Assigned ${a.id} to layer #${state.selectedLayerIdx + 1}`);
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
    o.textContent = e.name || e.id;
    sel.appendChild(o);
  }
  if (registries.enemies.has('wanderingSoldier')) sel.value = 'wanderingSoldier';
}

function startSandboxCombat() {
  const classId = document.getElementById('sandbox-class').value || 'reaver';
  const enemyId = document.getElementById('sandbox-enemy').value || 'wanderingSoldier';
  const activeCard = state.cards.find((c) => c.id === state.selectedCardId) || state.cards[0];
  const liveId = activeCard ? liveCardIdFor(activeCard) : null;

  const run = createRunState({ registries: studioRegistries, classId, seed: 42, profileMeta: UNLOCK_META });
  const combat = createRunCombat({ registries: studioRegistries, run, rng: createRng(42), enemyIds: [enemyId] });
  dispatch(combat, { type: 'setReactions', enabled: false });
  if (activeCard && liveId) {
    combat.piles.hand.unshift({ instanceId: 'studio-test-card', cardId: liveId, upgraded: false });
    // Ensure the player can immediately play their edited card on Turn 1 (using real resolved play costs)
    let costs = { stamina: activeCard.staminaCost || 0, mana: activeCard.manaCost || 0, energy: activeCard.cost || 0 };
    try { costs = cardPlayCosts(combat, 'studio-test-card'); } catch { /* fallback to authored costs */ }
    if ((costs.stamina || 0) > (combat.player.stamina ?? 0)) combat.player.stamina = costs.stamina;
    if ((costs.mana || 0) > (combat.player.mana ?? 0)) combat.player.mana = costs.mana;
    if ((costs.energy || 0) > (combat.player.energy ?? 0)) combat.player.energy = costs.energy;
  }
  state.sandbox = {
    combat,
    classId,
    enemyId,
    appliedScoring: clone(state.scoring),
    customCardId: liveId,
    log: [`Combat started: ${classId} vs ${registries.enemies.get(enemyId)?.name || enemyId}. Injected "${activeCard?.name || 'none'}" into opening hand.`],
  };
  renderSandbox();
}

function renderSandbox() {
  const { combat, log, customCardId } = state.sandbox;
  if (!combat) return;
  const p = combat.player;
  const e = combat.enemies[0];
  document.getElementById('sandbox-turn-info').textContent = `Turn ${combat.turn} · Phase: ${combat.phase} · Config: ${state.abSlots.activeLabel}`;

  const fmtStatuses = (actor) => Object.entries(actor?.statuses || {})
    .map(([k, v]) => [k, typeof v === 'number' ? v : (v?.stacks ?? 0)])
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k} ${n}`)
    .join(', ') || 'None';

  document.getElementById('sandbox-player-panel').innerHTML = `
    <h4>Player (${esc(state.sandbox.classId)})</h4>
    <div class="stat-line">
      <span>HP: <strong>${p.hp}/${p.maxHp}</strong></span>
      <span>Block: <strong>${p.block || 0}</strong></span>
      <span>SP: <strong>${p.stamina ?? p.energy ?? 0}</strong></span>
      <span>MP: <strong>${p.mana ?? 0}</strong></span>
    </div>
    <div class="studio-muted">Statuses: ${esc(fmtStatuses(p))}</div>
  `;

  document.getElementById('sandbox-enemy-panel').innerHTML = e ? `
    <h4>${esc(e.name || e.enemyId)} ${e.hp <= 0 ? '(DEFEATED)' : ''}</h4>
    <div class="stat-line">
      <span>HP: <strong>${e.hp}/${e.maxHp}</strong></span>
      <span>Block: <strong>${e.block || 0}</strong></span>
      <span>Poise: <strong>${e.poiseMeter?.current ?? 0}/${e.poiseMeter?.max ?? 0}</strong></span>
    </div>
    <div class="studio-muted">Statuses: ${esc(fmtStatuses(e))}</div>
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
    let costLabel = 'Play';
    try {
      const c = cardPlayCosts(combat, inst.instanceId);
      const parts = [];
      if (c.stamina) parts.push(`${c.stamina} SP`);
      if (c.mana) parts.push(`${c.mana} MP`);
      costLabel = parts.length ? `Play (${parts.join(' · ')})` : 'Play (Free)';
    } catch { /* fallback */ }
    const foot = document.createElement('div');
    foot.className = 'studio-card-meta';
    foot.innerHTML = `<div class="studio-card-meta-row"><span>${inst.instanceId === 'studio-test-card' ? '★ Edited Card' : esc(def.name)}</span><span class="cp-chip">${esc(costLabel)}</span></div>`;
    wrap.appendChild(foot);
    wrap.addEventListener('click', () => {
      try {
        let needsTarget = false;
        let targetId = null;
        try {
          const pv = previewCard(combat, inst.instanceId);
          needsTarget = Boolean(pv?.needsTarget);
        } catch { needsTarget = false; }
        if (needsTarget) {
          const defTarget = getCardTarget(def);
          targetId = (defTarget === 'self' || defTarget === 'ally' || defTarget === 'allAllies')
            ? combat.player.id
            : (combat.enemies.find((x) => x.hp > 0)?.id || null);
        }
        const intent = { type: 'playCard', cardInstanceId: inst.instanceId, ...(needsTarget && targetId ? { targetId } : {}) };
        const res = dispatch(combat, intent);
        if (res && res.error) state.sandbox.log.unshift(`Cannot play ${def.name}: ${res.error}`);
        else state.sandbox.log.unshift(`Played ${def.name}${needsTarget && targetId ? ` → ${targetId === combat.player.id ? 'Player' : (e?.name || targetId)}` : ''}`);
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
  if (!isLocalServer) {
    state.repoScoring = clone(shippedScoring);
    state.scoring = clone(shippedScoring);
    recomputeBaselineRanks();
    syncAllViews();
    return true;
  }
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
    document.getElementById('draft-status').title = `Repo file: ${data.scoringPath}`;
    recomputeBaselineRanks();
    syncAllViews();
    toast(`Loaded ${data.scoringPath}`);
    return true;
  } catch (err) {
    document.getElementById('path-status').textContent = `Offline / fallback to shipped scoring (${err.message})`;
    // Still show the shipped scoring so the studio works without the local server.
    recomputeBaselineRanks();
    syncAllViews();
    return false;
  }
}

const RANK_SHIFT_LIST_LIMIT = 40;

// Cards whose rank differs from the repo baseline, for the export dialog.
function rankShifts() {
  return state.cards
    .map((card) => ({ card, now: scoreCardEntry(card).rank, before: state.baselineRanks[card.id] }))
    .filter((shift) => shift.before !== undefined && shift.now !== shift.before);
}

function renderRankShiftList() {
  const shifts = rankShifts();
  document.getElementById('export-modal-shift-count').textContent = shifts.length === 1 ? '1 card changes rank' : `${shifts.length} cards change rank`;
  const list = document.getElementById('export-modal-shifts');
  const shown = shifts.slice(0, RANK_SHIFT_LIST_LIMIT).map((shift) => {
    const direction = shift.now > shift.before ? 'shift-up' : 'shift-down';
    return `<li><span>${esc(shift.card.name)}</span><span class="${direction}">${esc(RankName(shift.before))} → ${esc(RankName(shift.now))}</span></li>`;
  });
  const hidden = shifts.length - RANK_SHIFT_LIST_LIMIT;
  if (hidden > 0) shown.push(`<li class="studio-muted">+${hidden} more</li>`);
  list.innerHTML = shown.join('');
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
  // Revert to the last loaded repo copy first, so a failed reload (server offline) still reverts.
  state.scoring = clone(state.repoScoring);
  state.artLayers = clone(state.repoArtLayers);
  const reloaded = await loadFromRepo(state.repoPath);
  state.artLayers = clone(state.repoArtLayers);
  syncAllViews();
  refreshDirtyStatus();
  toast(reloaded ? 'Reverted to the repo version' : 'Reverted to the last loaded repo copy (server offline)');
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

const capitalise = (text) => (text ? text[0].toUpperCase() + text.slice(1) : text);

// Fills a select with the values that actually occur, keeping the current choice when it still exists.
function fillSelect(select, values, allLabel = null) {
  const previous = select.value;
  select.innerHTML = '';
  if (allLabel) select.append(new Option(allLabel, 'all'));
  for (const value of values) select.append(new Option(capitalise(value), value));
  const keep = previous === 'all' ? Boolean(allLabel) : values.includes(previous);
  select.value = keep ? previous : (allLabel ? 'all' : values[0] ?? '');
}

// Type, class and rarity choices come from the loaded cards, so no option matches nothing.
function populateCardOptions() {
  const distinct = (field, fallback) => [...new Set(state.cards.map((c) => c[field] || fallback))].sort();
  const types = distinct('type', 'attack');
  const classes = distinct('class', 'colorless');
  const rarities = distinct('rarity', 'common');
  fillSelect(document.getElementById('filter-type'), types, 'All Types');
  fillSelect(document.getElementById('filter-class'), classes, 'All Classes');
  fillSelect(document.getElementById('edit-type'), types);
  fillSelect(document.getElementById('edit-class'), classes);
  fillSelect(document.getElementById('edit-rarity'), rarities);
  const poolText = `Core pool · ${state.cards.length} cards`;
  document.querySelectorAll('.pool-label').forEach((el) => { el.textContent = poolText; });
}

function syncAllViews() {
  populateRankFilter();
  populateCardOptions();
  populateAddFeatureDropdown();
  renderCardsGrid();
  renderInspector();
  renderWeights();
  renderArtTab();
}

// ---------------------------------------------------------------------------
// Chrome: menus, shortcuts, filter panel, collapsible sections, inspector sheet
// ---------------------------------------------------------------------------
const FILTERS_OPEN_KEY = 'ashenspire:scoreStudioFiltersOpen:v1';
const SECTIONS_KEY = 'ashenspire:scoreStudioSections:v1';
const NARROW_LAYOUT_QUERY = '(max-width: 900px)';

function readStoredJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeStoredJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

const isNarrowLayout = () => window.matchMedia(NARROW_LAYOUT_QUERY).matches;

function menuParts(menu) {
  const button = menu.querySelector(':scope > button[aria-controls]');
  return { button, panel: document.getElementById(button.getAttribute('aria-controls')) };
}

function closeMenus(except = null) {
  document.querySelectorAll('.studio-menu').forEach((menu) => {
    if (menu === except) return;
    const { button, panel } = menuParts(menu);
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  });
}

function anyMenuOpen() {
  return [...document.querySelectorAll('.studio-menu-panel')].some((panel) => !panel.hidden);
}

function setupMenus() {
  document.querySelectorAll('.studio-menu').forEach((menu) => {
    const { button, panel } = menuParts(menu);
    button.addEventListener('click', () => {
      const opening = panel.hidden;
      closeMenus(menu);
      panel.hidden = !opening;
      button.setAttribute('aria-expanded', String(opening));
      if (opening) panel.querySelector('button, input')?.focus();
    });
    // Picking an action closes the menu; the path field, Load and the auto-save toggle keep it open.
    panel.addEventListener('click', (e) => {
      if (e.target.closest('button.menu-item')) closeMenus();
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.studio-menu')) closeMenus();
  });
}

const TEXT_ENTRY_INPUT_TYPES = new Set(['text', 'search', 'number', 'email', 'url', 'tel', 'password']);

// Fields where the browser's own undo applies to what was typed; checkboxes and selects are not among them.
function isTextEntry(target) {
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return TEXT_ENTRY_INPUT_TYPES.has(target.type);
  return Boolean(target?.isContentEditable);
}

function setupShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (anyMenuOpen()) {
        closeMenus();
        return;
      }
      if (document.body.classList.contains('inspector-open') && !document.querySelector('dialog[open]')) {
        closeInspectorSheet();
      }
      return;
    }
    const modifier = e.ctrlKey || e.metaKey;
    if (!modifier) return;
    // Inside a text field, leave undo to the browser so typing can be undone natively.
    if (isTextEntry(e.target)) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('btn-undo').click();
    } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
      e.preventDefault();
      document.getElementById('btn-redo').click();
    }
  });
}

function activeFilterCount() {
  return ['filter-type', 'filter-class', 'filter-rank', 'filter-shift']
    .filter((id) => document.getElementById(id).value !== 'all').length;
}

function updateFilterCount() {
  const badge = document.getElementById('filter-count');
  const count = activeFilterCount();
  badge.textContent = String(count);
  badge.classList.toggle('hidden', count === 0);
}

function setFiltersOpen(open) {
  document.getElementById('filter-panel').hidden = !open;
  document.getElementById('btn-filters').setAttribute('aria-expanded', String(open));
  writeStoredJson(FILTERS_OPEN_KEY, open);
}

function setupFilterPanel() {
  setFiltersOpen(readStoredJson(FILTERS_OPEN_KEY, false) === true);
  document.getElementById('btn-filters').addEventListener('click', () => {
    setFiltersOpen(document.getElementById('filter-panel').hidden);
  });
}

// Inspector sections remember whether they are open. Controls in a section header (buttons, selects,
// the override toggle) are interactive content, so clicking them does not toggle the section.
function setupSections() {
  const stored = readStoredJson(SECTIONS_KEY, {});
  document.querySelectorAll('details.inspector-section[data-section]').forEach((section) => {
    const name = section.dataset.section;
    if (Object.hasOwn(stored, name)) section.open = stored[name] === true;
    section.addEventListener('toggle', () => {
      const current = readStoredJson(SECTIONS_KEY, {});
      current[name] = section.open;
      writeStoredJson(SECTIONS_KEY, current);
    });
  });
}

let sheetReturnCardId = null;
function openInspectorSheet() {
  sheetReturnCardId = state.selectedCardId;
  const def = selectedCardDef();
  document.getElementById('inspector-sheet-title').textContent = def?.name || '';
  document.body.classList.add('inspector-open');
  document.getElementById('card-inspector').scrollTop = 0;
  document.getElementById('btn-inspector-back').focus();
}

function closeInspectorSheet() {
  document.body.classList.remove('inspector-open');
  const tile = sheetReturnCardId && document.querySelector(`.studio-card-tile[data-card-id="${CSS.escape(sheetReturnCardId)}"]`);
  if (tile) {
    tile.scrollIntoView({ block: 'center' });
    tile.focus({ preventScroll: true });
  }
}

// ---------------------------------------------------------------------------
// Wire Events & Boot
// ---------------------------------------------------------------------------
function wireEvents() {
  setupMenus();
  // Flush a pending draft save when the tab is hidden or closed.
  window.addEventListener('pagehide', flushDraft);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushDraft();
  });
  setupShortcuts();
  setupFilterPanel();
  setupSections();
  document.getElementById('btn-inspector-back').addEventListener('click', closeInspectorSheet);
  document.getElementById('btn-dismiss-art-banner').addEventListener('click', () => {
    document.getElementById('art-missing-banner').hidden = true;
  });

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

  // Filters & view toggle: the search box filters as you type, selects on change (one render each).
  document.getElementById('card-search').addEventListener('input', renderCardsGrid);
  ['filter-type', 'filter-class', 'filter-rank', 'filter-shift'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => {
      updateFilterCount();
      renderCardsGrid();
    });
  });
  document.getElementById('view-grid').addEventListener('click', () => { state.viewMode = 'grid'; document.getElementById('view-grid').classList.add('is-active'); document.getElementById('view-single').classList.remove('is-active'); renderCardsGrid(); });
  document.getElementById('view-single').addEventListener('click', () => { state.viewMode = 'single'; document.getElementById('view-single').classList.add('is-active'); document.getElementById('view-grid').classList.remove('is-active'); renderCardsGrid(); });

  // New / Duplicate / Reset / Delete card (the last three live in Card Basics' ⋯ menu)
  document.getElementById('btn-new-card').addEventListener('click', () => {
    pushHistory();
    const id = `custom.card_${Date.now().toString(36)}`;
    const card = normalizeStudioCard({
      id, name: 'New Custom Card', class: 'colorless', rarity: 'uncommon', type: 'attack', icon: 'attack',
      cost: 1, staminaCost: 1, manaCost: 0, damageSchool: 'physical',
      effects: [{ op: 'damage', target: 'enemy', amount: 8 }],
      keywords: [], tags: ['camp:physical', 'maneuver:attack', 'source:weapon', 'classification.attack', 'targeting:single'],
      textTemplate: 'Deal {damage} damage.', _custom: true,
    });
    state.cards.unshift(card);
    state.selectedCardId = id;
    renderCardsGrid();
    renderInspector();
    saveDraft();
    toast('Created custom card');
  });

  document.getElementById('btn-duplicate-card').addEventListener('click', () => {
    const src = selectedCardDef();
    if (!src) return;
    pushHistory();
    const copy = normalizeStudioCard({ ...clone(src), id: `custom.copy_${Date.now().toString(36)}`, name: `${src.name} (Copy)`, _custom: true, _edited: true });
    state.cards.unshift(copy);
    state.selectedCardId = copy.id;
    renderCardsGrid();
    renderInspector();
    saveDraft();
    toast(`Duplicated "${src.name}"`);
  });

  document.getElementById('btn-reset-card').addEventListener('click', () => {
    const idx = state.cards.findIndex((c) => c.id === state.selectedCardId);
    if (idx < 0) return;
    const orig = registries.cards.get(state.cards[idx].id);
    if (!orig) return;
    pushHistory();
    state.cards[idx] = clone(orig);
    studioCardOverrides.delete(orig.id);
    studioCardOverrides.delete(`${LIVE_ID_PREFIX}${orig.id}`);
    if (state.scoring.overrides) delete state.scoring.overrides[orig.id];
    renderCardsGrid();
    renderInspector();
    saveDraft();
    toast(`Reverted "${orig.name}" to repo baseline`);
  });

  document.getElementById('btn-delete-card').addEventListener('click', () => {
    const idx = state.cards.findIndex((c) => c.id === state.selectedCardId);
    if (idx < 0 || !state.cards[idx]._custom) return;
    const removed = state.cards[idx];
    pushHistory();
    state.cards.splice(idx, 1);
    studioCardOverrides.delete(removed.id);
    studioCardOverrides.delete(`${LIVE_ID_PREFIX}${removed.id}`);
    if (state.scoring.overrides) delete state.scoring.overrides[removed.id];
    state.selectedCardId = state.cards[Math.min(idx, state.cards.length - 1)]?.id || null;
    renderCardsGrid();
    renderInspector();
    saveDraft();
    toast(`Deleted "${removed.name}"`);
  });

  // Card inspector edits
  // Typing and spinner holds record one undo step per editing burst, not one per keystroke or tick.
  const nameBurst = createEditBurst();
  const nameInput = document.getElementById('edit-name');
  nameInput.addEventListener('focus', () => nameBurst.end());
  nameInput.addEventListener('input', (e) => {
    const autoToggle = document.getElementById('toggle-auto-name');
    if (autoToggle?.checked) autoToggle.checked = false;
    nameBurst.begin();
    mutateSelectedCard((d) => { d.name = e.target.value; }, { recordHistory: false, autoName: false });
  });
  document.getElementById('btn-auto-name').addEventListener('click', () => {
    const def = selectedCardDef();
    if (!def) return;
    const generated = safeCardName(scoreCardEntry(def).face, state.scoring);
    mutateSelectedCard((d) => { d.name = generated; }, { autoName: false });
    toast(`Generated name: "${generated}"`);
  });
  const textBurst = createEditBurst();
  const textInput = document.getElementById('edit-text');
  textInput.addEventListener('focus', () => textBurst.end());
  textInput.addEventListener('input', (e) => {
    textBurst.begin();
    mutateSelectedCard((d) => { d.textTemplate = e.target.value; }, { recordHistory: false, autoName: false });
  });
  document.getElementById('btn-text-from-effects').addEventListener('click', () => {
    mutateSelectedCard((d) => { d.textTemplate = textFromEffects(d); }, { autoName: false });
  });

  // Gallery card size and inspector preview size (Filters panel), and the inspector resizer (desktop only)
  const cardsLayout = document.querySelector('.cards-layout');
  const savedInspectorWidth = Number(readStoredJson(INSPECTOR_WIDTH_KEY, 0));
  if (savedInspectorWidth >= INSPECTOR_WIDTH_MIN && savedInspectorWidth <= INSPECTOR_WIDTH_MAX) {
    cardsLayout.style.setProperty('--inspector-width', `${savedInspectorWidth}px`);
  }
  document.getElementById('card-scale-slider').addEventListener('input', (e) => {
    document.getElementById('cards-grid').style.setProperty('--card-tile-width', `${e.target.value}px`);
    requestAnimationFrame(() => document.querySelectorAll('#cards-grid .card').forEach((el) => fitCardFace(el)));
  });
  document.getElementById('inspector-scale-slider').addEventListener('input', (e) => {
    document.getElementById('inspector-card-preview').style.setProperty('--inspector-card-width', `${e.target.value}px`);
    const cardEl = document.querySelector('#inspector-card-preview .card');
    if (cardEl) requestAnimationFrame(() => fitCardFace(cardEl));
  });
  const resizer = document.getElementById('inspector-resizer');
  let draggingResizer = false;
  resizer.addEventListener('pointerdown', (e) => {
    if (isNarrowLayout()) return;
    draggingResizer = true;
    resizer.classList.add('is-dragging');
    resizer.setPointerCapture(e.pointerId);
  });
  resizer.addEventListener('pointermove', (e) => {
    if (!draggingResizer) return;
    const maxWidth = Math.max(INSPECTOR_WIDTH_MIN, Math.min(INSPECTOR_WIDTH_MAX, window.innerWidth - 300));
    const width = Math.max(INSPECTOR_WIDTH_MIN, Math.min(maxWidth, Math.round(window.innerWidth - e.clientX)));
    cardsLayout.style.setProperty('--inspector-width', `${width}px`);
    writeStoredJson(INSPECTOR_WIDTH_KEY, width);
  });
  const stopResizerDrag = () => {
    if (!draggingResizer) return;
    draggingResizer = false;
    resizer.classList.remove('is-dragging');
    const cardEl = document.querySelector('#inspector-card-preview .card');
    if (cardEl) requestAnimationFrame(() => fitCardFace(cardEl));
  };
  resizer.addEventListener('pointerup', stopResizerDrag);
  resizer.addEventListener('pointercancel', stopResizerDrag);
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

  // Add features: picking from the list adds at once, as do the quick-add chips; Add repeats the pick.
  const addFeatureValue = (val) => {
    if (!val) return;
    const [kind, key] = [val.slice(0, val.indexOf(':')), val.slice(val.indexOf(':') + 1)];
    mutateSelectedCard((d) => {
      d.effects ||= [];
      d.keywords ||= [];
      d.tags ||= [];
      if (kind === 'effect') d.effects.push({ op: key, target: getCardTarget(d), amount: key === 'damage' ? 6 : key === 'block' ? 5 : 2 });
      else if (kind === 'status') d.effects.push({ op: 'applyStatus', status: key, stacks: 2, target: state.scoring.statuses?.[key]?.target || 'enemy' });
      else if (kind === 'kw' && !d.keywords.includes(key)) d.keywords.push(key);
      else if (kind === 'tag' && !d.tags.includes(key)) d.tags.push(key);
      appendClauseForFeature(d, kind, key);
    });
    document.getElementById('add-feature-select').value = '';
  };
  document.getElementById('btn-add-feature').addEventListener('click', () => addFeatureValue(document.getElementById('add-feature-select').value));
  document.getElementById('add-feature-select').addEventListener('change', (e) => addFeatureValue(e.target.value));
  document.getElementById('quick-add-chips').addEventListener('click', (e) => addFeatureValue(e.target.dataset?.quickAdd));

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
    state.selectedLayerIdx = state.artLayers.layers.length - 1;
    renderArtTab();
    saveDraft();
  });
  document.getElementById('art-preview-card-select').addEventListener('change', (e) => {
    state.selectedCardId = e.target.value;
    renderArtTab();
  });
  document.getElementById('asset-search').addEventListener('input', renderArtTab);
  document.getElementById('art-layers-list').addEventListener('click', (e) => {
    // A click elsewhere on a layer card selects it; asset thumbnails then assign to that layer.
    const cardEl = e.target.closest('.layer-card');
    if (cardEl && e.target.dataset.lUp === undefined && e.target.dataset.lDown === undefined && e.target.dataset.lDel === undefined) {
      const selIdx = Number(cardEl.dataset.layerCardIdx);
      if (!Number.isNaN(selIdx) && selIdx !== state.selectedLayerIdx) {
        state.selectedLayerIdx = selIdx;
        document.querySelectorAll('#art-layers-list .layer-card').forEach((n, i) => n.classList.toggle('is-selected', i === selIdx));
      }
      return;
    }
    const idx = Number(e.target.dataset.lUp ?? e.target.dataset.lDown ?? e.target.dataset.lDel);
    if (Number.isNaN(idx)) return;
    pushHistory();
    if (e.target.dataset.lUp !== undefined && idx > 0) { [state.artLayers.layers[idx - 1], state.artLayers.layers[idx]] = [state.artLayers.layers[idx], state.artLayers.layers[idx - 1]]; state.selectedLayerIdx = idx - 1; }
    if (e.target.dataset.lDown !== undefined && idx < state.artLayers.layers.length - 1) { [state.artLayers.layers[idx + 1], state.artLayers.layers[idx]] = [state.artLayers.layers[idx], state.artLayers.layers[idx + 1]]; state.selectedLayerIdx = idx + 1; }
    if (e.target.dataset.lDel !== undefined) state.artLayers.layers.splice(idx, 1);
    renderArtTab();
    renderCardsGrid();
    renderInspector();
    saveDraft();
  });
  // Typing and slider drags in a layer record one undo step per focus.
  let layerEditHistoryPushed = false;
  document.getElementById('art-layers-list').addEventListener('focusin', () => { layerEditHistoryPushed = false; });
  document.getElementById('art-layers-list').addEventListener('input', (e) => {
    const idx = Number(e.target.dataset.lIdx ?? e.target.dataset.lEnabled);
    if (Number.isNaN(idx)) return;
    const layer = state.artLayers.layers[idx];
    if (!layer) return;
    if (!layerEditHistoryPushed) { pushHistory(); layerEditHistoryPushed = true; }
    if (e.target.dataset.lEnabled !== undefined) layer.enabled = e.target.checked;
    else if (e.target.dataset.lField) layer[e.target.dataset.lField] = e.target.value;
    else if (e.target.dataset.lNum) {
      layer[e.target.dataset.lNum] = safeNum(e.target.value, 0);
      if (e.target.dataset.lNum === 'opacity') {
        const span = e.target.closest('label')?.querySelector('.opacity-val');
        if (span) span.textContent = `${layer.opacity}%`;
      }
    }
    saveDraft();
    // Update the live preview in place without rebuilding #art-layers-list (keeps focus and slider drags).
    const cardSel = document.getElementById('art-preview-card-select');
    const previewDef = state.cards.find((c) => c.id === cardSel.value) || state.cards[0];
    if (previewDef) renderCardWithLayers(previewDef, document.getElementById('art-live-preview'));
    renderInspector();
  });
  document.getElementById('art-layers-list').addEventListener('change', () => {
    layerEditHistoryPushed = false;
    renderCardsGrid();
  });
  document.getElementById('btn-save-art').addEventListener('click', async () => {
    try {
      const r = await fetch('/__studio/art-layers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artLayers: state.artLayers }) });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error);
      state.repoArtLayers = clone(state.artLayers);
      writeDraftNow();
      refreshDirtyStatus();
      toast(`Saved ${data.layerCount} art layer(s) to ${data.path}`);
    } catch (err) { toast(`Save failed: ${err.message}`); }
  });
  document.getElementById('btn-download-art').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.artLayers, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'cardArtLayers.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  document.getElementById('btn-sandbox-refill').addEventListener('click', () => {
    if (!state.sandbox.combat) return;
    const sp = Math.max(state.sandbox.combat.player.maxStamina || 3, 10);
    const mp = Math.max(state.sandbox.combat.player.maxMana || 3, 10);
    state.sandbox.combat.player.stamina = sp;
    state.sandbox.combat.player.mana = mp;
    state.sandbox.log.unshift(`Refilled player to ${sp} SP & ${mp} MP.`);
    renderSandbox();
  });
  document.getElementById('btn-sandbox-reset').addEventListener('click', startSandboxCombat);
  document.getElementById('sandbox-class').addEventListener('change', startSandboxCombat);
  document.getElementById('sandbox-enemy').addEventListener('change', startSandboxCombat);
  document.getElementById('btn-sandbox-endturn').addEventListener('click', () => {
    const combat = state.sandbox.combat;
    if (!combat) return;
    if (combat.result) { state.sandbox.log.unshift(`Combat already ended (${combat.result}). Click Reset to start again.`); renderSandbox(); return; }
    try {
      dispatch(combat, { type: 'endTurn' });
      // Reactions are off in the sandbox; decline any the enemy turn still offers so the turn can finish.
      for (let guard = 0; guard < 8 && combat.pendingReaction && !combat.result; guard++) {
        dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
      }
      if (combat.result) state.sandbox.log.unshift(`Combat ended: ${combat.result}`);
      else state.sandbox.log.unshift(`Ended turn → Turn ${combat.turn}`);
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
    renderRankShiftList();
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
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'scoring.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
const ART_CHECK_TIMEOUT_MS = 2000;

// Without the art cache every card shows broken images; say why and how to fix it.
async function checkCardArt() {
  const images = [...document.querySelectorAll('#cards-grid img')];
  if (!images.length) return;
  const settled = (img) => new Promise((resolve) => {
    if (img.complete) return resolve();
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
  });
  await Promise.race([
    Promise.all(images.map(settled)),
    new Promise((resolve) => setTimeout(resolve, ART_CHECK_TIMEOUT_MS)),
  ]);
  const failed = images.filter((img) => img.complete && img.naturalWidth === 0).length;
  if (failed > images.length / 2) document.getElementById('art-missing-banner').hidden = false;
}

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

  // Web mode (GitHub Pages): nothing can be written to the repo, so the repo controls go and
  // Download JSON in the More menu is how work leaves the studio.
  if (!isLocalServer) {
    for (const id of ['btn-export-repo', 'btn-save-art', 'btn-revert']) document.getElementById(id)?.classList.add('hidden');
    document.querySelector('#more-menu .menu-section')?.classList.add('hidden');
    document.getElementById('draft-status').title = 'Web mode: use Download JSON in the More menu to export';
  }

  await loadFromRepo(state.repoPath);

  // Restore local draft temp copy if present. Everything is checked first; state changes only after.
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || 'null');
    if (draft?.scoring && ValidateScoringConfig(draft.scoring).length === 0) {
      const draftArtLayers = Array.isArray(draft.artLayers?.layers) ? draft.artLayers : null;
      const draftCards = (Array.isArray(draft.customCards) ? draft.customCards : [])
        .filter((card) => card && typeof card === 'object' && !Array.isArray(card) && typeof card.id === 'string' && card.id);
      state.scoring = draft.scoring;
      if (draftArtLayers) state.artLayers = draftArtLayers;
      for (const draftCard of draftCards) {
        const i = state.cards.findIndex((c) => c.id === draftCard.id);
        if (i >= 0) state.cards[i] = draftCard;
        else state.cards.unshift(draftCard);
      }
      syncAllViews();
      refreshDirtyStatus();
      if (isDirty()) document.getElementById('draft-status').textContent = 'Restored local draft temp copy';
      return;
    }
  } catch { /* ignore */ }
  refreshDirtyStatus();
}

boot().then(checkCardArt);
