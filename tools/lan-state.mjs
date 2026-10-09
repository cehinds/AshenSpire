import { concealIntent } from '../src/model/combatIntentVisibility.js';
import { concealKnowledgeIntent } from '../src/model/enemyIntentKnowledge.js';

// A connection owns its main seat and its couch seats. Reads from another
// device never authorize this connection to receive a selected move.
export function lanMemberIds(client) {
  if (client.ownedIds) return client.ownedIds;
  return [client.id, ...((client.locals || []).map((_, i) => `${client.id}L${i + 1}`))];
}

export function projectLanSnapshot(snapshot, memberIds) {
  const view = structuredClone(snapshot);
  const owned = new Set(memberIds.filter(id => typeof id === 'string'));
  for (const seat of [...(view.party || []), ...(view.scene?.players || [])]) if (!owned.has(seat.id)) {
    for (const key of ['enemyKnowledge', 'enemyKnowledgeState', 'enemyKnowledgeRules']) delete seat[key];
    if (seat.skills) delete seat.skills.perception;
    delete seat.pendingReaction;
    function concealPerception(receipt) {
      if (receipt?.xpBefore?.tracks) delete receipt.xpBefore.tracks.perception;
      if (receipt?.xpGains?.tracks) delete receipt.xpGains.tracks.perception;
      if (Array.isArray(receipt?.xpGains)) receipt.xpGains = receipt.xpGains.filter(row => row.skillId !== 'perception');
      for (const previous of receipt?.history || []) concealPerception(previous);
    }
    concealPerception(seat.xpProgression);
    for (const card of seat.hand || []) for (const key of ['combatPreview', 'upcastPreviews', 'values', 'tokens', 'damageSequences']) delete card[key];
  }
  if (view.scene?.kind !== 'combat') return view;
  if (view.scene.enemyKnowledge) {
    const knowledge = view.scene.enemyKnowledge;
    delete knowledge.privateSeed; delete knowledge.readCounters;
    knowledge.owners = Object.fromEntries(Object.entries(knowledge.owners || {}).filter(([id]) => owned.has(id)));
    view.scene.events = (view.scene.events || []).filter(event => !event.ownerId || owned.has(event.ownerId)
      || !['intentPredictionAccepted', 'perceptionGained', 'enemyKnowledgeCounterBonus'].includes(event.type));
  }
  for (const enemy of view.scene.enemies || []) {
    const intent = enemy.intent || { kind: 'unknown', moveId: null };
    const profile = intent.profile || intent.combatProfile || {};
    const reads = enemy.intentReads;
    const knowledgeAction = enemy.knowledgeAction;
    const canRead = id => owned.has(id) && (knowledgeAction ? knowledgeAction.reads?.[id]?.visibility === 'exact' : reads ? reads[id] === true : !profile.camp);
    const publicIntent = enemy.actorIntentRevealed === true || intent.kind === 'staggered';
    const revealed = publicIntent || (!intent.hidden && [...owned].some(canRead));
    if (!revealed) enemy.intent = knowledgeAction ? concealKnowledgeIntent(null, knowledgeAction.serial) : concealIntent(intent, profile);
    if (knowledgeAction) {
      delete knowledgeAction.category;
      knowledgeAction.reads = Object.fromEntries(Object.entries(knowledgeAction.reads || {}).filter(([id]) => owned.has(id)));
      enemy.intentPredictions = Object.fromEntries(Object.entries(enemy.intentPredictions || {}).filter(([id]) => owned.has(id)));
      if (!revealed) for (const key of ['combatStance', 'combatCounter', 'pendingMove', 'intentRevealed', 'intentChosen']) delete enemy[key];
    }
    // The UI still gates each couch character separately. Neither this map
    // nor the seat-priced previews may contain another device's successful read.
    if (reads) enemy.intentReads = Object.fromEntries([...owned].map(id => [id, reads[id] === true]));
    if (enemy.intentPreviews) {
      enemy.intentPreviews = Object.fromEntries([...owned]
        .filter(id => Object.hasOwn(enemy.intentPreviews, id))
        .map(id => {
          const preview = enemy.intentPreviews[id];
          const shown = publicIntent || (!intent.hidden && canRead(id) && !preview?.hidden);
          return [id, shown ? preview : knowledgeAction ? concealKnowledgeIntent(knowledgeAction.reads[id], knowledgeAction.serial) : concealIntent(intent, profile)];
        }));
    }
  }
  return view;
}

// Every state delivery (start, action, resync, reconnect and disk resume) uses
// this boundary. The authoritative snapshot and persisted game stay untouched.
export function broadcastLanSnapshot(clients, snapshot, encode) {
  for (const [socket, client] of clients) {
    socket.write(encode(JSON.stringify({ t: 'state', snapshot: projectLanSnapshot(snapshot, lanMemberIds(client)) })));
  }
}
