// workbench/modules/configuration/model.mjs — the Configuration studio's DOM-free model.
//
// Profile files: which games/ashenspire JSON files the picker offers.
// (Module listing, schema fields and draft editing are added below.)

export const GAME_DIR = 'games/ashenspire';

/**
 * The profile files among repo paths: game.json, every presets/*.json and every bundles/<name>/bundle.json
 * (game.lock.json and everything else is left out). `resolves` is true for the author profiles the game-profile
 * resolver validates (game.json and presets); a bundle gets JSON validation only.
 */
export function profileFiles(paths = []) {
  const out = [];
  for (const path of paths) {
    const p = String(path);
    let m;
    if (p === `${GAME_DIR}/game.json`) out.push({ path: p, group: 'Game', label: 'Product core', resolves: true, rank: 0, name: 'game' });
    else if ((m = /^games\/ashenspire\/presets\/([\w.-]+)\.json$/.exec(p))) out.push({ path: p, group: 'Presets', label: `Preset ${m[1]}`, resolves: true, rank: 1, name: m[1] });
    else if ((m = /^games\/ashenspire\/bundles\/([\w.-]+)\/bundle\.json$/.exec(p))) out.push({ path: p, group: 'Bundles', label: `Bundle ${m[1]}`, resolves: false, rank: 2, name: m[1] });
  }
  return out.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).map(({ rank, name, ...rest }) => rest);
}
