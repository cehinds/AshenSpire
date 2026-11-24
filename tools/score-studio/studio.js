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
import { BaseFace, CardKind, CardCategories, ScoreCard, CombatPower, RankOf, RankName, CardName, CardNameParts, ApplyScoringOverride } from '../../src/model/combatPower.js';
import { ValidateScoringConfig } from '../../src/model/activeScoring.js';
import { staticCardTokens } from '../../src/model/playingCard.js';
import { tokenRe, computeTokenBindings } from '../../src/model/validate.js';
import { ScoringDiffPaths, MergePendingScoring, HasRankPin, WithoutRankPin, STUDIO_SAVE_PATH } from './weightsStaging.js';
import { weightSentence, weightExample } from './weightExamples.js';

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
  pendingScoring: null,        // staged weight edits; null when none (applied on Apply, owner 2026-11-23)
  pendingBase: null,           // the applied config the pending copy was taken from; Apply replays base -> pending
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
  // Register the edited copy the way the game projects the shipped card (projectEditedCard), so previewCard
  // prices and measures it with the same rules. The raw authored copy missed the projection, and the spell
  // cost rules then charged an extra MP: renaming Acid Splash dropped it from CP 13 to CP 5.
  const liveDef = { ...clone(projectEditedCard(def)), id: liveId };
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
    // SP and MP stay the costs typed in Card Basics. The reference fight reprices an edited card (the multi-hit
    // SP floor turned Feint's 0 SP into 3; a stance cut kept Brace at 0 SP whatever was typed), so the score
    // charged for a cost the chip did not show. Every shipped Core card measures its authored cost anyway.
    const prev = previewCard(combat, probeId, enemy.id);
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
  f.magicShare = safeNum(def.magicShare, 0);
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

// ---------------------------------------------------------------------------
// Card Type and Martial / Magic
// ---------------------------------------------------------------------------
// The studio's Card Type is the card's play style: its authored type plus the maneuver tag the game reads
// (combatProfileFor). Martial is the physical camp, Magic the spell camp; both is a physical hit with a magic
// share (the game's packet hit).
const CARD_KINDS = Object.freeze(['attack', 'skill', 'spell', 'sweep', 'counter', 'defend', 'power', 'curse', 'status']);
const KIND_MANEUVERS = Object.freeze({ attack: 'attack', sweep: 'sweep', counter: 'counter', defend: 'defend', spell: 'casting' });
const PLAIN_KINDS = Object.freeze(['power', 'curse', 'status']);
const HYBRID_MAGIC_SHARE = 0.5;
const SCHOOL_CATEGORIES = Object.freeze(['martial', 'magic', 'hybrid']);

const hasDamageEffect = (def) => (def.effects || []).some((e) => e.op === 'damage');

// The same play style ScoreCard scores (CardKind), so the studio and the shipped table agree.
const cardKindOf = (def) => CardKind(def);
// Maneuvers outside the Card Type list; an Attack pick keeps them.
const KEPT_ATTACK_MANEUVERS = Object.freeze(['maneuver:smash', 'maneuver:ranged']);

function setCardKind(def, kind) {
  const keptManeuver = kind === 'attack' ? (def.tags || []).find((t) => KEPT_ATTACK_MANEUVERS.includes(t)) : null;
  const keep = (def.tags || []).filter((t) => !t.startsWith('maneuver:') && t !== 'source:spell' && !t.startsWith('classification.'));
  const maneuver = keptManeuver ? keptManeuver.slice('maneuver:'.length) : KIND_MANEUVERS[kind];
  if (PLAIN_KINDS.includes(kind)) def.type = kind;
  else if (kind === 'attack' || kind === 'sweep') def.type = 'attack';
  else if (kind === 'skill' || kind === 'defend') def.type = 'skill';
  else def.type = hasDamageEffect(def) ? 'attack' : 'skill';
  def.tags = [...keep, ...(maneuver ? [`maneuver:${maneuver}`] : []), `classification.${def.type}`];
  if (kind === 'spell') setCardSchools(def, { martial: false, magic: true });
  // Leaving Spell for a martial play style makes the card Martial; Power, Curse and Status keep their school.
  else if (!PLAIN_KINDS.includes(kind) && cardSchoolsOf(def).magic && !cardSchoolsOf(def).martial) setCardSchools(def, { martial: true, magic: false });
}

function cardSchoolsOf(def) {
  const spell = (def.tags || []).includes('camp:spell');
  return { martial: !spell, magic: spell || safeNum(def.magicShare, 0) > 0 };
}

function setCardSchools(def, { martial, magic }) {
  const tags = (def.tags || []).filter((t) => !t.startsWith('camp:') && t !== 'source:spell');
  const spellOnly = magic && !martial;
  tags.push(spellOnly ? 'camp:spell' : 'camp:physical');
  if (spellOnly) {
    tags.push('source:spell');
    def.damageSchool = def.damageSchool && def.damageSchool !== 'physical' ? def.damageSchool : 'magic';
  } else if (!magic && def.damageSchool && def.damageSchool !== 'physical') def.damageSchool = 'physical';
  if (magic && martial) def.magicShare = safeNum(def.magicShare, 0) > 0 && def.magicShare < 1 ? def.magicShare : HYBRID_MAGIC_SHARE;
  else delete def.magicShare;
  def.tags = tags;
  // A spell plays by casting; leaving Magic drops casting back to a plain attack or skill.
  if (spellOnly && !def.tags.includes('maneuver:casting') && !PLAIN_KINDS.includes(def.type)) setCardKind(def, 'spell');
  else if (!spellOnly && def.tags.includes('maneuver:casting')) setCardKind(def, hasDamageEffect(def) ? 'attack' : 'skill');
}

