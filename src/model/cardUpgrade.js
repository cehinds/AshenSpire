import { RANGES } from './combatRanges.js';
import { SplitAfter } from './splitAfter.js';
import { MULTI_HIT_SP_FLOOR } from '../content/actionCosts.js';

// A card definition with its authored upgrade merged over the base. A leaf
// module: gameProfile.js and registries.js both use it, and importing
// registries.js from gameProfile.js would reorder the bundle's load cycle.
export function upgradedDefinition(base) {
  const up = base.upgrade || {};
  return {
    ...base,
    ...up,
    name: up.name != null ? up.name : `${base.name}+`,
    keywords: up.keywords != null ? up.keywords : base.keywords || [],
    effects: up.effects != null ? up.effects : base.effects,
    textTemplate: up.textTemplate != null ? up.textTemplate : base.textTemplate,
    upgraded: true,
  };
}

// ---- Core card upgrades (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md) ----
//
// An instance keeps `upgraded: boolean` ("at least one upgrade") and may add
// `upgradeSteps: Step[]`. Steps are stored, never re-derived, so a later change
// to the step generator cannot change a card the player owns. An old save with
// `upgraded: true` and no list reads as [{ k: 'authored' }].
//
// Step kinds (the generator in cardUpgradeSteps.js writes them):
//   authored                       the card's own `upgrade` block (step 1 only)
//   dmg { n }                      +n on the first plain damage effect
//   blk { n }                      +n on the first plain block effect
//   stk { status, n }              +n stacks on that status's existing applyStatus
//   addStatus { status, stacks }   a new applyStatus on the enemy
//   cost { pool: 'sp' | 'mp' }     -1 stamina (and action) cost, or -1 mana cost
//   hits { hits, per }             the first damage effect becomes `per` x `hits`
//   poise { n }                    +n on the first plain poiseDamage effect
//   tag { tag?, retarget?, damageSchool? }   a new identity tag (it replaces any tag of the same `range:`,
//                                  `targeting:`, `maneuver:` or `school:` family; `rank.cantrip` just adds),
//                                  `retarget` 'area' | 'single' moves the first damage effect between enemy
//                                  and allEnemies (amount x0.75 up, or x1.25 up), `damageSchool` sets the
//                                  card's damage school (a magical property), with the `exposureBuildupPerHit` an
//                                  authored card of that school carries (balance.exposure.elementUpgradeBuildup)
//                                  `packet` n (with `damage`, `damageSchool`): an element ADDS n magic damage to the hit, or raises the card's own packet
//   (every step may carry `r`: 'uncommon' or 'rare', its rarity; none means common)
//   fx { fx, ... }                 an effect-menu step (W25, owner 2026-11-14), see FX_KINDS below
//   combo { steps }                two effects in one upgrade slot (a later upgrade's 20% roll): every inner step is an fx or a basic step
export const UPGRADE_STEP_KINDS = Object.freeze(['authored', 'dmg', 'blk', 'stk', 'addStatus', 'cost', 'hits', 'poise', 'tag', 'fx', 'combo', 'attr']);
// The tag vocabulary a `tag` step may write: ranges from combatRanges.js, the rest mirrors combatCardProfile.js
// (tests/core-card-upgrade-choices-tags.test.mjs pins the mirror to the exported sets).
// The words are split from one string on purpose: tools/mechanics-generate.mjs takes a file that quotes a bare
// tag value ('force', 'area') for that tag's reader, and this file only stores and replays tags.
const words = (text) => text.split(' ');
export const TARGETING = Object.freeze(words('single area'));
export const TAG_FAMILIES = Object.freeze({
  'range:': RANGES,
  'targeting:': TARGETING,
  'maneuver:': Object.freeze(words('attack defend counter sweep ranged smash casting')),
  'school:': Object.freeze(words('frost fire lightning force alteration illusion divine decay earth')),
});
export const UPGRADE_ELEMENTS = Object.freeze(['magic', 'arcane', 'holy', 'fire']);
// What an element step writes beside the card's damageSchool: the `school:` and `damage:` tags an authored
// elemental card of that kind carries (frostNova: school:frost + damage:frost; the star spells: school:force +
// damage:arcane; the divine spells: school:divine + damage:sacred), so the combat profile, its magic share and
// the Ward lane all read the new element. `magic` is the generic school and, like the authored cards, shows as frost.
const [FROST, FORCE, DIVINE, FIRE] = words('frost force divine fire');
export const ELEMENT_IDENTITY = Object.freeze({
  magic: Object.freeze({ school: FROST, damage: FROST }),
  arcane: Object.freeze({ school: FORCE, damage: 'arcane' }),
  holy: Object.freeze({ school: DIVINE, damage: 'sacred' }),
  fire: Object.freeze({ school: FIRE, damage: FIRE }),
});
// The three physical types a `dmgType` step (a `tag` step with `damage` and no `tag`) may set.
export const PHYSICAL_DAMAGE_TYPES = Object.freeze(words('slashing piercing blunt'));
export const RANK_DOWN_TAG = 'rank.cantrip';
export const MAX_CARD_UPGRADES = 10;
// A rolled step may carry `r`, its rarity, for the picker's colour and label (owner, 2026-11-19). It changes no number: the size is in the step.
export const UPGRADE_RARITIES = Object.freeze(words('common uncommon rare'));
// The effect menu. Each id adds one effect the card did not have: block (n), draw (n), cycle (discard n then draw n),
// cull (exhaust a card, draw 2), copy (add a copy of this card to the discard pile), shuffle (discard into draw),
// retain / innate (keywords), unexhaust (drop Exhaust), holdOne (Retain one other card this turn), boost (+n STR, DEX, INT or WIS
// for this turn or the rest of the fight), target (+1 target at half damage), reaction (the Reaction trait), counter (+1 Counter stack a play; a Counter
// card only, offered while its whole grant stays within the 1..3 a card may give: Wave 2 batch 5).
// unethereal (drop Ethereal) and steady (stop a rising cost) ease a drawback (playtest 2026-11-17, theme C).
export const FX_KINDS = Object.freeze(words('block draw cycle cull copy shuffle retain innate unexhaust holdOne boost target reaction counter unethereal steady'));
export const BOOST_STATS = Object.freeze(words('strength dexterity intelligence wisdom'));
// A boost lasts `until: 'turn'` (the end of the owner's turn) or `until: 'fight'` (the rest of the fight; stacks per play, reverts at the
// fight's end). A step with no `until` is the original STR / DEX "this turn" boost, still played as the Strength / Dexterity status it was.
// The run-long attribute upgrade (`{ k: 'attr', stat, n }`) offers only these two, and only on a spell.
export const RUN_ATTRIBUTE_STATS = Object.freeze(words('intelligence wisdom'));
export const BOOST_DURATIONS = Object.freeze(words('turn fight'));


