// Public, executed receipts only. Never project predictions or unstarted intents.
//
// Every effect line names who or what caused it (the actor and the card, move,
// status, relic or stance) and who it landed on. The cause comes from the event
// itself (cardId, moveId, triggeredBy, source); when an older or thinner event
// carries none, the card or move being resolved at that point in the stream
// stands in, but only for an event by that same actor.
const word = value => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase());
const ATTACK_KIND_WORDS = { sweep: 'a Sweep', ranged: 'a ranged attack', spell: 'a spell', area: 'an area attack',
  statusOnly: 'a status effect', attack: 'this attack' };
const RESOURCE_WORDS = { stamina: 'SP', mana: 'MP' };
// What an engine `source` string means when no card, move or trigger raised the effect.
const SOURCE_WORDS = { poise: 'Poise overflow', defendStance: 'Defend stance', sleep: 'Sleep', barrier: 'Barrier overflow',
  rating: 'rating change', recovery: 'Recovery', flux: 'flux' };
// What moved a break meter, by ratingImpact `cause`; a relic or status cause names itself.
const IMPACT_WORDS = { hit: 'the hit', poiseDamage: 'Poise damage', 'trait:impact': 'Impact', 'trait:guard': 'a Defend guard',
  'charge:break': 'a charged break' };
const PREVENTION_WORDS = { invulnerability: 'Invulnerability', decoy: 'Decoy' };

// A registry row by id, or null: a log must never throw on an id it does not know.
const row = (registry, id) => (id != null && registry?.has?.(id) ? registry.get(id) : null);

// Why an in-hand Counter or defensive Sweep was not offered (SPEC §4.10).
function reactionUnavailableText(event, { registries, source, owner }) {
  const card = row(registries?.cards, event.cardId ?? event.cardIds?.[0]);
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
  for (const enemy of enemies) names.set(enemy.id, row(registries?.enemies, enemy.enemyId)?.name || 'Enemy');
  return id => names.get(id) || (id === 'player' ? 'Forsaken' : 'Enemy');
}

/** The log's own words for one combatReactionUnavailable, without the co-op seat prefix. */
export function reactionUnavailableNote(event, { registries, players = [], enemies = [] } = {}) {
  const name = nameLookup({ registries, players, enemies });
  return reactionUnavailableText(event, { registries, source: name(event.sourceId), owner: name(event.ownerId) });
}

const statusName = (registries, id) => row(registries?.statuses, id)?.name || word(id);

// The name of a trigger's origin: a status, a relic, a stance, or any other mounted property.
function originName(registries, origin) {
  if (!origin?.id) return null;
  if (origin.kind === 'status') return statusName(registries, origin.id);
  return row(registries?.[`${origin.kind}s`], origin.id)?.name || word(origin.id);
}

