// src/model/schemas.js — entity schemas + contractual closed sets (SPEC §3.3–§3.7)
//
// Plain-JS validator descriptors (no libraries). Each schema is a tree of
// descriptor nodes interpreted by model/validate.js:
//
//   { k: 'str' } | { k: 'num', int?: true } | { k: 'bool' } | { k: 'any' }
//   { k: 'enum', values: [...] }
//   { k: 'arr', of: node, len?: n }
//   { k: 'map', of: node }                    // { anyKey: node }
//   { k: 'obj', fields: { name: node } }      // node.opt marks optional field
//   { k: 'union', anyOf: [nodes] }
//   { k: 'ref', reg: 'cards' | ... }          // id cross-reference (dangling check)
//   { k: 'effects' } | { k: 'triggers' } | { k: 'predicate' } | { k: 'formulaOrNum' }
//
// The engine contains no entity-specific code (design law §3.1(2)); these
// closed sets are the entire vocabulary content may use.
//
// Headless: no document/window/localStorage/timers.

// ---------------------------------------------------------------------------
// Closed sets (contractual — extending any of these is an engine PR)
// ---------------------------------------------------------------------------

// Effect DSL opcodes (SPEC §3.4).
import { NODE_TYPES, ANCHOR_KINDS } from './floorplan.js';

/** Presentation schools carried explicitly by equipment-bound card profiles. */
export const DAMAGE_SCHOOLS = Object.freeze(['physical', 'magic', 'arcane', 'holy', 'fire']);
export const RELIC_MODIFIER_TAGS = Object.freeze([
  'resource.flat',
  'resource.attributeTier',
  'damage.school.flat',
]);
// The bar vocabulary lives with the readers it describes (model/resources.js),
// so the schema and the engine cannot drift into two homes. resources.js
// imports nothing — no cycle.
import { RESOURCE_WEIGHTS, HUD_SURFACES } from './resources.js';
// The disclosure tiers live with the split they describe (model/disclosure.js),
// so the schema and the screen cannot drift into two homes — same reasoning as
// the bar vocabulary above. disclosure.js imports nothing — no cycle.
import { DISCLOSURE_TIERS } from './disclosure.js';

export const COMBAT_OPCODES = Object.freeze([
  'damage',
  'block',
  'dodgeRoll',
  'applyStatus',
  'removeStatus',
  'draw',
  'discard',
  'exhaust',
  'addCard',
  'gainEnergy',
  'restoreMana',
  'loseHp',
  'heal',
  'shuffleDiscardIntoDraw',
  'enterStance',
  'poiseDamage',
  'stagger',
]);

export const RUN_OPCODES = Object.freeze([
  'addCinders',
  'addCardToDeck',
  'removeCardFromDeck',
  'upgradeCard',
  'addRelic',
  'addFlask',
  'addFlaskCapacity',
  'loseMaxHpPct',
  'startCombat',
]);

export const OPCODES = Object.freeze([...COMBAT_OPCODES, ...RUN_OPCODES]);

// Effect target refs (SPEC §3.4; 'owner'/'player' appear in status hooks and
// enemy phase effects).
export const TARGETS = Object.freeze([
  'self',
  'enemy',
  'allEnemies',
  'randomEnemy',
  'player',
  'owner',
  'ally', // co-op: a chosen living teammate; resolves to self in solo play
]);

// Event bus events emitted by executed actions (SPEC §3.10).
export const EVENTS = Object.freeze([
  'combatStart',
  'combatEnd',
  'playerTurnStart',
  'playerTurnEnd',
  'enemyTurnStart',
  'enemyTurnEnd',
  'enemyMoveStarted',
  'cardDrawn',
  'cardPlayed',
  'cardExhausted',
  'cardDiscarded',
  'deckShuffled',
  'armamentSwapped',
  'damageDealt',
  'blockGained',
  'hpLost',
  'healed',
  'statusApplied',
  'statusExpired',
  'meterFilled',
  'stanceEntered',
  'stanceExited',
  'enemySpawned',
  'enemyDied',
  'enemyStaggered',
  // Threshold-proc vocabulary (#61 direction): the burst is ITS OWN event in
  // the damage record — never folded into the triggering hit (checkable
  // invariant). procResisted is the refusal receipt: applying points into an
  // active resistance answers visibly, never silently.
  'procBurst',
  'procResisted',
  'energyGained',
  'energySpent',
  'manaRestored',
  'manaSpent',
  'staminaSpent',
  'staminaRecovered', // framework Mana & Stamina rule: an idle turn's recovery
  'dodgeRolled', // framework Weight Class & Dodge Roll: the roll's receipt
  'arcaneExposureChanged',
  'arcaneExposureRefused',
  'arcaneBreak',
  'flaskUsed',
  'relicTriggered',
]);

