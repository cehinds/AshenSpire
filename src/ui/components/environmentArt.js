import { assetUrl } from '../assetmap.js';
import { combatEnvironment } from '../../model/environmentArt.js';
import { ENVIRONMENT_ATLAS_SIZE, MAP_TERRAIN_REVEAL_RADIUS } from '../../content/environments.js';

export function combatBackdropHtml(run) {
  const { region, scene } = combatEnvironment(run);
  const [width, height] = ENVIRONMENT_ATLAS_SIZE;
  return `<div class="backdrop environment-backdrop" data-region="${region.id}" data-scene="${scene.id}" aria-hidden="true">
    <svg viewBox="${scene.box.join(' ')}" preserveAspectRatio="xMidYMid slice" focusable="false">
      <image href="${assetUrl(region.atlas)}" width="${width}" height="${height}"/>
    </svg>
  </div>`;
}

let nextMapId = 0;

// The map's existing knowledge set owns the reveal. This adds no travel rules
// and no persistence beyond the run.path already saved by the engine.
export function mapTerrainHtml({ world, width, height, points, fog }) {
  const id = `terrain-${++nextMapId}`;
  const circles = points.map(({ id: node, x, y }) =>
    `<circle data-terrain-node="${node}" cx="${x}" cy="${y}" r="${MAP_TERRAIN_REVEAL_RADIUS}" fill="url(#${id}-light)"/>`).join('');
  return `<g class="map-terrain" data-world="${world.id}" aria-hidden="true" pointer-events="none">
    <defs>
      <filter id="${id}-paper" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="3" seed="7"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer><feFuncA type="linear" slope="0.14"/></feComponentTransfer>
        <feBlend in="SourceGraphic" mode="multiply"/>
      </filter>
      <radialGradient id="${id}-light"><stop offset="0.56" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
      <mask id="${id}-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" style="mask-type:alpha">${circles}</mask>
    </defs>
    <g class="map-fog-ground"><rect class="terrain-paper" width="${width}" height="${height}" filter="url(#${id}-paper)"/></g>
    <image class="terrain-detail" href="${assetUrl(world.map)}" width="${width}" height="${height}" preserveAspectRatio="none"${fog ? ` mask="url(#${id}-reveal)"` : ''}/>
  </g>`;
}
