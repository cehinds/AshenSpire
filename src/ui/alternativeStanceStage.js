import { alternativeStances } from '../content/alternativeStances.js';
import { stanceArtFor } from '../model/alternativeStance.js';
import { reducedMotionRequested } from './motion.js';

/** A static presentation layer. It owns no animation clock, mechanics, or intent reads. */
export function createAlternativeStanceStage(actorId, {
  catalog = alternativeStances, resolveUrl = path => path, lite = false,
} = {}) {
  const actor = catalog.actors[actorId];
  if (!actor) return null;
  const el = document.createElement('div');
  el.className = 'alternative-stance-stage';
  el.dataset.stanceActor = actorId;
  el.dataset.stanceCoverage = actor.status;
  el.style.cssText = 'position:relative;width:190px;height:190px;flex:none;overflow:visible;pointer-events:none';
  const image = new Image();
  image.draggable = false;
  image.style.cssText = 'position:absolute;max-width:none;width:304px;height:304px;left:calc(50% - 152px);bottom:-28.5px';
  el.append(image);
  let current = null, generation = 0, pending = null;
  let ready = Promise.resolve(false);
  return Object.freeze({
    el, ownsMotion: false,
    get stance() { return current; },
    get ready() { return ready; },
    setStance(stance) {
      const frame = stanceArtFor(catalog, actorId, stance);
      pending?.(false); pending = null;
      current = frame ? stance : null;
      const token = ++generation;
      delete el.dataset.frameReady;
      el.dataset.stance = current || 'neutral';
      image.alt = current ? `${actorId} · ${current} stance` : '';
      image.style.visibility = 'hidden';
      if (!frame) { image.removeAttribute('src'); ready = Promise.resolve(false); return false; }
      ready = new Promise(resolve => {
        pending = resolve;
        image.onload = () => { if (token !== generation) return resolve(false); pending = null; delete el.dataset.artError; el.dataset.frameReady = 'true'; image.style.visibility = 'visible'; resolve(true); };
        image.onerror = () => { if (token !== generation) return resolve(false); pending = null; el.dataset.artError = 'Stance artwork unavailable'; resolve(false); };
      });
      image.src = resolveUrl(frame[lite ? 'lite' : 'path']);
      return true;
    },
    setLite(value) { lite = !!value; if (current) this.setStance(current); },
    dispose() { generation++; pending?.(false); pending = null; image.onload = image.onerror = null; image.removeAttribute('src'); },
  });
}

/**
 * Integration seam for the action-animation owner. Wrap the existing stage once.
 * Its play(), hold(), actionTiming(), reactions and pose list stay authoritative.
 * The host must resumeStance() after its complete action/reaction timeline.
 * No second timer guesses when the original stage has finished.
 * setStance() supplies the last CONFIRMED card / observer-public intent family.
 */
export function withAlternativeStance(stage, actorId, options = {}) {
  if (!stage?.el) return stage;
  const held = createAlternativeStanceStage(actorId, options);
  if (!held) return stage;
  const originals = [...stage.el.children];
  held.el.style.cssText = 'position:absolute;inset:0;overflow:visible;pointer-events:none';
  stage.el.append(held.el);
  let active = false, dead = false, disposed = false;
  const visibility = new Map(originals.map(el => [el, el.style.visibility]));
  const show = () => {
    const painted = !disposed && !active && !dead && !!held.stance && held.el.dataset.frameReady === 'true' && !held.el.dataset.artError;
    held.el.style.visibility = painted ? 'visible' : 'hidden';
    originals.forEach(el => { el.style.visibility = painted ? 'hidden' : visibility.get(el); });
  };
  const finish = () => { active = false; show(); };
  const overrides = {
    setStance(next) { const selected = held.setStance(next); show(); held.ready.then(show); return selected; },
    setStanceLite(value) { held.setLite(value); show(); held.ready.then(show); },
    suspendStance() { active = true; show(); },
    resumeStance() { finish(); },
    play(...args) {
      if (args[0] === 'defeated') dead = true;
      active = true; show();
      const result = stage.play(...args);
      if (!result || reducedMotionRequested()) finish();
      return result;
    },
    hold(...args) { return stage.hold?.(...args) ?? false; },
    react(...args) { active = true; show(); return stage.react?.(...args); },
    settle() { const result = stage.settle?.(); finish(); return result; },
    setRestPose(next, ...args) { dead = next === 'defeated'; const result = stage.setRestPose?.(next, ...args); show(); return result; },
    dispose() { disposed = true; finish(); held.dispose(); held.el.remove(); return stage.dispose?.(); },
  };
  const descriptors = Object.getOwnPropertyDescriptors(stage);
  for (const [key, value] of Object.entries(overrides)) descriptors[key] = { value, enumerable: true };
  return Object.freeze(Object.defineProperties({}, descriptors));
}