// Names a trigger's `on` may use (SPEC §3.6): every bus event, the owner-
// relative turn hooks, and the enemy-phase threshold trigger.
export const TRIGGER_EVENTS = Object.freeze([
  ...EVENTS,
  'ownerTurnStart',
  'ownerTurnEnd',
  'hpBelowPct',
]);

// Predicates (SPEC §3.6, closed set, combinable). The event* predicates gate
// triggers on their firing event's payload (e.g. a stance hook on damageDealt
// that only reacts to the owner's own attack hits).
export const PREDICATES = Object.freeze([
  'inStance',
  'hasStatus',
  'hasBlock',
  'hpBelowPct',
  'firstCardThisTurn',
  'firstAttackThisCombat',
  'cardTypeIs',
  'everyNthCardThisCombat',
  'random',
  'eventIsAttack',
  'eventSourceIsOwner',
  'eventTargetIsOwner',
  'eventStatusIs',
  'all',
  'any',
  'not',
]);

// Relic passive keys — data the run systems (rewards, shops, shrines, map)
// and cost/flask math consult. Closed set; each key is generic capability,
// not entity behavior (law §3.1(2)).
//   *Mult keys multiply across relics; flags OR; reductions sum.
//
// THE SET AND THE SCHEMA WERE TWO COPIES AND ONLY ONE OF THEM ENFORCED
// ANYTHING (Viki, A8). `PASSIVE_KEYS` was a frozen list with no reader in the
// whole tree — `grep -rn PASSIVE_KEYS src tests tools` found its declaration and
// one comment — while `SCHEMAS.relic.passives` re-typed the same seven names by
// hand and did the actual refusing. A vocabulary nothing reads is decoration;
// worse, it is decoration a future author will edit *instead of* the schema, and
// then a legal-looking passive is silently inert. So the types come here, the
// list is derived from them, and the schema is built from the same object below:
// adding a passive is one row and the two cannot disagree about what exists.
export const PASSIVE_TYPES = Object.freeze({
  runeGainMult: 'num', // cinder rewards ×
  eliteExtraCardReward: 'bool', // flag: elites offer one extra card choice
  flaskPowerMult: 'num', // flask effect amounts ×
  revealUnknown: 'bool', // flag: '?' map nodes show their resolved type
  shrineHealMult: 'num', // shrine rest healing ×
  shrineNoRest: 'bool', // flag: shrines offer Smith only
  powerCostReduction: 'num', // Power cards cost N less (min 0)
  // Inert character-sheet projection only. Player state and combat deliberately
  // have no poise meter; enemy poise remains a separate engine system.
  poiseThresholdAdd: 'num', // additive equipment-receipt modifier
  // SIGNED, and deliberately not `swapCostReduction` beside its neighbour. His
  // sentence is *"costs more OR LESS depending on Talisman or starting relic"* —
  // a "reduction" of −1 to mean "one more" is a word arguing with its own value.
  // Deltas sum across relics; the total is added to the base and floored at 0.
  swapCostDelta: 'num', // a mid-fight armament swap costs N more (negative = less)
});

export const PASSIVE_KEYS = Object.freeze(Object.keys(PASSIVE_TYPES));

// Status/stance modifier keys consulted by the generic damage/block math and
// turn loop (SPEC §3.7, §4.2). Semantics:
//   *Mult keys  — flat multipliers (NOT scaled by stacks), multiplied together.
//   *Add keys   — per-stack adders (value × stacks), summed.
//   skipTurn            — bool: owner (enemy) skips its move while present.
//   retainBlock         — bool: owner's block does not expire at its turn start.
//   blockCap            — number: hard cap on owner's total block (max of caps wins).
//   meterMaxGrowthDisabled — bool: while ANY combatant has it, meter thresholds
//                            (status meters and poise) do not grow on fill.
//
// THE SET AND THE SCHEMA WERE TWO COPIES AND ONLY ONE OF THEM ENFORCED
// ANYTHING — the same shape as the relic passives, found by tools/closedsets.mjs
// rather than by eye. `MODIFIER_KEYS` was a frozen list whose only mention in
// the tree was an import into validate.js that used it for nothing, while
// `modifiersSchema` below re-typed the same nine names by hand and did the
// actual refusing. So the types come here, the list is derived from them, the
// schema is built from the same object, and the engine's lookups check against
// it (engine/statuses.js): adding a modifier is one row, and the three cannot
// disagree about what exists.
export const MODIFIER_TYPES = Object.freeze({
  damageDealtMult: 'num',
  damageTakenMult: 'num',
  blockGainedMult: 'num',
  attackDamageAdd: 'num',
  blockAdd: 'num',
  skipTurn: 'bool',
  retainBlock: 'bool',
  blockCap: 'num',
  meterMaxGrowthDisabled: 'bool',
});

