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
import { renderEquipmentCard } from '../../src/ui/components/equipmentCard.js';
import { renderCollectibleCard } from '../../src/ui/components/collectibleCard.js';
import { GEAR_TYPES } from '../../src/content/gearTypes.js';
import { itemArtLayers as shippedItemArtLayers } from '../../src/content/generated/itemArtLayers.js';
import { cardShapeCssProperties } from '../../src/ui/models/CardSizeModel.js';
import { reviewedCardArtCatalog } from '../../src/content/reviewedCardArt.generated.js';
import { scoring as shippedScoring } from '../../src/content/generated/scoring.js';
import { CardKind, CardCategories, ScoreCard, CombatPower, RankOf, RankName, CardName, CardNameParts, ApplyScoringOverride, ParseUpgradeTag, UpgradeTagLabel } from '../../src/model/combatPower.js';
import { ValidateScoringConfig, NAME_LIMIT_PARTS } from '../../src/model/activeScoring.js';
import { EffectiveWardHp } from '../../src/model/fixCoreMechanics.js';
import { staticCardTokens } from '../../src/model/playingCard.js';
import { tokenRe, computeTokenBindings } from '../../src/model/validate.js';
import { ScoringDiffPaths, MergePendingScoring, HasRankPin, WithoutRankPin, STUDIO_SAVE_PATH, RefreshRestoredNaming } from './weightsStaging.js';
import { DEFAULT_NAME_SET_ID, DefaultNameSet, CaptureNameSet, TurnOnAutoNames, ApplyNameSet, SortedNameSets, ValidNameSets, MergeNameSets, SplitSavedConfig, JoinSavedConfig, DefaultNameSetLabel, NameSetFile, NameSetFileName, ParseNameSetFile } from './nameSets.js';
import { weightSentence, weightExample, TagMultiplierKey, SetKeywordForm, SetTagForm, SetWeightForm } from './weightExamples.js';
import { PlanCardPool, MeasurePoolShape } from '../../src/model/cardPoolPlan.js';
import { GenerateCard } from '../../src/model/cardGenerator.js';
import { ScoreGeneratedItem } from '../../src/model/itemGenerator.js';
import { RenderPoolForm, ReadPoolForm, NormaliseSettings, UpdatePoolSums } from './cardPoolForm.js';
import { buildItemRoster, typeModsForEntry, scoreItemEntry, livePieceFromEntry, describeItemMod, formatModString, ITEM_TRAIT_SELECTORS, ITEM_QUICK_TRAITS, ITEM_MOTIF_OPTIONS } from './itemStudio.js';
import { initStudioToolsModals, downloadJsonFile } from './studioToolsModal.js';
import {
  DEFAULT_ART_LOAD_TIMEOUT_MS,
  parseLoadingShotMode,
  artLoadingPercent,
  formatArtLoadingStatus,
  summarizeTileArtLoad,
} from './loadingState.js';
import { initSubclassCatalogUi, upgradeNames } from './subclassCatalog.js';
import { CardDefinitionToScoreFace } from '../../src/model/cardUpgradeCp.js';
import { ProjectCardMechanicalValues } from '../../src/model/cardMechanicalProjection.js';
import { RefreshSubclassCard, SubclassCardText } from '../../src/model/subclassCardGenerator.js';
import { initCardSelectionUi, isAddedCard, removeAddedCardsFromState, addSelectedCardsToDeck, removeSelectedCardsFromDeck } from './cardSelection.js';
import { initCardEditorDock } from './cardEditorDock.js';
import { initDeckListPanel } from './deckListPanel.js';
import { filterMembership, deckCatalogOptions, resolveStudioDeck } from './deckCatalog.js';
import { initGalleryZoom } from './galleryZoom.js';
import { focusedEffectOptions } from './focusedRebalance.js';
import { createAddCardTile, CaptureCardTilePositions, animateCardInsertion } from './addCardTile.js';
import { InitStudioSaveUi, StudioSaveMenuLabel } from './studioSaveUi.js';
import {
  GalleryKind,
  Galleries,
  TileIdAttribute,
  TileIdDatasetKey,
  GalleryEntity,
  PerGallery,
  ToGalleryKind,
  FindGalleryEntity,
  DataAttributePrefix,
  CreateActiveEntities,
  CreateEditBursts,
  NextInDisplayedOrder,
  ReadWorkingContext,
  WriteWorkingContext,
  ResolveWorkingContext,
  CaptureTileFocus,
  RestoreTileFocus,
  SelectionOptions,
} from './workingContext.js';

const DRAFT_STORAGE_KEY = 'ashenspire:scoreStudioDraft:v1';
const SAVE_SHORTCUT_KEY = 's';
const STUDIO_SAVE_MENU_ID = 'menu-studio-save';
const STUDIO_SAVE_SHORTCUT_ARIA = 'Control+S';
const AB_STORAGE_KEY = 'ashenspire:scoreStudioAB:v1';
// Saved name sets (Rename all), kept apart from the draft so they survive a clean or exported draft.
const NAME_SETS_STORAGE_KEY = 'ashenspire:scoreStudioNameSets:v1';
const PATH_STORAGE_KEY = 'ashenspire:scoreStudioPath:v1';
const DRAFT_SAVE_DELAY_MS = 300;
const TEXT_EDIT_BURST_MS = 1000;
const UNDO_DEPTH = 40;
const INSPECTOR_WIDTH_KEY = 'ashenspire:studioInspectorW';
const INSPECTOR_WIDTH_MIN = 340;
const INSPECTOR_WIDTH_MAX = 780;
const GalleryGridId = Object.freeze({
  [GalleryKind.Cards]: 'cards-grid',
  [GalleryKind.Items]: 'items-grid',
});
const GallerySearchId = Object.freeze({
  [GalleryKind.Cards]: 'card-search',
  [GalleryKind.Items]: 'item-filter-search',
});
const GalleryTileClass = Object.freeze({
  [GalleryKind.Cards]: 'studio-card-tile',
  [GalleryKind.Items]: 'item-grid-tile',
});
const GalleryFilterSelectIds = Object.freeze({
  [GalleryKind.Cards]: Object.freeze([
    'filter-type',
    'filter-class',
    'filter-rank',
    'filter-shift',
    'filter-deck',
  ]),
  [GalleryKind.Items]: Object.freeze([
    'item-filter-kind',
    'item-filter-rarity',
    'item-filter-rank',
    'filter-item-deck',
  ]),
});
const ITEM_INSPECT_LEVEL = 'inspect';
const FILTER_ALL = 'all';
const SELECTED_TILE_CLASS = 'is-selected';
const STUDIO_TAB_SELECTOR = '.studio-tab';
const ACTIVE_STUDIO_TAB_SELECTOR = '.studio-tab.is-active';
const STUDIO_TAB_DATA_ATTRIBUTE = 'data-tab';
const ART_PREVIEW_SELECT_ID = 'art-preview-card-select';
const ART_LIVE_PREVIEW_ID = 'art-live-preview';
// The picker's placeholder value when no card or item is active.
const NO_ENTITY_OPTION_VALUE = '';
const CHANGE_EVENT = 'change';
const REVEAL_SCROLL_OPTIONS = Object.freeze({ block: 'nearest' });
const NoActiveEntityOption = Object.freeze({
  [GalleryKind.Cards]: 'No card selected',
  [GalleryKind.Items]: 'No item selected',
});
const DeletedCardToast = Object.freeze({
  withNext: (removedName, nextName) => `Deleted "${removedName}". Now editing "${nextName}".`,
  withoutNext: (removedName) => `Deleted "${removedName}". No card selected.`,
});
// On GitHub Pages there is no local server: the studio runs on shipped scoring and exports by Download JSON.
const isLocalServer = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

