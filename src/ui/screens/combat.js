import { ratingValue, ratingDamageMultiplier } from '../../model/combatRatings.js';
import { openCollectibleInspection } from '../components/collectibleCard.js';
import { combatantInfo, combatantIntent, selectCombatantInfo } from '../components/combatantOverhead.js';
import { combatBackdropHtml } from '../components/environmentArt.js';
import { targetLayer } from '../models/TargetLayerModel.js';
import { touchPoint, recordFlickPoint, flickVerdict, nearestFlickTarget } from '../models/TouchFlickModel.js';
import { combatEffectAngle } from '../combatEffectDirection.js';
import { combatEffectPlan, combatEffectTags, combatEffectTargetIds } from '../../model/combatEffects.js';
import { decorateCombatEffects, presentationTargetIds } from '../../model/combatEffectEvents.js';
import { playCombatEffectPlan } from '../combatEffectSprites.js';
import { playCardEffectLayers } from '../cardEffectLayers.js';
// src/ui/screens/combat.js — the combat screen (SPEC §7.2–7.4, mockup:
// docs/mockups/combat-screen.svg)
//
// Renders strictly from combat state; animates from dispatch events. Every
// number displayed comes from previewCard / previewIntent — no math here.

import { dispatch, previewCard, previewIntent, getEntity } from '../../engine/combat.js';
import { assertFoundationPlayable } from '../../engine/combatRules.js';
import { resolveCard } from '../../model/registries.js';
import { runHandRules } from '../../model/handRules.js';
import { runClassIdentity } from '../../model/classCard.js';
import { characterLevel } from '../../model/levelup.js';
import { cardKind } from '../../model/tree.js';
import { dodgeReceipt } from '../components/dodgeReceipt.js';
import { openPileModal, openSpentPileModal } from '../components/piles.js';
import { resolveActionAnimation } from '../../model/actionAnimation.js';
import { enemyMoveCards } from '../../model/enemyMoveCards.js';
import { enemyMoveDamage } from '../../model/state.js';
import { tagService } from '../../model/tagService.js';
import { reducedMotionRequested } from '../motion.js';
import { stageFor } from '../services/PoseAnimator.js';
import { attachTooltip, hideTooltip, showTooltipFor, esc } from '../components/tooltip.js';
import { combatantDetailBody, combatantInspectorLayout } from '../components/combatantInspector.js';
import { activeCombatAbilities } from '../components/combatAbilities.js';
import { tooltipHelp } from '../../content/tooltipHelp.js';
import { helpText, resolveTooltipSettings } from '../../model/tooltipSettings.js';
import { configureTooltipGlossary } from '../components/tooltipGlossary.js';
import { relicText, renderCard } from '../components/card.js';
import { enemySprite, playerSprite, spritesAreEnabled } from '../assets.js';
import { animateEvents, playTimeline, anchorLocalBox, viewportLocalBox, clampBox, VIEWPORT_ORIGIN } from '../fx.js';
import { figureSpec, equippedPieces } from '../../model/loadout.js';
import { resourceAura } from '../combatAura.js';
import { resolveCombatAnimation, combatRestAfterEvent } from '../../model/combatAnimation.js';
import { resolveCombatPose, readinessAfterEvent, bloodRiteReaction } from '../../model/combatPose.js';
import {
  isReaverAttackEligible,
  playReaverAttack,
  preloadReaverAttackFrames,
  reaverAttackTiming,
} from '../reaverAttack.js';
import { MENU, statusTooltipText, statusInstancePresentation, statusInstanceSemanticAttrs } from '../uiContent.js';
import { openQuickNav, closeQuickNav, quickNavMode, saveAction } from '../components/quicknav.js';
import { sfx } from '../sfx.js';
import { mountTutorial } from '../components/tutorial.js';
import { veilIsOpen } from '../components/veil.js';
import { focusElement, focusFirst, matchAction, actionDestinationForEvent, isEngaged, keyLabel, padLabel, hasGamepad, actionHint } from '../input.js';
import { clearTargetSilhouettes, renderTargetSilhouette } from '../components/friendlyTargets.js';
import { friendlyTargetMode, friendlyTargetPlan } from '../../model/friendlyTargets.js';
import { hintBarHtml, setHintMode } from '../components/hints.js';
import { dlog } from '../debuglog.js';
import { mountEquipment } from './equipment.js';
import { trackGesture } from '../gesture.js';
import { finishCardDrag } from '../cardDragEnd.js';
import { resourceBars } from '../components/resbars.js';
import { renderArcaneExposure, arcaneExposureReceipt } from '../components/arcaneExposure.js';
import { resourceBarPlan, resourceDomains } from '../../model/resources.js';
import { beatArmer } from '../../framework/optionDecision.js';
import { flaskActionPlan } from '../../model/flaskActions.js';
import { flaskTooltipHtml, flaskDetailLines, flaskPresentation } from '../components/flask.js';
import { CHARGE_FLASK_KINDS, chargeFlaskDefinition } from '../../model/gracerefill.js';
import { potionContents, potionCountStringId } from '../models/PotionContentsModel.js';
import { mountRelicRail } from '../components/relicRail.js';
import { t, tFull } from '../strings.js';
import { armHold, holdMs } from '../components/holdconfirm.js';
import { mountHand } from '../components/hand.js';
import { hudShellHtml } from '../components/hudmeta.js';
import { runHudViewModel } from '../viewModels/RunHudViewModel.js';
import { combatantFrame, updateCombatantFrame } from '../components/combatantFrame.js';
import { statureFor } from '../components/stature.js';
import { UI_COMPONENTS as UI, uiComponentAttrs, markUiComponent } from '../components/uiComponents.js';
import { wireHudQuickSettings } from '../components/hudQuickSettings.js';
import { battlefieldStageModel } from '../models/BattlefieldStageModel.js';
import { wireBattlefieldStage } from '../components/battlefieldStage.js';
import { wireframeUi } from '../../content/wireframeUi.js';
import { iconTray, observeIconTray, setIconTrayItems, setIconTrayOverflow, trayIcon } from '../components/iconTray.js';
import { planCombatantStack } from '../models/CombatantStackModel.js';
import { meterRowSelectedOnly } from '../models/CombatantMeterModel.js';
import { wireCombatLayout } from '../components/combatLayout.js';
import { intentVisible } from '../models/CombatOverlayModel.js';
import { el, meter, meters, pill, labelStack, statPair, keycap, glyph, iconButton, button, html, openModal, detailCard, optionCard, flavour } from '../kit/index.js';
import { clearSelection, onSelectionChange } from '../components/cardSelection.js';
import { wireFormationMovement } from '../components/formationMovement.js';
import { formationGridHtml } from '../components/formationGrid.js';
import { formationMovePlan } from '../../model/formationMovement.js';
import { discardChoicePlan } from '../../engine/handRules.js';
import { openHandDiscard } from '../components/handDiscard.js';

/** A pile control: a kit button carrying a stacked StatPair (count over name). */
function pileButton(kind, label) {
  const count = statPair({ key: label, value: '0', attrs: { class: 'stack' } });
  count.querySelector('.sp-v').classList.add('n'); // the hook the instruments count by
  const node = button({ label: '', className: `pile ${kind} tall` });
  node.appendChild(count);
  return node;
}

// The event types that move the displayed hand between beats — the same four
// applyBeatToDisp() reads. Kept beside that switch's contract, not typed twice.
const HAND_BEAT_EVENTS = new Set(['cardDrawn', 'cardPlayed', 'cardDiscarded', 'cardExhausted']);

// THE POSITIONAL CARD KEYS (SPEC §7.3, §9 M4), as a pure mapping so it can be
// tested without a DOM. `1`–`9` name hand slots 1–9 and `q`/`Q` names slot 10
// (the hand caps at 10). While a card or flask is armed (`targeting`), a DIGIT
// names the Nth LIVING enemy instead; Q never targets, so it falls through to
// slot 10. Returns null for a key that is not a card key (the caller leaves the
// event alone); otherwise one of
//   { kind: 'select', index }  arm/play hand slot `index` (0-based)
//   { kind: 'target', index }  commit the armed card/flask on living enemy `index`
//   { kind: 'none' }           a card key with nothing under it: swallowed, no-op
export function cardHotkeyAction(key, { targeting = false, handSize = 0, livingEnemies = 0 } = {}) {
  const index = /^[1-9]$/.test(key) ? Number(key) - 1 : key === 'q' || key === 'Q' ? 9 : -1;
  if (index < 0) return null;
  if (targeting && index < 9) return index < livingEnemies ? { kind: 'target', index } : { kind: 'none' };
  return index < handSize ? { kind: 'select', index } : { kind: 'none' };
}