export const MODIFIER_KEYS = Object.freeze(Object.keys(MODIFIER_TYPES));

export const STACK_MODES = Object.freeze(['add', 'refresh', 'unique']);
// Instance-value display is presentation data, separate from engine keywords
// and from the mechanic that produced the value.
export const STATUS_VALUE_TOKENS = Object.freeze(['stacks', 'percent']);
export const STATUS_DURATION_TOKENS = Object.freeze(['turns']);

// ---------------------------------------------------------------------------
// Threshold-proc vocabulary (#61 direction, Constantine's words 2026-08-06)
// ---------------------------------------------------------------------------
// A proc status builds points to a fixed threshold; at the threshold the
// target takes percent-based damage as ITS OWN PROC (own event, own damage
// record entry — never folded into the triggering hit), the build-up RESETS
// TO ZERO (overflow dropped, threshold constant — deliberate delta vs the
// legacy `meter` block, which carried overflow and escalated ×1.5), and, if
// the target carries a listed creature tag, it gains a post-proc resistance
// status. Bleed, frost, and insanity are the first three rows.
//
// How the tag-scoped vulnerability composes with regular Vulnerable is a
// NAMED, VALIDATED rule per row, not an accident of arithmetic order:
//   multiplicative — dmg *= mult (composes like every shipped *Mult:
//                    flat per status, stack-count-invariant, sources multiply)
//   additive       — (mult−1) sums across additive sources, applied once.
export const VULN_STACKING = Object.freeze(['additive', 'multiplicative']);

// Creature tags — the closed vocabulary proc resistance may gate on. An
// enemy's `tags` and a proc row's `resistance.tags` must both draw from this
// set. Distinct from card/effect tags (content/tags.js): creature identity vs
// attack school — two concepts, deliberately two vocabularies.
export const CREATURE_TAGS = Object.freeze([
  'beast',
  'humanoid',
  'undead',
  'construct',
  'spirit',
]);

export const CARD_TYPES = Object.freeze(['attack', 'skill', 'power', 'curse', 'status']);
export const CARD_RARITIES = Object.freeze(['starter', 'common', 'uncommon', 'rare', 'special']);
export const RELIC_RARITIES = Object.freeze(['starter', 'common', 'uncommon', 'rare', 'boss']);
export const FLASK_RARITIES = Object.freeze(['common', 'uncommon', 'rare']);
// What a flask IS, as opposed to how rare it is. The grace refill table
// (balance.graceRefill) names kinds, never ids, so "restore 3 hp flasks" keeps
// meaning the same thing when a second healing flask is authored.
//
// DERIVED, NOT AUTHORED, for every flask shipped today — model/gracerefill.js
// `flaskKindOf` reads the effects and only falls back to an explicit `kind:`
// override. Nothing in content/flasks.js carries this field.
//
// Mana is live run/combat state. `restoreMana` derives the Mana kind without
// confusing it with per-turn Energy; explicit `kind` remains the override.
export const FLASK_KINDS = Object.freeze(['hp', 'mana', 'utility']);

// The four growth sources of D17 message 6, his words in his order: "upgrade
// options via relics or quest events or talismans or flask seeds to increase
// the amount of charges." A growth row names ONE of these; a fifth source is a
// WORD (engine act: this set, the schema and model/flaskgrowth.js refusals in
// one act — Law 0 clause 2), never a row. Two of the four are declared ahead
// of their content on purpose — see flaskGrowthRefusals for which, and why.
export const FLASK_GROWTH_SOURCES = Object.freeze(['relic', 'questEvent', 'talisman', 'flaskSeed']);
export const INTENT_KINDS = Object.freeze(['attack', 'block', 'buff', 'debuff', 'unknown']);
export const ENCOUNTER_POOLS = Object.freeze(['normal', 'elite', 'boss']);
export const PILES = Object.freeze(['draw', 'hand', 'discard', 'exhaust']);
export const PILE_POSITIONS = Object.freeze(['top', 'bottom', 'random']);

