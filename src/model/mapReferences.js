// Read-only validation at both save-loading boundaries. Old singular maps
// without encounter IDs keep their explicit legacy boss mapping (by TIER: such
// a graph only exists in a pre-§13 save, which the load door gives the default
// seat order, so tier n is the seat act n always was).
import { LEGACY_ACT_BOSSES } from '../content/mapconfig.js';
import { encounterFitsSeat, finalTier } from './seats.js';

export function assertSavedBossReferences(registries, graph, { seat, tier } = {}) {
  if (!graph) return;
  if (typeof seat !== 'string' || !seat || !Number.isInteger(tier)) throw new Error('assertSavedBossReferences: pass { seat, tier } (SPEC §13.2)');
  const fit = { seat, tier, finalTier: finalTier(registries) };
  const ids = new Set([
    ...(Array.isArray(graph.bossIds) ? graph.bossIds : []),
    ...Object.entries(graph.nodes || {}).filter(([, node]) => node?.type === 'boss').map(([id]) => id),
  ]);
  for (const id of ids) {
    const node = graph.nodes?.[id];
    if (!node || node.type !== 'boss') throw new Error(`Saved boss destination '${id}' is not a boss node`);
    const encounterId = !graph.bossIds && graph.bossId === id && !Object.hasOwn(node, 'encounterId')
      ? LEGACY_ACT_BOSSES[tier] : node.encounterId;
    const encounter = typeof encounterId === 'string' && registries.encounters.has(encounterId)
      ? registries.encounters.get(encounterId) : null;
    if (!encounter || encounter.pool !== 'boss' || !encounterFitsSeat(encounter, fit)) {
      throw new Error(`Saved boss destination '${id}' references invalid encounter '${encounterId}' for seat '${seat}' at tier ${tier}`);
    }
  }
}
