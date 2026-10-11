// workbench/modules/review/model.mjs — the pure logic of Visual Review: the
// screens and device presets it captures, the pixel diff, filters, the deep link
// and the baseline-accept plan. DOM-free and file-free, so the tests run in Node.
// The screen list mirrors the SHOTS table in tools/screenshot.mjs; a test fails
// when the two drift apart.

/** Device presets. Desk is the Workbench's own 1280x800 review shape. */
export const DEVICES = [
  { id: 'desk', label: 'Desk', width: 1280, height: 800 },
  { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
  { id: 'phone', label: 'Phone', width: 390, height: 844 },
];

/**
 * The game's ?shot= scenes. `layout: true` marks a screen that draws UI config
 * (HUD, battlefield, room bands) and so links to Layout Studio.
 */
export const SCREENS = [
  { id: 'startup', label: 'Startup', query: '?shot=startup' },
  { id: 'title', label: 'Title', query: '?shot=title', layout: true },
  { id: 'map', label: 'Map', query: '?shot=map', layout: true },
  { id: 'combat', label: 'Combat', query: '?shot=combat', layout: true },
  { id: 'fx', label: 'Combat FX', query: '?shot=fx', layout: true },
  { id: 'boss-intro', label: 'Boss intro', query: '?shot=boss', layout: true },
  { id: 'death', label: 'Death', query: '?shot=death', layout: true },
  { id: 'coop-combat', label: 'Co-op combat', query: '?shot=coop' },
  { id: 'coop-map', label: 'Co-op map', query: '?shot=coopmap' },
  { id: 'coop-reward', label: 'Co-op reward', query: '?shot=coopreward' },
  { id: 'victory-receipt', label: 'Victory receipt', query: 'build/AshenSpire.html?shot=reward&shotReward=receipt' },
  { id: 'coop-shrine', label: 'Co-op shrine', query: '?shot=coopshrine' },
  { id: 'coop-catchup', label: 'Co-op catch-up', query: '?shot=coopcatchup' },
  { id: 'event', label: 'Event', query: '?shot=event', layout: true },
  { id: 'rest', label: 'Rest', query: '?shot=rest', layout: true },
  { id: 'shop', label: 'Shop', query: '?shot=shop', layout: true },
  { id: 'customize', label: 'Customize', query: '?shot=customize', layout: true },
  { id: 'prologue', label: 'Prologue', query: '?shot=prologue' },
  { id: 'class-reaver', label: 'Reaver', query: '?shot=customize&shotClass=reaver' },
  { id: 'class-starseer', label: 'Starseer', query: '?shot=customize&shotClass=starseer' },
  { id: 'class-rogue', label: 'Rogue', query: '?shot=customize&shotClass=rogue' },
  { id: 'class-herald', label: 'Herald', query: '?shot=customize&shotClass=herald' },
  { id: 'class-rogue-ember', label: 'Rogue (ember)', query: '?shot=customize&shotClass=rogue&shotTint=ember' },
];

export const screenById = (id) => SCREENS.find((s) => s.id === id) || null;
export const deviceById = (id) => DEVICES.find((d) => d.id === id) || null;

/** The capture file name for one screen on one device: desk-title.png. */
export const captureFile = (device, screen) => `${device}-${screen}.png`;

/** One row per screen x device, screen-major, the order the grid shows. */
export function rowsFor(screens = SCREENS, devices = DEVICES) {
  return screens.flatMap((s) => devices.map((d) => ({ key: `${d.id}/${s.id}`, screen: s.id, device: d.id, file: captureFile(d.id, s.id) })));
}