// Keyword ids with fixed engine semantics (SPEC §3.7 note, §4.3). Content's
// keywords registry supplies display names + tooltips only; the engine keys
// on these lowercase ids.
export const ENGINE_KEYWORDS = Object.freeze([
  'exhaust',
  'ethereal',
  'innate',
  'retain',
  'unplayable',
]);

// SFX layer vocabulary (#46). A recipe (content/sfx.js) is a non-empty array
// of layers; each layer is one of these two kinds, and the closed sets below
// are the entire vocabulary a recipe may use — a new synthesis word (a third
// kind, a new field) is an engine change (Law 1 clause 1).
export const SFX_LAYER_KINDS = Object.freeze(['tone', 'noise']);
export const SFX_WAVE_TYPES = Object.freeze(['sine', 'square', 'sawtooth', 'triangle']);

// Registry type names (bundle keys holding arrays of defs).
export const REGISTRY_TYPES = Object.freeze([
  'attributes',
  'creationModes',
  'cards',
  // HUD resource bars as data (content/resources.js). A registry, not a balance
  // sub-object, because a bar is an entry with an id — and because that is what
  // makes "add a row, a bar appears" the same act as adding any other content.
  'resources',
  'relics',
  'statuses',
  'stances',
  'keywords',
  'enemies',
  'encounters',
  'events',
  'flasks',
  'classes',
]);

// Per-opcode field contracts used by validate.js. `refs` maps a field to the
// registry its value must resolve in. Common fields allowed on any opcode:
// op, target, amount, if, repeat (SPEC §3.4).
export const EFFECT_SPECS = Object.freeze({
  // `tags` scopes the hit for tag-scoped vulnerability (frost/insanity
  // exposure): values must exist in the card-tag registry (one vocabulary,
  // two carriers — card chips for display, effect tags for combat).
  damage: { allowed: ['hits', 'tags'], required: ['amount'], refs: {} },
  block: { allowed: [], required: ['amount'], refs: {} },
  // The dodge roll (framework contract: Weight Class and Dodge Roll): a
  // target and nothing else — the check, the die and the guard are the
  // framework's, and the price is the Weight Class's.
  dodgeRoll: { allowed: [], required: [], refs: {} },
  applyStatus: { allowed: ['status', 'stacks'], required: ['status'], refs: { status: 'statuses' } },
  removeStatus: { allowed: ['status'], required: ['status'], refs: { status: 'statuses' } },
  draw: { allowed: [], required: ['amount'], refs: {} },
  discard: { allowed: ['random'], required: [], refs: {} },
  exhaust: { allowed: ['random'], required: [], refs: {} },
  addCard: { allowed: ['card', 'pile', 'position', 'count'], required: ['card'], refs: { card: 'cards' } },
  gainEnergy: { allowed: [], required: ['amount'], refs: {} },
  restoreMana: { allowed: [], required: ['amount'], refs: {} },
  loseHp: { allowed: ['cause'], required: ['amount'], refs: {} },
  heal: { allowed: [], required: ['amount'], refs: {} },
  shuffleDiscardIntoDraw: { allowed: [], required: [], refs: {} },
  enterStance: { allowed: ['stance'], required: ['stance'], refs: { stance: 'stances' } },
  poiseDamage: { allowed: [], required: ['amount'], refs: {} },
  // Direct stagger (insanity's proc): breaks the target's next move outright,
  // bypassing the poise bar. Enemy targets only — validated in validate.js.
  stagger: { allowed: [], required: [], refs: {} },
  addCinders: { allowed: [], required: ['amount'], refs: {} },
  addCardToDeck: { allowed: ['card'], required: ['card'], refs: { card: 'cards' } },
  removeCardFromDeck: { allowed: ['card', 'random'], required: [], refs: { card: 'cards' } },
  upgradeCard: { allowed: ['card', 'random'], required: [], refs: { card: 'cards' } },
  addRelic: { allowed: ['id', 'random'], required: [], refs: { id: 'relics' } },
  addFlask: { allowed: ['id', 'random'], required: [], refs: { id: 'flasks' } },
  addFlaskCapacity: { allowed: ['kind', 'amount'], required: ['kind', 'amount'], refs: {} },
  loseMaxHpPct: { allowed: ['pct'], required: ['pct'], refs: {} },
  startCombat: { allowed: ['encounterId'], required: ['encounterId'], refs: { encounterId: 'encounters' } },
});

