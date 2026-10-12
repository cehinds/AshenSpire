// Public, executed receipts only. Never project predictions or unstarted intents.
const word = value => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase());
const ATTACK_KIND_WORDS = { sweep: 'a Sweep', ranged: 'a ranged attack', spell: 'a spell', area: 'an area attack',
  statusOnly: 'a status effect', attack: 'this attack' };
const RESOURCE_WORDS = { stamina: 'SP', mana: 'MP' };
// Why an in-hand Counter or defensive Sweep was not offered (SPEC §4.10).
function reactionUnavailableText(event, { registries, source, owner }) {
  const card = registries?.cards.get(event.cardId ?? event.cardIds?.[0]);
  const tags = card?.cardTags || card?.tags || [];
  const verb = tags.includes('maneuver:sweep') ? 'Sweep' : 'Counter';
  switch (event.reason) {
    case 'notCovered': return `No reaction: Counter can't answer ${ATTACK_KIND_WORDS[event.attackKind] || 'this attack'}.`;
    case 'cost': return event.resource === 'hp'
      ? `Not enough HP to ${card?.name || 'use that card'} (need ${event.need}, have ${event.have}).`
      : `Not enough ${RESOURCE_WORDS[event.resource] || 'SP'} to ${verb} (need ${event.need}, have ${event.have}).`;
    case 'switchOff': return 'No reaction: Reactions are off.';
    case 'attackerStaggered': return `No reaction: ${source} is staggered.`;
    case 'attackerControlled': return `No reaction: ${source} can't act.`;
    case 'controlled': return `No reaction: ${owner} must recover from control first.`;
    case 'unplayable': return `No reaction: ${card?.name || 'that card'} can't be played.`;
    case 'alreadyAnswered': return "One reaction per attack: the rest of this attack can't be answered.";
    default: return 'No reaction available.';
  }
}

function nameLookup({ registries, players = [], enemies = [] }) {
  const names = new Map(players.map(player => [player.id, player.name || 'Forsaken']));
  for (const enemy of enemies) names.set(enemy.id, registries?.enemies.get(enemy.enemyId)?.name || 'Enemy');
  return id => names.get(id) || (id === 'player' ? 'Forsaken' : 'Enemy');
}

/** The log's own words for one combatReactionUnavailable, without the co-op seat prefix. */
export function reactionUnavailableNote(event, { registries, players = [], enemies = [] } = {}) {
  const name = nameLookup({ registries, players, enemies });
  return reactionUnavailableText(event, { registries, source: name(event.sourceId), owner: name(event.ownerId) });
}

