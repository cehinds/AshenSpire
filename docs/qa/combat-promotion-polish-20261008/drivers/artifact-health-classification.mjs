// Explicit edition/shot limits; preserve every raw Log entry and classify only
// these reviewed exact messages/URLs. This is not audio acceptance evidence.
const fallbackPaths = new Set([
  '/build/download/assets/sfx/block.ogg',
  '/build/download/assets/sfx/cardDraw.ogg',
  '/build/download/assets/sfx/cardPlay.ogg',
  '/build/download/assets/sfx/deckShuffle.ogg',
  '/build/download/assets/sfx/holdTick_endTurn.ogg',
  '/build/download/assets/sfx/holdTick.ogg',
  '/build/download/assets/sfx/turnStinger.ogg',
  '/build/download/music/manifest.json',
]);
const policies = new Set([
  'The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://developer.chrome.com/blog/autoplay/#web_audio',
  "Blocked call to navigator.vibrate because user hasn't tapped on the frame or any embedded frame yet: https://www.chromestatus.com/feature/5644273861001216.",
]);
export function artifactLogClassification(entry) {
  if (policies.has(entry.text)) return 'shot-before-title-activation';
  if (entry.text === 'Failed to load resource: the server responded with a status of 404 (Not Found)') {
    try { if (fallbackPaths.has(new URL(entry.url).pathname)) return 'standalone-authored-audio-fallback'; } catch {}
  }
  return ['warning', 'error'].includes(entry.level) ? 'unexpected-fatal' : 'informational';
}
