import {assetUrl} from '../assetmap.js';
import {esc} from './tooltip.js';

// Reuse the scene's authored painting/layers. SVG slice preserves their aspect
// ratio; sceneBackdrop.js continues to own the floor alignment and viewport crop.
export function illustratedBackgroundHtml({region,scene,viewBox,layers}){
 return `<div class="backdrop environment-backdrop" data-illustrated-component="scene-background" data-region="${esc(region)}" data-scene="${esc(scene)}" aria-hidden="true">
  <svg viewBox="${viewBox.join(' ')}" preserveAspectRatio="xMidYMid slice" focusable="false">
   <svg x="${viewBox[0]}" y="${viewBox[1]}" width="${viewBox[2]}" height="${viewBox[3]}" viewBox="${viewBox.join(' ')}" overflow="hidden">
   ${layers.map(l=>`<image data-layer="${esc(l.id)}" href="${esc(assetUrl(l.href))}" width="${l.width}" height="${l.height}" preserveAspectRatio="xMidYMid meet"/>`).join('')}
   </svg>
  </svg>
 </div>`;
}