const AUTHORED_ONLY = Object.freeze([Object.freeze({ k: 'authored' })]);

/** The steps an instance carries: its list, or [authored] for an old `upgraded` flag. */
export function upgradeStepsOf(instance) {
  if (!instance || typeof instance !== 'object') return [];
  // An explicit `upgraded: false` wins: a site that resets the flag (Smithing's equipment-bound basics)
  // and spreads an old instance cannot leave a stale step list playing as an upgrade.
  if (instance.upgraded === false) return [];
  if (Array.isArray(instance.upgradeSteps) && instance.upgradeSteps.length) return instance.upgradeSteps;
  return instance.upgraded ? AUTHORED_ONLY : [];
}

/** How many upgrades the instance has. */
export function upgradeCount(instance) {
  return upgradeStepsOf(instance).length;
}

/**
 * How many upgrades the instance has paid for or earned from its allowance: a rank-up bonus step (`bonus: true`,
 * SPEC card ranks, owner 2026-11-01) is a gift on top of the rank, so it does not use up a free upgrade.
 */
export function paidUpgradeCount(instance) {
  return upgradeStepsOf(instance).filter((step) => !(step && step.bonus === true)).length;
}

/** A short cache-key part: 0 and 1 (authored only) match the old `upgraded ? 1 : 0`. */
export function upgradeSignature(instance) {
  const steps = upgradeStepsOf(instance);
  if (!steps.length) return '0';
  if (steps.length === 1 && steps[0].k === 'authored') return '1';
  return steps.map((s) => Object.entries(s).map(([key, value]) => `${key}=${value}`).join(',')).join(';');
}

