import { layeredCombatScene } from '../../model/layeredEnvironments.js';
import { layeredEnvironmentHtml } from './layeredEnvironment.js';
import { illustratedBackgroundHtml } from './illustratedBackground.js';
import { alternativeBackdropHtml, alternativeCardFadeHtml } from '../alternativeArt.js';
import { mapFogDefs } from './mapFog.js';
import { dungeonScene } from '../../model/legacyDungeon.js';
import { assetUrl } from '../assetmap.js';
import { combatEnvironment } from '../../model/environmentArt.js';
import { ENVIRONMENTS, ENVIRONMENT_ATLAS_SIZE, MAP_TERRAIN_REVEAL_RADIUS } from '../../content/environments.js';

// The `.combat` root's `data-has-backdrop`: which backdrops are its direct
// children ('environment', 'alternative', both, or none). CSS reads
// `[data-has-backdrop~='environment']` instead of `.combat:has(> .environment-backdrop)`.
// Call after the backdrop markup is inserted or swapped, before the next paint.
export function syncBackdropFlag(combat) {
  if (!combat) return;
  const kinds = [];
  if (combat.querySelector(':scope > .environment-backdrop')) kinds.push('environment');
  if (combat.querySelector(':scope > .alternative-backdrop')) kinds.push('alternative');
  const value = kinds.join(' ');
  if (value) { if (combat.getAttribute('data-has-backdrop') !== value) combat.setAttribute('data-has-backdrop', value); }
  else if (combat.hasAttribute('data-has-backdrop')) combat.removeAttribute('data-has-backdrop');
}

export function combatBackdropHtml(run, previewSceneId = null) {
  if (previewSceneId) {
    const layered = alternativeBackdropHtml(previewSceneId);
    if (layered) return layered;
  }
  const legacy = !previewSceneId && dungeonScene(run);
  if (legacy) return alternativeBackdropHtml(legacy.id) || illustratedBackgroundHtml({region:legacy.region,scene:legacy.id,viewBox:[0,0,1536,1024],layers:[{id:'floor',href:legacy.floor,width:1536,height:1024},{id:'background',href:legacy.background,width:1536,height:1024}]}) + alternativeCardFadeHtml();
  const environment = combatEnvironment(run);
  const liveLayered = !previewSceneId && layeredCombatScene(run, environment);
  if (liveLayered) return layeredEnvironmentHtml(liveLayered);
  let { region, scene } = environment;
  if (previewSceneId) {
    region = ENVIRONMENTS.find(r => r.scenes.some(s => s.id === previewSceneId));
    if (!region) throw Error(`Unknown combat preview scene: ${previewSceneId}`);
    scene = region.scenes.find(s => s.id === previewSceneId);
  }
  const [width, height] = ENVIRONMENT_ATLAS_SIZE;
  const layered = alternativeBackdropHtml(scene.id);
  if (layered) return layered;
  const [x, y, w, h] = scene.box;
  // Keep the painting intact. Slice crops the viewport without stretching
  // architecture or terrain independently as the battlefield changes shape.
  return illustratedBackgroundHtml({region:region.id,scene:scene.id,viewBox:[x,y,w,h],layers:[{id:'painting',href:region.atlas,width,height}]}) + alternativeCardFadeHtml();
}
let nextMapId = 0;

// The map's existing knowledge set owns the reveal. This adds no travel rules
// and no persistence beyond the run.path already saved by the engine.
export function mapTerrainHtml({ world, width, height, points, fog }) {
  const id = `terrain-${++nextMapId}`;
  // The reveal mask pads the canvas by one light radius: a light at the canvas edge (the start node sits
  // 60 in, its light is 74) must not be cut into a hard straight edge. Kept to the lights' reach so mobile
  // rasterizes no more mask than it needs.
  const circles = points.map(({ id: node, x, y }) =>
    `<circle data-terrain-node="${node}" cx="${x}" cy="${y}" r="${MAP_TERRAIN_REVEAL_RADIUS}" fill="url(#${id}-light)"/>`).join('');
  return `<g class="map-terrain" data-world="${world.id}" aria-hidden="true" pointer-events="none">
    <defs>${mapFogDefs(id)}
      <radialGradient id="${id}-light"><stop offset="0.56" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
      <mask id="${id}-reveal" maskUnits="userSpaceOnUse" x="${-MAP_TERRAIN_REVEAL_RADIUS}" y="${-MAP_TERRAIN_REVEAL_RADIUS}" width="${width + 2 * MAP_TERRAIN_REVEAL_RADIUS}" height="${height + 2 * MAP_TERRAIN_REVEAL_RADIUS}" style="mask-type:alpha">${circles}</mask>
    </defs>
    <g class="map-fog-ground"><rect class="terrain-paper" style="fill:url(#${id}-paper)" width="${width}" height="${height}"/></g>
    <g class="map-detail-surface"${fog ? ` mask="url(#${id}-reveal)"` : ''}><g class="map-painting"><image class="terrain-detail" href="${assetUrl(world.map)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/></g></g>
  </g>`;
}
