import { resolveLocationPresentation, presentationScene } from './locationPresentation.js';
import { ENVIRONMENTS, MEGA_MAPS } from '../content/environments.js';

// Decorative choices never consume the engine's RNG.
function hash(text) {
  let value = 2166136261;
  for (const char of String(text ?? '')) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return value;
}

export function regionForRun({ seedString = '', actNumber = 1 } = {}) {
  const act = Math.max(1, Math.trunc(Number(actNumber) || 1));
  return ENVIRONMENTS[(hash(seedString) % ENVIRONMENTS.length + (act - 1) % ENVIRONMENTS.length) % ENVIRONMENTS.length];
}

export function combatEnvironment(run = {}) {
  const region = (run.environmentRegionId && ENVIRONMENTS.find(r => r.id === run.environmentRegionId)) || regionForRun(run);
  const nodeId = run.journey?.currentNodeId || run.mapNodeId;
  const node = run.mapGraph?.nodes?.[nodeId];
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
