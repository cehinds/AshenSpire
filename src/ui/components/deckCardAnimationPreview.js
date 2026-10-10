import { el, button } from '../kit/index.js';
import { createPaintedStage } from '../paintedOutfits.js';
import { createAlternativeCardStage } from '../alternativeCardStage.js';
import { displayAppearance } from '../displayAppearance.js';
import { alternativeCardAnimations } from '../../content/alternativeCardAnimations.js';
import { playerCounterSweepSprites } from '../../content/playerCounterSweepSprites.js';
import { playerAttackSequence } from '../../model/playerAttackSprites.js';
import { sampleSequence, durationFor } from '../../model/alternativeCardAnimation.js';
import { ANIM_SPEEDS, getAnimSpeed } from '../animationPace.js';
import { reducedMotionRequested } from '../motion.js';
import { t } from '../strings.js';
import { resolveCard } from '../../model/registries.js';
import { figureSpec, equippedPieces } from '../../model/loadout.js';
import { equipmentAnimationForLoadout, animationClip } from '../../model/equipmentAnimation.js';
import { COMBAT_SEQUENCES, resolveCombatAnimation } from '../../model/combatAnimation.js';
import { combatEffectTags } from '../../model/combatEffects.js';
import { tagService } from '../../model/tagService.js';
import { uiConfig } from '../../config/generated/ui.js';

/** Same equipment, tag routing and authored frames as combat; no combat mutation. */
export function deckCardAnimationPlan(registries, run, ref) {
  const definition = resolveCard(registries, ref);
  const animation = equipmentAnimationForLoadout(registries, run.loadout, run.class);
  const tags = definition.cardTags?.length ? definition.cardTags : tagService(registries).tagsOf('card', definition);
  const plan = resolveCombatAnimation({ ...definition, cardTags: tags,
    animationTags: combatEffectTags(registries, definition), sourceArmamentId: ref.sourceArmamentId,
  }, equippedPieces(registries, run.loadout, run.class), { animation, classId: run.class, appearance: displayAppearance() });
  const sequence = plan.alternative && (playerAttackSequence(run.class, plan.technique) || playerCounterSweepSprites[run.class]?.sequences[plan.technique] || alternativeCardAnimations.classes[run.class]?.sequences[plan.technique]);
  if (sequence) return { animation: null, plan, sequence, frames: sequence.poses, armourId: 'default',
    duration: durationFor(sequence, ANIM_SPEEDS[getAnimSpeed()]), frameMs: 260 / sequence.poses.length };
  const clip = animationClip(animation, plan.technique);
  const frames = clip?.frames || COMBAT_SEQUENCES[plan.technique] || [plan.technique];
  return { animation, plan, frames, armourId: figureSpec(registries, run.loadout, run.class).armourId,
    frameMs: clip?.frameMs || uiConfig.presentation.paintedOutfits.motion.defaultPlayMs / frames.length };
}

/** Lazy desktop-only playback. Pausing freezes the exact frame; disposal owns every listener/frame. */
export function deckCardAnimationPreview({ registries, run, ref, paused = false, onPaused = () => {} }, { createStage = (classId, armourId, options) => createAlternativeCardStage(classId) || createPaintedStage(classId, armourId, options) } = {}) {
  const root = el('section', { class: 'deck-editor-animation', 'aria-label': t('deckEditor.animation') });
  const host = el('div', { class: 'deck-editor-animation-stage', 'aria-hidden': 'true' });
  const toggle = button({ label: t(paused ? 'deckEditor.animation.play' : 'deckEditor.animation.pause'), className: 'deck-editor-animation-toggle' });
  const caption = el('span', { text: t('deckEditor.animation') });
  root.append(host, el('div', { class: 'deck-editor-animation-controls' }, [caption, toggle]));
  const desktop = typeof matchMedia === 'function' ? matchMedia('(min-width: 1001px)') : null;
  const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let stage = null, playback = null, frames = [], tick = null, lastTime = null, elapsed = 0, index = -1, disposed = false;
  let userPaused = paused || reducedMotionRequested();
  const stop = () => { if (tick !== null) cancelAnimationFrame(tick); tick = null; lastTime = null; };
  const paint = () => {
    const time = playback.duration ? elapsed % playback.duration : 0;
    const next = playback.sequence ? sampleSequence(playback.sequence,time,playback.duration).index : Math.floor(elapsed / playback.frameMs) % frames.length;
    if (playback.sequence && stage.seek) { stage.seek(playback.plan.technique,time,playback.duration); index=next; return; }
    if (next !== index) { stage.setPose(frames[next]); index = next; }
  };
  const frame = time => {
    tick = null;
    if (disposed || userPaused || !desktop?.matches || document.hidden || !stage) return;
    if (lastTime !== null) elapsed += Math.max(0, time - lastTime);
    lastTime = time;
    paint();
    tick = requestAnimationFrame(frame);
  };
  function sync() {
    stop();
    if (disposed) return;
    root.hidden = !desktop?.matches;
    if (!desktop?.matches) {
      stage?.dispose(); stage = null; host.replaceChildren(); index = -1;
      return;
    }
    if (!stage) {
      playback = deckCardAnimationPlan(registries, run, ref);
      stage = createStage(run.class, playback.armourId, { animation: playback.animation });
      frames = playback.frames.filter(pose => stage?.poses.includes(pose));
      if (stage) host.replaceChildren(stage.el);
    }
    const available = !!stage && frames.length > 1 && playback.duration !== 0;
    caption.textContent = t(available ? 'deckEditor.animation' : frames.length ? 'deckEditor.animation.still' : 'deckEditor.animation.unavailable');
    host.hidden = !frames.length;
    toggle.disabled = !available;
    root.classList.toggle('paused', userPaused || document.hidden || !available);
    toggle.textContent = t(userPaused ? 'deckEditor.animation.play' : 'deckEditor.animation.pause');
    // An authored one-frame cast/buff is still the card's pose. Show it even
    // though it has no timeline to loop; otherwise the preview stays idle.
    if (frames.length) paint();
    if (!available) return;
    if (!userPaused && !document.hidden) tick = requestAnimationFrame(frame);
  }
  const onToggle = () => { if (disposed) return; userPaused = !userPaused; onPaused(userPaused); sync(); };
  const onMotionChange = () => {
    if (disposed) return;
    // Preference changes stop playback immediately. Turning reduced motion
    // off does not restart a paused preview; Play is an explicit opt-in.
    if (reducedMotionRequested() && !userPaused) { userPaused = true; onPaused(true); }
    sync();
  };
  toggle.addEventListener('click', onToggle);
  desktop?.addEventListener?.('change', sync);
  reducedMotion?.addEventListener?.('change', onMotionChange);
  const motionObserver = typeof MutationObserver === 'function' ? new MutationObserver(onMotionChange) : null;
  motionObserver?.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', sync);
  sync();
  return { root, dispose() {
    disposed = true; stop(); stage?.dispose(); stage = null;
    desktop?.removeEventListener?.('change', sync);
    reducedMotion?.removeEventListener?.('change', onMotionChange);
    motionObserver?.disconnect();
    toggle.removeEventListener('click', onToggle);
    document.removeEventListener('visibilitychange', sync);
  } };
}
