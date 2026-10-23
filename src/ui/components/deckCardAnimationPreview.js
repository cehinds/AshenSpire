import { figureAnimationsEnabled } from '../../model/gameAnimationPolicy.js';
import { matchViewMedia } from '../viewViewport.js';
import { el, button } from '../kit/index.js';
import { createPaintedStage } from '../paintedOutfits.js';
import { createAlternativeCardStage } from '../alternativeCardStage.js';
import { displayAppearance } from '../displayAppearance.js';
import { sampleSequence } from '../../model/alternativeCardAnimation.js';
import { ANIM_SPEEDS, getAnimSpeed } from '../animationPace.js';
import { reducedMotionRequested } from '../motion.js';
import { t } from '../strings.js';
import { playingCardDefinition } from '../../model/playingCard.js';
import { alternativeCardAnimationFamily, cardSequenceTiming } from '../../model/cardAnimationFamily.js';
import { combatWeaponProfilesFor } from '../../model/combatWeaponPresentation.js';
import { selectedWeaponCounterFor } from '../../model/selectedWeaponStances.js';
import { figureSpec, equippedPieces, gripOf } from '../../model/loadout.js';
import { combatEquipmentAnimationForLoadout, animationClip } from '../../model/equipmentAnimation.js';
import { COMBAT_SEQUENCES, resolveCombatAnimation } from '../../model/combatAnimation.js';
import { combatEffectTags } from '../../model/combatEffects.js';
import { tagService } from '../../model/tagService.js';
import { uiConfig } from '../../config/generated/ui.js';

/** Same equipment, tag routing and authored frames as combat; no combat mutation. */
export function deckCardAnimationPlan(registries, run, ref) {
  const classId = run.class || run.classId;
  const definition = playingCardDefinition(registries, ref, { rules: run });
  const animation = combatEquipmentAnimationForLoadout(registries, run.loadout, classId);
  const armourId = figureSpec(registries, run.loadout, classId).armourId;
  const presentation = combatWeaponProfilesFor({ classId, armourId,
    grip: gripOf(registries, run.loadout, classId), appearance: displayAppearance() });
  const tags = definition.cardTags?.length ? definition.cardTags : tagService(registries).tagsOf('card', definition);
  let plan = resolveCombatAnimation({ ...definition, cardTags: tags,
    animationTags: combatEffectTags(registries, definition), sourceArmamentId: ref.sourceArmamentId,
  }, equippedPieces(registries, run.loadout, classId), { animation, classId, appearance: displayAppearance(),
    combatExpansionVersion: run.combatExpansionVersion });
  // Inspection demonstrates the conditional reply. Playing Counter first uses
  // counterPrepare; a triggered reply uses this same reviewed return sequence.
  if (plan.technique === 'counterPrepare') plan = { ...plan, technique:
    selectedWeaponCounterFor(definition, presentation.weaponProfile, registries.cards.get(ref.cardId)) || 'counter' };
  const assembled = plan.alternative && alternativeCardAnimationFamily(classId, presentation);
  const sequence = assembled?.family.sequences[plan.technique];
  if (sequence) return { animation: null, plan, sequence, frames: sequence.poses,
    classId, armourId: 'default', presentation,
    duration: cardSequenceTiming(sequence, ANIM_SPEEDS[getAnimSpeed()]).totalMs,
    frameMs: 260 / sequence.poses.length };

  const clip = animationClip(animation, plan.technique);
  const frames = clip?.frames || COMBAT_SEQUENCES[plan.technique] || [plan.technique];
  return { animation, plan, frames, classId, armourId, presentation,
    frameMs: clip?.frameMs || uiConfig.presentation.paintedOutfits.motion.defaultPlayMs / frames.length };
}

/** Lazy desktop-only playback. Pausing freezes the exact frame; disposal owns every listener/frame. */
export function deckCardAnimationPreview({ registries, run, ref, paused = false, onPaused = () => {} }, { createStage = (classId, armourId, options) => createAlternativeCardStage(classId, options) || createPaintedStage(classId, armourId, options) } = {}) {
  const animationsEnabled = figureAnimationsEnabled(run);
  const root = el('section', { class: 'deck-editor-animation', 'aria-label': t('deckEditor.animation') });
  const host = el('div', { class: 'deck-editor-animation-stage', 'aria-hidden': 'true' });
  const toggle = button({ label: t(paused ? 'deckEditor.animation.play' : 'deckEditor.animation.pause'), className: 'deck-editor-animation-toggle' });
  const caption = el('span', { text: t('deckEditor.animation') });
  root.append(host, el('div', { class: 'deck-editor-animation-controls' }, [caption, toggle]));
  const desktop = typeof matchMedia === 'function' ? matchViewMedia('(min-width: 1001px)') : null;
  const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let stage = null, playback = null, frames = [], tick = null, lastTime = null, elapsed = 0, index = -1, disposed = false;
  let userPaused = paused || reducedMotionRequested();
  const stop = () => { if (tick !== null) cancelAnimationFrame(tick); tick = null; lastTime = null; };
  const paint = () => {
    // Inspection runs at half combat speed and holds the final pose for a
    // full second so the motion is easy to follow between repetitions.
    const duration = playback.duration || playback.frameMs * frames.length;
    const cycleTime = elapsed % (duration * 2 + 1000);
    const time = Math.min(cycleTime / 2, Math.max(0, duration - 1));
    const next = playback.sequence ? sampleSequence(playback.sequence,time,duration).index : Math.min(frames.length - 1, Math.floor(time / playback.frameMs));
    if (playback.sequence && stage.seek) { stage.seek(playback.plan.technique,time,playback.duration); index=next; return; }
    if (next !== index) { stage.setPose(frames[next]); index = next; }
  };
  const frame = time => {
    tick = null;
    if (disposed || !animationsEnabled || userPaused || !desktop?.matches || document.hidden || !stage) return;
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
      stage = createStage(playback.classId, playback.armourId, { animation: playback.animation, ...playback.presentation });
      frames = playback.frames.filter(pose => stage?.poses.includes(pose));
      if (stage) host.replaceChildren(stage.el);
    }
    const available = animationsEnabled && !!stage && frames.length > 1 && playback.duration !== 0;
    caption.textContent = t(available ? 'deckEditor.animation' : frames.length ? 'deckEditor.animation.still' : 'deckEditor.animation.unavailable');
    host.hidden = !frames.length;
    toggle.disabled = !available;
    root.classList.toggle('paused', userPaused || document.hidden || !available);
    toggle.textContent = t(userPaused ? 'deckEditor.animation.play' : 'deckEditor.animation.pause');
    // An authored one-frame cast/buff is still the card's pose. Show it even
    // though it has no timeline to loop; otherwise the preview stays idle.
    if (frames.length && animationsEnabled) paint();
    if (!available) return;
    if (!userPaused && !document.hidden) tick = requestAnimationFrame(frame);
  }
  const onToggle = () => { if (disposed || !animationsEnabled) return; userPaused = !userPaused; onPaused(userPaused); sync(); };
  const onMotionChange = () => {
    if (disposed || !animationsEnabled) return;
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
