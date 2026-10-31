// Owner-approved painted Reaver sequence. Sixty playback steps share sixteen
// byte-distinct images; the repeat table avoids inlining forty-four duplicate
// WebPs into the standalone build.
import { assetUrl } from './assetmap.js';
import { builtInFor, whenArtSourceChanges } from './highResArt.js';
import { DEFAULT_SPRITE_STYLE } from '../model/spriteStyle.js';
import { liteRendering } from './performance.js';
import { hintImage } from './imageHints.js';
import { uiConfig } from '../config/generated/ui.js';
import { thaw } from '../config/authored.js';
import { COMBAT_TIMING } from './animationPace.js';

const ATTACK = uiConfig.presentation.reaverAttack.components.attack;

const FRAME_ROOT = ATTACK.frameRoot;
const NORMAL_LUNGE_MS = uiConfig.presentation.reaverAttack.motion.normalLungeMs;

export const REAVER_ATTACK_RUNS = Object.freeze(thaw(ATTACK.runs).map(Object.freeze));

export const REAVER_ATTACK_SEQUENCE = Object.freeze(
  REAVER_ATTACK_RUNS.flatMap(([frameId, count]) => Array(count).fill(frameId))
);

export const REAVER_ATTACK = Object.freeze({
  id: ATTACK.id,
  facing: ATTACK.facing,
  frameMs: ATTACK.frameMs,
  frameCount: REAVER_ATTACK_SEQUENCE.length,
  durationMs: REAVER_ATTACK_SEQUENCE.length * ATTACK.frameMs,
  // P32 is the first Attack End image, immediately after Strike to Impact.
  impactFrameIndex: ATTACK.impactFrameIndex,
  impactMs: ATTACK.impactFrameIndex * ATTACK.frameMs,
  anchor: Object.freeze(thaw(ATTACK.anchor)),
});

const uniqueFrameIds = Object.freeze([...new Set(REAVER_ATTACK_SEQUENCE)]);
const frameUrl = (frameId) => assetUrl(`${FRAME_ROOT}/${frameId}${ATTACK.frameExtension}`);
let preloadState = 'idle';
let preloadRound = 0; // a reset starts a new round; an older round's loads no longer count
// The art source changed (Art quality): the frames warmed so far are the old tier's.
whenArtSourceChanges(() => { preloadRound += 1; preloadState = 'idle'; });

export function reaverAttackFrameUrls() {
  return uniqueFrameIds.map(frameUrl);
}

export function preloadReaverAttackFrames() {
  if (preloadState !== 'idle' || typeof Image === 'undefined') return;
  preloadState = 'loading';
  const round = preloadRound;
  let remaining = uniqueFrameIds.length;
  const settled = (ok) => {
    if (round !== preloadRound) return;
    if (!ok) preloadState = 'failed';
    remaining -= 1;
    if (remaining === 0 && preloadState !== 'failed') preloadState = 'ready';
  };
  for (const src of reaverAttackFrameUrls()) {
    const image = new Image();
    image.addEventListener('load', () => settled(true), { once: true });
    image.addEventListener('error', function retry() {
      // A missing high-res frame retries once with the built-in art.
      const fallback = builtInFor(src);
      if (fallback && image.getAttribute('src') !== fallback) { image.src = fallback; return; }
      image.removeEventListener('error', retry);
      settled(false);
    });
    image.src = src;
  }
}

export function isReaverAttackEligible({ classId, figure, customization, spritesEnabled }) {
  const style = (customization && customization.spriteStyle) || DEFAULT_SPRITE_STYLE;
  return !liteRendering() && spritesEnabled === true
    && classId === 'reaver'
    && style === 'rendered'
    && figure?.armourId === 'default'
    && figure?.rightId === 'greatsword'
    && figure?.leftId == null
    && figure?.rightMirror === false;
}

