// src/model/cardFaceText.js — the text a playing card's face says, as lines.
//
// ONE MODEL FOR EVERY CARD FACE. It reads the same context combatCardSummary
// reads (cardSummaryContext in playingCard.js), so a number on the face comes
// from the same preview the engine executes (SPEC §3.13) and never from a
// second formula. The output is data: `{ kind, html }` lines in display
// priority (damage, status, condition, gain, bonus, detail). The view decides
// where the lines go. `html` is escaped, and every number is
// `<span class="val">n</span>`, gaining ` up` or ` down` when the live preview
// has moved it from its static base. Without a preview no number is marked.
//
// Returns null for a card with an effect it cannot phrase (the same cases as
// combatCardSummary). The caller then keeps the authored text.

import { cardSummaryContext, combatCardDamageLabel, splitOf } from './playingCard.js';
import { isSpellCard } from './combatCardProfile.js';
import { tagService } from './tagService.js';
import { resolve as resolveTags } from '../content/tags.js';
import { combatExpansionMatchups } from '../content/combatMatchups.js';

const UNPHRASEABLE = Symbol('unphraseable');
const fail = () => { throw UNPHRASEABLE; };

// Conditional riders follow the statuses they extend, ahead of gains (owner: damage and status first).
const LINE_ORDER = ['damage', 'status', 'condition', 'gain', 'bonus', 'detail'];
// Play restrictions first. A keyword outside this list keeps the authored text.
const KEYWORDS = ['unplayable', 'exhaust', 'retain', 'ethereal', 'innate'];
const ENEMY_TARGETS = ['enemy', 'allEnemies', 'randomEnemy'];
const STATUS_NEVER_PHRASED = ['invulnerability', 'decoy', 'grounded', 'sleep'];
// Statuses whose name is not their effect: the face adds the status's own tooltip line.
const MECHANIC_STATUSES = ['concealed', 'bulwarkEcho', 'stoneskin', 'entombed'];


