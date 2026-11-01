// Display is derived from the same numeric recipe rather than copying numbers
// into prose. Condition descriptions carry no hidden combat implementation.
export function recipeText(effects, { counterMode = null } = {}) {
  const counts = {};
  const token = base => { const n = counts[base] = (counts[base] || 0) + 1; return `{${base}${n > 1 ? '.' + n : ''}}`; };
  const body = effects.map(e => {
    const t = e.amount != null && e.op !== 'grantCardCharge' ? token(e.op) : e.stacks != null ? token(e.status) : null;
    const target = e.target === 'allEnemies' ? ' every living enemy' : ' the selected enemy';
    let text;
    switch (e.op) {
      case 'damage': text = counterMode
        ? `Prepare ${t} base reply damage${e.hits ? `, ${token('hits')} times` : ''}`
        : `Deal ${t} damage to${target}${e.hits ? `, ${token('hits')} times` : ''}`; break;
      case 'block': text = `Gain ${t} Block`; break;
      case 'draw': text = `Draw ${t} card(s)`; break;
      case 'discard': text = `Choose and discard ${t} card(s)`; break;
      case 'applyStatus': text = `Apply ${t} ${e.status} to${e.target === 'self' ? ' yourself' : target}`; break;
      case 'poiseDamage': text = counterMode ? `Prepare ${t} base reply Poise damage` : `Deal ${t} Break damage to${target}`; break;
      case 'restoreMana': text = `Restore ${t} Mana`; break;
      case 'gainEnergy': text = `Restore ${t} Actions (Stamina)`; break;
      case 'heal': text = `Heal ${t} HP`; break;
      case 'loseHp': text = `Offer ${t} HP; the payment must leave at least one HP`; break;
      case 'removeStatus': text = `Remove ${t || 'all'} ${e.status} stack(s) from yourself`; break;
      case 'addCard': text = `Add ${e.card === 'smokePellet' ? 'a Smoke Pellet' : e.card} to your ${e.pile || 'hand'}`; break;
      case 'grantCardCharge': text = `Your next ${e.cardTag ? e.cardTag + ' ' : ''}${e.abilityKind === 'spell' ? 'spell' : 'direct attack'} this turn ${e.damage ? `deals +${token('chargeDamage')} direct damage` : `costs ${token('chargeManaDiscount')} less Mana (minimum zero)`}; this charge cannot stack with itself`; break;
      default: throw new Error(`No progression text recipe for ${e.op}`);
    }
    return `${e.if ? predicateText(e.if) + ': ' : ''}${text}${e.oncePerTurn ? ', once per turn from this family' : ''}.`;
  }).join(' ');
  return counterMode ? `Prepare ${counterMode === 'spell' ? 'Spell' : counterMode === 'ranged' ? 'Ranged' : 'Melee'} Counter. ${body}` : body;
}

function predicateText(p) {
  switch (p.p) {
    case 'hasBlock': return `If ${p.of === 'self' ? 'you already have' : 'the target has'} Block`;
    case 'hasStatus': return `If ${p.of === 'allEnemies' ? 'any living enemy has' : p.of === 'self' ? 'you have' : 'the target has'} ${p.status}`;
    case 'hpBelowPct': return `If ${p.of === 'target' ? 'the target is' : 'you are'} at or below half HP`;
    case 'firstCardThisTurn': return 'If this is your first card this turn';
    case 'inStance': return `While in ${p.stance}`;
    case 'not': return `Unless (${predicateText(p.pred)})`;
    case 'all': return p.preds.map(predicateText).join(' and ');
    case 'any': return p.preds.map(predicateText).join(' or ');
    case 'turnMetric': return ({
      tagPlays: `If you previously played at least ${p.atLeast} ${p.tag} card(s) this turn`,
      distinctTagPlays: `If you previously played at least ${p.atLeast} distinct ${p.tag} card IDs this turn`,
      manaSpent: `If you previously spent at least ${p.atLeast} Mana this turn`,
      previousSpell: 'If your immediately previous card this turn was a spell',
      discarded: 'If you explicitly discarded a card earlier this turn',
      hpLostSinceTurnStart: 'If you lost HP since your previous turn began',
      offeringsPaid: 'If you paid another HP offering earlier this turn',
      turnStartHpPct: 'If you began this turn at or below half HP',
    })[p.metric];
    default: throw new Error(`No progression condition description for ${p.p}`);
  }
}

// The glance face's short reading of a recipe (card `faceTemplate`): the first two unconditional effects, each in at
// most five words, never a conditional bonus or a once-per-turn family rider (those stay in Information). Tokens are
// numbered exactly as recipeText numbers them so both bind to the same effect values.
const words = text => text.replace(/\{[^}]*\}/g, 'N').split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
const statusName = id => String(id).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
export function recipeFace(effects, { counterMode = null } = {}) {
  const counts = {};
  const token = base => { const n = counts[base] = (counts[base] || 0) + 1; return `{${base}${n > 1 ? '.' + n : ''}}`; };
  const phrases = [];
  if (counterMode) phrases.push({ plain: true, options: [`Prepare ${counterMode === 'spell' ? 'Spell' : counterMode === 'ranged' ? 'Ranged' : 'Melee'} Counter`] });
  for (const e of effects) {
    const t = e.amount != null && e.op !== 'grantCardCharge' ? token(e.op) : e.stacks != null ? token(e.status) : null;
    const all = e.target === 'allEnemies';
    let options;
    switch (e.op) {
      case 'damage': { const hits = e.hits ? token('hits') : null;
        options = counterMode ? [`Prepare ${t} reply damage`] : [`Deal ${t} damage${all ? ' to all' : ''}${hits ? `, ${hits}×` : ''}`, `Deal ${t} damage${all ? ' to all' : ''}`, `Deal ${t} damage`]; break; }
      case 'block': options = [`Gain ${t} Block`]; break;
      case 'draw': options = [`Draw ${t} cards`]; break;
      case 'discard': options = [`Discard ${t} cards`]; break;
      case 'applyStatus': options = e.target === 'self' ? [`Gain ${t} ${statusName(e.status)}`] : [`Apply ${t} ${statusName(e.status)}${all ? ' to all' : ''}`, `Apply ${t} ${statusName(e.status)}`]; break;
      case 'poiseDamage': options = counterMode ? [`Prepare ${t} reply Poise damage`] : [`Deal ${t} Poise damage`]; break;
      case 'restoreMana': options = [`Restore ${t} Mana`]; break;
      case 'gainEnergy': options = [`Restore ${t} Stamina`]; break;
      case 'heal': options = [`Heal ${t} HP`]; break;
      case 'loseHp': options = [`Offer ${t} HP`]; break;
      case 'removeStatus': options = [`Remove ${statusName(e.status)}`]; break;
      case 'addCard': options = [`Add ${e.card === 'smokePellet' ? 'a Smoke Pellet' : e.card} to hand`]; break;
      case 'grantCardCharge': options = e.damage ? [`Next ${e.abilityKind === 'spell' ? 'spell' : 'attack'} deals +${token('chargeDamage')}`] : [`Next spell costs ${token('chargeManaDiscount')} less`]; break;
      default: options = [];
    }
    phrases.push({ conditional: !!(e.if || e.oncePerTurn), options });
  }
  const plainOnes = phrases.filter(p => !p.conditional);
  const lines = (plainOnes.length ? plainOnes : phrases).map(p => p.options.find(o => words(o) <= 5)).filter(Boolean).slice(0, 2);
  return lines.length ? lines : undefined;
}