export function reaverAttackTiming(speed) {
  let scale = Math.max(uiConfig.presentation.reaverAttack.motion.minimumSpeedScale, Number(speed?.lungeMs || NORMAL_LUNGE_MS) / NORMAL_LUNGE_MS);
  // The pace's impact cap (ui/fx.js ANIM_SPEEDS impactCapMs) applies here as it
  // does to every authored clip (model/equipmentAnimation.js animationTiming):
  // a swing whose impact frame lands later plays faster as a whole.
  const cap = Number(speed?.impactCapMs);
  const impactAt = REAVER_ATTACK.frameMs * scale * REAVER_ATTACK.impactFrameIndex;
  const capped = cap > 0 && impactAt > cap;
  if (capped) scale *= cap / impactAt;
  // Floored when capped, so many short frames cannot round past the cap.
  const frameMs = Math.max(1, (capped ? Math.floor : Math.round)(REAVER_ATTACK.frameMs * scale));
  const hold = Math.round((Number(speed?.minFrameMs) || 0) * COMBAT_TIMING.reaverRunHoldShare);
  if (hold > frameMs) {
    // The sequence is 60 steps of 18 distinct images. Playing each step at the hold would take seconds, so
    // each image (run) is held at least `hold`: runMs[i] is how long the i-th run shows.
    const runMs = REAVER_ATTACK_RUNS.map(([, count]) => Math.max(hold, count * frameMs));
    let before = 0, at = 0, impactMs = 0;
    REAVER_ATTACK_RUNS.forEach(([, count], i) => { if (at <= REAVER_ATTACK.impactFrameIndex) impactMs = before; at += count; before += runMs[i]; });
    return Object.freeze({ frameMs, runMs: Object.freeze(runMs), impactMs, totalMs: before });
  }
  return Object.freeze({
    frameMs,
    impactMs: REAVER_ATTACK.impactFrameIndex * frameMs,
    totalMs: REAVER_ATTACK.frameCount * frameMs,
  });
}

/** Replace only the figure inside the stable combatant sprite host. */
export function playReaverAttack(actorEl, timing = reaverAttackTiming()) {
  if (!actorEl || typeof document === 'undefined') return null;
  preloadReaverAttackFrames();
  const priorFigure = actorEl.querySelector(':scope > .class-sprite');
  if (!priorFigure) return null;

  const image = hintImage(document.createElement('img'), { swapped: true });
  image.className = 'reaver-attack-sequence';
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  image.src = frameUrl(REAVER_ATTACK_SEQUENCE[0]);
  image.dataset.frameId = 'P01';
  const priorDisplay = priorFigure.style.display;
  priorFigure.hidden = true;
  // classSprite has an inline display:flex declaration, which outranks the
  // browser's default [hidden] rule. Set the same author-origin property here
  // so the idle painting cannot remain behind the action painting.
  priorFigure.style.display = 'none';
  actorEl.classList.add('reaver-attack-playing');
  actorEl.appendChild(image);

  // With a per-image hold (timing.runMs) playback steps image by image, not step by step.
  const runStarts = [];
  { let at = 0; for (const [, count] of REAVER_ATTACK_RUNS) { runStarts.push(at); at += count; } }
  let runIndex = 0;
  let frameIndex = 0;
  let timer = null;
  let due = 0;
  let cancelled = false;
  const schedule = (ms) => {
    due = Date.now() + ms;
    timer = setTimeout(advance, ms);
  };
  const advance = () => {
    if (cancelled) return;
    if (timing.runMs) { runIndex += 1; frameIndex = runIndex < runStarts.length ? runStarts[runIndex] : REAVER_ATTACK_SEQUENCE.length; }
    else frameIndex += 1;
    if (frameIndex >= REAVER_ATTACK_SEQUENCE.length) return;
    image.src = frameUrl(REAVER_ATTACK_SEQUENCE[frameIndex]);
    image.dataset.frameId = `P${String(frameIndex + 1).padStart(2, '0')}`;
    schedule(timing.runMs ? timing.runMs[runIndex] : timing.frameMs);
  };
  schedule(timing.runMs ? timing.runMs[0] : timing.frameMs);

  return {
    impactMs: timing.impactMs,
    totalMs: timing.totalMs,
    // Frames advance one timer callback at a time, so a late callback does not
    // consume the authored frames that have not played yet.
    remainingMs() {
      if (cancelled || frameIndex >= REAVER_ATTACK_SEQUENCE.length) return 0;
      if (timing.runMs) return Math.max(0, due - Date.now()) + timing.runMs.slice(runIndex + 1).reduce((a, b) => a + b, 0);
      return Math.max(0, due - Date.now())
        + (REAVER_ATTACK_SEQUENCE.length - frameIndex - 1) * timing.frameMs;
    },
    // Hit-stop (SPEC §7.4): stay on the current frame for `ms` more.
    hold(ms) {
      if (cancelled || !(ms > 0) || (timing.runMs ? runIndex >= runStarts.length - 1 : frameIndex >= REAVER_ATTACK_SEQUENCE.length - 1)) return;
      clearTimeout(timer);
      schedule(Math.max(0, due - Date.now()) + ms);
    },
    cancel() {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(timer);
      image.remove();
      priorFigure.hidden = false;
      priorFigure.style.display = priorDisplay;
      actorEl.classList.remove('reaver-attack-playing');
    },
  };
}