// ---------------------------------------------------------------------------
// Descriptor helpers
// ---------------------------------------------------------------------------

const str = { k: 'str' };
const num = { k: 'num' };
const int = { k: 'num', int: true };
const bool = { k: 'bool' };
const any = { k: 'any' };
const effects = { k: 'effects' };
const triggersNode = { k: 'triggers' };
const en = (...values) => ({ k: 'enum', values });
const arr = (of, len) => (len != null ? { k: 'arr', of, len } : { k: 'arr', of });
const mapOf = (of) => ({ k: 'map', of });
const obj = (fields) => ({ k: 'obj', fields });
const ref = (reg) => ({ k: 'ref', reg });
const union = (...anyOf) => ({ k: 'union', anyOf });
const opt = (node) => ({ ...node, opt: true });

// A FLOOR ANCHOR — the closed set in model/floorplan.js, as a schema node.
// `index` and `of` are optional here because which one is required depends on
// `at`, and walkSchema has no discriminated union; resolveFloorPlan names the
// missing or out-of-range one with the act's own floor count in the message.
const floorAnchor = (extra = {}) => obj({
  at: en(...ANCHOR_KINDS),
  index: opt(int),
  of: opt(num),
  ...extra,
});

const costNode = union(int, en('X'));

// DERIVED FROM MODIFIER_TYPES, never re-typed. `obj` is strict about unknown
// keys, so this node is what actually refuses a mis-spelled modifier — which is
// exactly why it must not be a second list.
const modifiersSchema = obj(Object.fromEntries(
  Object.entries(MODIFIER_TYPES).map(([key, t]) => [key, opt(t === 'bool' ? bool : num)])
));

const enemyMoveSchema = obj({
  intent: en(...INTENT_KINDS),
  damage: opt(int),
  hits: opt(int),
  block: opt(int),
  weight: num,
  maxConsecutive: opt(int),
  effects: opt(effects),
  locked: opt(bool),
  delay: opt(
    obj({
      turns: int,
      whileCharging: opt(
        obj({
          block: opt(int),
          effects: opt(effects),
          intent: opt(en(...INTENT_KINDS)),
        })
      ),
    })
  ),
});

const enemyPhaseSchema = obj({
  on: en(...TRIGGER_EVENTS),
  pct: opt(num),
  once: opt(bool),
  if: opt({ k: 'predicate' }),
  do: effects,
  unlockMoves: opt(arr(str)), // checked against the enemy's own moves in validate.js
});

// #237 defined the band vocabulary; #238 makes it complete authored content.
// validate.js additionally enforces positive integers and min <= max.
const levelBandSchema = obj({
  min: int,
  max: int,
});

// SFX layer schemas (#46), keyed by `kind` — validate.js discriminates on the
// kind first so an error lands on the field, not on "matched no variant".
// Field semantics are documented where the data lives (content/sfx.js);
// engine defaults for the optional fields live in ui/audio.js tone()/noise().
// THE SILENCE WORD (word 3 of the audio vocabulary; Sunna's lift condition).
// Deliberate quiet in a music context is spelled with this exact string as the
// context's whole bed value — `rest: 'silence'` — a word a human typed on
// purpose. null, a missing key, [], {} and a zero gain are NOT silence: each
// is a distinct malformation the validator rejects by name, so quiet-by-intent
// can never be confused with quiet-by-bug. One home for the word: the engine
// (ui/audio.js) and the validator both import it from here.
export const MUSIC_SILENCE_WORD = 'silence';

// A music bed object (content/music.js BEDS values that are not the silence
// word). `wave` shares SFX_WAVE_TYPES — one closed set for every oscillator
// timbre the engine can speak. `scale` is checked against the bundle's own
// scales table in validate.js (a dangling scale was previously unchecked).
export const MUSIC_BED_SCHEMA = Object.freeze(
  obj({
    drone: opt(bool),
    gain: num,
    pulse: opt(bool),
    variants: arr(
      obj({
        root: num,
        scale: str,
        cadence: num,
        wave: opt(en(...SFX_WAVE_TYPES)),
        lift: opt(num),
      })
    ),
  })
);

export const SFX_LAYER_SCHEMAS = Object.freeze({
  tone: obj({
    kind: en('tone'),
    type: opt(en(...SFX_WAVE_TYPES)),
    freq: num,
    to: opt(num),
    t0: opt(num),
    dur: num,
    peak: opt(num),
  }),
  noise: obj({
    kind: en('noise'),
    dur: num,
    peak: opt(num),
    t0: opt(num),
    hp: opt(num),
    lp: opt(num),
  }),
});