// Bootstrap real game registries
const profile = Profile.resolveGameProfile('default');
const configuredCustomCardIds = new Set(Profile.gameModule(profile, 'cards')?.mode === 'configured'
  ? (Profile.gameContent(profile, 'cards') || []).filter(card => card.id.startsWith('custom.')).map(card => card.id) : []);
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
function safeCardName(face, scoringRef) {
  return CardName(face, 0, namingScoring(scoringRef));
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
  items: [],            // editable weapons, armours, and relics
  itemRules: {},        // relic property-rule table for ScoreItem
  defaultItemNames: {}, // key -> shipped authored item name
  baselineItemRanks: {}, // key -> baseline rank under repoScoring
  selectedCardId: null,
  selectedItemKey: null,
  customClasses: [],
  customDecks: [],
  subclassCatalog: null,
  selectedLayerIdx: 0,
  artTarget: 'cards',   // 'cards' | 'items'
  selectedItemLayerIdx: 0,
  viewMode: 'grid',
  artLayers: {
    version: 1,
    layers: [
      { id: 'layer-1', name: 'Fire Overlay', matchKind: 'tag', matchValue: 'school:fire', mode: 'stack', assetId: 'Z.effect.5', zIndex: 10, x: 50, y: 50, scale: 85, opacity: 35, blendMode: 'screen', enabled: true },
    ],
  },
  repoArtLayers: null,  // art layers as loaded from the repo (or the built-in default); set in boot
  itemArtLayers: clone(shippedItemArtLayers),
  repoItemArtLayers: clone(shippedItemArtLayers),
  abSlots: { A: null, B: null, activeLabel: 'Draft' },
  // Rename all: the repo's authored names (never overwritten) and the saved name sets, newest first.
  defaultNameSet: null,
  nameSets: [],
  // Generate cards (owner, 2026-11-24): the shipped Core ids (so Replace everything is remembered), the measured Core shape, the modal's last settings.
  coreCardIds: [],
  coreShape: null,
  generatorSettings: null,
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
  if (isSpell && (!def.damageSchool || def.damageSchool === 'physical')) def.damageSchool = 'magic';
  else if (!isSpell && !(def.magicShare > 0)) def.damageSchool = 'physical';
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

function cardDefToFace(def, scoringRef) {
  return CardDefinitionToScoreFace(def, { scoring: scoringRef, registries: studioRegistries, rules: refContextFor(def).run });
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
  return JSON.stringify({
    scoring: state.scoring,
    baselineRanks: state.baselineRanks,
    cards: state.cards,
    items: state.items,
    artLayers: state.artLayers,
    itemArtLayers: state.itemArtLayers,
    customClasses: state.customClasses,
    customDecks: state.customDecks,
    subclassCatalog: state.subclassCatalog,
  });
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

function editedItems() {
  return state.items.filter((it) => it._edited);
}

function weightChangeCount() {
  return buildScoringDiff().length;
}

function artLayersChanged() {
  return JSON.stringify(state.artLayers) !== JSON.stringify(state.repoArtLayers)
    || JSON.stringify(state.itemArtLayers) !== JSON.stringify(state.repoItemArtLayers);
}

// Shipped Core cards no longer in the list (Replace everything removed them).
function removedCoreIds() {
  const present = new Set(state.cards.map((c) => c.id));
  return state.coreCardIds.filter((id) => !present.has(id));
}

function isDirty() {
  return removedCoreIds().length > 0
    || weightChangeCount() > 0
    || pendingWeightCount() > 0
    || editedCards().length > 0
    || editedItems().length > 0
    || (state.customClasses || []).length > 0
    || (state.customDecks || []).length > 0
    || artLayersChanged();
}

function refreshDirtyStatus() {
  const pill = document.getElementById('draft-status');
  const dirty = isDirty();
  pill.classList.remove('is-loading');
  pill.classList.toggle('is-dirty', dirty);
  if (!dirty) pill.textContent = 'Synced with repo';
  else if (!state.autosave) pill.textContent = 'Unsaved edits';
  else if (state.draftStorageFailed) pill.textContent = 'Unsaved edits (storage full)';
  else pill.textContent = 'Draft auto-saved (local temp copy)';
  studioSaveUi?.decoratePill(pill);
}

const LOADING_SHOT_MODE = parseLoadingShotMode(location.search);
let artLoadGeneration = 0;
let artLoadSafetyTimer = null;

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function setCardsLoading(visible, title = 'Loading cards…', detail = '', { error = false } = {}) {
  if (visible) {
    ++artLoadGeneration;
    clearTimeout(artLoadSafetyTimer);
    artLoadSafetyTimer = null;
    setCardsArtLoadingBar(false);
  }
  const el = document.getElementById('cards-loading');
  const grid = document.getElementById('cards-grid');
  if (el) {
    el.hidden = !visible;
    el.setAttribute('aria-busy', visible && !error ? 'true' : 'false');
    el.classList.toggle('is-error', Boolean(error));
    const titleEl = document.getElementById('cards-loading-title');
    if (titleEl && title) titleEl.textContent = title;
    const detailEl = document.getElementById('cards-loading-detail');
    if (detailEl && detail !== undefined) detailEl.textContent = detail;
  }
  if (grid) grid.hidden = visible;
}

function setItemsLoading(visible, title = 'Loading items…', detail = '', { error = false } = {}) {
  const el = document.getElementById('items-loading');
  const grid = document.getElementById('items-grid');
  if (el) {
    el.hidden = !visible;
    el.setAttribute('aria-busy', visible && !error ? 'true' : 'false');
    el.classList.toggle('is-error', Boolean(error));
    const titleEl = document.getElementById('items-loading-title');
    if (titleEl && title) titleEl.textContent = title;
    const detailEl = document.getElementById('items-loading-detail');
    if (detailEl && detail !== undefined) detailEl.textContent = detail;
  }
  if (grid) grid.hidden = visible;
}

function setCardsArtLoadingBar(visible, settled = 0, total = 0) {
  const bar = document.getElementById('cards-art-loading');
  if (!bar) return;
  bar.hidden = !visible;
  if (!visible) return;
  const textEl = document.getElementById('cards-art-loading-text');
  const fillEl = document.getElementById('cards-art-loading-fill');
  if (textEl) textEl.textContent = formatArtLoadingStatus(settled, total);
  if (fillEl) fillEl.style.width = `${artLoadingPercent(settled, total)}%`;
}

function trackCardsArtLoading(grid) {
  const token = ++artLoadGeneration;
  clearTimeout(artLoadSafetyTimer);
  artLoadSafetyTimer = null;

  const tiles = [...grid.querySelectorAll('.studio-card-tile')];
  if (LOADING_SHOT_MODE === 'art-loading') {
    const total = Math.max(1, tiles.length);
    const settled = Math.max(1, Math.round(total * 0.4));
    tiles.slice(settled, settled + 4).forEach((t) => t.classList.add('is-art-loading'));
    setCardsArtLoadingBar(true, settled, total);
    return;
  }

  const tileEntries = tiles
    .map((tile) => ({ tile, imgs: [...tile.querySelectorAll('img')] }))
    .filter((entry) => entry.imgs.length > 0);

  const update = () => {
    if (token !== artLoadGeneration) return;
    for (const entry of tileEntries) {
      const done = entry.imgs.every((img) => img.complete);
      entry.tile.classList.toggle('is-art-loading', !done);
    }
    const summary = summarizeTileArtLoad(tileEntries.map((e) => e.imgs));
    if (summary.complete) {
      clearTimeout(artLoadSafetyTimer);
      artLoadSafetyTimer = null;
      setCardsArtLoadingBar(false);
    } else {
      setCardsArtLoadingBar(true, summary.settled, summary.total);
    }
  };

  const initial = summarizeTileArtLoad(tileEntries.map((e) => e.imgs));
  if (initial.complete) {
    for (const entry of tileEntries) entry.tile.classList.remove('is-art-loading');
    setCardsArtLoadingBar(false);
    return;
  }

  update();
  for (const entry of tileEntries) {
    for (const img of entry.imgs) {
      if (img.complete) continue;
      img.addEventListener('load', update, { once: true });
      img.addEventListener('error', update, { once: true });
    }
  }
  artLoadSafetyTimer = setTimeout(() => {
    if (token !== artLoadGeneration) return;
    for (const entry of tileEntries) entry.tile.classList.remove('is-art-loading');
    setCardsArtLoadingBar(false);
  }, DEFAULT_ART_LOAD_TIMEOUT_MS);
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
          itemArtLayers: state.itemArtLayers,
          customCards: editedCards(),
          editedItems: editedItems(),
          removedCardIds: removedCoreIds(),
          generatorSettings: state.generatorSettings,
          customClasses: state.customClasses,
          customDecks: state.customDecks,
          subclassCatalog: state.subclassCatalog,
          studioSaveRevision: studioSaveUi?.revision() ?? null,
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
  state.baselineRanks = clone(snap.baselineRanks || {});
  state.cards = snap.cards;
  if (Array.isArray(snap.items)) state.items = snap.items;
  state.artLayers = snap.artLayers;
  if (snap.itemArtLayers?.layers) state.itemArtLayers = snap.itemArtLayers;
  if (Array.isArray(snap.customClasses)) state.customClasses = snap.customClasses;
  if (Array.isArray(snap.customDecks)) state.customDecks = snap.customDecks;
  state.subclassCatalog = snap.subclassCatalog || null;
  studioCardOverrides.clear();
  // syncAllViews reconciles the active card and item with the restored content.
  syncAllViews();
  saveDraft();
}

// ---------------------------------------------------------------------------
// Procedural Art Layer Overlay
// ---------------------------------------------------------------------------
// The card art layers that apply to a card, in z-order. `includeDisabled` keeps the ones switched off, so they
// can be switched back on from beside the card.
function matchingCustomLayers(def, { includeDisabled = false } = {}) {
  const tags = def.tags || [];
  const statuses = (def.effects || []).filter((e) => e.op === 'applyStatus').map((e) => e.status);
  return (state.artLayers.layers || [])
    .filter((l) => (includeDisabled || l.enabled !== false) && l.assetId)
    .filter((l) => {
      if (l.matchKind === 'default') return true;
      if (l.matchKind === 'type') return def.type === l.matchValue;
      if (l.matchKind === 'tag') return tags.includes(l.matchValue);
      if (l.matchKind === 'status') return statuses.includes(l.matchValue);
      return false;
    })
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

const STUDIO_ONLY_FIELDS = ['_edited', '_custom', '_generated', '_cpMiss', 'scoringOverride', '_autoName', '_autoNameCore', '_autoNameBudget'];

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
    if (id === 'gainBarrier') {
      title = 'Gain Bonus Poise';
      does = registryEntry(registries.statuses, 'barrier')?.tooltip || null;
      entry = S.statuses?.barrier;
      unit = ' per stack (self)';
    } else {
      const keys = EFFECT_SCORE_KEYS[id];
      title = capitalise(id);
      entry = S.effects?.[keys?.weight || id];
    }
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
// Auto-name: the card's convention name (CardName, trimmed to naming.card.limit), e.g. "Flame Bolt VII"
// ---------------------------------------------------------------------------
function romanFor(rank) {
  const roman = state.scoring.naming?.roman || shippedScoring.naming?.roman || [];
  return roman[rank] || '';
}

// A config's naming with the shipped word tables under it, so an older config (no range or tradition words) still names
// cards. The length limit is not filled in: a config without one has no limit.
function namingScoring(scoringRef) {
  const own = scoringRef?.naming;
  if (!own) return { ...scoringRef, naming: shippedScoring.naming };
  const { limit, ...shippedCard } = shippedScoring.naming.card;
  // Table by table and key by key, so a table missing a newer key still finds the shipped word.
  const card = { ...shippedCard };
  for (const [table, words] of Object.entries(own.card || {})) {
    const shippedWords = shippedCard[table];
    card[table] = shippedWords && typeof shippedWords === 'object' && !Array.isArray(shippedWords) && words && typeof words === 'object' && !Array.isArray(words) ? { ...shippedWords, ...words } : words;
  }
  return { ...scoringRef, naming: { ...shippedScoring.naming, ...own, card } };
}

function nameParts(def, sc = scoreCardEntry(def)) {
  try {
    return CardNameParts(sc.face, 0, namingScoring(state.scoring));
  } catch {
    return { name: def.name, effect: null, base: null, rank: sc.rank, source: null, dropped: [] };
  }
}

// The name Auto-name gives a card now: its convention name.
function autoNameFor(def, sc = scoreCardEntry(def)) {
  return nameParts(def, sc).name;
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
    clearNewDraft(def);
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
    cardEditorDockUi?.refreshEntity?.();
  }
  return renamed;
}

function autoNameSelectedCards(ids) {
  const selected = new Set(ids);
  const cards = state.cards.filter(card => selected.has(card.id));
  if (!cards.length) return;
  pushHistory();
  for (const card of cards) {
    clearNewDraft(card);
    card._autoName = true;
    card.name = autoNameFor(card);
    card._edited = true;
    refreshSubclassEdit(card);
  }
  syncAllViews();
  saveDraft({ autoName: false });
  toast(`Auto-named ${cards.length} selected cards`);
}

// The muted line under Name: what the name is built from.
function renderNameHint(def, sc = scoreCardEntry(def)) {
  const hint = document.getElementById('name-hint');
  if (!hint) return;
  const parts = nameParts(def, sc);
  const source = parts.source || 'no second effect';
  const trimmed = parts.dropped?.length ? ` · Trimmed: ${parts.dropped.join(', ')}` : '';
  hint.textContent = `Convention: ${parts.name}${trimmed} · from ${source} · ${RankName(sc.rank)}`;
}

// ---------------------------------------------------------------------------
// Rename all and name sets (owner, 2026-11-24)
// ---------------------------------------------------------------------------
// Rename all turns Auto-name on for every card. Before it, the owner may save the current names as a set;
// Restore names puts back Default names (the repo's authored names) or a saved set, with Auto-name off.
// Sets stay in the studio (local storage and the saved JSON config); Export never writes them.
let selectedNameSetId = DEFAULT_NAME_SET_ID;

function loadStoredNameSets() {
  try { state.nameSets = SortedNameSets(ValidNameSets(JSON.parse(localStorage.getItem(NAME_SETS_STORAGE_KEY) || '[]'))); } catch { state.nameSets = []; }
}

function storeNameSets() {
  try { localStorage.setItem(NAME_SETS_STORAGE_KEY, JSON.stringify(state.nameSets)); } catch { toast('Could not keep the name sets: browser storage is full'); }
}

function nameSetById(id) {
  return id === DEFAULT_NAME_SET_ID ? state.defaultNameSet : state.nameSets.find((set) => set.id === id) || null;
}

function renderNameSetsList() {
  const list = document.getElementById('restore-names-list');
  if (!list) return;
  if (!nameSetById(selectedNameSetId)) selectedNameSetId = DEFAULT_NAME_SET_ID;
  const sets = [state.defaultNameSet, ...state.nameSets].filter(Boolean);
  list.innerHTML = sets.map((set) => {
    const id = esc(set.id);
    const remove = set.id === DEFAULT_NAME_SET_ID ? '' : `<button type="button" class="name-set-delete" data-name-set-delete="${id}" title="Delete this saved set" aria-label="${esc(`Delete ${set.label}`)}">×</button>`;
    return `<label class="name-set-row"><input type="radio" name="name-set" value="${id}" ${set.id === selectedNameSetId ? 'checked' : ''} /><span>${esc(set.label)}</span>${remove}</label>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Generate cards (owner, 2026-11-24)
// ---------------------------------------------------------------------------
// A modal of pool priorities (src/model/cardPoolPlan.js) makes cards at exact combat power. Generated cards carry
// _generated, so Replace generated only finds them. One undo step; nothing reaches the game until Export.
const GENERATOR_CLASSES = Object.freeze(['colorless', ...REF_CLASSES]);
const GENERATOR_SAMPLE_NAMES = 8;
const GENERATE_PAINT_DELAY_MS = 30;

function generatorDefaults() {
  return { mode: 'replaceGenerated', ...clone(state.coreShape || MeasurePoolShape(buildCardList(), { scoring: state.repoScoring })) };
}

const generatorMaxRank = () => state.scoring.rank.maxRank;
const generatorForm = () => document.getElementById('gen-body');

function renderGeneratorForm(settings) {
  const body = generatorForm();
  body.innerHTML = RenderPoolForm(settings, { maxRank: generatorMaxRank(), statuses: Object.keys(state.scoring.statuses || {}), classes: GENERATOR_CLASSES });
  UpdatePoolSums(body, generatorMaxRank());
  document.getElementById('gen-preview').hidden = true;
}

function openGenerateDialog() {
  renderGeneratorForm({ ...generatorDefaults(), ...(state.generatorSettings || {}) });
  document.getElementById('generate-cards-modal').showModal();
}

// The form's settings; with normalise, each percent group is scaled to 100 and written back to the form so the owner sees what ran.
function readGeneratorSettings({ normalise = false } = {}) {
  const read = ReadPoolForm(generatorForm(), generatorMaxRank());
  if (!normalise) return read;
  const settings = NormaliseSettings(read, generatorMaxRank());
  renderGeneratorForm(settings);
  return settings;
}

function planGeneratedPool(settings) {
  const { mode, ...options } = settings;
  return PlanCardPool(options, { scoring: state.scoring, spellExposureBuildup: contentBundle.balance.exposure.elementUpgradeBuildup });
}

function previewGeneratedPool() {
  const settings = NormaliseSettings(readGeneratorSettings(), generatorMaxRank());
  const preview = document.getElementById('gen-preview');
  let plan;
  try {
    plan = planGeneratedPool(settings);
  } catch (err) {
    preview.hidden = false;
    preview.textContent = `Cannot plan these cards: ${err.message}`;
    return;
  }
  const line = (counts, label) => Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${label(k)} ${n}`).join(', ');
  preview.innerHTML = `
    <h4>${plan.count} cards</h4>
    <div><strong>Rarity:</strong> ${esc(line(plan.counts.rarity, (k) => k))}</div>
    <div><strong>Rank:</strong> ${esc(line(plan.counts.rank, (k) => RankName(Number(k))))}</div>
    <div><strong>School:</strong> ${esc(line(plan.counts.school, (k) => (k === 'none' ? 'no school' : k)))}</div>
    ${plan.martialToMagic ? `<div class="gen-preview-note">${plan.martialToMagic} martial card${plan.martialToMagic === 1 ? '' : 's'} became magic to fit the school counts.</div>` : ''}
    ${costRaisedCount(plan) ? `<div class="gen-preview-note">${costRaisedCount(plan)} card${costRaisedCount(plan) === 1 ? ' costs' : 's cost'} more than planned, to stay at their CP without an HP cost.</div>` : ''}
    ${plan.misses ? `<div class="gen-preview-note">${plan.misses === 1 ? '1 card is too strong for its CP and keeps' : `${plan.misses} cards are too strong for their CP and keep`} the nearest.</div>` : ''}
    <h4>Sample names</h4>
    <ul class="gen-sample-names">${plan.cards.slice(0, GENERATOR_SAMPLE_NAMES).map((c) => `<li>${esc(c.name)}</li>`).join('')}</ul>`;
  preview.hidden = false;
}

// The generator scores its own face; the studio measures the card in the class's reference fight, where class stats, weapon
// Poise and spell pricing move the numbers (measured 2026-11-24: 6 of 106 default cards matched). So each new card's primary
// amount is fitted until the studio's CP equals the target: one probe estimates CP per authored point, a jump lands near the
// target, then single steps finish. Returns the gap left (0 = exact).
const FIT_STEP_LIMIT = 60;
function fitCardToStudioCp(def, target) {
  const primary = def.effects?.[0];
  if (!primary || !Number.isFinite(primary.amount)) return Infinity;
  const cpAt = (amount) => { primary.amount = amount; return scoreCardEntry(def).cp; };
  let amount = primary.amount, cp = cpAt(amount);
  if (cp !== target) {
    const probe = Math.max(1, amount + (cp < target ? 2 : -2));
    if (probe !== amount) {
      const probeCp = cpAt(probe);
      const slope = (probeCp - cp) / (probe - amount);
      if (slope > 0) amount = Math.max(1, Math.round(amount + (target - cp) / slope));
      else amount = probe;
      cp = cpAt(amount);
    }
  }
  let best = { amount, gap: Math.abs(cp - target) };
  const dir = cp < target ? 1 : -1;
  for (let step = 0; best.gap > 0 && step < FIT_STEP_LIMIT && amount + dir >= 1; step++) {
    amount += dir;
    cp = cpAt(amount);
    const gap = Math.abs(cp - target);
    if (gap < best.gap) best = { amount, gap };
    if (dir > 0 ? cp > target : cp < target) break;
  }
  primary.amount = best.amount;
  return best.gap;
}

// Fits a generated card; when its riders still score too high at the smallest primary, the one-effect card of the same
// target is fitted too and the closer of the two kept.
function fitGeneratedCard(def, input, target) {
  const gap = fitCardToStudioCp(def, target);
  if (gap === 0 || input.effects === 1) return { def, gap };
  const plain = normalizeStudioCard({ ...GenerateCard({ ...input, effects: 1 }, { scoring: state.scoring, spellExposureBuildup: contentBundle.balance.exposure.elementUpgradeBuildup }), id: def.id, _custom: true, _generated: true, _autoName: true });
  const plainGap = fitCardToStudioCp(plain, target);
  return plainGap < gap ? { def: plain, gap: plainGap } : { def, gap };
}

// Cards the generator made dearer than the plan dealt them (it raises SP, then MP, before any HP cost).
function costRaisedCount(plan) {
  return plan.cards.filter((card, i) => {
    const input = plan.inputs[i] || {};
    const sp = card.staminaCost ?? card.cost ?? 0;
    return (Number.isFinite(input.sp) && sp > input.sp) || (Number.isFinite(input.mp) && (card.manaCost || 0) > input.mp);
  }).length;
}

function applyGeneratedPool() {
  const settings = readGeneratorSettings({ normalise: true });
  let plan;
  try {
    plan = planGeneratedPool(settings);
  } catch (err) {
    toast(`Cannot generate: ${err.message}`);
    return false;
  }
  pushHistory();
  state.generatorSettings = clone(settings);
  const kept = settings.mode === 'replaceAll' ? [] : settings.mode === 'add' ? state.cards : state.cards.filter((c) => !c._generated);
  const keptIds = new Set(kept.map((c) => c.id));
  // Removed Core cards leave the studio view only: their scoring overrides stay, so Export writes the same weights.
  // A removed generated card's override goes with it, so a new card that reuses its id never takes its rank pin.
  for (const gone of state.cards.filter((c) => !keptIds.has(c.id))) {
    if (gone._generated && state.scoring.overrides) delete state.scoring.overrides[gone.id];
    studioCardOverrides.delete(gone.id);
    studioCardOverrides.delete(`${LIVE_ID_PREFIX}${gone.id}`);
  }
  // Ids stay unique when Add to the pool runs twice with one seed.
  const fitted = plan.cards.map((card, i) => {
    let id = card.id;
    for (let k = 2; keptIds.has(id); k++) id = `${card.id}.${k}`;
    keptIds.add(id);
    return fitGeneratedCard(normalizeStudioCard({ ...card, id, _custom: true, _generated: true, _autoName: true }), plan.inputs[i], plan.targets[i]);
  });
  const fresh = fitted.map((f) => f.def);
  const exact = fitted.filter((f) => f.gap === 0).length;
  state.cards = [...fresh, ...kept];
  if (fresh.length)
  {
    selectStudioCard(fresh[0].id, SelectionOptions.DeferredReveal);
  }
  syncAllViews();
  saveDraft();
  toast(`Generated ${fresh.length} card(s), ${exact} at their exact CP. Undo puts the list back.`);
  return true;
}

function wireGenerateCards() {
  document.getElementById('btn-generate-cards').addEventListener('click', openGenerateDialog);
  const body = generatorForm();
  body.addEventListener('input', () => UpdatePoolSums(body, generatorMaxRank()));
  body.addEventListener('change', () => UpdatePoolSums(body, generatorMaxRank()));
  body.addEventListener('click', (e) => {
    if (e.target.closest('#btn-gen-dice')) {
      document.getElementById('gen-pool-seed').value = Math.floor(Math.random() * 1e9).toString(36);
      document.getElementById('gen-preview').hidden = true;
    }
  });
  document.getElementById('btn-gen-defaults').addEventListener('click', () => renderGeneratorForm({ ...generatorDefaults(), mode: readGeneratorSettings().mode }));
  document.getElementById('btn-gen-preview').addEventListener('click', previewGeneratedPool);
  // Scoring a whole pool takes a few seconds, so the button says so and the work starts after the next paint.
  document.getElementById('btn-gen-apply').addEventListener('click', (e) => {
    const button = e.currentTarget;
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'Generating…';
    setTimeout(() => {
      try {
        if (applyGeneratedPool()) document.getElementById('generate-cards-modal').close('generate');
      } finally {
        button.disabled = false;
        button.textContent = 'Generate';
      }
    }, GENERATE_PAINT_DELAY_MS);
  });
}

function renameAll() {
  pushHistory();
  const count = TurnOnAutoNames(state.cards);
  syncAutoNames({ render: false });
  renderCardsGrid();
  renderInspector();
  saveDraft();
  toast(count ? `Auto-name is on for ${count} more card(s). Undo puts the names back.` : 'Every card already uses Auto-name');
}

function openRenameAllDialog() {
  const dialog = document.getElementById('rename-all-modal');
  document.getElementById('rename-all-set-name').value = DefaultNameSetLabel();
  dialog.returnValue = '';
  dialog.showModal();
}

function finishRenameAllDialog() {
  const choice = document.getElementById('rename-all-modal').returnValue;
  if (choice !== 'save' && choice !== 'skip') return;
  if (choice === 'save') {
    const set = CaptureNameSet(state.cards, document.getElementById('rename-all-set-name').value);
    state.nameSets = SortedNameSets([set, ...state.nameSets]);
    storeNameSets();
    renderNameSetsList();
  }
  renameAll();
}

function restoreSelectedNameSet() {
  const set = nameSetById(selectedNameSetId);
  if (!set) return;
  pushHistory();
  const count = ApplyNameSet(state.cards, set);
  renderCardsGrid();
  renderInspector();
  saveDraft({ autoName: false });
  closeMenus();
  toast(count ? `Restored ${set.label} on ${count} card(s); Auto-name is off for them` : `Every card already has ${set.label}`);
}

function deleteNameSet(id) {
  state.nameSets = state.nameSets.filter((set) => set.id !== id);
  storeNameSets();
  renderNameSetsList();
}

// Save names / Save as / Load names (owner, 2026-11-24): card names as a JSON file. Save reuses the last file name;
// Save as asks for a name. Both also add the names to Restore names. Load adds the file's names there and gives them
// to the cards as one undo step.
let lastNamesFileLabel = '';

function downloadNameSet(set) {
  const blob = new Blob([JSON.stringify(NameSetFile(set), null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const fileName = NameSetFileName(set.label);
  Object.assign(document.createElement('a'), { href: url, download: fileName }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}

function saveNamesAs(label) {
  const set = CaptureNameSet(state.cards, label);
  lastNamesFileLabel = set.label;
  // Saving under a name already in the list replaces that set, so repeated Saves keep one entry.
  state.nameSets = SortedNameSets([set, ...state.nameSets.filter((other) => other.label !== set.label)]);
  storeNameSets();
  renderNameSetsList();
  toast(`Saved ${set.label} to ${downloadNameSet(set)}`);
}

function saveNames() {
  if (!lastNamesFileLabel) { openSaveNamesAsDialog(); return; }
  saveNamesAs(lastNamesFileLabel);
}

function openSaveNamesAsDialog() {
  const dialog = document.getElementById('save-names-modal');
  document.getElementById('save-names-label').value = lastNamesFileLabel || DefaultNameSetLabel();
  dialog.returnValue = '';
  dialog.showModal();
}

async function loadNamesFile(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  let sets;
  try {
    sets = ParseNameSetFile(JSON.parse(await file.text()));
  } catch (err) {
    toast(`Could not load names: ${err.message}`);
    return;
  }
  state.nameSets = MergeNameSets(state.nameSets, sets);
  storeNameSets();
  const set = sets[0];
  selectedNameSetId = set.id;
  lastNamesFileLabel = set.label;
  renderNameSetsList();
  pushHistory();
  const count = ApplyNameSet(state.cards, set);
  renderCardsGrid();
  renderInspector();
  saveDraft({ autoName: false });
  const more = sets.length > 1 ? ` (${sets.length - 1} more set(s) added to Restore names)` : '';
  toast(`Loaded ${set.label}: ${count} card(s) renamed${more}. Undo puts the names back.`);
}

function wireNameSets() {
  document.getElementById('btn-save-names').addEventListener('click', saveNames);
  document.getElementById('btn-save-names-as').addEventListener('click', openSaveNamesAsDialog);
  document.getElementById('save-names-modal').addEventListener('close', () => {
    if (document.getElementById('save-names-modal').returnValue === 'save') saveNamesAs(document.getElementById('save-names-label').value);
  });
  document.getElementById('save-names-label').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    document.getElementById('save-names-modal').close('save');
  });
  document.getElementById('input-load-names').addEventListener('change', loadNamesFile);
  document.getElementById('btn-rename-all').addEventListener('click', openRenameAllDialog);
  wireGenerateCards();
  document.getElementById('rename-all-modal').addEventListener('close', finishRenameAllDialog);
  // Enter in the name field saves (the form's first button is Cancel).
  document.getElementById('rename-all-set-name').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    document.getElementById('rename-all-modal').close('save');
  });
  const list = document.getElementById('restore-names-list');
  list.addEventListener('change', (e) => { if (e.target.name === 'name-set') selectedNameSetId = e.target.value; });
  list.addEventListener('click', (e) => {
    const remove = e.target.closest('[data-name-set-delete]');
    if (!remove) return;
    e.preventDefault();
    deleteNameSet(remove.dataset.nameSetDelete);
  });
  document.getElementById('btn-restore-names-apply').addEventListener('click', restoreSelectedNameSet);
  renderNameSetsList();
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
  if (kind === 'status') {
    if (key === 'barrier') return { token: 'barrier', clause: 'Gain {barrier} Poise.' };
    if (key === 'ward') return { token: 'ward', clause: 'Gain {ward} Ward.' };
    const self = state.scoring.statuses?.[key]?.target === 'self';
    return { token: key, clause: `${self ? 'Gain' : 'Apply'} {${key}} ${tokenLabel(key)}.` };
  }
  if (kind === 'effect' && key === 'damage') return { token: 'damage', clause: 'Deal {damage} damage.' };
  if (kind === 'effect' && key === 'block') return { token: 'block', clause: 'Gain {block} Block.' };
  if (kind === 'effect' && key === 'gainBarrier') return { token: 'gainBarrier', clause: 'Gain {gainBarrier} Poise.' };
  if (kind === 'effect' && key === 'restorePoise') return { token: 'restorePoise', clause: 'Restore {restorePoise} Poise.' };
  if (kind === 'effect' && key === 'poiseDamage') return { token: 'poiseDamage', clause: 'Deal {poiseDamage} Poise damage.' };
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
  tile.classList.toggle('is-new-draft', Boolean(def._newDraft));
  cardSelectionUi?.decorateTile(tile, def);
  cardEditorDockUi?.decorateTile(tile, def);
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

function getFilteredCards() {
  const q = document.getElementById('card-search').value.trim().toLowerCase();
  const typeF = document.getElementById('filter-type').value;
  const clsF = document.getElementById('filter-class').value;
  const rankF = document.getElementById('filter-rank').value;
  const shiftF = document.getElementById('filter-shift').value;
  const deckF = document.getElementById('filter-deck')?.value || 'all';
  const deckSet = filterMembership(state, deckF, 'cards');

  return state.cards.filter((c) => {
    const sc = scoreCardEntry(c);
    if (deckSet && !deckSet.has(c.id)) return false;
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
}

function renderCardsGrid() {
  const grid = document.getElementById('cards-grid');
  grid.classList.toggle('is-single', state.viewMode === 'single');
  const filtered = getFilteredCards();
  const galleryView = beginGalleryRender(
    GalleryKind.Cards,
    grid,
    filtered.map((def) => def.id),
  );

  grid.innerHTML = '';
  grid.appendChild(createAddCardTile({ onAdd: () => document.getElementById('btn-new-card').click() }));
  for (const def of filtered) {
    const sc = scoreCardEntry(def);
    const baseRank = state.baselineRanks[def.id];
    const shiftHtml = (baseRank !== undefined && baseRank !== sc.rank)
      ? `<span class="${sc.rank > baseRank ? 'shift-up' : 'shift-down'}">${sc.rank > baseRank ? '↑' : '↓'} R${baseRank}→R${sc.rank}</span>`
      : '';
    const tile = document.createElement('div');
    tile.className = 'studio-card-tile' + (def.id === state.selectedCardId ? ' is-selected' : '') + (def._newDraft ? ' is-new-draft' : '');
    tile.dataset.cardId = def.id;
    tile.innerHTML = `<div class="studio-card-stage"></div><div class="studio-card-meta">${tileMetaHtml(def, sc, shiftHtml)}</div>`;
    renderCardWithLayers(def, tile.querySelector('.studio-card-stage'), sc);
    tile.tabIndex = 0;
    const selectTile = () => {
      selectStudioCard(def.id);
    };
    tile.addEventListener('click', selectTile);
    tile.addEventListener('keydown', (e) => { if (e.target === tile && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectTile(); } });
    cardSelectionUi?.decorateTile(tile, def);
    cardEditorDockUi?.decorateTile(tile, def);
    grid.appendChild(tile);
  }
  cardSelectionUi?.refresh();
  cardEditorDockUi?.refresh();
  if (LOADING_SHOT_MODE !== 'loading') {
    setCardsLoading(false);
    trackCardsArtLoading(grid);
  }
  computeShiftCount();
  finishGalleryRender(
    GalleryKind.Cards,
    grid,
    galleryView,
  );
}

// selectStudioCard and selectStudioItem are the only writers of the active card and item.
// A missing id gives the empty state, never the first card.
const activeEntities = CreateActiveEntities({
  state,
  onChange: () =>
  {
    editBursts.endAll();
    saveWorkingContext();
  },
});

// View state for reload, under its own key. Writes start once boot has restored it.
let workingContextReady = false;

function saveWorkingContext()
{
  if (!workingContextReady)
  {
    return;
  }
  WriteWorkingContext(localStorage, {
    gallery: activeGallery,
    cardId: state.selectedCardId,
    itemKey: state.selectedItemKey,
  });
}

// Each gallery's ids in displayed order, as of its last render.
const displayedIds = PerGallery(null);

function isHiddenByFilters(kind, id)
{
  const displayed = displayedIds[kind];
  if (!id || !Array.isArray(displayed))
  {
    return false;
  }
  return !displayed.includes(id);
}

// An item's picker label: its kind in brackets, then its name.
function itemOptionLabel(item)
{
  const kindLabel = item.kind[0].toUpperCase() + item.kind.slice(1);
  return `[${kindLabel}] ${item.name || item.id}`;
}

// Each gallery's own renderers. Function declarations are hoisted, so they can be named here.
const GalleryView = Object.freeze({
  [GalleryKind.Cards]: Object.freeze({
    renderGrid: renderCardsGrid,
    renderInspector: renderInspector,
    renderPreview: (card, host) => renderCardWithLayers(card, host),
    optionLabel: card => card.name || card.id,
    updateFilterCount: updateFilterCount,
  }),
  [GalleryKind.Items]: Object.freeze({
    renderGrid: renderItemsGrid,
    renderInspector: renderItemInspector,
    renderPreview: (item, host) => renderItemCardPreview(
      item,
      host,
      ITEM_INSPECT_LEVEL,
    ),
    optionLabel: itemOptionLabel,
    updateFilterCount: updateItemFilterCount,
  }),
});

function clearGalleryFilters(kind)
{
  resetGalleryFilters(kind);
  GalleryView[kind].renderGrid();
}

const pendingReveal = new Set();

// The rebuild destroys the tiles, so keep focus and scroll.
function beginGalleryRender(
  kind,
  grid,
  ids,
)
{
  displayedIds[kind] = ids;
  return {
    focused: CaptureTileFocus(grid, TileIdAttribute[kind]),
    scrollTop: grid.scrollTop,
  };
}

function finishGalleryRender(
  kind,
  grid,
  { focused, scrollTop },
)
{
  if (grid.scrollTop !== scrollTop)
  {
    grid.scrollTop = scrollTop;
  }
  RestoreTileFocus(
    grid,
    TileIdAttribute[kind],
    focused,
    document.getElementById(GallerySearchId[kind]),
  );
  consumeReveal(kind);
}

function galleryTileSelector(kind, id)
{
  const tileClass = GalleryTileClass[kind];
  const idAttribute = `${DataAttributePrefix}${TileIdAttribute[kind]}`;
  return `.${tileClass}[${idAttribute}="${CSS.escape(id)}"]`;
}

function activeTile(kind)
{
  const id = activeEntities.get(kind);
  if (!id)
  {
    return null;
  }
  const grid = galleryGrid(kind);
  return grid?.querySelector(galleryTileSelector(kind, id)) || null;
}

function revealActiveTile(kind)
{
  const tile = activeTile(kind);
  tile?.scrollIntoView?.(REVEAL_SCROLL_OPTIONS);
}

// A setter called before a render shows its tile once that render lands.
function consumeReveal(kind)
{
  if (!pendingReveal.delete(kind))
  {
    return;
  }
  revealActiveTile(kind);
}

function markActiveTile(kind, activeId)
{
  const datasetKey = TileIdDatasetKey[kind];
  for (const tile of document.querySelectorAll(`.${GalleryTileClass[kind]}`))
  {
    tile.classList.toggle(SELECTED_TILE_CLASS, tile.dataset[datasetKey] === activeId);
  }
}

// Without render, a reveal waits for the next gallery render.
function selectGalleryEntity(
  kind,
  id,
  { render = true, reveal = false } = {},
)
{
  const { id: activeId } = activeEntities.set(kind, id);
  if (!render)
  {
    if (reveal)
    {
      pendingReveal.add(kind);
    }
    return activeId;
  }
  markActiveTile(kind, activeId);
  GalleryView[kind].renderInspector();
  renderArtTab();
  deckListPanelUi?.refresh();
  cardEditorDockUi?.refresh();
  if (reveal)
  {
    revealActiveTile(kind);
  }
  return activeId;
}

function selectStudioCard(id, options = {})
{
  const activeId = selectGalleryEntity(
    GalleryKind.Cards,
    id,
    options,
  );
  const rendered = options.render !== false;
  if (rendered && activeId && isNarrowLayout() && !cardEditorDockUi)
  {
    openInspectorSheet();
  }
  return activeId;
}

function selectStudioItem(key, options = {})
{
  return selectGalleryEntity(
    GalleryKind.Items,
    key,
    options,
  );
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
      ['effect:gainBarrier', 'Gain Bonus Poise (+5 Poise/stack)'],
      ['effect:restorePoise', 'Restore Poise'],
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
    'Statuses': Object.keys(state.scoring.statuses || {}).sort().map((id) => {
      if (id === 'barrier') return [`status:${id}`, 'Status: Bonus Poise (barrier)'];
      if (id === 'ward') return [`status:${id}`, 'Status: Ward — Temp HP (ward)'];
      return [`status:${id}`, `Status: ${id}`];
    }),
    'Keywords': Object.keys(state.scoring.keywords || {}).sort().map((id) => [`kw:${id}`, `Keyword: ${id}`]),
    'Weighted Tags': Object.entries(state.scoring.tags || {})
      .filter(([k, v]) => k[0] !== '$' && v && (v.weight || v.multiplier || v.pMultiplier || k === 'bonusPoise' || k.startsWith('school:') || k.startsWith('maneuver:')))
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
  const def = selectedCardDef();
  if (!def)
  {
    // No active card: clear the stale preview; never fall back to the first card.
    document.getElementById('inspector-card-preview').replaceChildren();
    document.getElementById('inspector-sheet-title').textContent = '';
    cardEditorDockUi?.refresh();
    return;
  }
  cardEditorDockUi?.refreshEntity?.();

  renderCardWithLayers(def, document.getElementById('inspector-card-preview'));
  document.getElementById('inspector-sheet-title').textContent = def.name || '';
  const sc = scoreCardEntry(def);
  renderScoreSummary(def, sc);
  const upgradeSummary = document.getElementById('inspector-upgrade-summary');
  upgradeSummary.textContent = def.upgradeMenu?.length ? `${def.id.startsWith('subclass.') ? 'CP projects conditional and next-card effects. ' : ''}Upgrade choices (unlocked by tier): ${upgradeNames(def).join(', ')}` : '';
  upgradeSummary.hidden = !def.upgradeMenu?.length;

  document.getElementById('edit-name').value = def.name || '';
  document.getElementById('toggle-auto-name').checked = Boolean(def._autoName);
  renderNameHint(def, sc);
  document.getElementById('btn-delete-card').classList.toggle('hidden', !isAddedCard(def));
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
      const statusDisplay = eff.status === 'barrier' ? 'Bonus Poise (barrier)' : eff.status === 'ward' ? 'Ward (ward)' : eff.status;
      row.innerHTML = `
        <span class="feature-label" title="${esc(featureTitleText(describeFeature('status', eff.status)))}">Status: <strong>${esc(statusDisplay)}</strong> ${infoButtonHtml()}</span>
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
    } else if (eff.op === 'grantCardCharge') {
      const labels = { damage: 'Damage', block: 'Block', heal: 'Healing', break: 'Poise damage', manaDiscount: 'Mana discount', buildup: `${eff.buildupStatus || 'Status'} buildup` };
      const fields = Object.keys(labels).filter(field => Number.isFinite(eff[field]));
      row.innerHTML = `<span class="feature-label">Next ${eff.abilityKind === 'spell' ? 'spell' : 'attack'} charge</span>
        <div class="feature-controls">${chipFor()}${fields.map(field => `<label>${esc(labels[field])}<input type="number" min="0" max="99" value="${esc(eff[field])}" data-eff-charge="${idx}" data-charge-field="${field}" /></label>`).join('')}<button class="s-btn s-btn-sm" data-rm-eff="${idx}">×</button></div>`;
    } else {
      const amtIsNum = eff.amount == null || (typeof eff.amount === 'number' && Number.isFinite(eff.amount));
      const isDirectStacks = eff.op === 'gainBarrier';
      const displayedAmt = isDirectStacks ? safeNum(eff.amount, 1) : (faceAmountFor(def, idx) ?? safeNum(eff.amount, 1));
      const amtTitle = isDirectStacks ? 'Bonus Poise stacks (+5 Poise per stack)' : "The card's own number, before the hero's bonus";
      const amtCtrl = amtIsNum
        ? `<input type="number" min="0" max="99" value="${esc(displayedAmt)}" data-eff-amt="${idx}" title="${esc(amtTitle)}" />`
        : '<span class="studio-muted" title="Formula-computed value">formula</span>';
      const opDisplay = eff.op === 'gainBarrier' ? 'Gain Bonus Poise (gainBarrier)' : eff.op;
      row.innerHTML = `
        <span class="feature-label" title="${esc(featureTitleText(describeFeature('effect', eff.op)))}">Effect: <strong>${esc(opDisplay)}</strong> ${infoButtonHtml()}</span>
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
  restorePoise:   { part: 'block',      weight: 'block' },
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
    if (eff.op === 'gainBarrier') {
      const status = state.scoring.statuses?.barrier;
      rows.push({
        part: status ? 'barrier' : null,
        count: eff.amount ?? 1,
        unitWeight: status?.weight,
        per: 1,
        sign: 1,
        exact: false,
        capAt: null,
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
  // Shown in the card banner, right of the name: rank, rarity, then CP. Spans only: it sits inside a button.
  // Each value is compared with the in-game card: higher reads red, lower reads green.
  const before = inGameScore(def);
  const rarity = String(sc.rarity || '').replace(/^./, (ch) => ch.toUpperCase());
  const rarityNow = RARITY_ORDER.indexOf(String(sc.rarity || '').toLowerCase());
  const rarityThen = before ? RARITY_ORDER.indexOf(String(before.rarity || '').toLowerCase()) : -1;
  document.getElementById('inspector-score-summary').innerHTML =
    `<span class="inspector-score-rank${trendClass(sc.rank, before?.rank)}"${trendTitle(before ? RankName(before.rank) : "", sc.rank, before?.rank) || (shiftTxt ? ` title="${esc(shiftTxt.trim().replace(/^\(|\)$/g, ''))} before weight changes"` : '')}>${esc(RankName(sc.rank))}</span>`
    + `<span class="inspector-score-rarity${rarityNow >= 0 && rarityThen >= 0 ? trendClass(rarityNow, rarityThen) : ''}"${rarityNow >= 0 && rarityThen >= 0 ? trendTitle(before.rarity, rarityNow, rarityThen) : ''}>${esc(rarity)}${sc.overridden ? ' · Overridden' : ''}</span>`
    + `<span class="inspector-score-big">CP: ${sc.cp}</span>${cpTrendHtml(sc, before)}`;
}

const RARITY_ORDER = Object.freeze(['starter', 'common', 'uncommon', 'rare', 'boss']);

// The card options menu beside the card. Each item runs the handler the rest of the Studio already uses.
function cardMenuActions() {
  const def = selectedCardDef();
  if (!def) return [];
  const added = isAddedCard(def), inGame = registries.cards.has(def.id);
  const openDecks = () => {
    cardSelectionUi?.select([def.id], { replace: true });
    setCustomizationView('decks');
    deckListPanelUi?.element.querySelector('[data-deck-select]')?.focus();
  };
  return [
    { label: 'Duplicate', run: () => document.getElementById('btn-duplicate-card').click() },
    { label: 'Delete', enabled: added, hint: added ? '' : 'Only cards you added can be deleted', run: () => document.getElementById('btn-delete-card').click() },
    { label: 'Reset to default', enabled: inGame && !!def._edited && !def._custom, hint: inGame ? (def._edited ? '' : 'No edits to reset') : 'Not a game card', run: () => document.getElementById('btn-reset-card').click() },
    { separator: true },
    { label: 'Add to deck…', run: openDecks },
    { label: 'Remove from deck…', run: openDecks },
    { label: 'Rebalance…', run: () => studioToolsUi.openBalanceSelection([def.id]) },
    { separator: true },
    { label: 'Edit card art', run: () => setCustomizationView('design') },
    { label: 'View or edit JSON…', run: () => openCardJson(def.id) },
    { label: 'Export card JSON', hint: 'Download this card as an importable JSON file', run: () => downloadJsonFile(`${def.id}.json`, { name: def.name, cards: [Object.fromEntries(Object.entries(def).filter(([key]) => !key.startsWith('_')))] }) },
    { label: 'Undock', enabled: cardEditorDockUi?.isDocked?.() !== false, run: () => cardEditorDockUi?.open?.() },
  ];
}

// View or edit one card as JSON. Applying goes through mutateSelectedCard, so it is one Undo step.
let cardJsonDialog = null;
function openCardJson(id) {
  const def = state.cards.find((card) => card.id === id);
  if (!def) return;
  if (!cardJsonDialog) {
    cardJsonDialog = document.createElement('dialog'); cardJsonDialog.id = 'card-json-dialog'; cardJsonDialog.className = 'card-json-dialog';
    cardJsonDialog.setAttribute('aria-labelledby', 'card-json-title');
    cardJsonDialog.innerHTML = `<h2 id="card-json-title"></h2>
      <p class="studio-muted">Edits apply to this card only and can be undone. The card ID cannot change here.</p>
      <textarea id="card-json-text" spellcheck="false" aria-label="Card JSON"></textarea>
      <p id="card-json-error" class="card-json-error" role="alert"></p>
      <div class="card-json-actions"><button type="button" class="s-btn" data-json-copy>Copy</button><button type="button" class="s-btn" data-json-close>Close</button><button type="button" class="s-btn s-btn-primary" data-json-apply>Apply</button></div>`;
    document.body.append(cardJsonDialog);
    cardJsonDialog.querySelector('[data-json-close]').addEventListener('click', () => cardJsonDialog.close());
    cardJsonDialog.querySelector('[data-json-copy]').addEventListener('click', () => navigator.clipboard?.writeText(cardJsonDialog.querySelector('#card-json-text').value).then(() => toast('Card JSON copied')));
    cardJsonDialog.querySelector('[data-json-apply]').addEventListener('click', applyCardJson);
  }
  const visible = Object.fromEntries(Object.entries(def).filter(([key]) => !key.startsWith('_')));
  cardJsonDialog.dataset.cardId = id;
  cardJsonDialog.querySelector('#card-json-title').textContent = `${def.name || id} JSON`;
  cardJsonDialog.querySelector('#card-json-text').value = JSON.stringify(visible, null, 2);
  cardJsonDialog.querySelector('#card-json-error').textContent = '';
  cardJsonDialog.showModal();
}

// Shape checks the Studio's renderers rely on, reported before anything changes.
function cardJsonProblem(card) {
  if (card.effects !== undefined) {
    if (!Array.isArray(card.effects)) return '"effects" must be a list.';
    const bad = card.effects.findIndex((effect) => !effect || typeof effect !== 'object' || Array.isArray(effect) || typeof effect.op !== 'string');
    if (bad >= 0) return `Effect ${bad + 1} must be an object with an "op" name.`;
  }
  if (card.tags !== undefined && (!Array.isArray(card.tags) || card.tags.some((tag) => typeof tag !== 'string'))) return '"tags" must be a list of text.';
  if (card.name !== undefined && typeof card.name !== 'string') return '"name" must be text.';
  if (card.textTemplate !== undefined && typeof card.textTemplate !== 'string') return '"textTemplate" must be text.';
  return '';
}

function applyCardJson() {
  const id = cardJsonDialog.dataset.cardId, error = cardJsonDialog.querySelector('#card-json-error');
  let next;
  try { next = JSON.parse(cardJsonDialog.querySelector('#card-json-text').value); } catch (err) { error.textContent = `Not valid JSON: ${err.message}`; return; }
  if (!next || typeof next !== 'object' || Array.isArray(next)) { error.textContent = 'The card must be one JSON object.'; return; }
  if (next.id !== id) { error.textContent = `Keep the card ID "${id}".`; return; }
  const problem = cardJsonProblem(next);
  if (problem) { error.textContent = problem; return; }
  // Dry run on a copy first: the live card is only touched by JSON that scores.
  try { scoreCardEntry(normalizeStudioCard(clone(next))); } catch (err) { error.textContent = `Not a valid card: ${err.message}`; return; }
  if (state.selectedCardId !== id) selectStudioCard(id);
  const index = state.cards.findIndex((card) => card.id === id), before = clone(state.cards[index]);
  const history = { undo: [...state.undoStack], redo: [...state.redoStack] };
  // An explicit name or text in the JSON wins, exactly like typing in the Name or Text field:
  // it switches that generation off instead of being overwritten by it.
  const nameChanged = (next.name ?? '') !== (before.name ?? ''), textChanged = (next.textTemplate ?? '') !== (before.textTemplate ?? '');
  // Snapshot everything first: a failed apply must also undo other cards' auto-names and the Auto-text setting.
  const snapshot = snapshotState(), autoTextBefore = document.getElementById('toggle-auto-text')?.checked;
  if (textChanged) {
    const autoTextToggle = document.getElementById('toggle-auto-text');
    if (autoTextToggle?.checked) { autoTextToggle.checked = false; writeStoredJson(AUTO_TEXT_KEY, false); }
  }
  try {
    mutateSelectedCard((card) => {
      const internal = Object.fromEntries(Object.entries(card).filter(([key]) => key.startsWith('_')));
      for (const key of Object.keys(card)) delete card[key];
      Object.assign(card, next, internal);
      if (nameChanged) card._autoName = false;
      if (textChanged) card._autoText = false;
    }, { autoName: !nameChanged, autoText: !textChanged });
  } catch (err) {
    // Roll back everything the edit touched: all cards, the history entry, the Auto-text setting and the views.
    try { restoreSnapshot(snapshot); } catch { /* Snapshot data is restored before the views; retain the original apply error. */ }
    finally {
      state.undoStack = history.undo;
      state.redoStack = history.redo;
      const autoTextToggle = document.getElementById('toggle-auto-text');
      if (autoTextToggle && autoTextBefore !== undefined && autoTextToggle.checked !== autoTextBefore) { autoTextToggle.checked = autoTextBefore; writeStoredJson(AUTO_TEXT_KEY, autoTextBefore); }
      updateUndoButtons();
    }
    error.textContent = `Not applied: ${err.message}`;
    return;
  }
  cardJsonDialog.close();
  toast(`Applied JSON to "${next.name || id}"`);
}

// The card as it ships in the game, scored with the game's weights; null for cards the game does not have.
function inGameScore(def)
{
  if (!registries.cards.has(def.id))
  {
    return null;
  }
  const original = registries.cards.get(def.id);
  const scored = scoreCardEntry(clone(original), state.repoScoring);
  return {
    cp: scored.cp,
    rank: scored.rank,
    rarity: original.rarity || scored.rarity,
  };
}

function trendClass(now, then) {
  if (!Number.isFinite(now) || !Number.isFinite(then) || now === then) return '';
  return now > then ? ' is-up' : ' is-down';
}

function trendTitle(thenLabel, now, then) {
  if (!Number.isFinite(now) || !Number.isFinite(then) || now === then) return '';
  return ` title="${esc(`${now > then ? 'Up' : 'Down'} from ${thenLabel} in game`)}"`;
}

// Arrow after CP: green and down when CP is below the in-game card, red and up when above.
function cpTrendHtml(sc, before) {
  if (!Number.isFinite(before?.cp) || before.cp === sc.cp) return '<span class="cp-trend" aria-hidden="true"></span>';
  const down = sc.cp < before.cp;
  const words = `${down ? 'down' : 'up'} from CP ${before.cp} in game`;
  return `<span class="cp-trend ${down ? 'is-down' : 'is-up'}" title="${esc(words)}" aria-label="${esc(words)}">${down ? '▼' : '▲'}</span>`;
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
    if (k === 'SP') return `${sc.face.sp} SP × ${S.costs.sp.weight}${S.costs.sp.multiplier === true ? ' × positive score' : ''}`;
    if (k === 'MP') return `${sc.face.mp} MP × ${S.costs.mp.weight}${S.costs.mp.multiplier === true ? ' × positive score' : ''}`;
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
  if (def.id?.startsWith('subclass.')) return SubclassCardText(def.effects || [], def.keywords || []);
  const parts = [];
  const area = (def.tags || []).includes('targeting:area') ? ' to ALL enemies' : '';
  for (const e of def.effects || []) {
    const amt = typeof e.amount === 'number' ? e.amount : 1;
    if (e.op === 'damage') parts.push(`Deal {damage} damage${e.hits > 1 ? ` ${e.hits} times` : ''}${area}.`);
    else if (e.op === 'block') parts.push('Gain {block} Block.');
    else if (e.op === 'ward') parts.push(`Gain ${amt} Ward.`);
    else if (e.op === 'gainBarrier') parts.push('Gain {gainBarrier} Poise.');
    else if (e.op === 'poiseDamage') parts.push(`Deal {poiseDamage} Poise damage${area}.`);
    else if (e.op === 'restorePoise') parts.push('Restore {restorePoise} Poise.');
    else if (e.op === 'applyStatus') {
      if (e.status === 'barrier') parts.push('Gain {barrier} Poise.');
      else if (e.status === 'ward') parts.push('Gain {ward} Ward.');
      else parts.push(`${e.target === 'self' ? 'Gain' : 'Apply'} {${e.status}} ${tokenLabel(e.status)}${e.target !== 'self' ? area : ''}.`);
    }
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

// One undo step per typing burst. A change of active entity ends every open burst.
const editBursts = CreateEditBursts({
  pushHistory: () => pushHistory(),
  delayMs: TEXT_EDIT_BURST_MS,
});
function createEditBurst()
{
  return editBursts.create();
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
  clearNewDraft(def);
  def._edited = true;
  applyAutoText(def);
  refreshSubclassEdit(def);
  refreshInspectorScoreInPlace(def);
  saveDraft();
}

// Card text Auto: while on, every feature edit rewrites the card text from its effects, the way Auto
// renames the card. Typing in the text box turns it off, so the designer's own words are never overwritten.
const AUTO_TEXT_KEY = 'ashenspire:scoreStudioAutoText:v1';
const isAutoText = () => Boolean(document.getElementById('toggle-auto-text')?.checked);

function applyAutoText(def) {
  if (!isAutoText() || def._autoText === false) return;
  def.textTemplate = textFromEffects(def);
  const textInput = document.getElementById('edit-text');
  if (textInput && document.activeElement !== textInput) textInput.value = def.textTemplate;
}

function refreshSubclassEdit(def) {
  if (!def.id?.startsWith('subclass.')) return;
  const refreshed = RefreshSubclassCard(def, { scoring: state.scoring, rebuildText: false });
  delete def.upgrade;
  Object.assign(def, refreshed);
}

function prepareCardEdit(def) {
  clearNewDraft(def);
  refreshSubclassEdit(def);
}

function clearNewDraft(def) {
  if (!def._newDraft) return;
  delete def._newDraft;
  delete def._autoText;
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
  const beforeEdit = JSON.stringify(def);
  fn(def);
  if (JSON.stringify(def) !== beforeEdit) { clearNewDraft(def); def._edited = true; }
  // Auto text and Auto-name run in the same step as the edit, so one undo reverts all three.
  if (autoText) applyAutoText(def);
  if (autoName) syncAutoNames({ render: false });
  refreshSubclassEdit(def);
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
// Every weight row, grouped, as the scoring config in state.scoring stands now (swap it with withScoring).
function buildWeightGroups() {
  const R = state.repoScoring;
  return [
    { key: 'costs', title: 'Costs (SP / MP)', entries: Object.entries(state.scoring.costs || {}).map(([k, v]) => ({
      id: k, label: k.toUpperCase(), val: v.weight, base: R.costs?.[k]?.weight, step: v.multiplier === true ? 0.05 : 1, set: (n) => { state.scoring.costs[k].weight = n; },
      mult: weightFormSwitch('costs', k, v),
    })) },
    { key: 'effects', title: 'Effects', entries: Object.entries(state.scoring.effects || {}).map(([k, v]) => ({
      id: k, label: k, val: v.weight, base: R.effects?.[k]?.weight, step: v.multiplier === true ? 0.05 : 1, set: (n) => { state.scoring.effects[k].weight = n; },
      per: { value: v.per, base: R.effects?.[k]?.per, set: (n) => { state.scoring.effects[k].per = n; } },
      mult: weightFormSwitch('effects', k, v),
    })) },
    { key: 'statuses', title: 'Statuses', entries: Object.entries(state.scoring.statuses || {}).map(([k, v]) => ({
      id: k, label: k === 'barrier' ? `Bonus Poise / barrier (${v.target})` : k === 'ward' ? `Ward (Temp HP) / ward (${v.target})` : `${k} (${v.target})`,
      val: v.weight, base: R.statuses?.[k]?.weight, step: v.multiplier === true ? 0.05 : 1, set: (n) => { state.scoring.statuses[k].weight = n; },
      mult: weightFormSwitch('statuses', k, v),
    })) },
    { key: 'keywords', title: 'Keywords', entries: Object.entries(state.scoring.keywords || {}).map(([k, v]) => {
      const bv = R.keywords?.[k];
      return {
        id: k, label: k, val: v.flat ?? v.multiplier, base: bv?.flat ?? bv?.multiplier, step: v.flat !== undefined ? 1 : 0.05,
        // Reads the stored form, not the one this row was drawn with: the switch may have changed it since.
        set: (n) => { const kw = state.scoring.keywords[k]; if (kw.flat !== undefined) kw.flat = n; else kw.multiplier = n; },
        // Flat adds `flat`; multiplier adds the positive score times it. Switching resets to the no-change value (0).
        mult: { value: v.flat === undefined, base: bv ? bv.flat === undefined : undefined, set: (on) => { SetKeywordForm(state.scoring.keywords[k], on); } },
        surcharge: { value: v.surchargeEnabled !== false, base: bv ? bv.surchargeEnabled !== false : true, set: (on) => { state.scoring.keywords[k].surchargeEnabled = Boolean(on); } },
      };
    }) },
    { key: 'rarity', title: 'Rarity Discounts', entries: Object.entries(state.scoring.rarity?.discount || {}).map(([k, v]) => ({ id: k, label: k, val: v, base: R.rarity?.discount?.[k], set: (n) => { state.scoring.rarity.discount[k] = n; } })) },
    { key: 'rank', title: 'Rank Bands', entries: [
      { id: 'unrankedMax', label: 'Unranked Max CP', val: state.scoring.rank.unrankedMax, base: R.rank?.unrankedMax, set: (n) => { state.scoring.rank.unrankedMax = n; } },
      { id: 'width', label: 'Band Width', val: state.scoring.rank.width, base: R.rank?.width, set: (n) => { state.scoring.rank.width = Math.max(1, n); } },
      { id: 'maxRank', label: 'Max Rank', val: state.scoring.rank.maxRank, base: R.rank?.maxRank, set: (n) => { state.scoring.rank.maxRank = Math.max(1, Math.round(n)); } },
      { id: 'effectCount', label: 'Multi-Effect Bonus', val: state.scoring.effectCount?.weight ?? 5, base: R.effectCount?.weight ?? 5, step: state.scoring.effectCount?.multiplier === true ? 0.05 : 1, set: (n) => { (state.scoring.effectCount ||= {}).weight = n; },
        mult: { value: state.scoring.effectCount?.multiplier === true, base: R.effectCount?.multiplier === true, set: (on) => { SetWeightForm(state.scoring.effectCount ||= {}, R.effectCount, on); } }, surcharge: { value: state.scoring.effectCount?.surchargeEnabled !== false, base: R.effectCount?.surchargeEnabled !== false, set: (on) => { (state.scoring.effectCount ||= {}).surchargeEnabled = Boolean(on); } } },
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
        surcharge: { value: v.surchargeEnabled !== false, base: bv ? bv.surchargeEnabled !== false : true, set: (on) => { categoryWeight(state.scoring, k).surchargeEnabled = Boolean(on); } },
      };
    }) },
    { key: 'tags', title: 'Weighted Tags', entries: Object.entries(state.scoring.tags || {}).filter(([k, v]) => {
      if (k[0] === '$' || !v) return false;
      const bv = R.tags?.[k];
      return k === 'bonusPoise' || v.weight !== 0 || v.multiplier !== undefined || v.pMultiplier !== undefined || (bv && (bv.weight !== 0 || bv.multiplier !== undefined || bv.pMultiplier !== undefined));
    }).map(([k, v]) => {
      const bv = R.tags?.[k];
      const isMult = v.multiplier !== undefined || v.pMultiplier !== undefined;
      // Which multiplier this tag uses when switched on: its own, else the repo's.
      // Every weighted tag can multiply: a tag with no multiplier of its own (or in the repo) switches to pMultiplier (P x n).
      const multKey = TagMultiplierKey(v, bv) || 'pMultiplier';
      return {
        id: k,
        label: `${v.label || k} (${k})`,
        val: v.multiplier ?? v.pMultiplier ?? v.weight ?? 0,
        base: bv ? (bv.multiplier ?? bv.pMultiplier ?? bv.weight ?? 0) : undefined,
        step: isMult ? 0.05 : 1,
        set: (n) => { const tag = state.scoring.tags[k]; if (tag.multiplier !== undefined) tag.multiplier = n; else if (tag.pMultiplier !== undefined) tag.pMultiplier = n; else tag.weight = n; },
        // Damage-type tags score once per action or once per hit (ScoreCard reads per === 'hit').
        per: v.per !== undefined ? { value: v.per, base: bv?.per, options: TAG_PER_OPTIONS, set: (n) => { state.scoring.tags[k].per = n; } } : null,
        // A multiplier tag may be set flat (adds its weight). Switching resets to the no-change value.
        mult: multKey ? { value: isMult, base: bv ? (bv.multiplier !== undefined || bv.pMultiplier !== undefined) : undefined, set: (on) => { SetTagForm(state.scoring.tags[k], multKey, on, R.tags?.[k]); } } : null,
        surcharge: { value: v.surchargeEnabled !== false, base: bv ? bv.surchargeEnabled !== false : true, set: (on) => { state.scoring.tags[k].surchargeEnabled = Boolean(on); } },
      };
    }) },
    { key: 'upgradeTags', title: 'Upgrade Tags & Surcharges', entries: [
      ...Object.entries(state.scoring.upgradeTags || {}).filter(([k, v]) => k[0] !== '$' && v && typeof v === 'object').map(([k, v]) => {
        const bv = R.upgradeTags?.[k];
        const isMult = v.mode === 'multiplicative';
        const baseIsMult = bv ? bv.mode === 'multiplicative' : false;
        return {
          id: k,
          label: `${v.label || k} (${k})`,
          val: isMult ? (v.pMultiplier ?? 0.1) : (v.base ?? (Array.isArray(v.stacks) ? v.stacks[0] : 0)),
          base: bv ? (baseIsMult ? (bv.pMultiplier ?? 0.1) : (bv.base ?? (Array.isArray(bv.stacks) ? bv.stacks[0] : 0))) : undefined,
          step: isMult ? 0.05 : 1,
          set: (n) => {
            const rule = state.scoring.upgradeTags[k];
            if (rule.mode === 'multiplicative') {
              rule.pMultiplier = n;
            } else {
              rule.base = n;
              const maxS = Math.max(1, Number(rule.maxStacks) || 3);
              rule.stacks = Array.from({ length: maxS }, (_, i) => (
                rule.escalate === 'linear' ? n * (i + 1) : n * Math.pow(2, i)
              ));
            }
          },
          mult: {
            value: isMult,
            base: baseIsMult,
            set: (on) => {
              const rule = state.scoring.upgradeTags[k];
              rule.mode = on ? 'multiplicative' : 'flat';
              if (on && !Number.isFinite(rule.pMultiplier)) rule.pMultiplier = 0.1;
              if (!on && !Number.isFinite(rule.base)) { rule.base = 0; rule.stacks = [0, 0, 0]; }
            },
          },
          surcharge: {
            value: v.surchargeEnabled !== false,
            base: bv ? bv.surchargeEnabled !== false : true,
            set: (on) => { state.scoring.upgradeTags[k].surchargeEnabled = Boolean(on); },
          },
        };
      }),
      {
        id: 'improved.effectMultPerStack',
        label: 'Improved Effect Multiplier / Stack',
        val: state.scoring.upgradeTags?.improved?.effectMultPerStack ?? 1.1,
        base: R.upgradeTags?.improved?.effectMultPerStack ?? 1.1,
        step: 0.05,
        set: (n) => { ((state.scoring.upgradeTags ||= {}).improved ||= {}).effectMultPerStack = Math.max(1, n); },
      },
    ] },
    { key: 'items', title: 'Equipment & Items', entries: [
      { id: 'weaponPoiseDamage.perPoint', label: 'Weapon Inherent Poise Dmg', val: state.scoring.items?.weaponPoiseDamage?.perPoint ?? 1, base: R.items?.weaponPoiseDamage?.perPoint ?? 1, step: 0.25, set: (n) => { ((state.scoring.items ||= {}).weaponPoiseDamage ||= { baseline: 1, perPoint: 1 }).perPoint = n; } },
      { id: 'weaponPoiseDamage.baseline', label: 'Weapon Poise Dmg Baseline', val: state.scoring.items?.weaponPoiseDamage?.baseline ?? 1, base: R.items?.weaponPoiseDamage?.baseline ?? 1, step: 1, set: (n) => { ((state.scoring.items ||= {}).weaponPoiseDamage ||= { baseline: 1, perPoint: 1 }).baseline = n; } },
      { id: 'poiseThreshold.perPoint', label: 'Armour Poise Weight', val: state.scoring.items?.poiseThreshold?.perPoint ?? 0.5, base: R.items?.poiseThreshold?.perPoint ?? 0.5, step: 0.25, set: (n) => { ((state.scoring.items ||= {}).poiseThreshold ||= { baseline: 0, perPoint: 0.5 }).perPoint = n; } },
      { id: 'poiseThreshold.baseline', label: 'Armour Poise Baseline', val: state.scoring.items?.poiseThreshold?.baseline ?? 0, base: R.items?.poiseThreshold?.baseline ?? 0, step: 1, set: (n) => { ((state.scoring.items ||= {}).poiseThreshold ||= { baseline: 0, perPoint: 0.5 }).baseline = n; } },
      { id: 'plays.weaponArt', label: 'Weapon Art Share', val: state.scoring.items?.plays?.weaponArt ?? 0.25, base: R.items?.plays?.weaponArt ?? 0.25, step: 0.05, set: (n) => { ((state.scoring.items ||= {}).plays ||= { strike: 3, defend: 2, weaponArt: 0.25 }).weaponArt = n; } },
      { id: 'range.reach', label: 'Reach Weapon Bonus', val: state.scoring.items?.range?.reach ?? 2, base: R.items?.range?.reach ?? 2, step: 0.5, set: (n) => { ((state.scoring.items ||= {}).range ||= { melee: 0, reach: 2, ranged: 3 }).reach = n; } },
      { id: 'range.ranged', label: 'Ranged Weapon Bonus', val: state.scoring.items?.range?.ranged ?? 3, base: R.items?.range?.ranged ?? 3, step: 0.5, set: (n) => { ((state.scoring.items ||= {}).range ||= { melee: 0, reach: 2, ranged: 3 }).ranged = n; } },
      { id: 'conditionFactor', label: 'Conditional Trait Factor', val: state.scoring.items?.conditionFactor ?? 0.65, base: R.items?.conditionFactor ?? 0.65, step: 0.05, set: (n) => { (state.scoring.items ||= {}).conditionFactor = n; } },
      { id: 'attributeBudgetCost', label: 'Gear Attribute Budget Cost', val: state.scoring.items?.attributeBudgetCost ?? 3, base: R.items?.attributeBudgetCost ?? 3, step: 1, set: (n) => { (state.scoring.items ||= {}).attributeBudgetCost = Math.max(0, Math.round(n)); } },
    ] },
    { key: 'gearFields', title: 'Gear Traits', entries: Object.entries(state.scoring.items?.gearFields || {}).map(([k, v]) => ({
      id: k,
      label: `${v.label || k} (${k})`,
      val: v.weight ?? 0,
      base: R.items?.gearFields?.[k]?.weight,
      step: 0.5,
      set: (n) => { state.scoring.items.gearFields[k].weight = n; },
    })) },
  ];
}

function weightEntryIn(groupList, groupKey, id) {
  return groupList.find((eg) => eg.key === groupKey)?.entries.find((e) => e.id === id);
}

// The groups as the applied config has them (to mark pending rows) and as Apply would make them (what rows show).
function weightGroupsShown() {
  const appliedGroups = buildWeightGroups();
  const staged = stagedScoring();
  return { appliedGroups, groups: staged ? withScoring(staged, buildWeightGroups) : appliedGroups };
}

function renderWeights({ shifts = true } = {}) {
  const q = document.getElementById('weights-search').value.trim().toLowerCase();
  const groupF = document.getElementById('weights-group-filter').value;
  const container = document.getElementById('weights-container');
  container.innerHTML = '';
  const { appliedGroups, groups } = weightGroupsShown();

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
    for (const r of rows) card.appendChild(buildWeightRow(g, r, appliedGroups));
    container.appendChild(card);
  }
  if (groupF === 'all' || groupF === 'naming') renderNamingLimitGroup(container, q);
  renderDescriptionGaps();
  updateWeightsToolbar();
  if (shifts) computeShiftCount();
  // The rows beside the card show the same staged values as this list.
  if (cardEditorDockUi?.getView?.() === 'weights') cardEditorDockUi.refreshContextFields?.();
}

// One weight row: label, the number box and its per / multiply / surcharge controls, reset and a worked example.
// Edits are staged through applyWeightEdit; the main list and the rows beside the card share this code.
function buildWeightRow(g, r, appliedGroups, { compact = false } = {}) {
  const numVal = safeNum(r.val, 0);
  const baseNum = r.base !== undefined ? safeNum(r.base, 0) : undefined;
  const applied = weightEntryIn(appliedGroups, g.key, r.id);
  const row = document.createElement('div');
  row.className = 'weight-row' + (r.per || r.mult || r.surcharge ? ' has-per' : '') + (compact ? ' is-compact' : '');
  // Rows for the same weight (the main list and the one beside the card) share this key and re-sync each other.
  row.dataset.weightKey = `${g.key}:${r.id}`;
  const kind = WEIGHT_GROUP_KINDS[g.key];
  // A compact row (beside the card) leaves the description and worked example to the main list.
  const info = kind && !compact ? describeFeature(kind, r.id) : null;
  const labelHtml = info
    ? `<span class="feature-label" title="${esc(featureTitleText(info))}">${esc(r.label)} ${infoButtonHtml()}</span>`
    : `<span>${esc(r.label)}</span>`;
  const resetTitle = `Reset to ${baseNum ?? numVal}${r.per ? ` per ${r.per.base ?? r.per.value}` : ''}`;
  // The row reads as a sentence: "[1] pts per [3] damage", with a worked example under it.
  const shownScoring = () => stagedScoring() || state.scoring;
  const words = weightSentence(g.key, r.id, shownScoring(), r.label);
  const weightBox = `<input type="number" class="weight-input" step="${esc(safeNum(r.step, 1))}" value="${esc(numVal)}" aria-label="${esc(`${r.label} points`)}" />`;
  row.innerHTML = `${labelHtml}<span class="weight-sentence"><span class="weight-words" data-part="before">${esc(words.before)}</span>${weightBox}<span class="weight-words" data-part="mid">${esc(words.mid)}</span>${perControlHtml(r)}<span class="weight-words" data-part="after">${esc(words.after)}</span>${multControlHtml(r)}${surchargeControlHtml(r)}<button type="button" class="weight-reset-btn" title="${esc(resetTitle)}" aria-label="${esc(`${r.label}: ${resetTitle}`)}">↺</button></span>${compact ? '' : '<div class="weight-example"></div>'}`;
  const input = row.querySelector('.weight-input');
  const perInput = row.querySelector('.weight-per');
  const multInput = row.querySelector('.weight-mult');
  const surchargeInput = row.querySelector('.weight-surcharge');
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
      if (r.surcharge && surchargeInput) r.surcharge.set(surchargeInput.checked);
    });
    return typed;
  };
  const showExample = (scoring = shownScoring()) => {
    const now = weightSentence(g.key, r.id, scoring, r.label);
    for (const part of row.querySelectorAll('.weight-sentence > .weight-words')) part.textContent = now[part.dataset.part];
    // Only a multiplier-form cost, effect, status, multi-effect bonus or tag reads the selected card's positive score.
    const multForm = WEIGHT_FORM_GROUPS.has(g.key) ? scoring[g.key]?.[r.id]?.multiplier === true : (g.key === 'rank' && r.id === 'effectCount' && scoring.effectCount?.multiplier === true) || (g.key === 'tags' && scoring.tags?.[r.id]?.pMultiplier !== undefined);
    const exampleText = weightExample(g.key, r.id, scoring, r.label, multForm ? exampleCard(scoring) : null);
    if (exampleEl) exampleEl.textContent = exampleText;
    // Compact rows beside the card keep only the value on the line; the full sentence and example are on hover.
    if (compact) row.firstElementChild.title = [`${r.label}: ${now.before} ${row.querySelector('.weight-input')?.value ?? ''} ${now.mid} ${now.after}`.replace(/\s+/g, ' ').trim(), exampleText].filter(Boolean).join('\n');
  };
  showExample();
  input.addEventListener('input', () => showExample(typedScoring()));
  if (perInput && !r.per.options) perInput.addEventListener('input', () => showExample(typedScoring()));
  // Staged edits update this row's marks in place, so focus and scroll stay where the owner left them.
  const perNow = () => (r.per.options ? perInput.value : Number(perInput.value));
  const perDiffers = (other) => Boolean(r.per) && other !== undefined && perNow() !== other;
  const multDiffers = (other) => Boolean(multInput) && other !== undefined && multInput.checked !== other;
  const surchargeDiffers = (other) => Boolean(surchargeInput) && other !== undefined && surchargeInput.checked !== other;
  const markRow = () => {
    const value = Number(input.value);
    const modified = (baseNum !== undefined && value !== baseNum) || perDiffers(r.per?.base) || multDiffers(r.mult?.base) || surchargeDiffers(r.surcharge?.base);
    const pending = !applied || value !== safeNum(applied.val, 0) || perDiffers(applied.per?.value) || multDiffers(applied.mult?.value) || surchargeDiffers(applied.surcharge?.value);
    row.classList.toggle('is-modified', modified);
    row.classList.toggle('is-pending', pending);
    row.classList.toggle('is-surcharge-off', Boolean(surchargeInput && !surchargeInput.checked));
    row.title = pending ? 'Staged: Apply to rescore the cards' : '';
    resetBtn.classList.toggle('is-clean', !modified);
  };
  // After an edit the row shows what its setter stored (Band Width 0 is stored as 1), then re-marks.
  const showStored = () => {
    const stored = weightEntryIn(withScoring(stagedScoring() || state.scoring, buildWeightGroups), g.key, r.id);
    if (stored) { input.value = String(safeNum(stored.val, 0)); input.step = String(safeNum(stored.step, 1)); }
    if (stored?.per && perInput) perInput.value = String(stored.per.value);
    if (stored?.mult && multInput) multInput.checked = stored.mult.value;
    if (stored?.surcharge && surchargeInput) surchargeInput.checked = stored.surcharge.value;
    markRow();
    showExample();
  };
  row.weightSync = showStored;
  const afterEdit = () => { showStored(); syncWeightTwins(row); };
  markRow();
  input.addEventListener('change', () => {
    const n = Number(input.value);
    if (!Number.isFinite(n)) return;
    applyWeightEdit(() => r.set(n));
    afterEdit();
  });
  perInput?.addEventListener('change', () => {
    const next = r.per.options ? perInput.value : Math.max(1, Math.round(Number(perInput.value)));
    if (!r.per.options && !Number.isFinite(next)) return;
    applyWeightEdit(() => r.per.set(next));
    afterEdit();
  });
  multInput?.addEventListener('change', () => {
    applyWeightEdit(() => r.mult.set(multInput.checked));
    afterEdit();
  });
  surchargeInput?.addEventListener('change', () => {
    applyWeightEdit(() => r.surcharge.set(surchargeInput.checked));
    afterEdit();
  });
  resetBtn.addEventListener('click', () => {
    const perChanged = perDiffers(r.per?.base) || multDiffers(r.mult?.base) || surchargeDiffers(r.surcharge?.base);
    if (baseNum === undefined && !perChanged) return;
    // Read the row's live controls: staged edits do not redraw it, so r.per / r.mult values can be stale.
    const resetMult = multDiffers(r.mult?.base);
    const resetPer = perDiffers(r.per?.base);
    const resetSurcharge = surchargeDiffers(r.surcharge?.base);
    applyWeightEdit(() => {
      if (resetMult) r.mult.set(r.mult.base);
      if (resetSurcharge) r.surcharge.set(r.surcharge.base);
      if (baseNum !== undefined) r.set(baseNum);
      if (resetPer) r.per.set(r.per.base);
    });
    afterEdit();
  });
  if (info) row.insertAdjacentHTML('beforeend', infoLineHtml(info));
  return row;
}

// The weight row each effect op is scored by: its EFFECT_SCORE_KEYS weight, else an effects entry of its own name.
function effectWeightKey(op) {
  const weight = EFFECT_SCORE_KEYS[op]?.weight ?? (state.scoring.effects?.[op] ? op : null);
  return weight ? `effects:${weight}` : null;
}

// The weight row a ScoreCard part is scored by, for one card (upgrade parts are named by the card's tags).
const SCORE_PART_EFFECT_WEIGHTS = Object.freeze({ 'HP cost': 'loseHp', counter: 'counterStack', blockBreak: 'blockBreak' });
function scorePartWeightKey(def, part) {
  if (part === 'SP' || part === 'MP') return `costs:${part.toLowerCase()}`;
  if (part.startsWith('category:')) return `categories:${part.slice('category:'.length)}`;
  if (part === 'effect count') return 'rank:effectCount';
  if (state.scoring.statuses?.[part]) return `statuses:${part}`;
  const effect = SCORE_PART_EFFECT_WEIGHTS[part] || Object.values(EFFECT_SCORE_KEYS).find((keys) => keys.part === part)?.weight;
  if (effect) return `effects:${effect}`;
  if (state.scoring.keywords?.[part]) return `keywords:${part}`;
  if (state.scoring.tags?.[part]) return `tags:${part}`;
  const upgrade = (def.tags || []).map(ParseUpgradeTag).find((parsed, i) => parsed && UpgradeTagLabel(def.tags[i]) === part);
  return upgrade ? `upgradeTags:${upgrade.family}` : null;
}

// The weights most edited for one card (owner, 2026-11-26): SP and MP cost, its card type, damage, then what
// its own effects and statuses are multiplied by in effect order; fewer than four of those are topped up with
// its largest other score parts.
const CONTEXT_FEATURE_ROWS = 4;
function cardWeightKeys(def) {
  const head = ['costs:sp', 'costs:mp'];
  const kind = cardKindOf(def);
  if (CATEGORY_KEYS.includes(kind)) head.push(`categories:${kind}`);
  const features = [];
  const effects = def.effects || [];
  if (effects.some((eff) => eff.op === 'damage')) features.push('effects:damage');
  for (const eff of effects) {
    const key = eff.op === 'applyStatus' ? `statuses:${eff.status}` : eff.op === 'gainBarrier' ? 'statuses:barrier' : effectWeightKey(eff.op);
    if (key && !features.includes(key)) features.push(key);
  }
  if (features.length < CONTEXT_FEATURE_ROWS) {
    const parts = Object.entries(scoreCardEntry(def).parts || {}).filter(([, value]) => value).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    for (const [part] of parts) {
      if (features.length >= CONTEXT_FEATURE_ROWS) break;
      const key = scorePartWeightKey(def, part);
      if (key && !head.includes(key) && !features.includes(key)) features.push(key);
    }
  }
  return [...head, ...features];
}

// The Weights view's rows beside the card: the same rows as the main list (staged, synced with their twins).
function renderCardWeightFields(container, def) {
  const { appliedGroups, groups } = weightGroupsShown();
  container.replaceChildren();
  for (const key of cardWeightKeys(def)) {
    const split = key.indexOf(':');
    const g = groups.find((group) => group.key === key.slice(0, split));
    const r = g && weightEntryIn(groups, g.key, key.slice(split + 1));
    if (!r) continue;
    // One small header over the toggle columns, before the first row that is not a cost.
    if (g.key !== 'costs' && !container.querySelector('.weight-context-head')) container.append(weightContextHead());
    container.append(buildWeightRow(g, r, appliedGroups, { compact: true }));
  }
  return container.children.length > 0;
}

function weightContextHead() {
  const head = document.createElement('div');
  head.className = 'weight-context-head'; head.setAttribute('aria-hidden', 'true');
  head.innerHTML = '<span title="The weight, its tag or feature">Tag / feature</span><span class="weight-sentence">'
    + '<span title="Points per unit: per SP, per stack, per damage">Pts</span>'
    + '<span title="Scalar: use the value as a multiplier of the card\'s positive score">Scalar</span>'
    + '<span title="Surcharge: apply this CP surcharge">Surch.</span><span></span></span>';
  return head;
}

// The Deck lists view's rows beside the card: every deck holding it (custom decks and the read-only class and
// subclass templates) and an Add to deck select. Changes go through the deck helpers and the panel's commit path.
function renderCardDeckFields(container, def) {
  const decks = deckCatalogOptions(state).filter((row) => row.kind !== 'all').map((row) => resolveStudioDeck(state, row.id)).filter(Boolean);
  const holding = decks.filter((deck) => deck.cardIds.includes(def.id));
  const addable = decks.filter((deck) => deck.kind === 'custom' && !deck.readOnly && !deck.cardIds.includes(def.id));
  const list = document.createElement('div');
  list.className = 'deck-context-list';
  // Deck ids hold no duplicates (resolveStudioDeck), so a row needs no copy count.
  const rows = holding.map((deck) => `<div class="deck-context-row" data-deck-id="${esc(deck.id)}">
      <span class="deck-context-name" title="${esc(deck.name)}">${esc(deck.name)}</span>
      ${deck.readOnly
    ? '<span class="deck-context-template" title="Read-only template">template</span>'
    : `<button type="button" class="s-btn s-btn-sm deck-context-remove" data-deck-remove="${esc(deck.id)}" aria-label="${esc(`Remove ${def.name} from ${deck.name}`)}">✕</button>`}
    </div>`).join('');
  const options = addable.map((deck) => `<option value="${esc(deck.id)}">${esc(deck.name)}</option>`).join('');
  list.innerHTML = `${rows || '<p class="studio-muted deck-context-empty">Not in any deck yet.</p>'}
    <select class="deck-context-add" aria-label="${esc(`Add ${def.name} to a deck`)}" ${addable.length ? '' : 'disabled'}><option value="">${addable.length ? 'Add to deck…' : 'No other deck to add to'}</option>${options}</select>`;
  // Same commit as the Deck lists panel: one undo step, the draft, then every view and the panel.
  const commit = (next, message) => {
    pushHistory();
    state.customDecks = next;
    saveDraft({ autoName: false });
    syncAllViews();
    deckListPanelUi?.refresh();
    toast(message);
  };
  // Listeners live on this list, which every render replaces, so they never pile up on the column.
  list.addEventListener('click', (e) => {
    const remove = e.target.closest('[data-deck-remove]');
    if (!remove) return;
    const deck = holding.find((row) => row.id === remove.dataset.deckRemove);
    try { commit(removeSelectedCardsFromDeck(state.customDecks, deck.id, [def.id]), `Removed ${def.name} from ${deck.name}.`); }
    catch (error) { toast(error.message); }
  });
  list.querySelector('.deck-context-add').addEventListener('change', (e) => {
    const deck = addable.find((row) => row.id === e.target.value);
    if (!deck) return;
    try { commit(addSelectedCardsToDeck(state.customDecks, deck.id, [def.id]), `Added ${def.name} to ${deck.name}.`); }
    catch (error) { toast(error.message); }
  });
  container.replaceChildren(list);
  return true;
}

// Fields beside the card in the Customize views other than Properties.
function renderContextFields(view, container, cardId) {
  const def = state.cards.find((card) => card.id === cardId);
  if (!def) return false;
  container.dataset.contextView = view;
  if (view === 'weights') return renderCardWeightFields(container, def);
  if (view === 'design') return renderCardArtFields(container, def);
  if (view === 'decks') return renderCardDeckFields(container, def);
  return false;
}

// After an edit in one row, every other row for the same weight shows the stored value too.
function syncWeightTwins(source) {
  for (const row of document.querySelectorAll('.weight-row[data-weight-key]')) {
    if (row !== source && row.dataset.weightKey === source.dataset.weightKey) row.weightSync?.();
  }
}

// Costs, effects and statuses switch between flat (weight per unit) and multiplier form (P x weight per unit, owner 2026-11-27).
// Switching resets to the no-change value: weight 0 when on, the repo's flat weight when off.
const WEIGHT_FORM_GROUPS = new Set(['costs', 'effects', 'statuses']);
function weightFormSwitch(section, key, entry) {
  const repo = state.repoScoring?.[section]?.[key];
  return { value: entry.multiplier === true, base: repo ? repo.multiplier === true : undefined, set: (on) => { SetWeightForm(state.scoring[section][key], repo, on); } };
}

// The selected card's name and positive score, for the multiplier-form examples; null with no card selected.
function exampleCard(scoringRef) {
  const def = selectedCardDef();
  if (!def) return null;
  try { return { name: def.name || def.id, positive: ScoreCard(cardDefToFace(def, scoringRef), scoringRef).positive }; } catch { return null; }
}

// Score categories (ScoreCard's scoring.categories): Martial, Magic and each Card Type.
const CATEGORY_KEYS = Object.freeze([...SCHOOL_CATEGORIES, ...CARD_KINDS]);

function categoryWeight(scoring, key) {
  scoring.categories ||= {};
  // A category the table lacks starts at the repo's weight (Hybrid +10), not at 0.
  scoring.categories[key] ||= clone(state.repoScoring?.categories?.[key] || { weight: 0, multiplier: false });
  return scoring.categories[key];
}

// "multiply instead" switch for category, keyword and multiplier-tag rows: off adds the number flat, on multiplies.
function multControlHtml(entry) {
  if (!entry.mult) return '';
  return `<label class="weight-per-label weight-mult-label" title="Off: add the number as flat points. On: use it as a multiplier of the card's positive score."><input type="checkbox" class="weight-mult" ${entry.mult.value ? 'checked' : ''} aria-label="${esc(`${entry.label} is a multiplier`)}" /> multiply instead</label>`;
}

// "surcharge" switch for upgrade tags, keywords, categories, weighted tags and multi-effect bonus: off disables the CP surcharge (0 pts).
function surchargeControlHtml(entry) {
  if (!entry.surcharge) return '';
  return `<label class="weight-per-label weight-surcharge-label" title="On: apply this CP surcharge. Off: disable it (0 CP)."><input type="checkbox" class="weight-surcharge" ${entry.surcharge.value ? 'checked' : ''} aria-label="${esc(`${entry.label} surcharge enabled`)}" /> surcharge</label>`;
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
function stageWholeScoring(incoming, sourceName) {
  // A studio config (Save, or an imported copy of it) carries name sets beside the weights: they join the list and
  // never reach the weights, so Apply and Export cannot write them into the game's scoring.json.
  const { scoring, nameSets } = SplitSavedConfig(incoming);
  if (nameSets.length) { state.nameSets = MergeNameSets(state.nameSets, nameSets); storeNameSets(); renderNameSetsList(); }
  const errors = ValidateScoringConfig(scoring);
  if (errors.length) throw new Error(errors.join(' '));
  // A config saved before convention names gets the repo's naming tables and loses the retired word tables.
  state.pendingScoring = RefreshRestoredNaming(clone(scoring), state.repoScoring);
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

// What each part of a convention name is, for the keep-order list.
const NAME_PART_LABELS = Object.freeze({ base: 'Base word (Strike)', rank: 'Rank numeral (II)', upgrade: 'Upgrade mark (+)', element: 'Element word (Frost)', effect: 'Second-effect word (Searing)', rarity: 'Rarity word (Greater)' });

// The card name length limit (scoring.naming.card.limit): a characters box and the keep order, most important first.
// Edits are staged like other weight edits; Apply renames. An empty box means no limit.
// The keep order a limit uses; an empty or missing list shows (and edits) the default order, so the owner can always reorder.
function KeepOrderOf(limit)
{
  return limit?.keep?.length ? [...limit.keep] : [...NAME_LIMIT_PARTS];
}

function renderNamingLimitGroup(container, query) {
  if (query && !'naming name length limit characters keep order'.includes(query)) return;
  const shown = () => (stagedScoring() || state.scoring).naming?.card?.limit || null;
  const appliedLimit = () => state.scoring.naming?.card?.limit || null;
  const group = document.createElement('details');
  group.className = 'weight-group-card studio-section naming-limit-group';
  group.dataset.section = 'weights-naming-limit';
  group.open = true;
  rememberSection(group);
  const stage = (fn) => {
    applyWeightEdit(() => {
      const card = ((state.scoring.naming ||= clone(shippedScoring.naming)).card ||= {});
      fn(card);
    });
    draw();
  };
  const draw = () => {
    const limit = shown();
    const keep = KeepOrderOf(limit);
    const pending = JSON.stringify(limit) !== JSON.stringify(appliedLimit());
    group.classList.toggle('is-pending', pending);
    group.innerHTML = `<summary class="section-head"><h3>Naming</h3></summary>
      <div class="weight-row naming-limit-row${pending ? ' is-pending' : ''}"><span>Name length</span><span class="weight-sentence"><input type="number" class="weight-input naming-max-chars" min="1" step="1" value="${Number.isFinite(limit?.maxChars) ? esc(limit.maxChars) : ''}" placeholder="none" aria-label="Most characters in a card name" /><span class="weight-words">characters max</span></span>
      <div class="weight-example">Too long: drop parts from the bottom of this list until the name fits. Base, rank and upgrade always stay. Empty: no limit.</div></div>
      <ol class="naming-keep-list">${keep.map((part, i) => `<li class="naming-keep-item" data-part="${esc(part)}"><span>${esc(NAME_PART_LABELS[part] || part)}</span><button type="button" class="naming-keep-move" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="${esc(`Move ${part} up`)}">↑</button><button type="button" class="naming-keep-move" data-dir="1" ${i === keep.length - 1 ? 'disabled' : ''} aria-label="${esc(`Move ${part} down`)}">↓</button></li>`).join('')}</ol>`;
    group.querySelector('.naming-max-chars').addEventListener('change', (e) => {
      const raw = e.target.value.trim();
      const n = Math.round(Number(raw));
      // Empty: no limit. A keep order already set stays, with no maxChars.
      if (raw === '') stage((card) => { if (card.limit?.keep) card.limit = { keep: [...card.limit.keep] }; else delete card.limit; });
      else if (Number.isFinite(n) && n >= 1) stage((card) => { card.limit = { maxChars: n, keep: KeepOrderOf(card.limit) }; });
    });
    for (const btn of group.querySelectorAll('.naming-keep-move')) {
      btn.addEventListener('click', () => {
        const part = btn.closest('.naming-keep-item').dataset.part;
        const dir = Number(btn.dataset.dir);
        stage((card) => {
          // Reordering never sets a length: with the box empty the limit stays off.
          const next = { ...(Number.isFinite(card.limit?.maxChars) ? { maxChars: card.limit.maxChars } : {}), keep: KeepOrderOf(card.limit) };
          const i = next.keep.indexOf(part), j = i + dir;
          if (i < 0 || j < 0 || j >= next.keep.length) return;
          [next.keep[i], next.keep[j]] = [next.keep[j], next.keep[i]];
          card.limit = next;
        });
        group.querySelector(`.naming-keep-item[data-part="${part}"] .naming-keep-move[data-dir="${dir}"]`)?.focus();
      });
    }
  };
  draw();
  container.appendChild(group);
}

// ---------------------------------------------------------------------------
// Items & Relics Tab (Weapons, Armours, Relics)
// ---------------------------------------------------------------------------
function renderItemCardPreview(entry, container, level = 'inspect', { preferEntry = false } = {}) {
  if (!entry || !container) return;
  container.innerHTML = '';
  let piece;
  if (preferEntry) {
    piece = livePieceFromEntry(entry);
    for (const key of ['props', 'tags', 'passives', 'triggers', 'mods']) {
      if (entry[key] != null) piece[key] = clone(entry[key]);
    }
  } else if (entry.kind === 'relic' && studioRegistries.relics.has(entry.id)) {
    piece = { ...studioRegistries.relics.get(entry.id), name: entry.name, rarity: entry.rarity };
  } else if (entry.kind === 'weapon') {
    const resolved = studioRegistries.equipment.armaments.find((a) => a.id === entry.id);
    piece = resolved ? { ...resolved, ...livePieceFromEntry(entry), itemTypes: resolved.itemTypes, tags: resolved.tags, propertyTags: resolved.propertyTags } : livePieceFromEntry(entry);
  } else if (entry.kind === 'armour') {
    const resolved = studioRegistries.equipment.armour.find((a) => a.id === entry.id && a.classId === entry.raw?.classId);
    piece = resolved ? { ...resolved, ...livePieceFromEntry(entry), tags: resolved.tags, propertyTags: resolved.propertyTags } : livePieceFromEntry(entry);
  } else {
    piece = livePieceFromEntry(entry);
  }
  const rendered = entry.kind === 'relic'
    ? renderCollectibleCard(studioRegistries, piece, 'Relic', { interactive: false, inspection: false, level, itemLayerConfig: state.itemArtLayers })
    : renderEquipmentCard(studioRegistries, piece, { interactive: false, inspection: false, level, itemLayerConfig: state.itemArtLayers });
  container.appendChild(rendered.card);
}

// Staged candidates share the authored art ID but never become the live card.
function withRebalancePreviewRegistry(action) {
  const savedOverrides = new Map(studioCardOverrides);
  try { return action(); }
  finally {
    studioCardOverrides.clear();
    for (const [id, definition] of savedOverrides) studioCardOverrides.set(id, definition);
  }
}

function renderRebalancePreview({ target, original, candidate, beforeElement, afterElement }) {
  if (!original) { beforeElement.replaceChildren(); afterElement.replaceChildren(); return null; }
  return withRebalancePreviewRegistry(() => {
    const before = clone(original), after = clone(candidate || original);
    if (target === 'items') {
      renderItemCardPreview(before, beforeElement, 'inspect', { preferEntry: true });
      renderItemCardPreview(after, afterElement, 'inspect', { preferEntry: true });
      return { before: ScoreGeneratedItem(before, state.scoring, state.itemRules), after: ScoreGeneratedItem(after, state.scoring, state.itemRules) };
    }
    const score = definition => {
      const face = cardDefToFace(definition, state.scoring), result = ScoreCard(face, state.scoring);
      const cp = CombatPower(result.raw, face.rarity, state.scoring);
      const mechanics = ProjectCardMechanicalValues(definition, { registries: studioRegistries, rules: refContextFor(definition).run });
      return { raw: result.raw, cp, rank: RankOf(cp, state.scoring), rarity: face.rarity, parts: result.parts, face,
        projectedEffects: mechanics.card.effects, faceTokens: mechanics.tokens, effectValues: mechanics.values, tokenBindings: mechanics.bindings };
    };
    const beforeScore = score(before), afterScore = score(after);
    renderCardWithLayers(before, beforeElement, beforeScore);
    renderCardWithLayers(after, afterElement, afterScore);
    return { before: beforeScore, after: afterScore };
  });
}

// The staged session has already taken its undo snapshot before this commit hook.
function prepareRebalanceCommit(entry, target = 'cards') {
  const id = target === 'items' ? entry.key : entry.id;
  if (state.scoring.overrides?.[id]) {
    const remaining = WithoutRankPin(state.scoring.overrides[id]);
    if (remaining) state.scoring.overrides[id] = remaining;
    else delete state.scoring.overrides[id];
  }
  if (entry.scoringOverride) {
    const remaining = WithoutRankPin(entry.scoringOverride);
    if (remaining) entry.scoringOverride = remaining;
    else delete entry.scoringOverride;
  }
  if (target === 'cards') prepareCardEdit(entry);
}

function populateRebalanceStatusOptions() {
  const effects = document.getElementById('rebal-effect-options');
  if (!effects) return;
  let statuses = document.getElementById('rebal-status-effect-options');
  if (!statuses) {
    const heading = document.createElement('p'); heading.className = 'studio-muted'; heading.textContent = 'Status effects';
    statuses = document.createElement('div'); statuses.id = 'rebal-status-effect-options'; statuses.className = 'rebalance-status-choices'; statuses.setAttribute('role', 'group'); statuses.setAttribute('aria-label', 'Preferred status effects');
    effects.append(heading, statuses);
  }
  const checked = new Set([...statuses.querySelectorAll('input:checked')].map(input => input.value));
  statuses.replaceChildren();
  for (const option of focusedEffectOptions(state.scoring).filter(row => row.kind === 'status')) {
    const label = document.createElement('label'); label.className = 'studio-check';
    const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.rebalEffect = ''; input.value = option.id; input.checked = checked.has(option.id);
    label.append(input, document.createTextNode(` ${option.label}`)); statuses.append(label);
  }
}

function populateItemTraitControls() {
  const selEl = document.getElementById('item-trait-selector');
  const fieldEl = document.getElementById('item-trait-field');
  const quickEl = document.getElementById('item-quick-traits');
  if (!selEl || !fieldEl || !quickEl) return;
  if (!selEl.options.length) {
    for (const s of ITEM_TRAIT_SELECTORS) {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.label;
      selEl.appendChild(o);
    }
  }
  const prevField = fieldEl.value;
  fieldEl.innerHTML = '';
  const gearFields = state.scoring.items?.gearFields || shippedScoring.items?.gearFields || {};
  for (const [k, v] of Object.entries(gearFields)) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = `${v.label || k} (${v.weight >= 0 ? `+${v.weight}` : v.weight})`;
    fieldEl.appendChild(o);
  }
  if (prevField && gearFields[prevField]) fieldEl.value = prevField;
  if (!quickEl.children.length) {
    for (const qt of ITEM_QUICK_TRAITS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'q-chip';
      btn.dataset.itemQuickTrait = qt.mod;
      btn.textContent = qt.label;
      quickEl.appendChild(btn);
    }
  }
}

function getFilteredItems() {
  const q = (document.getElementById('item-filter-search')?.value || '').trim().toLowerCase();
  const kindF = document.getElementById('item-filter-kind')?.value || 'all';
  const rarF = document.getElementById('item-filter-rarity')?.value || 'all';
  const rankF = document.getElementById('item-filter-rank')?.value || 'all';
  const deckSet = filterMembership(state, document.getElementById('filter-item-deck')?.value || 'all', 'items');

  return state.items.filter((entry) => {
    if (deckSet && !deckSet.has(entry.key)) return false;
    const sc = scoreItemEntry(entry, state.scoring, state.itemRules);
    if (kindF !== 'all' && entry.kind !== kindF) return false;
    if (rarF !== 'all' && entry.rarity !== rarF) return false;
    if (rankF !== 'all') {
      const rn = Number(rankF);
      if (rn >= 5 ? sc.rank < 5 : sc.rank !== rn) return false;
    }
    if (q) {
      const hay = `${entry.name} ${entry.id} ${entry.kind} ${entry.gearType || ''} ${entry.gearGroup || ''} ${sc.convention.name} ${(entry.mods || []).join(' ')} ${(entry.props || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderItemsGrid() {
  const grid = document.getElementById('items-grid');
  if (!grid) return;
  const sortF = document.getElementById('item-filter-sort')?.value || 'rank-desc';

  const filtered = getFilteredItems().map((entry) => ({ entry, sc: scoreItemEntry(entry, state.scoring, state.itemRules) }));

  filtered.sort((a, b) => {
    if (sortF === 'cp-desc') return b.sc.cp - a.sc.cp || a.entry.name.localeCompare(b.entry.name);
    if (sortF === 'cp-asc') return a.sc.cp - b.sc.cp || a.entry.name.localeCompare(b.entry.name);
    if (sortF === 'name') return a.entry.name.localeCompare(b.entry.name);
    return b.sc.rank - a.sc.rank || b.sc.cp - a.sc.cp || a.entry.name.localeCompare(b.entry.name);
  });

  const countEl = document.getElementById('items-count');
  if (countEl) countEl.textContent = `${filtered.length} / ${state.items.length} items`;
  const galleryView = beginGalleryRender(
    GalleryKind.Items,
    grid,
    filtered.map(({ entry }) => entry.key),
  );

  grid.innerHTML = '';
  for (const { entry, sc } of filtered) {
    const tile = document.createElement('div');
    tile.className = 'item-grid-tile' + (entry.key === state.selectedItemKey ? ' is-selected' : '');
    tile.dataset.itemKey = entry.key;
    const cardHost = document.createElement('div');
    cardHost.style.width = '100%';
    cardHost.style.display = 'flex';
    cardHost.style.justifyContent = 'center';
    renderItemCardPreview(entry, cardHost, 'glance');
    tile.appendChild(cardHost);

    const meta = document.createElement('div');
    meta.className = 'item-tile-meta';
    const sub = entry.kind === 'weapon'
      ? `${entry.gearType || 'weapon'} · P${entry.poiseDamage}`
      : entry.kind === 'armour'
        ? `${entry.gearGroup || 'armour'} · P${entry.poise}`
        : 'relic';
    meta.innerHTML = `<span class="item-kind-pill">${esc(sub)}</span><span>CP <strong>${esc(sc.cp)}</strong> · ${esc(RankName(sc.rank))}</span>`;
    tile.appendChild(meta);

    tile.addEventListener('click', () => selectStudioItem(entry.key));
    cardEditorDockUi?.decorateItemTile?.(tile, entry);
    grid.appendChild(tile);
  }
  cardEditorDockUi?.refresh();
  setItemsLoading(false);
  finishGalleryRender(
    GalleryKind.Items,
    grid,
    galleryView,
  );
}

function renderItemInspector() {
  const entry = FindGalleryEntity(
    state,
    GalleryKind.Items,
    state.selectedItemKey,
  );
  if (!entry)
  {
    // No active item: the pane shows its empty state rather than the first item.
    document.getElementById('item-preview-host')?.replaceChildren();
    cardEditorDockUi?.refresh();
    return;
  }
  cardEditorDockUi?.refreshEntity?.();
  populateItemTraitControls();
  const sc = scoreItemEntry(entry, state.scoring, state.itemRules);

  renderItemCardPreview(entry, document.getElementById('item-preview-host'), 'inspect');

  document.getElementById('item-score-raw').textContent = String(sc.raw);
  document.getElementById('item-score-disc').textContent = sc.disc ? `-${sc.disc}` : '0';
  document.getElementById('item-score-cp').textContent = String(sc.cp);
  document.getElementById('item-score-rank').textContent = RankName(sc.rank);

  const nameInput = document.getElementById('item-edit-name');
  if (document.activeElement !== nameInput) nameInput.value = entry.name || '';
  const hintEl = document.getElementById('item-convention-hint');
  if (hintEl) hintEl.textContent = `Convention name: ${sc.convention.name}${sc.convention.dropped?.length ? ` (trimmed: ${sc.convention.dropped.join(', ')})` : ''}`;

  document.getElementById('item-edit-rarity').value = entry.rarity || 'common';

  // Type / Group selector
  const typeWrap = document.getElementById('item-edit-type-wrap');
  const typeLabel = document.getElementById('item-edit-type-label');
  const typeSel = document.getElementById('item-edit-type');
  const poiseDmgWrap = document.getElementById('item-edit-poise-dmg-wrap');
  const rangeWrap = document.getElementById('item-edit-range-wrap');
  const poiseWrap = document.getElementById('item-edit-poise-wrap');

  if (entry.kind === 'weapon') {
    typeWrap.classList.remove('hidden');
    poiseDmgWrap.classList.remove('hidden');
    rangeWrap.classList.remove('hidden');
    poiseWrap.classList.add('hidden');
    typeLabel.textContent = 'Weapon Type';
    typeSel.innerHTML = Object.entries(GEAR_TYPES.weaponTypes || {}).map(([id, row]) => `<option value="${esc(id)}" ${entry.gearType === id ? 'selected' : ''}>${esc(row.label || id)} (Poise ${row.poiseDamage ?? 1})</option>`).join('');
    document.getElementById('item-edit-poise-dmg').value = String(entry.poiseDamage ?? 1);
    document.getElementById('item-edit-range').value = entry.range || 'melee';
  } else if (entry.kind === 'armour') {
    typeWrap.classList.remove('hidden');
    poiseDmgWrap.classList.add('hidden');
    rangeWrap.classList.add('hidden');
    poiseWrap.classList.remove('hidden');
    typeLabel.textContent = 'Armour Group';
    typeSel.innerHTML = Object.entries(GEAR_TYPES.armourGroups || {}).map(([id, row]) => `<option value="${esc(id)}" ${entry.gearGroup === id ? 'selected' : ''}>${esc(row.label || id)}</option>`).join('');
    document.getElementById('item-edit-poise').value = String(entry.poise ?? 0);
  } else {
    typeWrap.classList.add('hidden');
    poiseDmgWrap.classList.add('hidden');
    rangeWrap.classList.add('hidden');
    poiseWrap.classList.add('hidden');
  }

  // Inherited Type / Group Base Traits
  const baseList = document.getElementById('item-type-base-list');
  const baseMods = typeModsForEntry(entry);
  if (entry.kind === 'relic') {
    const props = (entry.props || []).map((p) => `<span class="item-base-chip">Property: ${esc(p)}</span>`).join('');
    baseList.innerHTML = props || '<span class="studio-muted">Passive / trigger relic</span>';
  } else {
    baseList.innerHTML = baseMods.length
      ? baseMods.map((raw) => {
        const info = describeItemMod(raw, state.scoring);
        const cls = info.pts > 0 ? 'pos' : info.pts < 0 ? 'neg' : 'zero';
        return `<span class="item-base-chip">Base: ${esc(info.label)} (${esc(raw)}) <span class="feature-score ${cls}">${info.pts >= 0 ? `+${info.pts}` : info.pts}</span></span>`;
      }).join('')
      : '<span class="studio-muted">No inherited type/group traits</span>';
  }

  // Editable Item Traits
  const traitsWrap = document.getElementById('item-trait-editor-wrap');
  const activeTraits = document.getElementById('item-active-traits');
  traitsWrap.classList.toggle('hidden', entry.kind === 'relic');
  activeTraits.innerHTML = '';
  (entry.mods || []).forEach((raw, idx) => {
    const info = describeItemMod(raw, state.scoring);
    const cls = info.pts > 0 ? 'pos' : info.pts < 0 ? 'neg' : 'zero';
    const row = document.createElement('div');
    row.className = 'feature-chip';
    row.innerHTML = `
      <span class="fc-title"><strong>${esc(info.label)}</strong> <span class="studio-muted">${esc(info.key)}</span></span>
      <span class="feature-score ${cls}">${info.pts >= 0 ? `+${info.pts}` : info.pts} pts</span>
      <input type="number" class="fc-num" data-item-mod-idx="${idx}" value="${esc(info.value)}" step="1" aria-label="${esc(info.label)} value" />
      <button type="button" class="s-btn s-btn-sm s-btn-warn" data-item-mod-del="${idx}" title="Remove trait">×</button>`;
    activeTraits.appendChild(row);
  });

  // Override fields
  const ov = state.scoring.overrides?.[entry.key] || null;
  document.getElementById('item-override-enabled').checked = Boolean(ov);
  document.getElementById('item-override-fields').classList.toggle('hidden', !ov);
  document.getElementById('item-override-rank').value = ov?.rank !== undefined ? String(ov.rank) : '';
  document.getElementById('item-override-cp').value = ov?.cp !== undefined ? String(ov.cp) : '';

  // Score Breakdown
  const partsEl = document.getElementById('item-score-parts-list');
  const entries = Object.entries(sc.parts || {});
  partsEl.innerHTML = entries.length
    ? entries.map(([k, v]) => {
      const r = Math.round(v * 10) / 10;
      const cls = r > 0 ? 'pos' : r < 0 ? 'neg' : 'zero';
      return `<div class="score-part-row"><span>${esc(k)}</span><strong class="feature-score ${cls}">${r >= 0 ? `+${r}` : r}</strong></div>`;
    }).join('')
    : '<div class="studio-muted">No scored parts (raw 0).</div>';
}

// ---------------------------------------------------------------------------
// Art & Layers Tab (Combat Cards + Weapons/Armours/Relics)
// ---------------------------------------------------------------------------
function activeArtLayersObj() {
  return state.artTarget === 'items' ? state.itemArtLayers : state.artLayers;
}
function activeArtLayerIdx() {
  return state.artTarget === 'items' ? state.selectedItemLayerIdx : state.selectedLayerIdx;
}
function setActiveArtLayerIdx(idx) {
  if (state.artTarget === 'items') state.selectedItemLayerIdx = idx;
  else state.selectedLayerIdx = idx;
}

// One edit from a layer control (the Art layers list, or the rows beside the card): the control's value goes
// into the layer, then the previews and the visible gallery update without rebuilding the layer controls.
function applyArtLayerInput(control, layer, isItems) {
  if (control.dataset.lEnabled !== undefined) layer.enabled = control.checked;
  else if (control.dataset.lKind) {
    const k = control.dataset.lKind;
    const set = new Set(layer.entityKinds || ['weapon', 'armour', 'relic']);
    if (control.checked) set.add(k); else set.delete(k);
    layer.entityKinds = [...set];
  }
  else if (control.dataset.lField) layer[control.dataset.lField] = control.value;
  else if (control.dataset.lNum) {
    layer[control.dataset.lNum] = safeNum(control.value, 0);
    if (control.dataset.lNum === 'opacity') {
      const span = control.closest('label')?.querySelector('.opacity-val');
      if (span) span.textContent = `${layer.opacity}%`;
    }
  }
  saveDraft();
  renderArtPreviewOnly();
  refreshGalleryArtSoon();
  if (isItems) renderItemInspector();
  else renderInspector();
}

// The Design view's rows beside the card: each card art layer that applies to it, with Show and Opacity bound to
// the layer (the same edit path as the Art layers list) and Edit to find it in that list.
let artContextHold = false;
function renderCardArtFields(container, def) {
  // While a row's control is in use (focused, or a pointer is down on it) the rows are kept, so an edit's
  // queued gallery refresh never rebuilds the slider under the pointer or takes keyboard focus away.
  const inUse = container.contains(document.activeElement) && document.activeElement.matches('input');
  const allLayers = state.artLayers.layers || [];
  // Undo or a reload replaces the layer list: then the rows are rebuilt even while in use, never left on stale layers.
  if (container.firstChild && container.dataset.cardId === def.id && container.artLayersRef === allLayers && (artContextHold || inUse)) return true;
  container.dataset.cardId = def.id; container.artLayersRef = allLayers;
  const layers = matchingCustomLayers(def, { includeDisabled: true });
  const list = document.createElement('div');
  list.className = 'art-context-list';
  if (!layers.length) {
    list.innerHTML = '<p class="studio-muted art-context-empty">No art layers match this card.</p>';
    container.replaceChildren(list);
    return true;
  }
  list.innerHTML = layers.map((layer) => {
    const idx = allLayers.indexOf(layer);
    const name = layer.name || layer.id;
    const opacity = safeNum(layer.opacity, 100);
    return `<div class="art-context-row${layer.enabled === false ? ' is-off' : ''}" data-layer-idx="${idx}">
      <span class="art-context-name" title="${esc(name)}">${esc(name)}</span>
      <label class="art-context-show"><input type="checkbox" data-l-enabled="${idx}" ${layer.enabled !== false ? 'checked' : ''} aria-label="${esc(`Show ${name}`)}" /> Show</label>
      <button type="button" class="s-btn s-btn-sm art-context-edit" data-layer-edit="${idx}" aria-label="${esc(`Edit ${name} in the layer list`)}">Edit</button>
      <label class="art-context-opacity"><input type="range" data-l-num="opacity" data-l-idx="${idx}" min="0" max="100" value="${esc(opacity)}" aria-label="${esc(`${name} opacity`)}" /><span class="opacity-val">${esc(opacity)}%</span></label>
    </div>`;
  }).join('');
  // Listeners live on this list, which every render replaces, so they never pile up on the column.
  let historyPushed = false;
  list.addEventListener('focusin', () => { historyPushed = false; });
  list.addEventListener('input', (e) => {
    const idx = Number(e.target.dataset.lIdx ?? e.target.dataset.lEnabled);
    // Read the layer from the current state at edit time, not from the list these rows were built from.
    const layer = (state.artLayers.layers || [])[idx];
    if (!layer) return;
    if (!historyPushed) { pushHistory(); historyPushed = true; }
    applyArtLayerInput(e.target, layer, false);
    e.target.closest('.art-context-row')?.classList.toggle('is-off', layer.enabled === false);
    mirrorArtListControls(idx, layer);
  });
  list.addEventListener('pointerdown', () => {
    artContextHold = true;
    window.addEventListener('pointerup', () => { artContextHold = false; }, { once: true });
  });
  list.addEventListener('change', () => { historyPushed = false; renderCardsGrid(); });
  list.addEventListener('click', (e) => {
    const edit = e.target.closest('[data-layer-edit]');
    if (edit) showArtLayerInList(Number(edit.dataset.layerEdit));
  });
  container.replaceChildren(list);
  return true;
}

// The Art layers list shows an edit made beside the card without being rebuilt.
function mirrorArtListControls(idx, layer) {
  if (state.artTarget === 'items') return;
  const cardEl = document.querySelector(`#art-layers-list .layer-card[data-layer-card-idx="${idx}"]`);
  if (!cardEl) return;
  const show = cardEl.querySelector(`[data-l-enabled="${idx}"]`);
  if (show) show.checked = layer.enabled !== false;
  const opacity = cardEl.querySelector('[data-l-num="opacity"]');
  if (opacity) {
    opacity.value = String(safeNum(layer.opacity, 100));
    const span = opacity.closest('label')?.querySelector('.opacity-val');
    if (span) span.textContent = `${safeNum(layer.opacity, 100)}%`;
  }
}

// Edit beside the card: select that card layer in the Art layers list, open its section and bring it into view.
function showArtLayerInList(idx) {
  showGallery(GalleryKind.Cards);
  setActiveArtLayerIdx(idx);
  renderArtTab();
  const cardEl = document.querySelector(`#art-layers-list .layer-card[data-layer-card-idx="${idx}"]`);
  if (!cardEl) return;
  const section = cardEl.closest('details');
  if (section && !section.open) section.open = true;
  cardEl.scrollIntoView({ block: 'center' });
  cardEl.querySelector('[data-l-field="name"]')?.focus({ preventScroll: true });
}

function renderArtPreviewOnly()
{
  const pickerSelect = document.getElementById(ART_PREVIEW_SELECT_ID);
  const host = document.getElementById(ART_LIVE_PREVIEW_ID);
  const kind = ToGalleryKind(state.artTarget);
  const entity = FindGalleryEntity(
    state,
    kind,
    pickerSelect.value,
  );
  if (!entity)
  {
    host.replaceChildren();
    return;
  }
  GalleryView[kind].renderPreview(entity, host);
}

// The Design picker follows the gallery's active card or item.
function renderArtPicker()
{
  const pickerSelect = document.getElementById(ART_PREVIEW_SELECT_ID);
  pickerSelect.innerHTML = '';
  const pickerKind = ToGalleryKind(state.artTarget);
  const pickerEntities = GalleryEntity[pickerKind];
  const options = pickerEntities.list(state).map((entity) => [
    pickerEntities.idOf(entity),
    GalleryView[pickerKind].optionLabel(entity),
  ]);
  const activeId = activeEntities.get(pickerKind);
  if (!activeId)
  {
    const placeholder = NoActiveEntityOption[pickerKind];
    pickerSelect.appendChild(new Option(placeholder, NO_ENTITY_OPTION_VALUE));
  }
  for (const [value, text] of options)
  {
    pickerSelect.appendChild(new Option(text, value));
  }
  pickerSelect.value = activeId || NO_ENTITY_OPTION_VALUE;
}

function renderArtTab() {
  const list = document.getElementById('art-layers-list');
  const assets = Object.values(reviewedCardArtCatalog.assets || {});
  document.getElementById('asset-count').textContent = String(assets.length);
  const isItems = state.artTarget === 'items';

  document.getElementById('btn-art-target-cards')?.classList.toggle('is-active', !isItems);
  document.getElementById('btn-art-target-items')?.classList.toggle('is-active', isItems);
  const desc = document.getElementById('art-layers-desc');
  if (desc) {
    desc.textContent = isItems
      ? 'Configure layered art for weapons, armours, and relics (content/source/itemArtLayers.json). Match by trait, element, poise, weapon type, armour group, rarity, or default, and combine approved cutout PNGs with SVG motifs.'
      : 'Assign PNG assets to card components, set priority match rules (tag, school, status, type, or default), reorder Z-index layers, and adjust position, scale, opacity, and blend mode. Changes reflect live on the selected card and gallery.';
  }

  renderArtPicker();
  renderArtPreviewOnly();

  const layersObj = activeArtLayersObj();
  const layers = layersObj.layers || [];
  if (activeArtLayerIdx() >= layers.length) setActiveArtLayerIdx(Math.max(0, layers.length - 1));
  const selIdx = activeArtLayerIdx();

  list.innerHTML = '';
  layers.forEach((layer, idx) => {
    const el = document.createElement('div');
    el.className = 'layer-card' + (idx === selIdx ? ' is-selected' : '');
    el.dataset.layerCardIdx = String(idx);
    const matchOptions = isItems
      ? [
        ['trait', 'Trait / Mod'],
        ['element', 'Element'],
        ['poise', 'Poise Rule'],
        ['gearType', 'Weapon Type'],
        ['armourGroup', 'Armour Group'],
        ['rarity', 'Rarity'],
        ['tag', 'Tag'],
        ['default', 'Always (Default)'],
      ]
      : [
        ['tag', 'Tag'],
        ['status', 'Status'],
        ['type', 'Card Type'],
        ['default', 'Always (Default)'],
      ];
    const modeOptions = isItems
      ? [['under', 'Behind item (aura)'], ['stack', 'On top (sigil)']]
      : [['stack', 'Stack on top'], ['replace', 'Replace slot']];
    const kindsHtml = isItems
      ? `<div class="layer-kind-checks" style="grid-column: span 2;"><span>Applies to:</span>${['weapon', 'armour', 'relic'].map((k) => `<label class="studio-check"><input type="checkbox" data-l-kind="${k}" data-l-idx="${idx}" ${(layer.entityKinds || ['weapon', 'armour', 'relic']).includes(k) ? 'checked' : ''} /> ${k}</label>`).join('')}</div>`
      : '';
    const extraItemFields = isItems
      ? `
        <label>SVG Motif
          <select data-l-field="motif" data-l-idx="${idx}">
            ${ITEM_MOTIF_OPTIONS.map((m) => `<option value="${esc(m)}" ${(layer.motif || '') === m ? 'selected' : ''}>${m || '(none)'}</option>`).join('')}
          </select>
        </label>
        <label>Tint Color <input type="text" data-l-field="color" data-l-idx="${idx}" value="${esc(layer.color || '#c9a227')}" placeholder="#c9a227" /></label>
        <label>Glow Color <input type="text" data-l-field="glow" data-l-idx="${idx}" value="${esc(layer.glow || '')}" placeholder="optional #hex" /></label>`
      : '';
    el.innerHTML = `
      <div class="layer-card-head">
        <strong>#${idx + 1} · ${esc(layer.name || layer.id)}</strong>
        <div>
          <label class="studio-toggle"><input type="checkbox" data-l-enabled="${idx}" ${layer.enabled !== false ? 'checked' : ''} /> On</label>
          <button class="s-btn s-btn-sm" data-l-up="${idx}" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="s-btn s-btn-sm" data-l-down="${idx}" ${idx === layers.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="s-btn s-btn-sm s-btn-warn" data-l-del="${idx}">×</button>
        </div>
      </div>
      <div class="layer-grid">
        ${kindsHtml}
        <label>Name <input type="text" data-l-field="name" data-l-idx="${idx}" value="${esc(layer.name)}" /></label>
        <label>Match Rule
          <select data-l-field="matchKind" data-l-idx="${idx}">
            ${matchOptions.map(([val, lbl]) => `<option value="${val}" ${layer.matchKind === val ? 'selected' : ''}>${lbl}</option>`).join('')}
          </select>
        </label>
        <label>Match Value <input type="text" data-l-field="matchValue" data-l-idx="${idx}" value="${esc(layer.matchValue)}" placeholder="${isItems ? 'e.g. hitBurn,statPoise or weaponPoise>=3' : 'e.g. school:fire'}" /></label>
        <label>PNG Asset ID <input type="text" data-l-field="assetId" data-l-idx="${idx}" value="${esc(layer.assetId)}" placeholder="click thumbnail →" /></label>
        <label>Mode
          <select data-l-field="mode" data-l-idx="${idx}">
            ${modeOptions.map(([val, lbl]) => `<option value="${val}" ${layer.mode === val ? 'selected' : ''}>${lbl}</option>`).join('')}
          </select>
        </label>
        <label>Blend Mode
          <select data-l-field="blendMode" data-l-idx="${idx}">
            ${['normal', 'screen', 'multiply', 'overlay', 'color'].map((m) => `<option value="${m}" ${layer.blendMode === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </label>
        ${extraItemFields}
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
    t.title = `${a.id} — ${a.name} (click to assign to selected layer #${selIdx + 1})`;
    t.innerHTML = `<img src="${esc(a.path)}" loading="lazy" alt="" /><div title="${esc(a.id)}">${esc(a.id)}</div>`;
    t.addEventListener('click', () => {
      const targetLayer = layers[activeArtLayerIdx()] || layers[0];
      if (!targetLayer) return;
      pushHistory();
      targetLayer.assetId = a.id;
      saveDraft();
      renderArtTab();
      if (isItems) { renderItemsGrid(); renderItemInspector(); }
      else { renderCardsGrid(); renderInspector(); }
      toast(`Assigned ${a.id} to layer #${activeArtLayerIdx() + 1}`);
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
  const activeDeck = (state.customDecks || []).find((d) => d.isActiveDeckList)
    || (state.customDecks || []).find((d) => d.assignedClassId === classId);
  if (activeDeck && activeDeck.cardIds.length) {
    const deckCards = activeDeck.cardIds
      .map((id) => state.cards.find((c) => c.id === id))
      .filter(Boolean);
    if (deckCards.length) {
      run.deck = deckCards.map((c, idx) => ({ instanceId: `deck-${idx}`, cardId: liveCardIdFor(c), upgraded: false }));
    }
  }
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
    .map(([k, n]) => `${k === 'barrier' ? 'Bonus Poise' : k === 'ward' ? 'Ward' : k} ${n}`)
    .join(', ') || 'None';

  const pWardHp = EffectiveWardHp(combat, p);
  const pPoise = p.persistentPoise;
  const pBonus = pPoise?.barrierBonus || 0;
  document.getElementById('sandbox-player-panel').innerHTML = `
    <h4>Player (${esc(state.sandbox.classId)})</h4>
    <div class="stat-line">
      <span>HP: <strong>${p.hp}/${p.maxHp}</strong>${pWardHp > 0 ? ` <span class="sandbox-ward-hp">+${pWardHp} Ward</span>` : ''}</span>
      <span>Block: <strong>${p.block || 0}</strong></span>
      <span>Poise: <strong>${pPoise?.value ?? 0}/${pPoise?.max ?? 0}</strong>${pBonus > 0 ? ` <span class="sandbox-poise-bonus">(+${pBonus} Bonus)</span>` : ''}</span>
      <span>SP: <strong>${p.stamina ?? p.energy ?? 0}</strong></span>
      <span>MP: <strong>${p.mana ?? 0}</strong></span>
    </div>
    <div class="studio-muted">Statuses: ${esc(fmtStatuses(p))}</div>
  `;

  const eWardHp = e ? EffectiveWardHp(combat, e) : 0;
  const eBonus = e?.persistentPoise?.barrierBonus || 0;
  document.getElementById('sandbox-enemy-panel').innerHTML = e ? `
    <h4>${esc(e.name || e.enemyId)} ${e.hp <= 0 ? '(DEFEATED)' : ''}</h4>
    <div class="stat-line">
      <span>HP: <strong>${e.hp}/${e.maxHp}</strong>${eWardHp > 0 ? ` <span class="sandbox-ward-hp">+${eWardHp} Ward</span>` : ''}</span>
      <span>Block: <strong>${e.block || 0}</strong></span>
      <span>Poise: <strong>${e.persistentPoise?.value ?? e.poiseMeter?.current ?? 0}/${e.persistentPoise?.max ?? e.poiseMeter?.max ?? 0}</strong>${eBonus > 0 ? ` <span class="sandbox-poise-bonus">(+${eBonus} Bonus)</span>` : ''}</span>
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
  clearPendingWeights();
  setCardsLoading(true, 'Loading cards…', isLocalServer ? 'Reading repository configuration…' : 'Preparing card pool and scoring…');
  if (!isLocalServer) {
    await nextPaint();
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
    if (data.itemArtLayers?.layers) {
      state.itemArtLayers = clone(data.itemArtLayers);
      state.repoItemArtLayers = clone(data.itemArtLayers);
    }
    if (data.customDecks && typeof data.customDecks === 'object') {
      if (Array.isArray(data.customDecks.customClasses)) state.customClasses = clone(data.customDecks.customClasses);
      if (Array.isArray(data.customDecks.customDecks)) state.customDecks = clone(data.customDecks.customDecks);
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

// Cards and items whose rank differs from the repo baseline, for the export dialog.
function rankShifts() {
  const cardShifts = state.cards
    .map((card) => ({ card, now: scoreCardEntry(card).rank, before: state.baselineRanks[card.id] }))
    .filter((shift) => shift.before !== undefined && shift.now !== shift.before);
  const itemShifts = state.items
    .map((it) => ({ card: { name: `[${it.kind}] ${it.name}` }, now: scoreItemEntry(it, state.scoring, state.itemRules).rank, before: state.baselineItemRanks[it.key] }))
    .filter((shift) => shift.before !== undefined && shift.now !== shift.before);
  return [...cardShifts, ...itemShifts];
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
  document.getElementById('export-modal-naming').textContent = stagedNotIncludedNote();
  renderRankShiftList();
  document.getElementById('export-modal').showModal();
}

// Writes the applied scoring to a repo file and rebuilds the game's scoring, combat-power and Act tables.
async function writeScoringToGame(path, doneNote = 'Exported') {
  try {
    const r = await fetch('/__studio/scoring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, scoring: SplitSavedConfig(state.scoring).scoring, rebuild: true }) });
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
  const blob = new Blob([JSON.stringify(SplitSavedConfig(state.scoring).scoring, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'scoring.json' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Downloaded scoring.json.${stagedNotIncludedNote()}`);
}

// An imported file is staged, not applied: the owner reviews it in the Weights tab, then Applies.
async function importScoringFile(e) {
  closeMenus();
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
    const r = await fetch('/__studio/scoring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: STUDIO_SAVE_PATH, scoring: JoinSavedConfig(state.scoring, state.nameSets), rebuild: false }) });
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
    // The saved config carries the name sets beside the weights: the sets join the list, the weights are staged.
    const saved = SplitSavedConfig(data.scoring);
    if (saved.nameSets.length) { state.nameSets = MergeNameSets(state.nameSets, saved.nameSets); storeNameSets(); renderNameSetsList(); }
    stageWholeScoring(saved.scoring, 'the saved config');
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
  studioCardOverrides.clear();
  state.cards = buildCardList();
  state.subclassCatalog = null;
  state.customDecks = state.customDecks.filter(deck => !deck.id?.startsWith('subclass-list.'));
  const roster = buildItemRoster(contentBundle);
  state.items = roster.items;
  state.itemRules = roster.rules;
  // syncAllViews keeps a still-valid active card or item and clears a removed one.
  state.undoStack = [];
  state.redoStack = [];
  updateUndoButtons();
  // Revert to the last loaded repo copy first, so a failed reload (server offline) still reverts.
  state.scoring = clone(state.repoScoring);
  state.artLayers = clone(state.repoArtLayers);
  state.itemArtLayers = clone(state.repoItemArtLayers);
  const reloaded = await loadFromRepo(state.repoPath);
  state.artLayers = clone(state.repoArtLayers);
  state.itemArtLayers = clone(state.repoItemArtLayers);
  syncAllViews();
  refreshDirtyStatus();
  toast(reloaded ? 'Reverted to the repo version' : 'Reverted to the last loaded repo copy (server offline)');
}

function recomputeBaselineRanks() {
  state.baselineRanks = {};
  for (const c of state.cards) state.baselineRanks[c.id] = scoreCardEntry(c, state.repoScoring).rank;
  state.baselineItemRanks = {};
  for (const it of state.items) state.baselineItemRanks[it.key] = scoreItemEntry(it, state.repoScoring, state.itemRules).rank;
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

let studioToolsUi = null;
let subclassCatalogUi = null;
let studioSaveUi = null;
let cardSelectionUi = null;
let cardEditorDockUi = null;
let deckListPanelUi = null;
// The Cards and Items tabs set activeGallery, state.artTarget and the dock context together.
let activeGallery = GalleryKind.Cards;
let artGalleryFrame = null;

function showGallery(kind)
{
  if (kind === activeGallery)
  {
    return;
  }
  const tabSelector = `${STUDIO_TAB_SELECTOR}[${STUDIO_TAB_DATA_ATTRIBUTE}="${kind}"]`;
  document.querySelector(tabSelector)?.click();
}

// Each gallery keeps its own place: the grid scrolls on desktop, the page on narrow screens.
const galleryScroll = PerGallery(null);

function galleryGrid(kind)
{
  return document.getElementById(GalleryGridId[kind]);
}

function rememberGalleryScroll(kind)
{
  const gridScrollTop = galleryGrid(kind)?.scrollTop || 0;
  galleryScroll[kind] = {
    grid: gridScrollTop,
    page: window.scrollY,
  };
}

function restoreSavedGalleryScroll(kind)
{
  const saved = galleryScroll[kind];
  const grid = galleryGrid(kind);
  if (!saved || !grid)
  {
    return;
  }
  grid.scrollTop = saved.grid;
  if (isNarrowLayout())
  {
    window.scrollTo(0, saved.page);
  }
}

function restoreGalleryScroll(kind)
{
  restoreSavedGalleryScroll(kind);
  revealActiveTile(kind);
}

function refreshGalleryArtSoon() {
  if (artGalleryFrame !== null) return;
  artGalleryFrame = requestAnimationFrame(() => {
    artGalleryFrame = null;
    if (state.artTarget === 'items') renderItemsGrid(); else renderCardsGrid();
  });
}

// Type, class and rarity choices come from the loaded cards (+ custom classes), so no option matches nothing.
function populateCardOptions() {
  const distinct = (field, fallback) => [...new Set(state.cards.map((c) => c[field] || fallback))].sort();
  const types = distinct('type', 'attack');
  const classes = [...new Set([...distinct('class', 'colorless'), ...(state.customClasses || []).map((c) => c.id)])].sort();
  const rarities = distinct('rarity', 'common');
  fillSelect(document.getElementById('filter-type'), types, 'All Types');
  fillSelect(document.getElementById('filter-class'), classes, 'All Classes');
  fillSelect(document.getElementById('edit-class'), classes);
  fillSelect(document.getElementById('edit-rarity'), rarities);
  studioToolsUi?.populateDeckAndClassDropdowns();
  const activeDeck = (state.customDecks || []).find((d) => d.isActiveDeckList);
  const poolText = activeDeck
    ? `Active deck: ${activeDeck.name} (${activeDeck.cardIds.length}) · ${state.cards.length} total`
    : `Core pool · ${state.cards.length} cards`;
  document.querySelectorAll('.pool-label').forEach((el) => { el.textContent = poolText; });
}

function syncAllViews() {
  // Content changed: keep a still-valid active entity, clear a removed one.
  activeEntities.reconcile();
  populateRebalanceStatusOptions();
  populateRankFilter();
  populateCardOptions();
  populateAddFeatureDropdown();
  renderCardsGrid();
  renderInspector();
  renderItemsGrid();
  renderItemInspector();
  renderWeights();
  renderArtTab();
  subclassCatalogUi?.refresh();
  deckListPanelUi?.refresh();
  // The sandbox hand's rank badges follow undo, redo, slot loads, imports and Revert too.
  if (state.sandbox.combat) renderSandbox();
}

// ---------------------------------------------------------------------------
// Chrome: menus, shortcuts, filter panel, collapsible sections, inspector sheet
// ---------------------------------------------------------------------------
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
    if (menu === except || (except && menu.contains(except))) return;
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
    const focusable = () => [...panel.querySelectorAll('button:not(:disabled), a[href], label[tabindex], input:not([type="hidden"]), select')].filter(node => node.getClientRects().length);
    const open = () => {
      const opening = panel.hidden;
      closeMenus(menu);
      panel.hidden = !opening;
      button.setAttribute('aria-expanded', String(opening));
      if (opening) { refreshCommandStates(); focusable()[0]?.focus(); }
    };
    button.addEventListener('click', open);
    button.addEventListener('keydown', e => {
      if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); if (panel.hidden) open(); const nodes = focusable(); (e.key === 'ArrowUp' ? nodes.at(-1) : nodes[0])?.focus(); }
      if (['ArrowLeft', 'ArrowRight'].includes(e.key) && menu.parentElement?.id === 'studio-menubar') {
        e.preventDefault();
        const headings = [...document.querySelectorAll('#studio-menubar > .studio-menu > button')];
        const i = headings.indexOf(button), next = headings[(i + (e.key === 'ArrowRight' ? 1 : headings.length - 1)) % headings.length];
        closeMenus(); next?.focus();
      }
    });
    // Picking an action closes the menu; the path field, Load and the auto-save toggle keep it open.
    panel.addEventListener('click', (e) => {
      if (e.target.closest('button.menu-item, a.menu-item') && !e.target.closest('button[aria-haspopup]')) closeMenus();
    });
    panel.addEventListener('keydown', e => {
      if (e.target.closest('.studio-menu-panel') !== panel) return;
      const nodes = focusable(), index = nodes.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); panel.hidden = true; button.setAttribute('aria-expanded', 'false'); button.focus(); }
      else if (isTextEntry(e.target)) return;
      else if (e.key === 'ArrowLeft' && menu.parentElement?.id !== 'studio-menubar') { e.preventDefault(); e.stopPropagation(); panel.hidden = true; button.setAttribute('aria-expanded', 'false'); button.focus(); }
      else if (['ArrowLeft', 'ArrowRight'].includes(e.key) && menu.parentElement?.id === 'studio-menubar') {
        e.preventDefault(); e.stopPropagation();
        const headings = [...document.querySelectorAll('#studio-menubar > .studio-menu > button')], i = headings.indexOf(button);
        headings[(i + (e.key === 'ArrowRight' ? 1 : headings.length - 1)) % headings.length]?.click();
      }
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault(); const step = e.key === 'ArrowUp' ? -1 : 1;
        const next = e.key === 'Home' ? nodes[0] : e.key === 'End' ? nodes.at(-1) : nodes[(index + step + nodes.length) % nodes.length]; next?.focus();
      }
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.studio-menu')) closeMenus();
  });
  document.addEventListener('focusin', e => { if (!e.target.closest('.studio-menu')) closeMenus(); });
}

function setCustomizationView(view) {
  document.querySelector(`.studio-tab[data-tab="${activeGallery}"]`).click();
  cardEditorDockUi?.setView(view);
  // On narrow screens the pane is a panel of its own: show it, or the chosen view stays hidden.
  cardEditorDockUi?.setPanel?.('editor');
  if (cardEditorDockUi && !cardEditorDockUi.isDocked()) cardEditorDockUi.open?.();
}

function refreshCommandStates() {
  const hasSelection = activeGallery === 'cards' && Boolean(cardSelectionUi?.selectedIds().length);
  for (const id of ['menu-new-deck-selection', 'menu-clear-selection', 'menu-rename-selected', 'menu-remove-added', 'menu-balance-selected', 'menu-add-selected-deck', 'menu-remove-selected-deck']) {
    const button = document.getElementById(id); if (button) button.disabled = !hasSelection;
  }
  const selectVisible = document.getElementById('menu-select-visible');
  if (selectVisible) selectVisible.disabled = activeGallery !== 'cards' || !getFilteredCards().length;
  const quickBalance = document.getElementById('btn-quick-balance-cards');
  if (quickBalance) quickBalance.title = hasSelection ? 'Rebalance power for selected cards' : 'Rebalance power for cards';
  const quickRename = document.getElementById('btn-quick-rename-cards');
  if (quickRename) quickRename.textContent = hasSelection ? `Generate names for ${cardSelectionUi.selectedIds().length} selected cards` : 'Generate names for all cards…';
  const remove = document.getElementById('menu-remove-added');
  if (remove && cardSelectionUi?.toolbar.querySelector('[data-selection-action="delete"]')?.disabled) remove.disabled = true;
  const rename = document.getElementById('menu-rename-current');
  if (rename) rename.textContent = activeGallery === 'items' ? 'Rename item…' : 'Rename card…';
}

function setupStudioMenubar() {
  populateRebalanceStatusOptions();
  const panel = name => document.getElementById(`studio-${name}-menu`);
  const move = (name, id, label) => {
    const node = document.getElementById(id); if (!node) return;
    node.classList.add('menu-item'); node.classList.remove('s-btn-primary', 's-btn-icon');
    node.setAttribute('role', 'menuitem');
    if (label) node.textContent = label;
    panel(name).append(node);
  };
  const moveLabel = (name, id) => {
    const input = document.getElementById(id), label = input?.closest('label'); if (!label) return;
    label.classList.add('menu-item'); label.tabIndex = 0; label.setAttribute('role', 'menuitem'); panel(name).append(label);
    label.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); closeMenus(); } });
  };
  const group = (name, text) => { const heading = document.createElement('div'); heading.className = 'studio-menu-group-label'; heading.textContent = text; panel(name).append(heading); };
  const command = (name, id, text, action) => { const button = document.createElement('button'); button.id = id; button.type = 'button'; button.className = 'menu-item'; button.setAttribute('role', 'menuitem'); button.textContent = text; button.addEventListener('click', action); panel(name).append(button); };
  const click = id => () => document.getElementById(id)?.click();
  const studioSaveLabel = isLocalServer
    ? StudioSaveMenuLabel.Local
    : StudioSaveMenuLabel.Web;
  command('file', STUDIO_SAVE_MENU_ID, studioSaveLabel, () =>
  {
    closeMenus();
    studioSaveUi.save();
  });
  document.getElementById(STUDIO_SAVE_MENU_ID).setAttribute('aria-keyshortcuts', STUDIO_SAVE_SHORTCUT_ARIA);
  move('file', 'btn-new-card', 'New card');
  command('file', 'menu-new-deck-selection', 'New deck from selected cards…', () => cardSelectionUi?.createDeckFromSelection());
  group('file', 'Subclass catalogs');
  command('file', 'menu-import-catalog', 'Import subclass catalog…', () => { document.getElementById('btn-subclass-lists').click(); document.getElementById('input-subclass-catalog').click(); });
  command('file', 'menu-export-catalog', 'Export subclass catalogs…', () => { document.getElementById('btn-subclass-lists').click(); document.getElementById('btn-subclass-download').focus(); });
  group('file', 'Studio bundles');
  move('file', 'btn-decks-export-json', 'Download Studio bundle');
  moveLabel('file', 'input-decks-load-json');
  move('file', 'btn-decks-save-repo', 'Save Studio bundle to repository');
  group('file', 'Names');
  move('file', 'btn-save-names', 'Save names'); move('file', 'btn-save-names-as', 'Save names as…'); moveLabel('file', 'input-load-names');
  group('file', 'Scoring settings');
  move('file', 'btn-export-repo', 'Export scoring settings…'); move('file', 'btn-download-json', 'Download scoring JSON'); moveLabel('file', 'input-upload-json');
  move('file', 'btn-revert', 'Revert to in-game…');
  const advanced = document.getElementById('btn-more')?.closest('.studio-menu');
  if (advanced) { panel('file').append(advanced); document.getElementById('btn-more').textContent = 'Advanced settings…'; document.getElementById('btn-more').classList.add('menu-item'); document.getElementById('btn-more').classList.remove('s-btn-icon'); }
  move('edit', 'btn-undo', 'Undo'); move('edit', 'btn-redo', 'Redo');
  command('edit', 'menu-rename-current', 'Rename card…', () => {
    // The docked pane lives in the gallery panel; show it first when Sandbox or Effects is active.
    document.querySelector(`.studio-tab[data-tab="${activeGallery}"]`)?.click();
    if (activeGallery === 'items') cardEditorDockUi.editItem(state.selectedItemKey); else cardEditorDockUi.edit(state.selectedCardId);
    const input = document.getElementById(activeGallery === 'items' ? 'item-edit-name' : 'edit-name'); input.focus(); input.select();
  });
  group('edit', 'Card selection');
  command('edit', 'menu-select-visible', 'Select visible cards', () => cardSelectionUi?.selectVisible());
  command('edit', 'menu-clear-selection', 'Clear card selection', () => cardSelectionUi?.clear());
  command('edit', 'menu-rename-selected', 'Rename selected cards…', () => cardSelectionUi?.renameSelected());
  command('edit', 'menu-remove-added', 'Remove selected added cards…', () => cardSelectionUi?.removeAdded());
  move('edit', 'btn-rename-all', 'Generate names for all cards…'); move('edit', 'btn-rename-all-items', 'Generate names for all items'); move('edit', 'btn-restore-item-names', 'Restore item names');
  const restore = document.getElementById('btn-restore-names')?.closest('.studio-menu'); if (restore) { panel('edit').append(restore); document.getElementById('btn-restore-names').classList.add('menu-item'); }
  command('view', 'menu-view-cards', 'Cards', () => document.querySelector('.studio-tab[data-tab="cards"]').click());
  command('view', 'menu-view-items', 'Items', () => document.querySelector('.studio-tab[data-tab="items"]').click());
  group('view', 'Customization pane');
  for (const [view, text] of [['properties', 'Properties'], ['design', 'Design and art layers'], ['weights', 'Weights'], ['decks', 'Deck lists']]) command('view', `menu-view-${view}`, text, () => setCustomizationView(view));
  command('view', 'menu-view-dock', 'Dock customization pane', () => cardEditorDockUi?.setDocked(true));
  command('view', 'menu-view-undock', 'Undock customization pane', () => { cardEditorDockUi?.setDocked(false); cardEditorDockUi?.open?.(); });
  group('view', 'Gallery'); command('view', 'menu-view-filters', 'Show or hide card filters', click('btn-filters'));
  command('view', 'menu-view-scale', 'Card size…', () => { setFiltersOpen(true); document.getElementById('card-scale-slider').focus(); });
  move('view', 'btn-collapse-all', 'Collapse sections'); move('view', 'btn-expand-all', 'Expand sections');
  group('tools', 'Cards');
  command('tools', 'menu-balance-selected', 'Rebalance power for selected cards…', () => cardSelectionUi?.balanceSelected());
  move('tools', 'btn-generate-cards', 'Generate card pool…'); move('tools', 'btn-subclass-lists', 'Generate subclass lists…');
  move('tools', 'btn-batch-generate-cards', 'Batch generate cards…'); move('tools', 'btn-auto-balance-cards', 'Rebalance power for cards…');
  group('tools', 'Items'); move('tools', 'btn-batch-generate-items', 'Batch generate items…'); move('tools', 'btn-auto-balance-items', 'Rebalance power for items…');
  group('tools', 'Lists'); move('tools', 'btn-open-decks', 'Deck lists…'); move('tools', 'btn-custom-decks', 'Manage decks and classes…');
  for (const [id, text] of [['menu-add-selected-deck', 'Add selected cards to a deck…'], ['menu-remove-selected-deck', 'Remove selected cards from a deck…']]) command('tools', id, text, () => {
    setCustomizationView('decks');
    deckListPanelUi?.element.querySelector('[data-deck-select]')?.focus();
  });
  // These links use this checkout's verified origin; the menu performs no Git writes.
  for (const [id, label, href] of [['menu-git-repository', 'Open GitHub repository', 'https://github.com/cehinds/AshenSpire'], ['menu-git-pulls', 'Pull requests', 'https://github.com/cehinds/AshenSpire/pulls'], ['menu-git-history', 'Dev commit history', 'https://github.com/cehinds/AshenSpire/commits/dev/']]) {
    const link = document.createElement('a'); link.id = id; link.className = 'menu-item'; link.setAttribute('role', 'menuitem'); link.textContent = label; link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; panel('git').append(link);
  }
  const sandbox = document.querySelector('.studio-tab[data-tab="sandbox"]'); if (sandbox) move('test', sandbox.id ||= 'sandbox-tab-button', 'Open combat simulator');
  move('test', 'btn-send-sandbox', 'Test selected card in simulator');
  move('test', 'btn-apply-sandbox', 'Apply current scoring to simulator');
  group('test', 'Simulation controls');
  move('test', 'btn-sandbox-reset', 'Reset simulation'); move('test', 'btn-sandbox-refill', 'Refill Stamina and Mana'); move('test', 'btn-sandbox-endturn', 'End turn');
  group('test', 'Effects'); move('test', 'effects-tab-button', 'Effects timing');
  for (const context of ['cards', 'items']) {
    const row = document.querySelector(`#tab-${context} .filter-bar > .filter-row`);
    row.classList.add('compact-gallery-controls');
    const deckLabel = document.createElement('label'); deckLabel.className = 'filter-list-field'; deckLabel.textContent = 'Deck / class list';
    deckLabel.append(document.getElementById(context === 'cards' ? 'filter-deck' : 'filter-item-deck'));
    document.querySelector(context === 'cards' ? '#filter-panel' : '#item-filters-modal .item-filter-fields').prepend(deckLabel);
    for (const [id, label, action] of [[`btn-quick-balance-${context}`, 'Rebalance', () => {
      if (context === 'cards' && cardSelectionUi?.selectedIds().length) cardSelectionUi.balanceSelected();
      else click(`btn-auto-balance-${context}`)();
    }]]) {
      const button = document.createElement('button'); button.id = id; button.type = 'button'; button.className = 's-btn gallery-quick-action'; button.textContent = label;
      button.title = label === 'Decks' ? 'Show deck lists' : `Rebalance power for ${context}`; button.addEventListener('click', action); row.append(button);
      if (label === 'Rebalance') {
        const split = document.createElement('div'); split.className = 'gallery-balance-split'; button.replaceWith(split); split.append(button);
        const menu = document.createElement('div'); menu.className = 'studio-menu';
        const caret = document.createElement('button'); caret.id = `btn-quick-balance-menu-${context}`; caret.type = 'button'; caret.className = 's-btn gallery-balance-caret'; caret.textContent = '▾';
        caret.setAttribute('aria-label', `Rebalance and generate names for ${context}`); caret.setAttribute('aria-haspopup', 'menu'); caret.setAttribute('aria-expanded', 'false'); caret.setAttribute('aria-controls', `quick-balance-menu-${context}`);
        const options = document.createElement('div'); options.id = `quick-balance-menu-${context}`; options.className = 'studio-menu-panel is-right'; options.setAttribute('role', 'menu'); options.hidden = true;
        const rename = document.createElement('button'); rename.id = `btn-quick-rename-${context}`; rename.type = 'button'; rename.className = 'menu-item'; rename.setAttribute('role', 'menuitem'); rename.textContent = `Generate names for all ${context}${context === 'cards' ? '…' : ''}`;
        rename.addEventListener('click', () => {
          const ids = context === 'cards' ? cardSelectionUi?.selectedIds() || [] : [];
          if (ids.length) autoNameSelectedCards([...ids]);
          else click(context === 'cards' ? 'btn-rename-all' : 'btn-rename-all-items')();
          if (!document.querySelector('dialog[open]')) caret.focus();
        });
        const rebalance = document.createElement('button'); rebalance.type = 'button'; rebalance.className = 'menu-item'; rebalance.setAttribute('role', 'menuitem'); rebalance.textContent = 'Rebalance power…'; rebalance.addEventListener('click', action);
        options.append(rebalance, rename); menu.append(caret, options); split.append(menu);
      }
    }
    row.append(document.getElementById(context === 'cards' ? 'btn-filters' : 'btn-item-filters'));
  }
  for (const row of document.querySelectorAll('.cards-gallery-pane .names-row')) row.classList.add('studio-toolbar-parking');
  document.querySelector('.studio-actions').hidden = true;
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
    const key = e.key.toLowerCase();
    // Ctrl+S saves from anywhere, a text field included, and never opens the browser's Save page dialog.
    if (key === SAVE_SHORTCUT_KEY && !e.altKey)
    {
      e.preventDefault();
      studioSaveUi?.save();
      return;
    }
    // Inside a text field, leave undo to the browser so typing can be undone natively.
    if (isTextEntry(e.target)) return;
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
  return ['filter-type', 'filter-class', 'filter-rank', 'filter-shift', 'filter-deck']
    .filter((id) => document.getElementById(id).value !== 'all').length;
}

function updateFilterCount() {
  const badge = document.getElementById('filter-count');
  const count = activeFilterCount();
  badge.textContent = String(count);
  badge.classList.toggle('hidden', count === 0);
}

// The caller re-renders the gallery.
function resetGalleryFilters(kind)
{
  document.getElementById(GallerySearchId[kind]).value = '';
  for (const filterId of GalleryFilterSelectIds[kind])
  {
    document.getElementById(filterId).value = FILTER_ALL;
  }
  GalleryView[kind].updateFilterCount();
}

function updateItemFilterCount() {
  const count = ['item-filter-kind', 'item-filter-rarity', 'item-filter-rank', 'filter-item-deck'].filter(id => document.getElementById(id).value !== 'all').length
    + Number(document.getElementById('item-filter-sort').value !== 'rank-desc');
  const badge = document.getElementById('item-filter-count');
  badge.textContent = String(count); badge.classList.toggle('hidden', count === 0);
}

function setFiltersOpen(open) {
  const dialog = document.getElementById('card-filters-modal');
  if (open && !dialog.open) dialog.showModal();
  else if (!open && dialog.open) dialog.close();
  document.getElementById('btn-filters').setAttribute('aria-expanded', String(open));
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
  setFiltersOpen(false);
  document.getElementById('card-filters-modal').addEventListener('close', () => document.getElementById('btn-filters').setAttribute('aria-expanded', 'false'));
  document.getElementById('btn-filters').addEventListener('click', () => {
    setFiltersOpen(true);
  });
  document.getElementById('btn-card-filters-reset').addEventListener('click', () => {
    for (const id of ['filter-type', 'filter-class', 'filter-rank', 'filter-shift', 'filter-deck']) document.getElementById(id).value = 'all';
    updateFilterCount(); renderCardsGrid();
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
  wireNameSets();
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

  // Keep one embedded editor so unsaved values survive changing workspaces.
  const effectsFrame = document.getElementById('effects-timing-frame');
  const pauseEffects = () => effectsFrame.contentWindow?.recipientRuntimePreview?.pause();
  window.addEventListener('pagehide', pauseEffects);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pauseEffects();
  });

  // Tabs
  document.querySelectorAll('.studio-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'weights' || tab === 'art') {
        document.querySelector(`.studio-tab[data-tab="${activeGallery}"]`).click();
        cardEditorDockUi?.setView?.(tab === 'art' ? 'design' : 'weights');
        // Import and saved-settings flows land here; on narrow screens the pane must be shown too.
        cardEditorDockUi?.setPanel?.('editor');
        if (tab === 'art') renderArtTab(); else renderWeights();
        return;
      }
      const previousTabButton = document.querySelector(ACTIVE_STUDIO_TAB_SELECTOR);
      const previousTab = previousTabButton?.dataset.tab;
      if (Galleries.includes(previousTab) && previousTab !== tab)
      {
        rememberGalleryScroll(previousTab);
      }
      document.querySelectorAll('.studio-tab').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-selected', String(b === btn)); });
      document.querySelectorAll('.studio-main > .studio-panel').forEach((p) => p.classList.toggle('is-active', p.id === `tab-${tab}`));
      if (tab === 'cards' || tab === 'items') {
        activeGallery = tab;
        for (const selector of document.querySelectorAll('.gallery-content-type')) selector.value = tab;
        state.artTarget = tab;
        cardEditorDockUi?.setContext?.(tab);
        renderArtTab();
        deckListPanelUi?.refresh();
        if (previousTab !== tab)
        {
          restoreGalleryScroll(tab);
        }
        saveWorkingContext();
      }
      if (tab === 'sandbox' && !state.sandbox.combat) startSandboxCombat();
      if (tab === 'art') renderArtTab();
      if (tab === 'effects') {
        if (!effectsFrame.hasAttribute('src')) effectsFrame.src = effectsFrame.dataset.src;
      } else {
        pauseEffects();
      }
    });
  });

  document.querySelectorAll('.gallery-content-type').forEach((selector) => {
    selector.addEventListener('change', () => {
      const context = selector.value;
      document.querySelector(`.studio-tab[data-tab="${context}"]`)?.click();
      document.getElementById(`gallery-type-${context}`)?.focus({ preventScroll: true });
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
    const grid = document.getElementById('cards-grid');
    const before = CaptureCardTilePositions(grid);
    pushHistory();
    let id = `custom.card_${Date.now().toString(36)}`;
    while (state.cards.some(card => card.id === id)) id += '_new';
    const card = normalizeStudioCard({
      id, name: 'New card', class: 'colorless', rarity: 'common', type: 'skill', icon: 'skill',
      cost: 1, staminaCost: 1, manaCost: 0, costRule: 'fixed', damageSchool: 'physical',
      effects: [], keywords: [], tags: ['camp:physical', 'classification.skill', 'targeting.self'],
      textTemplate: 'New card', _custom: true, _edited: true, _autoName: false, _autoText: false, _newDraft: true,
    });
    state.cards.unshift(card);
    resetGalleryFilters(GalleryKind.Cards);
    document.querySelector('.studio-tab[data-tab="cards"]').click();
    cardEditorDockUi?.setView('properties');
    renderCardsGrid();
    selectStudioCard(id, SelectionOptions.Reveal);
    animateCardInsertion(grid, id, { before });
    saveDraft({ autoName: false });
    toast('Added a new card. Edit its properties to begin.');
  });

  document.getElementById('btn-duplicate-card').addEventListener('click', () => {
    const src = selectedCardDef();
    if (!src) return;
    pushHistory();
    const copy = normalizeStudioCard({ ...clone(src), id: `custom.copy_${Date.now().toString(36)}`, name: `${src.name} (Copy)`, _custom: true, _edited: true, _autoName: true });
    state.cards.unshift(copy);
    renderCardsGrid();
    selectStudioCard(copy.id, SelectionOptions.Reveal);
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
    if (idx < 0 || !isAddedCard(state.cards[idx])) return;
    const removed = state.cards[idx], plan = removeAddedCardsFromState(state, [removed.id]);
    if (!plan.removedIds.length) { toast('Original cards are protected.'); return; }
    const nextId = NextInDisplayedOrder(
      displayedIds[GalleryKind.Cards] || [],
      removed.id,
      state.cards.map((card) => card.id),
    );
    pushHistory();
    Object.assign(state, plan.nextState);
    studioCardOverrides.delete(removed.id);
    studioCardOverrides.delete(`${LIVE_ID_PREFIX}${removed.id}`);
    const activeId = selectStudioCard(nextId, SelectionOptions.DeferredReveal);
    const next = state.cards.find((card) => card.id === activeId);
    syncAllViews();
    saveDraft({ autoName: false });
    const deletedMessage = next
      ? DeletedCardToast.withNext(removed.name, next.name)
      : DeletedCardToast.withoutNext(removed.name);
    toast(deletedMessage);
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
  // Auto-name is per card. Turning it on renames the card to its convention name at once; the toggle and
  // the rename are one undo step.
  document.getElementById('toggle-auto-name').addEventListener('change', (e) => {
    const on = e.target.checked;
    mutateSelectedCard((d) => { d._autoName = on; });
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
    if (autoTextToggle.checked) mutateSelectedCard(def => { def._autoText = true; }, { autoName: false });
  });

  // Gallery card size and inspector preview size (Filters panel), and the inspector resizer (desktop only)
  const cardsLayout = document.querySelector('.cards-layout');
  const savedInspectorWidth = Number(readStoredJson(INSPECTOR_WIDTH_KEY, 0));
  if (savedInspectorWidth >= INSPECTOR_WIDTH_MIN && savedInspectorWidth <= INSPECTOR_WIDTH_MAX) {
    cardsLayout.style.setProperty('--inspector-width', `${savedInspectorWidth}px`);
  }
  document.getElementById('inspector-scale-slider').addEventListener('input', (e) => {
    document.getElementById('inspector-card-preview').style.setProperty('--inspector-card-width', `${e.target.value}px`);
    const cardEl = document.querySelector('#inspector-card-preview .card');
    if (cardEl) requestAnimationFrame(() => fitCardFace(cardEl));
  });
  // The shared customization pane owns both card and item resize handles.
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
      if (kind === 'effect') {
        const selfOps = ['block', 'draw', 'heal', 'restoreStamina', 'restoreMana', 'applyReflect', 'gainBarrier', 'restorePoise', 'removeStatus'];
        const amt = key === 'damage' ? 6 : key === 'block' ? 5 : key === 'gainBarrier' ? 1 : key === 'restorePoise' ? 5 : 2;
        d.effects.push({ op: key, target: selfOps.includes(key) ? 'self' : getCardTarget(d), amount: amt, ...(key === 'removeStatus' ? { status: 'weak' } : {}) });
      } else if (kind === 'status') d.effects.push({ op: 'applyStatus', status: key, stacks: (key === 'ward' || key === 'barrier') ? 1 : 2, target: state.scoring.statuses?.[key]?.target || 'enemy' });
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
    if (target.dataset.effCharge !== undefined) {
      const field = target.dataset.chargeField;
      if (!['damage', 'block', 'heal', 'break', 'manaDiscount', 'buildup'].includes(field)) return false;
      applyLiveCardEdit(featureBurst, d => { d.effects[Number(target.dataset.effCharge)][field] = Math.max(0, Number(target.value) || 0); });
      return true;
    }
    if (target.dataset.effAmt !== undefined) {
      const effectIndex = Number(target.dataset.effAmt);
      const wanted = Number(target.value) || 0;
      applyLiveCardEdit(featureBurst, (d) => {
        const eff = d.effects[effectIndex];
        eff.amount = eff.op === 'gainBarrier' ? wanted : authoredAmountForFace(d, effectIndex, wanted);
      });
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

  // Items & Relics tab events
  document.getElementById('btn-item-filters').addEventListener('click', () => document.getElementById('item-filters-modal').showModal());
  document.getElementById('btn-item-filters-reset').addEventListener('click', () => {
    for (const id of ['item-filter-kind', 'item-filter-rarity', 'item-filter-rank']) document.getElementById(id).value = 'all';
    document.getElementById('filter-item-deck').value = 'all';
    document.getElementById('item-filter-sort').value = 'rank-desc';
    updateItemFilterCount(); renderItemsGrid();
  });
  const selectedItem = () => state.items.find((x) => x.key === state.selectedItemKey) || null;
  for (const id of ['item-filter-search', 'item-filter-kind', 'item-filter-rarity', 'item-filter-rank', 'item-filter-sort']) {
    document.getElementById(id)?.addEventListener(id === 'item-filter-search' ? 'input' : 'change', () => { updateItemFilterCount(); renderItemsGrid(); });
  }
  document.getElementById('btn-rename-all-items')?.addEventListener('click', () => {
    pushHistory();
    for (const it of state.items) {
      const next = scoreItemEntry(it, state.scoring, state.itemRules).convention.name;
      if (it.name !== next) { it.name = next; it._edited = true; }
    }
    renderItemsGrid();
    renderItemInspector();
    renderArtTab();
    saveDraft({ autoName: false });
    toast(`Applied convention names to ${state.items.length} items`);
  });
  document.getElementById('btn-restore-item-names')?.addEventListener('click', () => {
    pushHistory();
    for (const it of state.items) {
      const orig = state.defaultItemNames[it.key];
      if (orig) { it.name = orig; it._edited = false; }
    }
    renderItemsGrid();
    renderItemInspector();
    renderArtTab();
    saveDraft({ autoName: false });
    toast('Restored shipped item names');
  });
  document.getElementById('btn-item-autoname')?.addEventListener('click', () => {
    const it = selectedItem();
    if (!it) return;
    pushHistory();
    it.name = scoreItemEntry(it, state.scoring, state.itemRules).convention.name;
    it._edited = true;
    renderItemsGrid();
    renderItemInspector();
    saveDraft({ autoName: false });
  });
  document.getElementById('item-edit-name')?.addEventListener('input', (e) => {
    const it = selectedItem();
    if (!it) return;
    it.name = e.target.value;
    it._edited = true;
    renderItemsGrid();
    renderItemCardPreview(it, document.getElementById('item-preview-host'), 'inspect');
    saveDraft({ autoName: false });
  });
  document.getElementById('item-edit-rarity')?.addEventListener('change', (e) => {
    const it = selectedItem();
    if (!it) return;
    pushHistory();
    it.rarity = e.target.value;
    it._edited = true;
    renderItemsGrid();
    renderItemInspector();
    saveDraft({ autoName: false });
  });
  document.getElementById('item-edit-type')?.addEventListener('change', (e) => {
    const it = selectedItem();
    if (!it) return;
    pushHistory();
    if (it.kind === 'weapon') {
      it.gearType = e.target.value;
      const row = GEAR_TYPES.weaponTypes?.[it.gearType];
      if (Number.isFinite(row?.poiseDamage)) it.poiseDamage = row.poiseDamage;
    } else if (it.kind === 'armour') {
      it.gearGroup = e.target.value;
    }
    it._edited = true;
    renderItemsGrid();
    renderItemInspector();
    saveDraft({ autoName: false });
  });
  document.getElementById('item-edit-poise-dmg')?.addEventListener('change', (e) => {
    const it = selectedItem();
    if (!it || it.kind !== 'weapon') return;
    pushHistory();
    it.poiseDamage = Math.max(0, Math.round(safeNum(e.target.value, 1)));
    it._edited = true;
    renderItemsGrid();
    renderItemInspector();
    saveDraft({ autoName: false });
  });
  document.getElementById('item-edit-range')?.addEventListener('change', (e) => {
    const it = selectedItem();
    if (!it || it.kind !== 'weapon') return;
    pushHistory();
    it.range = e.target.value;
    it._edited = true;
    renderItemsGrid();
    renderItemInspector();
    saveDraft({ autoName: false });
  });
  document.getElementById('item-edit-poise')?.addEventListener('change', (e) => {
    const it = selectedItem();
    if (!it || it.kind !== 'armour') return;
    pushHistory();
    it.poise = Math.max(0, Math.round(safeNum(e.target.value, 0)));
    it._edited = true;
    renderItemsGrid();
    renderItemInspector();
    saveDraft({ autoName: false });
  });
  document.getElementById('btn-item-add-trait')?.addEventListener('click', () => {
    const it = selectedItem();
    if (!it || it.kind === 'relic') return;
    const sel = document.getElementById('item-trait-selector').value || 'self';
    const field = document.getElementById('item-trait-field').value;
    const amt = safeNum(document.getElementById('item-trait-amount').value, 1);
    if (!field) return;
    pushHistory();
    (it.mods ||= []).push(formatModString(`${sel}.${field}`, amt));
    it._edited = true;
    renderItemsGrid();
    renderItemInspector();
    saveDraft({ autoName: false });
  });
  document.getElementById('item-quick-traits')?.addEventListener('click', (e) => {
    const mod = e.target.closest('[data-item-quick-trait]')?.dataset.itemQuickTrait;
    const it = selectedItem();
    if (!mod || !it || it.kind === 'relic') return;
    pushHistory();
    (it.mods ||= []).push(mod);
    it._edited = true;
    renderItemsGrid();
    renderItemInspector();
    saveDraft({ autoName: false });
  });
  document.getElementById('item-active-traits')?.addEventListener('click', (e) => {
    const del = e.target.dataset.itemModDel;
    const it = selectedItem();
    if (del === undefined || !it) return;
    pushHistory();
    it.mods.splice(Number(del), 1);
    it._edited = true;
    renderItemsGrid();
    renderItemInspector();
    saveDraft({ autoName: false });
  });
  document.getElementById('item-active-traits')?.addEventListener('change', (e) => {
    const idx = e.target.dataset.itemModIdx;
    const it = selectedItem();
    if (idx === undefined || !it) return;
    const i = Number(idx);
    const [key] = String(it.mods[i] || '').split('=');
    if (!key) return;
    pushHistory();
    it.mods[i] = formatModString(key, safeNum(e.target.value, 1));
    it._edited = true;
    renderItemsGrid();
    renderItemInspector();
    saveDraft({ autoName: false });
  });
  const updateItemOverride = () => {
    const it = selectedItem();
    if (!it) return;
    pushHistory();
    const enabled = document.getElementById('item-override-enabled').checked;
    state.scoring.overrides ||= {};
    if (!enabled) {
      delete state.scoring.overrides[it.key];
    } else {
      const ov = {};
      const rk = document.getElementById('item-override-rank').value;
      const cp = document.getElementById('item-override-cp').value;
      if (rk !== '') ov.rank = Math.max(0, Math.round(Number(rk)));
      if (cp !== '') ov.cp = Math.round(Number(cp));
      state.scoring.overrides[it.key] = ov;
    }
    renderItemsGrid();
    renderItemInspector();
    renderWeights();
    saveDraft({ autoName: false });
  };
  document.getElementById('item-override-enabled')?.addEventListener('change', updateItemOverride);
  document.getElementById('item-override-rank')?.addEventListener('change', updateItemOverride);
  document.getElementById('item-override-cp')?.addEventListener('change', updateItemOverride);

  // Art & Layers events (supports both Combat Cards and Equipment & Relics)
  // The Design target is the gallery context, so it switches the gallery too.
  document.querySelectorAll('[data-art-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = ToGalleryKind(btn.dataset.artTarget);
      if (kind !== activeGallery)
      {
        showGallery(kind);
      }
      else
      {
        renderArtTab();
      }
      // The pane moved with the gallery; keep focus on the button, not the page body.
      if (document.activeElement !== btn)
      {
        btn.focus({ preventScroll: true });
      }
    });
  });
  document.getElementById('btn-add-layer').addEventListener('click', () => {
    pushHistory();
    const layers = activeArtLayersObj().layers;
    if (state.artTarget === 'items') {
      layers.push({ id: `item-layer-${Date.now().toString(36)}`, name: 'New Item Layer', enabled: true, entityKinds: ['weapon', 'armour', 'relic'], matchKind: 'trait', matchValue: 'statPoise', assetId: 'cue.unbreakable.glow', motif: '', color: '#c9a227', glow: '#c9a227', mode: 'under', blendMode: 'screen', x: 50, y: 50, scale: 100, opacity: 60, zIndex: layers.length + 1 });
    } else {
      layers.push({ id: `layer-${Date.now().toString(36)}`, name: 'New Layer', matchKind: 'default', matchValue: '', mode: 'stack', assetId: 'Z.effect.5', zIndex: layers.length + 1, x: 50, y: 50, scale: 80, opacity: 60, blendMode: 'screen', enabled: true });
    }
    setActiveArtLayerIdx(layers.length - 1);
    renderArtTab();
    if (state.artTarget === 'items') { renderItemsGrid(); renderItemInspector(); }
    saveDraft();
  });
  document.getElementById(ART_PREVIEW_SELECT_ID).addEventListener(CHANGE_EVENT, (event) => {
    if (!event.target.value)
    {
      return;
    }
    if (state.artTarget === GalleryKind.Items)
    {
      selectStudioItem(event.target.value, SelectionOptions.Reveal);
    }
    else
    {
      selectStudioCard(event.target.value, SelectionOptions.Reveal);
    }
  });
  document.getElementById('asset-search').addEventListener('input', renderArtTab);
  document.getElementById('art-layers-list').addEventListener('click', (e) => {
    // A click elsewhere on a layer card selects it; asset thumbnails then assign to that layer.
    const cardEl = e.target.closest('.layer-card');
    if (cardEl && e.target.dataset.lUp === undefined && e.target.dataset.lDown === undefined && e.target.dataset.lDel === undefined) {
      const selIdx = Number(cardEl.dataset.layerCardIdx);
      if (!Number.isNaN(selIdx) && selIdx !== activeArtLayerIdx()) {
        setActiveArtLayerIdx(selIdx);
        document.querySelectorAll('#art-layers-list .layer-card').forEach((n, i) => n.classList.toggle('is-selected', i === selIdx));
      }
      return;
    }
    const idx = Number(e.target.dataset.lUp ?? e.target.dataset.lDown ?? e.target.dataset.lDel);
    if (Number.isNaN(idx)) return;
    const layers = activeArtLayersObj().layers;
    pushHistory();
    if (e.target.dataset.lUp !== undefined && idx > 0) { [layers[idx - 1], layers[idx]] = [layers[idx], layers[idx - 1]]; setActiveArtLayerIdx(idx - 1); }
    if (e.target.dataset.lDown !== undefined && idx < layers.length - 1) { [layers[idx + 1], layers[idx]] = [layers[idx], layers[idx + 1]]; setActiveArtLayerIdx(idx + 1); }
    if (e.target.dataset.lDel !== undefined) layers.splice(idx, 1);
    renderArtTab();
    if (state.artTarget === 'items') { renderItemsGrid(); renderItemInspector(); }
    else { renderCardsGrid(); renderInspector(); }
    saveDraft();
  });
  // Typing and slider drags in a layer record one undo step per focus.
  let layerEditHistoryPushed = false;
  document.getElementById('art-layers-list').addEventListener('focusin', () => { layerEditHistoryPushed = false; });
  document.getElementById('art-layers-list').addEventListener('input', (e) => {
    const idx = Number(e.target.dataset.lIdx ?? e.target.dataset.lEnabled);
    if (Number.isNaN(idx)) return;
    const layer = activeArtLayersObj().layers[idx];
    if (!layer) return;
    if (!layerEditHistoryPushed) { pushHistory(); layerEditHistoryPushed = true; }
    applyArtLayerInput(e.target, layer, state.artTarget === 'items');
  });
  document.getElementById('art-layers-list').addEventListener('change', () => {
    layerEditHistoryPushed = false;
    if (state.artTarget === 'items') renderItemsGrid();
    else renderCardsGrid();
  });
  document.getElementById('btn-save-art').addEventListener('click', async () => {
    try {
      if (state.artTarget === 'items') {
        const r = await fetch('/__studio/item-art-layers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemArtLayers: state.itemArtLayers }) });
        const data = await r.json();
        if (!data.ok) throw new Error(data.error);
        state.repoItemArtLayers = clone(state.itemArtLayers);
        writeDraftNow();
        refreshDirtyStatus();
        toast(`Saved ${data.layerCount} item art layer(s) to ${data.path}`);
      } else {
        const r = await fetch('/__studio/art-layers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artLayers: state.artLayers }) });
        const data = await r.json();
        if (!data.ok) throw new Error(data.error);
        state.repoArtLayers = clone(state.artLayers);
        writeDraftNow();
        refreshDirtyStatus();
        toast(`Saved ${data.layerCount} art layer(s) to ${data.path}`);
      }
    } catch (err) { toast(`Save failed: ${err.message}`); }
  });
  document.getElementById('btn-download-art').addEventListener('click', () => {
    const isItems = state.artTarget === 'items';
    const payload = isItems ? state.itemArtLayers : state.artLayers;
    const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: isItems ? 'itemArtLayers.json' : 'cardArtLayers.json' });
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
    state.scoring = RefreshRestoredNaming(clone(state.abSlots[slot]), state.repoScoring);
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
    .filter((c) => c && c.id && c.name && !c.ruleTemplate && (c.id.startsWith('core.') || c.id.startsWith('subclass.') || configuredCustomCardIds.has(c.id)))
    .map((c) => clone(c))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function boot() {
  setCardsLoading(true, 'Loading cards…', 'Preparing card pool and scoring…');
  setItemsLoading(true, 'Loading items…', 'Preparing weapons, armours, and relics…');
  if (LOADING_SHOT_MODE === 'loading') {
    const pill = document.getElementById('draft-status');
    if (pill) {
      pill.classList.add('is-loading');
      pill.textContent = 'Loading…';
    }
    return;
  }
  state.cards = buildCardList();
  const roster = buildItemRoster(contentBundle);
  state.items = roster.items;
  state.itemRules = roster.rules;
  state.defaultItemNames = Object.fromEntries(state.items.map((it) => [it.key, it.name]));
  // The first card and item until restoreWorkingContext runs after the draft.
  selectStudioItem(state.items[0]?.key, SelectionOptions.Deferred);
  // Default names are the repo's authored names, taken before any draft is restored.
  state.defaultNameSet = DefaultNameSet(state.cards);
  loadStoredNameSets();
  selectStudioCard(state.cards[0]?.id, SelectionOptions.Deferred);
  state.repoArtLayers = clone(state.artLayers);
  state.repoItemArtLayers = clone(state.itemArtLayers);

  try {
    const ab = JSON.parse(localStorage.getItem(AB_STORAGE_KEY) || 'null');
    if (ab) { state.abSlots.A = ab.A || null; state.abSlots.B = ab.B || null; }
  } catch { /* ignore */ }

  studioSaveUi = InitStudioSaveUi({
    state,
    editedCards,
    removedCoreIds,
    mergeStudioCards,
    isLocalServer,
    isTextEntry,
    flushDraft,
    writeDraftNow,
    refreshDirtyStatus,
    toast,
    download: downloadJsonFile,
    clone,
  });
  initSandboxEnemies();
  setupStudioMenubar();
  wireEvents();
  initGalleryZoom({ onCardsResize: () => requestAnimationFrame(() => document.querySelectorAll('#cards-grid .card').forEach(el => fitCardFace(el))) });
  studioToolsUi = initStudioToolsModals({
    state,
    isLocalServer,
    pushHistory,
    saveDraft,
    syncAllViews,
    renderCardsGrid,
    renderItemsGrid,
    onDeckFilterChange: ({ id, manage }) => {
      updateFilterCount(); updateItemFilterCount();
      if (manage || id !== 'all') {
        const filterDialogs = [...document.querySelectorAll('#card-filters-modal[open], #item-filters-modal[open]')];
        if (manage) for (const dialog of filterDialogs) dialog.close();
        if (filterDialogs.length && !manage) cardEditorDockUi?.setView('decks');
        else setCustomizationView('decks');
        deckListPanelUi?.open(id);
        if (!filterDialogs.length || manage) deckListPanelUi?.element.querySelector('[data-deck-select]')?.focus();
      }
    },
    toast,
    normalizeStudioCard,
    deriveFaceFromDef: def => withRebalancePreviewRegistry(() => cardDefToFace(clone(def), state.scoring)),
    renderRebalancePreview,
    prepareRebalanceCommit,
    getFilteredCards,
    getFilteredItems,
    studioCardOverrides,
    prepareSubclassEdit: prepareCardEdit,
    selectCard: selectStudioCard,
    selectItem: selectStudioItem,
  });
  subclassCatalogUi = initSubclassCatalogUi({
    state,
    isLocalServer,
    pushHistory,
    saveDraft,
    syncAllViews,
    toast,
    normalizeStudioCard,
    studioCardOverrides,
    selectCard: selectStudioCard,
  });
  cardSelectionUi = initCardSelectionUi({ state, pushHistory, saveDraft, syncAllViews, toast, getFilteredCards, normalizeStudioCard,
    prepareSubclassEdit: prepareCardEdit, applyAutoNames: autoNameSelectedCards,
    openBalanceSelection: ids => studioToolsUi.openBalanceSelection(ids),
    onCardsRemoved: ids => { for (const id of ids) { studioCardOverrides.delete(id); studioCardOverrides.delete(`${LIVE_ID_PREFIX}${id}`); } },
    onSelectionChange: () => { deckListPanelUi?.refresh(); refreshCommandStates(); },
  });
  deckListPanelUi = initDeckListPanel({ state, pushHistory, saveDraft, syncAllViews, toast,
    getContext: () => activeGallery,
    selectedItemKeys: () => state.selectedItemKey ? [state.selectedItemKey] : [],
    selectionIds: () => cardSelectionUi.selectedIds(),
    selectCards: (ids, options) => cardSelectionUi.select(ids, options),
    selectCard: id => { document.querySelector('.studio-tab[data-tab="cards"]').click(); selectStudioCard(id); },
    selectItem: key => { document.querySelector('.studio-tab[data-tab="items"]').click(); selectStudioItem(key); },
    openDeckManager: () => studioToolsUi.openDecksModal(),
    onOpen: () => { cardEditorDockUi?.setView('decks'); cardEditorDockUi?.setPanel?.('editor'); },
    onRowSelect: () => cardEditorDockUi?.showProperties(),
  });
  cardEditorDockUi = initCardEditorDock({ state, selectCard: selectStudioCard, getCardActions: cardMenuActions, narrowQuery: NARROW_LAYOUT_QUERY,
    renameCard: () => { const input = document.getElementById('edit-name'); input.focus(); input.select(); },
    balanceCard: id => studioToolsUi.openBalanceSelection([id]),
    selectItem: selectStudioItem, getSelectedItemId: () => state.selectedItemKey,
    getSelectedItemName: key => state.items.find(item => item.key === key)?.name,
    renameItem: () => { const input = document.getElementById('item-edit-name'); input?.focus(); input?.select(); },
    balanceItem: key => studioToolsUi.openBalanceItems([key]),
    views: { design: document.getElementById('tab-art'), weights: document.getElementById('tab-weights'), decks: () => deckListPanelUi?.element },
    renderContextFields,
    isHiddenByFilters,
    clearFilters: clearGalleryFilters,
    // A context change from inside the dock moves the gallery with it.
    onContextChange: kind => showGallery(kind),
    onViewChange: view => { if (view === 'design') renderArtTab(); else if (view === 'weights') renderWeights(); else if (view === 'decks') deckListPanelUi?.refresh(); },
  });
  document.getElementById('btn-open-decks').addEventListener('click', () => { setCustomizationView('decks'); deckListPanelUi?.refresh(); });
  document.getElementById('btn-custom-decks-items')?.addEventListener('click', () => studioToolsUi.openDecksModal());

  // Web mode (GitHub Pages): nothing can be written to the repo, so the repo controls go and
  // Download JSON in the More menu is how work leaves the studio.
  if (!isLocalServer) {
    for (const id of ['btn-export-repo', 'btn-save-art', 'btn-revert', 'btn-rebal-save-repo', 'btn-decks-save-repo', ...WEIGHTS_REPO_BUTTON_IDS]) document.getElementById(id)?.classList.add('hidden');
    document.querySelector('#more-menu .menu-section')?.classList.add('hidden');
    document.getElementById('draft-status').title = 'Web mode: use Download JSON in the More menu to export';
  }

  await loadFromRepo(state.repoPath);
  state.coreCardIds = state.cards.map((c) => c.id);
  state.coreShape = MeasurePoolShape(state.cards, { rankOf: (c) => state.baselineRanks[c.id] ?? 0, scoring: state.repoScoring });
  // The Studio's own saved files load after the game content and before the draft (SS-003).
  await studioSaveUi.loadSavedFiles();

  // Restore local draft temp copy if present. Everything is checked first; state changes only after.
  let restoredDraft = false;
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || 'null');
    if (draft?.scoring && ValidateScoringConfig(draft.scoring).length === 0) {
      await studioSaveUi.reconcileDraft(draft);
      studioSaveUi.applySavedFiles({ draftApplies: true });
      const draftArtLayers = Array.isArray(draft.artLayers?.layers) ? draft.artLayers : null;
      const draftCards = (Array.isArray(draft.customCards) ? draft.customCards : [])
        .filter((card) => card && typeof card === 'object' && !Array.isArray(card) && typeof card.id === 'string' && card.id);
      // A draft saved before convention names takes the repo's naming tables and drops the retired word tables.
      state.scoring = RefreshRestoredNaming(draft.scoring, state.repoScoring);
      // A draft saved before a category existed takes the repo's weight for it (Hybrid +10 reaches old drafts).
      for (const [key, weight] of Object.entries(state.repoScoring.categories || {})) {
        if (key === 'rule' || state.scoring.categories?.[key]) continue;
        (state.scoring.categories ||= {})[key] = clone(weight);
      }
      // Hydrate upgradeTags (Efficient, Improved, gearAttribute, etc.) on drafts saved before they existed.
      for (const [key, rule] of Object.entries(state.repoScoring.upgradeTags || {})) {
        if (key[0] === '$' || state.scoring.upgradeTags?.[key]) continue;
        (state.scoring.upgradeTags ||= {})[key] = clone(rule);
      }
      if (state.repoScoring.items?.attributeBudgetCost !== undefined && state.scoring.items && state.scoring.items.attributeBudgetCost === undefined) {
        state.scoring.items.attributeBudgetCost = state.repoScoring.items.attributeBudgetCost;
      }
      if (draft.pendingScoring && draft.pendingBase && ValidateScoringConfig(draft.pendingScoring).length === 0) {
        state.pendingScoring = RefreshRestoredNaming(draft.pendingScoring, state.repoScoring);
        state.pendingBase = RefreshRestoredNaming(draft.pendingBase, state.repoScoring);
      }
      if (draftArtLayers) state.artLayers = draftArtLayers;
      if (Array.isArray(draft.itemArtLayers?.layers)) state.itemArtLayers = draft.itemArtLayers;
      if (Array.isArray(draft.customClasses)) state.customClasses = draft.customClasses;
      if (Array.isArray(draft.customDecks)) state.customDecks = draft.customDecks;
      if (draft.subclassCatalog?.kind === 'ashenspire.subclassCatalog' && Array.isArray(draft.subclassCatalog.lists)) state.subclassCatalog = draft.subclassCatalog;
      for (const draftItem of (Array.isArray(draft.editedItems) ? draft.editedItems : [])) {
        if (!draftItem?.key) continue;
        const j = state.items.findIndex((x) => x.key === draftItem.key);
        if (j >= 0) state.items[j] = draftItem;
        else state.items.unshift(draftItem);
      }
      if (draft.generatorSettings && typeof draft.generatorSettings === 'object') state.generatorSettings = draft.generatorSettings;
      const draftRemovedIds = Array.isArray(draft.removedCardIds)
        ? draft.removedCardIds
        : [];
      mergeStudioCards(draftCards, draftRemovedIds);
      syncAllViews();
      refreshDirtyStatus();
      if (isDirty() && !studioSaveUi.hasStatus())
      {
        document.getElementById('draft-status').textContent = 'Restored local draft temp copy';
      }
      restoredDraft = true;
    }
  } catch { /* ignore */ }
  if (!restoredDraft)
  {
    studioSaveUi.applySavedFiles({ draftApplies: false });
    syncAllViews();
    refreshDirtyStatus();
  }
  restoreWorkingContext();
}

// After boot: the stored gallery, card and item.
// A stored id that is gone falls back to the default.
function restoreWorkingContext()
{
  const saved = ReadWorkingContext(localStorage);
  const defaults = {
    gallery: activeGallery,
    cardId: state.selectedCardId ?? state.cards[0]?.id,
    itemKey: state.selectedItemKey ?? state.items[0]?.key,
  };
  const {
    gallery,
    cardId,
    itemKey,
  } = ResolveWorkingContext(
    saved,
    state,
    defaults,
  );
  selectStudioItem(itemKey);
  selectStudioCard(cardId);
  if (gallery !== activeGallery)
  {
    showGallery(gallery);
  }
  else
  {
    revealActiveTile(gallery);
  }
  workingContextReady = true;
  saveWorkingContext();
}

/** Puts saved or drafted cards over the loaded list: removes the removed Core ids, then replaces by id or adds. */
function mergeStudioCards(cards, removedCardIds)
{
  if (removedCardIds.length)
  {
    const removed = new Set(removedCardIds);
    state.cards = state.cards.filter((card) => !removed.has(card.id));
  }
  const addedCards = [];
  for (const studioCard of cards)
  {
    const index = state.cards.findIndex((card) => card.id === studioCard.id);
    if (index >= 0)
    {
      state.cards[index] = studioCard;
    }
    else
    {
      addedCards.push(studioCard);
    }
  }
  state.cards.unshift(...addedCards);
}

boot()
  .then(() => { if (LOADING_SHOT_MODE !== 'loading') return checkCardArt(); })
  .catch((err) => {
    const msg = err?.message || 'Unexpected error while starting Score Studio.';
    setCardsLoading(true, 'Failed to load cards', msg, { error: true });
    setItemsLoading(true, 'Failed to load items', msg, { error: true });
    const pill = document.getElementById('draft-status');
    if (pill) {
      pill.classList.remove('is-loading');
      pill.classList.add('is-dirty');
      pill.textContent = 'Load failed';
    }
  });
