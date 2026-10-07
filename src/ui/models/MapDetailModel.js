import { MAP_PRESENTATION as policy } from '../../content/mapPresentation.js';

export function detailLevel(levels, renderedWidth, renderedHeight, dpr = 1, previous = null) {
  const need = Math.max(renderedWidth, renderedHeight) * Math.min(policy.pixelRatioCap, Math.max(1, dpr));
  const below = previous && levels[levels.indexOf(previous) - 1];
  if (previous && need <= previous.edge * (1 + policy.levelHysteresis)
    && (!below || need > below.edge * (1 - policy.levelHysteresis))) return previous;
  return levels.find(l => l.edge >= need) || levels.at(-1);
}

// Bounds normalized to the painting. Nothing outside the viewport is requested.
export function visibleTiles(level, bounds) {
  const t = policy.tileSize, out = [];
  const x0 = Math.max(0, Math.floor(bounds.x0 * level.width / t));
  const y0 = Math.max(0, Math.floor(bounds.y0 * level.height / t));
  const x1 = Math.min(Math.ceil(level.width / t), Math.ceil(bounds.x1 * level.width / t));
  const y1 = Math.min(Math.ceil(level.height / t), Math.ceil(bounds.y1 * level.height / t));
  for (let y=y0; y<y1; y++) for (let x=x0; x<x1; x++) out.push({
    key:`${level.edge}/${x}-${y}`, x:x*t/level.width, y:y*t/level.height,
    width:Math.min(t,level.width-x*t)/level.width, height:Math.min(t,level.height-y*t)/level.height,
  });
  return out;
}