/**
 * DeckAttributeBonuses(deck) -> `{ intelligence, wisdom }` the run gains from the run-long attribute upgrades on the cards in the deck.
 * Read from the deck every time, so a card that leaves it takes its bonus along.
 */
export function DeckAttributeBonuses(deck) {
  const out = {};
  for (const card of deck || []) {
    for (const step of FlatSteps(upgradeStepsOf(card))) {
      if (step && step.k === 'attr' && RUN_ATTRIBUTE_STATS.includes(step.stat) && Number.isInteger(step.n) && step.n > 0) out[step.stat] = (out[step.stat] || 0) + step.n;
    }
  }
  return out;
}

const CONDITION_KEYS = ['when', 'if', 'condition', 'unless', 'repeat'];
/** An effect with a plain numeric `amount` and no condition: the ones a step may grow. */
export function isPlainEffect(effect, op) {
  return !!effect && effect.op === op && Number.isFinite(effect.amount) && !CONDITION_KEYS.some((key) => key in effect);
}
/** An applyStatus with a plain numeric `stacks` and no condition. */
export function isPlainStatus(effect) {
  return !!effect && effect.op === 'applyStatus' && Number.isFinite(effect.stacks) && !CONDITION_KEYS.some((key) => key in effect);
}
export function firstPlainIndex(effects, op) {
  return (effects || []).findIndex((effect) => isPlainEffect(effect, op));
}

const hitsOf = (effect) => (Number.isInteger(effect.hits) && effect.hits > 1 ? effect.hits : 1);
// Core 2 charges a multi-hit card at least max(hits - offset, minimum) SP (SPEC 4.3a, model/actionCosts.js multiHitFloorFor):
// offset 0, or 1 for a `finesse` card, or 2 for a Mana card. Mirrored here (not imported from actionCosts) because this module must stay a leaf.
export const hitFloor = (card, hits) => {
  if (!(hits > 1)) return 0;
  const rule = MULTI_HIT_SP_FLOOR;
  const finesse = [...(card.tags || []), ...(card.cardTags || []), ...(card.authoredTags || [])].includes('finesse');
  const offset = Math.max(rule.baseOffset, finesse ? rule.finesseOffset : 0, card.manaCost > 0 ? rule.manaOffset : 0);
  return Math.max(hits - offset, rule.minimum);
};
export const currentHits = (effects) => effects.reduce((most, e) => (e.op === 'damage' ? Math.max(most, hitsOf(e)) : most), 1);


