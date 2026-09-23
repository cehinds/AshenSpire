import { resolveLocationPresentation, presentationScene } from './locationPresentation.js';
import { ENVIRONMENTS, MEGA_MAPS } from '../content/environments.js';
import { SEATS, CAUSEWAY_REGION_ID } from '../content/seats.js';
import { seatAtTier, tierOf } from './seats.js';

// Decorative choices never consume the engine's RNG.
function hash(text) {
  let value = 2166136261;
  for (const char of String(text ?? '')) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return value;
}

// SPEC §13.2: a run that carries a seat order fights in its SEAT's region —
// no seed hash, no rotation. A run without one (a legacy fixture, a preview
// snapshot, World Journey before it sets environmentRegionId) keeps the old
// seeded rotation so nothing that never had seats changes its sky.
function seatRegion(run) {
  if (!Array.isArray(run.seatOrder) || !run.seatOrder.length) return null;
  const seat = SEATS.find((row) => row.id === seatAtTier(run.seatOrder, run.actNumber || 1));
  return seat ? ENVIRONMENTS.find((region) => region.id === seat.regionId) || null : null;
}

export function regionForRun(run = {}) {
  const { seedString = '', actNumber = 1 } = run;
  const seated = seatRegion(run);
  if (seated) return seated;
  const act = Math.max(1, Math.trunc(Number(actNumber) || 1));
  return ENVIRONMENTS[(hash(seedString) % ENVIRONMENTS.length + (act - 1) % ENVIRONMENTS.length) % ENVIRONMENTS.length];
}

// The final tier's boss node is the causeway (SPEC §13.2, §13.5): its scenery
// is the causeway region whichever seat holds the tier.
function causewayRegion(run, node) {
  if (!node || node.type !== 'boss' || !Array.isArray(run.seatOrder) || !run.seatOrder.length) return null;
  const cycle = run.seatOrder.length;
  if (tierOf(run.actNumber || 1, cycle) !== cycle) return null;
  return ENVIRONMENTS.find((region) => region.id === CAUSEWAY_REGION_ID) || null;
}

export function combatEnvironment(run = {}) {
  const nodeId = run.journey?.currentNodeId || run.mapNodeId;
  const node = run.mapGraph?.nodes?.[nodeId];
  const region = (run.environmentRegionId && ENVIRONMENTS.find(r => r.id === run.environmentRegionId))
    || (!run.journey && causewayRegion(run, node))
    || regionForRun(run);
  const setting = node?.type === 'boss' ? 'dungeon' : node?.type === 'merchant' ? 'city' : 'road';
  const selection = resolveLocationPresentation({ nodeId, seedString:run.seedString,
    profileId:node ? `${region.id}/${setting}` : undefined,
    timeId:run.presentationTimeId || 'day', weatherId:run.presentationWeatherId || 'any',
    savedSceneId:run.locationPresentation?.nodeId === nodeId ? run.locationPresentation?.sceneId : undefined });
  const selected = presentationScene(selection);
  if (selected) return selected;
  const floor = Math.max(0, Math.trunc(Number(run.floor) || 0));
  const index = (hash(`${run.seedString ?? ''}:scenery`) + floor) % region.scenes.length;
  return { region, scene: region.scenes[index] };
}

// One coherent world per seed, including across act changes and reloads.
export function worldMapForRun({ seedString = '' } = {}) {
  return MEGA_MAPS[hash(`${seedString}:world`) % MEGA_MAPS.length];
}
