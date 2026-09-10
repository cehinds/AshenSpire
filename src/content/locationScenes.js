import { resolveLocationPresentation, presentationScene } from '../model/locationPresentation.js';

export function locationScene(nodeId, run = {}) {
  const selection = resolveLocationPresentation({ nodeId, seedString:run.seedString, timeId:run.presentationTimeId || 'day', weatherId:run.presentationWeatherId || 'any', savedSceneId:run.locationPresentation?.nodeId===nodeId ? run.locationPresentation?.sceneId : undefined });
  const result = presentationScene(selection);
  return result ? { ...result.scene, atlas:result.region.atlas } : null;
}
