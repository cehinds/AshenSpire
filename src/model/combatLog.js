// Public, executed receipts only. Never project predictions or unstarted intents.
const word = value => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase());
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
      case 'impactDealt': if (event.poiseDamage || event.wardDamage) text = `${source} dealt ${event.poiseDamage || 0} Poise and ${event.wardDamage || 0} Ward pressure to ${target}.`; break;
      default: break;
    }
    if (text) rows.push({ id, round, text });
  });
  return rows;
}
