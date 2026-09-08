import { assetUrl } from './assetmap.js';
import { ENEMY_STATE_SCALE } from '../content/enemyStateArt.js';
import { ENEMY_STATE_POSES, enemyPresentation, enemyAuraFilter } from './enemyStates.js';

export function createEnemyPoseStage(host, facing, idle, id, entity) {
  host.classList.add('enemy-pose-stage');
  const frames = new Map();
  let presentation = enemyPresentation(entity), current = presentation.rest, timer;
  function draw() {
    const selected = frames.get(current);
    const ready = selected?.dataset.ready === 'true' && idle.dataset.artSource === 'enemy-poses';
    facing.dataset.stateActive = ready ? 'true' : 'false';
    host.dataset.pose = ready ? current : 'idle';
    for (const frame of frames.values()) frame.style.visibility = ready && frame === selected ? 'visible' : 'hidden';
  }
  for (const pose of ENEMY_STATE_POSES) {
    const frame = idle.cloneNode(false);
    frame.className = 'enemy-pose-state';
    frame.alt = ''; frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, { position: 'absolute', bottom: '0', visibility: 'hidden', pointerEvents: 'none' });
    frame.style.height = `${100 * (ENEMY_STATE_SCALE[id] || 1) * (pose === 'projectile' ? 1.05 : 1)}%`;
    frame.addEventListener('load', () => { frame.dataset.ready = 'true'; draw(); });
    frame.addEventListener('error', () => { delete frame.dataset.ready; draw(); });
    frames.set(pose, frame); facing.appendChild(frame);
    frame.src = assetUrl(`assets/enemy-states/${id}_${pose}.png`);
  }
  idle.addEventListener('error', draw);
  function setState(next) {
    presentation = enemyPresentation(next);
    host.dataset.buffs = presentation.buffs.join(' ');
    facing.style.filter = enemyAuraFilter(presentation.auraThemes);
    if (!timer) { current = presentation.rest; draw(); }
  }
  function settle() { clearTimeout(timer); timer = null; current = presentation.rest; draw(); }
  setState(entity);
  return {
    enemy: true, poses: ['idle', 'attack', ...ENEMY_STATE_POSES], setState, settle,
    play(pose, ms = 300) {
      clearTimeout(timer);
      current = pose === 'hit' ? 'hurt' : pose;
      draw();
      timer = setTimeout(settle, Math.max(0, ms));
      return true;
    },
  };
}
