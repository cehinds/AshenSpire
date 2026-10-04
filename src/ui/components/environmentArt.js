import { illustratedBackgroundHtml } from './illustratedBackground.js';
import { mapFogDefs } from './mapFog.js';
import { dungeonScene } from '../../model/legacyDungeon.js';
import { assetUrl } from '../assetmap.js';
import { combatEnvironment } from '../../model/environmentArt.js';
import { ENVIRONMENTS, ENVIRONMENT_ATLAS_SIZE, MAP_TERRAIN_REVEAL_RADIUS } from '../../content/environments.js';

export function combatBackdropHtml(run, previewSceneId = null) {
  const legacy = !previewSceneId && dungeonScene(run);
  if (legacy) return illustratedBackgroundHtml({region:legacy.region,scene:legacy.id,viewBox:[0,0,1536,1024],layers:[{id:'floor',href:legacy.floor,width:1536,height:1024},{id:'background',href:legacy.background,width:1536,height:1024}]});
  let { region, scene } = combatEnvironment(run);
  if (previewSceneId) {
    region = ENVIRONMENTS.find(r => r.scenes.some(s => s.id === previewSceneId));
    if (!region) throw Error(`Unknown combat preview scene: ${previewSceneId}`);
    scene = region.scenes.find(s => s.id === previewSceneId);
  }
  const [width, height] = ENVIRONMENT_ATLAS_SIZE;
  const [x, y, w, h] = scene.box;
  // Keep the painting intact. Slice crops the viewport without stretching
  // architecture or terrain independently as the battlefield changes shape.
  return illustratedBackgroundHtml({region:region.id,scene:scene.id,viewBox:[x,y,w,h],layers:[{id:'painting',href:region.atlas,width,height}]});
}
let nextMapId = 0;

// The map's existing knowledge set owns the reveal. This adds no travel rules
// and no persistence beyond the run.path already saved by the engine.
export function mapTerrainHtml({ world, width, height, points, fog }) {
  const id = `terrain-${++nextMapId}`;
  const circles = points.map(({ id: node, x, y }) =>
    `<circle data-terrain-node="${node}" cx="${x}" cy="${y}" r="${MAP_TERRAIN_REVEAL_RADIUS}" fill="url(#${id}-light)"/>`).join('');
  return `<g class="map-terrain" data-world="${world.id}" aria-hidden="true" pointer-events="none">
    <defs>${mapFogDefs(id)}
      <radialGradient id="${id}-light"><stop offset="0.56" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
      <mask id="${id}-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" style="mask-type:alpha">${circles}</mask>
    </defs>
    <g class="map-fog-ground"><rect class="terrain-paper" style="fill:url(#${id}-paper)" width="${width}" height="${height}"/></g>
    <g class="map-detail-surface"${fog ? ` mask="url(#${id}-reveal)"` : ''}><image class="terrain-detail" href="${assetUrl(world.map)}" width="${width}" height="${height}" preserveAspectRatio="none"/></g>
  </g>`;
}