function applyStep(card, step) {
  const effects = (card.effects || []).map((effect) => ({ ...effect }));
  let out = { ...card, effects };
  switch (step.k) {
    case 'dmg':
    case 'blk': {
      const index = firstPlainIndex(effects, step.k === 'dmg' ? 'damage' : 'block');
      if (index >= 0) effects[index].amount += step.n;
      break;
    }
    case 'stk': {
      // A signed step (owner, 2026-11-19) lowers a drawback: a self debuff or enemy buff's stacks, a discard's amount, or the cards
      // an addCard adds. The effect is dropped at 0, with the sentence that named it.
      if (step.op === 'discard' || step.op === 'addCard') {
        const index = effects.findIndex((e) => (step.op === 'discard' ? isPlainEffect(e, 'discard') : e.op === 'addCard' && e.card !== card.id && Number.isFinite(e.count)));
        if (index >= 0) {
          const key = step.op === 'discard' ? 'amount' : 'count';
          effects[index][key] += step.n;
          if (effects[index][key] <= 0) { effects.splice(index, 1); dropEffectText(out, card, step.op === 'discard' ? /discard/i : /\badd\b.*\b(wound|dazed|slimed|guilt|cards?)\b/i); }
        }
      } else if (step.side) {
        const onSelf = step.side === 'self';
        const index = effects.findIndex((e) => isPlainStatus(e) && e.status === step.status && (onSelf ? e.target === 'self' : e.target === 'enemy' || e.target === 'allEnemies'));
        if (index >= 0) {
          effects[index].stacks += step.n;
          if (effects[index].stacks <= 0) { effects.splice(index, 1); dropEffectText(out, card, new RegExp(`\\b${step.status}\\b`, 'i')); }
        }
      } else {
        const effect = effects.find((e) => isPlainStatus(e) && e.status === step.status);
        if (effect) effect.stacks += step.n;
      }
      break;
    }
    case 'addStatus':
      effects.push({ op: 'applyStatus', target: 'enemy', status: step.status, stacks: step.stacks });
      break;
    case 'cost':
      {
        const cut = isCount(step.n, 9) ? step.n : 1;
        if (step.pool === 'mp') out.manaCost = (card.manaCost || 0) - cut;
        else { out.staminaCost = (card.staminaCost || 0) - cut; out.cost = (card.cost ?? 0) - cut; }
      }
      break;
    case 'hits': {
      const index = firstPlainIndex(effects, 'damage');
      if (index >= 0) {
        effects[index].amount = step.per;
        effects[index].hits = step.hits;
        const template = card.textTemplate;
        if (typeof template === 'string' && template.includes('{damage} damage') && !template.includes('{hits}')) {
          out.textTemplate = template.replace('{damage} damage', '{damage} damage {hits} times');
        }
      }
      break;
    }
    // A run-long attribute (W25-L): +n INT or WIS for the run while this card is in the deck (DeckAttributeBonuses). It changes no play of the card itself.
    case 'attr': out.runAttributeBonus = { ...(card.runAttributeBonus || {}), [step.stat]: ((card.runAttributeBonus || {})[step.stat] || 0) + step.n }; break;
    case 'poise': {
      const index = firstPlainIndex(effects, 'poiseDamage');
      if (index >= 0) effects[index].amount += step.n;
      break;
    }
    case 'tag': {
      const packet = Number.isFinite(step.packet) && step.packet > 0 ? step.packet : 0;
      if (step.tag && !(packet && HoldsPacket(card))) {
        const family = Object.keys(TAG_FAMILIES).find((prefix) => step.tag.startsWith(prefix));
        const keep = (tag) => tag !== step.tag && !(family && (tag.startsWith(family) || (family === 'range:' && tag.startsWith('reach:'))));
        const keys = ['tags', 'cardTags'].filter((key) => Array.isArray(card[key]));
        for (const key of keys.length ? keys : ['tags']) out[key] = [...(card[key] || []).filter(keep), step.tag];
        // combatProfileFor lets an explicit `range` / `reach` / `targeting` field beat the tag, so those follow the step.
        const value = family ? step.tag.slice(family.length) : '';
        if (family === 'range:') {
          if (card.range !== undefined) out.range = value;
          if (typeof card.reach === 'string') out.reach = value;
        }
        if (family === 'targeting:' && card.targeting !== undefined) out.targeting = value;
      }
      if (step.retarget) {
        const index = effects.findIndex((e) => isPlainEffect(e, 'damage') && (e.target === 'enemy' || e.target === 'allEnemies'));
        if (index >= 0) {
          const area = step.retarget === TARGETING[1];
          effects[index].target = area ? 'allEnemies' : 'enemy';
          effects[index].amount = Math.max(1, Math.ceil(effects[index].amount * (area ? 0.75 : 1.25)));
        }
      }
      if (step.damageSchool && !(packet && HoldsPacket(card))) out.damageSchool = step.damageSchool;
      if (step.damage && !packet) {
        const keepType = (tag) => !tag.startsWith('damage:');
        const keys = ['tags', 'cardTags'].filter((key) => Array.isArray(card[key]));
        for (const key of keys.length ? keys : ['tags']) out[key] = [...(out[key] || card[key] || []).filter(keepType), `damage:${step.damage}`];
        // combatProfileFor reads an authored `attack` (damage components, a damage type) before the tags, and a
        // weaponDamage block re-derives the components from the wielded weapon, so the whole hit becomes the element:
        // every component takes its type (the shares stay) and the weapon block goes.
        if (card.attack && typeof card.attack === 'object') {
          const { weaponDamage, ...attack } = card.attack;
          if (Array.isArray(attack.components)) attack.components = attack.components.map((part) => ({ ...part, type: step.damage }));
          if (attack.damageType !== undefined) attack.damageType = step.damage;
          out.attack = attack;
        }
      }
      if (Number.isInteger(step.exposureBuildupPerHit)) out.exposureBuildupPerHit = step.exposureBuildupPerHit;
      if (Number.isFinite(step.magicShare)) out.magicShare = step.magicShare;
      if (packet) out = addElementPacket(out, card, step);
      break;
    }
    case 'fx':
      out = applyFx(out, step);
      break;
    case 'combo':
      for (const inner of step.steps) out = applyStep(out, inner);
      break;
    default:
      throw new Error(`Unknown card upgrade step '${step.k}'`);
  }
  return out;
}

