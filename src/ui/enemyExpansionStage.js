import { enemyExpansion } from '../content/enemyExpansion.js';
import { assetUrl } from './assetmap.js';
import { enemyPresentation, enemyAuraFilter } from './enemyStates.js';
import { reducedMotionRequested } from './motion.js';
import { registerStage } from './services/PoseAnimator.js';
import { markArtPlaceholder } from './artFallback.js';

const aliases = { guard: 'block', guardHit: 'block', projectile: 'rangedWeaponAttack', ranged: 'rangedWeaponAttack', buff: 'magicAttack', casting: 'magicAttack', magic: 'magicAttack', hurt: 'hit', afflicted: 'wounded', counter: 'counterattack', prone: 'defeated', sleep: 'defeated' };

// Frames share one canvas and floor. Actions are selected only during playback.
export function enemyExpansionSprite(definition, entity = {}) {
  const art = enemyExpansion[definition.id];
  if (!art) return null;
  const root = document.createElement('div');
  root.className = 'enemy-pose-stage enemy-expansion-stage';
  root.dataset.enemyId = definition.id;
  root.dataset.facing = 'screen-left';
  const scale = 190 / art.idleHeight;
  root.style.cssText = `position:relative;width:${art.idleWidth * scale}px;height:190px;flex:none;overflow:visible`;
  const image = new Image();
  image.className = 'pose-frame';
  image.alt = definition.name || definition.id;
  image.draggable = false;
  image.style.cssText = `position:absolute;max-width:none;width:${512 * scale}px;height:${512 * scale}px;left:calc(50% - ${256 * scale}px);bottom:${-32 * scale}px`;
  root.append(image);
  const placeholder = document.createElement('span');
  placeholder.textContent = definition.name || definition.id;
  placeholder.setAttribute('role', 'img');
  placeholder.setAttribute('aria-label', placeholder.textContent);
  placeholder.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center';
  root.append(placeholder);
  image.addEventListener('load', () => { image.style.visibility = ''; placeholder.style.display = 'none'; });
  image.addEventListener('error', () => {
    image.style.visibility = 'hidden'; placeholder.style.display = 'flex';
    markArtPlaceholder(root, () => draw(root.dataset.pose || 'idle'));
  });
  const path = pose => `assets/enemy-poses/expansion/${definition.id}/${pose}.webp`;
  let presentation = enemyPresentation(entity), timer = null, disposed = false, due = 0;
  let generation = 0;
  const resolve = pose => aliases[pose] || pose;
  function draw(pose) {
    if (disposed) return;
    const frame = art.actions[pose]?.[0]?.pose || pose;
    root.dataset.pose = frame;
    image.src = assetUrl(path(frame));
  }
  function stop() { clearTimeout(timer); timer = null; generation++; }
  function settle() { stop(); draw(resolve(presentation.rest)); }
  function setState(next) {
    presentation = enemyPresentation(next);
    root.style.filter = enemyAuraFilter(presentation.auraThemes);
    if (presentation.rest === 'defeated' || !timer) settle();
  }
  for (const pose of art.poses) { const preload = new Image(); preload.src = assetUrl(path(pose)); }
  const stage = {
    el: root, enemy: true, poses: [...art.poses, ...Object.keys(art.actions), ...Object.keys(aliases)],
    setState, settle,
    dispose() { stop(); disposed = true; },
    hold(ms) {
      if (!timer || !(ms > 0)) return false;
      stop(); due += ms;
      timer = setTimeout(settle, Math.max(0, due - Date.now()));
      return true;
    },
    play(pose, ms = 260) {
      if (disposed || (presentation.rest === 'defeated' && pose !== 'defeated')) return false;
      const selected = resolve(pose);
      if (selected === 'defeated') { presentation = { rest: 'defeated', auraThemes: [] }; root.style.filter = 'none'; settle(); return true; }
      const sequence = art.actions[selected];
      if (!sequence && !art.poses.includes(selected)) return false;
      stop();
      if (reducedMotionRequested() || ms <= 0) { settle(); return true; }
      due = Date.now() + ms;
      const token = generation;
      const start = Date.now();
      const advance = () => {
        if (disposed || token !== generation) return;
        const elapsed = Date.now() - start;
        if (elapsed >= ms) { settle(); return; }
        if (sequence) {
          let boundary = 0;
          const frame = sequence.find(frame => { boundary += frame.duration / 260 * ms; return elapsed < boundary; }) || sequence.at(-1);
          draw(frame.pose);
          timer = setTimeout(advance, Math.max(1, boundary - elapsed));
        } else { draw(selected); timer = setTimeout(settle, ms); }
      };
      advance(); return true;
    },
  };
  setState(entity);
  registerStage(root, stage);
  return root;
}
