import { assetUrl } from '../assetmap.js';

// Supplemental role illustrations from the approved kit, deliberately bound
// to service screens. They do not assign a portrait to a named lore NPC.
const PORTRAITS = Object.freeze({ merchant: 'merchant', smith: 'smith' });
export function servicePortrait(role) {
  const name = PORTRAITS[role];
  if (!name) throw new Error(`Unknown service portrait: ${role}`);
  const figure = document.createElement('figure');
  figure.className = 'service-portrait';
  figure.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.src = assetUrl(`assets/player-polish/illustrations/${name}-portrait.webp`);
  img.alt = '';
  figure.append(img);
  return figure;
}