// The element packet (owner, 2026-11-19): a physical hit gains a magic part of `step.packet` damage on the same hit. The card keeps its type
// and its maneuver; its one damage effect rises by the packet and its magic share becomes packet / total, so the engine's mixed-hit routing
// (Barrier then Ward for the magic part, Block then Poise for the physical part) and later damage steps (which scale both parts in proportion)
// need nothing else. A physical type the card already chose (a dmgType step) stays the physical part's. A card that already holds a packet
// raises it by the same sizes: it never gains a second element.
export const HoldsPacket = (card) => Number.isFinite(card?.magicShare) && card.magicShare > 0 && card.magicShare < 1 && UPGRADE_ELEMENTS.includes(card.damageSchool);
function addElementPacket(out, card, step) {
  const index = out.effects.findIndex((e) => isPlainEffect(e, 'damage') && (e.target === 'enemy' || e.target === 'allEnemies'));
  if (index < 0) return out;
  const held = HoldsPacket(card) ? card.magicShare : 0;
  const before = out.effects[index].amount;
  const after = before + step.packet;
  out.effects[index].amount = after;
  out.magicShare = (before * held + step.packet) / after;
  if (!held) {
    const physical = (card.cardTags ?? card.tags ?? []).find((tag) => tag.startsWith('damage:') && PHYSICAL_DAMAGE_TYPES.includes(tag.slice(7)));
    if (physical) out.physicalDamageType = physical.slice(7);
    const keepType = (tag) => !tag.startsWith('damage:');
    const keys = ['tags', 'cardTags'].filter((key) => Array.isArray(card[key]));
    for (const key of keys.length ? keys : ['tags']) out[key] = [...(out[key] || card[key] || []).filter(keepType), `damage:${step.damage}`];
    // The face says it: a second sentence names the magic part, and {damage} then reads the physical part alone (model/playingCard.js, engine/combat.js).
    const sentence = `Deal {packet} ${PACKET_NAME[step.damage] || step.damage} damage.`;
    if (typeof card.textTemplate === 'string' && card.textTemplate.includes('{damage}') && !card.textTemplate.includes('{packet}')) out.textTemplate = `${card.textTemplate.replace(/\s+$/, '')} ${sentence}`;
    if (Array.isArray(card.faceTemplate) && !card.faceTemplate.some((line) => line.includes('{packet}'))) out.faceTemplate = [...card.faceTemplate, sentence];
  }
  return out;
}
const PACKET_NAME = Object.freeze({ fire: 'Fire', frost: 'Frost', arcane: 'Arcane', sacred: 'Holy' });