// The scoring categories the studio card belongs to (ScoreCard's scoring.categories).
function cardCategoriesOf(def) {
  const camp = (def.tags || []).includes('camp:spell') ? 'spell' : 'physical';
  return CardCategories({ type: def.type, tags: def.tags, camp, magicShare: safeNum(def.magicShare, 0) });
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
  return weightChangeCount() > 0 || pendingWeightCount() > 0 || editedCards().length > 0 || artLayersChanged();
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
          pendingScoring: state.pendingScoring,
          pendingBase: state.pendingBase,
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
function saveDraft({ autoName = true } = {}) {
  // Every mutation ends here, so this is where auto-named cards follow edits, weight changes and loads.
  // An edit that asks not to rename (typing a name or card text) passes autoName: false.
  if (autoName !== false) syncAutoNames();
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

const STUDIO_ONLY_FIELDS = ['_edited', '_custom', 'scoringOverride', '_autoName', '_autoNameCore', '_autoNameBudget'];

// ---------------------------------------------------------------------------
// Feature descriptions: what a status, keyword, tag or effect does in play, and how it scores
// ---------------------------------------------------------------------------
// Game text comes from what the game already shows players (status and keyword tooltips, tag blurbs);
// scoring text from the scoring table (weight, why, projection). Nothing here is hand-written copy.
const TAG_INFO = new Map((Array.isArray(registries.tags) ? registries.tags : []).map((tag) => [tag.id, tag]));
const NO_DESCRIPTION = 'No description yet';

function registryEntry(registry, id) {
  try { return registry?.has?.(id) ? registry.get(id) : null; } catch { return null; }
}

function weightText(entry, unit = '') {
  if (!entry) return '';
  const bits = [];
  if (Number.isFinite(entry.flat)) bits.push(`flat ${entry.flat}`);
  if (Number.isFinite(entry.weight) && entry.weight !== 0) bits.push(`${entry.weight}${entry.per ? ` per ${entry.per}` : unit}`);
  if (Number.isFinite(entry.multiplier)) bits.push(`×${entry.multiplier}`);
  if (Number.isFinite(entry.pMultiplier)) bits.push(`×${entry.pMultiplier} of the card's positive score`);
  if (Number.isFinite(entry.perN)) bits.push(`${entry.perN} each`);
  if (entry.conditional) bits.push('conditional');
  return bits.join(', ') || 'no weight';
}

// { title, does, scores, missing } for one feature. kind: 'status' | 'keyword' | 'tag' | 'effect' | 'cost'.
function describeFeature(kind, id) {
  const S = state.scoring;
  let title = id;
  let does = null;
  let entry = null;
  let unit = '';
  if (kind === 'status') {
    const status = registryEntry(registries.statuses, id);
    title = status?.name || capitalise(id);
    does = status?.tooltip || null;
    entry = S.statuses?.[id];
    unit = entry?.target ? ` per stack (${entry.target})` : ' per stack';
  } else if (kind === 'keyword') {
    const keyword = registryEntry(registries.keywords, id);
    title = keyword?.name || capitalise(id);
    does = keyword?.tooltip || null;
    entry = S.keywords?.[id];
  } else if (kind === 'tag') {
    const tag = TAG_INFO.get(id);
    title = S.tags?.[id]?.label || tag?.label || id;
    does = tag?.blurb || null;
    entry = S.tags?.[id];
  } else if (kind === 'effect') {
    const keys = EFFECT_SCORE_KEYS[id];
    title = capitalise(id);
    entry = S.effects?.[keys?.weight || id];
  } else if (kind === 'cost') {
    title = `${id.toUpperCase()} cost`;
    entry = S.costs?.[id];
    unit = ' per point';
  }
  const why = entry?.why || '';
  const scoresParts = [weightText(entry, unit), why && `${why}${entry?.projection ? ` (${entry.projection})` : ''}`].filter(Boolean);
  const scores = entry ? scoresParts.join(' · ') : null;
  return { kind, title, does, scores, missing: !does && !why };
}

function describePartKey(key) {
  const S = state.scoring;
  if (S.statuses?.[key]) return describeFeature('status', key);
  if (S.keywords?.[key]) return describeFeature('keyword', key);
  if (S.tags?.[key]) return describeFeature('tag', key);
  if (key === 'SP' || key === 'MP') return describeFeature('cost', key.toLowerCase());
  const op = Object.keys(EFFECT_SCORE_KEYS).find((candidate) => EFFECT_SCORE_KEYS[candidate].part === key);
  return op ? describeFeature('effect', op) : null;
}

// Statuses, keywords and tags have player text in the game; effects and costs do not, so they get no
// "Does" line rather than a gap.
const KINDS_WITH_GAME_TEXT = new Set(['status', 'keyword', 'tag']);
const showsDoes = (info) => Boolean(info?.does) || KINDS_WITH_GAME_TEXT.has(info?.kind);

// Plain text for a title attribute.
function featureTitleText(info) {
  if (!info) return '';
  return [showsDoes(info) && `Does: ${info.does || NO_DESCRIPTION}`, info.scores && `Scores: ${info.scores}`].filter(Boolean).join('\n');
}

// The ⓘ button and the hidden line it opens, for a row that holds a feature.
function infoButtonHtml() {
  return '<button type="button" class="info-btn" aria-expanded="false" aria-label="What this does">ⓘ</button>';
}
function infoLineHtml(info) {
  if (!info) return '';
  const does = info.does ? esc(info.does) : `<span class="no-desc">${NO_DESCRIPTION}</span>`;
  return `<div class="feature-desc" hidden>${showsDoes(info) ? `<div><strong>Does:</strong> ${does}</div>` : ''}${info.scores ? `<div><strong>Scores:</strong> ${esc(info.scores)}</div>` : ''}</div>`;
}

// One handler for every ⓘ in a container: it opens or closes the line in the same row.
function wireInfoButtons(container, rowSelector) {
  container.addEventListener('click', (e) => {
    const button = e.target.closest('.info-btn');
    if (!button) return;
    e.preventDefault();
    e.stopPropagation();
    const line = button.closest(rowSelector)?.querySelector('.feature-desc');
    if (!line) return;
    line.hidden = !line.hidden;
    button.setAttribute('aria-expanded', String(!line.hidden));
  });
}

function featureValueInfo(value) {
  if (!value) return null;
  const [kind, key] = [value.slice(0, value.indexOf(':')), value.slice(value.indexOf(':') + 1)];
  const map = { effect: 'effect', status: 'status', kw: 'keyword', tag: 'tag' };
  return map[kind] ? describeFeature(map[kind], key) : null;
}

function renderAddFeatureDescription() {
  const line = document.getElementById('add-feature-desc');
  if (!line) return;
  const info = featureValueInfo(document.getElementById('add-feature-select').value);
  if (!info) { line.textContent = ''; return; }
  const doesHtml = info.does ? esc(info.does) : showsDoes(info) ? `<span class="no-desc">${NO_DESCRIPTION}</span>` : '';
  line.innerHTML = `<strong>${esc(info.title)}.</strong> ${doesHtml}${info.scores ? ` <span class="desc-scores">Scores: ${esc(info.scores)}</span>` : ''}`;
}

// ---------------------------------------------------------------------------
// Auto-name: "<Adjective> <core noun> [of <Noun>] <Rank numeral>"
// ---------------------------------------------------------------------------
// The adjective and the "of" noun are data (scoring.naming.card.prefix / .suffix, part key -> word),
// editable in the Weights tab and written into scoring.json on export. Seeded with these defaults.
const DEFAULT_NAME_PREFIX = Object.freeze({
  frail: 'Brittle', vulnerable: 'Exposing', weak: 'Sapping', burn: 'Searing', bleed: 'Serrated', venom: 'Venomous',
  frost: 'Rime', chill: 'Rime', shock: 'Crackling', damage: 'Keen', block: 'Warding', draw: 'Keen-eyed',
  heal: 'Mending', poise: 'Crushing', 'SP restore': 'Second-wind', 'MP restore': 'Draining',
});
const DEFAULT_NAME_SUFFIX = Object.freeze({
  frail: 'Frailty', vulnerable: 'Ruin', weak: 'Weakness', burn: 'Embers', bleed: 'Bleeding', venom: 'Venom',
  frost: 'Winter', chill: 'Winter', shock: 'Storms', damage: 'Might', block: 'the Wall', draw: 'Insight',
  heal: 'Mercy', poise: 'Ruin', 'SP restore': 'Vigor', 'MP restore': 'Mana',
});
const AUTO_NAME_MIN_WORDS = 2;
const AUTO_NAME_SUFFIX_MIN_WORDS = 4;
const NON_NAME_PARTS = new Set(['SP', 'MP', 'effect count', 'HP cost', 'discard']);

// Adds the word tables when a scoring table has none, to both the working and the repo copy so the
// seed itself is not an edit.
function ensureNamingWords(scoringRef) {
  if (!scoringRef) return;
  const card = ((scoringRef.naming ||= clone(shippedScoring.naming || {})).card ||= {});
  card.prefix ||= { ...DEFAULT_NAME_PREFIX };
  card.suffix ||= { ...DEFAULT_NAME_SUFFIX };
}

function romanFor(rank) {
  const roman = state.scoring.naming?.roman || shippedScoring.naming?.roman || [];
  return roman[rank] || '';
}

// A name's words without its rank numeral, upgrade mark or "(Copy)", so a duplicate keeps its source's noun.
function nameWords(name) {
  return String(name || '').trim().split(/\s+/).filter((word) => word && !/^[IVXLC]+$/.test(word) && !/^\+\d+$/.test(word) && !/^\(Copy\)$/i.test(word));
}

function nameParts(def, sc = scoreCardEntry(def)) {
  try {
    return CardNameParts(sc.face, 0, state.scoring.naming ? state.scoring : { ...state.scoring, naming: shippedScoring.naming });
  } catch {
    return { name: def.name, effect: null, base: null, rank: sc.rank, source: null };
  }
}

// Turning Auto-name on keeps the card's own noun and length: Acid Splash stays a "... Splash".
function startAutoName(def) {
  const words = nameWords(def.name);
  def._autoNameCore = def._custom && /^New Custom Card$/.test(def.name) ? '' : (words[words.length - 1] || '');
  def._autoNameBudget = Math.max(AUTO_NAME_MIN_WORDS, words.length);
}

// The title box of a card face and the smallest font its fitter will use, measured once from a rendered
// card (every illustrated card shares the frame). A candidate fits when it fits at that smallest font.
let titleMetric = null;
function measureTitleMetric() {
  if (titleMetric) return titleMetric;
  const node = document.querySelector('.studio-card-stage [data-card-binding="name"], #inspector-card-preview [data-card-binding="name"]');
  const face = node?.closest('.illustrated-card-face');
  if (!node || !face || !node.clientWidth) return null;
  const scale = face.clientWidth / Number(face.dataset.designWidth || face.clientWidth);
  const style = getComputedStyle(node);
  titleMetric = {
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    minFontPx: Number(node.dataset.minFont || parseFloat(style.fontSize) / scale) * scale,
    boxPx: node.clientWidth,
  };
  return titleMetric;
}

let measureCanvas = null;
function titleFits(text) {
  const metric = measureTitleMetric();
  if (!metric) return true;
  measureCanvas ||= document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  ctx.font = `${metric.fontWeight} ${metric.minFontPx}px ${metric.fontFamily}`;
  return ctx.measureText(text).width <= metric.boxPx;
}

function wordFor(table, key) {
  return state.scoring.naming?.card?.[table]?.[key] || null;
}

// The name Auto-name gives a card now.
function autoNameFor(def, sc = scoreCardEntry(def)) {
  const parts = nameParts(def, sc);
  const ranked = Object.entries(sc.parts || {})
    .filter(([key, value]) => value > 0 && !NON_NAME_PARTS.has(key))
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);
  const adjectiveKey = parts.source && parts.source !== 'fallback' ? parts.source : ranked[0];
  const adjective = (adjectiveKey && wordFor('prefix', adjectiveKey)) || parts.effect || null;
  const suffixKey = ranked.find((key) => key !== adjectiveKey && wordFor('suffix', key));
  const suffix = suffixKey ? wordFor('suffix', suffixKey) : null;
  const core = def._autoNameCore || parts.base || 'Card';
  const numeral = romanFor(sc.rank);
  const withNumeral = (words) => [...words, numeral].filter(Boolean).join(' ');
  const budget = Math.max(AUTO_NAME_MIN_WORDS, def._autoNameBudget || AUTO_NAME_MIN_WORDS);
  const candidates = [];
  if (adjective && suffix && budget >= AUTO_NAME_SUFFIX_MIN_WORDS) candidates.push(withNumeral([adjective, core, 'of', suffix]));
  if (adjective) candidates.push(withNumeral([adjective, core]));
  candidates.push(withNumeral([core]));
  // Measure, don't count: drop the suffix, then the adjective, until the title fits. The numeral stays.
  return candidates.find((candidate) => titleFits(candidate)) || candidates[candidates.length - 1];
}

// Renames every auto-named card whose name has moved. Runs after every mutation (from saveDraft and
// mutateSelectedCard), so weight changes, slot loads and uploads rename too, inside the same undo step.
function syncAutoNames({ render = true } = {}) {
  const renamed = [];
  for (const def of state.cards) {
    if (!def._autoName) continue;
    const name = autoNameFor(def);
    if (name === def.name) continue;
    def.name = name;
    renamed.push(def);
  }
  if (!render || !renamed.length) return renamed;
  for (const def of renamed) updateCardTileInPlace(def.id);
  const selected = selectedCardDef();
  if (selected && renamed.includes(selected)) {
    const nameInput = document.getElementById('edit-name');
    if (document.activeElement !== nameInput) nameInput.value = selected.name;
    document.getElementById('inspector-sheet-title').textContent = selected.name;
    renderCardWithLayers(selected, document.getElementById('inspector-card-preview'));
    renderNameHint(selected);
  }
  return renamed;
}

// The muted line under Name: what the name is built from.
function renderNameHint(def, sc = scoreCardEntry(def)) {
  const hint = document.getElementById('name-hint');
  if (!hint) return;
  const parts = nameParts(def, sc);
  const source = parts.source && parts.source !== 'fallback' ? parts.source : 'no main effect';
  hint.textContent = `From ${source} · ${def._autoNameCore || parts.base || 'Card'} · ${RankName(sc.rank)}`;
}

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

// ---------------------------------------------------------------------------
// Face numbers: the amount box holds the card's own number
// ---------------------------------------------------------------------------
// The profile's balance settings (effects.baseDamageMultiplier, physical and player scales, Block gain)
// turn an authored amount into a smaller printed one: Core prints 12 authored damage as 5. The studio
// edits that printed number and stores the authored amount that prints it.
// Owner 2026-11-24: the box is the card's own number, before the hero's bonus. The reference hero's
// attributes and always-on gear (a Starseer's INT and focus) made Arcane Spark print 3 at any amount up
// to 1, so 0, 1 and 2 could not be typed. The card face still shows the hero's total.
const FACE_AMOUNT_SEARCH_MAX = 999;

// The reference run with no hero bonus: no attributes, no always-on gear.
function cardOwnFaceRules(def) {
  return { ...refContextFor(def).run, faceAttributes: {}, gearRules: [] };
}

function faceAmountFor(def, effectIndex) {
  const binding = computeTokenBindings(def.effects || []).find((b) => b.index === effectIndex && b.field === 'amount');
  if (!binding) return null;
  try {
    const value = staticCardTokens(projectEditedCard(def), studioRegistries, cardOwnFaceRules(def))[binding.token];
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function faceAmountAt(def, effectIndex, amount) {
  const trial = clone(def);
  trial.effects[effectIndex].amount = amount;
  return faceAmountFor(trial, effectIndex);
}

// The smallest authored amount whose printed number reaches the typed one (the print only rises with the
// amount). When rounding skips the typed number, the nearer of the two neighbours wins.
function authoredAmountForFace(def, effectIndex, wanted) {
  if (faceAmountAt(def, effectIndex, wanted) === null) return wanted;
  let low = 0;
  let high = FACE_AMOUNT_SEARCH_MAX;
  if (faceAmountAt(def, effectIndex, high) < wanted) return high;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (faceAmountAt(def, effectIndex, middle) >= wanted) high = middle;
    else low = middle + 1;
  }
  if (low === 0) return low;
  const above = faceAmountAt(def, effectIndex, low);
  const below = faceAmountAt(def, effectIndex, low - 1);
  return wanted - below < above - wanted ? low - 1 : low;
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

// The other half of appendClauseForFeature: removing an effect drops each sentence of the card text whose
// {tokens} the card no longer has any of, so a removed Frail stops showing on the face. A sentence that
// still names a live token stays, and its stale token is flagged under the text box instead.
function dropStaleTextClauses(def) {
  const stale = new Set(staleTextTokens(def));
  if (!stale.size) return;
  const sentences = (def.textTemplate || '').split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((sentence) => {
    const tokens = [...sentence.matchAll(tokenRe())].map((match) => match[1]);
    return !tokens.length || tokens.some((token) => !stale.has(token));
  });
  def.textTemplate = kept.join(' ').trim();
}

// One card face path for the gallery, inspector, Art preview and sandbox hand: the card under its live id
// (so edits reach the face and the engine), projected the way the game projects profile cards, drawn under
// its class's reference run, then fitted.
// The card's combat-power rank as a small badge on the art (the game's face has no rank). Studio only.
// Colour shows the move against the repo baseline: up green, down red, unchanged neutral.
function studioCardFor(def) {
  const id = String(def.id || '').startsWith(LIVE_ID_PREFIX) ? def.id.slice(LIVE_ID_PREFIX.length) : def.id;
  return state.cards.find((c) => c.id === id) || def;
}

function rankBadgeParts(def, sc) {
  const card = studioCardFor(def);
  const score = sc || scoreCardEntry(card);
  const base = state.baselineRanks[card.id];
  const shift = base === undefined || base === score.rank ? 'same' : score.rank > base ? 'up' : 'down';
  return {
    // naming.roman stops at X; a rank past it (Max Rank raised in Weights) shows as its number.
    text: romanFor(score.rank) || (score.rank ? String(score.rank) : 'U'),
    title: `${RankName(score.rank)} · CP ${score.cp}${shift === 'same' ? '' : ` (was ${RankName(base)})`}`,
    shift,
  };
}

function setRankBadge(container, def, sc = null) {
  let badge = container.querySelector(':scope > .studio-rank-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'studio-rank-badge';
    container.appendChild(badge);
  }
  try {
    const parts = rankBadgeParts(def, sc);
    badge.textContent = parts.text;
    badge.title = parts.title;
    badge.dataset.shift = parts.shift;
  } catch {
    badge.remove();
  }
}

function renderCardWithLayers(def, container, sc = null) {
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
  setRankBadge(container, def, sc);
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
  renderCardWithLayers(def, tile.querySelector('.studio-card-stage'), sc);
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
    renderCardWithLayers(def, tile.querySelector('.studio-card-stage'), sc);
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
  addFeatureGroups = groups;
  renderAddFeatureOptions();
}

// The full Add Feature list, kept so the search box can rebuild the select with only the matches.
let addFeatureGroups = {};

// Every word a search can match: the label, the id, and the feature's description and score text.
function addFeatureSearchText(value, label) {
  return `${label} ${value} ${featureTitleText(featureValueInfo(value))}`.toLowerCase();
}

// Rebuild the select from the search box: each search word must appear in the option's text. A search with
// matches picks the first, so its description shows and Add (or Enter) adds it.
function renderAddFeatureOptions({ pickBest = false } = {}) {
  const sel = document.getElementById('add-feature-select');
  const search = document.getElementById('add-feature-search');
  const words = (search?.value || '').toLowerCase().split(/\s+/).filter(Boolean);
  const previous = sel.value;
  let total = 0;
  let matched = 0;
  sel.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  sel.appendChild(placeholder);
  for (const [label, opts] of Object.entries(addFeatureGroups)) {
    total += opts.length;
    // Name or id matches list first, then matches found only in the description.
    const named = ([val, text]) => words.every((word) => `${text} ${val}`.toLowerCase().includes(word));
    const hits = words.length ? opts.filter(([val, text]) => {
      const haystack = addFeatureSearchText(val, text);
      return words.every((word) => haystack.includes(word));
    }).sort((a, b) => Number(named(b)) - Number(named(a))) : opts;
    if (!hits.length) continue;
    matched += hits.length;
    const og = document.createElement('optgroup');
    og.label = label;
    for (const [val, text] of hits) {
      const o = document.createElement('option');
      o.value = val;
      o.textContent = text;
      og.appendChild(o);
    }
    sel.appendChild(og);
  }
  placeholder.textContent = !words.length ? '+ Add Feature...' : matched ? `${matched} match${matched === 1 ? '' : 'es'}` : 'No match';
  if (search) search.placeholder = `Search ${total} features`;
  const options = [...sel.querySelectorAll('optgroup option')];
  // A rebuild that is not a new search (a rescore, undo, import) keeps the owner's pick while it is still listed.
  if (!pickBest || !words.length) {
    sel.value = options.some((o) => o.value === previous) ? previous : '';
    return;
  }
  // A new search picks its best match: the first name match in any group, else the first description match.
  const best = options.find((o) => words.every((word) => `${o.textContent} ${o.value}`.toLowerCase().includes(word))) || options[0];
  sel.value = best ? best.value : '';
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
  document.getElementById('toggle-auto-name').checked = Boolean(def._autoName);
  renderNameHint(def, sc);
  document.getElementById('btn-delete-card').classList.toggle('hidden', !def._custom);
  document.getElementById('btn-reset-card').classList.toggle('hidden', !def._edited || Boolean(def._custom));
  const textInput = document.getElementById('edit-text');
  if (textInput.value !== (def.textTemplate || '')) textInput.value = def.textTemplate || '';
  renderTextWarnings(def);
  document.getElementById('edit-type').value = cardKindOf(def);
  document.getElementById('edit-class').value = def.class || 'colorless';
  document.getElementById('edit-rarity').value = def.rarity || 'common';
  const schools = cardSchoolsOf(def);
  document.getElementById('edit-martial').checked = schools.martial;
  document.getElementById('edit-magic').checked = schools.magic;
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
  const chips = featureScoreChips(featureScoreRows(def, sc.face), sc.parts || {});
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
        <span class="feature-label" title="${esc(featureTitleText(describeFeature('status', eff.status)))}">Status: <strong>${esc(eff.status)}</strong> ${infoButtonHtml()}</span>
        <div class="feature-controls">
          ${chipFor()}
          ${stacksCtrl}
          <select data-eff-target="${idx}">
            <option value="enemy" ${eff.target !== 'self' ? 'selected' : ''}>Enemy</option>
            <option value="self" ${eff.target === 'self' ? 'selected' : ''}>Self</option>
          </select>
          <button class="s-btn s-btn-sm" data-rm-eff="${idx}">×</button>
        </div>
        ${infoLineHtml(describeFeature('status', eff.status))}`;
    } else {
      const amtIsNum = eff.amount == null || (typeof eff.amount === 'number' && Number.isFinite(eff.amount));
      const amtCtrl = amtIsNum
        ? `<input type="number" min="0" max="99" value="${esc(faceAmountFor(def, idx) ?? safeNum(eff.amount, 1))}" data-eff-amt="${idx}" title="The card's own number, before the hero's bonus" />`
        : '<span class="studio-muted" title="Formula-computed value">formula</span>';
      row.innerHTML = `
        <span class="feature-label" title="${esc(featureTitleText(describeFeature('effect', eff.op)))}">Effect: <strong>${esc(eff.op)}</strong> ${infoButtonHtml()}</span>
        <div class="feature-controls">
          ${chipFor()}
          ${amtCtrl}
          <button class="s-btn s-btn-sm" data-rm-eff="${idx}">×</button>
        </div>
        ${infoLineHtml(describeFeature('effect', eff.op))}`;
    }
    list.appendChild(row);
  });

  (def.keywords || []).forEach((kw, idx) => {
    const row = document.createElement('div');
    row.className = 'feature-row';
    const w = state.scoring.keywords?.[kw];
    const note = w ? (w.flat !== undefined ? `${w.flat}` : `×${w.multiplier}`) : '';
    const info = describeFeature('keyword', kw);
    row.innerHTML = `<span class="feature-label" title="${esc(featureTitleText(info))}">Keyword: <strong>${esc(kw)}</strong> <span class="studio-muted">${esc(note)}</span> ${infoButtonHtml()}</span><div class="feature-controls">${chipFor()}<button class="s-btn s-btn-sm" data-rm-kw="${idx}">×</button></div>${infoLineHtml(info)}`;
    list.appendChild(row);
  });

  shownTagsOf(def).forEach((tag) => {
    const row = document.createElement('div');
    row.className = 'feature-row';
    const info = describeFeature('tag', tag);
    row.innerHTML = `<span class="feature-label" title="${esc(featureTitleText(info))}">Tag: <strong>${esc(tag)}</strong> ${infoButtonHtml()}</span><div class="feature-controls">${chipFor()}<button class="s-btn s-btn-sm" data-rm-tag="${esc(tag)}">×</button></div>${infoLineHtml(info)}`;
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

// Score parts whose amount the reference fight measures with the hero's bonus, and the face field holding it.
const HERO_SCORED_COUNTS = Object.freeze({ damage: 'dmg', block: 'blk' });

// One entry per Active Features row, in render order: which part it feeds and how to explain it.
// `face` (the scored face) lets the damage and Block chips explain the hero's total behind their score.
function featureScoreRows(def, face = null) {
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
    const amount = faceAmountFor(def, def.effects.indexOf(eff)) ?? eff.amount ?? 1;
    const counted = eff.op === 'removeStatus' && eff.target !== 'self' ? 0 : COUNTED_ONCE_OPS.has(eff.op) ? 1 : amount * (eff.op === 'damage' ? (eff.hits || 1) : 1);
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
  // The count is the card's own number; the score reads the fight's number, hero's bonus included.
  if (face) {
    for (const [part, scored] of Object.entries(HERO_SCORED_COUNTS)) {
      const first = rows.find((r) => r.part === part);
      if (first && Number.isFinite(face[scored])) first.scoredCount = face[scored];
    }
  }
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
  const ownCount = sameRows.reduce((sum, r) => sum + r.count, 0);
  const count = row.scoredCount ?? ownCount;
  const expected = row.scoredCount !== undefined
    ? row.sign * row.unitWeight * count / row.per
    : sameRows.reduce((sum, r) => sum + r.sign * r.unitWeight * r.count / r.per, 0);
  const capped = row.capAt && count > row.capAt;
  const adjusted = Math.abs(expected - total) > SCORE_MATCH_TOLERANCE;
  const note = capped ? ' (capped)' : adjusted ? ' (adjusted by targeting)' : '';
  const heroNote = count !== ownCount ? ` (${ownCount} on the card, ${count} with the hero's bonus)` : '';
  return `${row.unitWeight} per ${row.per} × ${count} = ${totalText}${note}${heroNote}`;
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

const TARGET_LABELS = Object.freeze({
  enemy: 'Single enemy',
  allEnemies: 'All enemies',
  randomEnemy: 'Random enemy',
  self: 'Self',
  ally: 'Ally',
  allAllies: 'All allies',
});
const NO_SCORE_EFFECT_TITLE = "Doesn't change the score; used for naming and rewards";

function rarityDiscount(rarity, scoringRef = state.scoring) {
  // Same lookup as CombatPower: rarity.discount wins over items.rarityDiscount.
  const discounts = { ...(scoringRef.items?.rarityDiscount || {}), ...(scoringRef.rarity?.discount || {}) };
  return safeNum(discounts[rarity], 0);
}

// How much one property of the card moves its raw score: rescore a copy with that property set to a
// neutral value and take the difference. Zero means ScoreCard does not read it.
function rawScoreDelta(face, neutralize) {
  const neutral = { ...face, tags: [...face.tags], kw: [...face.kw], statuses: face.statuses.map((s) => [...s]) };
  neutralize(neutral);
  return ScoreCard(face, state.scoring).raw - ScoreCard(neutral, state.scoring).raw;
}

function breakdownPill(text, value, title) {
  const tone = value === null ? 'zero' : value > 0 ? 'pos' : value < 0 ? 'neg' : 'zero';
  return `<span class="part-pill ${tone}" title="${esc(title || '')}">${esc(text)}</span>`;
}

function signedDelta(value) {
  return value === 0 ? '±0' : formatScore(value);
}

// The Card row: rarity, targeting and the properties that do (or do not) move the score.
// What each card property does to the score. One source for the Score Breakdown "Card" row and the
// weight chips beside the Card Basics fields, so the two always show the same numbers.
// field: the Card Basics field it belongs to; value: signed effect on the score; count: "×N" targets.
function cardPropertyScores(def, sc) {
  const S = state.scoring;
  const face = sc.face;
  const discount = rarityDiscount(sc.rarity);
  const rows = [{
    field: 'rarity',
    label: capitalise(sc.rarity),
    value: discount ? -discount : 0,
    text: `−${discount}`,
    title: `Rarity discount: CP = raw − ${discount}`,
  }];

  const target = getCardTarget(def);
  const areaTag = S.cardModel?.areaTag || 'targeting:area';
  const isArea = face.tags.includes(areaTag);
  const targetDelta = rawScoreDelta(face, (neutral) => {
    neutral.tags = neutral.tags.filter((t) => !t.startsWith('targeting:') && !t.startsWith('targeting.'));
    neutral.tags.push('targeting:single');
  });
  rows.push({
    field: 'target',
    label: TARGET_LABELS[target] || capitalise(target),
    count: isArea ? S.model?.ENEMIES ?? 2 : null,
    value: targetDelta,
    text: signedDelta(targetDelta),
    title: targetDelta ? 'Change against the same card hitting a single enemy' : 'Scores the same as hitting a single enemy',
  });

  const categories = CardCategories(face);
  const neutralProperties = [
    ['class', capitalise(face.cls), (neutral) => { neutral.cls = 'colorless'; }],
    ['type', capitalise(categories.at(-1)), (neutral) => { neutral.type = 'skill'; neutral.categories = [...categories.slice(0, -1), 'skill']; }],
    ['camp', categories.filter((c) => c === 'martial' || c === 'magic').map(capitalise).join(' + '), (neutral) => {
      neutral.camp = 'physical';
      neutral.magicShare = 0;
      neutral.categories = ['martial', ...categories.filter((c) => !SCHOOL_CATEGORIES.includes(c))];
    }],
  ];
  for (const [field, label, neutralize] of neutralProperties) {
    const delta = rawScoreDelta(face, neutralize);
    rows.push({ field, label, value: delta, text: signedDelta(delta), title: delta ? 'Change against the neutral choice' : NO_SCORE_EFFECT_TITLE });
  }
  return rows;
}

function cardBreakdownPills(def, sc, propertyScores = cardPropertyScores(def, sc)) {
  const pills = propertyScores.map((row) => breakdownPill(`${row.label}${row.count ? ` ×${row.count}` : ''} ${row.text}`, row.value, row.title));
  if (sc.overridden) pills.push(breakdownPill(`Override → ${RankName(sc.rank)} / CP ${sc.cp}`, null, 'A scoring override sets this card\'s rank or CP'));
  return pills.join('');
}

// Weight chips beside Rarity, Target, Camp, Card Type and Class, in the cost chips' style.
function renderFieldChips(def, sc, propertyScores = cardPropertyScores(def, sc)) {
  for (const row of propertyScores) {
    const el = document.getElementById(`field-score-${row.field}`);
    if (!el) continue;
    const tone = row.value > 0 ? 'is-pos' : row.value < 0 ? 'is-neg' : 'is-zero';
    const countHtml = row.count ? `<span class="feature-count">×${esc(row.count)}</span>` : '';
    el.className = `feature-score ${tone}`;
    el.title = `${row.label}: ${row.text}. ${row.title}`;
    el.innerHTML = `${countHtml}<span class="feature-total">${esc(row.text)}</span>`;
  }
}

function renderScoreParts(def, sc) {
  const partsEl = document.getElementById('score-parts-list');
  const propertyScores = cardPropertyScores(def, sc);
  renderFieldChips(def, sc, propertyScores);
  const baseRank = state.baselineRanks[def.id];
  const shifted = baseRank !== undefined && baseRank !== sc.rank;
  const discount = rarityDiscount(sc.rarity);
  const raw = ScoreCard(sc.face, state.scoring).raw;
  const baseCp = raw - discount;
  const rankTitle = `${actForRank(sc.rank)}${shifted ? ` (was ${RankName(baseRank)})` : ''}`;
  const partPills = Object.entries(sc.parts || {})
    .map(([k, v]) => breakdownPill(`${k}: ${formatScore(v)}`, Math.round(v * 10) / 10, featureTitleText(describePartKey(k))))
    .join('');
  const formula = `Raw ${raw} − rarity ${discount} = CP ${baseCp} → ${RankName(RankOf(baseCp, state.scoring))}`
    + (sc.overridden ? `; override → CP ${sc.cp}, ${RankName(sc.rank)}` : '');
  partsEl.innerHTML = `
    <span class="part-pill rank-pill" title="${esc(rankTitle)}">Rank: ${esc(RankName(sc.rank))} (CP ${esc(sc.cp)})${shifted ? ` (was ${esc(RankName(baseRank))})` : ''}</span>
    <div class="breakdown-row" data-breakdown="card"><span class="breakdown-label">Card</span>${cardBreakdownPills(def, sc, propertyScores)}</div>
    <div class="breakdown-row" data-breakdown="parts"><span class="breakdown-label">Parts</span>${partPills || '<span class="studio-muted">None</span>'}</div>
    <div class="breakdown-formula" id="breakdown-formula">${esc(formula)}</div>
    <details class="breakdown-math"><summary>Math</summary>${scoreMathTableHtml(sc)}</details>`;
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
    if (k.startsWith('category:')) { const w = S.categories?.[k.slice(9)]; return w?.multiplier ? `×${w.weight} of positive score` : `${capitalise(k.slice(9))} flat`; }
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

// A plain text written from the card's effects. Used by "Write from effects" and, while the card text's
// Auto toggle is on, after every feature edit; with Auto off the card text is the designer's own.
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
  setRankBadge(document.getElementById('inspector-card-preview'), def, sc);
  renderScoreSummary(def, sc);
  renderScoreParts(def, sc);
  renderCostChips(def, sc);
  const chips = featureScoreChips(featureScoreRows(def, sc.face), sc.parts || {});
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
  applyAutoText(def);
  refreshInspectorScoreInPlace(def);
  saveDraft();
}

// Card text Auto: while on, every feature edit rewrites the card text from its effects, the way Auto
// renames the card. Typing in the text box turns it off, so the designer's own words are never overwritten.
const AUTO_TEXT_KEY = 'ashenspire:scoreStudioAutoText:v1';
const isAutoText = () => Boolean(document.getElementById('toggle-auto-text')?.checked);

function applyAutoText(def) {
  if (!isAutoText()) return;
  def.textTemplate = textFromEffects(def);
  const textInput = document.getElementById('edit-text');
  if (textInput && document.activeElement !== textInput) textInput.value = def.textTemplate;
}

// Refreshes what sits outside the feature list once a number edit is committed.
function commitLiveCardEdit() {
  const def = selectedCardDef();
  if (!def) return;
  renderCardWithLayers(def, document.getElementById('inspector-card-preview'));
  updateCardTileInPlace(def.id);
  computeShiftCount();
}

function mutateSelectedCard(fn, { recordHistory = true, autoName = true, autoText = true } = {}) {
  const def = selectedCardDef();
  if (!def) return;
  if (recordHistory) pushHistory();
  fn(def);
  def._edited = true;
  // Auto text and Auto-name run in the same step as the edit, so one undo reverts all three.
  if (autoText) applyAutoText(def);
  if (autoName) syncAutoNames({ render: false });
  // Targeted update: refresh only the inspector and this one card tile.
  renderInspector();
  updateCardTileInPlace(def.id);
  computeShiftCount();
  saveDraft({ autoName });
}

// ---------------------------------------------------------------------------
// Weights Tab
// ---------------------------------------------------------------------------
// Rows show the pending copy when weight edits are staged; a row whose value differs from the applied
// config is marked pending. `shifts: false` skips rescoring every card for the rank-shift summary.
function renderWeights({ shifts = true } = {}) {
  const q = document.getElementById('weights-search').value.trim().toLowerCase();
  const groupF = document.getElementById('weights-group-filter').value;
  const container = document.getElementById('weights-container');
  container.innerHTML = '';

  const R = state.repoScoring;
  const buildGroups = () => [
    { key: 'costs', title: 'Costs (SP / MP)', entries: Object.entries(state.scoring.costs || {}).map(([k, v]) => ({ id: k, label: k.toUpperCase(), val: v.weight, base: R.costs?.[k]?.weight, set: (n) => { state.scoring.costs[k].weight = n; } })) },
    { key: 'effects', title: 'Effects', entries: Object.entries(state.scoring.effects || {}).map(([k, v]) => ({
      id: k, label: k, val: v.weight, base: R.effects?.[k]?.weight, set: (n) => { state.scoring.effects[k].weight = n; },
      per: { value: v.per, base: R.effects?.[k]?.per, set: (n) => { state.scoring.effects[k].per = n; } },
    })) },
    { key: 'statuses', title: 'Statuses', entries: Object.entries(state.scoring.statuses || {}).map(([k, v]) => ({ id: k, label: `${k} (${v.target})`, val: v.weight, base: R.statuses?.[k]?.weight, set: (n) => { state.scoring.statuses[k].weight = n; } })) },
    { key: 'keywords', title: 'Keywords', entries: Object.entries(state.scoring.keywords || {}).map(([k, v]) => ({ id: k, label: k + (v.flat !== undefined ? ' (flat)' : ' (mult)'), val: v.flat ?? v.multiplier, base: R.keywords?.[k]?.flat ?? R.keywords?.[k]?.multiplier, step: v.flat !== undefined ? 1 : 0.05, set: (n) => { if (v.flat !== undefined) state.scoring.keywords[k].flat = n; else state.scoring.keywords[k].multiplier = n; } })) },
    { key: 'rarity', title: 'Rarity Discounts', entries: Object.entries(state.scoring.rarity?.discount || {}).map(([k, v]) => ({ id: k, label: k, val: v, base: R.rarity?.discount?.[k], set: (n) => { state.scoring.rarity.discount[k] = n; } })) },
    { key: 'rank', title: 'Rank Bands', entries: [
      { id: 'unrankedMax', label: 'Unranked Max CP', val: state.scoring.rank.unrankedMax, base: R.rank?.unrankedMax, set: (n) => { state.scoring.rank.unrankedMax = n; } },
      { id: 'width', label: 'Band Width', val: state.scoring.rank.width, base: R.rank?.width, set: (n) => { state.scoring.rank.width = Math.max(1, n); } },
      { id: 'maxRank', label: 'Max Rank', val: state.scoring.rank.maxRank, base: R.rank?.maxRank, set: (n) => { state.scoring.rank.maxRank = Math.max(1, Math.round(n)); } },
      { id: 'effectCount', label: 'Multi-Effect Bonus', val: state.scoring.effectCount?.weight ?? 5, base: R.effectCount?.weight ?? 5, set: (n) => { (state.scoring.effectCount ||= {}).weight = n; } },
    ] },
    { key: 'categories', title: 'Categories', entries: CATEGORY_KEYS.map((k) => {
      const v = categoryWeight(state.scoring, k);
      const bv = R.categories?.[k];
      return {
        id: k,
        label: k === 'hybrid' ? 'Hybrid (Martial + Magic)' : capitalise(k),
        val: v.weight,
        base: bv?.weight,
        step: v.multiplier ? 0.05 : 1,
        set: (n) => { categoryWeight(state.scoring, k).weight = n; },
        // Flat adds the weight; multiplier scales the positive score by it. Switching resets to the no-change value.
        mult: { value: Boolean(v.multiplier), base: bv ? Boolean(bv.multiplier) : undefined, set: (on) => { Object.assign(categoryWeight(state.scoring, k), { multiplier: on, weight: on ? 1 : 0 }); } },
      };
    }) },
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
        // Damage-type tags score once per action or once per hit (ScoreCard reads per === 'hit').
        per: v.per !== undefined ? { value: v.per, base: bv?.per, options: TAG_PER_OPTIONS, set: (n) => { state.scoring.tags[k].per = n; } } : null,
      };
    }) },
  ];
  // Built from the applied config (to mark pending rows) and from the config Apply would produce.
  const appliedGroups = buildGroups();
  const staged = stagedScoring();
  const groups = staged ? withScoring(staged, buildGroups) : appliedGroups;
  const entryIn = (groupList, groupKey, id) => groupList.find((eg) => eg.key === groupKey)?.entries.find((e) => e.id === id);

  for (const g of groups) {
    if (groupF !== 'all' && g.key !== groupF) continue;
    const rows = g.entries.filter((e) => !q || `${g.title} ${e.id} ${e.label}`.toLowerCase().includes(q));
    if (!rows.length) continue;
    const card = document.createElement('details');
    card.className = 'weight-group-card studio-section';
    card.dataset.section = `weights-${g.key}`;
    card.open = true;
    card.innerHTML = `<summary class="section-head"><h3>${esc(g.title)}</h3></summary>`;
    rememberSection(card);
    wireInfoButtons(card, '.weight-row');
    for (const r of rows) {
      const numVal = safeNum(r.val, 0);
      const baseNum = r.base !== undefined ? safeNum(r.base, 0) : undefined;
      const applied = entryIn(appliedGroups, g.key, r.id);
      const row = document.createElement('div');
      row.className = 'weight-row' + (r.per || r.mult ? ' has-per' : '');
      const kind = WEIGHT_GROUP_KINDS[g.key];
      const info = kind ? describeFeature(kind, r.id) : null;
      const labelHtml = info
        ? `<span class="feature-label" title="${esc(featureTitleText(info))}">${esc(r.label)} ${infoButtonHtml()}</span>`
        : `<span>${esc(r.label)}</span>`;
      const resetTitle = `Reset to ${baseNum ?? numVal}${r.per ? ` per ${r.per.base ?? r.per.value}` : ''}`;
      // The row reads as a sentence: "[1] pts per [3] damage", with a worked example under it.
      const shownScoring = () => stagedScoring() || state.scoring;
      const words = weightSentence(g.key, r.id, shownScoring(), r.label);
      const weightBox = `<input type="number" class="weight-input" step="${esc(safeNum(r.step, 1))}" value="${esc(numVal)}" aria-label="${esc(`${r.label} points`)}" />`;
      row.innerHTML = `${labelHtml}<span class="weight-sentence"><span class="weight-words" data-part="before">${esc(words.before)}</span>${weightBox}<span class="weight-words" data-part="mid">${esc(words.mid)}</span>${perControlHtml(r)}<span class="weight-words" data-part="after">${esc(words.after)}</span>${multControlHtml(r)}<button type="button" class="weight-reset-btn" title="${esc(resetTitle)}">↺</button></span><div class="weight-example"></div>`;
      const input = row.querySelector('.weight-input');
      const perInput = row.querySelector('.weight-per');
      const multInput = row.querySelector('.weight-mult');
      const resetBtn = row.querySelector('.weight-reset-btn');
      const exampleEl = row.querySelector('.weight-example');
      // The example follows the boxes as they are typed in: a copy of the shown config with the boxes' values set.
      const typedScoring = () => {
        const typed = clone(shownScoring());
        withScoring(typed, () => {
          const value = Number(input.value);
          if (input.value !== '' && Number.isFinite(value)) r.set(value);
          if (r.per && perInput && !r.per.options) {
            const per = Math.round(Number(perInput.value));
            if (Number.isFinite(per) && per >= 1) r.per.set(per);
          }
        });
        return typed;
      };
      const showExample = (scoring = shownScoring()) => {
        const now = weightSentence(g.key, r.id, scoring, r.label);
        for (const part of row.querySelectorAll('.weight-sentence > .weight-words')) part.textContent = now[part.dataset.part];
        exampleEl.textContent = weightExample(g.key, r.id, scoring, r.label);
      };
      showExample();
      input.addEventListener('input', () => showExample(typedScoring()));
      if (perInput && !r.per.options) perInput.addEventListener('input', () => showExample(typedScoring()));
      // Staged edits update this row's marks in place, so focus and scroll stay where the owner left them.
      const perNow = () => (r.per.options ? perInput.value : Number(perInput.value));
      const perDiffers = (other) => Boolean(r.per) && other !== undefined && perNow() !== other;
      const multDiffers = (other) => Boolean(multInput) && other !== undefined && multInput.checked !== other;
      const markRow = () => {
        const value = Number(input.value);
        const modified = (baseNum !== undefined && value !== baseNum) || perDiffers(r.per?.base) || multDiffers(r.mult?.base);
        const pending = !applied || value !== safeNum(applied.val, 0) || perDiffers(applied.per?.value) || multDiffers(applied.mult?.value);
        row.classList.toggle('is-modified', modified);
        row.classList.toggle('is-pending', pending);
        row.title = pending ? 'Staged: Apply to rescore the cards' : '';
        resetBtn.classList.toggle('is-clean', !modified);
      };
      // After an edit the row shows what its setter stored (Band Width 0 is stored as 1), then re-marks.
      const showStored = () => {
        const stored = entryIn(withScoring(stagedScoring() || state.scoring, buildGroups), g.key, r.id);
        if (stored) input.value = String(safeNum(stored.val, 0));
        if (stored?.per && perInput) perInput.value = String(stored.per.value);
        if (stored?.mult && multInput) multInput.checked = stored.mult.value;
        markRow();
        showExample();
      };
      markRow();
      input.addEventListener('change', () => {
        const n = Number(input.value);
        if (!Number.isFinite(n)) return;
        applyWeightEdit(() => r.set(n));
        showStored();
      });
      perInput?.addEventListener('change', () => {
        const next = r.per.options ? perInput.value : Math.max(1, Math.round(Number(perInput.value)));
        if (!r.per.options && !Number.isFinite(next)) return;
        applyWeightEdit(() => r.per.set(next));
        showStored();
      });
      multInput?.addEventListener('change', () => {
        applyWeightEdit(() => r.mult.set(multInput.checked));
        showStored();
      });
      resetBtn.addEventListener('click', () => {
        const perChanged = perDiffers(r.per?.base) || multDiffers(r.mult?.base);
        if (baseNum === undefined && !perChanged) return;
        // Read the row's live controls: staged edits do not redraw it, so r.per / r.mult values can be stale.
        const resetMult = multDiffers(r.mult?.base);
        const resetPer = perDiffers(r.per?.base);
        applyWeightEdit(() => {
          if (resetMult) r.mult.set(r.mult.base);
          if (baseNum !== undefined) r.set(baseNum);
          if (resetPer) r.per.set(r.per.base);
        });
        showStored();
      });
      if (info) row.insertAdjacentHTML('beforeend', infoLineHtml(info));
      card.appendChild(row);
    }
    container.appendChild(card);
  }
  if (groupF === 'all' || groupF === 'naming') renderNamingWordsGroup(container, q);
  renderDescriptionGaps();
  updateWeightsToolbar();
  if (shifts) computeShiftCount();
}

// Score categories (ScoreCard's scoring.categories): Martial, Magic and each Card Type.
const CATEGORY_KEYS = Object.freeze([...SCHOOL_CATEGORIES, ...CARD_KINDS]);

function categoryWeight(scoring, key) {
  scoring.categories ||= {};
  // A category the table lacks starts at the repo's weight (Hybrid +10), not at 0.
  scoring.categories[key] ||= clone(state.repoScoring?.categories?.[key] || { weight: 0, multiplier: false });
  return scoring.categories[key];
}

// "× mult" switch for a category weight: off adds the weight flat, on multiplies the positive score.
function multControlHtml(entry) {
  if (!entry.mult) return '';
  return `<label class="weight-per-label weight-mult-label" title="Off: add the weight. On: multiply the card's positive score by it."><input type="checkbox" class="weight-mult" ${entry.mult.value ? 'checked' : ''} aria-label="${esc(`${entry.label} is a multiplier`)}" /> multiply instead</label>`;
}

// The values a tag's per can take: score once per action, or once per hit.
const TAG_PER_OPTIONS = Object.freeze(['action', 'hit']);

// The per box for effects (a whole number of at least 1) and the per select for damage-type tags; the row's words say "per".
function perControlHtml(entry) {
  if (!entry.per) return '';
  const label = `${entry.label} per`;
  if (entry.per.options) {
    const options = [...new Set([...entry.per.options, entry.per.value])];
    return `<label class="weight-per-label"><select class="weight-per" aria-label="${esc(label)}">${options.map((option) => `<option value="${esc(option)}" ${option === entry.per.value ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></label>`;
  }
  return `<label class="weight-per-label"><input type="number" class="weight-per" min="1" step="1" value="${esc(safeNum(entry.per.value, 1))}" aria-label="${esc(label)}" /></label>`;
}

// Weight edits are staged (owner, 2026-11-23): they change only the pending copy, so nothing rescores or
// redraws until Apply. Apply is one undo step; Discard drops the pending copy.
function applyWeightEdit(apply) {
  // Rebase on the applied config as it is now (an undo or A/B load may have changed it), then edit.
  state.pendingScoring = stagedScoring() || clone(state.scoring);
  state.pendingBase = clone(state.scoring);
  withScoring(state.pendingScoring, apply);
  updateWeightsToolbar();
  saveDraft({ autoName: false });
}

// Runs fn with state.scoring swapped for another config, so the Weights rows' setters write into it.
function withScoring(scoring, fn) {
  const applied = state.scoring;
  state.scoring = scoring;
  try { return fn(); } finally { state.scoring = applied; }
}

// The config Apply would produce: the applied config with the staged differences replayed on it, or null.
function stagedScoring() {
  return state.pendingScoring && state.pendingBase ? MergePendingScoring(state.scoring, state.pendingBase, state.pendingScoring) : null;
}

function pendingWeightCount() {
  const staged = stagedScoring();
  return staged ? ScoringDiffPaths(state.scoring, staged).length : 0;
}

function clearPendingWeights() {
  state.pendingScoring = null;
  state.pendingBase = null;
}

function applyPendingWeights() {
  const staged = stagedScoring();
  if (!staged) return;
  const count = ScoringDiffPaths(state.scoring, staged).length;
  const errors = ValidateScoringConfig(staged);
  if (errors.length) { toast(`Cannot apply: ${errors[0]}`); return; }
  pushHistory();
  state.scoring = staged;
  clearPendingWeights();
  syncAllViews();
  saveDraft();
  toast(`Applied ${count} weight change(s). ${computeShiftCount()} card(s) now differ in rank from the game.`);
}

function discardPendingWeights() {
  if (!state.pendingScoring) return;
  clearPendingWeights();
  renderWeights({ shifts: false });
  saveDraft({ autoName: false });
  toast('Discarded staged weight edits');
}

// Stages a whole scoring config (an imported file or the saved config) for review; Apply makes it live.
function stageWholeScoring(scoring, sourceName) {
  const errors = ValidateScoringConfig(scoring);
  if (errors.length) throw new Error(errors.join(' '));
  state.pendingScoring = clone(scoring);
  // Seed naming words as the applied copy is seeded, so they do not count as staged changes.
  ensureNamingWords(state.pendingScoring);
  state.pendingBase = clone(state.scoring);
  document.querySelector('.studio-tab[data-tab="weights"]')?.click();
  renderWeights({ shifts: false });
  saveDraft({ autoName: false });
  toast(`Staged ${sourceName}: ${pendingWeightCount()} change(s). Review, then Apply.`);
}

function updateWeightsToolbar() {
  const apply = document.getElementById('btn-weights-apply');
  if (!apply) return;
  const count = pendingWeightCount();
  apply.textContent = count ? `Apply (${count})` : 'Apply';
  apply.disabled = count === 0;
  document.getElementById('btn-weights-discard').disabled = !state.pendingScoring;
  const accept = document.getElementById('btn-weights-accept-ranks');
  accept.disabled = count > 0;
  accept.title = count > 0 ? 'Apply or discard the staged edits first' : 'Write the applied weights to the game so every card takes its new rank';
  refreshDirtyStatus();
}

// Which feature kind each weight group's rows are, for their descriptions.
const WEIGHT_GROUP_KINDS = Object.freeze({ costs: 'cost', effects: 'effect', statuses: 'status', keywords: 'keyword', tags: 'tag' });

// How many scoring tags have no description from the game or the scoring table.
function renderDescriptionGaps() {
  const gaps = document.getElementById('weights-desc-gaps');
  if (!gaps) return;
  const missing = Object.keys(state.scoring.tags || {}).filter((k) => k[0] !== '$' && describeFeature('tag', k).missing).length;
  gaps.textContent = missing ? `${missing} tag${missing === 1 ? ' has' : 's have'} no description` : 'Every tag has a description';
}

// The Auto-name word tables: per scoring part, the adjective ("Brittle") and the "of" noun ("Frailty").
function renderNamingWordsGroup(container, query) {
  ensureNamingWords(state.scoring);
  const words = state.scoring.naming.card;
  const keys = [...new Set([...Object.keys(words.prefix || {}), ...Object.keys(words.suffix || {})])].sort();
  const rows = keys.filter((key) => !query || `naming words ${key} ${words.prefix[key] || ''} ${words.suffix[key] || ''}`.toLowerCase().includes(query));
  if (!rows.length) return;
  const group = document.createElement('details');
  group.className = 'weight-group-card studio-section naming-words-group';
  group.dataset.section = 'weights-naming';
  group.open = true;
  group.innerHTML = '<summary class="section-head"><h3>Naming words</h3></summary><div class="naming-word-row naming-word-head"><span>Part</span><span>Adjective</span><span>"of" noun</span></div>';
  rememberSection(group);
  for (const key of rows) {
    const row = document.createElement('div');
    row.className = 'naming-word-row';
    row.innerHTML = `<span>${esc(key)}</span>
      <input type="text" data-naming-table="prefix" data-naming-key="${esc(key)}" value="${esc(words.prefix[key] || '')}" aria-label="${esc(`Adjective for ${key}`)}" />
      <input type="text" data-naming-table="suffix" data-naming-key="${esc(key)}" value="${esc(words.suffix[key] || '')}" aria-label="${esc(`"of" noun for ${key}`)}" />`;
    group.appendChild(row);
  }
  group.addEventListener('change', (e) => {
    const { namingTable, namingKey } = e.target.dataset;
    if (!namingTable) return;
    const value = e.target.value.trim();
    const table = state.scoring.naming.card[namingTable];
    if ((table[namingKey] || '') === value) return;
    pushHistory();
    // An emptied word keeps its row, so it can be filled in again.
    table[namingKey] = value;
    saveDraft();
    renderInspector();
  });
  container.appendChild(group);
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
  // Naming words the studio only seeded (the repo has none and nobody edited them) are not an edit;
  // the export dialog still says it will add them.
  if (namingWordsSeedOnly()) return lines.filter((line) => !NAMING_WORD_PATHS.some((path) => line.startsWith(path)));
  return lines;
}

const NAMING_WORD_PATHS = ['naming.card.prefix', 'naming.card.suffix'];

function repoHasNamingWords() {
  const card = state.repoScoring?.naming?.card;
  return Boolean(card?.prefix && card?.suffix);
}

function namingWordsSeedOnly() {
  if (repoHasNamingWords()) return false;
  const card = state.scoring?.naming?.card;
  return JSON.stringify(card?.prefix) === JSON.stringify(DEFAULT_NAME_PREFIX)
    && JSON.stringify(card?.suffix) === JSON.stringify(DEFAULT_NAME_SUFFIX);
}

// The export dialog's note when export will add the naming word tables to a scoring.json without them.
function namingWordsExportNote() {
  if (repoHasNamingWords()) return '';
  const card = state.scoring?.naming?.card;
  const count = (table) => Object.values(table || {}).filter(Boolean).length;
  return `Adds naming words (${count(card?.prefix)} prefixes, ${count(card?.suffix)} suffixes) to naming.card.`;
}

async function loadFromRepo(customPath = state.repoPath) {
  clearPendingWeights();
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

function renderRankShiftList(shifts = rankShifts(), countId = 'export-modal-shift-count', listId = 'export-modal-shifts') {
  document.getElementById(countId).textContent = shifts.length === 1 ? '1 card changes rank' : `${shifts.length} cards change rank`;
  const list = document.getElementById(listId);
  const shown = shifts.slice(0, RANK_SHIFT_LIST_LIMIT).map((shift) => {
    const direction = shift.now > shift.before ? 'shift-up' : 'shift-down';
    return `<li><span>${esc(shift.card.name)}</span><span class="${direction}">${esc(RankName(shift.before))} → ${esc(RankName(shift.now))}</span></li>`;
  });
  const hidden = shifts.length - RANK_SHIFT_LIST_LIMIT;
  if (hidden > 0) shown.push(`<li class="studio-muted">+${hidden} more</li>`);
  list.innerHTML = shown.join('');
}

const GAME_SCORING_PATH = 'content/source/scoring.json';
// Weights toolbar buttons that need the local server (hidden in web mode).
const WEIGHTS_REPO_BUTTON_IDS = Object.freeze(['btn-weights-save', 'btn-weights-load-saved', 'btn-weights-export-game', 'btn-weights-accept-ranks']);

const exportPath = () => document.getElementById('repo-path-input').value.trim() || GAME_SCORING_PATH;

// A note for exports and saves: they carry the applied weights, never the staged ones.
function stagedNotIncludedNote() {
  const count = pendingWeightCount();
  return count ? ` ${count} staged edit(s) are not included until Apply.` : '';
}

function openExportDialog() {
  const errors = ValidateScoringConfig(state.scoring);
  if (errors.length) { toast(`Validation failed: ${errors[0]}`); return; }
  const diff = buildScoringDiff();
  document.getElementById('export-modal-path').textContent = `Target: ${exportPath()} (${diff.length} change(s))`;
  document.getElementById('export-modal-diff').textContent = diff.length ? diff.slice(0, 80).join('\n') : 'No weight differences from the loaded repo file.';
  document.getElementById('export-modal-naming').textContent = namingWordsExportNote() + stagedNotIncludedNote();
  renderRankShiftList();
  document.getElementById('export-modal').showModal();
}

// Writes the applied scoring to a repo file and rebuilds the game's scoring, combat-power and Act tables.
async function writeScoringToGame(path, doneNote = 'Exported') {
  try {
    const r = await fetch('/__studio/scoring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, scoring: state.scoring, rebuild: true }) });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error);
    state.repoScoring = clone(state.scoring);
    recomputeBaselineRanks();
    syncAllViews();
    writeDraftNow();
    toast(`${doneNote}: ${data.path}, rebuilt ${data.rebuilt.length} table script(s)`);
    return true;
  } catch (err) {
    toast(`Export failed: ${err.message}`);
    return false;
  }
}

function downloadScoringJson() {
  const blob = new Blob([JSON.stringify(state.scoring, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'scoring.json' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Downloaded scoring.json.${stagedNotIncludedNote()}`);
}

// An imported file is staged, not applied: the owner reviews it in the Weights tab, then Applies.
async function importScoringFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    stageWholeScoring(JSON.parse(await file.text()), file.name);
  } catch (err) {
    toast(`Invalid JSON: ${err.message}`);
  }
  e.target.value = '';
}

