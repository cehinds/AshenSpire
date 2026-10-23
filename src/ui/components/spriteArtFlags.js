// Flags on a `.sprite` host saying what kind of art it holds, so CSS reads an
// attribute instead of `.sprite:has(.painted-stage)` /
// `.sprite:has(.alternative-figure, .alternative-card-stage)`. Call once the
// art is appended; a sprite's art is fixed for the host's life.
export function markSpriteArt(host) {
  if (!host) return host;
  if (host.querySelector('.painted-stage')) host.dataset.paintedStage = 'true'; else delete host.dataset.paintedStage;
  if (host.querySelector('.alternative-figure, .alternative-card-stage')) host.dataset.alternativeArt = 'true'; else delete host.dataset.alternativeArt;
  return host;
}