const canonical = value => JSON.stringify(value, (key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
function counterModeOf(def, profile) {
  const defaults = combatExpansionMatchups.counter.defaultCoverage;
  if (!def.counterCoverage) return profile.counterMode || (profile.camp === 'spell' ? 'spell' : 'melee');
  return Object.keys(defaults).find(mode => canonical(defaults[mode]) === canonical(def.counterCoverage)) || null;
}

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** The card-face lines for `def`, or null when a part of it cannot be phrased. */
export function cardFaceLines(def, preview = null, registries = null) {
  try {
    return buildLines(def, preview, registries);
  } catch (error) {
    if (error === UNPHRASEABLE) return null;
    throw error;
  }
}

function buildLines(def, preview, registries) {
  if (def.comboHook) return null;
  // A Power's status is its mechanic's carrier ("Gain Goreblood 1" says nothing); its authored text explains it.
  if (def.type === 'power') return null;
  // A curse's hand trigger and an Ashen Blight price live only in the authored text.
  if (def.onTurnEndInHand?.length || def.ashenBlightCost) return null;
  const { value, title, condition, profile: p, bindings, tokens } = cardSummaryContext(def, preview, registries);
  const ratings = registries?.balance?.combatRatings ?? null;
  const counter = p.maneuver === 'counter';
  // A counter is prepared, not dealt: name its mode ("Prepare Melee Counter: return …").
  // Coverage is named by the mode whose default it equals; any other coverage keeps the authored text.
  const counterMode = counter ? counterModeOf(def, p) : null;
  if (counter && !counterMode) return null;
  const damageVerb = counter ? `Prepare ${{ melee: 'Melee', ranged: 'Ranged', spell: 'Spell' }[counterMode]} Counter: return` : 'Inflict';

  // The static number an effect's field authored: its token's base, else the literal.
  const baseOf = (effect, index, field) => {
    const token = bindings.find(row => row.index === index && row.field === field)?.token;
    const fromToken = token === undefined ? undefined : tokens[token];
    if (typeof fromToken === 'number') return fromToken;
    return typeof effect[field] === 'number' ? effect[field] : undefined;
  };

  // A number as a span; up or down only when a live preview has moved it off its base.
  const num = (amount, base = undefined) => {
    if (amount === '?' || amount === undefined || amount === null || (typeof amount === 'number' && !Number.isFinite(amount))) fail();
    // A formula described in words ("Bleed stacks on the target") is not a number: keep the authored text.
    if (typeof amount === 'string' && !/^\d+$/.test(amount)) fail();
    let cls = 'val';
    if (preview && typeof amount === 'number' && typeof base === 'number') {
      if (amount > base) cls += ' up';
      else if (amount < base) cls += ' down';
    }
    return `<span class="${cls}">${esc(amount)}</span>`;
  };

  const typeWord = id => {
    const service = registries && tagService(registries);
    const list = [`damage:${id}`];
    return (service ? service.resolve(list) : resolveTags(list)).map(tag => tag.label).join('');
  };
  const typed = (amountHtml, label) => (label ? `${amountHtml} ${esc(label)}` : amountHtml);
  const areaOf = target => target === 'allEnemies' ? ' to all enemies' : target === 'randomEnemy' ? ' to a random enemy' : '';
  const durationOf = effect => {
    if (effect.duration === undefined) return '';
    if (typeof effect.duration !== 'number') fail();
    return ` (${num(effect.duration, effect.duration)} turns)`;
  };

  const chances = [];
  // Each effect becomes fragments: `{ cat, text }`, cat in damage | status | remove | gain | bonus.
  const phraseEffect = (effect, index) => {
    const n = value(effect, index), base = baseOf(effect, index, 'amount');
    const area = areaOf(effect.target);
    const frag = (cat, text) => [{ cat, text }];
    switch (effect.op) {
      case 'damage': {
        const live = preview?.values?.[index], hits = live?.hits ?? effect.hits ?? 1;
        if (typeof hits !== 'number') fail();
        const sequence = live?.hitDamages;
        const unequal = sequence?.length > 1 && sequence.some(amount => amount !== sequence[0]);
        // The face names the hit's leading type only ("Lightning", not "Lightning · Piercing"); inspection keeps the full label.
        const type = combatCardDamageLabel(def, preview, registries, index).split(' · ')[0];
        const word = `${type ? `${esc(type)} ` : ''}damage`;
        // A hit part magic and part physical names both parts, the physical first.
        const split = !unequal && hits === 1 ? splitOf(def, p, n, ratings, live) : null;
        let text;
        if (split) {
          // Each part compares with the same split of the static base, so a boosted hit colours both parts.
          const baseSplit = typeof base === 'number' ? splitOf(def, p, base, ratings) : null;
          text = `${typed(num(split.physical, baseSplit?.physical), typeWord(split.types.physical))}, ${typed(num(split.magic, baseSplit?.magic), typeWord(split.types.magic))} damage`;
        } else if (unequal) {
          text = `${sequence.map(amount => num(amount, base)).join(' + ')} ${word} (${num(live.totalDamage, typeof base === 'number' && typeof effect.hits === 'number' ? base * effect.hits : undefined)} total across ${sequence.length} hits)`;
        } else {
          text = `${num(n, base)} ${word}${hits !== 1 ? ` ×${num(hits, typeof effect.hits === 'number' ? effect.hits : undefined)}` : ''}`;
        }
        return frag('damage', text + area);
      }
      case 'poiseDamage': return frag('damage', `${num(n, base)} Poise damage${area}`);
      case 'wardDamage': return frag('damage', `${num(n, base)} Ward damage${area}`);
      case 'block': {
        if (effect.target === 'ally') return frag('bonus', `Ally gains ${num(n, base)} Block`);
        const split = splitOf(def, p, n, ratings);
        if (split) {
          // Each part compares with the same split of the static base, as a split hit does.
          const baseSplit = typeof base === 'number' ? splitOf(def, p, base, ratings) : null;
          return frag('gain', `${num(split.physical, baseSplit?.physical)} Block, ${num(split.magic, baseSplit?.magic)} Ward`);
        }
        return frag('gain', `${num(n, base)} Block`);
      }
      // A Spell's gain refills Ward first, so it reads Ward.
      case 'gainBarrier': return frag('gain', `${num(n, base)} ${isSpellCard({ combatProfile: p, tags: def.tags }) ? 'Ward' : 'Barrier'}`);
      case 'gainWard': return frag('gain', `${num(n, base)} Ward${effect.oncePerCombat ? ' once per combat' : ''}`);
      case 'gainPoise': return frag('gain', `${num(n, base)} Poise guard`);
      case 'restoreMana': return frag('gain', `${num(n, base)} Mana`);
      case 'restoreStamina':
      case 'gainEnergy': return frag('gain', `${num(n, base)} SP`);
      case 'heal': return frag('bonus', `Heal ${effect.target === 'ally' ? 'an ally for ' : ''}${num(n, base)} HP`);
      case 'buildup': {
        // The face names the status and amount; a partial chance is kept for the detail line.
        if (effect.chance !== undefined && effect.chance < 100) chances.push({ name: title(effect.status), chance: effect.chance });
        return frag('status', `${esc(title(effect.status))} ${num(n, base)}${area}`);
      }
      case 'applyStatus': {
        if (STATUS_NEVER_PHRASED.includes(effect.status)) fail();
        const stacks = value(effect, index, 'stacks'), stacksBase = baseOf(effect, index, 'stacks');
        const name = `${esc(title(effect.status))} ${num(stacks, stacksBase)}`, duration = durationOf(effect);
        const out = [];
        if (effect.target === 'self') out.push({ cat: 'gain', text: `${name}${duration}` });
        else if (ENEMY_TARGETS.includes(effect.target)) out.push({ cat: 'status', text: `${name}${duration}${area}` });
        else if (effect.target === 'ally') out.push({ cat: 'bonus', text: `Apply ${name} to an ally${duration}` });
        else out.push({ cat: 'bonus', text: `Apply ${name}${duration}${area}` });
        if (MECHANIC_STATUSES.includes(effect.status)) {
          const explanation = registries?.statuses?.has(effect.status) && registries.statuses.get(effect.status).tooltip;
          if (!explanation) fail();
          out.push({ cat: 'bonus', text: esc(explanation.replace(/\.$/, '')) });
        }
        return out;
      }
      case 'removeStatus': {
        const amount = effect.amount === undefined ? 'all' : num(n, base);
        const suffix = effect.target === 'enemy' ? ' from target' : effect.target === 'ally' ? ' from an ally' : area;
        return frag('remove', `${amount} ${esc(title(effect.status))}${suffix}`);
      }
      case 'draw': return frag('bonus', `Draw ${num(n, base)}`);
      case 'discard': return frag('bonus', `${effect.choose ? 'Choose and discard' : 'Discard'} ${num(n, base)}${effect.random ? ' at random' : ''}`);
      case 'loseHp': return frag('bonus', `${effect.offering ? 'Offer' : 'Pay'} ${num(n, base)} HP${effect.nonlethal ? ' (leave at least 1 HP)' : ''}`);
      case 'retain': return frag('bonus', `Retain ${num(n, base)}`);
      case 'grantRollMode': return frag('bonus', `Next ${esc(effect.roll)}: ${effect.advantage ? 'Advantage' : 'Disadvantage'}`);
      case 'enterStance': return frag('bonus', effect.choose ? 'Choose a stance'
        : `Enter ${esc(registries?.stances?.has(effect.stance) ? registries.stances.get(effect.stance).name : effect.stance)}`);
      // A generated card's own cost and keywords are only in the authored text.
      case 'addCard': return fail();
      case 'grantCardCharge': {
        const bonuses = Object.entries({ damage: 'damage', block: 'Block', heal: 'healing', break: 'Poise', buildup: `${effect.buildupStatus || ''} buildup`, manaDiscount: 'Mana discount' })
          .filter(([key]) => effect[key] !== undefined).map(([key, label]) => key === 'manaDiscount'
            ? `${num(value(effect, index, key), baseOf(effect, index, key))} less Mana (min 0)`
            : `+${num(value(effect, index, key), baseOf(effect, index, key))} ${esc(label)}`);
        const match = [effect.cardType, effect.abilityKind, effect.cardTag].filter(Boolean).join(' ');
        return frag('bonus', `Next ${esc(match || 'matching card')} this turn: ${bonuses.join(', ')}; cannot stack with itself`);
      }
      default: return fail(); // Complex effects keep their authored text.
    }
  };

  // The line a set of fragments reads as, one segment per kind, in fixed order.
  const segmentsOf = (fragments, extraBonus = []) => {
    const of = cat => fragments.filter(f => f.cat === cat).map(f => f.text);
    const out = [];
    const damage = of('damage'), status = of('status'), remove = of('remove'), gain = of('gain'), bonus = [...of('bonus'), ...extraBonus];
    if (damage.length) out.push({ kind: 'damage', text: `${damageVerb} ${damage.join(', ')}` });
    else if (counter && fragments === unconditional) out.push({ kind: 'damage', text: damageVerb.replace(/: return$/, '') });
    if (status.length) out.push({ kind: 'status', text: `Inflict ${status.join(', ')}` });
    if (remove.length) out.push({ kind: 'status', text: `Remove ${remove.join(', ')}` });
    if (gain.length) out.push({ kind: 'gain', text: `Gain ${gain.join(', ')}` });
    if (bonus.length) out.push({ kind: 'bonus', text: bonus.join(', ') });
    return out;
  };

  // A predicate's label: the status name for the card's own status, else "If ...".
  // A stack threshold ("at least 3 Venom") must reach the label; nested ones keep the authored text.
  const thresholdInside = pred => !!pred && typeof pred === 'object'
    && ((pred.p === 'hasStatus' && pred.atLeast !== undefined) || [pred.pred, ...(pred.preds || [])].some(thresholdInside));
  const prefixFor = predicate => {
    if (predicate.p === 'hasStatus') {
      const extra = Object.keys(predicate).filter(key => !['p', 'of', 'status', 'atLeast'].includes(key));
      if (extra.length || (predicate.atLeast !== undefined && typeof predicate.atLeast !== 'number')) fail();
      const name = esc(title(predicate.status)), at = predicate.atLeast;
      if (predicate.of === 'self') return `${name}${at !== undefined ? ` ${num(at)}+` : ''}: `;
      if (at !== undefined) return `If ${predicate.of === 'allEnemies' ? 'an enemy has' : 'the target has'} ${num(at)}+ ${name}: `;
    }
    if (thresholdInside(predicate)) fail();
    // "No Starstone Charge:" reads cleaner than "If not (you have Starstone Charge):".
    if (predicate.p === 'not' && predicate.pred?.p === 'hasStatus' && predicate.pred.of === 'self'
      && Object.keys(predicate.pred).every(key => ['p', 'of', 'status'].includes(key))) return `No ${esc(title(predicate.pred.status))}: `;
    const text = condition(predicate);
    if (!text) fail();
    return `If ${esc(text)}: `;
  };

  const unconditional = [], groups = new Map();
  for (const [index, effect] of (def.effects || []).entries()) {
    const fragments = phraseEffect(effect, index);
    if (effect.oncePerTurn && fragments.length) fragments[fragments.length - 1].text += ' once per turn per family';
    if (effect.if) {
      const key = JSON.stringify(effect.if);
      if (!groups.has(key)) groups.set(key, { prefix: prefixFor(effect.if), fragments: [], sleeping: JSON.stringify(effect.if).includes('"status":"sleep"') });
      groups.get(key).fragments.push(...fragments);
    } else unconditional.push(...fragments);
  }

  // Counter: what the payload returns, for each part the effects do not already deal.
  if (counter) {
    const payload = def.counterPayload || {};
    for (const [key, label, op] of [['hp', 'damage', 'damage'], ['poise', 'Poise', 'poiseDamage'], ['ward', 'Ward', 'wardDamage']]) {
      if ((def.effects || []).some(effect => effect.op === op)) continue;
      const live = preview?.values?.find(row => row.op === op)?.value;
      const amount = live ?? payload[key];
      if (typeof amount !== 'number' || !(amount > 0)) continue;
      const type = key === 'hp' ? combatCardDamageLabel(def, preview, registries) : '';
      unconditional.push({ cat: 'damage', text: `${typed(num(amount, payload[key]), type)} ${label}` });
    }
  }
  if (counter && def.counterPayload?.smashPoiseBonus) unconditional.push({ cat: 'damage', text: `+${num(def.counterPayload.smashPoiseBonus)} Poise against Smash` });
  if (def.pronePoiseBonus) unconditional.push({ cat: 'bonus', text: `+${num(def.pronePoiseBonus)} Poise while Prone` });
  if (def.evade) {
    unconditional.push({ cat: 'bonus', text: `${def.evade.whileStatus ? `While ${esc(title(def.evade.whileStatus))}: ` : ''}Prepare one Evade${def.evade.advantage ? ' with Advantage' : ''}` });
  }

  if ((def.keywords || []).some(keyword => !KEYWORDS.includes(keyword))) return null;
  const keywords = KEYWORDS.filter(keyword => (def.keywords || []).includes(keyword)).map(keyword => keyword[0].toUpperCase() + keyword.slice(1));
  const byKind = { damage: [], status: [], gain: [], condition: [], bonus: [], detail: [] };
  for (const segment of segmentsOf(unconditional, keywords)) byKind[segment.kind].push(segment.text);
  for (const group of groups.values()) {
    // Only damage wakes a sleeper; a rider keyed on Sleep that deals none says so, as its authored text does.
    const wakes = group.fragments.some(f => f.cat === 'damage');
    byKind.condition.push(group.prefix + segmentsOf(group.fragments).map(segment => segment.text).join('. ')
      + (group.sleeping && !wakes ? ' (does not wake it)' : ''));
  }
  const byChance = new Map();
  for (const { name, chance } of chances) byChance.set(chance, [...new Set([...(byChance.get(chance) || []), name])]);
  for (const [chance, names] of byChance) byKind.detail.push(`${names.map(esc).join(', ')}: ${esc(chance)}% chance`);
  if (def.usableWhile?.length) byKind.detail.push(`Usable through ${def.usableWhile.map(id => esc(title(id))).join(', ')}`);

  const lines = [];
  for (const kind of LINE_ORDER) for (const html of byKind[kind]) if (html) lines.push({ kind, html });
  // Nothing phrased (a status or curse with no effects) keeps the authored text, as combatCardSummary does.
  return lines.length ? lines : null;
}