// Save keeps the applied weights as the studio's own config, apart from the game's scoring.json.
async function saveStudioConfig() {
  try {
    const r = await fetch('/__studio/scoring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: STUDIO_SAVE_PATH, scoring: state.scoring, rebuild: false }) });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error);
    toast(`Saved to ${data.path}.${stagedNotIncludedNote()}`);
  } catch (err) {
    toast(`Save failed: ${err.message}`);
  }
}

async function openSavedConfig() {
  try {
    const r = await fetch(`/__studio/config?scoringPath=${encodeURIComponent(STUDIO_SAVE_PATH)}`);
    const data = await r.json();
    if (!data.ok) throw new Error(data.error);
    if (!data.scoringExists) { toast('Nothing saved yet: Save first'); return; }
    stageWholeScoring(data.scoring, 'the saved config');
  } catch (err) {
    toast(`Open saved failed: ${err.message}`);
  }
}

// The rank a card scores with no override holding it in place.
function unpinnedRank(def) {
  const face = cardDefToFace(def, state.scoring);
  const raw = ScoreCard(face, state.scoring).raw;
  return RankOf(CombatPower(raw, face.rarity, state.scoring), state.scoring);
}

function cardOverride(def) {
  const fromScoring = state.scoring.overrides?.[def.id];
  return (fromScoring || def.scoringOverride) ? { ...(fromScoring || {}), ...(def.scoringOverride || {}) } : null;
}

// Cards whose override pins a rank the applied weights no longer give them. Accept new ranks clears these pins.
function stalePinnedCards() {
  return state.cards.filter((def) => HasRankPin(cardOverride(def)) && unpinnedRank(def) !== scoreCardEntry(def).rank);
}

// The game derives every card's rank (and so its Act) from scoring.json when the tables rebuild, so accepting
// the new ranks is: clear stale rank pins, write the applied weights to the game, rebuild.
function openAcceptRanksDialog() {
  if (pendingWeightCount() > 0) { toast('Apply or discard the staged edits first'); return; }
  const errors = ValidateScoringConfig(state.scoring);
  if (errors.length) { toast(`Validation failed: ${errors[0]}`); return; }
  const pinned = stalePinnedCards();
  const pinnedIds = new Set(pinned.map((def) => def.id));
  const shifts = state.cards
    .map((card) => ({ card, now: pinnedIds.has(card.id) ? unpinnedRank(card) : scoreCardEntry(card).rank, before: state.baselineRanks[card.id] }))
    .filter((shift) => shift.before !== undefined && shift.now !== shift.before);
  document.getElementById('ranks-modal-pins').textContent = pinned.length
    ? `Clears the pinned rank on ${pinned.length} card(s): ${pinned.slice(0, 8).map((def) => def.name).join(', ')}${pinned.length > 8 ? ', ...' : ''}`
    : 'No card has a pinned rank to clear.';
  renderRankShiftList(shifts, 'ranks-modal-shift-count', 'ranks-modal-shifts');
  document.getElementById('ranks-modal').showModal();
}

async function acceptNewRanks() {
  const pinned = stalePinnedCards();
  if (pinned.length) {
    pushHistory();
    for (const def of pinned) {
      if (state.scoring.overrides?.[def.id]) {
        const kept = WithoutRankPin(state.scoring.overrides[def.id]);
        if (kept) state.scoring.overrides[def.id] = kept;
        else delete state.scoring.overrides[def.id];
      }
      if (def.scoringOverride) {
        const kept = WithoutRankPin(def.scoringOverride);
        if (kept) def.scoringOverride = kept;
        else delete def.scoringOverride;
        def._edited = true;
      }
    }
  }
  const moved = rankShifts().length;
  const written = await writeScoringToGame(GAME_SCORING_PATH, `${moved} card(s) took their new rank in the game`);
  if (!written && pinned.length) {
    // The pins are cleared in the studio (Undo restores them); show that and keep it in the draft.
    syncAllViews();
    saveDraft();
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
  fillSelect(document.getElementById('edit-class'), classes);
  fillSelect(document.getElementById('edit-rarity'), rarities);
  const poolText = `Core pool · ${state.cards.length} cards`;
  document.querySelectorAll('.pool-label').forEach((el) => { el.textContent = poolText; });
}

function syncAllViews() {
  ensureNamingWords(state.scoring);
  populateRankFilter();
  populateCardOptions();
  populateAddFeatureDropdown();
  renderCardsGrid();
  renderInspector();
  renderWeights();
  renderArtTab();
  // The sandbox hand's rank badges follow undo, redo, slot loads, imports and Revert too.
  if (state.sandbox.combat) renderSandbox();
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

const RANK_BADGES_KEY = 'ashenspire:scoreStudioRankBadges:v1';

function setRankBadgesShown(shown) {
  document.body.classList.toggle('hide-rank-badges', !shown);
  document.getElementById('toggle-rank-badges').checked = shown;
  writeStoredJson(RANK_BADGES_KEY, shown);
}

function setupFilterPanel() {
  setRankBadgesShown(readStoredJson(RANK_BADGES_KEY, true) !== false);
  document.getElementById('toggle-rank-badges').addEventListener('change', (e) => setRankBadgesShown(e.target.checked));
  setFiltersOpen(readStoredJson(FILTERS_OPEN_KEY, false) === true);
  document.getElementById('btn-filters').addEventListener('click', () => {
    setFiltersOpen(document.getElementById('filter-panel').hidden);
  });
}

// Every collapsible section remembers whether it is open. Controls in a section header (buttons, selects,
// the override toggle) are interactive content, so clicking them does not toggle the section.
function rememberSection(section) {
  const name = section.dataset.section;
  const stored = readStoredJson(SECTIONS_KEY, {});
  if (Object.hasOwn(stored, name)) section.open = stored[name] === true;
  section.addEventListener('toggle', () => {
    const current = readStoredJson(SECTIONS_KEY, {});
    current[name] = section.open;
    writeStoredJson(SECTIONS_KEY, current);
  });
}

function setupSections() {
  document.querySelectorAll('details[data-section]').forEach(rememberSection);
  document.getElementById('btn-collapse-all').addEventListener('click', () => setAllSectionsOpen(false));
  document.getElementById('btn-expand-all').addEventListener('click', () => setAllSectionsOpen(true));
}

// Folds or opens every section on every tab, and remembers it, including weight groups drawn later.
function setAllSectionsOpen(open) {
  const stored = readStoredJson(SECTIONS_KEY, {});
  document.querySelectorAll('details[data-section]').forEach((section) => {
    section.open = open;
    stored[section.dataset.section] = open;
  });
  writeStoredJson(SECTIONS_KEY, stored);
  toast(open ? 'Expanded all sections' : 'Collapsed all sections');
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
      textTemplate: 'Deal {damage} damage.', _custom: true, _autoName: true,
    });
    startAutoName(card);
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
    const copy = normalizeStudioCard({ ...clone(src), id: `custom.copy_${Date.now().toString(36)}`, name: `${src.name} (Copy)`, _custom: true, _edited: true, _autoName: true });
    startAutoName(copy);
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
    // Snapshot first, so undo brings Auto-name back on along with the old name.
    nameBurst.begin();
    const def = selectedCardDef();
    if (def?._autoName) {
      def._autoName = false;
      toast('Auto-name off: you named this card');
    }
    mutateSelectedCard((d) => { d.name = e.target.value; }, { recordHistory: false, autoName: false });
  });
  // Auto-name is per card. Turning it on records where the name starts from (its last word and its
  // length), then renames at once; the toggle and the rename are one undo step.
  document.getElementById('toggle-auto-name').addEventListener('change', (e) => {
    const on = e.target.checked;
    mutateSelectedCard((d) => {
      d._autoName = on;
      if (on) startAutoName(d);
    });
  });
  const textBurst = createEditBurst();
  const textInput = document.getElementById('edit-text');
  textInput.addEventListener('focus', () => textBurst.end());
  textInput.addEventListener('input', (e) => {
    const autoTextToggle = document.getElementById('toggle-auto-text');
    if (autoTextToggle?.checked) {
      autoTextToggle.checked = false;
      writeStoredJson(AUTO_TEXT_KEY, false);
    }
    textBurst.begin();
    mutateSelectedCard((d) => { d.textTemplate = e.target.value; }, { recordHistory: false, autoName: false, autoText: false });
  });
  document.getElementById('btn-text-from-effects').addEventListener('click', () => {
    mutateSelectedCard((d) => { d.textTemplate = textFromEffects(d); }, { autoName: false, autoText: false });
  });
  const autoTextToggle = document.getElementById('toggle-auto-text');
  autoTextToggle.checked = readStoredJson(AUTO_TEXT_KEY, false) === true;
  autoTextToggle.addEventListener('change', () => {
    writeStoredJson(AUTO_TEXT_KEY, autoTextToggle.checked);
    // Turning Auto on writes the text straight away; turning it off keeps the text as it is.
    if (autoTextToggle.checked) mutateSelectedCard(() => {}, { autoName: false });
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
  document.getElementById('edit-type').addEventListener('change', (e) => mutateSelectedCard((d) => setCardKind(d, e.target.value)));
  document.getElementById('edit-class').addEventListener('change', (e) => mutateSelectedCard((d) => { d.class = e.target.value; }));
  document.getElementById('edit-rarity').addEventListener('change', (e) => mutateSelectedCard((d) => { d.rarity = e.target.value; }));
  // Martial and Magic: at least one stays ticked; both is a hybrid hit.
  const schoolBoxes = ['edit-martial', 'edit-magic'].map((id) => document.getElementById(id));
  for (const box of schoolBoxes) {
    box.addEventListener('change', () => {
      if (!schoolBoxes.some((b) => b.checked)) box.checked = true;
      mutateSelectedCard((d) => setCardSchools(d, { martial: schoolBoxes[0].checked, magic: schoolBoxes[1].checked }));
    });
  }
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
  // Picking from the list describes the feature first; Add (or Enter) adds it. Quick-add chips add at once.
  const addSelect = document.getElementById('add-feature-select');
  addSelect.addEventListener('change', renderAddFeatureDescription);
  addSelect.addEventListener('input', renderAddFeatureDescription);
  addSelect.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addFeatureValue(addSelect.value); renderAddFeatureDescription(); } });
  // Typing in the search narrows the list; Enter adds the picked match, Down moves into the list, Escape clears.
  const addSearch = document.getElementById('add-feature-search');
  addSearch.addEventListener('input', () => { renderAddFeatureOptions({ pickBest: true }); renderAddFeatureDescription(); });
  addSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addFeatureValue(addSelect.value); renderAddFeatureDescription(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); addSelect.focus(); }
    else if (e.key === 'Escape' && addSearch.value) { e.preventDefault(); addSearch.value = ''; renderAddFeatureOptions(); renderAddFeatureDescription(); }
  });
  document.getElementById('btn-add-feature').addEventListener('click', renderAddFeatureDescription);
  const quickChips = document.getElementById('quick-add-chips');
  for (const chip of quickChips.querySelectorAll('[data-quick-add]')) chip.title = featureTitleText(featureValueInfo(chip.dataset.quickAdd));
  quickChips.addEventListener('click', (e) => addFeatureValue(e.target.dataset?.quickAdd));
  wireInfoButtons(document.getElementById('active-features-list'), '.feature-row');

  document.getElementById('active-features-list').addEventListener('click', (e) => {
    const rmEff = e.target.dataset.rmEff;
    const rmKw = e.target.dataset.rmKw;
    const rmTag = e.target.dataset.rmTag;
    if (rmEff !== undefined) mutateSelectedCard((d) => { d.effects.splice(Number(rmEff), 1); dropStaleTextClauses(d); });
    else if (rmKw !== undefined) mutateSelectedCard((d) => { d.keywords.splice(Number(rmKw), 1); });
    else if (rmTag !== undefined) mutateSelectedCard((d) => { d.tags = d.tags.filter((t) => t !== rmTag); });
  });
  // Amount and stack inputs rescore live without rebuilding the list, so focus and spinner holds survive.
  const featureBurst = createEditBurst();
  const featureList = document.getElementById('active-features-list');
  const applyFeatureNumber = (target) => {
    if (target.dataset.effAmt !== undefined) {
      const effectIndex = Number(target.dataset.effAmt);
      const wanted = Number(target.value) || 0;
      applyLiveCardEdit(featureBurst, (d) => { d.effects[effectIndex].amount = authoredAmountForFace(d, effectIndex, wanted); });
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

  document.getElementById('btn-export-repo').addEventListener('click', openExportDialog);
  document.getElementById('btn-confirm-export').addEventListener('click', () => writeScoringToGame(exportPath()));
  document.getElementById('btn-download-json').addEventListener('click', downloadScoringJson);
  document.getElementById('input-upload-json').addEventListener('change', importScoringFile);

  // Weights toolbar: staged edits, the studio's saved config, import, export and accepting the new ranks.
  document.getElementById('btn-weights-apply').addEventListener('click', applyPendingWeights);
  document.getElementById('btn-weights-discard').addEventListener('click', discardPendingWeights);
  document.getElementById('btn-weights-save').addEventListener('click', saveStudioConfig);
  document.getElementById('btn-weights-load-saved').addEventListener('click', openSavedConfig);
  document.getElementById('input-weights-import').addEventListener('change', importScoringFile);
  document.getElementById('btn-weights-export-game').addEventListener('click', openExportDialog);
  document.getElementById('btn-weights-export-download').addEventListener('click', downloadScoringJson);
  document.getElementById('btn-weights-accept-ranks').addEventListener('click', openAcceptRanksDialog);
  document.getElementById('btn-confirm-accept-ranks').addEventListener('click', acceptNewRanks);
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
    for (const id of ['btn-export-repo', 'btn-save-art', 'btn-revert', ...WEIGHTS_REPO_BUTTON_IDS]) document.getElementById(id)?.classList.add('hidden');
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
      // A draft saved before a category existed takes the repo's weight for it (Hybrid +10 reaches old drafts).
      for (const [key, weight] of Object.entries(state.repoScoring.categories || {})) {
        if (key === 'rule' || state.scoring.categories?.[key]) continue;
        (state.scoring.categories ||= {})[key] = clone(weight);
      }
      if (draft.pendingScoring && draft.pendingBase && ValidateScoringConfig(draft.pendingScoring).length === 0) {
        state.pendingScoring = draft.pendingScoring;
        state.pendingBase = draft.pendingBase;
      }
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
