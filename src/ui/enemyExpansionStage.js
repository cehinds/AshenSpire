import { COMBAT_BODY_LANDMARKS } from '../content/combatBodyLandmarks.js';
import { enemyExpansion } from '../content/enemyExpansion.js';
import { enemyStanceSprites } from '../content/enemyStanceSprites.js';
import { assetUrl } from './assetmap.js';
import { enemyPresentation, enemyAuraFilter } from './enemyStates.js';
import { reducedMotionRequested } from './motion.js';
import { COMBAT_TIMING, frameHoldMs } from './animationPace.js';
import { registerStage } from './services/PoseAnimator.js';
import { markArtPlaceholder, ART_PLACEHOLDER_ATTR } from './artFallback.js';
import { builtInFor } from './highResArt.js';
import { warmImageBoundsWhenIdle } from './artBounds.js';
import { bodyScaleFactor } from './models/CombatBodyModel.js';

const aliases = { guard: 'block', guardHit: 'block', projectile: 'rangedWeaponAttack', ranged: 'rangedWeaponAttack', buff: 'magicAttack', casting: 'magicAttack', magic: 'magicAttack', hurt: 'hit', afflicted: 'wounded', counter: 'counterattack', prone: 'defeated', sleep: 'defeated' };

// Frames share one canvas and floor. The held body category is public even when
// the move is concealed; action clips still run only during committed playback.
export function enemyExpansionSprite(definition, entity = {}) {
  const art = enemyExpansion[definition.id];
  if (!art) return null;
  const root = document.createElement('div');
  root.className = 'enemy-pose-stage enemy-expansion-stage';
  root.dataset.enemyId = definition.id;
  root.dataset.facing = 'screen-left';
  const scale = 190 / art.idleHeight;
  const idleBody = COMBAT_BODY_LANDMARKS[`assets/enemy-poses/expansion/${definition.id}/idle.webp`];
  const referenceBodyHeight = idleBody ? idleBody.feetY - idleBody.headY : null;
  let currentBody = null;
  // The idle body's share of the stage box: the battlefield sizes this figure by
  // its head-to-feet body (combatSpriteGeometry reads it), whatever the pose.
  if (referenceBodyHeight) root.dataset.bodyHeightRatio = String(referenceBodyHeight * scale / 190);
  root.style.cssText = `position:relative;width:${art.idleWidth * scale}px;height:190px;flex:none;overflow:visible`;
  const image = new Image();
  image.className = 'pose-frame';
  image.alt = definition.name || definition.id;
  image.draggable = false;
  image.style.cssText = `position:absolute;max-width:none;width:${512 * scale}px;height:${512 * scale}px;left:calc(50% - ${256 * scale}px);bottom:${-32 * scale}px`;
  // The root is the sprite's first child, which the hit recoil animates.
  // The art container holds still; bounded recoil stays on the outer root.
  // Like the older pose stages, nothing inside takes a hit: taps land on the stage.
  const bob = document.createElement('div');
  bob.className = 'enemy-expansion-bob';
  bob.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  root.append(bob);
  bob.append(image);
  const placeholder = document.createElement('span');
  placeholder.className = 'enemy-expansion-placeholder';
  placeholder.textContent = definition.name || definition.id;
  placeholder.setAttribute('role', 'img');
  placeholder.setAttribute('aria-label', placeholder.textContent);
  placeholder.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:none';
  bob.append(placeholder);
  // A failed frame leaves the stage like every other art fallback: the <img>
  // is taken out and the marked stage shows its named placeholder, so a Retry
  // (restoreArtPlaceholders) finds it and draws the art back in.
  image.addEventListener('load', () => {
    if (!image.parentNode) bob.append(image);
    image.style.visibility = ''; placeholder.style.display = 'none';
    root.removeAttribute(ART_PLACEHOLDER_ATTR); delete root.ashenRestoreArt;
  });
  image.addEventListener('error', () => {
    // A detached frame's errors never reach highResArt's document listener,
    // so try its built-in fallback here before standing the name in.
    const fallback = builtInFor(image.getAttribute('src'));
    if (fallback) { image.src = fallback; return; }
    image.remove(); placeholder.style.display = 'flex';
    markArtPlaceholder(root, () => draw(root.dataset.pose || 'idle'));
  });
  const path = pose => `assets/enemy-poses/expansion/${definition.id}/${pose}.webp`;
  let presentation = enemyPresentation(entity), timer = null, raf = 0, disposed = false, due = 0;
  let generation = 0;
  const resolve = pose => aliases[pose] || pose;
  // Every frame (idle, held stance, action, defeated) is drawn with the factor
  // that brings its measured body to the idle body's height, so the figure
  // keeps one on-screen size in every pose.
  function draw(pose) {
    if (disposed) return;
    const frame = art.actions[pose]?.[0]?.pose || pose;
    root.dataset.pose = frame;
    const landmarks = COMBAT_BODY_LANDMARKS[path(frame)];
    const factor = bodyScaleFactor(referenceBodyHeight, landmarks);
    const drawScale = scale * factor;
    const floor = landmarks?.feetY ?? 480;
    image.style.width = `${512 * drawScale}px`;
    image.style.height = `${512 * drawScale}px`;
    image.style.left = `calc(50% - ${256 * drawScale}px)`;
    image.style.bottom = `${-(512 - floor) * drawScale}px`;
    currentBody = landmarks;
    image.src = assetUrl(path(frame));
  }
  const active = () => timer !== null || raf !== 0;
  function stop() { clearTimeout(timer); timer = null; if (raf) cancelAnimationFrame(raf); raf = 0; generation++; }
  function settle() { stop(); draw(resolve(presentation.rest)); }
  function setState(next = {}) {
    presentation = enemyPresentation(next);
    const stances = enemyStanceSprites[definition.id];
    const stance = stances && Object.hasOwn(stances, next.presentationStance) ? stances[next.presentationStance] : null;
    if (presentation.rest !== 'defeated' && stance) presentation.rest = stance;
    if (stance && presentation.rest !== 'defeated') root.dataset.stance = next.presentationStance;
    else delete root.dataset.stance;
    root.style.filter = enemyAuraFilter(presentation.auraThemes);
    if (presentation.rest === 'defeated' || !active()) settle();
  }
  const stancePoses = Object.values(enemyStanceSprites[definition.id] || {});
  for (const pose of new Set([...art.poses, ...stancePoses])) { const preload = new Image(); preload.addEventListener('load', () => warmImageBoundsWhenIdle(preload), { once: true }); preload.src = assetUrl(path(pose)); }
  const stage = {
    el: root, enemy: true, poses: [...art.poses, ...Object.keys(art.actions), ...Object.keys(aliases)],
    setState, settle,
    get currentBody() {
      if (!currentBody || !image.complete || !image.naturalWidth) return null;
      const rect = image.getBoundingClientRect();
      const headY = rect.top + currentBody.headY * rect.height / currentBody.height;
      const feetY = rect.top + currentBody.feetY * rect.height / currentBody.height;
      return { top:headY, bottom:feetY, headY, feetY, bodyHeight:feetY-headY,
        left:rect.left, right:rect.right, source:'authored' };
    },
    dispose() { stop(); disposed = true; },
    hold(ms) {
      if (!active() || !(ms > 0)) return false;
      stop(); due += ms;
      timer = setTimeout(settle, Math.max(0, due - Date.now()));
      return true;
    },
    // Every frame of an action is held for the same time: the pace's frame hold (animationPace.js), or an equal
    // share of the lunge when that is longer. The total is the beat's reservation (combat.js reads totalMs), and the
    // contact stays at the same share of it that the lunge used (COMBAT_TIMING.windupFraction).
    actionTiming(pose, speed) {
      const sequence = art.actions[resolve(pose)];
      if (!sequence) return null;
      const frameMs = Math.max(Number(speed?.minFrameMs) || 0, (Number(speed?.lungeMs) || 0) / sequence.length);
      const totalMs = Math.round(frameMs * sequence.length);
      return { totalMs, impactMs: Math.round(totalMs * COMBAT_TIMING.windupFraction) };
    },
    play(pose, ms = 260) {
      if (disposed || (presentation.rest === 'defeated' && pose !== 'defeated')) return false;
      const selected = resolve(pose);
      if (selected === 'defeated') { presentation = { rest: 'defeated', auraThemes: [] }; root.style.filter = 'none'; settle(); return true; }
      const sequence = art.actions[selected];
      if (!sequence && !art.poses.includes(selected)) return false;
      stop();
      if (reducedMotionRequested() || ms <= 0) { settle(); return true; }
      if (!sequence) { due = Date.now() + ms; draw(selected); timer = setTimeout(settle, ms); return true; }
      // One clock (requestAnimationFrame), one hold for every frame, and never a skipped frame: a late tick shows
      // the next frame, and the later frames keep their full hold.
      const frameMs = Math.max(frameHoldMs({ enemy: true }), ms / sequence.length), total = frameMs * sequence.length, token = generation;
      let startAt = performance.now(), shown = 0;
      due = Date.now() + total;
      draw(sequence[0].pose);
      const tick = now => {
        raf = 0;
        if (disposed || token !== generation) return;
        let index = Math.floor(Math.max(0, now - startAt) / frameMs);
        if (index > shown + 1 || (index >= sequence.length && shown < sequence.length - 1)) {
          index = shown + 1; startAt = now - index * frameMs;
        }
        if (index >= sequence.length) { settle(); return; }
        if (index !== shown) { shown = index; draw(sequence[index].pose); }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return true;
    },
  };
  setState(entity);
  registerStage(root, stage);
  return root;
}
