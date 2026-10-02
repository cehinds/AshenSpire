// A narrative illustration aperture, separate from text and canonical actors.
// Square sources retain the fire/bowl landmarks on phones instead of becoming
// full-height background crops. This never enters combat or map geometry.
import { assetUrl } from '../assetmap.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';

const SCENES = Object.freeze({
  rest: 'chapel-rest-master',
  event: 'grave-dialogue-master',
  forge: 'forge-desktop',
});
export function scenePainting(id) {
  const name = SCENES[id];
  if (!name) throw new Error(`Unknown player scene painting '${id}'`);
  const frame = document.createElement('figure');
  frame.className = 'polish-scene-painting';
  frame.dataset.component = UI.playerScenePainting;
  frame.setAttribute('aria-hidden', 'true');
  const art = document.createElement('img');
  art.src = assetUrl(`assets/player-polish/scenes/${name}.webp`);
  art.alt = '';
  art.decoding = 'async';
  frame.appendChild(art);
  return frame;
}
