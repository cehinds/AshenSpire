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

export function combatLogEntries(events, { registries, players = [], enemies = [] } = {}) {
  const names = new Map(players.map(player => [player.id, player.name || 'Forsaken']));
  for (const enemy of enemies) names.set(enemy.id, registries?.enemies.get(enemy.enemyId)?.name || 'Enemy');
  const name = id => names.get(id) || (id === 'player' ? 'Forsaken' : 'Enemy');
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
        text = lost ? `${source} dealt ${lost} damage to ${target}${event.blocked ? ` (${event.blocked} blocked)` : ''}.`
          : `${target} ${event.blocked ? `blocked ${event.blocked} damage` : 'resisted the attack'}.`;
        break;
      }
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
      case 'combatGuardBroken': text = `Guard broken! (+${event.poise} Poise pressure)`; break;
      case 'impactDealt': if (event.poiseDamage || event.wardDamage) text = `${source} dealt ${event.poiseDamage || 0} Poise and ${event.wardDamage || 0} Ward pressure to ${target}.`; break;
      default: break;
    }
    if (text) rows.push({ id, round, text });
  });
  return rows;
}