const KEYWORD_OF = { retain: 'retain', innate: 'innate' };
// The lifecycle tag a keyword carries. Built, not quoted: tools/mechanics-generate.mjs names the first file quoting a tag as the code
// that runs it, and the Exhaust and Ethereal rules run in the engine (actions.js, combat.js endPlayerTurn), not in this upgrade step.
const lifecycleTag = (word) => ['lifecycle', word].join('.');
// A step that eases a drawback also drops the sentence and face line that named it, so the text follows the data (review of #2819).
// Base cards draw their authored text and face lines (baseCardPresentation), so both are rewritten here, not only the derived face.
const DRAWBACK_TEXT = Object.freeze({
  unexhaust: /^Exhaust\.?$/i,
  unethereal: /^Ethereal\.?$/i,
  steady: /Stamina each play|per prior play/i,
});
function dropDrawbackText(out, card, fx) { dropEffectText(out, card, DRAWBACK_TEXT[fx]); }
// Drop the sentences of a card's text and face lines that match `pattern`, unless that would leave none.
function dropEffectText(out, card, pattern) {
  if (typeof card.textTemplate === 'string') {
    const sentences = SplitAfter(card.textTemplate, /\.\s+/);
    const kept = sentences.filter((sentence) => !pattern.test(sentence.trim()));
    if (kept.length) out.textTemplate = kept.join(' ');
  }
  if (Array.isArray(card.faceTemplate)) {
    const kept = card.faceTemplate.filter((line) => !pattern.test(line.trim()));
    if (kept.length) out.faceTemplate = kept;
  }
}
const reactionTag = 'trait:reaction';
// One effect-menu step on a card (an `fx` step). New effects are appended, so the card's own effects keep their indices.
function applyFx(card, step) {
  const effects = (card.effects || []).map((effect) => ({ ...effect }));
  const out = { ...card, effects };
  const addTag = (tag) => { for (const key of ['tags', 'cardTags'].filter((k) => Array.isArray(card[k])).concat(Array.isArray(card.tags) || Array.isArray(card.cardTags) ? [] : ['tags'])) out[key] = [...new Set([...(card[key] || []), tag])]; };
  const dropTag = (tag) => { for (const key of ['tags', 'cardTags']) if (Array.isArray(card[key])) out[key] = card[key].filter((t) => t !== tag); };
  switch (step.fx) {
    case 'block': effects.push({ op: 'block', target: 'self', amount: step.n }); break;
    case 'draw': {
      const index = firstPlainIndex(effects, 'draw');
      if (index >= 0) effects[index].amount += step.n; else effects.push({ op: 'draw', amount: step.n });
      break;
    }
    case 'cycle': effects.push({ op: 'discard', amount: step.n, choose: true }, { op: 'draw', amount: step.n }); break;
    case 'cull': effects.push({ op: 'exhaust', amount: 1 }, { op: 'draw', amount: 2 }); break;
    case 'copy': effects.push({ op: 'addCard', card: card.id, count: 1, pile: 'discard' }); break;
    case 'shuffle': effects.push({ op: 'shuffleDiscardIntoDraw' }); break;
    case 'retain': case 'innate': out.keywords = [...new Set([...(card.keywords || []), KEYWORD_OF[step.fx]])]; break;
    case 'unexhaust': out.keywords = (card.keywords || []).filter((word) => word !== 'exhaust'); dropTag(lifecycleTag('exhaust')); dropDrawbackText(out, card, step.fx); break;
    case 'unethereal': out.keywords = (card.keywords || []).filter((word) => word !== 'ethereal'); dropTag(lifecycleTag('ethereal')); dropDrawbackText(out, card, step.fx); break;
    // A rising cost (costGrowth) stops: the card keeps its printed cost on every play.
    case 'steady': out.costGrowth = { stamina: 0, mana: 0 }; dropDrawbackText(out, card, step.fx); break;
    case 'holdOne': effects.push({ op: 'retain', amount: 1 }); break;
    case 'boost':
      // A step with no `until` is a legacy STR / DEX "this turn" boost: the status it always was. Every other boost changes the live attribute (engine/liveStats.js).
      if (step.until === undefined && ['strength', 'dexterity'].includes(step.stat)) effects.push({ op: 'applyStatus', target: 'self', status: step.stat, stacks: step.n, thisTurn: true });
      else effects.push({ op: 'changeAttribute', target: 'self', attribute: step.stat, amount: step.n, ...(step.until === 'fight' ? {} : { thisTurn: true }) });
      break;
    // A step rolled from 2026-11-14 carries `other`: one OTHER enemy, never the main target. A step saved before it keeps a random enemy.
    case 'target': {
      const index = effects.findIndex((e) => isPlainEffect(e, 'damage') && e.target === 'enemy');
      if (index >= 0) effects.push({ op: 'damage', target: step.other ? 'otherEnemy' : 'randomEnemy', amount: Math.max(1, Math.ceil(effects[index].amount * (Number.isFinite(step.share) ? step.share : 0.5))) });
      break;
    }
    case 'reaction': addTag(reactionTag); break;
    case 'counter': effects.push({ op: 'gainCounterStacks', target: 'self', amount: step.n }); break;
    default: throw new Error(`Unknown card upgrade effect '${step.fx}'`);
  }
  return out;
}

/**
 * applyUpgradeSteps(base, steps) → the card face after those steps. [] returns
 * `base` untouched. Step 1 `authored` merges the card's own upgrade block (the
 * old behaviour, name included); a rolled first step starts from the base.
 * One upgrade is named `Name+` (or the authored name); N >= 2 is `Name+N`.
 */
