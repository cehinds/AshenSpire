import {assetUrl} from '../assetmap.js';
import {esc} from './tooltip.js';

// Paint the distant sky first, then structures, then the floor/near scenery.
// A legacy single painting remains intact; authored alpha layers follow the
// same order regardless of the caller's input order.
const sceneDepth = { skybox: 0, sky: 0, far: 0, painting: 0, background: 1, landmark: 1, structures: 1, floor: 2, ground: 2, foreground: 2 };
export const orderedSceneLayers = layers => [...layers].sort((a, b) =>
  (sceneDepth[a.kind || a.id] ?? 1) - (sceneDepth[b.kind || b.id] ?? 1));

// Reuse the scene's authored painting/layers. SVG slice preserves their aspect
// ratio; sceneBackdrop.js continues to own the floor alignment and viewport crop.
export function illustratedBackgroundHtml({region,scene,viewBox,layers}){
 return `<div class="backdrop environment-backdrop" data-illustrated-component="scene-background" data-region="${esc(region)}" data-scene="${esc(scene)}" aria-hidden="true">
  <svg viewBox="${viewBox.join(' ')}" preserveAspectRatio="xMidYMid slice" focusable="false">
   <svg x="${viewBox[0]}" y="${viewBox[1]}" width="${viewBox[2]}" height="${viewBox[3]}" viewBox="${viewBox.join(' ')}" overflow="hidden">
   ${orderedSceneLayers(layers).map(l=>`<image data-layer="${esc(l.id)}" href="${esc(assetUrl(l.href))}" width="${l.width}" height="${l.height}" preserveAspectRatio="xMidYMid meet"/>`).join('')}
   </svg>
  </svg>
 </div>`;
}
