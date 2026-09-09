import { mapFogDefs } from './mapFog.js';
import { assetUrl } from '../assetmap.js';
import { combatEnvironment } from '../../model/environmentArt.js';
import { ENVIRONMENTS, ENVIRONMENT_ATLAS_SIZE, MAP_TERRAIN_REVEAL_RADIUS } from '../../content/environments.js';

export function combatBackdropHtml(run, previewSceneId = null) {
  let { region, scene } = combatEnvironment(run);
  if (previewSceneId) {
    region = ENVIRONMENTS.find(r => r.scenes.some(s => s.id === previewSceneId));
    if (!region) throw Error(`Unknown combat preview scene: ${previewSceneId}`);
    scene = region.scenes.find(s => s.id === previewSceneId);
  }
  const [width, height] = ENVIRONMENT_ATLAS_SIZE;
  const [x, y, w, h] = scene.box;
  const split = h * scene.floorStart;
  const horizon = 100 * (1 - scene.fieldRatio);
  const ground = h * scene.groundAnchor;
  const plate = `<image href="${assetUrl(region.atlas)}" width="${width}" height="${height}"/>`;
  // Frame architecture and terrain independently: the full scene width stays
  // visible and the authored ground always occupies 60% of the battle view.
  // Both viewports meet at the same source row, without repeating the texture.
  return `<div class="backdrop environment-backdrop" data-region="${region.id}" data-scene="${scene.id}" data-field-ratio="${scene.fieldRatio}" aria-hidden="true">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
      <svg width="100" height="${horizon}" viewBox="${x} ${y} ${w} ${split}" preserveAspectRatio="none" overflow="hidden">${plate}</svg>
      <svg class="environment-floor" y="${horizon}" width="100" height="${100 - horizon}" viewBox="0 0 100 100" preserveAspectRatio="none" overflow="hidden">
        <svg class="environment-ground-distance" width="100" height="60" viewBox="${x} ${y + split} ${w} ${ground - split}" preserveAspectRatio="none" overflow="hidden">${plate}</svg>
        <svg class="environment-ground-front" y="60" width="100" height="40" viewBox="${x} ${y + ground} ${w} ${h - ground}" preserveAspectRatio="none" overflow="hidden">${plate}</svg>
      </svg>
    </svg>
  </div>`;
}

// Keep the same painted point beneath the shared foot line. Reframe the two
// continuous portions of ground instead of letting HUD changes move the feet
// across an unrelated background crop. The skyline and 60% field stay intact.
export function alignCombatGround(backdrop, groundRatio) {
  if (!backdrop) return;
  const fieldRatio = Number(backdrop.dataset.fieldRatio);
  const distance = backdrop.querySelector('.environment-ground-distance');
  const front = backdrop.querySelector('.environment-ground-front');
  if (!distance || !front || !(fieldRatio > 0)) return;
  const percent = Math.max(1, Math.min(99, 100 * (groundRatio - (1 - fieldRatio)) / fieldRatio));
  distance.setAttribute('height', String(percent));
  front.setAttribute('y', String(percent));
  front.setAttribute('height', String(100 - percent));
  backdrop.dataset.groundRatio = String(groundRatio);
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
