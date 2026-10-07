import { concealIntent } from '../src/model/combatIntentVisibility.js';

// A connection owns its main seat and its couch seats. Reads from another
// device never authorize this connection to receive a selected move.
export function lanMemberIds(client) {
  if (client.ownedIds) return client.ownedIds;
  return [client.id, ...((client.locals || []).map((_, i) => `${client.id}L${i + 1}`))];
}

export function projectLanSnapshot(snapshot, memberIds) {
  const view = structuredClone(snapshot);
  if (view.scene?.kind !== 'combat') return view;
  const owned = new Set(memberIds.filter(id => typeof id === 'string'));
  for (const enemy of view.scene.enemies || []) {
    const intent = enemy.intent || { kind: 'unknown', moveId: null };
    const profile = intent.profile || intent.combatProfile || {};
    const reads = enemy.intentReads;
    const canRead = id => owned.has(id) && (reads ? reads[id] === true : !profile.camp);
    const publicIntent = intent.kind === 'staggered';
    const revealed = publicIntent || (!intent.hidden && [...owned].some(canRead));
    if (!revealed) enemy.intent = concealIntent(intent, profile);
    // The UI still gates each couch character separately. Neither this map
    // nor the seat-priced previews may contain another device's successful read.
    if (reads) enemy.intentReads = Object.fromEntries([...owned].map(id => [id, reads[id] === true]));
    if (enemy.intentPreviews) {
      enemy.intentPreviews = Object.fromEntries([...owned]
        .filter(id => Object.hasOwn(enemy.intentPreviews, id))
        .map(id => {
          const preview = enemy.intentPreviews[id];
          const shown = publicIntent || (!intent.hidden && canRead(id) && !preview?.hidden);
          return [id, shown ? preview : concealIntent(intent, profile)];
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
