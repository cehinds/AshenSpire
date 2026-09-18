// Owner-approved painted Reaver sequence. Sixty playback steps share sixteen
// byte-distinct images; the repeat table avoids inlining forty-four duplicate
// WebPs into the standalone build.
import { assetUrl } from './assetmap.js';
import { DEFAULT_SPRITE_STYLE } from '../model/spriteStyle.js';
import { liteRendering } from './performance.js';
import { hintImage } from './imageHints.js';
import { uiConfig } from '../config/generated/ui.js';
import { thaw } from '../config/authored.js';

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

export function reaverAttackFrameUrls() {
  return uniqueFrameIds.map(frameUrl);
}

export function preloadReaverAttackFrames() {
  if (preloadState !== 'idle' || typeof Image === 'undefined') return;
  preloadState = 'loading';
  let remaining = uniqueFrameIds.length;
  const settled = (ok) => {
    if (!ok) preloadState = 'failed';
    remaining -= 1;
    if (remaining === 0 && preloadState !== 'failed') preloadState = 'ready';
  };
  for (const src of reaverAttackFrameUrls()) {
    const image = new Image();
    image.addEventListener('load', () => settled(true), { once: true });
    image.addEventListener('error', () => settled(false), { once: true });
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
  const scale = Math.max(0.1, Number(speed?.lungeMs || NORMAL_LUNGE_MS) / NORMAL_LUNGE_MS);
  const frameMs = Math.max(1, Math.round(REAVER_ATTACK.frameMs * scale));
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

  const image = hintImage(document.createElement('img'));
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

  let frameIndex = 0;
  let timer = null;
  let cancelled = false;
  const advance = () => {
    if (cancelled) return;
    frameIndex += 1;
    if (frameIndex >= REAVER_ATTACK_SEQUENCE.length) return;
    image.src = frameUrl(REAVER_ATTACK_SEQUENCE[frameIndex]);
    image.dataset.frameId = `P${String(frameIndex + 1).padStart(2, '0')}`;
    timer = setTimeout(advance, timing.frameMs);
  };
  timer = setTimeout(advance, timing.frameMs);

  return {
    impactMs: timing.impactMs,
    totalMs: timing.totalMs,
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
