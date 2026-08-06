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

export const COMBAT_OPCODES = Object.freeze([
  'damage',
  'block',
  'applyStatus',
  'removeStatus',
  'draw',
  'discard',
  'exhaust',
  'addCard',
  'gainEnergy',
  'loseHp',
  'heal',
  'shuffleDiscardIntoDraw',
  'enterStance',
  'poiseDamage',
]);

export const RUN_OPCODES = Object.freeze([
  'addCinders',
  'addCardToDeck',
  'removeCardFromDeck',
  'upgradeCard',
  'addRelic',
  'addFlask',
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
  'energyGained',
  'energySpent',
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
export const PASSIVE_KEYS = Object.freeze([
  'runeGainMult', // cinder rewards ×
  'eliteExtraCardReward', // flag: elites offer one extra card choice
  'flaskPowerMult', // flask effect amounts ×
  'revealUnknown', // flag: '?' map nodes show their resolved type
  'shrineHealMult', // shrine rest healing ×
  'shrineNoRest', // flag: shrines offer Smith only
  'powerCostReduction', // Power cards cost N less (min 0)
]);

// Status/stance modifier keys consulted by the generic damage/block math and
// turn loop (SPEC §3.7, §4.2). Semantics:
//   *Mult keys  — flat multipliers (NOT scaled by stacks), multiplied together.
//   *Add keys   — per-stack adders (value × stacks), summed.
//   skipTurn            — bool: owner (enemy) skips its move while present.
//   retainBlock         — bool: owner's block does not expire at its turn start.
//   blockCap            — number: hard cap on owner's total block (max of caps wins).
//   meterMaxGrowthDisabled — bool: while ANY combatant has it, meter thresholds
//                            (status meters and poise) do not grow on fill.
export const MODIFIER_KEYS = Object.freeze([
  'damageDealtMult',
  'damageTakenMult',
  'blockGainedMult',
  'attackDamageAdd',
  'blockAdd',
  'skipTurn',
  'retainBlock',
  'blockCap',
  'meterMaxGrowthDisabled',
]);

export const STACK_MODES = Object.freeze(['add', 'refresh', 'unique']);

export const CARD_TYPES = Object.freeze(['attack', 'skill', 'power', 'curse', 'status']);
export const CARD_RARITIES = Object.freeze(['starter', 'common', 'uncommon', 'rare', 'special']);
export const RELIC_RARITIES = Object.freeze(['starter', 'common', 'uncommon', 'rare', 'boss']);
export const FLASK_RARITIES = Object.freeze(['common', 'uncommon', 'rare']);
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
  'cards',
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
  damage: { allowed: ['hits'], required: ['amount'], refs: {} },
  block: { allowed: [], required: ['amount'], refs: {} },
  applyStatus: { allowed: ['status', 'stacks'], required: ['status'], refs: { status: 'statuses' } },
  removeStatus: { allowed: ['status'], required: ['status'], refs: { status: 'statuses' } },
  draw: { allowed: [], required: ['amount'], refs: {} },
  discard: { allowed: ['random'], required: [], refs: {} },
  exhaust: { allowed: ['random'], required: [], refs: {} },
  addCard: { allowed: ['card', 'pile', 'position', 'count'], required: ['card'], refs: { card: 'cards' } },
  gainEnergy: { allowed: [], required: ['amount'], refs: {} },
  loseHp: { allowed: [], required: ['amount'], refs: {} },
  heal: { allowed: [], required: ['amount'], refs: {} },
  shuffleDiscardIntoDraw: { allowed: [], required: [], refs: {} },
  enterStance: { allowed: ['stance'], required: ['stance'], refs: { stance: 'stances' } },
  poiseDamage: { allowed: [], required: ['amount'], refs: {} },
  addCinders: { allowed: [], required: ['amount'], refs: {} },
  addCardToDeck: { allowed: ['card'], required: ['card'], refs: { card: 'cards' } },
  removeCardFromDeck: { allowed: ['card', 'random'], required: [], refs: { card: 'cards' } },
  upgradeCard: { allowed: ['card', 'random'], required: [], refs: { card: 'cards' } },
  addRelic: { allowed: ['id', 'random'], required: [], refs: { id: 'relics' } },
  addFlask: { allowed: ['id', 'random'], required: [], refs: { id: 'flasks' } },
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

const modifiersSchema = obj({
  damageDealtMult: opt(num),
  damageTakenMult: opt(num),
  blockGainedMult: opt(num),
  attackDamageAdd: opt(num),
  blockAdd: opt(num),
  skipTurn: opt(bool),
  retainBlock: opt(bool),
  blockCap: opt(num),
  meterMaxGrowthDisabled: opt(bool),
});

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

// SFX layer schemas (#46), keyed by `kind` — validate.js discriminates on the
// kind first so an error lands on the field, not on "matched no variant".
// Field semantics are documented where the data lives (content/sfx.js);
// engine defaults for the optional fields live in ui/audio.js tone()/noise().
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
  card: obj({
    id: str,
    name: str,
    class: str, // a class id or 'colorless' (checked in validate.js)
    rarity: en(...CARD_RARITIES),
    cost: costNode,
    type: en(...CARD_TYPES),
    keywords: arr(ref('keywords')),
    effects,
    textTemplate: str,
    upgrade: opt(
      obj({
        name: opt(str),
        cost: opt(costNode),
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
    passives: opt(
      obj({
        runeGainMult: opt(num),
        eliteExtraCardReward: opt(bool),
        flaskPowerMult: opt(num),
        revealUnknown: opt(bool),
        shrineHealMult: opt(num),
        shrineNoRest: opt(bool),
        powerCostReduction: opt(num),
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
    tint: opt(str), // status-pip accent CSS color (display)
    stackMode: en(...STACK_MODES),
    decay: union(en('none', 'perTurnEnd', 'onConsume'), obj({ duration: int })),
    meter: opt(obj({ max: int, growthMult: num, onFill: effects })),
    modifiers: opt(modifiersSchema),
    hooks: opt(triggersNode),
    tooltip: opt(str),
    script: opt(ref('scripts')),
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
    moves: mapOf(enemyMoveSchema),
    firstMove: opt(str), // checked against own moves in validate.js
    phases: opt(arr(enemyPhaseSchema)),
    art: opt(str),
    size: opt(en('small', 'medium', 'large')), // sprite size tier (display)
    tint: opt(str), // border/accent CSS color (display)
    script: opt(ref('scripts')),
  }),

  encounter: obj({
    id: str,
    enemies: arr(ref('enemies')),
    weight: num,
    minFloor: opt(int),
    pool: en(...ENCOUNTER_POOLS),
    act: opt(int), // defaults to 1
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
    targeted: opt(bool),
    effects,
    icon: opt(str),
    textTemplate: opt(str),
    script: opt(ref('scripts')),
  }),

  class: obj({
    id: str,
    name: str,
    maxHp: int,
    glyph: opt(str), // class sigil glyph (display)
    cardTint: opt(str), // card motif hue (display; see styles/ui.css .card)
    startingRelic: ref('relics'),
    startingDeck: arr(ref('cards')),
    cardPool: arr(ref('cards')),
    description: opt(str),
  }),

  mapConfig: obj({
    floors: int,
    columns: int,
    pathCount: int,
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