/** The steps with each `combo` replaced by its inner steps (a combo is two effects in one slot). */
export const FlatSteps = (steps) => (steps || []).flatMap((step) => (step && step.k === 'combo' && Array.isArray(step.steps) ? step.steps : [step]));

/** The rolled steps that only remove a drawback (keyword or rising cost). They are the steps a ranked ability card can take: its grade
 * table owns its numbers, so no other step applies, but these never touch a number (review of #2819: the offer must equal the effect). */
export const DrawbackSteps = Object.freeze(['unexhaust', 'unethereal', 'steady']);
/** A ranked ability card's grade face with its drawback-removal steps applied; every other step is the grade table's to own. */
export function ApplyDrawbackSteps(card, steps) {
  const easing = FlatSteps(steps || []).filter((step) => step && step.k === 'fx' && DrawbackSteps.includes(step.fx));
  return easing.reduce((out, step) => applyFx(out, step), card);
}

export function applyUpgradeSteps(base, steps) {
  if (!Array.isArray(steps) || !steps.length) return base;
  let card = steps[0].k === 'authored'
    ? upgradedDefinition(base)
    : { ...base, name: `${base.name}+`, keywords: base.keywords || [], upgraded: true };
  for (let i = steps[0].k === 'authored' ? 1 : 0; i < steps.length; i += 1) {
    if (steps[i].k === 'authored') throw new Error('An authored upgrade step must be the first step');
    card = applyStep(card, steps[i]);
  }
  // Basics cost no Mana and a cantrip at most 1 (owner, 2026-11-22; SPEC, card upgrades): a rank-down step zeroes (inside both limits) the copy's Mana, whatever the
  // order of the steps, so a saved instance resolves the same way (no migration).
  if (FlatSteps(steps).some((step) => step && step.k === 'tag' && step.tag === RANK_DOWN_TAG)) {
    card.manaCost = 0;
    // Zeroing Mana also drops the Mana offset of the Core 2 multi-hit Stamina floor, so the engine could charge more
    // than the face prints: print the floor instead, so face, preview and combat agree.
    const floor = hitFloor({ ...card, manaCost: 0 }, currentHits(card.effects || []));
    if (Number.isInteger(card.staminaCost) && floor > card.staminaCost) {
      card.cost = (card.cost ?? card.staminaCost) + (floor - card.staminaCost);
      card.staminaCost = floor;
    }
  }
  if (steps.length >= 2) card.name = `${base.name}+${steps.length}`;
  return card;
}