export function combatLogEntries(events, { registries, players = [], enemies = [] } = {}) {
  const name = nameLookup({ registries, players, enemies });
  const enemyIdOf = new Map(enemies.map(enemy => [enemy.id, enemy.enemyId]));
  const moveName = (actorId, moveId, enemyId) => {
    const def = row(registries?.enemies, enemyIdOf.get(actorId)) || row(registries?.enemies, enemyId);
    return def?.moves?.[moveId]?.name || word(moveId);
  };
  // The card or move resolving right now, for events that do not name their own.
  let playing = null, moving = null;
  const rows = [];
  let round = 1;
  events.forEach((event, id) => {
    if (event.type === 'playerTurnStart' && Number.isSafeInteger(event.turn)) round = Math.max(round, event.turn);
    // Seats first: in co-op every player entity is 'player', and the seat id tells them apart.
    const sourceKey = event.sourcePlayerId || event.sourceId || event.playerId;
    const targetKey = event.targetPlayerId || (event.targetId === 'player' ? event.playerId || event.sourcePlayerId || 'player' : event.targetId);
    const source = name(sourceKey);
    const target = name(targetKey);

    // Who caused this event, and with what. Returns { actorKey, label } (either may be null).
    const causeOf = () => {
      // Preparation (a charge-up, Counter priming) runs while the selected move
      // may still be a hidden intent: name the actor, never the move.
      if (event.preparing) return { actorKey: sourceKey, label: null, preparing: true };
      const origin = event.triggeredBy;
      const card = row(registries?.cards, event.cardId)?.name;
      if (card) return { actorKey: sourceKey, label: card };
      if (event.moveId) return { actorKey: sourceKey, label: moveName(event.sourceId, event.moveId) };
      // A trigger's owner, by seat when it is this event's target or source (co-op players are all 'player').
      if (origin?.id) return { actorKey: origin.ownerId === event.targetId ? targetKey : origin.ownerId === event.sourceId ? sourceKey : origin.ownerId,
        label: originName(registries, origin) };
      if (event.statusId) return { actorKey: null, label: `${statusName(registries, event.statusId)} flux` };
      const said = event.source || event.reason;
      if (typeof said === 'string' && SOURCE_WORDS[said]) return { actorKey: sourceKey, label: SOURCE_WORDS[said] };
      // Nothing on the event: what is resolving now, when it is this actor's (or the event names no actor).
      const now = [moving, playing].find(act => act?.label && (!sourceKey || sourceKey === act.actorKey));
      if (now) return { actorKey: now.actorKey, label: now.label };
      return { actorKey: sourceKey || null, label: null };
    };
    // "Forsaken's Blight Touch", "Guard" (the target's own), "from Forsaken", or null.
    const causeText = ({ self = targetKey } = {}) => {
      const { actorKey, label, preparing } = causeOf();
      const actor = actorKey ? name(actorKey) : null;
      if (preparing) return actorKey && actorKey !== self ? `${actor} preparing` : 'preparing';
      if (label) return actorKey && actorKey !== self ? `${actor}'s ${label}` : label;
      return actorKey && actorKey !== self ? `from ${actor}` : null;
    };
    const paren = text => (text ? ` (${text})` : '');
    // "Wyrm Lord's Tail Sweep" / "Forsaken's Strike" / "Wyrm Lord's attack".
    const attackText = () => {
      const { label } = causeOf();
      return `${source}'s ${label || 'attack'}`;
    };

    let text;
    switch (event.type) {
      case 'cardPreparing':
        playing = { actorKey: sourceKey, label: row(registries?.cards, event.cardId)?.name || null };
        break;
      case 'cardResolved': playing = null; break;
      case 'enemyActorTurnStarted': case 'enemyTurnEnd': moving = null; break;
      case 'playerTurnStart': case 'playerTurnEnd': case 'enemyTurnStart': moving = playing = null; break;
      case 'cardPlayed': {
        const card = row(registries?.cards, event.cardId)?.name || 'a card';
        playing = { actorKey: sourceKey, label: card === 'a card' ? null : card };
        const costs = [`${event.staminaSpent ?? event.energySpent ?? 0} SP`, ...(event.manaSpent ? [`${event.manaSpent} MP`] : [])];
        const on = event.targetId && targetKey !== sourceKey ? ` on ${target}` : '';
        text = `${source} played ${card}${event.upcastTier ? ` (Upcast ${event.upcastTier})` : ''}${on} · ${costs.join(', ')}.`;
        break;
      }
      case 'enemyMoveStarted': {
        const move = moveName(event.sourceId, event.moveId, event.enemyId);
        moving = { actorKey: sourceKey, label: move };
        text = event.reaction ? `${source} reacts with ${move}.` : `${source} used ${move}.`;
        break;
      }
      case 'combatCounterTriggered': {
        const { label } = causeOf();
        text = `${source} counterattacked ${target}${label ? ` with ${label}` : ''}.`;
        break;
      }
      case 'damageDealt': {
        const hit = `${attackText()} hit ${target}`;
        // Silenced: a hit that is all Force is negated whole.
        if (event.silencedImmune) { text = `${hit}: ${target} is immune to Force (Silenced).`; break; }
        const barrier = event.barrierAbsorbed || 0, ward = event.wardAbsorbed || 0, poise = event.poiseAbsorbed || 0;
        const blocked = event.blocked || 0;
        const hp = Math.max(0, event.amount - blocked);
        // What reached the layers (Barrier, Ward, Block, Poise, then HP), after typed resistance or weakness.
        const layered = event.amount + barrier + ward + poise;
        // The hit as it arrived. Newer events say so (`incoming`); an older one's typed reduction is
        // the whole protection before Block (`resisted`) less what Barrier and Ward took.
        const incoming = Number.isFinite(event.incoming) ? event.incoming
          : layered + Math.max(0, (event.resisted ?? 0) - barrier - ward);
        const typed = incoming - layered;
        // The blow as dealt (printed amount and rating bonus), before statuses, matchups and criticals.
        const base = Number.isFinite(event.base) ? event.base : incoming;
        const mod = incoming - base;
        const kind = event.damageType ? `${word(event.damageType)} ` : '';
        const parts = [
          ...(mod ? [`modifiers ${mod > 0 ? '+' : '−'}${Math.abs(mod)} (${base} → ${incoming})`] : []),
          ...(typed > 0 ? [`${kind}resisted ${typed} (${incoming} → ${layered})`] : []),
          ...(typed < 0 ? [`${kind}weakness +${-typed} (${incoming} → ${layered})`] : []),
          ...(barrier ? [`Barrier absorbed ${barrier} (${(event.barrierRemaining || 0) + barrier} → ${event.barrierRemaining || 0})`] : []),
          ...(ward ? [`Ward absorbed ${ward} (${(event.wardRemaining || 0) + ward} → ${event.wardRemaining || 0})`] : []),
          ...(blocked ? [`Block absorbed ${blocked} (${(event.blockRemaining || 0) + blocked} → ${event.blockRemaining || 0})`] : []),
          ...(poise ? [`Poise absorbed ${poise} (${(event.poiseRemaining || 0) + poise} → ${event.poiseRemaining || 0})`] : []),
          // Silenced: the hit's Force part was negated, the rest went on.
          ...(event.forceImmune > 0 ? [`${event.forceImmune} Force IMMUNE (Silenced)`] : []),
        ];
        text = `${hit} for ${base}${parts.length ? `: ${parts.join(', ')}` : ''}; ${hp} HP dealt.`;
        break;
      }
      // Each roll, with what it needed. A failed roll is logged too: the hit then lands.
      case 'combatAvoidanceResolved': {
        const e = event.evade, d = event.distance, attack = attackText();
        const lines = [];
        if (event.prevention) lines.push(`${target} avoided ${attack} (${PREVENTION_WORDS[event.prevention] || word(event.prevention)}).`);
        if (d) lines.push(d.success ? `${target} avoided ${attack} at range: distance roll ${d.roll}, needed ${d.chance} or less.`
          : `${target}'s range failed against ${attack}: distance rolled ${d.roll}, needed ${d.chance} or less.`);
        if (e) {
          const roll = Number.isFinite(e.total) && e.total !== e.roll ? `${e.roll} + ${e.total - e.roll} = ${e.total}` : `${e.roll}`;
          lines.push(e.success ? `${target} evaded ${attack}: Evade roll ${roll} beat ${e.difficulty}.`
            : `${target}'s Evade failed against ${attack}: rolled ${roll}, needed more than ${e.difficulty}.`);
        }
        text = lines.length ? lines : null;
        break;
      }
      case 'barrierBroken': text = `${target}'s Barrier broke${paren(causeText())}.`; break;
      case 'wardBroken': case 'poiseBroken': {
        const pool = event.type === 'wardBroken' ? 'Ward' : 'Poise';
        const toll = event.interrupted ? 'interrupted'
          : Number.isFinite(event.staminaLoss) ? (event.staminaLoss ? `−${event.staminaLoss} Stamina next turn` : null)
            : pool === 'Poise' ? 'staggered' : null;
        const by = causeText();
        text = `${target}'s ${pool} broke${paren([by && `by ${by.replace(/^from /, '')}`, toll].filter(Boolean).join('; '))}.`;
        break;
      }
      case 'persistentWardChanged':
        if (event.restored > 0) {
          const by = causeText();
          text = `${target} restored ${event.restored} Ward (${event.value - event.restored} → ${event.value})${by ? ` from ${by.replace(/^from /, '')}` : ''}.`;
        }
        break;
      case 'barrierGained': text = `${target} gained ${event.amount} Barrier${paren(causeText())}.`; break;
      // The break meters (stagger for Poise, disruption for Ward). One blow can move one several times
      // (its hit, its damage-type rider, its printed Poise damage, its Impact trait): `cause` says which.
      case 'ratingImpact': {
        if (!(event.amount > 0)) break;
        const meter = event.meter === 'ward' ? 'disruption' : 'stagger';
        const [kind, key] = String(event.cause || '').split(':');
        const by = causeText();
        const what = IMPACT_WORDS[event.cause] || (kind === 'rider' ? word(key) : null);
        const from = what ? ` from ${what}${paren(by)}` : by ? ` from ${by.replace(/^from /, '')}` : '';
        text = `${target}'s ${meter} meter took ${event.amount}${from} (${event.value}/${event.max}${event.breaks > 0 ? ', broke' : ''}).`;
        break;
      }
      case 'blockGained': text = `${target} gained ${event.amount} Block${paren(causeText())}.`; break;
      case 'healed': text = `${target} recovered ${event.amount} HP${paren(causeText())}.`; break;
      case 'hpLost': {
        if (event.cause === 'attack') break;
        const why = causeText() || (event.cause && event.cause !== 'effect' ? word(event.cause) : null);
        text = `${target} lost ${event.amount} HP${paren(why)}.`;
        break;
      }
      case 'statusApplied': {
        const stacks = event.stacks > 1 ? `${event.stacks} ` : '';
        text = `${target} gained ${stacks}${statusName(registries, event.status)}${paren(causeText())}.`;
        break;
      }
      case 'statusExpired': text = `${target}'s ${statusName(registries, event.status)} expired.`; break;
      // The framework dodge (v1): the player rolls on playing a dodge card; a success lays down a guard.
      case 'dodgeRolled': {
        const dodger = name(sourceKey || 'player');
        const via = paren(causeText({ self: sourceKey }));
        text = event.success
          ? `${dodger}'s Dodge roll ${event.check ?? event.roll} beat ${event.difficulty}${via}${event.temporaryGuard > 0 ? `: +${event.temporaryGuard} Block` : ''}.`
          : `${dodger}'s Dodge failed${via}: rolled ${event.check ?? event.roll} against ${event.difficulty}.`;
        break;
      }
      case 'enemyDied': {
        const by = causeText();
        text = `${target} was defeated${by ? ` by ${by.replace(/^from /, '')}` : ''}.`;
        break;
      }
      case 'playerDowned': text = `${name(event.playerId || 'player')} was downed${event.reason ? ` (${word(event.reason)})` : ''}.`; break;
      case 'combatReactionChosen': if (!event.cardInstanceId) text = `${name(event.ownerId)} skipped the reaction.`; break;
      case 'combatReactionUnavailable': {
        const why = reactionUnavailableText(event, { registries, source: name(event.sourceId), owner: name(event.ownerId) });
        text = players.length > 1 ? `${name(event.ownerId)}: ${why}` : why;
        break;
      }
      // `poise` is the nominal break bonus before Poise Guard absorbs any of it: pressure, not damage taken.
      case 'combatGuardBroken': {
        const who = event.sourceId || event.sourcePlayerId ? `${attackText()} broke ` : 'Broke ';
        text = `${who}${event.targetId || event.targetPlayerId ? `${target}'s` : 'the'} Guard!${event.poise > 0 ? ` (+${event.poise} Poise pressure)` : ''}`;
        break;
      }
      case 'impactDealt':
        if (event.poiseDamage || event.wardDamage) text = `${attackText()} dealt ${event.poiseDamage || 0} Poise and ${event.wardDamage || 0} Ward pressure to ${target}.`;
        break;
      default: break;
    }
    for (const line of [].concat(text || [])) rows.push({ id, round, text: line });
  });
  return rows;
}