// ---------------------------------------------------------------------------
// Entity schemas (SPEC §3.3 table)
// ---------------------------------------------------------------------------

export const SCHEMAS = Object.freeze({
  basicCardProfile: obj({
    id: str,
    role: en('attack', 'guard', 'technique'),
    baseCardId: ref('cards'),
    displayName: str,
    icon: str,
    damageSchool: en(...DAMAGE_SCHOOLS),
    exposureBuildupPerHit: int,
    baseValue: num,
    scalingStat: ref('attributes'),
    pointsPerTier: num,
    rounding: en('floor', 'ceil', 'round'),
    gainPerTier: num,
    cap: union(num, str),
    tags: arr(str),
    flavor: str,
    mods: arr(str),
    compatibility: en('attack-v1', 'guard-v1', 'technique-v1'),
  }),
  attribute: obj({
    id: str,
    label: str,
    shortLabel: str,
    order: int,
    // D26's short form. `disclosure` is the tier this row lives in on the
    // creation screen and it is REQUIRED, not optional: an attribute with no
    // tier is an entry that does not describe itself, and the screen would
    // have to guess — which is the hard-coded list this whole shape exists to
    // refuse (model/disclosure.js). `sense` is the one player sentence.
    disclosure: en(...DISCLOSURE_TIERS),
    sense: str,
  }),
  creationMode: obj({
    id: str,
    label: str,
    baseline: int,
    bonusPool: int,
    minimum: int,
    maximum: int,
    // E5 (#250): 'allow' is the reclaim — a stat may drop below its baseline
    // to the mode's minimum, handing the points back to the pool. The model
    // branch in attributes.js (allocationProblems' floor) has carried both
    // semantics since the field existed; this set was closed to what shipped.
    belowBaseline: en('forbid', 'allow'),
    redistribution: en('fixedTotal'),
    equipmentProfiles: opt(mapOf(obj({
      baseValue: opt(num),
      scalingStat: opt(ref('attributes')),
      pointsPerTier: opt(num),
      rounding: opt(en('floor', 'ceil', 'round')),
      gainPerTier: opt(num),
      cap: opt(num),
    }))),
  }),
  attributeRules: obj({
    defaultMode: ref('creationModes'),
    presets: mapOf(mapOf(mapOf(int))),
    // retired name → live heir (content/retiredNames.js). Semantic rules —
    // dead may not be live, heir must be — live in attributeContentProblems.
    retired: opt(mapOf(str)),
  }),
  card: obj({
    id: str,
    name: str,
    class: str, // a class id or 'colorless' (checked in validate.js)
    rarity: en(...CARD_RARITIES),
    cost: costNode,
    manaCost: opt(int),
    staminaCost: opt(int),
    type: en(...CARD_TYPES),
    damageSchool: opt(en(...DAMAGE_SCHOOLS)),
    exposureBuildupPerHit: opt(int),
    keywords: arr(ref('keywords')),
    effects,
    textTemplate: str,
    upgrade: opt(
      obj({
        name: opt(str),
        cost: opt(costNode),
        manaCost: opt(int),
        staminaCost: opt(int),
        effects: opt(effects),
        keywords: opt(arr(ref('keywords'))),
        textTemplate: opt(str),
      })
    ),
    icon: opt(str),
    flavor: opt(str),
    script: opt(ref('scripts')),
  }),

  relic: obj({
    id: str,
    name: str,
    rarity: en(...RELIC_RARITIES),
    textTemplate: str,
    triggers: triggersNode,
    // DERIVED FROM PASSIVE_TYPES, never re-typed. `obj` is strict about unknown
    // keys, so this node is what actually refuses a mis-spelled passive — which
    // is exactly why it must not be a second list.
    passives: opt(
      obj({
        ...Object.fromEntries(
          Object.entries(PASSIVE_TYPES).map(([key, t]) => [key, opt(t === 'bool' ? bool : num)])
        ),
        // Semantics and strict field validation live in validate.js beside the
        // closed RELIC_MODIFIER_TAGS vocabulary. `any` avoids duplicating three
        // discriminated object shapes in this generic schema walker.
        modifiers: opt(arr(any)),
      })
    ),
    icon: opt(str),
    flavor: opt(str),
    script: opt(ref('scripts')),
  }),

  status: obj({
    id: str,
    name: str,
    icon: opt(str),
    tint: opt(str), // status-pip accent CSS color (display; proc bars tint from this too)
    stackMode: en(...STACK_MODES),
    decay: union(en('none', 'perTurnEnd', 'onConsume'), obj({ duration: int })),
    instancePresentation: opt(obj({
      valueToken: en(...STATUS_VALUE_TOKENS),
      durationToken: en(...STATUS_DURATION_TOKENS),
    })),
    meter: opt(obj({ max: int, growthMult: num, onFill: effects })),
    // Threshold-proc block (#61 vocabulary; see VULN_STACKING header above).
    // Every number is a table knob. burstPercent is a percent of the PROC
    // TARGET'S max HP (the reading the shipped bleed already used —
    // percentMaxHp of the meter carrier — kept for continuity; big enemies
    // burst for more absolute damage from the same table). Value-range rules
    // (threshold > 0, 0 < burstPercent ≤ 100, burstMin ≤ burstMax, …) are
    // enforced in validate.js with row-naming messages.
    proc: opt(
      obj({
        threshold: int,
        burstPercent: num,
        burstMin: int,
        burstMax: int,
        poiseDamage: opt(int), // fixed poise damage PER PROC (reading stated in content row)
        stagger: opt(bool), // direct stagger on proc (insanity)
        effects: opt(effects), // additional proc payload (frost/insanity debuffs)
        resistance: opt(
          obj({
            status: ref('statuses'), // the resist row applied post-proc
            tags: arr(str), // creature-tag gate, ⊆ CREATURE_TAGS (validated)
          })
        ),
      })
    ),
    // A resist row declares what it resists; strength lives here, duration
    // lives in the row's own decay — one home per knob.
    resists: opt(obj({ status: ref('statuses'), percent: num })),
    // Tag-scoped extra vulnerability (frost/insanity exposure): applies only
    // to attack damage whose effect `tags` intersect this list; composes with
    // regular Vulnerable per the declared stacking rule (closed enum).
    taggedVulnerability: opt(
      obj({
        tags: arr(str), // ⊆ card-tag registry (validated)
        mult: num,
        stacking: en(...VULN_STACKING),
      })
    ),
    // Inert schema carrier for Arcane Exposure's registered break effect.
    // The engine slice will consume only explicit magic-school HP packets.
    schoolDamageVulnerability: opt(obj({ school: en(...DAMAGE_SCHOOLS) })),
    modifiers: opt(modifiersSchema),
    hooks: opt(triggersNode),
    tooltip: opt(str),
    script: opt(ref('scripts')),
  }),

  // A HUD resource bar. `source` is validated against the CLOSED READER SET in
  // model/resources.js — not here — because whether a source can be READ is a
  // fact about the engine, and a row naming one that cannot is the exact defect
  // this table exists to refuse (validate.js prints the row id and the set).
  resource: obj({
    id: str,
    name: str,
    glyph: opt(str),
    tint: str,
    weight: en(...RESOURCE_WEIGHTS),
    order: num,
    surfaces: arr(en(...HUD_SURFACES)),
    source: str,
    domainMax: opt(num),
    // Rows sharing a band render side by side on one HUD line (the approved
    // hybrid's Mana+Stamina row). Free-form id; grouping happens per surface.
    band: opt(str),
  }),

  stance: obj({
    id: str,
    name: str,
    icon: opt(str),
    onEnter: opt(effects),
    modifiers: opt(modifiersSchema),
    hooks: opt(triggersNode),
    tooltip: opt(str),
    script: opt(ref('scripts')),
  }),

  keyword: obj({
    id: str,
    name: str,
    tooltip: str,
  }),

  enemy: obj({
    id: str,
    name: str,
    hp: arr(int, 2), // [min, max], rolled on stream 'enemyHP'
    poiseMax: int,
    levelProfile: levelBandSchema,
    tags: opt(arr(str)), // creature tags ⊆ CREATURE_TAGS — gates proc resistance
    moves: mapOf(enemyMoveSchema),
    firstMove: opt(str), // checked against own moves in validate.js
    phases: opt(arr(enemyPhaseSchema)),
    art: opt(str),
    size: opt(en('small', 'medium', 'large')), // sprite size tier (display)
    tint: opt(str), // border/accent CSS color (display)
    // Strict absent | immune | configured Arcane Exposure policy. Absence is
    // represented by no field; it is not silently defaulted by the engine.
    arcaneExposure: opt(union(
      obj({ mode: en('immune') }),
      obj({
        mode: en('configured'),
        threshold: int,
        buildupMultiplier: num,
        resetMode: en('zero'),
        overflowPolicy: en('discard'),
        lockPolicy: en('whileMagicVulnerable'),
        onBreak: obj({ status: ref('statuses'), value: num, duration: int }),
      })
    )),
    // Raw HP resistance is deliberately separate from buildup resistance.
    damageResistanceBySchool: opt(obj(Object.fromEntries(
      DAMAGE_SCHOOLS.map((school) => [school, opt(num)])
    ))),
    script: opt(ref('scripts')),
  }),

  encounter: obj({
    id: str,
    enemies: arr(ref('enemies')),
    weight: num,
    minFloor: opt(int),
    pool: en(...ENCOUNTER_POOLS),
    act: int,
    floorBand: levelBandSchema,
    targetBand: levelBandSchema,
  }),

  event: obj({
    id: str,
    name: str,
    art: opt(str),
    text: str,
    choices: arr(
      obj({
        label: str,
        // WAS `opt(any)` — the second instance of the same shape, in Viki's
        // corpus for #43 so the corpus is not fitted to the one we found.
        // `meets()` (ui/screens/event.js:14) understands exactly one key, so
        // `requires: { hp: 50 }` type-checked, was silently ignored, and the
        // choice was always affordable. The vocabulary is closed to what the
        // evaluator can actually read; widening it is an engine change.
        requires: opt(obj({ cinders: opt(int) })),
        effects,
        resultText: str,
      })
    ),
  }),

  flask: obj({
    id: str,
    name: str,
    rarity: en(...FLASK_RARITIES),
    // OPTIONAL because it is derived (model/gracerefill.js flaskKindOf). Present
    // only on an entry whose effects would derive the wrong answer — Law 0
    // clause 3, and the override is data.
    kind: opt(en(...FLASK_KINDS)),
    targeted: opt(bool),
    effects,
    icon: str,
    artKey: str,
    artAsset: opt(str),
    tint: str,
    textTemplate: opt(str),
    script: opt(ref('scripts')),
  }),

  class: obj({
    id: str,
    name: str,
    maxHp: int,
    startingFlaskAllocation: obj({ hp: int, mana: int }),
    glyph: opt(str), // class sigil glyph (display)
    cardTint: opt(str), // card motif hue (display; see styles/ui.css .card)
    startingRelic: ref('relics'),
    startingSignatureCard: ref('cards'),
    eligibleStartingKitIds: arr(str),
    cardPool: arr(ref('cards')),
    description: opt(str),
  }),

  mapConfig: obj({
    floors: int,
    columns: int,
    pathCount: int,
    // How many DISTINCT columns the act may be entered from. Absent = today's
    // rule (see engine/mapgen.js). Whether the number is reachable at all —
    // more doors than walkers, more doors than columns — needs two fields to
    // ask, so it is model/mapview.js's `viewRefusals`, not the schema's.
    entries: opt(int),
    typeWeights: mapOf(num),
    // What a `?` node resolves to — beside the geometry, per act. Moved out of
    // `balance.unknownNode`, which could not vary per act while the map does.
    unknownWeights: opt(mapOf(num)),
    // WAS `opt(any)`, WHICH IS NOT VALIDATION — it is the shape of a check that
    // cannot go red (Marina). Six deliberately-broken inputs passed it: a bare
    // string, a `fixed` index of 999, a node kind that does not exist, a
    // negative index, the number 42, and `floors` halved to 8 while `fixed`
    // still named 9 and 15. All six are red now.
    //
    // TWO LAYERS, ON PURPOSE. The schema below rules on SHAPE — is this an
    // object, is `at` one of the four anchor kinds, is `type` a node type,
    // is there a field nobody declared. It cannot rule on MEANING, because
    // meaning needs `floors`: whether floor 9 exists in this act is a question
    // about the act, not about the literal. `resolveFloorPlan`
    // (model/floorplan.js) answers that half and validate.js reports it, so
    // neither layer is asked a question it cannot see the inputs to.
    floorRules: opt(
      obj({
        fixed: opt(arr(floorAnchor({ type: en(...NODE_TYPES) }))),
        noEliteOrShrineBefore: opt(floorAnchor()),
        noShrineOn: opt(floorAnchor()),
        minElites: opt(int),
        minMerchants: opt(int),
      })
    ),
  }),

  balance: any, // flat constants object; shape is content's concern (SPEC §3.3)
});
