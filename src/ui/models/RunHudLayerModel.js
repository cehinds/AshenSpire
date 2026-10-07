import { wireframeUi } from '../../content/wireframeUi.js';

// WGH0 / WGS2: which parts of the shared run HUD a place draws, decided before
// layout so a layer that is off leaves no row, track or gap. DOM-free.
//
// The places whose screen draws a footer HUD. Only there does WGC11, the one
// Potions control, exist, so only there does the top HUD leave potions to it
// unconditionally. Everywhere else `potions.roomRail` decides.
export const FOOTER_HUD_PLACES = Object.freeze(['combat']);

export function runHudLayers(place = '', config = wireframeUi.hud) {
  const on = (key) => config.layers[key] === true;
  const header = on('header');
  const cls = header && on('class');
  const cinders = header && on('cinders');
  const position = header && on('position');
  const armoury = on('armoury');
  const menu = on('menu');
  const vitality = on('vitality');
  const rail = on('rail');
  const relics = rail && on('relics');
  const potions = rail
    && !FOOTER_HUD_PLACES.includes(place)
    && config.potions.roomRail === true
    && (config.potions.chargeFlasks === true || config.potions.carried === true);
  return Object.freeze({
    header: cls || cinders || position, class: cls, cinders, position,
    primary: vitality || armoury || menu, vitality,
    controls: armoury || menu, armoury, menu,
    rail: relics || potions, relics, potions,
  });
}