const isCount = (value, max = 99) => Number.isInteger(value) && value >= 1 && value <= max;
/** Problems with an instance's optional `upgradeSteps` (empty when sound or absent). */
export function upgradeStepsProblems(instance, path) {
  const steps = instance && instance.upgradeSteps;
  if (steps === undefined) return [];
  if (!Array.isArray(steps)) return [`${path}.upgradeSteps must be an array when present`];
  const problems = [];
  // The cap counts slot-using steps; rank-up bonus steps (bonus: true) are gifts on top, at most one per rank-up.
  const paid = steps.filter((step) => !(step && step.bonus === true)).length;
  if (paid > MAX_CARD_UPGRADES || steps.length > 2 * MAX_CARD_UPGRADES) problems.push(`${path}.upgradeSteps holds at most ${MAX_CARD_UPGRADES} upgrades`);
  if (steps.length && instance.upgraded !== true) problems.push(`${path}.upgradeSteps requires upgraded: true`);
  steps.forEach((step, i) => {
    const at = `${path}.upgradeSteps[${i}]`;
    if (!step || typeof step !== 'object' || Array.isArray(step) || !UPGRADE_STEP_KINDS.includes(step.k)) {
      problems.push(`${at} must be a known step kind (${UPGRADE_STEP_KINDS.join(', ')})`);
      return;
    }
    if (step.k === 'authored' && i !== 0) problems.push(`${at}: an authored step may only be the first step`);
    const bad = (field) => problems.push(`${at}.${field} is not valid for a '${step.k}' step`);
    if (step.r !== undefined && !UPGRADE_RARITIES.includes(step.r)) bad('r');
    const easing = step.k === 'stk' && (step.op !== undefined || step.side !== undefined);
    if (easing) {
      // A signed drawback step: n is negative; `op` names a discard or addCard effect, `side` and `status` a status effect.
      if (!(Number.isInteger(step.n) && step.n <= -1 && step.n >= -99)) bad('n');
      if (step.op !== undefined && !['discard', 'addCard'].includes(step.op)) bad('op');
      if (step.side !== undefined && !['self', 'enemy'].includes(step.side)) bad('side');
    } else if (['dmg', 'blk', 'stk', 'poise'].includes(step.k) && !isCount(step.n)) bad('n');
    if (['stk', 'addStatus'].includes(step.k) && step.op === undefined && !(typeof step.status === 'string' && step.status)) bad('status');
    if (step.k === 'addStatus' && !isCount(step.stacks)) bad('stacks');
    if (step.k === 'cost' && step.pool !== 'sp' && step.pool !== 'mp') bad('pool');
    if (step.k === 'cost' && step.n !== undefined && !isCount(step.n, 9)) bad('n');
    if (step.k === 'hits' && !(isCount(step.hits, 3) && step.hits >= 2)) bad('hits');
    if (step.k === 'hits' && !isCount(step.per)) bad('per');
    if (step.k === 'fx') {
      if (!FX_KINDS.includes(step.fx)) bad('fx');
      if (['block', 'draw', 'cycle', 'boost'].includes(step.fx) && !isCount(step.n, 20)) bad('n');
      if (step.fx === 'counter' && !isCount(step.n, 3)) bad('n');
      if (step.share !== undefined && !(step.fx === 'target' && step.share > 0 && step.share <= 1)) bad('share');
      if (step.fx === 'boost' && !BOOST_STATS.includes(step.stat)) bad('stat');
      if (step.fx === 'boost' && step.until !== undefined && !BOOST_DURATIONS.includes(step.until)) bad('until');
      if (step.fx === 'boost' && step.until === undefined && !['strength', 'dexterity'].includes(step.stat)) bad('until');
    }
    if (step.k === 'attr') {
      if (!RUN_ATTRIBUTE_STATS.includes(step.stat)) bad('stat');
      if (!isCount(step.n, 3)) bad('n');
    }
    if (step.k === 'combo') {
      const inner = step.steps;
      if (!(Array.isArray(inner) && inner.length >= 2 && inner.length <= 2)) bad('steps');
      else upgradeStepsProblems({ upgraded: true, upgradeSteps: inner }, `${at}.steps`).forEach((problem) => problems.push(problem));
      if (Array.isArray(inner) && inner.some((s) => s && (s.k === 'combo' || s.k === 'authored'))) bad('steps');
    }
    if (step.k === 'tag') {
      if (step.tag === undefined && step.retarget === undefined && step.damageSchool === undefined && step.damage === undefined) bad('tag');
      if (step.damage !== undefined && !PHYSICAL_DAMAGE_TYPES.includes(step.damage) && !Object.values(ELEMENT_IDENTITY).some((identity) => identity.damage === step.damage)) bad('damage');
      if (step.tag !== undefined && step.tag !== RANK_DOWN_TAG) {
        const family = typeof step.tag === 'string' ? Object.keys(TAG_FAMILIES).find((prefix) => step.tag.startsWith(prefix)) : null;
        if (!family || !TAG_FAMILIES[family].includes(step.tag.slice(family.length))) bad('tag');
      }
      if (step.retarget !== undefined && !TARGETING.includes(step.retarget)) bad('retarget');
      if (step.damageSchool !== undefined && !UPGRADE_ELEMENTS.includes(step.damageSchool)) bad('damageSchool');
      if (step.magicShare !== undefined && !(Number.isFinite(step.magicShare) && step.magicShare >= 0 && step.magicShare <= 1)) bad('magicShare');
      if (step.packet !== undefined && !(Number.isInteger(step.packet) && step.packet >= 1 && step.packet <= 99)) bad('packet');
      if (step.exposureBuildupPerHit !== undefined && !(Number.isInteger(step.exposureBuildupPerHit) && step.exposureBuildupPerHit >= 0 && step.exposureBuildupPerHit <= 99)) bad('exposureBuildupPerHit');
    }
  });
  return problems;
}