export function combatLogEntries(events, { registries, players = [], enemies = [] } = {}) {
  const name = nameLookup({ registries, players, enemies });
  const rows = [];
  let round = 1;
  events.forEach((event, id) => {
    if (event.type === 'playerTurnStart' && Number.isSafeInteger(event.turn)) round = Math.max(round, event.turn);
    const source = name(event.sourcePlayerId || event.sourceId || event.playerId);
    const target = name(event.targetPlayerId || (event.targetId === 'player' ? event.playerId || event.sourcePlayerId || 'player' : event.targetId));
    let text;
    switch (event.type) {
      case 'cardPlayed': {
        const card = registries?.cards.get(event.cardId)?.name || 'a card';
        const costs = [`${event.staminaSpent ?? event.energySpent ?? 0} SP`, ...(event.manaSpent ? [`${event.manaSpent} MP`] : [])];
        text = `${source} played ${card}${event.upcastTier ? ` (Upcast ${event.upcastTier})` : ''} · ${costs.join(', ')}.`;
        break;
      }
      case 'enemyMoveStarted': text = `${source} used ${word(event.moveId)}.`; break;
      case 'combatCounterTriggered': text = `${source} counterattacked ${target}.`; break;
      case 'damageDealt': {
        const lost = Math.max(0, event.amount - (event.blocked || 0));
        // Each layer's share, with what is left of it: Barrier, Ward, Block, then the damage actually inflicted.
        const barrier = event.barrierAbsorbed || 0, ward = event.wardAbsorbed || 0, poise = event.poiseAbsorbed || 0;
        const layers = [
          ...(barrier ? [`Barrier absorbed ${barrier} (${(event.barrierRemaining || 0) + barrier} → ${event.barrierRemaining || 0})`] : []),
          ...(ward ? [`Ward absorbed ${ward} (${(event.wardRemaining || 0) + ward} → ${event.wardRemaining || 0})`] : []),
          ...(event.blocked ? [`Block absorbed ${event.blocked} (${(event.blockRemaining || 0) + event.blocked} → ${event.blockRemaining || 0})`] : []),
          ...(poise ? [`Poise absorbed ${poise} (${(event.poiseRemaining || 0) + poise} → ${event.poiseRemaining || 0})`] : []),
        ];
        if (barrier || ward || poise) {
          text = lost ? `${source} hit ${target} for ${event.amount + barrier + ward + poise}: ${layers.join(', ')}; ${lost} damage dealt.`
            : `${target} resisted the attack: ${layers.join(', ')}.`;
        } else {
          text = lost ? `${source} dealt ${lost} damage to ${target}${event.blocked ? ` (${event.blocked} blocked)` : ''}.`
            : `${target} ${event.blocked ? `blocked ${event.blocked} damage` : 'resisted the attack'}.`;
        }
        break;
      }
      // A miss shows the roll and what it needed (white MISS on the fighter).
      case 'combatAvoidanceResolved': {
        if (!event.avoided) break;
        const e = event.evade, d = event.distance;
        if (e?.success) text = `${source} missed ${target}: Evade rolled ${e.roll}${e.total !== e.roll ? ` + ${e.total - e.roll} bonus = ${e.total}` : ''}, needed more than ${e.difficulty}.`;
        else if (d?.success) text = `${source} missed ${target}: distance rolled ${d.roll}, needed ${d.chance} or less.`;
        else if (event.prevention) text = `${source} missed ${target} (${word(event.prevention)}).`;
        break;
      }
      case 'barrierBroken': text = `${target}'s Barrier broke.`; break;
      case 'wardBroken': text = event.interrupted ? `${target}'s Ward broke (interrupted, −${event.staminaLoss} Stamina).` : `${target}'s Ward broke${event.staminaLoss ? ` (−${event.staminaLoss} Stamina next turn)` : ''}.`; break;
      case 'persistentWardChanged': if (event.restored > 0) text = `${target} restored ${event.restored} Ward (${event.value - event.restored} → ${event.value}).`; break;
      case 'poiseBroken': text = event.interrupted ? `${target}'s Poise broke (interrupted, −${event.staminaLoss} Stamina).` : `${target}'s Poise broke${Number.isFinite(event.staminaLoss) ? (event.staminaLoss ? ` (−${event.staminaLoss} Stamina next turn)` : '') : ' (staggered)'}.`; break;
      case 'barrierGained': text = `${target} gained ${event.amount} Barrier.`; break;
      case 'ratingImpact': if (event.meter === 'poise' && event.amount > 0) text = `${target}'s stagger meter took ${event.amount} (${event.value}/${event.max}).`; break;
      case 'blockGained': text = `${target} gained ${event.amount} Block.`; break;
      case 'healed': text = `${target} recovered ${event.amount} HP.`; break;
      case 'hpLost': if (event.cause !== 'attack') text = `${target} lost ${event.amount} HP.`; break;
      case 'statusApplied': text = `${target} gained ${registries?.statuses.get(event.status)?.name || word(event.status)}.`; break;
      case 'statusExpired': text = `${target}'s ${registries?.statuses.get(event.status)?.name || word(event.status)} expired.`; break;
      case 'dodgeRolled': if (event.success) text = `${target} evaded the attack.`; break;
      case 'enemyDied': text = `${target} was defeated.`; break;
      case 'playerDowned': text = `${name(event.playerId || 'player')} was downed.`; break;
      case 'combatReactionChosen': if (!event.cardInstanceId) text = `${name(event.ownerId)} skipped the reaction.`; break;
      case 'combatReactionUnavailable': {
        const why = reactionUnavailableText(event, { registries, source: name(event.sourceId), owner: name(event.ownerId) });
        text = players.length > 1 ? `${name(event.ownerId)}: ${why}` : why;
        break;
      }
      // `poise` is the nominal break bonus before Poise Guard absorbs any of it: pressure, not damage taken.
      case 'combatGuardBroken': text = event.poise > 0 ? `Guard broken! (+${event.poise} Poise pressure)` : 'Guard broken!'; break;
      case 'impactDealt': if (event.poiseDamage || event.wardDamage) text = `${source} dealt ${event.poiseDamage || 0} Poise and ${event.wardDamage || 0} Ward pressure to ${target}.`; break;
      default: break;
    }
    if (text) rows.push({ id, round, text });
  });
  return rows;
}