export function mountCombat(app, { registries, run, combat, meta, onEnd, showTutorial, onTutorialDone, onSettings, onSettingsChange, onMenu, onSave, onQuit, onLoad, onQuitWithoutSave, onArmoury, enemyAppearance = {}, quickControls = {}, readSettings = () => meta.settings || {} }) {
  // A SPENT BEAT BELONGS TO THE SCREEN THAT SPENT IT. cardSelection is a
  // page-wide store, and nothing in production ever emptied it — so a card
  // whose `i` had been read kept its first beat for the life of the page, and
  // meeting the same logical id on a later surface handed that surface a card
  // already one beat in: its first touch acted instead of selecting.
  clearSelection();
  configureTooltipGlossary(registries);
  // THE ONE DOOR for every action on this screen that the second-beat table has
  // ruled on. This screen names actions; it does not know what a hold is and it
  // does not decide which of its buttons deserve one (model/secondbeat.js).
  const arm = beatArmer(meta, registries);
  // Declared here, assigned where End Turn is wired. `renderControls` re-dresses
  // it every frame and runs before that line on the first paint, so it must be
  // a `let` that reads null rather than a `const` in its temporal dead zone —
  // which throws, and would throw on the FIRST RENDER OF EVERY FIGHT.
  let endTurnBeat = null;
  let formationMovement = null;
  const previewParams = new URLSearchParams(window.location.search);
  const previewSceneId = previewParams.get('shot') === 'combat' ? previewParams.get('shotScene') : null;
  app.innerHTML = `
    <div class="combat" data-layout="formation" data-turn="player">
      <!-- ONE HUD SHELL: map and combat supply state to hudShellHtml; neither
           screen owns row order, placement hooks, or a second copy of chrome. -->
      ${hudShellHtml(runHudViewModel({
        place: 'combat',
        cinders: run.cinders,
        act: run.actNumber,
        actTotal: run.actNumber > 3 ? null : 3,
        floor: run.floor,
        floorTotal: run.mapGraph?.floors ?? null,
        seed: run.seedString,
        identity: { className: runClassIdentity(registries, run).name },
        controls: {
          armouryId: 'combat-armoury',
          menuId: 'combat-menu',
          menuHint: actionHint('menu'),
        },
        // The settings bag. `presentation` went with the fullscreen/music pair,
        // and the band's compact/expanded grip went on 2026-09-11; nothing in
        // the bag steers the HUD now, the parameter keeps the callers' shape.
        quickSettings: { settings: meta.settings || {} },
      }))}
      ${combatBackdropHtml(run, previewSceneId)}
      <div class="field" ${uiComponentAttrs(UI.battlefieldStage)}>
        ${formationGridHtml()}
        <div class="turn-ribbon" role="status" aria-live="polite">Player Turn</div>
        <div class="player-zone"></div>
        <div class="sr-only dodge-announcement" role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="enemy-row"></div>
      </div>
      <div class="hand-area">
        <div class="hand-overlay" ${uiComponentAttrs(UI.playerHandTray)} data-paging="false">
          ${html(iconButton({ glyph: '‹', label: 'Previous card', className: 'hand-page hand-prev', attrs: { 'data-focusable': '', hidden: '', 'aria-controls': 'combat-hand' } }))}
          <!-- The strip itself — cards, fan, key hints, the inspect hold, the
               overlap arm and the Law 5 exemption — is components/hand.js, THE
               one hand renderer (both surfaces; the exemption's home is
               src/ui/handAxis.js). This screen supplies only the viewer half:
               live previewCard entries off the paced snapshot, and the local
               dispatch wiring (wireCardInput). -->
          <div class="hand" id="combat-hand"></div>
          ${html(iconButton({ glyph: '›', label: 'Next card', className: 'hand-page hand-next', attrs: { 'data-focusable': '', hidden: '', 'aria-controls': 'combat-hand' } }))}
        </div>
        <!-- THE ACTION ROW IS A KIT ButtonRow: the Actions receipt as a StatPair,
             Draw, Discard with Exhaust, and Potions. End Turn is the
             primary with its Keycap and, from the second-beat
             machinery, its HOLD hint. All five cells stay present at zero so no
             control appears late or shifts the row. -->
        <div class="combat-action-row as-btnrow" data-size="fill" ${uiComponentAttrs(UI.combatActionRail)} role="group" aria-label="Combat actions">
          ${html(statPair({ key: 'Actions', value: '', attrs: { class: 'energy-orb cell stack lg', role: 'status', 'aria-label': 'Actions remaining' } }))}
          ${html(pileButton('draw', 'Draw'))}
          ${html(button({ label: 'End Turn', weight: 'primary', exception: 'combatEndTurn', className: 'end-turn wide tall' }))}
          ${html(button({ label: 'Discard', className: 'pile spent tall' }))}
          ${html(button({ label: 'Potions', className: 'combat-potions tall' }))}
          <!-- The Potions minis: the shared icon tray over the Potions control,
               out of the row's grid (renderPotionTray). -->
          <div class="combat-potion-tray as-pips icon-tray" aria-label="${esc(t('iconTray.potions'))}"></div>
        </div>
        <!-- Context hints: the strip is mounted for its readers but stays hidden
             on this screen — the action row carries every key it would name. -->
        ${hintBarHtml('combat').replace('<div class="hint-bar', '<div hidden class="hint-bar')}
      </div>
      <div class="fx-layer"></div>
      <svg id="target-arrow" width="100%" height="100%" style="display:none">
        <line x1="0" y1="0" x2="0" y2="0" stroke="var(--gold)" stroke-width="3" stroke-dasharray="8 6"/>
      </svg>
    </div>`;

  wireHudQuickSettings(app, { settings: meta.settings || {}, onSettingsChange });

  const $ = (sel) => app.querySelector(sel);
  const combatEl = $('.combat');
  const potionReveal = resolveTooltipSettings(meta.settings);
  const actionRow = $('.combat-action-row');
  actionRow?.style.setProperty('--potion-reveal-delay', `${potionReveal.open}ms`);
  actionRow?.style.setProperty('--potion-focus-delay', `${potionReveal.focus}ms`);
  actionRow?.style.setProperty('--potion-reveal-fade', `${potionReveal.fade}ms`);
  // The bar ceilings, DERIVED from the content (classes + equipment for the
  // player surface, plus every enemy for the under-model one) rather than typed.
  // Once per mount: it is a fact about the content, not about the frame.
  const resDomains = resourceDomains(registries);
  const battlefieldStage = wireBattlefieldStage($('.field'), battlefieldStageModel(registries.balance.ui.combatantStage));
  const combatLayout = wireCombatLayout(combatEl);
  let playerRest = 'idle';
  let readinessOrder = [];
  let visualPlans = new Map();
  const barrierVisuals = new Map();
  let appliedVisualEvents = new Set();
  function applyVisualEvents(events) {
    for (const event of events) {
      if (appliedVisualEvents.has(event)) continue;
      appliedVisualEvents.add(event);
      playerRest = combatRestAfterEvent(playerRest, event, 'player', visualPlans.get(event.cardInstanceId));
      readinessOrder = readinessAfterEvent(readinessOrder, event, 'player');
    }
  }
  if (typeof window !== 'undefined') window.__combat = combat; // debug handle
  const fxCtx = {
    layer: $('.fx-layer'),
    combatEl,
    anchorFor: (id) => app.querySelector(`[data-eid="${id}"] .sprite`) || app.querySelector(`[data-eid="${id}"]`),
    relicAnchor: (relicId) => app.querySelector(`[data-relic-id="${relicId}"]`),
    orb: () => app.querySelector('.energy-orb'),
    // #61: fx beats read a proc row's display data (name/tint/icon) through
    // this accessor — one home, the status def itself, with the WORDS
    // resolved through the framework term overlay.
    statusInfo: (sid) => registries.frameworkTerms.withStatusWords(registries.statuses.get(sid)),
    maxActorAnimationMs: (speed) => {
      const animation = equipmentAnimationForLoadout(registries, run.loadout, run.class);
      return Math.max(reaverAttackTiming(speed).totalMs, ...Object.keys(animation?.references || {}).map(role => animationTiming(animation, role, speed)?.totalMs || 0));
    },
    animateActor: (beat, actorEl, speed) => {
      const played = beat.events.find(event => event.type === 'cardPlayed');
      const moved = beat.events.find(event => event.type === 'enemyMoveStarted');
      if (!played && !moved) return null;
      // The pre-dispatch hand snapshot retains Powers removed from every pile,
      // and the full instance carries equipment profile tags and upgrades.
      // Resolve it before falling back to a live pile or bare legacy receipt.
      const playedInstance = played && (disp?.hand.find((card) => card.instanceId === played.cardInstanceId)
        || findInst(played.cardInstanceId) || { cardId: played.cardId });
      const definition = played ? resolveCard(registries, playedInstance)
        : registries.enemies.get(moved.enemyId)?.moves?.[moved.moveId];
      const tags = played && definition
        ? (definition.cardTags?.length ? definition.cardTags : tagService(registries).tagsOf('card', definition))
        : definition?.tags || [];
      const stage = stageFor(actorEl);
      let plan = resolveActionAnimation({
        actorId: played ? run.class : moved.enemyId,
        actionId: played ? played.cardId : moved.moveId,
        tags, type: played?.cardType, intent: moved?.kind,
        availablePoses: stage?.poses || [],
      });
      if (played && definition) {
        const grouped = visualPlans.get(played.cardInstanceId) || resolveCombatAnimation({ ...definition, cardTags: tags }, equippedPieces(registries, run.loadout, run.class), { animation: equipmentAnimationForLoadout(registries, run.loadout, run.class), action: plan });
        const pose = stage?.setRestPose ? grouped.technique : grouped.group === 'attack' ? 'attack1' : grouped.group === 'defend' ? 'guard' : 'idle';
        plan = { ...plan, ...grouped, pose, spriteEffect: combatEffectPlan({ ...definition, cardTags: combatEffectTags(registries,definition) },played), effectEvents: beat.events, targetId: played.targetId || beat.events.find(e=>e.type==='damageDealt')?.targetId };
        actorEl.dataset.actionGroup = grouped.group;
      }
      if (moved && stage?.enemy) {
        const pose = moved.kind === 'attack' ? (['projectile', 'spell'].includes(plan.family) ? 'projectile' : 'attack')
          : moved.kind === 'block' || plan.family === 'guard' ? 'guard' : 'buff';
        plan = { ...plan, pose };
      }
      actorEl.dataset.actionFamily = plan.family;
      actorEl.dataset.actionMotion = plan.motion;
      // The painted Reaver sequence remains the specialized attack renderer.
      // Other actors use existing CSS and only sprite poses they actually ship.
      if (beat.actorId !== 'player' || beat.kind !== 'attack' || run.class !== 'reaver') {
        return playFamilyAnimation(actorEl, stage, plan, speed, beat.actorId !== 'player' && beat.kind === 'attack');
      }
      const figure = figureSpec(registries, run.loadout, run.class);
      const eligible = isReaverAttackEligible({
        classId: run.class,
        figure,
        customization: run.customization,
        spritesEnabled: spritesAreEnabled(),
      });
      return eligible && !stage?.animationSetId && !actorEl.querySelector('.painted-outfit') ? playReaverAttack(actorEl, reaverAttackTiming(speed)) : playFamilyAnimation(actorEl, stage, plan, speed);
    },
  };

  let lastDodge = [...(combat.eventLog || [])].reverse().find((event) => event.type === 'dodgeRolled' && event.sourceId === combat.player.id) || null;
  function playFamilyAnimation(actorEl, stage, plan, speed, enemyAttack = false) {
    const tempo = Number.isFinite(plan.tempo) ? Math.min(2, Math.max(0.25, plan.tempo)) : 1;
    const reach = Number.isFinite(plan.reach) ? Math.min(2, Math.max(0.25, plan.reach)) : 1;
    const direction = actorEl.closest('.enemy') ? -1 : 1;
    const authoredTiming = stage?.actionTiming?.(plan.pose, speed);
    const totalMs = plan.family === 'neutral' ? 0 : authoredTiming?.totalMs ?? Math.round(speed.lungeMs * tempo);
    const target = plan.targetId && fxCtx.anchorFor(plan.targetId);
    const effectTargets=combatEffectTargetIds(plan.spriteEffect,plan.effectEvents,combat.player.id).map(id=>fxCtx.anchorFor(id)).filter(Boolean).map(anchor=>anchorLocalBox(fxCtx.layer,anchor));
    const authoredTargets=presentationTargetIds(plan.effectEvents,combat.player.id,plan.spriteEffect?.bindingContext.objectId).map(id=>fxCtx.anchorFor(id)).filter(Boolean).map(anchor=>anchorLocalBox(fxCtx.layer,anchor));
    const cancelEffect=playCombatEffectPlan(fxCtx.layer,anchorLocalBox(fxCtx.layer,actorEl),plan.spriteEffect,{targets:effectTargets,authoredTargets,duration:Math.max(180,totalMs),size:180,actor:actorEl,localBox:anchorLocalBox});
    const actionClass = ['slash', 'thrust', 'strike', 'projectile'].includes(plan.family) ? 'act-attack' : 'act-move';
    const overrides = {
      'animation-duration': totalMs + 'ms',
      '--enemy-attack-duration': totalMs + 'ms',
      '--action-travel': `${direction * 26 * reach}px`,
      '--action-recoil': `${-direction * 12 * reach}px`,
      '--action-tilt': `${direction * 12 * reach}deg`,
      '--action-windup-tilt': `${-direction * 8 * reach}deg`,
      '--action-lift': `${-8 * reach}px`,
    };
    const original = Object.keys(overrides).map((name) => [name, actorEl.style.getPropertyValue(name), actorEl.style.getPropertyPriority(name)]);
    if (totalMs) {
      actorEl.classList.remove(actionClass);
      void actorEl.offsetWidth;
      for (const [name, value] of Object.entries(overrides)) actorEl.style.setProperty(name, value);
      actorEl.classList.add(actionClass);
      // A damaging spell still needs its enemy attack drawing; its motion
      // family remains a cast rather than being changed into a melee lunge.
      if (enemyAttack) actorEl.classList.add('enemy-attack-pose');
      if (plan.pose) stage?.play(plan.pose, totalMs, plan.aura);
    }
    return { totalMs, impactMs: authoredTiming?.impactMs ?? Math.round(totalMs * 0.55), cancel: () => {
      actorEl.classList.remove(actionClass);
      if (enemyAttack) actorEl.classList.remove('enemy-attack-pose');
      for (const [name, value, priority] of original) {
        if (value) actorEl.style.setProperty(name, value, priority);
        else actorEl.style.removeProperty(name);
      }
      cancelEffect();
      stage?.settle();
    } };
  }

  let selected = null; // card instanceId in click-targeting mode
  let selectedFlask = null; // flask slot index awaiting a target
  let selfArm = null; // self/buff card armed for a confirm (keyboard/gamepad)
  let selectedCombatantId = null; // contextual reading selection; never combat targeting
  let heldTurnHand = null;
  let enemyPlayback = false;
  let busy = false; // animating / resolving
  // The fight has resolved and this screen is handing off (see the
  // `combat.result` branch in the settle callback). Its menu is closed from
  // that moment: the run is mid-handoff and nothing the menu offers is sound.
  let fightOver = false;
  let lastTargetId = null; // remember the last enemy aimed at (keyboard/pad QoL)
  let aimScheduled = false; // debounce for the aim-highlight observer
  let handPageCursor = null; // survives focus moving onto Previous/Next itself
  const HAND_PAGE_THRESHOLD = 7;
  const handOverlay = $('.hand-overlay');
  const handPages = [$('.hand-prev'), $('.hand-next')];

  function selectCombatant(id) {
    if (id && !getEntity(combat, id)?.alive) return;
    selectedCombatantId = id;
    selectCombatantInfo(combatEl, id);
  }

  // A blank press dismisses only the floating explanation. The edge inspector
  // is a separately owned Folding Tray and remains until its label is folded.
  combatEl.addEventListener('click', (event) => {
    if (event.target.closest('.combatant, .combatant-inspector-host')) return;
    selectCombatant(null);
  });

  // THE ONE HAND RENDERER (components/hand.js) — the strip, its fan, key
  // hints, the inspect hold, the overlap arm of balance.ui.handLayout and the
  // Law 5 exemption all live there, once, for both surfaces. This screen
  // supplies the viewer half per render (renderHand below): live previewCard
  // entries off the paced snapshot, and wireCardInput as the play wiring.
  // wireCardInput is a hoisted declaration below; cards with no preview
  // (stale playback snapshot on a combat-ending play) render inert.
  const handStrip = mountHand($('.hand'), {
    inspectHold: false,
    reuseCards: true,
    animateArrival: true,
    fitFan: true,
    registries,
    wireCard: (el, entry) => entry.preview ? wireCardInput(el, entry.inst, entry.preview, entry.affordable) : null,
  });

  // WGC11 lists the WGH8 contents: ONE projection (models/PotionContentsModel.js)
  // of the charge flasks and the carried consumables, each carried kind once
  // with its count. A carried entry's Use spends its first slot.
  function potionEntries() {
    const p = combat.player;
    return potionContents({ chargeKinds: CHARGE_FLASK_KINDS, flaskCharges: p.flaskCharges, carried: p.flasks }).entries.map((entry) => (
      entry.category === 'charge'
        ? { entry, def: chargeFlaskDefinition(registries, entry.kind), options: { chargeKind: entry.kind, remaining: entry.count, charges: entry.count, useActionId: entry.useActionId } }
        : { entry, def: registries.flasks.get(entry.flaskId), options: { slot: entry.slots[0], remaining: entry.count, useActionId: entry.useActionId } }
    ));
  }

  // `shortcut` is the flask action a key pressed (flask1..flask3), or the WGH8
  // entry key a Potions mini was tapped for; that entry opens folded out.
  // Found by action or key, not by list position.
  function openPotions(shortcut = null) {
    const opener = $('.combat-potions');
    const entries = potionEntries();
    const shortcutIndex = shortcut == null ? -1 : entries.findIndex((row) => row.options.useActionId === shortcut || row.entry.key === shortcut);
    let shell;
    shell = openModal({ title: 'Potions', size: 'md', className: 'combat-potion-menu', opener, bodyClassName: 'as-pane', body: host => {
      entries.forEach((row, index) => {
        const { def, options, entry } = row;
        const { slot = null, chargeKind = null, remaining, charges } = options;
        const countId = potionCountStringId(entry);
        const canUse = !busy && !combat.result && combat.phase === 'player' && remaining > 0;
        const reason = remaining <= 0 ? 'No charges remaining' : !canUse ? 'Wait for your turn' : '';
        const action = flaskActionPlan({ context: 'combat', canUse, useReason: reason }).actions.find(row => row.id === 'use');
        const use = button({ label: 'Use', disabled: !action.enabled, className: 'potion-use', attrs: { 'aria-label': 'Use ' + def.name } });
        const fold = el('details', { class: 'armoury-card-row potion-fold' });
        if (chargeKind) { fold.dataset.chargeKind = chargeKind; fold.dataset.charges = String(charges); }
        else { fold.dataset.potionSlot = String(slot); fold.dataset.potionCount = String(remaining); }
        const summary = optionCard({ tag: 'summary', name: def.name,
          art: flaskPresentation(def, { showName: false }),
          description: flaskDetailLines(def, { charges }).join(' '),
          meta: t(countId, { count: remaining }), trail: [use], arrow: true });
        const detail = detailCard({ eyebrow: 'Potion', name: def.name + ' details',
          line: def.textTemplate || '', meta: def.targeted ? 'Choose an enemy after Use.' : 'Applies to your character.',
          children: [flavour(tFull(countId, { count: remaining })), reason ? flavour(reason) : null] });
        fold.append(summary, detail);
        const moveUse = () => {
          if (fold.open) {
            for (const sibling of host.querySelectorAll('.potion-fold')) if (sibling !== fold) sibling.open = false;
            detail.appendChild(use);
          } else summary.querySelector('.r-trail').appendChild(use);
        };
        fold.addEventListener('toggle', moveUse);
        use.addEventListener('click', event => { event.stopPropagation(); event.preventDefault(); });
        if (action.enabled) arm(use, 'useFlask', {
          ctx: { targeted: !!def.targeted },
          question: 'Use ' + def.name + '? ' + remaining + ' remaining.', confirmLabel: 'USE',
          onConfirm: () => {
            // Recheck the live combat before committing a menu snapshot.
            if (busy || combat.result || combat.phase !== 'player') return;
            shell.close();
            if (def.targeted) {
              selectedFlask = slot; selected = null; selfArm = null;
              render(); focusTargeting();
            } else useFlask(slot, null, chargeKind);
          },
        });
        host.appendChild(fold);
        if (index === shortcutIndex) { fold.open = true; moveUse(); }
      });
      if (!entries.length) host.appendChild(flavour('No potions carried.'));
    } });
  }

  // Entering targeting mode: move the focus cursor onto an enemy so keyboard /
  // gamepad players confirm a target next, not wander into the top bar. Prefer
  // the last enemy they attacked (if still alive), else the first living one.
  function focusTargeting() {
    const living = combat.enemies.filter((e) => e.alive);
    if (!living.length) return;
    const pref = (lastTargetId && living.find((e) => e.id === lastTargetId)) || living[0];
    focusFirst(`.combatant.enemy[data-eid="${pref.id}"]`);
  }

  // ---- likely-target highlight (SPEC §7.3) ----------------------------------
  // A tinted, slightly-enlarged clone of the prospective target's sprite sits
  // behind it, so the target you're about to hit glows red (an enemy) or blue
  // (self/buff). Follows mouse hover and keyboard/pad focus. Works for the SVG
  // player figure (recolor fills) and emoji-box enemies (solid colored box).
  function clearAim() {
    clearTargetSilhouettes(app);
  }

  function setAim(combatantEl, kind) {
    renderTargetSilhouette(combatantEl, kind);
  }

  // Selection previews every legal target without spending or auto-arming.
  function currentAims() {
    const cardId = $('.hand .card.inspection-selected')?.dataset.instanceId || selected || selfArm;
    const inst = cardId && combat.piles.hand.find(card => card.instanceId === cardId);
    if (inst) {
      if (!inspectionPlayAction(cardId).enabled) return [];
      const def = resolveCard(registries, inst);
      const hostile = (def.effects || []).some(effect => ['enemy', 'allEnemies', 'randomEnemy'].includes(effect.target));
      if (hostile) return combat.enemies.filter(enemy => enemy.alive).map(enemy => ({
        el: combatEl.querySelector(`.combatant.enemy[data-eid="${CSS.escape(enemy.id)}"]`), kind: 'enemy',
      })).filter(target => target.el);
      const legal = friendlyTargetPlan(def, combat.player.id, [
        { id: combat.player.id, alive: combat.player.alive, connected: true },
      ]).legalIds;
      const player = $('.combatant.player');
      return player && legal.includes(combat.player.id) ? [{ el: player, kind: 'self' }] : [];
    }
    if (selectedFlask != null) {
      const el = $('.combatant.enemy.hover-target') || $('.combatant.enemy.gp-focus');
      return el && getEntity(combat, el.dataset.eid)?.alive ? [{ el, kind: 'enemy' }] : [];
    }
    return [];
  }

  function refreshAim() {
    if (combatEl.classList.contains('drag-targeting')) return;
    const want = currentAims();
    const current = [...combatEl.querySelectorAll('.combatant.aiming')];
    if (current.length === want.length && want.every(target => current.includes(target.el)
      && target.el.classList.contains(`aim-${target.kind}`) && target.el.querySelector('.aim-silho'))) return;
    clearAim();
    want.forEach(target => setAim(target.el, target.kind));
  }
  combatEl.addEventListener('cardinspectionselect', event => {
    selectCombatant(null);
    const id = event.target.closest('.hand .card')?.dataset.instanceId;
    if (id && id !== selected && id !== selfArm) {
      selected = null; selectedFlask = null; selfArm = null;
    }
    refreshAim();
  });

  // A DOUSED CARD IS A DISARMED CARD.
  //
  // When a card is armed THROUGH THE INSPECT DOOR, the door lit it in the shared
  // store first, so the store's lit card is combat's `selected`. Empty the store
  // — which every card screen now does on mount, and the mid-fight Armoury is a
  // screen that mounts OVER a live fight — and the store runs that card's
  // `douse`, stripping `inspection-selected`, `inspection-info-visible` AND
  // `selected` and setting `aria-pressed="false"` on the very node the player is
  // looking at. Closing the overlay does not remount combat, so without this the
  // module kept its `selected` while the card had stopped saying so: enemies
  // still wearing `.targetable`, and the next enemy tap committing a card the
  // player could no longer see was armed.
  //
  // THIS WATCH IS NOT SUFFICIENT ON ITS OWN, and an earlier version of this
  // comment claimed otherwise — that `selected` is written in exactly one place.
  // It is not. Arming also happens at the drag/flick `select()`, at the
  // positional card key, and through `armSelf`, and NONE of those light the
  // store. `clearSelection()` returns without notifying when the store is
  // already empty, so on those paths this callback never runs at all. That is
  // why `openCombatArmoury` puts the aim down directly, below, rather than
  // trusting a notification that may not come. This watch remains because it is
  // the only thing that answers the DOUSE — the case where the glass has already
  // changed under an arming that is still live.
  //
  // ONLY THE EMPTY CASE IS HANDLED HERE. A store that moves to a DIFFERENT card
  // is the `cardinspectionselect` listener's business above, and that listener
  // deliberately ignores a lit card outside the hand — lighting a relic does
  // not disarm you. Widening this watcher to every change would take that away.
  // `selectedFlask` is untouched for the same reason: a flask is not a card in
  // the store, so nothing douses it and nothing has gone out of step.
  const releaseSelectionWatch = onSelectionChange((lit) => {
    // A later fight's mount empties the store, and this mount's watch is not
    // released until its observer runs — so an outgoing mount can be notified
    // once after its own DOM is gone. It has nothing left to re-dress.
    if (!combatEl.isConnected || app.querySelector('.combat') !== combatEl) return;
    if (lit !== null || (!selected && !selfArm)) return;
    selected = null;
    selfArm = null;
    // The stage, THEN the sync. `syncCardSelection` dresses what is already
    // drawn; the 1-9 target keycap is not a class it can toggle — `renderEnemies`
    // BUILDS it, gated on `targeting`, so only a repaint can take it away.
    // (`selectedFlask` is deliberately untouched above, and a raised flask keeps
    // `targeting` true, so the repaint is what decides — not this call site.)
    renderCombatantStage();
    syncCardSelection();
  });
  // WGC4: the one writer of the target layer. Selection changes and board
  // rebuilds both land here. render() skips frames whose key is unchanged and
  // only removes classes it added itself, so a highlight toggled on selection
  // used to outlive the play or cancel that ended it.
  function applyTargetLayer() {
    const layer = targetLayer({ armed: !!selected || selectedFlask != null, enemies: combat.enemies });
    combatEl.dataset.targetLayer = layer.active ? 'armed' : 'idle';
    combatEl.querySelectorAll('.combatant.enemy').forEach(enemy => enemy.classList.toggle('targetable', layer.eligibleIds.includes(enemy.dataset.eid)));
  }

  // Selection changes presentation only; every input waits for confirmation.
  function syncCardSelection() {
    const active = selected || selfArm;
    if (active) selectCombatant(null);
    if (!active) combatEl.querySelectorAll('.hand .inspection-selected').forEach(card => { card.classList.remove('inspection-selected', 'inspection-info-visible'); card.removeAttribute('aria-current'); });
    combatEl.querySelectorAll('.hand .card').forEach(card => {
      const on = card.dataset.instanceId === active;
      card.classList.toggle('selected', on);
      card.setAttribute('aria-pressed', String(on));
    });
    const player = $('.combatant.player');
    player?.classList.toggle('armed', !!selfArm);
    if (player) { player.tabIndex = selfArm ? 0 : -1; player.setAttribute('aria-label', selfArm ? 'Play selected card on yourself' : 'Player information'); }
    const def = active && resolveCard(registries, findInst(active));
    player?.classList.toggle('skill-selected', cardKind(def) === 'skill');
    applyTargetLayer();
    setHintMode(active ? 'targeting' : null);
    hideTooltip();
    refreshAim();
  }

  function armSelf(instanceId) {
    selfArm = instanceId;
    selected = null;
    selectedFlask = null;
    syncCardSelection();
  }

  // Land the cursor on the leftmost playable card at the start of your turn —
  // only once the player has actually used keyboard/gamepad (mouse users never
  // get an unrequested focus ring).
  function focusHandDefault() {
    if (!isEngaged() || busy || combat.result || combat.phase !== 'player') return;
    if (selected || selectedFlask != null || selfArm) return;
    if (!focusFirst('.hand .card:not(.unaffordable)')) focusFirst('.hand .card');
  }

  // Display snapshot for paced playback (SPEC §7.4): while a timeline plays,
  // bars/hand render from this pre-dispatch copy, advanced beat by beat, so
  // the HUD updates one actor at a time instead of jumping to the outcome.
  let disp = null;
  let recentArcaneEvents = [];
  const dv = (ent) => (disp && disp.ents[ent.id]) || ent;

  const words = (value) => String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  function statusDetails(entity) {
    const v = dv(entity);
    return Object.entries(v.statuses || {}).flatMap(([statusId, instance]) => {
      if (!instance) return [];
      const amount = instance.meter ? instance.meter.value : instance.stacks;
      if (!(amount > 0)) return [];
      const def = registries.frameworkTerms.withStatusWords(registries.statuses.get(statusId));
      if (!def) return [];
      const presentation = statusInstancePresentation(def, instance);
      return [{ name: def.name, detail: presentation.tooltip }];
    });
  }

  // A move read off its roster row is scaled by the enemy's damageMult (a
  // tier-scaled boss), the same helper the intent, the hit and the move
  // cards read, so the skill list and Previous actions never print authored
  // damage beside a scaled hit.
  function moveDetail(move, preview = null, entity = null) {
    const source = preview || { ...(move || {}), damage: enemyMoveDamage(entity, move) };
    const pieces = [];
    if (source.damage != null) pieces.push(`${source.damage}${source.hits > 1 ? ` × ${source.hits}` : ''} damage`);
    if (source.block != null) pieces.push(`${source.block} Block`);
    for (const effect of move?.effects || []) {
      if (effect.op === 'applyStatus') pieces.push(`applies ${words(effect.status)}`);
      else if (effect.op === 'heal') pieces.push('heals');
      else if (effect.op === 'addCard') pieces.push(`adds ${words(effect.card)}`);
      else pieces.push(words(effect.op));
    }
    return pieces.join(' · ') || words(source.kind || move?.intent || 'Unknown action');
  }

  function combatantSubject(role, entity) {
    const v = dv(entity);
    if (role === 'player') {
      const classDef = registries.classes.get(run.class);
      const abilities = activeCombatAbilities(registries, { ...v, stanceId: entity.stanceId, evade: entity.evade }, Boolean(combat.foundation));
      return {
        role: 'player',
        name: (run.customization?.name || classDef.name).toUpperCase(),
        subtitle: `${classDef.name} · Level ${characterLevel(run)}`,
        resources: inspectorResources([
          { label: 'HP', value: v.hp, max: entity.maxHp },
          { label: 'MP', value: v.mana, max: entity.maxMana },
          { label: 'Poise', value: v.poiseMeter?.value || 0, max: v.poiseMeter?.max || entity.poiseMeter?.max || 0 },
          ...(entity.wardMeter ? [{ label: 'Ward', value: v.wardMeter?.value || 0, max: v.wardMeter?.max || entity.wardMeter.max }] : []),
          ...(entity.ratings ? ['ar', 'dr', 'pr'].map(id => ({ label: id.toUpperCase(), value: ratingValue(combat, entity, id) })) : []),
          { label: 'Block', value: v.block || 0 },
        ], 'player', entity),
        skillLabel: 'Active skills & stance',
        abilities,
        skills: abilities,
        statuses: abilities.filter(row => row.kind !== 'stance'),
        entityId: 'player',
        // No recorded play history, traits or lore for the player yet: unknown.
        history: null, traits: null, lore: null,
      };
    }

    const def = registries.enemies.get(entity.enemyId);
    const intent = previewIntent(combat, entity.id);
    const currentMoveId = intent.moveId;
    const skills = Object.entries(def.moves || {}).map(([moveId, move]) => ({
      name: words(moveId),
      detail: moveDetail(move, moveId === currentMoveId ? intent : null, entity),
      active: moveId === currentMoveId,
    }));
    const current = currentMoveId && def.moves?.[currentMoveId];
    // Previous actions are the moves that RESOLVED (oldest first). movesHistory
    // records rolls, and a roll cancelled by a stagger never happened.
    const past = entity.performedMoves || [];
    return {
      role: 'enemy',
      name: def.name,
      subtitle: (def.tags || []).map(words).join(' · ') || 'Enemy',
      resources: inspectorResources([
        { label: 'HP', value: v.hp, max: entity.maxHp },
        { label: 'Poise', value: v.poiseMeter?.value || 0, max: v.poiseMeter?.max || entity.poiseMeter?.max || 0 },
        ...(entity.wardMeter ? [{ label: 'Ward', value: v.wardMeter?.value || 0, max: v.wardMeter?.max || entity.wardMeter.max }] : []),
        { label: 'Block', value: v.block || 0 },
      ], 'enemy', entity),
      intent: {
        name: currentMoveId ? words(currentMoveId) : words(intent.kind || 'Unknown'),
        detail: moveDetail(current, intent),
        active: true,
      },
      skillLabel: 'Move set',
      moveCards: enemyMoveCards(def, { enemy: entity, preview: intent, registries }),
      skills,
      statuses: statusDetails(entity),
      entityId: entity.id,
      history: past.map((moveId) => ({ name: words(moveId), detail: moveDetail(def.moves?.[moveId], null, entity) })),
      traits: (def.tags || []).map((tag) => ({ name: words(tag) })),
      // No authored lore exists for enemies yet; unknown, not none.
      lore: null,
    };
  }

  /**
   * openCombatantDoor(subject) — THE FULL READ, in the kit's own door
   * (Constantine, 2026-09-04: "no way to expand combatant tooltip to see more
   * details"). The tooltip is the glance: HP, poise, effects. This is the
   * study: pools as Meters, the current intent, the whole move set, every
   * active effect — `combatantDetailBody`, the same sections the edge tray
   * renders, so the two can never drift.
   */
  // W1w preview art: a fresh still from the same asset functions the field uses.
  function inspectorPreviewSprite(subject) {
    if (subject.role === 'player') {
      const figure = figureSpec(registries, run.loadout, run.class);
      return playerSprite(run.customization || {}, run.class, figure.armourId, { animation: equipmentAnimationForLoadout(registries, run.loadout, run.class), view: 'portrait' });
    }
    const enemy = combat.enemies.find((e) => e.id === subject.entityId);
    if (!enemy) return null;
    const def = registries.enemies.get(enemy.enemyId);
    return enemySprite(enemyAppearance[def.id] ? { ...def, id: enemyAppearance[def.id] } : def, { ...dv(enemy), maxHp: enemy.maxHp });
  }

  function openCombatantDoor(subject, opener = document.activeElement) {
    if (!subject?.name) return;
    hideTooltip();
    const done = button({ label: 'Close', role: 'exit', attrs: { 'data-focusable': 'true', title: helpText('close') } });
    const shell = openModal({
      size: 'lg',
      className: 'combatant-door',
      opener,
      eyebrow: subject.subtitle || 'Combatant',
      title: subject.name,
      closeLabel: `Close ${subject.name}`,
      bodyClassName: 'combatant-inspector-body',
      body: (host) => host.replaceChildren(combatantInspectorLayout(subject, { sprite: inspectorPreviewSprite(subject), previewFraction: wireframeUi.inspector.previewFraction })),
      primary: done,
      footSize: 'short',
    });
    done.addEventListener('click', shell.close);
  }

  // Attributes a render can change; a reused frame gets these again without
  // a second set of listeners.
  function refreshCombatantContext(box, subject) {
    box.tabIndex = -1;
    box.dataset.focusable = '';
    box.setAttribute('role', 'button');
    box.setAttribute('aria-label', `Select ${subject.name}`);
    box.setAttribute('aria-pressed', String(selectedCombatantId === box.dataset.eid));
  }
  function wireCombatantContext(box, subject) {
    refreshCombatantContext(box, subject);
    box.addEventListener('focus', () => { if (box.matches(':focus-visible')) selectCombatant(box.dataset.eid); });
    box.addEventListener('gpfocus', event => { if (event.target === box) selectCombatant(box.dataset.eid); });
    box.addEventListener('keydown', event => {
      if (event.target !== box || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); box.click();
    });
  }

  // The snapshot is the PACED state the whole HUD renders from. It must carry
  // every value the board draws, or that layer silently renders post-state
  // while the rest plays back (Sunna's PX gate: meters were missing, so the
  // proc bar blinked out at play time — which reads as "bleed broke" — and
  // the drain animation targeted a bar the re-render had already removed).
  // Statuses and poise ride along; applyBeatToDisp advances them per beat.
  function snapEnt(e, alive) {
    const statuses = {};
    for (const [sid, inst] of Object.entries(e.statuses || {})) {
      statuses[sid] = {
        stacks: inst.stacks,
        duration: inst.duration,
        meter: inst.meter ? { value: inst.meter.value, max: inst.meter.max } : null,
      };
    }
    return {
      id: e.id,
      kind: e.kind,
      hp: e.hp,
      mana: e.mana,
      block: e.block,
      alive,
      statuses,
      stanceId: e.stanceId,
      poiseMeter: e.poiseMeter ? { value: e.poiseMeter.value, max: e.poiseMeter.max } : null,
      wardMeter: e.wardMeter ? { value: e.wardMeter.value, max: e.wardMeter.max } : null,
      arcaneExposure: e.arcaneExposure ? structuredClone(e.arcaneExposure) : undefined,
    };
  }
  function takeSnapshot() {
    const ents = { player: snapEnt(combat.player, true) };
    for (const e of combat.enemies) ents[e.id] = snapEnt(e, e.alive);
    return { ents, hand: [...combat.piles.hand], arcaneEvents: [] };
  }
  function findInst(instanceId) {
    for (const pile of ['hand', 'draw', 'discard', 'exhaust']) {
      const c = combat.piles[pile].find((x) => x.instanceId === instanceId);
      if (c) return c;
    }
    return null;
  }
  function applyBeatToDisp(beat) {
    if (!disp) return;
    for (const e of beat.events) {
      const t = e.targetId && disp.ents[e.targetId];
      switch (e.type) {
        case 'arcaneExposureChanged':
          if (t && t.arcaneExposure) t.arcaneExposure.value = e.value;
          disp.arcaneEvents.push(e);
          break;
        case 'arcaneBreak':
          if (t && t.arcaneExposure) t.arcaneExposure.value = 0;
          disp.arcaneEvents.push(e);
          break;
        case 'arcaneExposureRefused':
          disp.arcaneEvents.push(e);
          break;
        case 'damageDealt':
          if (t) t.block = Math.max(0, t.block - e.blocked);
          break;
        case 'impactDealt':
          if (t && e.poiseMeter) t.poiseMeter = { ...e.poiseMeter };
          break;
        case 'ratingImpact':
          if (t) t[e.meter + 'Meter'] = { value: e.value, max: e.max };
          break;
        case 'hpLost':
          if (t) t.hp = Math.max(0, t.hp - e.amount);
          break;
        case 'healed':
          if (t) t.hp = Math.min(t.hp + e.amount, (getEntity(combat, e.targetId) || {}).maxHp || t.hp + e.amount);
          break;
        case 'blockGained':
          if (t) t.block += e.amount;
          break;
        case 'manaSpent':
          if (disp.ents.player) disp.ents.player.mana = Math.max(0, disp.ents.player.mana - e.amount);
          break;
        case 'manaRestored':
          if (disp.ents.player) disp.ents.player.mana = Math.min(combat.player.maxMana, disp.ents.player.mana + e.amount);
          break;
        case 'enemyDied':
          if (t) {
            t.alive = false;
            t.hp = 0;
          }
          break;
        // ---- meter/status playback (#61, Sunna's PX gate) -------------------
        // Each beat moves the snapshot the way the engine moved the entity, so
        // the bar the player watches fills and drains ON the beat that caused
        // it — not one frame ahead of the whole cascade.
        case 'statusApplied':
          if (t) {
            const cur = t.statuses[e.status] || (t.statuses[e.status] = { stacks: 0, duration: undefined, meter: null });
            const live = getEntity(combat, e.targetId);
            const liveInst = live && live.statuses && live.statuses[e.status];
            if (liveInst && liveInst.meter) {
              // Meter row: `total` is the meter value (getStacks), and the max
              // is whatever the live row carries (constant for proc rows).
              cur.meter = cur.meter || { value: 0, max: liveInst.meter.max };
              cur.meter.max = liveInst.meter.max;
              cur.meter.value = e.total;
            } else {
              cur.stacks = e.total;
              if (liveInst && liveInst.duration != null) cur.duration = liveInst.duration;
            }
          }
          break;
        case 'procBurst':
          // M2b: the drain happens HERE, on the burst beat — the fx code
          // animates the bar to empty and the next render agrees with it.
          if (t && t.statuses[e.status] && t.statuses[e.status].meter) {
            t.statuses[e.status].meter.value = 0;
          }
          // M7: the poise chunk visibly comes FROM the burst. Per-point poise
          // has no event of its own, so the burst's own payload moves it here;
          // any other poise source catches up when playback ends.
          if (t && t.poiseMeter && e.poiseDamage > 0) {
            t.poiseMeter.value = Math.min(t.poiseMeter.max, t.poiseMeter.value + e.poiseDamage);
          }
          break;
        case 'meterFilled':
          if (t && e.meter === 'poise' && t.poiseMeter) t.poiseMeter.value = 0;
          break;
        case 'stanceEntered':
          if (disp.ents.player) disp.ents.player.stanceId = e.stance;
          break;
        case 'statusExpired':
          if (t) delete t.statuses[e.status];
          break;
        case 'cardDrawn': {
          const inst = findInst(e.cardInstanceId);
          if (inst && !disp.hand.some((c) => c.instanceId === inst.instanceId)) disp.hand.push(inst);
          break;
        }
        case 'cardPlayed':
        case 'cardDiscarded':
        case 'cardExhausted': {
          const i = disp.hand.findIndex((c) => c.instanceId === e.cardInstanceId);
          if (i >= 0) disp.hand.splice(i, 1);
          break;
        }
      }
    }
  }

  // ---------- rendering ----------
  function renderCombatantStage() {
    $('.field').dataset.playerCell = combat.player.formationCell || '';
    hideTooltip();
    if (selected || selfArm || selectedFlask != null) selectedCombatantId = null;
    if (selectedCombatantId && selectedCombatantId !== 'player' && !combat.enemies.some((enemy) => enemy.id === selectedCombatantId && enemy.alive)) selectedCombatantId = null;
    renderPlayer();
    renderEnemies();
    battlefieldStage.refresh();
    formationMovement?.refresh();
  }

  function render() {
    renderTopbar();
    renderPotionTray();
    renderCombatantStage();
    renderHand();
    renderControls();
    applyTargetLayer();
    refreshAim(); // re-apply the target glow after the board rebuilds
    // Hint bar context: while aiming, show Confirm/Cancel instead of zone keys.
    setHintMode(selected || selectedFlask != null || selfArm ? 'targeting' : null);
  }
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('shot')) {
    window.__renderCombatForShot = render;
    window.__combatRunForShot = run;
  }

  function renderTopbar() {
    const p = combat.player;
    const pv = dv(p);
    const key = JSON.stringify([p, pv, readSettings()]);
    if (topbarRenderKey === key) return;
    // THE MAIN HUD BAR STACK — HP, MP, SP, vertically. Which rows appear is
    // content/resources.js's business, not this screen's. Player Poise belongs
    // only on the combat character card's model surface; it is deliberately
    // absent from this shared map/combat top HUD.
    const host = $('.topbar .resbars-host');
    if (host) {
      host.innerHTML = '';
      const mainPlan = resourceBarPlan(registries, 'main', pv, p, resDomains);
      host.appendChild(resourceBars(mainPlan, { surface: 'main', tooltipExtra: poiseTip('player') }));
      host.querySelectorAll('[data-tip-attached]').forEach(node => { node.tabIndex = 0; });
    }
    // WGH6: the same relic tile renderer the rooms use (components/relicRail.js);
    // a HUD whose relic layer is off has no rail and draws none.
    mountRelicRail($('.topbar .relics'), registries, p.relicIds);
    // Combat potions live in the bottom menu; the shared map HUD is unchanged.
    // Quick Access no longer carries a charge-flask tray — Crimson and Azure
    // moved into the potion belt — so the tray is looked up optionally rather
    // than assumed present. A missing tray is the expected state, not a fault.
    for (const selector of ['.hud-charge-flasks', '.hud-potions']) {
      const tray = $('.topbar ' + selector);
      if (!tray) continue;
      tray.replaceChildren(); tray.hidden = true;
    }
    $('.topbar .shared-hud')?.setAttribute('data-has-utility-potions', 'false');
    topbarRenderKey = key;
  }

  // THE POTIONS MINIS (owner, 2026-09-14): the WGH8 entries — the charge
  // flasks and the carried consumables, each with its count — as the shared
  // icon tray, hung over the footer Potions control (WGC11) that owns them.
  // The top HUD never draws potions. A tap explains a potion; a second tap (or
  // Enter) opens the Potions list with that potion folded out. The render key
  // lives on the tray, not in a `let`: render() runs before this file's later
  // declarations on the first paint (see `endTurnBeat` above).
  function renderPotionTray() {
    const tray = $('.combat-potion-tray');
    if (!tray) return;
    placePotionTray(tray);
    if (!tray.dataset.placed && typeof ResizeObserver !== 'undefined') {
      tray.dataset.placed = 'true';
      new ResizeObserver(() => placePotionTray(tray)).observe(tray.parentElement);
    }
    const rows = potionEntries().filter((row) => row.def);
    const key = JSON.stringify(rows.map(({ entry }) => [entry.key, entry.count]));
    if (tray.dataset.renderKey === key) return;
    tray.dataset.renderKey = key;
    tray.style.setProperty('--icon-tray-slots', String(wireframeUi.iconTray.footerPotionIcons));
    // Where the tray cannot hold every mini, its +N opens the whole list.
    setIconTrayOverflow(tray, () => openPotions());
    setIconTrayItems(tray, rows.map(({ entry, def }) => trayIcon({
      art: flaskPresentation(def, { showName: false }), count: entry.count, tone: def.tint || '',
      label: `${def.name}, ${tFull(potionCountStringId(entry), { count: entry.count })}`, disabled: entry.count <= 0,
      attrs: { class: 'potion-mini', dataset: { potionKey: entry.key } },
      tip: () => flaskTooltipHtml(def, entry.category === 'charge' ? { charges: entry.count } : {}),
      activate: () => openPotions(entry.key),
    })));
    observeIconTray(tray);
  }

  // Where the Potions control stands in the action row, in the row's local px
  // (offsets, so no zoom arithmetic): the minis' right edge goes on the
  // control's, and on a narrow layout they ride inside its top edge at its
  // width (styles/combat.css reads the three values).
  function placePotionTray(tray) {
    const control = $('.combat-potions');
    const row = tray.offsetParent;
    if (!control || !row || control.offsetParent !== row) return;
    tray.style.setProperty('--potion-tray-right', `${row.clientWidth - control.offsetLeft - control.offsetWidth}px`);
    tray.style.setProperty('--potion-control-top', `${control.offsetTop}px`);
    tray.style.setProperty('--potion-control-width', `${control.offsetWidth}px`);
  }

  // #61 M4 — ONE meter grammar for every threshold-proc row, data-driven so a
  // fourth row needs zero new UI. Display cap is a RULE: at most two proc
  // meters render as bars (the two closest to threshold); the rest collapse
  // to ring-fill pips in the status row — same fill semantics, smaller
  // grammar, independent of how many rows content ships.
  // All three read the PACED view (dv) — the snapshot during playback, the
  // live entity otherwise — so meters move on their own beat (Sunna's gate).
  function procDisplayPlan(entity) {
    const v = dv(entity);
    const live = Object.entries(v.statuses || {})
      .filter(([sid, inst]) => {
        const def = registries.statuses.get(sid);
        return def && def.proc && inst.meter && inst.meter.value > 0;
      })
      .sort((a, b) => b[1].meter.value / b[1].meter.max - a[1].meter.value / a[1].meter.max);
    // WCF2 ordered active stack (models/CombatantStackModel.js): HP, other
    // resources, buildup by fill, stance, icons; at most five rows. Buildup
    // that does not fit joins the icon row as a ring pip.
    const resources = resourceBarPlan(registries, 'model', v, entity, resDomains).map((bar) => bar.id);
    if (entity.kind === 'enemy' && arcaneExposureReceipt(registries, v, disp ? disp.arcaneEvents : recentArcaneEvents)) resources.push('arcaneExposure');
    const icons = Object.entries(v.statuses || {}).filter(([sid, inst]) => {
      const def = registries.statuses.get(sid);
      return def && !(def.proc && (inst.meter ? inst.meter.value : inst.stacks) <= 0);
    }).length;
    // An entity with no HP row (a legacy fixture) keeps the old two-bar split
    // rather than failing the whole combatant render.
    if (!resources.includes('hp')) return { bars: live.slice(0, 2).map(([sid]) => sid), pips: live.slice(2).map(([sid]) => sid), hidden: [] };
    const stack = planCombatantStack({ resources, buildups: live.map(([sid]) => sid), stance: Boolean(entity.stanceId), icons });
    const buildups = new Set(live.map(([sid]) => sid));
    return { bars: stack.bars.filter((id) => buildups.has(id)), pips: [...stack.promoted], hidden: [...stack.hidden] };
  }

  function hasResistAgainst(entity, statusId) {
    return Object.entries(dv(entity).statuses || {}).some(([sid, inst]) => {
      const d = registries.statuses.get(sid);
      return d && d.resists && d.resists.status === statusId && (inst.meter ? inst.meter.value : inst.stacks) > 0;
    });
  }

  /**
   * answerOnTap(el, contentFn) — a tap IS the question on a phone, where
   * `attachTooltip`'s hover clock never runs and its touch route wants a
   * double tap. Without this a tap on a status pip travels to the frame,
   * which answers with a DIFFERENT reading (its own glance) over the top of
   * the one the player asked for. It yields entirely while a card or flask is
   * armed: then a tap on the frame is a play, and swallowing it would make
   * the pips dead patches on a target.
   */
  function answerOnTap(el, contentFn) {
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key) || selected || selectedFlask != null || selfArm) return;
      event.preventDefault(); event.stopPropagation(); el.click();
    });
    el.addEventListener('click', (event) => {
      if (selected || selectedFlask != null || selfArm) return;
      event.stopPropagation();
      showTooltipFor(el, contentFn(), { intent: 'above', align: 'center' });
    });
  }

  function statusRow(entity) {
    // The status row is THE shared icon tray (components/iconTray.js) — the
    // reference the relic rail and the Potions minis inherit: one round Pip per
    // effect, its count a round StatePill on the corner, one row that never
    // wraps. Each meaningful battlefield detail has its own half-second
    // explanation; the frame remains the broader reading when the pointer
    // leaves a detail. A tap explains at once, and yields while a card or flask
    // is armed: then a tap on the frame is a play, and swallowing it would
    // make the pips dead patches on a target.
    const row = iconTray({ label: t('iconTray.status'), attrs: { class: 'statuses' } });
    markUiComponent(row, UI.statusEffectTray, entity.kind);
    const armed = () => !!(selected || selectedFlask != null || selfArm);
    const plan = entity.kind === 'enemy' ? procDisplayPlan(entity) : { bars: [], pips: [] };
    for (const [sid, inst] of Object.entries(dv(entity).statuses || {})) {
      const def = registries.frameworkTerms.withStatusWords(registries.statuses.get(sid));
      const stacks = inst.meter ? inst.meter.value : inst.stacks;
      const presentation = statusInstancePresentation(def, inst);
      // M1's "absent at zero", applied to pips too: a spent proc row (💧0
      // after a burst) is an empty frame, not information (Sunna's S-flag).
      if (def.proc && stacks <= 0) continue;
      const shownValue = def.resists && inst.duration != null ? inst.duration : presentation.valueText;
      const statusTip = () => {
        let extra = '';
        if (inst.meter) extra = `<br>Build-up: ${inst.meter.value} / ${inst.meter.max}`;
        return `<div class="tt-title">${esc(presentation.label)}</div>${esc(presentation.tooltip)}${extra}`;
      };
      const semanticAttrs = statusInstanceSemanticAttrs(presentation);
      const el = trayIcon({
        glyph: def.icon || '?', count: shownValue, tone: def.tint || 'var(--muted)', ring: plan.pips.includes(sid),
        label: semanticAttrs['aria-label'], attrs: { class: 'status-icon' }, tip: statusTip, yieldTap: armed,
      });
      el.setAttribute('data-status-id', semanticAttrs['data-status-id']);
      el.setAttribute('data-status-value-token', semanticAttrs['data-status-value-token']);
      // Collapsed proc meter (M4 display cap): ring-fill pip — the pip's own
      // background is a conic fill in the row's tint, same value/threshold
      // semantics as the bar it stands in for. A resistance pip's number is its
      // countdown (M3 — the receipt reads in turns); every other pip keeps its
      // stack count, and that choice is made where `shownValue` is derived.
      if (plan.pips.includes(sid)) {
        const fillPct = Math.min(100, (inst.meter.value / inst.meter.max) * 100);
        el.classList.add('proc-pip');
        el.style.background = `conic-gradient(${def.tint || 'var(--muted)'} ${fillPct}%, transparent ${fillPct}%)`;
      }
      row.appendChild(el);
    }
    // The final +N tile opens the inspector, which lists every effect.
    // Like the pips, it yields while a card or flask is armed: the tap is a play.
    setIconTrayOverflow(row, (opener) => {
      if (armed()) return false;
      openCombatantDoor(combatantSubject(entity.kind === 'enemy' ? 'enemy' : 'player', entity), opener);
    });
    return row;
  }

  // Stagger's own text, from the status def (data), so a poise tooltip cannot
  // drift from the balance numbers. Passed INTO the renderer rather than known
  // by it — resbars.js must not learn what poise is. Kind-aware since the
  // player grew a vessel (2026-08-14): an enemy's meter fills and staggers; the
  // player's is real-but-empty — its max is true (equipment + relics), and the
  // tooltip says out loud that nothing moves it yet, because a vessel that
  // implies a live mechanic it does not have is the lie the refusal path
  // exists to prevent. When the player-poise mechanics land, this branch is
  // the sentence that must change with them.
  function poiseTip(kind, entity = null) {
    return (bar) => {
      if (['block', 'hp'].includes(bar.id)) return esc(helpText(bar.id));
      if (['mana', 'stamina'].includes(bar.id)) return esc(helpText(bar.id) + (combat.foundation ? helpText('recovery', { amount: combat.foundation.rules.recovery[`${bar.id}PerTurn`] }) : ''));
      if (combat.ratingsRules) {
        const descriptions = { ar: 'Added to physical attack-card damage.', dr: 'Added to physical defensive-skill Block.', pr: 'Added to magical card damage, Block and healing, including power effects.' };
        if (descriptions[bar.id]) return esc(descriptions[bar.id]);
        if (bar.id === 'poise' || bar.id === 'ward') {
          const magical = bar.id === 'ward';
          const loss = combat.ratingsRules.breaks[magical ? 'wardActionLoss' : 'poiseActionLoss'];
          const percent = entity ? Math.round((1 - ratingDamageMultiplier(combat, entity, magical)) * 100) : null;
          return esc(`${magical ? 'Ward' : 'Poise'} resists ${magical ? 'magical' : 'physical'} attacks${percent === null ? '' : ` by ${percent}%`} and configured status effects. The bar fills with impact from hits that pass Block. A full bar causes ${magical ? 'Disruption' : 'Stagger'}: ${kind === 'player' ? `${loss} fewer Actions next turn` : 'lose the next move'}.`);
        }
      }
      if (bar.id !== 'poise') return '';
      if (kind === 'player') {
        return esc(helpText('playerPoise'));
      }
      const staggered = registries.frameworkTerms.statusDisplay('staggered');
      const stagDesc = (staggered && staggered.tooltip) || '';
      return esc(helpText('enemyPoise', { effect: stagDesc }));
    };
  }

  function meterBars(entity, { tooltips = true } = {}) {
    const v = dv(entity);
    const wrap = meters([], { class: 'meters tight' });
    // THE UNDER-MODEL HUD — "should really just show health and poise", his
    // words. Same renderer, same table, different surface: the rows carry which
    // surfaces they appear on, so the two-HUD split he drew is DATA and neither
    // screen decides it. Since 2026-08-14 that sentence is true of the player
    // too: the player entity carries the real-but-empty vessel, so his strip
    // shows health and poise exactly as the enemies' do — and a zero-threshold
    // entity still refuses (no meter → ABSENT).
    // Resources the WCF2 stack could not fit stay readable in the inspector.
    const stackHidden = new Set(entity.kind === 'enemy' ? procDisplayPlan(entity).hidden : []);
    const plan = resourceBarPlan(registries, 'model', v, entity, resDomains).filter((bar) => !stackHidden.has(bar.id));
    const bars = resourceBars(plan, { surface: 'model', tooltipExtra: poiseTip(entity.kind, entity), tooltips });
    for (const bar of plan) {
      const el = bars.querySelector(`[data-res="${bar.id}"]`);
      if (!el) continue;
      if (tooltips) el.tabIndex = 0;
      if (bar.id === 'hp') markUiComponent(el, UI.healthStatusBar, entity.kind);
      if (bar.id === 'poise') markUiComponent(el, UI.poiseStatusBar, entity.kind);
    }
    // The 0.75 pulse is a per-row display rule, not a resource fact; it stays
    // on this screen rather than moving into the shared renderer.
    for (const bar of plan) {
      if (bar.id === 'poise' && bar.cur >= bar.max * 0.75) {
        const el = bars.querySelector('.as-meter[data-res="poise"]');
        if (el) el.classList.add('pulse', 'full');
      }
    }
    while (bars.firstChild) wrap.appendChild(bars.firstChild);
    if (entity.kind === 'enemy') {
      const arcane = stackHidden.has('arcaneExposure') ? null : renderArcaneExposure(registries, v, disp ? disp.arcaneEvents : recentArcaneEvents, { tooltips });
      if (arcane) wrap.appendChild(arcane);
      // #61 M1/M4: the shipped bleedbar, generalized into the one grammar —
      // a thin bar per threshold-proc row (max two, procDisplayPlan's cap),
      // tint + glyph nub from the row's own data, absent at zero. Numbers
      // live in the tooltip; the bar's job is HOW CLOSE, at a glance.
      const plan = procDisplayPlan(entity);
      for (const sid of plan.bars) {
        // v, not entity: the bar is the thing the drain animates, so it must
        // read the paced snapshot like every other meter on this card.
        const inst = v.statuses[sid];
        const def = registries.frameworkTerms.withStatusWords(registries.statuses.get(sid));
        // A threshold-proc row is a skinny Meter in the row's own tint, with the
        // row's glyph as its plate — hue is never the only channel. S2: an
        // active resistance stripes the fill, so the state reads without a
        // tooltip.
        const resisted = hasResistAgainst(entity, sid);
        const meterEl = meter({
          id: sid, value: def.icon || '?',
          cur: inst.meter.value, max: inst.meter.max,
          pct: Math.min(100, (inst.meter.value / inst.meter.max) * 100),
          ariaLabel: `${def.name} ${inst.meter.value} of ${inst.meter.max}`,
          attrs: { class: `procbar${resisted ? ' resisted' : ''}`, style: { '--meter-tone': def.tint || 'var(--muted)' } },
          trackAttrs: { class: 'bar procbar-track', dataset: { status: sid } },
        });
        meterEl.dataset.status = sid;
        markUiComponent(meterEl, UI.procStatusBar, sid);
        // A proc bar is a status row: it answers for itself like the pips.
        const procTip = () => `<div class="tt-title">${esc(def.name)}</div>${inst.meter.value} / ${inst.meter.max}. ${esc(statusTooltipText(def))}`;
        attachTooltip(meterEl, procTip);
        answerOnTap(meterEl, procTip);
        wrap.appendChild(meterEl);
      }
    }
    // WCM0: each row names its kind; the configured kinds wait for selection.
    for (const row of wrap.children) {
      markMeterRow(row, row.dataset.res === 'hp' ? 'hp' : row.classList.contains('procbar') ? 'buildup' : 'resource');
    }
    return wrap;
  }

  function markMeterRow(node, kind) {
    node.dataset.meterRow = kind;
    if (meterRowSelectedOnly(kind)) node.dataset.selectedOnly = 'true';
    return node;
  }

  // Block is a StatePill in the frost tone, filled: a number a player reads off
  // the sprite at a glance.
  function blockBadge(entity, { tooltips = true } = {}) {
    const v = dv(entity);
    if (v.block <= 0) return null;
    const b = pill({ label: String(v.block), round: true, attrs: { class: 'block-badge solid lg' } });
    markUiComponent(b, UI.blockBadge);
    if (tooltips) attachTooltip(b, () => `<div class="tt-title">Block ${v.block}</div>${esc(helpText('block'))}`);
    return b;
  }

  function bindAbilityBadge(chip, entity, abilityId) {
    const ability = () => activeCombatAbilities(registries, entity, Boolean(combat.foundation)).find(row => row.id === abilityId);
    chip.classList.add('combat-ability-badge');
    chip.tabIndex = 0;
    chip.setAttribute('role', 'button');
    chip.setAttribute('data-focusable', 'true');
    chip.setAttribute('aria-haspopup', 'dialog');
    chip.setAttribute('aria-label', `Inspect active skills and effects: ${ability()?.name || chip.textContent}`);
    attachTooltip(chip, () => {
      const row = ability();
      return row ? `<div class="tt-title">${esc(row.name)}</div><p>${esc(row.detail)}</p><p>Click or tap to inspect all active skills and effects.</p>` : '';
    }, { intent: 'above', align: 'center' });
    const inspect = event => {
      if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      openCombatantDoor(combatantSubject('player', entity), chip);
    };
    chip.addEventListener('click', inspect);
    chip.addEventListener('keydown', inspect);
  }

  let playerArtKey = null;
  let playerRenderKey = null;
  let topbarRenderKey = null;
  let handRenderKey = null;
  const enemyFrames = new Map();

  function renderPlayer() {
    const zone = $('.player-zone');
    const p = combat.player;
    const figure = figureSpec(registries, run.loadout, run.class);
    const animation = equipmentAnimationForLoadout(registries, run.loadout, run.class);
    const artKey = JSON.stringify([run.class, run.customization, figure.armourId, animation?.setId, animation?.grip, spritesAreEnabled(), document.documentElement.dataset.performance]);
    const existing = artKey === playerArtKey ? zone.querySelector('.combatant.player') : null;
    const renderKey = JSON.stringify([artKey, p, dv(p), run.attributes, run.loadout, selfArm, lastDodge, playerRest, readinessOrder, readSettings()]);
    if (existing && playerRenderKey === renderKey) return;
    if (!existing) { stageFor(zone)?.dispose?.(); zone.replaceChildren(); }
    playerArtKey = artKey;
    if (isReaverAttackEligible({
      classId: run.class,
      figure,
      customization: run.customization,
      spritesEnabled: spritesAreEnabled(),
    })) preloadReaverAttackFrames();
    const trailing = [];
    if (p.stanceId) {
      const st = registries.frameworkTerms.withStanceWords(registries.stances.get(p.stanceId));
      // The stance is a StatePill in its own tone — ember by default, frost for
      // Bulwark, which is the stance's own colour and not this screen's.
      const chip = pill({
        label: st.name,
        attrs: { class: `stance-chip lg ${p.stanceId}`, dataset: { tone: p.stanceId === 'bulwark' ? 'frost' : 'ember' } },
      });
      if (st.icon) chip.prepend(glyph(st.icon, { class: 'ic' }));
      bindAbilityBadge(chip, p, p.stanceId);
      // WCM4: in formation the chip is the stance strip, after the buildup rows.
      markMeterRow(chip, 'stance');
      trailing.push(chip);
    }
    trailing.push(statusRow(p));
    if (combat.foundation && p.evade > 0) {
      const chip = pill({ label: `Evade ${p.evade}`, attrs: { class: 'foundation-evade' } });
      bindAbilityBadge(chip, p, 'evade');
      trailing.push(chip);
    }
    if (lastDodge) {
      const receipt = dodgeReceipt(lastDodge);
      const outcome = button({ label: receipt.outcome, className: 'dodge-receipt', attrs: {
        'data-focusable': 'true', 'aria-label': receipt.outcome + '. View last Dodge result',
      } });
      outcome.addEventListener('click', (event) => {
        event.stopPropagation();
        openModal({ title: 'Last Dodge result', size: 'sm', opener: outcome, bodyClassName: 'as-pane', body: (host) => {
          const text = document.createElement('p');
          text.className = 'as-prose';
          text.textContent = receipt.detail;
          host.appendChild(text);
        } });
      });
      trailing.push(outcome);
    }
    const slots = {
      role: 'player',
      entityId: 'player',
      leading: [combatantInfo(combatantSubject('player', p).name, opener => openCombatantDoor(combatantSubject('player', p), opener))],
      classNames: [selfArm ? 'armed' : '', selectedCombatantId === 'player' ? 'context-selected' : ''],
      sprite: existing ? null : playerSprite(run.customization || {}, run.class, figure.armourId, { animation }),
      blockBadge: blockBadge(p),
      name: markMeterRow(labelStack({ label: run.customization?.name || runClassIdentity(registries, run).name, attrs: { class: 'nm' } }), 'name'),
      meters: meterBars(p),
      trailing,
    };
    const box = existing ? updateCombatantFrame(existing, slots) : combatantFrame(slots);
    // A reused frame keeps its listeners; only the per-render attributes move.
    if (existing) refreshCombatantContext(box, combatantSubject('player', p));
    else wireCombatantContext(box, combatantSubject('player', p));
    // When a self/buff card is armed, the player is a confirmable target.
    // Publish that temporary target through the same unified focus door as an
    // enemy target. Without this, armSelf() asks focusFirst() for the player,
    // focusFirst() correctly refuses the non-focusable frame, and the cursor
    // remains on the card: a second controller Confirm then toggles the card
    // off instead of committing it.
    if (selfArm) {
      const armedInst = findInst(selfArm);
      const armedDef = armedInst ? resolveCard(registries, armedInst) : null;
      const playerName = combatantSubject('player', p).name;
      box.dataset.focusable = '';
      box.tabIndex = -1;
      box.setAttribute('role', 'button');
      box.setAttribute('aria-label', `Confirm ${armedDef?.name || 'selected card'} on ${playerName}`);
    }
    if (!existing) box.addEventListener('click', (event) => {
      event.stopPropagation();
      if (selfArm) playCard(selfArm, null);
      else selectCombatant('player');
    });
    if (!existing) zone.appendChild(box);
    stageFor(box)?.setRestPose?.(resolveCombatPose(dv(p), playerRest, readinessOrder), { immediate: !existing });
    playerRenderKey = renderKey;
  }

  // The intent is one StatePill in the fact's own tone, glyph first — the kit's
  // `pill.lg` (uiContent.js intentBadge picks the tone and the words).
  function intentEl(enemy) {
    return combatantIntent(previewIntent(combat, enemy.id), () => {
      const intent = combatantSubject('enemy', enemy).intent;
      return `<div class="tt-title">Intent: ${esc(intent.name)}</div>${esc(intent.detail)}`;
    });
  }

  function renderEnemies() {
    const row = $('.enemy-row');
    const present = new Set(combat.enemies.map(enemy => enemy.id));
    for (const [id, record] of enemyFrames) if (!present.has(id)) {
      stageFor(record.box)?.dispose?.(); record.box.remove(); enemyFrames.delete(id);
    }
    const targeting = selected || selectedFlask != null;
    // WGC4: one eligibility home; a defeated enemy is never highlighted.
    const eligibleTargets = targetLayer({ armed: !!targeting, enemies: combat.enemies }).eligibleIds;
    const living = combat.enemies.filter((e) => e.alive);
    for (const enemy of combat.enemies) {
      const def = registries.enemies.get(enemy.enemyId);
      const artKey = JSON.stringify([def.id, enemyAppearance[def.id], document.documentElement.dataset.performance]);
      let record = enemyFrames.get(enemy.id);
      if (record && record.key !== artKey) { stageFor(record.box)?.dispose?.(); record.box.remove(); record = null; }
      const renderKey = JSON.stringify([artKey, enemy, dv(enemy), combat.player, targeting, selectedCombatantId, living.map(e => e.id), disp ? disp.arcaneEvents : recentArcaneEvents, readSettings()]);
      if (record?.renderKey === renderKey) continue;
      const leading = [];
      // WCO1: Inspect above the intent; the intent shows per the overlay config.
      if (enemy.alive) leading.push(combatantInfo(def.name, opener => openCombatantDoor(combatantSubject('enemy', enemy), opener)), intentVisible('enemy') ? intentEl(enemy) : null);
      // Target-number badge for keyboard targeting (SPEC §7.3).
      if (enemy.alive && targeting) {
        const idx = living.indexOf(enemy);
        // The target number is a Keycap, the same atom every other key wears.
        if (idx < 9) leading.push(keycap(String(idx + 1), { class: 'enemy-key' }));
      }
      // The nameplate is a LabelStack: the name, and under it what kind of
      // thing it is (its stature reads from the frame, so the hint is the tags).
      const nm = labelStack({ label: def.name, attrs: { class: 'nm' } });
      // The name is the way into the full read on touch, where there is no `I`.
      // It stops the frame's own click so tapping the name never plays a card
      // or retargets — the door is a reading, not a move.
      if (enemy.alive) {
        nm.classList.add('nm-inspect');
        nm.setAttribute('role', 'button');
        nm.tabIndex = 0;
        nm.setAttribute('aria-label', `${def.name} — the full read`);
      }
      const openThisRead = (event) => {
        event.stopPropagation();
        if (!getEntity(combat, enemy.id)?.alive) return;
        if (selected) playCard(selected, enemy.id);
        else if (selectedFlask != null) useFlask(selectedFlask, enemy.id);
        else openCombatantDoor(combatantSubject('enemy', enemy));
      };
      nm.addEventListener('click', openThisRead);
      nm.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openThisRead(event);
      });
      const slots = {
        role: 'enemy',
        entityId: enemy.id,
        classNames: [dv(enemy).alive ? '' : 'dead', eligibleTargets.includes(enemy.id) ? 'targetable' : '', selectedCombatantId === enemy.id ? 'context-selected' : ''],
        leading,
        sprite: record ? null : enemySprite(enemyAppearance[def.id] ? { ...def, id: enemyAppearance[def.id] } : def, { ...dv(enemy), maxHp: enemy.maxHp }),
        blockBadge: blockBadge(enemy),
        name: markMeterRow(nm, 'name'),
        meters: meterBars(enemy),
        trailing: [statusRow(enemy)],
      };
      const box = record ? updateCombatantFrame(record.box, slots) : combatantFrame(slots);
      stageFor(box)?.setState?.({ ...dv(enemy), maxHp: enemy.maxHp });
      box.dataset.stature = statureFor(registries, def.id);
      if (!record) {
        wireCombatantContext(box, combatantSubject('enemy', enemy));
        box.addEventListener('click', (event) => {
          event.stopPropagation();
          if (!getEntity(combat, enemy.id)?.alive) return;
          if (selected) playCard(selected, enemy.id);
          else if (selectedFlask != null) useFlask(selectedFlask, enemy.id);
          else {
            selectCombatant(enemy.id);
          }
        });
        box.addEventListener('pointerenter', () => getEntity(combat, enemy.id)?.alive && (selected || selectedFlask != null) && box.classList.add('hover-target'));
        box.addEventListener('pointerleave', () => box.classList.remove('hover-target'));
      }
      box.setAttribute('aria-pressed', String(selectedCombatantId === enemy.id));
      // Frames and their listeners survive death for the defeat animation.
      // Disable descendants too: nameplates/tooltips can opt back into pointer
      // events even when the frame's .dead style disables its own hit area.
      box.inert = !enemy.alive;
      if (!enemy.alive) {
        delete box.dataset.focusable;
        box.removeAttribute('tabindex');
        box.setAttribute('aria-disabled', 'true');
        box.classList.remove('hover-target', 'gp-focus', 'aiming', 'aim-enemy');
        box.querySelectorAll('.aim-silho').forEach(node => node.remove());
      } else {
        refreshCombatantContext(box, combatantSubject('enemy', enemy));
        box.removeAttribute('aria-disabled');
      }
      if (!record) row.appendChild(box);
      enemyFrames.set(enemy.id, { key: artKey, renderKey, box });
    }
  }

  function renderHand() {
    const handList = heldTurnHand || (disp ? disp.hand : combat.piles.hand);
    combatEl.dataset.turn = enemyPlayback ? 'enemy' : 'player';
    $('.turn-ribbon').textContent = enemyPlayback ? 'Enemy Turn' : 'Player Turn';
    $('.hand').inert = busy || enemyPlayback || !!combat.result;
    $('.hand').setAttribute('aria-disabled', String(busy || enemyPlayback || !!combat.result));
    if (heldTurnHand) return; // Preserve the exact last hand face, fan and input focus during playback.
    const key = JSON.stringify([handList, combat.player, combat.enemies, combat.loadout, combat.attributes,
      combat.turn, combat.phase, combat.result, selected, selfArm, readSettings()]);
    if (handRenderKey === key) { syncHandPager(handList); return; }
    handStrip.render({
      cards: handList.map((inst) => {
        // disp.hand is a pre-dispatch snapshot; on a combat-ending play the
        // engine strands the in-flight card in no pile (finishCombat clears the
        // queue), so previewCard can no longer resolve it. Such cards render
        // inert (no preview → no play wiring) instead of letting the throw
        // wedge the timeline (this froze the game on the killing blow).
        let pv = null;
        try {
          if (!heldTurnHand) pv = previewCard(combat, inst.instanceId);
        } catch (e) {
          console.warn('[combat] hand card not previewable (stale snapshot):', inst.instanceId);
        }
        const affordable = !!pv && combat.player.energy >= (pv.costIsX ? 0 : pv.cost) && combat.player.mana >= pv.manaCost && combat.player.stamina >= (pv.staminaCost || 0) && !isUnplayable(inst);
        return { inst, preview: pv, affordable, selected: inst.instanceId === selected || inst.instanceId === selfArm,
          // The surface names itself and hands over its own commit; the
          // verb and its availability sentence come from the service.
          surface: 'combat',
          availability: { play: playAvailability(inst.instanceId) },
          commands: { play: () => inspectionPlayAction(inst.instanceId).play?.() } };
      }),
    });
    syncHandPager(handList);
    handRenderKey = key;
  }

  /**
   * The service asks one question — is this act available, and if not, what
   * is the sentence — so this adapts the resolver below to that answer.
   * `true` when it can be played; the refusal's own words otherwise. The
   * needs-a-target case is AVAILABLE: choosing a target is part of playing it,
   * not a reason it cannot be played, which is what the old caption implied.
   */
  function playAvailability(instanceId) {
    const action = inspectionPlayAction(instanceId);
    return action.enabled ? true : (action.reason || 'This card cannot be played right now.');
  }

  function inspectionPlayAction(instanceId) {
    const unavailable = reason => ({ enabled: false, reason });
    if (!combatEl.isConnected) return unavailable('This combat is no longer active.');
    if (combat.result) return unavailable('Combat has ended.');
    if (busy || combat.phase !== 'player') return unavailable('Wait for your turn.');
    const inst = combat.piles.hand.find(card => card.instanceId === instanceId);
    if (!inst) return unavailable('This card is no longer in your hand.');
    const reason = unplayableReason(inst);
    if (reason) return unavailable(reason);
    const pv = previewCard(combat, instanceId);
    if (combat.player.energy < (pv.costIsX ? 0 : pv.cost) || combat.player.mana < pv.manaCost || combat.player.stamina < (pv.staminaCost || 0)) {
      return unavailable('Not enough resources to play this card.');
    }
    return { enabled: true, needsTarget: pv.needsTarget, play: () => {
      if (!inspectionPlayAction(instanceId).enabled) return;
      if (pv.needsTarget) {
        selected = instanceId; selectedFlask = null; selfArm = null;
        render(); focusTargeting();
      } else playCard(instanceId, null);
    } };
  }

  // Paging exists only when it adds reach. The controls stay mounted so their
  // listeners and identity are stable, but `hidden` removes them from paint,
  // hit testing, the AX tree, and every focus ring at 0-7 cards. The overlay's
  // state is also the one CSS door that reserves their two columns at 8+.
  function syncHandPager(handList) {
    const obscured = veilIsOpen();
    const paging = handList.length > HAND_PAGE_THRESHOLD && !obscured;
    const focusedPage = handPages.find((page) => page.classList.contains('gp-focus') || document.activeElement === page);
    if (!paging && focusedPage) {
      if (obscured) {
        // A standing veil owns input. Do not move its focus behind the modal;
        // only retire the pager cursor that the covered combat no longer owns.
        focusedPage.classList.remove('gp-focus');
      } else {
        const cards = [...app.querySelectorAll('.hand .card')];
        const surviving = cards.find((card) => card.dataset.instanceId === handPageCursor)
          || cards.find((card) => card.classList.contains('selected'))
          || cards[0]
          || null;
        if (surviving) {
          surviving.dataset.pageTarget = '';
          focusFirst('.hand .card[data-page-target]');
          delete surviving.dataset.pageTarget;
        }
      }
      if (document.activeElement === focusedPage) focusedPage.blur();
    }
    handPageCursor = paging ? handPageCursor : null;
    handOverlay.dataset.paging = String(paging);
    handPages.forEach((page) => { page.hidden = !paging; });
  }

  // F1's previous/next controls move the real focus cursor through the real
  // hand. They do not select or play a card; every input reaches this click and
  // the card keeps its existing Confirm semantics.
  function stepHand(delta) {
    if (handOverlay.dataset.paging !== 'true') return;
    const cards = [...app.querySelectorAll('.hand .card')];
    if (!cards.length) return;
    let at = cards.findIndex((card) => card.classList.contains('gp-focus'));
    if (at < 0) at = cards.findIndex((card) => card.classList.contains('selected'));
    if (at < 0 && handPageCursor) at = cards.findIndex((card) => card.dataset.instanceId === handPageCursor);
    const next = at < 0 ? (delta > 0 ? 0 : cards.length - 1) : (at + delta + cards.length) % cards.length;
    handPageCursor = cards[next].dataset.instanceId || null;
    cards[next].dataset.pageTarget = '';
    focusFirst('.hand .card[data-page-target]');
    delete cards[next].dataset.pageTarget;
    cards[next].scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  function unplayableReason(inst) {
    const def = resolveCard(registries, inst);
    if (registries.framework.isUnplayable(def)) return 'This card cannot be played.';
    try { assertFoundationPlayable(combat, def); } catch (error) { return error.message; }
    return '';
  }
  function isUnplayable(inst) { return !!unplayableReason(inst); }

  /** The pulse reports that the player still has an affordable play. */
  function endTurnHasPlayable() {
    const anyPlayable = combat.piles.hand.some((inst) => {
      if (isUnplayable(inst)) return false;
      // The live preview — class-priced dodge costs, Power reductions — the
      // same numbers the badge shows and the engine charges, in all three
      // pools. A card the preview cannot resolve is not a playable card.
      let pv = null;
      try { pv = previewCard(combat, inst.instanceId); } catch (e) { return false; }
      if (pv.needsTarget && !combat.enemies.some(enemy => enemy.alive)) return false;
      const friendly = friendlyTargetPlan(resolveCard(registries, inst), combat.player.id,
        [{ ...combat.player, connected: true }]);
      if (friendly.active && !friendly.legalIds.length) return false;
      return combat.player.energy >= (pv.costIsX ? 0 : pv.cost)
        && combat.player.mana >= pv.manaCost
        && combat.player.stamina >= (pv.staminaCost || 0);
    });
    // No outer Energy gate: a Light dodge costs 0 Actions and 1 Stamina, so a
    // player at 0 Energy with Stamina left still holds a playable card, and
    // the per-card check above already prices every pool.
    return anyPlayable;
  }

  function renderControls() {
    const energy = $('.energy-orb');
    energy.querySelector('.sp-v').textContent = `${combat.player.energy}/${combat.player.energyMax}`;
    energy.setAttribute('aria-label', `Actions ${combat.player.energy} of ${combat.player.energyMax}`);
    // The bound key (or pad button) rides on the End Turn button itself, so the
    // shortcut is discoverable without reading the hint bar. Tracks rebinds.
    const etKey = hasGamepad() ? padLabel('endTurn') || keyLabel('endTurn') : keyLabel('endTurn');
    if ($('.end-turn .et-key')?.textContent !== etKey) $('.end-turn').replaceChildren('End Turn', keycap(etKey, { class: 'et-key' }));
    const hasPlayable = endTurnHasPlayable();
    $('.end-turn').classList.toggle('pulse', hasPlayable);
    $('.end-turn').dataset.confirmReady = String(combat.phase === 'player' && !hasPlayable);

    // The innerHTML above just dropped the HOLD hint on the floor. `refresh()`
    // re-reads the action's state and re-dresses the button — and it is the
    // reason a beat can live on a control its own screen repaints every frame
    // without any screen tracking the dressing.
    if (endTurnBeat) endTurnBeat.refresh();
    $('.end-turn').disabled = busy || enemyPlayback || !!combat.result;
    $('.pile.draw .sp-v').textContent = combat.piles.draw.length;
    const spent = $('.pile.spent');
    const spentHtml = '<span>Discard ' + combat.piles.discard.length + '</span><small>Exhaust ' + combat.piles.exhaust.length + '</small>';
    if (spent.innerHTML !== spentHtml) spent.innerHTML = spentHtml;

    $('.pile.draw').setAttribute('aria-label', `Draw pile, ${combat.piles.draw.length}`);
    $('.pile.spent').setAttribute('aria-label', `Discard ${combat.piles.discard.length}; Exhaust ${combat.piles.exhaust.length}. Open piles`);

  }

  // ---------- input: click-to-target + drag (SPEC §7.3, both modes) ----------
  function wireCardInput(el, inst, pv, affordable) {
    let dragGhost = null;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let gripX = 0;
    let gripY = 0;
    let ghostWidth = 0;
    let ghostHeight = 0;
    let lastConfirmTap = 0;
    let flickStart = null;
    let flickPoints = [];
    const flickRules = registries.balance.ui.touchFlick;
    const dragTargetMode = pv.values.some((value) => value.target === 'allEnemies')
      ? 'all' : pv.needsTarget ? 'single' : 'none';
    // A card whose only legal target is the player has ONE destination, so the
    // drag names it instead of making him aim at it (his words: "dragging a
    // block should default highlight player character since it can only target
    // that character"). #313 asked which "can only target X" means — the
    // card's DECLARED mode or the BOARD'S current legal set. This is the
    // B-side of that A/B: the legal set, taken at drag start from the one
    // home of the rule (model/friendlyTargets.js, friendlyTargetPlan). On a
    // solo board the set is the player for `self` AND for `mixed` (a
    // self+ally card with no ally has exactly one legal target), and the
    // highlight lights only when the set has exactly one member and it is the
    // player — so it can never light a target the release would refuse. The
    // A-side (declared mode only: `self` lights, `mixed` never does) is the
    // shipped behaviour this replaces. Co-op keeps its own aiming.
    const dragDef = resolveCard(registries, inst);
    const friendlyLegal = friendlyTargetPlan(dragDef, combat.player.id, [
      { id: combat.player.id, alive: combat.player.alive, connected: true },
    ]).legalIds;
    const selfOnlyTarget = dragTargetMode === 'none'
      && friendlyTargetMode(dragDef) !== 'none'
      && friendlyLegal.length === 1 && friendlyLegal[0] === combat.player.id;

    const livingEnemyEls = () => [...app.querySelectorAll('.enemy:not(.dead)')];

    const nearestEnemy = (x, y) => nearestFlickTarget(livingEnemyEls()
      .filter(enemy => combat.enemies.some(entity => entity.id === enemy.dataset.eid && entity.alive))
      .map(enemy => {
        const r = enemy.getBoundingClientRect();
        return { id: enemy.dataset.eid, x: r.left + r.width / 2, y: r.top + r.height / 2, enemy };
      }), { x, y })?.enemy || null;

    const showDragAims = (enemies) => {
      const wanted = new Set(enemies);
      const current = [...app.querySelectorAll('.enemy.aiming.aim-enemy')];
      if (current.length === wanted.size
          && current.every((enemy) => wanted.has(enemy) && enemy.querySelector('.aim-silho'))) return;
      clearAim();
      enemies.forEach((enemy) => setAim(enemy, 'enemy'));
    };

    // The blue half of the same one visual the red aim uses (TARGET_COLORS.self,
    // #4d94e0 — friendlyTargets.js). Lit while the drop point is LEGAL, exactly
    // as the enemy aim is, so the highlight and the ghost's verdict never say
    // two different things about the same release.
    //
    // SCOPED TO THE PLAYER'S OWN ZONE, and that is not tidiness — it is the
    // second shape of this function. The first called `clearAim()`, which owns
    // the whole board, and let this branch skip `showDragAims([])` entirely.
    // #198's accepted plant ("non-targeting drag incorrectly paints enemy aim
    // silhouettes") went UNCAUGHT under it: the one line keeping a non-enemy
    // drag from painting enemy silhouettes stopped running for the 54 self-only
    // cards, so the plant armed and nothing exercised it. This aim owns the blue
    // silhouette and nothing else; the clear reuses friendlyTargets.js rather
    // than restating what an aim is made of.
    const showSelfAim = (on) => {
      const want = on ? app.querySelector('.combatant.player') : null;
      const cur = app.querySelector('.combatant.player.aiming.aim-self');
      if ((want && cur === want && cur.querySelector('.aim-silho')) || (!want && !cur)) return;
      clearTargetSilhouettes($('.player-zone'));
      if (want) setAim(want, 'self');
    };

    const clearDragTargeting = () => {
      combatEl.classList.remove('drag-targeting');
      combatEl.removeAttribute('data-drop-state');
      app.querySelectorAll('[data-drop-state]').forEach((node) => node.removeAttribute('data-drop-state'));
      clearAim();
    };

    const beginDragTargeting = () => {
      clearDragTargeting();
      combatEl.classList.add('drag-targeting');
    };

    // Preview and commit share target selection; only release requires flick speed.
    const dropPlan = (event, release = false) => {
      if (!el.isConnected || veilIsOpen() || document.querySelector('.card-inspection-modal')
          || !inspectionPlayAction(inst.instanceId).enabled) return { legal: false, enemies: [] };
      const point = touchPoint(event);
      const verdict = flickStart
        ? flickVerdict(flickStart, point, flickPoints, readSettings(), flickRules) : null;
      const flick = !!verdict?.distanceMet && (!release || verdict.qualifies);
      const under = document.elementFromPoint(point.x, point.y);
      const directEnemy = under?.closest?.('.enemy:not(.dead)');
      if (dragTargetMode === 'single') {
        const enemy = flick ? nearestEnemy(point.x, point.y) : directEnemy;
        return { legal: !!enemy, enemies: enemy ? [enemy] : [], targetId: enemy?.dataset.eid, flick };
      }
      if (dragTargetMode === 'all') {
        const enemies = flick || directEnemy ? livingEnemyEls() : [];
        return { legal: enemies.length > 0, enemies, flick };
      }
      return { legal: flick || !!under?.closest?.('.combatant.player'), enemies: [], flick };
    };
    const updateDropTarget = event => {
      if (!dragGhost) return;
      const plan = dropPlan(event);
      showDragAims(plan.enemies);
      if (selfOnlyTarget) showSelfAim(plan.legal);
      const state = plan.legal ? 'legal' : 'illegal';
      combatEl.dataset.dropState = state;
      dragGhost.dataset.dropState = state;
      const verdict = dragGhost.querySelector('.drop-verdict');
      if (verdict) verdict.textContent = plan.legal ? (plan.flick ? 'FLICK TO PLAY' : 'DROP') : 'NO TARGET';
    };

    el.addEventListener('pointerdown', (ev) => {
      if (busy || !affordable || ev.button !== 0 || ev.isPrimary === false || ev.target.closest('.card-info-button') || veilIsOpen()) return;
      // Mouse, trackpad, pen and touch share the practice area's recognizer.
      flickStart = touchPoint(ev);
      flickPoints = [flickStart];
      startX = ev.clientX;
      startY = ev.clientY;
      const cardBox = el.getBoundingClientRect();
      const localCard = anchorLocalBox(VIEWPORT_ORIGIN, el);
      const localPointer = anchorLocalBox(VIEWPORT_ORIGIN, { left: startX, top: startY, width: 0, height: 0 });
      gripX = localPointer.left - localCard.left;
      gripY = localPointer.top - localCard.top;
      ghostWidth = cardBox.width;
      ghostHeight = ghostWidth * el.offsetHeight / el.offsetWidth;
      // The lifecycle lives in trackGesture (src/ui/gesture.js — #22): capture
      // on the card, pointerId-scoped, and the end handler runs on pointerup
      // AND pointercancel. The old shape — window listeners removed only in
      // onUp — is the one that played a cancelled drag's card on the next tap
      // (Vira's misplay: discard 0->1 from a tap on a DIFFERENT pointerId).
      const onMove = (mv) => {
        recordFlickPoint(flickPoints, touchPoint(mv), flickRules);
        // An OPEN inspect owns this press: a finger drifting while reading an
        // expanded card must not start a drag whose release over the field
        // would PLAY a no-target card — a read must never be able to become a
        // commit. Guarded on 'open' only: while merely pending, a real drag
        // crossing the shared 12 px boundary abandons the inspect in the same
        // event and proceeds here, whichever handler ran first.
        if (el.dataset.inspect === 'open') return;
        if (!dragging && Math.hypot(mv.clientX - startX, mv.clientY - startY) > 12) {
          dragging = true;
          lastConfirmTap = 0;
          el.dispatchEvent(new Event('carddragstart'));
          el.classList.add('drag-source');
          hideTooltip();
          dragGhost = el.cloneNode(true);
          dragGhost.classList.add('card-drag-ghost');
          dragGhost.querySelector('.card-info-button')?.remove();
          dragGhost.setAttribute('aria-hidden', 'true');
          const verdict = document.createElement('span');
          verdict.className = 'drop-verdict';
          verdict.textContent = 'NO TARGET';
          dragGhost.appendChild(verdict);
          // The pointer still owns the established 70x100 grip, but the card is
          // translucent enough that the target beneath it remains readable.
          const bodyZoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
          dragGhost.classList.remove('selected', 'card-drawn', 'drag-source');
          dragGhost.style.cssText = `position:fixed;z-index:600;pointer-events:none;opacity:.8;transform:none;margin:0;zoom:1;width:${ghostWidth / bodyZoom}px;height:${ghostHeight / bodyZoom}px;`;
          document.body.appendChild(dragGhost);
          beginDragTargeting();
        }
        if (dragging && dragGhost) {
          // Container: THE VIEWPORT. The ghost is `position: fixed` and tracks the
          // pointer, so nothing smaller is its bound. EldenSpire#15: `clientX` is
          // visual px and `style.left` is local px, so the ghost ran away from the
          // hand at every zoom but 1.00 — at 1920×1080 it sat 247 local px
          // down-right of the cursor and clipped off the bottom edge, on the exact
          // affordance the first-run tutorial teaches. The grip (70, 100) is
          // unchanged: it was always meant as local px, into a 140×196 card.
          const view = viewportLocalBox();
          const g = anchorLocalBox(VIEWPORT_ORIGIN, dragGhost);
          const at = anchorLocalBox(VIEWPORT_ORIGIN, { left: mv.clientX, top: mv.clientY, width: 0, height: 0 });
          // keep:40, not the whole box — a card dragged to the edge of the screen
          // SHOULD hang over it, the way it does in the hand. What must never
          // happen is the ghost leaving entirely, which is what it did at 1.48.
          const p = clampBox({ left: at.left - gripX, top: at.top - gripY, width: g.width, height: g.height }, view, { keep: 40 });
          dragGhost.style.left = `${p.left}px`;
          dragGhost.style.top = `${p.top}px`;
          updateDropTarget(mv);
        }
      };
      trackGesture(ev, {
        onMove,
        // The decision — cancelled drops nothing, over the hand reorders,
        // a legal drop plays — is finishCardDrag (src/ui/cardDragEnd.js), the
        // unit tests/visibility-resume.test.mjs drives.
        onEnd: (up, info) => finishCardDrag(up, info, {
          teardown: () => {
            clearDragTargeting();
            el.classList.remove('drag-source');
            if (dragGhost) { dragGhost.remove(); dragGhost = null; }
            const wasDragging = dragging;
            dragging = false;
            return wasDragging;
          },
          overHand: (at) => {
            const handBounds = $('.hand').getBoundingClientRect();
            return at.clientY >= handBounds.top && at.clientY <= handBounds.bottom && at.clientX >= handBounds.left && at.clientX <= handBounds.right;
          },
          reorder: (at) => handStrip.reorderAt(inst.instanceId, at.clientX),
          dropPlan: (at) => dropPlan(at, true),
          play: (targetId) => playCard(inst.instanceId, targetId),
        }),
      });
    });

    const select = () => {
      lastConfirmTap = 0;
      selectedFlask = null;
      if (pv.needsTarget || dragTargetMode === 'all') { selected = inst.instanceId; selfArm = null; syncCardSelection(); }
      else armSelf(inst.instanceId);
    };
    const confirm = () => {
      if (busy || !affordable || dragging) return;
      if (selected !== inst.instanceId && selfArm !== inst.instanceId) { select(); return; }
      if (!pv.needsTarget) playCard(inst.instanceId, null);
      else {
        const enemies = combat.enemies.filter(enemy => enemy.alive);
        const target = $('.enemy.hover-target') || $('.enemy.gp-focus');
        if (target) playCard(inst.instanceId, target.dataset.eid);
        else if (enemies.length === 1) playCard(inst.instanceId, enemies[0].id);
        else { focusTargeting(); showTooltipFor(el, '<p>Choose a highlighted enemy to play this card.</p>'); }
      }
    };
    const tap = () => {
      if (busy || dragging) return;
      if (!affordable) {
        const reasons = [];
        const reason = unplayableReason(inst);
        if (reason) reasons.push(reason);
        if (combat.player.energy < (pv.costIsX ? 0 : pv.cost)) reasons.push('Not enough actions.');
        if (combat.player.mana < pv.manaCost) reasons.push('Not enough mana.');
        if (combat.player.stamina < (pv.staminaCost || 0)) reasons.push('Not enough stamina.');
        showTooltipFor(el, '<p>' + esc(reasons.join(' ')) + '</p>');
        return;
      }
      if (selected !== inst.instanceId && selfArm !== inst.instanceId) { select(); return; }
      const now = performance.now();
      if (lastConfirmTap && now - lastConfirmTap <= 350) { lastConfirmTap = 0; confirm(); }
      else lastConfirmTap = now;
    };
    const holdProgress = document.createElement('span');
    holdProgress.className = 'card-hold-progress';
    holdProgress.setAttribute('aria-hidden', 'true');
    el.appendChild(holdProgress);
    return armHold(el, {
      ms: () => affordable ? holdMs(meta.settings || {}, registries.balance.ui.holdConfirm) : 0,
      // A card hold is an alternate input for the same selection flow as a tap,
      // not a delayed second route that silently commits before the player has
      // chosen a target. Paint from pointer-down; crossing the shared movement
      // slop still cancels the hold and lets the drag path below continue.
      onHoldStart: () => { el.dispatchEvent(new CustomEvent('cardholdstart')); },
      onTap: tap, tapOnEarlyRelease: true, tapOnPointerRelease: true,
      onConfirm: () => {
        if (!(holdMs(meta.settings || {}, registries.balance.ui.holdConfirm) > 0)) { tap(); return; }
        if (busy || !affordable || dragging) return;
        // Only a card that asks for ONE enemy waits for the choice. A card
        // that sweeps every enemy has nothing to choose (previewCard reports
        // needsTarget false for it), so a completed hold plays it, as the tap
        // path's confirm always has.
        if (pv.needsTarget) {
          select();
          focusTargeting();
          return;
        }
        playCard(inst.instanceId, null);
      },
    });
  }

  combatEl.addEventListener('click', event => {
    if (event.target.closest('.combatant, button, .card, .as-tip, .modal, input')) return;
    selected = null; selfArm = null; selectedFlask = null;
    syncCardSelection();
  });

  // Cancel targeting with right-click / Esc.
  combatEl.addEventListener('contextmenu', (ev) => {
    if (selected || selectedFlask != null || selfArm) {
      ev.preventDefault();
      selected = null;
      selectedFlask = null;
      selfArm = null;
      render();
    }
  });
  // Keyboard shortcuts (SPEC §7.3): Esc cancels targeting; 1–9 select/play the
  // Nth card (or, while targeting, pick the Nth living enemy); E ends the turn.
  const keyHandler = (ev) => {
    // Self-clean if the combat screen was torn down (e.g. Save & Quit mid-fight)
    // — the listener lives on window, so it must detach when its DOM is gone.
    if (!app.querySelector('.combat')) {
      removeEventListener('keydown', keyHandler);
      return;
    }
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const tag = (ev.target && ev.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    // ANY veil owns input while it stands — not the menu overlay alone. This
    // line read `overlayIsOpen()`, which knew about one of six, so with the
    // draw pile open E ended the turn and the hand went 5 -> 0 under the panel
    // the player was reading. Measured on the draw pile, the discard pile and
    // the in-combat Armoury, both shapes: tools/veil-owns-input.mjs.
    if (veilIsOpen()) return;

    // `I` is Inspect, everywhere: the full read of whatever the player is
    // looking at — the enemy they selected, else themselves (Constantine,
    // 2026-09-04: "no way to expand combatant tooltip to see more details").
    if (ev.key === 'i' || ev.key === 'I') {
      ev.preventDefault();
      const selected = combat.enemies.find((enemy) => enemy.id === selectedCombatantId && enemy.alive);
      openCombatantDoor(combatantSubject(selected ? 'enemy' : 'player', selected || combat.player));
      return;
    }

    // The menu key opens Settings. The legacy Deck/Stats/Relics bindings all
    // land in Armoury now that it owns every run-information surface.
    const armouryAction = actionDestinationForEvent(ev);
    if (matchAction(ev, 'menu')) {
      ev.preventDefault();
      if (onMenu) onMenu('settings');
      return;
    }
    if (armouryAction) {
      ev.preventDefault();
      openCombatArmoury(armouryAction);
      return;
    }

    if (ev.key === 'Escape') {
      combatEl.querySelectorAll('.hand .card.inspection-selected').forEach(card => {
        card.classList.remove('inspection-selected', 'inspection-info-visible');
        card.removeAttribute('aria-current');
      });
      refreshAim();
      if (selected || selectedFlask != null || selfArm) {
        const cancelledSelf = selfArm;
        selected = null;
        selectedFlask = null;
        selfArm = null;
        hideTooltip();
        render();
        const cancelledCard = cancelledSelf
          ? combatEl.querySelector(`.hand .card[data-instance-id="${CSS.escape(cancelledSelf)}"]`)
          : null;
        if (cancelledCard) focusElement(cancelledCard);
        else focusHandDefault();
      }
      if (selectedCombatantId) {
        selectCombatant(null);
      }
      return;
    }
    if (busy || combat.result || combat.phase !== 'player') return;

    if (matchAction(ev, 'endTurn')) {
      ev.preventDefault();
      $('.end-turn').click();
      return;
    }

    // Flask keys open the corresponding potion action menu; they
    // never auto-use.
    for (let slot = 0; slot < 3; slot++) {
      if (matchAction(ev, `flask${slot + 1}`)) {
        ev.preventDefault();
        openPotions(`flask${slot + 1}`);
        return;
      }
    }

    // Positional card keys: 1–9 then Q for the 10th (hand caps at 10). The key
    // is tied to the SLOT, not the card — leftmost is always 1. The key→action
    // mapping lives in cardHotkeyAction (pure, unit-tested in
    // tests/card-hotkeys.test.mjs); this handler only carries it out.
    // Not a card key (null whatever the context): leave the event alone before
    // touching the DOM — this is the last check in the handler.
    if (cardHotkeyAction(ev.key) === null) return;
    const handCards = app.querySelectorAll('.hand .card');
    const livingEnemies = combat.enemies.filter((e) => e.alive);
    const hotkey = cardHotkeyAction(ev.key, {
      targeting: Boolean(selected || selectedFlask != null),
      handSize: handCards.length,
      livingEnemies: livingEnemies.length,
    });
    if (hotkey) {
      ev.preventDefault();
      if (hotkey.kind === 'none') return;
      // Targeting mode: a NUMBER picks the Nth living enemy (Q never targets).
      if (hotkey.kind === 'target') {
        const enemy = livingEnemies[hotkey.index];
        if (selected) playCard(selected, enemy.id);
        else useFlask(selectedFlask, enemy.id);
        return;
      }
      // Selection mode: play the Nth hand card (auto-target a lone enemy).
      const visibleId = handCards[hotkey.index]?.dataset.instanceId;
      const inst = combat.piles.hand.find(card => card.instanceId === visibleId);
      if (!inst) return;
      const pv = previewCard(combat, inst.instanceId);
      const affordable = combat.player.energy >= (pv.costIsX ? 0 : pv.cost) && combat.player.mana >= pv.manaCost && combat.player.stamina >= (pv.staminaCost || 0) && !isUnplayable(inst);
      if (!affordable) return;
      const hostile = pv.needsTarget || pv.values.some(value => value.target === 'allEnemies');
      if (hostile) { selected = inst.instanceId; selfArm = null; selectedFlask = null; syncCardSelection(); }
      else armSelf(inst.instanceId);
      const chosenCard = combatEl.querySelector(`.hand .card[data-instance-id="${CSS.escape(inst.instanceId)}"]`);
      if (chosenCard) focusElement(chosenCard);
    }
  };
  addEventListener('keydown', keyHandler);

  // ---------- actions ----------
  function trackStats(events) {
    for (const e of events) {
      if (e.type === 'damageDealt' && e.sourceId === 'player') run.stats.damageDealt += e.amount;
      if (e.type === 'hpLost' && e.targetId === 'player') run.stats.damageTaken += e.amount;
    }
  }

  function useFlask(slot, targetId, chargeKind = null) {
    if (targetId && !getEntity(combat, targetId)?.alive) return;
    if (busy || combat.result) {
      dlog('ignored', `useFlask slot=${slot}`, { busy, result: combat.result, phase: combat.phase });
      return;
    }
    selectedFlask = null;
    selected = null;
    hideTooltip();
    disp = takeSnapshot();
    let out;
    try {
      out = dispatch(combat, { type: 'useFlask', slot, chargeKind, targetId: targetId || undefined });
    } catch (err) {
      console.warn("[combat] dispatch rejected:", err && err.message);
      dlog('rejected', `useFlask slot=${slot}`, err && err.message);
      disp = null;
      render();
      return;
    }
    dlog('dispatch', `useFlask slot=${slot}${targetId ? ' -> ' + targetId : ''}`, { events: out.events.length });
    sfx.play('flask');
    busy = true;
    afterDispatch(out.events);
  }

  function afterDispatch(events) {
    events = decorateCombatEffects(events, registries, barrierVisuals);
    // Capture definitions while disp still holds consumed Powers and equipment
    // profile instances. Reduce the SAME events on paced and skipped paths.
    appliedVisualEvents = new Set();
    visualPlans = new Map(events.filter(e => e.type === 'cardPlayed').map(event => {
      const instance = disp?.hand.find(card => card.instanceId === event.cardInstanceId) || findInst(event.cardInstanceId) || { cardId: event.cardId };
      const definition = resolveCard(registries, instance);
      const tags = definition.cardTags?.length ? definition.cardTags : tagService(registries).tagsOf('card', definition);
      const hpSpent = events.filter(e => e.type === 'hpLost' && e.targetId === combat.player.id && e.cause !== 'attack' && !String(e.cause).startsWith('proc:')).reduce((n,e)=>n+(e.amount||0),0);
      const action = resolveActionAnimation({ actorId: run.class, actionId: event.cardId, tags, type: event.cardType });
      const animation = equipmentAnimationForLoadout(registries, run.loadout, run.class);
      return [event.cardInstanceId, { aura: resourceAura(definition, { ...event, hpSpent }), ...resolveCombatAnimation({ ...definition, cardTags: tags, sourceArmamentId: instance.sourceArmamentId }, equippedPieces(registries, run.loadout, run.class), { animation, action }) }];
    }));
    // Nothing between here and playTimeline may prevent the timeline from
    // starting: busy is already true, and only the timeline's finish releases
    // it (and fires onEnd on victory/defeat). A render throw here once froze
    // the game permanently on the killing blow.
    try {
      // Skipping or reducing motion must never erase the last result.
      const rolled = [...events].reverse().find((event) => event.type === 'dodgeRolled' && event.sourceId === combat.player.id);
      if (rolled) {
        lastDodge = rolled;
        $('.dodge-announcement').textContent = dodgeReceipt(rolled).detail;
      }
      recentArcaneEvents = events.filter((event) => (
        event.type === 'arcaneExposureChanged' || event.type === 'arcaneExposureRefused' || event.type === 'arcaneBreak'
      ));
      trackStats(events);
      render(); // hand/energy react now; bars render from the pre-dispatch snapshot
    } catch (e) {
      console.warn('[combat] post-dispatch render failed:', e && e.message);
    }
    playTimeline(
      events,
      {
        ...fxCtx,
        onBeatApplied: (beat) => {
          applyVisualEvents(beat.events);
          applyBeatToDisp(beat);
          renderTopbar();
          renderCombatantStage();
          for (const event of beat.events) {
            const reaction = bloodRiteReaction(dv(combat.player), event, 'player');
            if (reaction) stageFor($('.combatant.player'))?.react?.(reaction);
          }
          // The displayed hand (disp.hand) moves only on the four card events
          // applyBeatToDisp handles; every other beat — a hit, a heal, a
          // status — re-rendered every card in the hand for no change. The
          // flush and the terminal callback still render the whole board.
          if (beat.events.some((event) => HAND_BEAT_EVENTS.has(event.type))) renderHand();
          renderControls();
          showPileFeedback(beat.events);
        },
        onFlush: () => {
          applyVisualEvents(events);
          disp = null;
          render();
          clearCardFeedback();
          showPileFeedback(events, false);
        },
      },
      () => {
        applyVisualEvents(events);
        disp = null;
        heldTurnHand = null;
        enemyPlayback = false;
        busy = false;
        render();
        if (combat.result) {
          // THE FIGHT IS OVER, AND SO IS THIS SCREEN'S MENU.
          //
          // The keydown handler already comes off here. The ☰ button did NOT,
          // so for the 350 ms handoff below — plus the victory beat main.js
          // awaits after it (balance.ui.victoryBeat.ms, 600 ms, and the beat's
          // overlay is `pointer-events: none`) — Save, Save & Quit, Load and
          // Quit were all one tap away on a fight that had ALREADY ENDED.
          //
          // Save called commitCombatSnapshot on a combat whose `result` was
          // 'victory': a checkpoint that resumes INTO a won fight, where no
          // dispatch will ever reach the branch that calls onEnd — the run is
          // stuck at a battlefield with nothing left to kill. Quit tore the run
          // down while main.js's continuation was still suspended on the beat,
          // so the spoils were then granted against a null run.
          //
          // There is nothing here a player can usefully ask the menu for: the
          // only thing that happens next is the spoils door. Close it, disable
          // it, and refuse the actions even if something re-opens it.
          fightOver = true;
          closeQuickNav();
          if (menuBtn) { menuBtn.disabled = true; menuBtn.setAttribute('aria-disabled', 'true'); }
          removeEventListener('keydown', keyHandler);
          handStrip.teardown();
          setTimeout(() => onEnd(combat.result, combat), 350);
        } else {
          focusHandDefault(); // land on the leftmost playable card for kb/pad
        }
      }
    );
  }

  // Cosmetic animations never own combat timing or retain interactive clones.
  const cardFlights = new Set();
  function clearCardFeedback() {
    for (const animation of cardFlights) animation.cancel();
    cardFlights.clear();
    app.querySelectorAll('.hand .card.card-drawn').forEach(el => el.classList.remove('card-drawn'));
    $('.pile.spent')?.classList.remove('pile-received');
  }
  function showPileFeedback(events, animate = true) {
    // Ordinary plays enter discard without a separate cardDiscarded receipt.
    // Read their actual destination; Powers and victory plays must not be counted.
    const discardIds = new Set(events.filter(event => event.type === 'cardDiscarded').map(event => event.cardInstanceId));
    for (const event of events) {
      if (event.type === 'cardPlayed' && combat.piles.discard.some(card => card.instanceId === event.cardInstanceId)) discardIds.add(event.cardInstanceId);
    }
    const discarded = discardIds.size;
    const exhausted = events.filter(event => event.type === 'cardExhausted').length;
    if (!discarded && !exhausted) return;
    const pile = $('.pile.spent');
    pile.dataset.cardOutcome = exhausted ? 'exhaust' : 'discard';
    pile.setAttribute('aria-description', [discarded && (discarded + ' discarded'), exhausted && (exhausted + ' exhausted')].filter(Boolean).join('; '));
    if (animate && !reducedMotionRequested()) {
      pile.classList.remove('pile-received');
      void pile.offsetWidth;
      pile.classList.add('pile-received');
    }
  }
  $('.pile.spent').addEventListener('animationend', event => {
    if (event.target === event.currentTarget) event.currentTarget.classList.remove('pile-received');
  });

  // Fly only accepted plays, with one cancellable browser-owned animation.
  function flyCard(instanceId, targetId, events) {
    if (readSettings().showPlayedCard !== true || reducedMotionRequested()) return;
    const cardEl = app.querySelector(`.hand .card[data-instance-id="${instanceId}"]`);
    if (!cardEl || typeof cardEl.animate !== 'function') return;
    const dest = (targetId && fxCtx.anchorFor(targetId)) || fxCtx.anchorFor('player');
    const b = anchorLocalBox(VIEWPORT_ORIGIN, cardEl);
    const t = anchorLocalBox(VIEWPORT_ORIGIN, dest || cardEl);
    const at = clampBox(b, viewportLocalBox(), { keep: 40 });
    const ghost = cardEl.cloneNode(true);
    ghost.classList.add('card-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('inert', '');
    ghost.removeAttribute('id');
    ghost.removeAttribute('tabindex');
    ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    const flight=document.createElement('div');flight.className='card-flight';flight.setAttribute('aria-hidden','true');flight.setAttribute('inert','');
    Object.assign(flight.style,{position:'fixed',left:at.left+'px',top:at.top+'px',width:b.width+'px',height:b.height+'px',zIndex:'700',isolation:'isolate',pointerEvents:'none'});
    Object.assign(ghost.style, { position:'relative',left:'0',top:'0',width:'100%',height:'100%',zIndex:'1',margin:'0',animation:'none',transition:'none',transform:'none' });
    flight.append(ghost);document.body.appendChild(flight);
    const receipt=events?.find(e=>e.type==='cardPlayed'&&e.cardInstanceId===instanceId);
    const instance=disp?.hand.find(c=>c.instanceId===instanceId);
    const definition=instance&&resolveCard(registries,instance);
    const effect=receipt&&definition&&combatEffectPlan({...definition,cardTags:combatEffectTags(registries,definition)},receipt);
    const stopLayers=playCardEffectLayers(flight,effect?.kind,{duration:220});
    const dx = t.left + t.width / 2 - (at.left + b.width / 2);
    const dy = t.top + t.height / 2 - (at.top + b.height / 2);
    const animation = flight.animate([
      { transform: 'translate(0,0)', opacity: 0.85 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.35) rotate(6deg)`, opacity: 0 },
    ], { duration: 220, easing: 'ease-out', fill: 'forwards' });
    cardFlights.add(animation);
    const remove = () => { stopLayers();flight.remove();cardFlights.delete(animation); };
    animation.onfinish = remove;
    animation.oncancel = remove;
  }

  function playCard(instanceId, targetId) {
    if (targetId && !getEntity(combat, targetId)?.alive) return;
    if (busy || combat.result) {
      const why = { busy, result: combat.result, phase: combat.phase };
      console.debug('[combat] playCard ignored:', JSON.stringify(why));
      dlog('ignored', `playCard ${instanceId}`, why);
      return;
    }
    if (targetId) lastTargetId = targetId; // remembered for the next card's aim
    selected = null;
    selectedFlask = null;
    selfArm = null;
    clearAim();
    hideTooltip();
    disp = takeSnapshot();
    let out;
    try {
      out = dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId: targetId || undefined });
    } catch (err) {
      console.warn("[combat] dispatch rejected:", err && err.message);
      dlog('rejected', `playCard ${instanceId}`, err && err.message);
      disp = null;
      render(); // illegal input: show nothing, just resync (ENGINE-API §12)
      return;
    }
    dlog('dispatch', `playCard ${instanceId}${targetId ? ' -> ' + targetId : ''}`, { events: out.events.length, result: combat.result });
    flyCard(instanceId, targetId, out.events);
    sfx.play('cardPlay');
    busy = true;
    afterDispatch(out.events);
  }

  // "SAME WITH ENDING TURN." — Constantine, in the sentence that also asked for
  // the hold, and the half of it that was dropped. It is not wired here by
  // hand: `endTurn` is a row in model/secondbeat.js, and the ruling is that it
  // always takes the configured second beat.
  // Nothing on this line says "hold", and adding a third action to this screen
  // would say even less.
  endTurnBeat = arm($('.end-turn'), 'endTurn', {
    question: 'End your turn and let the enemies act?',
    confirmLabel: 'END TURN',
    onConfirm: () => {
    if (busy || combat.result || combat.phase !== 'player') {
      const why = { busy, result: combat.result, phase: combat.phase };
      console.debug('[combat] endTurn ignored:', JSON.stringify(why));
      dlog('ignored', 'endTurn', why);
      return;
    }
    const finish = (discardIds = []) => {
      if (busy || combat.result || combat.phase !== 'player') return;
      selected = null;
      selectedFlask = null;
      hideTooltip();
      disp = takeSnapshot();
      let out;
      try {
        heldTurnHand = [...disp.hand];
        enemyPlayback = true;
        out = dispatch(combat, { type: 'endTurn', discardIds });
      } catch (err) {
        console.warn("[combat] dispatch rejected:", err && err.message);
        dlog('rejected', 'endTurn', err && err.message);
        heldTurnHand = null;
        enemyPlayback = false;
        disp = null;
        return;
      }
      dlog('dispatch', 'endTurn', { events: out.events.length });
      busy = true;
      afterDispatch(out.events);
    };
    const plan = discardChoicePlan(combat);
    if (plan.prompt) openHandDiscard(registries, plan, finish, $('.end-turn'));
    else finish();
    },
  });
  endTurnBeat.refresh();

  const showDraw = () => openPileModal(registries, 'Draw pile', combat.piles.draw, { shuffleForDisplay: true });
  const showSpent = () => openSpentPileModal(registries, combat.piles, $('.pile.spent'));

  $('.pile.draw').addEventListener('click', showDraw);
  $('.pile.spent').addEventListener('click', showSpent);
  $('.combat-potions').addEventListener('click', () => openPotions());

  // THE BOTTOM ROW SAYS WHAT IT IS (Constantine, 2026-09-04: "no tool tips on
  // bottom row for end turn, draw, end turn, discard and exhaust"). Every
  // other control on this screen carries a tooltip; the five that decide a
  // turn carried none. Counts are read at open time, so the panel is never a
  // stale copy of a number the row already shows.
  for (const { selector, title, message } of tooltipHelp.combatTargets) {
    const node = $(selector);
    node.tabIndex = 0;
    attachTooltip(node, () => `<div class="tt-title">${esc(title)}</div>${esc(helpText(message, {
      className: runClassIdentity(registries, run).name, classDescription: registries.classes.get(run.class).description || '',
      cinders: run.cinders, act: run.actNumber, floor: run.floor, turn: $('.turn-ribbon').textContent,
      instruction: helpText(combatEl.dataset.turn === 'player' ? 'playerTurn' : 'enemyTurn'),
    }))}`);
  }

  function inspectorResources(rows, kind, entity) {
    return rows.map(row => ({ ...row, tooltipHtml: poiseTip(kind, entity)({ id: ({ MP: 'mana', SP: 'stamina' })[row.label] || row.label.toLowerCase() }) }));
  }
  attachTooltip($('.energy-orb'), () => `<div class="tt-title">Actions</div>`
    + `${dv(combat.player).energy ?? combat.player.energy} of ${combat.player.energyMax} left this turn.`
    + `<div class="ti-detail">Playing a card spends its cost. Unspent actions do not carry over.</div>`);
  attachTooltip($('.pile.draw'), () => `<div class="tt-title">Draw pile</div>`
    + `${combat.piles.draw.length} card${combat.piles.draw.length === 1 ? '' : 's'} left to draw.`
    + `<div class="ti-detail">Tap to look through it. When it empties, the discard pile is shuffled back in.</div>`);
  attachTooltip($('.pile.spent'), () => '<div class="tt-title">Discard and Exhaust</div>Separate views and counts. Discard can reshuffle; exhausted cards remain out for this fight.');
  attachTooltip($('.combat-potions'), () => '<div class="tt-title">Potions</div>Choose a healing, mana or carried potion. Only Use spends it.');
  attachTooltip($('.end-turn'), () => `<div class="tt-title">End Turn</div>`
    + (combat.handRules?.retain ? 'Enemies act, then draw while keeping unplayed cards.' : 'Enemies act, then draw a fresh hand.')
    + `<div class="ti-detail">Block expires at the start of your next turn. `
    + `Press <b>${esc(hasGamepad() ? padLabel('endTurn') || keyLabel('endTurn') : keyLabel('endTurn'))}</b>, or hold this.</div>`);
  $('.hand-prev').addEventListener('click', () => stepHand(-1));
  $('.hand-next').addEventListener('click', () => stepHand(1));
  // Settings lives inside the Menu overlay (Settings tab) — one button, one home.
  //
  // Under the quick-nav experiment ☰ opens the list instead. Combat is the
  // screen that MAKES "context-specific" mean something: the draw and discard
  // piles are real destinations that exist nowhere else, and today the only way
  // to them is two small corner targets a thumb has to find.
  // Absent when the WGH0 menu layer is off (models/RunHudLayerModel.js).
  const menuBtn = $('#combat-menu');
  if (onMenu && menuBtn) {
    menuBtn.addEventListener('click', (e) => {
      // A won or lost fight has no menu: see the `combat.result` branch above.
      if (fightOver) return;
      if (quickNavMode() === 'off') return onMenu('settings');
      e.stopPropagation();
      openQuickNav(menuBtn, 'combat', {
        counts: { deck: run.deck.length, draw: combat.piles.draw.length, discard: combat.piles.discard.length },
        hasSave: !!(onSave || onQuit),
        controls: quickControls,
        actions: {
          tab: (id) => onMenu(id),
          inventory: () => openCombatArmoury('rack'),
          character: () => openCombatArmoury('grid'),
          ...(onLoad ? { load: () => onLoad({ returnFocusElement: menuBtn }) } : {}),
          ...(onSave ? { save: saveAction(onSave) } : {}),
          ...(onQuit ? { saveQuit: () => onQuit() } : {}),
          ...(onQuitWithoutSave ? { quit: () => onQuitWithoutSave({ returnFocusElement: menuBtn }) } : {}),
        },
      });
    });
  }

  // Law 3 clause 4 — real tooltips on the two topbar buttons, text from the same
  // MENU table. Armoury is the canonical equipment name in every context.
  {
    const row = (MENU.combat || []).find((r) => r.act === 'armoury');
    if ($('#combat-armoury')) attachTooltip($('#combat-armoury'), () => `<div class="tt-title">${esc(row?.label || helpText('armouryTitle'))}</div>${esc(onArmoury ? helpText('armouryTest') : row?.tip || helpText('armoury'))}`);
    if (menuBtn) attachTooltip(menuBtn, () =>
      `<div class="tt-title">Menu</div>${esc(onArmoury ? 'Test build details and return to build selection.' : quickNavMode() === 'off'
        ? 'Armoury, settings, controls and saving.'
        : 'Everywhere you can go from here.')}`);
  }

  // The Armoury mid-fight is the SAME panel, told it is in combat. Both active
  // set switches and item replacement route through engine intents so Energy,
  // live card piles, resources, Poise, and the combat snapshot stay atomic.
  function openCombatArmoury(request = '') {
    // YOU LEFT THE BATTLEFIELD, SO THE AIM GOES DOWN — all of it, and here
    // rather than in a store watcher, because only ONE of the ways to arm goes
    // through the shared selection store. The positional card key and the
    // drag/flick `select()` write `selected` (or `selfArm`) directly and light
    // nothing, so `clearSelection()` inside the panel finds an empty store,
    // returns without notifying, and no watcher fires. The overlay covers the
    // battlefield either way; on the way back out the enemies were still
    // answering to a tap.
    // BEFORE the `onArmoury` delegation, so the host-routed Armoury (main.js)
    // disarms exactly as the panel mounted from here does — but AFTER the gate
    // below, because a click that opens nothing must take nothing.
    //
    // THE GATE IS NOT JUST `enabled`. It reads `!onArmoury && !enabled` because
    // the two routes answer to different rules: the host's `showArmoury`
    // (main.js) does not consult `balance.equipment.enabled` at all, so with a
    // host handler the Armoury OPENS whatever that flag says, and the aim must
    // go down. Only the locally mounted panel is gated — and when it is shut,
    // this button is inert, so the first version of this disarm silently threw
    // away an armed card, a self-target or a raised flask for a click that did
    // nothing at all. That is strictly worse than the bug it was fixing.
    //
    // This subsumes the old `if (!registries.balance.equipment.enabled) return;`
    // that stood after the delegation: that line was only ever reachable with no
    // `onArmoury`, which is exactly the case this guard now catches earlier.
    if (!onArmoury && !registries.balance.equipment.enabled) return;
    if (selected || selfArm || selectedFlask != null) {
      selected = null;
      selfArm = null;
      selectedFlask = null;
      // THE STAGE HAS TO BE REPAINTED, NOT JUST RE-DRESSED. `syncCardSelection`
      // toggles classes on nodes that already exist; the 1-9 target keycap is
      // not a class. `renderEnemies` APPENDS it to `.combatant-leading` while
      // `targeting` holds, and its renderKey names `targeting`, so the badge
      // only leaves on a repaint. Without this, opening the Armoury put the aim
      // down and left every enemy still wearing its number — while those same
      // number keys had gone back to selecting cards in hand.
      renderCombatantStage();
      syncCardSelection();
    }
    if (onArmoury) return onArmoury();
    const equipView = typeof request === 'string' ? request : '';
    const destination = request && typeof request === 'object' ? request.destination || '' : '';
    const panel = mountEquipment(document.body, {
      registries,
      run,
      meta: { settings: { customization: run.customization, ...(equipView ? { equipView } : {}) } },
      // The attribute cards state THIS fight's hand: its snapshot, which the
      // synthetic `meta` above cannot resolve (Codex, #1294). A fight from
      // before hand rules has no `combat.handRules` and deals from the legacy
      // Draw / handMax; this fallback shows the run's own rows under the
      // current settings — an approximation for an old save, not a regression.
      handRules: combat.handRules || runHandRules(registries, run, readSettings()),
      destination,
      inCombat: true,
      onSwap: (slotId, setIndex) => {
        let out;
        try {
          out = dispatch(combat, { type: 'swapArmament', slotId, setIndex });
        } catch (e) {
          dlog('equip', e.message);
          return e.message; // the panel shows the refusal in place
        }
        sfx.play('cardPlay');
        panel.redraw();
        render();
        afterDispatch(out.events);
      },
      onEquip: (slotId, setIndex, pieceId) => {
        let out;
        try {
          out = dispatch(combat, { type: 'changeEquipment', slotId, setIndex, pieceId });
        } catch (e) {
          dlog('equip', e.message);
          return e.message;
        }
        render();
        afterDispatch(out.events);
        return '';
      },
    });
  }
  $('#combat-armoury')?.addEventListener('click', (event) => openCombatArmoury(event.currentTarget.dataset.equipView || ''));

  render();

  formationMovement = wireFormationMovement($('.field'), {
    readSettings, holdConfig: registries.balance.ui.holdConfirm,
    available: () => !busy && !selected && !selfArm && selectedFlask == null,
    plan: cell => formationMovePlan(combat, cell, readSettings()),
    move: cell => {
      if (busy) return;
      try {
        disp = takeSnapshot();
        const out = dispatch(combat, { type: 'moveCharacter', cell, settings: readSettings() });
        dlog('dispatch', `moveCharacter ${cell}`, { events: out.events.length });
        busy = true;
        afterDispatch(out.events);
      } catch (error) { disp = null; busy = false; dlog('rejected', 'moveCharacter', error.message); render(); }
    },
  });

  // Veils mount beside #app, not inside it. Watch that ownership boundary plus
  // the originating combat mount itself: #app is reused across screens and
  // fights, so finding *a* later `.combat` must never keep this mount's captured
  // pager nodes alive. The marker is a focused lifecycle probe, not a styling
  // hook; teardown removes it before a fresh combat creates its own owner.
  if (document.body && typeof MutationObserver !== 'undefined') {
    const pagerVeilObserver = new MutationObserver(() => {
      if (!combatEl.isConnected || app.querySelector('.combat') !== combatEl) {
        handStrip.teardown();
        stageFor(combatEl.querySelector('.player-zone'))?.dispose?.();
        for (const record of enemyFrames.values()) stageFor(record.box)?.dispose?.();
        enemyFrames.clear();
        removeEventListener('keydown', keyHandler);
        battlefieldStage.release();
        formationMovement?.release();
        combatLayout.release();
        aimObserver?.disconnect();
        releaseSelectionWatch();
        clearCardFeedback();
        pagerVeilObserver.disconnect();
        delete combatEl.dataset.handPagerOwner;
        return;
      }
      syncHandPager([...app.querySelectorAll('.hand .card')]);
    });
    combatEl.dataset.handPagerOwner = 'active';
    pagerVeilObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Keep the target glow in sync with focus/hover: the field's class attributes
  // change as the cursor (gp-focus) or pointer (hover-target) moves; a full
  // render() also re-applies it. Observing attributes only (childList untouched)
  // avoids feedback from our own inserted silhouette node.
  const field = $('.field');
  let aimObserver = null;
  if (field && typeof MutationObserver !== 'undefined') {
    const aimObs = new MutationObserver(() => {
      if (aimScheduled) return;
      aimScheduled = true;
      setTimeout(() => {
        aimScheduled = false;
        if (combatEl.isConnected) refreshAim();
      }, 0);
    });
    aimObs.observe(field, { attributes: true, attributeFilter: ['class'], subtree: true });
    aimObserver = aimObs;
  }
  focusHandDefault();

  // Combat-start events (relic triggers, opening draw) get a quick pass too.
  animateEvents(combat.eventLog.filter((e) => e.type === 'relicTriggered'), fxCtx, () => {});

  // First-run guided callouts (SPEC §9 M4) — once per player, over a live board.
  if (showTutorial) mountTutorial(app, { onDone: () => onTutorialDone && onTutorialDone() });
}
import { equipmentAnimationForLoadout, animationTiming } from '../../model/equipmentAnimation.js';
