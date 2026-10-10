import { enemyActionPose } from '../../model/enemyActionPose.js';
import {mountClassRespec,closeClassRespec,isClassRespecOpen,classRespecOptionName} from '../components/classRespec.js';
import {abilityDraftChoice} from '../../model/abilityDraftReceipts.js';
import {mountCoopProgressionDoor,gateCoopProgressionControls} from '../components/coopProgressionDoor.js';
import { mountInitialClassMastery } from '../components/classMastery.js';
import { registriesForClassMastery } from '../../model/classMasteryRun.js';
import { combatantInfo, combatantIntent, selectCombatantInfo } from '../components/combatantOverhead.js';
import { displayAppearance, onDisplayAppearanceChange } from '../displayAppearance.js';
import { combatantDetailBody } from '../components/combatantInspector.js';
import { activeCombatAbilities } from '../components/combatAbilities.js';
import { enemyMoveCards } from '../../model/enemyMoveCards.js';
import { projectEnemyKnowledge } from '../../model/enemyKnowledgeView.js';
import { combatProfileFor } from '../../model/combatCardProfile.js';
import { coopEnemyIntent, publicCounterIntent } from '../models/CoopIntentModel.js';
import { createStanceLedger } from '../../model/alternativeStance.js';
import { openModal } from '../kit/index.js';
import { cardChoice } from '../../model/cardChoices.js';
import { cardTargetPlan } from '../../model/cardTargets.js';
import { openCardChoiceModal } from '../components/cardChoiceModal.js';
import { ashenBlightBarHtml, openAshenBlightMilestone } from '../components/ashenBlight.js';
import { combatCardView } from '../models/CombatCardView.js';
import { combatSnapshotCardCosts } from '../models/CombatSnapshotCardCosts.js';
import { upcastOptions } from '../../model/upcasting.js';
import { openUpcastChoice } from '../components/upcastChoice.js';
import { wireCoopUpcastControl } from '../components/coopUpcastControl.js';
import { controlGate } from '../../engine/combatStatusControl.js';
import { openDiscardChoiceModal } from '../components/discardChoiceModal.js';
import { openReactionChoiceModal } from '../components/reactionChoiceModal.js';
import { combatEffectForEvent, decorateCombatEffects, combatEffectReceipt, presentationTargetIds } from '../../model/combatEffectEvents.js';
import { statureFor } from '../components/stature.js';
import { combatEffectAngle } from '../combatEffectDirection.js';
import { combatEffectPlan, combatEffectTags, combatEffectTargetIds } from '../../model/combatEffects.js';
import { playCombatEffect, playCombatEffectPlan, clearCombatEffects } from '../combatEffectSprites.js';
// src/ui/screens/coop.js — Forsaken Together thin client (LAN co-op).
//
// Server-authoritative renderer: the launcher owns the run (tools/session.mjs)
// and pushes { t:'state', snapshot } over the lobby socket. This screen never
// mutates game state — it draws the snapshot and sends intents.
//
// Visual parity with solo: it reuses the SAME components and CSS as single-
// player — enemySprite/playerSprite, the shared renderCard, and the .combat /
// .mapscreen shells. The only additions are co-op-specific: a seat per player,
// whose-turn indicators, and the throw/mend affordances.
// The COMBAT board helpers below are snapshot-fed twins of combat.js's private
// ones (kept here so solo combat.js stays untouched) — statusRow, meterBars,
// blockBadge, intentEl. THE HAND IS NO LONGER AMONG THEM.
//
// THE HAND IS NOT A TWIN ANY MORE, AND THAT WAS THE SECOND DEFECT OF THIS
// SHAPE (2026-08-15, the same ruling as the map below, one law later). This
// screen rendered its own `.hand` — the fan and the click, and none of the
// machinery: no inspect hold (the compensating reader for a cramped card), no
// key-hint badges, no reader of `balance.ui.handLayout`, so a co-op player in
// OVERLAP got a hand that paged while the same player's solo hand overlapped —
// two behaviours behind one settings word — and the strip carried an UNSCOPED
// Law 5 exemption naming this collapse as its own debt. It calls
// ui/components/hand.js now, the way its map calls ui/components/mapboard.js.
// Read that file's header: the STRIP is a property of the game, one renderer;
// what is legitimately different per surface enters as PARAMS — the snapshot's
// cards with their spelled-out reasons, and the network door as the play
// wiring. A played card still goes through `send`, never local dispatch.
//
// THE MAP IS NOT A TWIN ANY MORE, AND THAT WAS THE DEFECT. `renderMap` carried
// its own `ROW_H = 46`, its own `y(floor)` and its own `r = boss ? 20 : 15` —
// the literals the solo map derived away from — and imported neither map module,
// so at dev cd3da94 a co-op node was 27 device px against solo's 44.09, the tap
// size setting moved nothing, and there was no camera, no zoom control and no
// honesty note. It calls ui/components/mapboard.js now. Read that file's header:
// the co-op map is the SAME MAP with a second player on it, so the only thing
// this screen supplies is the VIEWER — who `me` is, and what `me` voted for.

import { enemySprite, playerSprite, classGlyph, tintCss } from '../assets.js';
import { playPoseOn, stageFor } from '../services/PoseAnimator.js';
import { resourceAura } from '../combatAura.js';
import { resolveActionAnimation } from '../../model/actionAnimation.js';
import { resolveCombatAnimation, combatRestAfterEvent } from '../../model/combatAnimation.js';
import { resolveCoopPlayedCombatCard } from '../models/PlayedCombatCard.js';
import { combatToolsModel } from '../models/CombatToolsModel.js';
import { mountCombatTools } from '../components/combatTools.js';
import { resolveCombatPose, readinessAfterEvent, bloodRiteReaction } from '../../model/combatPose.js';
import { equippedPieces, figureSpec } from '../../model/loadout.js';
import { tagService } from '../../model/tagService.js';
import { renderCard } from '../components/card.js';
import { mountSmithUpgradeModal } from '../components/smithUpgradeModal.js';
import { smithSelectionModel } from '../models/SmithSelectionModel.js';
import { attachTooltip, hideTooltip, showTooltipFor, esc } from '../components/tooltip.js';
import { iconTray, trayIcon } from '../components/iconTray.js';
import { t } from '../strings.js';
import { ANIM_SPEEDS, getAnimSpeed, anchorLocalBox, clampBox, guardHitFloatParts, playReceiptHaptics, playReceiptSounds, playTimeline } from '../fx.js';
import { combatIntentStance } from '../../model/combatIntentVisibility.js';
import { nodeName, nodeBlurb, actTitle, intentTooltip, statusInstancePresentation, statusInstanceSemanticAttrs } from '../uiContent.js';
import { resolveCard, passiveSum } from '../../model/registries.js';
import { resourceBarPlan, resourceDomains } from '../../model/resources.js';
import { combatVitals } from '../models/StaminaOrbModel.js';
import { resourceBars } from '../components/resbars.js';
import { combatHealthRow } from '../components/combatHealth.js';
import { blockPresentation } from '../../model/blockPresentation.js';
import { renderArcaneExposure } from '../components/arcaneExposure.js';
import { mountMapBoard } from '../components/mapboard.js';
import { combatBackdropHtml } from '../components/environmentArt.js';
import { beatArmer } from '../../framework/optionDecision.js';
import { wireBattlefieldStage } from '../components/battlefieldStage.js';
import { wireCombatLayout } from '../components/combatLayout.js';
import { actionsTipHtml, drawTipHtml, spentTipHtml, POTIONS_TIP_HTML, combatActionRowHtml, combatPotionRows, disposeCombatPotionTray, openCombatPotions, paintCombatActionCounts, renderCombatPotionTray, setPotionRevealTiming } from '../components/combatActionRow.js';
import { resolveTooltipSettings } from '../../model/tooltipSettings.js';
import { battlefieldStageModel } from '../models/BattlefieldStageModel.js';
import { adoptCombatantFrame } from '../components/combatantFrame.js';
import { mountHand } from '../components/hand.js';
import { focusElement, focusFirst, isEngaged, matchAction, setScreenKeyClaim } from '../input.js';
import { decorateFriendlyTarget } from '../components/friendlyTargets.js';
import { cardNeedsEnemyTarget, friendlyTargetPlan } from '../../model/friendlyTargets.js';
import { hudQuickSettingsHtml, wireHudQuickSettings } from '../components/hudQuickSettings.js';
import { hudQuickSettingsModel } from '../models/HudQuickSettingsModel.js';
// THE CHROME IS THE KIT'S: the seat strip is a Dock of Tabs with a Keycap and a
// StatePill, the turn announcement a Banner, the seat line a StatStrip (tinted
// name · energy Chip · state Pill), the party read-out a strip of Meters, the
// action row solo's own footer (components/combatActionRow.js, flasks behind
// its Potions), the arming prompt a DetailCard, every asking scene a
// decision door (pageDoor + decide + OptionCards). Behaviour hooks the
// instruments read (`.coop-seat-tabs`, `.seat-tab`, `.coop-turn-banner`,
// `.coop-seat-name`, `.coop-voteline`, `#coop-*`) ride on
// the kit's parts and draw nothing.
import {
  el, html, button, buttonRow, tab, dock, keycap, pill, chip, statStrip, meter, banner as kitBanner, detailCard,
  kitItem, pageDoor, decide, options, optionCard, flavour, prose, subtitle, blocker, glyph as kitGlyph,
} from '../kit/index.js';

import { configureTooltipGlossary } from '../components/tooltipGlossary.js';
import { clearSelection, litCard } from '../components/cardSelection.js';
import { smithingStoneNote } from '../../model/rewardplan.js';

// LEVEL CARDS (SPEC §15.1) in the co-op spoils and the away-seat catch-up.
// A tap only SELECTS: the pick is written into `picks` (ordinal → card id)
// and rides along with whichever choice closes the spoils; the host picks
// any row left unpicked (tools/session.mjs takeLevelCards), as the solo
// door's auto-collect does. Exported so a test can redraw between the tap
// and the close.

/**
 * A pick store that survives redraws AND seat switches: one entry per key
 * (a seat and the door it is at — `<seat>|reward|…` or `<seat>|catchup|…`),
 * holding that door's offer and its picks. A different offer under the same
 * key starts clean; `retain(keep)` drops every entry whose key no longer
 * names an open door, so a resolved offer's picks do not linger.
 */
export function createLevelCardPicks() {
  const entries = new Map(); // key → { offerId, picks }
  return {
    picksFor(key, offer) {
      const offerId = JSON.stringify((offer && offer.levelCards) || []);
      const entry = entries.get(key);
      if (entry && entry.offerId === offerId) return entry.picks;
      const fresh = { offerId, picks: {} };
      entries.set(key, fresh);
      return fresh.picks;
    },
    retain(keep) {
      for (const key of [...entries.keys()]) if (!keep(key)) entries.delete(key);
    },
    keys: () => [...entries.keys()],
  };
}

/** One titled strip per level-card row; the stored pick is drawn chosen. */
export function levelCardStrips(registries, offer, picks) {
  return (Array.isArray(offer.levelCards) ? offer.levelCards : []).flatMap((row) => {
    const strip = el('div', { class: 'reward-row coop-level-card', dataset: { ordinal: String(row.ordinal) } });
    row.cardIds.forEach((cid) => {
      const card = renderCard(registries, { cardId: cid, upgraded: false }, {});
      card.dataset.cardId = cid;
      card.classList.toggle('is-chosen', picks[row.ordinal] === cid);
      card.addEventListener('click', () => {
        picks[row.ordinal] = cid;
        for (const other of strip.children) other.classList.toggle('is-chosen', other === card);
      });
      strip.appendChild(card);
    });
    return [subtitle(t('reward.levelCard.title')), strip];
  });
}

/**
 * coopReceiptSounds(scene, lastSeq, localSeats?) → the receiptSeq now heard.
 *
 * Plays a combat scene's receipts (tools/session.mjs combatScene digest)
 * through the same sound seams solo uses (fx.js playReceiptSounds: tiered
 * hits, playerHurt, the turn stinger, draw/shuffle/discard). The host's
 * receiptSeq, not object identity, says whether the receipts are new, so a
 * resync or a re-render of the same scene never replays them. A client that
 * has heard nothing yet (lastSeq 0: it just joined or reloaded) hears only the
 * scene the host marks `opening` (the one carrying the setup cues); joining
 * after any action, turn 1 included, replays no history.
 */
export function coopReceiptSounds(scene, lastSeq = 0, localSeats = null, { hapticsOnly = false } = {}) {
  // A FIGHT'S LAST RECEIPTS ride the reward or completion scene that replaced
  // it (session.mjs settleCombat): the card that ended the fight buzzes, as
  // solo's does. Haptics only — the fight's end has never played their sound.
  const final = scene && scene.kind !== 'combat' ? scene.combatReceipts : null;
  if (!scene || (scene.kind !== 'combat' && !final)) return lastSeq;
  const seq = Number((final || scene).receiptSeq) || 0;
  if (seq <= lastSeq) return lastSeq;
  // Haptics are personal: a seat this screen does not play (a LAN teammate)
  // makes sound here, but does not buzz this device. No list = every seat.
  const isLocalPlayer = Array.isArray(localSeats) && localSeats.length ? (id) => localSeats.includes(id) : undefined;
  if (final) { if (lastSeq > 0) playReceiptHaptics(final.events || [], { isLocalPlayer }); }
  else if (lastSeq > 0 || scene.opening === true) (hapticsOnly ? playReceiptHaptics : playReceiptSounds)(scene.events || [], { isLocalPlayer });
  return seq;
}

export function mountCoop(app, { registries, conn, myId, myIds, meta, onSettingsChange, onLeave, bankEnemyKnowledge = null }) {
  clearSelection();
  let disposed = false;
  const releaseAppearance = onDisplayAppearanceChange(app, () => { if (!disposed && snap && !pacing) render(); });
  const banking = new Set();
  const bankFailures = new Map();
  const bankAttempts = new Map();
  async function bankOwnedLearning(snapshot) {
    if (!bankEnemyKnowledge || disposed) return;
    for (const member of snapshot.party || []) {
      const signature = JSON.stringify(member.enemyKnowledgeState?.pending);
      if (!(myIds || [myId]).includes(member.id) || banking.has(member.id) || !Object.keys(member.enemyKnowledgeState?.pending?.enemies || {}).length || bankAttempts.get(member.id) === signature) continue;
      banking.add(member.id);
      const pending = structuredClone(member.enemyKnowledgeState.pending);
      try {
        const learningRun = { enemyKnowledgeState: structuredClone(member.enemyKnowledgeState) };
        const result = await bankEnemyKnowledge(learningRun);
        if (disposed) return;
        if (result.ok) { bankAttempts.set(member.id, signature); bankFailures.delete(member.id); conn.send({ t: 'knowledgeBanked', as: member.id, receipts: pending }); }
        else {
          bankFailures.set(member.id, JSON.stringify(learningRun.enemyKnowledgeState.pending));
          bankAttempts.set(member.id, JSON.stringify(learningRun.enemyKnowledgeState.pending));
          conn.send({ t: 'knowledgeBankFailed', as: member.id, recovery: { pending: learningRun.enemyKnowledgeState.pending, recoveryTargets: learningRun.enemyKnowledgeState.recoveryTargets } });
          if (snap) render();
        }
      } catch (error) {
        if (!disposed) { bankFailures.set(member.id, error.message || t('knowledge.save.pending')); if (snap) render(); }
      } finally { banking.delete(member.id); }
    }
  }
  // A SPENT BEAT BELONGS TO THE SCREEN THAT SPENT IT. cardSelection is a
  // page-wide store, and nothing in production ever emptied it — so a card
  // whose `i` had been read kept its first beat for the life of the page, and
  // meeting the same logical id on a later surface handed that surface a card
  // already one beat in: its first touch acted instead of selecting.
  configureTooltipGlossary(registries);
  const resourceDomainTable = resourceDomains(registries);
  const arm = beatArmer(meta, registries);
  let snap = null;
  // Couch co-op: this screen may control several seats; `me` is the ACTIVE one.
  let seats = (myIds && myIds.length ? myIds : [myId]).slice();
  let seatIdx = 0;
  let me = seats[0];
  let combatantDoor = null;
  function closeCombatantDoor() {
    combatantDoor?.close();
    combatantDoor = null;
  }
  let selectedEnemy = null;
  let selectedCombatantId = null;
  function selectCombatant(id) {
    if (id && armedFriendlyCard && snap?.scene.kind === 'combat') {
      const actor = snap.scene.players.find(player => player.id === me);
      const card = actor?.hand.find(entry => entry.instanceId === armedFriendlyCard);
      if (!card || !friendlyTargetPlan(cardDef(card), me, snap.scene.players).legalIds.includes(id)) return;
    }
    selectedCombatantId = id;
    selectCombatantInfo(app, id);
  }
  function wireCombatantContext(box, name) {
    box.tabIndex = -1;
    box.dataset.focusable = '';
    box.setAttribute('role', 'button');
    if (!box.hasAttribute('aria-label')) box.setAttribute('aria-label', `Select ${name}`);
    box.classList.toggle('context-selected', selectedCombatantId === box.dataset.eid);
    box.setAttribute('aria-pressed', String(selectedCombatantId === box.dataset.eid));
    box.addEventListener('focus', () => { if (box.matches(':focus-visible')) selectCombatant(box.dataset.eid); });
    box.addEventListener('gpfocus', event => { if (event.target === box) selectCombatant(box.dataset.eid); });
    box.addEventListener('keydown', event => {
      if (event.target !== box || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); box.click();
    });
  }
  const dismissCombatant = event => {
    if (!event.target.closest('.combatant, .hand, .combatant-door, .modal')) selectCombatant(null);
  };
  const inspectCard = () => selectCombatant(null);
  app.addEventListener('click', dismissCombatant);
  app.addEventListener('cardinspectionselect', inspectCard);
  let armedFlask = null; // non-offensive flask slot awaiting a throw seat
  let armedFriendlyCard = null; // friendly-targeted card instanceId awaiting a legal seat
  const upcastTiersByCard = new Map();
  const upcastKey = instanceId => `${me}:${instanceId}`;
  let prevCombat = null; // last combat scene, for snapshot-diff FX
  const combatRests = new Map();
  const heldStances = createStanceLedger();
  const readinessOrders = new Map();
  let posePresentations = new Map();
  let poseReactions = new Map();
  let animationReceiptSeq = 0;
  let pendingAnimations = new Map();
  const barrierVisuals = new Map();
  let effectEvents = [];
  function prepareCombatAnimations(scene) {
    pendingAnimations = new Map();
    poseReactions = new Map();
    const seq = Number(scene.receiptSeq) || 0;
    if (seq <= animationReceiptSeq) return;
    animationReceiptSeq = seq;
    effectEvents = decorateCombatEffects((scene.events || []).map(combatEffectReceipt), registries, barrierVisuals);
    for (const event of scene.events || []) {
      if (event.targetId) {
        const targetId = event.targetId === 'player' ? event.playerId : event.targetId;
        const targeted = { ...event, targetId };
        readinessOrders.set(targetId, readinessAfterEvent(readinessOrders.get(targetId) || [], targeted, targetId));
        const reaction = bloodRiteReaction(scene.players.find(p => p.id === targetId), targeted, targetId);
        if (reaction) poseReactions.set(targetId, [...(poseReactions.get(targetId) || []), reaction]);
      }
      const ownerId = event.playerId;
      if (!ownerId) continue;
      const member = snap.party.find(member => member.id === ownerId);
      let plan;
      if (event.type === 'cardPlayed' && member) {
        const definition = resolveCoopPlayedCombatCard(registries, snap, event);
        const tags = definition.cardTags?.length ? definition.cardTags : tagService(registries).tagsOf('card', definition);
        heldStances.accept(event, { ...definition, cardTags: tags });
        const action = resolveActionAnimation({ actorId: member.classId, actionId: event.cardId, tags, type: event.cardType });
        const animation = equipmentAnimationForLoadout(registries, member.loadout, member.classId);
        plan = resolveCombatAnimation({ ...definition, cardTags: tags, animationTags: combatEffectTags(registries, definition), sourceArmamentId: definition.sourceArmamentId || event.sourceArmamentId }, equippedPieces(registries, member.loadout, member.classId), { animation, classId: member.classId, appearance: displayAppearance(), combatExpansionVersion: scene.players.find(player => player.id === ownerId)?.combatExpansionVersion || 1, action });
        const hpSpent = (scene.events || []).filter(e => e.type === 'hpLost' && e.targetId === ownerId && e.cause !== 'attack' && !String(e.cause).startsWith('proc:')).reduce((n,e)=>n+(e.amount||0),0);
        plan.aura = resourceAura(definition, { ...event, hpSpent });
        plan.spriteEffect=combatEffectPlan({...definition,cardTags:combatEffectTags(registries,definition)},event);plan.targetId=event.targetId;plan.effectEvents=effectEvents;
        pendingAnimations.set(ownerId, plan);
      }
      combatRests.set(ownerId, combatRestAfterEvent(combatRests.get(ownerId) || 'idle', event, ownerId, plan));
      if (event.type === 'playerTurnStart') { pendingAnimations.delete(ownerId); heldStances.accept(event); }
    }
  }
  let pacing = false; // an enemy-turn replay is holding the render
  let pendingSnaps = []; // every unrendered authoritative frame, causal order
  let latestWireSnap = null; // newest wire state, even while the old board paces
  let receivedSnapshots = 0;
  let lastReceiptSeq = 0; // rendered authoritative combat receipt identity
  let lastSoundSeq = 0; // receipts already heard (session-wide; never reset between fights)
  let guardCoopTool = null; // query-gated real-wire browser control
  let mapBoard = null; // the live act-map board, so a re-render can stop the old one
  let combatLayout = null; // the layout adapter (components/combatLayout.js) for the mounted board
  let combatTools = null;
  const combatToolsState = { open: false, size: 'Small', followLatest: true };
  let handStrip = null; // the live hand strip (components/hand.js), same discipline
  // The beat is the same on pointer, keyboard and pad since S7 went wide
  // (2026-08-17); the dial is the only switch. This line said "pointer-only;
  // named keyboard/pad activation is immediate" and was true when written.
  // UNMEASURED HERE, and said rather than assumed: no `?shot=` state opens a
  // co-op board, so nothing has driven a key or a pad at THIS End Turn. What is
  // measured is that it goes through the same `arm()` as combat's.
  let endTurnBeat = null;
  // The level-card picks OUTLIVE a redraw and a couch-seat switch: every
  // snapshot (another seat's choice, a resync) and every seat tab rebuilds
  // the door, so the picks are kept here, one entry per seat and door.
  const levelPicks = createLevelCardPicks();
  let progressionError='';
  let progressionDoor=null,progressionHost=null,progressionSeat=null;
  function disposeProgression(){progressionDoor?.dispose();progressionDoor=null;progressionHost=null;progressionSeat=null;}

  conn.setHandlers({
    onMessage: (msg) => {
      if (msg.t === 'rejoined') { seats = [msg.id]; seatIdx = 0; me = msg.id; return; }
      if (msg.t === 'knowledgeBankResult') {
        if (!msg.ok) bankFailures.set(msg.memberId, 'host checkpoint failed');
        if (snap) render();
        return;
      }
      if(msg.t==='progressionResult'&&msg.memberId===me){progressionError=msg.ok?'':msg.error || 'This progression claim could not be saved.';if(!msg.ok){progressionDoor?.rejectClaim(progressionError);render();}return;}
      if (msg.t === 'state') receiveSnapshot(msg.snapshot);
    },
    onClose: () => {
      teardown();
      const leave = button({ label: 'Leave', role: 'exit', id: 'coop-leave' });
      app.innerHTML = '';
      app.appendChild(el('div', { class: 'screen coop-scene' }, pageDoor({
        eyebrow: 'Forsaken Together', title: 'The fire went out', size: 'sm', className: 'coop-door',
        body: decide({ title: 'Connection lost', children: [blocker('Connection to the fire was lost.', { attrs: { class: 'coop-note' } }), buttonRow({ size: 'medium', buttons: [leave] })] }),
      })));
      wireLeave();
    },
  });

  // Every game intent carries the ACTIVE seat (`as`); the server validates
  // ownership and falls back to the connection's main seat.
  // Animation follows authoritative cardPlayed receipts below, never an
  // optimistic local intent. Remote seats and repeated resyncs use the same path.
  // The open card-choice dialog (Warrior's Vow's stance), if any.
  let cardChoiceShell = null;
  function closeCardChoice() {
    const shell = cardChoiceShell;
    cardChoiceShell = null;
    if (shell && shell.close) shell.close();
  }
  const send = (obj,{progressionPopup=false}={}) => {
    if (latestWireSnap?.scene?.reactionWaiting && ['playCard', 'endTurn', 'flaskIntent', 'recoverControl', 'chooseBlightFeat', 'predictIntent'].includes(obj.t)) { showPendingReaction(); return; }
    if (obj.t === 'playCard' && obj.upcastTier == null && upcastTiersByCard.has(upcastKey(obj.cardInstanceId))) obj = { ...obj, upcastTier: upcastTiersByCard.get(upcastKey(obj.cardInstanceId)) };
    if (obj.t !== 'chooseDiscard' && ['playCard', 'endTurn', 'flaskIntent'].includes(obj.t) && latestWireSnap?.scene?.players?.some(p => p.pendingAbilityDiscard)) { showPendingDiscard(); return; }
    if(progressionDoor&&!progressionDoor.ready&&!progressionPopup&&['chooseReward','catchupChoice','chooseClassMilestone','chooseLevelCard','chooseAbilityDraft'].includes(obj.t))return false;
    if (pacing && ['playCard', 'endTurn', 'flaskIntent'].includes(obj.t)) return;
    if (obj.t === 'playCard' && obj.upcastTier == null && meta.settings?.askToUpcastAfterTarget) {
      const seat = latestWireSnap?.scene?.players?.find(entry => entry.id === me);
      const inst = seat?.hand.find(entry => entry.instanceId === obj.cardInstanceId);
      const def = inst && cardDef(inst);
      const options = def && upcastOptions(def);
      if (options?.length) {
        closeCardChoice(); const seatAtOpen = me;
        const shell = openUpcastChoice({ definition: def,
          onClosed: () => { if (cardChoiceShell === shell) cardChoiceShell = null; },
          onChoose: ranks => {
            if (me !== seatAtOpen) return;
            upcastTiersByCard.set(upcastKey(inst.instanceId), Number(ranks));
            const scene = snap?.scene;
            const chosen = cardDef(inst);
            const plan = cardTargetPlan(chosen, me, scene?.enemies, scene?.players);
            const previousTarget = obj.targetId ?? (plan.mode === 'friendly' ? me : null);
            if (!plan.legalIds.includes(previousTarget)) {
              if (plan.mode === 'friendly') { armFriendlyTargeting(inst.instanceId); return; }
              armedFriendlyCard = null; render();
              const targetShell = openCardChoiceModal({ cardName: chosen.name,
                plan: { kind: 'target', options: (scene?.enemies || []).filter(enemy => plan.legalIds.includes(enemy.id))
                  .map(enemy => ({ id: enemy.id, name: registries.enemies.get(enemy.enemyId)?.name || enemy.id })) },
                onClosed: () => { if (cardChoiceShell === targetShell) cardChoiceShell = null; },
                onChoose: targetId => { if (me === seatAtOpen) send({ ...obj, targetId, upcastTier: Number(ranks) }); },
              }); cardChoiceShell = targetShell; return;
            }
            send({ ...obj, upcastTier: Number(ranks) });
          },
        }); cardChoiceShell = shell; return;
      }
    }
    // A card that offers a choice (Warrior's Vow's stance, SPEC §5.2) asks it
    // here, before its one network intent, from the same offer the host
    // validates (model/cardChoices.js); Cancel sends nothing.
    if (obj.t === 'playCard' && obj.choice == null) {
      const seat = latestWireSnap?.scene?.players?.find((entry) => entry.id === me);
      const inst = seat?.hand?.find((entry) => entry.instanceId === obj.cardInstanceId);
      const def = inst ? cardDef(inst) : null;
      const plan = def ? cardChoice(registries, def, seat.classId, seat.stanceId) : null;
      if (plan) {
        // THE CHOOSER OWNS THE COUCH KEYBOARD while it stands (#1449 review,
        // Codex P1): keyHandler and flaskKeyHandler stand down, so Tab moves
        // between the stance buttons instead of switching the seat, and the
        // 1-9/Q and E keys do not act on the board behind it. A seat switch
        // that still happens (a pad press, a seat tab) closes it; the pick
        // is pinned to the seat that opened it (tools/coop-hud-top.mjs
        // vowChoiceProbe).
        closeCardChoice();
        const seatAtOpen = me;
        const shell = openCardChoiceModal({
          plan, cardName: def.name,
          onClosed: () => { if (cardChoiceShell === shell) cardChoiceShell = null; },
          onChoose: (choice) => { if (me === seatAtOpen) send({ ...obj, choice }); },
        });
        cardChoiceShell = shell;
        return;
      }
    }
    if (obj.t === 'playCard') upcastTiersByCard.delete(upcastKey(obj.cardInstanceId));
    if (obj.t === 'endTurn') for (const key of upcastTiersByCard.keys()) if (key.startsWith(`${me}:`)) upcastTiersByCard.delete(key);
    return conn.send(obj.t === 'resync' ? obj : { ...obj, as: me });
  };

  const sendFlaskUse = ({ slot = null, targetId = undefined, chargeKind = null } = {}) => send({
    t: 'flaskIntent',
    intent: { action: 'use', ...(slot != null ? { slot } : {}), ...(targetId ? { targetId } : {}), ...(chargeKind ? { chargeKind } : {}) },
  });

  // THE POTIONS LIST, solo's own (components/combatActionRow.js). The seat's
  // charge flasks and carried potions come from the host snapshot; Use is a
  // network intent: a targeted potion goes at the selected enemy, an
  // untargeted carried one arms a throw at a hero seat, a charge flask drinks.
  // THE LIST BELONGS TO THE SEAT THAT OPENED IT (#1436 review, Codex P1).
  // It is a body-level dialog, and Tab (couch seat switch) reaches keyHandler
  // with it open, so `me` can change under it. The seat is pinned at open; a
  // seat switch closes the list, and a Use confirmed after one is refused
  // (tools/coop-hud-top.mjs seatSwitchProbe).
  let potionsShell = null;
  let potionTray = null; // the mounted row's minis, whose placement observer a new row stops
  function closeCoopPotions() {
    const shell = potionsShell;
    potionsShell = null;
    if (shell && shell.close) shell.close();
  }
  // ONE LIST AT A TIME (#1436 review, Codex P2). A flask key pressed again,
  // or held into keydown repeats, reopens the list: the open one closes
  // first, so Escape, a seat switch or teardown never leaves an orphaned
  // veil over the board (tools/coop-hud-top.mjs repeatOpenProbe).
  function potionStillHeld(player, { entry, options }) {
    if (!player) return false;
    const live = combatPotionRows(registries, player);
    return options.chargeKind
      ? live.some((r) => r.options.chargeKind === options.chargeKind && r.options.remaining > 0)
      : live.some((r) => !r.options.chargeKind && r.options.slot === options.slot && r.entry.flaskId === entry.flaskId && r.options.remaining > 0);
  }
  function openCoopPotions(shortcut = null) {
    closeCoopPotions();
    const seat = me;
    const seatPlayer = () => (snap && snap.scene && snap.scene.kind === 'combat' ? snap.scene.players.find((p) => p.id === seat) : null);
    const meP = seatPlayer();
    if (!meP) return;
    const seatReason = (current) => !current ? 'Wait for your turn'
      : !current.connected ? 'This player is disconnected'
        : !current.alive ? 'This player is down' : current.ended ? 'This turn has ended' : pacing ? 'Wait for your turn' : '';
    potionsShell = openCombatPotions({
      rows: combatPotionRows(registries, meP), opener: app.querySelector('.combat-potions'), shortcut, arm,
      useReason: ({ options }) => options.remaining <= 0 ? 'No charges remaining' : seatReason(meP),
      // The rows are this open's snapshot; a host response can land under the
      // list and shift carried potions down a slot (#1436 review, Codex P1).
      // Use commits only while the live snapshot still holds that potion in
      // that slot (or that charge kind with a charge left).
      stillUsable: (row) => me === seat && !seatReason(seatPlayer()) && potionStillHeld(seatPlayer(), row),
      // Co-op's own flow (#1436 review, Codex P2): a targeted potion goes at
      // the enemy already selected, and a charge drinks; a carried untargeted
      // potion arms a throw at a hero seat.
      targetLine: ({ def, options }) => options.chargeKind ? 'Applies to your character.'
        : def.targeted ? 'Thrown at the selected enemy.' : 'Choose a player after Use.',
      onUse: ({ def, options: { slot = null, chargeKind = null } }) => {
        if (me !== seat) return;
        if (chargeKind) sendFlaskUse({ chargeKind });
        else if (def.targeted) sendFlaskUse({ slot, targetId: selectedEnemy });
        else { armedFlask = slot; armedFriendlyCard = null; render(); }
      },
    });
  }

  function setSeat(i) {
    if (i === seatIdx || !seats[i]) return;
    closeCombatantDoor();
    disposeProgression();
    seatIdx = i;
    me = seats[i];
    closeCoopPotions();
    closeCardChoice();
    clearSelection();
    armedFlask = null;
    armedFriendlyCard = null;
    render();
  }

  function cancelFriendlyTargeting({ restoreFocus = true } = {}) {
    const cardId = armedFriendlyCard;
    if (!cardId) return false;
    armedFriendlyCard = null;
    hideTooltip();
    render();
    if (restoreFocus) {
      const card = app.querySelector(`.hand .card[data-instance-id="${CSS.escape(cardId)}"]`);
      if (card) focusElement(card);
    }
    return true;
  }

  // A co-op client reads a snapshot, not the engine, so it prices the card the
  // way the host will charge it: the framework cost profile with this seat's
  // Power reduction and its live Weight Class (the pure dodge is class-priced),
  // in every pool the host checks — Energy, Mana AND Stamina.
  function snapshotCosts(def, player) {
    return combatSnapshotCardCosts(memberRegistries(), def, player);
  }
  function cardAffordableFromSnapshot(def, player) {
    if (!def || !player || player.pendingAbilityDiscard || player.ended || !player.alive || !player.connected) return false;
    if (player.ashenBlight?.milestones.some(row => row.path === null) || !controlGate({ combatExpansionVersion: player.combatExpansionVersion || 1, combatStatusRules: snap?.scene?.combatStatusRules }, player, def).allowed) return false;
    const costs = snapshotCosts(def, player);
    return player.energy >= costs.energy && player.mana >= costs.mana && (player.stamina || 0) >= costs.stamina;
  }

  function armFriendlyTargeting(cardInstanceId) {
    if (armedFriendlyCard === cardInstanceId) {
      cancelFriendlyTargeting();
      return;
    }
    armedFriendlyCard = cardInstanceId;
    armedFlask = null;
    hideTooltip();
    render();
    focusFirst('.coop-seat[data-friendly-target]');
  }

  // A seat has something to do in the current scene (drives the tab pips).
  function seatPending(id) {
    const sc = snap && snap.scene;
    if (!sc) return false;
    if (sc.kind === 'map') return !!(sc.votes && !sc.votes[id]) || !sc.votes;
    if (sc.kind === 'combat') { const p = sc.players.find((x) => x.id === id); return !!(p && p.alive && p.connected && !p.ended); }
    if (sc.kind === 'reward') return !!(sc.offers[id] && !sc.chosen[id]);
    if (sc.kind === 'event' && sc.next) return !(sc.ack && sc.ack[id]);
    if (sc.kind === 'shrine' || sc.kind === 'event') return !(sc.done && sc.done[id]);
    return false;
  }

  function renderSeatTabs() {
    if (seats.length < 2) return;
    // The tab bar lives on document.body (a fixed overlay), so look it up there
    // — querying inside `app` never finds it and would spawn a duplicate per
    // render (stacking stale seat tabs).
    // THE DOCK: one Tab per seat this screen owns, the seat's glyph in its
    // tint, a StatePill when that seat has something to do, and the Keycap
    // that switches. Rebuilt whole per render, the old strip replaced in place.
    const tabs = seats.map((id, i) => {
      const p = snap.party.find((x) => x.id === id) || {};
      const t = tab({ label: p.name || id, selected: i === seatIdx, className: 'seat-tab', attrs: { dataset: { seatI: String(i) } } });
      t.insertBefore(el('span', { class: 'as-glyph', 'aria-hidden': 'true', style: { color: tintCss(p.tint) }, text: classGlyph(p.classId) }), t.firstChild);
      if (seatPending(id)) t.appendChild(pill({ label: '●', round: true, on: true, attrs: { class: 'pip', 'aria-label': 'has something to do' } }));
      t.addEventListener('click', () => setSeat(i));
      return t;
    });
    const strip = dock(tabs, { trail: [keycap('Tab', { class: 'seat-hint' })], attrs: { class: 'coop-seat-tabs', 'aria-label': 'Seats on this screen' } });
    const previous = document.querySelector('.coop-seat-tabs');
    if (previous) previous.replaceWith(strip); else document.body.appendChild(strip);
  }

  function removeSeatTabs() {
    const d = document.querySelector('.coop-seat-tabs');
    if (d) d.remove();
  }

  // ---- couch input: keyboard drives the active seat; pads own their seats ---
  const matchedFlaskSlot = (ev) => {
    for (let slot = 0; slot < 3; slot++) {
      if (matchAction(ev, `flask${slot + 1}`)) return slot;
    }
    return -1;
  };
  const releaseFlaskKeyClaim = setScreenKeyClaim((ev) => matchedFlaskSlot(ev) >= 0);
  const flaskKeyHandler = (ev) => {
    if (ev.target?.closest?.('[data-combat-read-only]')) return;
    if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
    if (cardChoiceShell) return;
    if (!snap || snap.scene.kind !== 'combat') return;
    const meP = snap.scene.players.find((p) => p.id === me);
    if (!meP || !meP.alive || !meP.connected) return;
    const slot = matchedFlaskSlot(ev);
    if (slot >= 0) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      openCoopPotions(`flask${slot + 1}`);
      return;
    }
  };
  const keyHandler = (ev) => {
    if (ev.target?.closest?.('[data-combat-read-only]')) return;
    if(progressionDoor?.choosing)return;
    if(isClassRespecOpen())return; // the reviewed class form owns Tab and Escape
    if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
    if (cardChoiceShell) return; // the stance chooser owns the keyboard (see send)
    if (ev.key === 'Tab' && seats.length > 1) { ev.preventDefault(); setSeat((seatIdx + 1) % seats.length); return; }
    if (ev.key === 'Escape') {
      selectCombatant(null);
      if (litCard() !== null) ev.preventDefault();
      clearSelection();
    }
    if (ev.key === 'Escape' && (armedFriendlyCard || armedFlask != null)) {
      ev.preventDefault();
      if (!cancelFriendlyTargeting()) { armedFlask = null; render(); }
      return;
    }
    if (pacing || !snap || snap.scene.kind !== 'combat') return;
    const sc = snap.scene;
    const meP = sc.players.find((p) => p.id === me);
    if (!meP || !meP.alive || !meP.connected) return;
    if (ev.key === 'e' || ev.key === 'E') { if (!meP.ended) send({ t: 'endTurn' }); return; }
    const idx = /^[1-9]$/.test(ev.key) ? Number(ev.key) - 1 : ev.key === 'q' || ev.key === 'Q' ? 9 : -1;
    if (idx >= 0 && meP.hand[idx]) {
      const c = meP.hand[idx];
      const def = cardDef(c);
      if (!cardAffordableFromSnapshot(def, meP)) return;
      if (upcastOptions(def).length && meP.combatExpansionVersion === 2) {
        // Use the same selecting/playing door as pointer and focused activation.
        app.querySelector(`.hand .card[data-instance-id="${c.instanceId}"]`)?.click();
        return;
      }
      if (friendlyTargetPlan(def, me, sc.players).active) { armFriendlyTargeting(c.instanceId); return; }
      const needs = cardNeedsEnemyTarget(def);
      send({ t: 'playCard', cardInstanceId: c.instanceId, targetId: needs ? selectedEnemy : undefined });
    }
  };
  // input.js owns a capture listener and may stop a configured action before
  // it bubbles. Co-op flasks therefore listen at that same capture boundary;
  // controller-synthesized and rebound keyboard keys traverse one door. The
  // remaining screen keys stay on the ordinary bubble path.
  addEventListener('keydown', flaskKeyHandler, true);
  addEventListener('keydown', keyHandler);
  // Gamepads: pad 0 → seat 2, pad 1 → seat 3, … (keyboard/mouse keep seat 1).
  // A pad's first button press pulls the active seat to its own; navigation
  // then flows through the global focus system like solo play.
  let padPrev = [];
  const padTimer = setInterval(() => {
    if(isClassRespecOpen())return;
    if (seats.length < 2 || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (let p = 0; p < pads.length; p++) {
      const gp = pads[p];
      if (!gp || !gp.connected) continue;
      const pressed = gp.buttons.some((b) => b.pressed);
      const was = padPrev[p];
      padPrev[p] = pressed;
      if (pressed && !was) {
        const target = Math.min(p + 1, seats.length - 1);
        if (target !== seatIdx) setSeat(target);
      }
    }
  }, 120);

  function teardown() {
    releaseAppearance();
    disposed = true;
    reactionShell?.dismiss();
    snap = null;
    closeCombatantDoor();
    disposeProgression();
    closeClassRespec();
    app.removeEventListener('click', dismissCombatant);
    app.removeEventListener('cardinspectionselect', inspectCard);
    app.querySelectorAll('.coop-seat .sprite').forEach(node => stageFor(node)?.dispose?.());
    clearCombatEffects(app.querySelector('.fx-layer'));
    releaseFlaskKeyClaim();
    removeEventListener('keydown', flaskKeyHandler, true);
    removeEventListener('keydown', keyHandler);
    clearInterval(padTimer);
    if (endTurnBeat) endTurnBeat();
    endTurnBeat = null;
    removeSeatTabs();
    closeCoopPotions();
    closeCardChoice();
    if (potionTray) { disposeCombatPotionTray(potionTray); potionTray = null; }
    if (mapBoard) { mapBoard.teardown(); mapBoard = null; }
    if (handStrip) { handStrip.teardown(); handStrip = null; }
    if (combatLayout) { combatLayout.release(); combatLayout = null; }
    if (combatTools) { combatTools.release(); combatTools = null; }
    if (typeof window !== 'undefined' && window.__guardCoopTool === guardCoopTool) delete window.__guardCoopTool;
  }
  const myMember = () => (snap ? snap.party.find((p) => p.id === me) : null);
  const memberRegistries=()=>{const member=myMember();return member?registriesForClassMastery(registries,{...member,class:member.classId}):registries;};
  const cardDef = (c) => {
    const seat = snap?.scene?.players?.find(entry => entry.id === me);
    return combatCardView({ registries: memberRegistries(), player: seat,
      combatExpansionVersion: seat?.combatExpansionVersion || 1,
      breakMeterVersion: snap?.scene?.breakMeterVersion ?? c.breakMeterVersion ?? 0 },
    c, upcastTiersByCard.get(upcastKey(c.instanceId)));
  };
  guardCoopTool = typeof window !== 'undefined' && new URLSearchParams(location.search).has('guardTool') ? {
    resync: () => send({ t: 'resync' }),
    playFirstFromLatest: () => {
      const sc = latestWireSnap?.scene;
      const player = sc?.kind === 'combat' ? sc.players.find((entry) => entry.id === me) : null;
      const card = player?.hand.find((entry) => {
        const def = cardDef(entry);
        return cardNeedsEnemyTarget(def)
          && cardAffordableFromSnapshot(def, player);
      });
      const enemy = sc?.enemies.find((entry) => entry.alive);
      if (!card || !enemy) return null;
      send({ t: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
      return { cardId: card.cardId, receiptSeq: sc.receiptSeq };
    },
    playCardOnAllyFromLatest: (cardId, allyId) => {
      const sc = latestWireSnap?.scene;
      const player = sc?.kind === 'combat' ? sc.players.find((entry) => entry.id === me) : null;
      const card = player?.hand.find((entry) => entry.cardId === cardId);
      const ally = sc?.players.find((entry) => entry.id === allyId && entry.alive && entry.connected);
      if (!card || !ally) return null;
      send({ t: 'playCard', cardInstanceId: card.instanceId, targetId: ally.id });
      return { cardId: card.cardId, allyId: ally.id, receiptSeq: sc.receiptSeq };
    },
    state: () => ({
      pacing, receivedSnapshots, lastReceiptSeq,
      latestReceiptSeq: latestWireSnap?.scene?.receiptSeq || 0,
      pendingReceiptSeqs: pendingSnaps.map((entry) => entry.scene?.receiptSeq || 0),
    }),
  } : null;
  if (guardCoopTool) window.__guardCoopTool = guardCoopTool;
  const wireLeave = () => { const b = app.querySelector('#coop-leave'); if (b) b.addEventListener('click', () => { teardown(); conn.close(); onLeave(); }); };

  function render() {
    closeClassRespec({silent:true});
    if (!snap) return;
    if(['combat','complete','lobby'].includes(snap.scene.kind))disposeProgression();
    posePresentations = new Map([...app.querySelectorAll('.coop-seat')].map(node => [node.dataset.seat, stageFor(node)?.presentation]));
    clearCombatEffects(app.querySelector('.fx-layer'));
    app.querySelectorAll('.coop-seat .sprite').forEach(node => stageFor(node)?.dispose?.());
    if (snap.scene.kind === 'combat') prepareCombatAnimations(snap.scene);
    else { heldStances.reset(); combatRests.clear(); readinessOrders.clear(); poseReactions.clear(); animationReceiptSeq = 0; pendingAnimations.clear(); barrierVisuals.clear(); effectEvents=[]; lastReceiptSeq=0; }
    if (typeof window !== 'undefined') window.__coopSnapshot = snap; // read-only receipt handle
    if (endTurnBeat) endTurnBeat();
    endTurnBeat = null;
    // Level-card picks outlive a redraw and a seat switch, and end with their
    // door: a reward entry lives while its seat's offer is open and unchosen,
    // a catch-up entry while it is still the seat's queue head.
    levelPicks.retain((key) => {
      const [seat, door, at] = key.split('|');
      if (door === 'reward') return snap.scene.kind === 'reward' && !!snap.scene.offers?.[seat] && !snap.scene.chosen?.[seat] && at === String(snap.floor ?? '');
      const member = (snap.party || []).find((p) => p.id === seat);
      return !member || !Array.isArray(member.catchupQueue) || String(member.catchupQueue.length) === at;
    });
    // The Potions list is a body-level dialog the redraw below does not reach;
    // a fight another player ends must not leave it over the next scene
    // (#1436 review, Codex P2). The stance chooser is one too: left open it
    // would sit over the reward or map and send a stale playCard on a pick
    // (#1449 review, Codex P2; tools/coop-hud-top.mjs vowChoiceProbe).
    if (snap.scene.kind !== 'combat') {
      closeCardChoice();
      closeCoopPotions();
      if (potionTray) { disposeCombatPotionTray(potionTray); potionTray = null; }
    }
    if (snap.scene.kind !== 'combat') lastSoundSeq = coopReceiptSounds(snap.scene, lastSoundSeq, seats);
    const mm = myMember();
    if (mm && mm.catchupQueue && mm.catchupQueue.length){renderCatchup(mm);renderProgression();return;}
    if (snap.scene.kind !== 'combat') prevCombat = null;
    // The board holds a ResizeObserver and a timeout aimed at a scrollport the
    // next render is about to replace. The same leak the solo screen fixes at
    // its own re-mount, one screen over.
    if (mapBoard && snap.scene.kind !== 'map') { mapBoard.teardown(); mapBoard = null; }
    renderSeatTabs();
    switch (snap.scene.kind) {
      case 'map': renderMap();break;
      case 'combat': renderCombat();showPendingDiscard();break;
      case 'reward': renderReward();break;
      case 'shrine': renderShrine();break;
      case 'event': renderEvent();break;
      case 'complete': renderComplete();break;
      default: app.innerHTML = ''; app.appendChild(el('div', { class: 'screen coop-scene' }, flavour(`${snap.scene.kind}…`, { class: 'coop-note' })));
    }
    renderProgression();
    if (bankFailures.size) {
      const retry = button({ label: t('knowledge.save.retry') });
      retry.addEventListener('click', () => { bankAttempts.clear(); bankFailures.clear(); void bankOwnedLearning(snap); render(); });
      app.append(el('aside', { class: 'coop-learning-save-status', role: 'status' }, [el('p', { text: t('knowledge.save.retained') }), retry]));
    }
  }

  // ---- shared board helpers (snapshot-fed twins of combat.js) ---------------
  // The shared icon tray, as on the solo card (components/iconTray.js): the
  // same Pip, row and tooltip. A tap is a play while a card or flask is armed.
  function statusRow(statuses) {
    const row = iconTray({ label: t('iconTray.status'), attrs: { class: 'statuses' } });
    for (const [sid, inst] of Object.entries(statuses || {})) {
      if (!registries.statuses.has(sid)) continue;
      const def = registries.frameworkTerms.withStatusWords(registries.statuses.get(sid));
      const presentation = statusInstancePresentation(def, inst);
      const semanticAttrs = statusInstanceSemanticAttrs(presentation);
      const el = trayIcon({
        glyph: def.icon || '?', count: presentation.valueText, tone: def.tint || 'var(--muted)', // status-pip accent (data: status def)
        label: semanticAttrs['aria-label'], attrs: { class: 'status-icon' },
        tip: () => `<div class="tt-title">${esc(presentation.label)}</div>${esc(presentation.tooltip)}`,
        yieldTap: () => !!armedFriendlyCard || armedFlask != null,
      });
      el.setAttribute('data-status-id', semanticAttrs['data-status-id']);
      el.setAttribute('data-status-value-token', semanticAttrs['data-status-value-token']);
      row.appendChild(el);
    }
    return row;
  }
  function meterBars(ent, isEnemy, recentEvents = []) {
    const wrap = document.createElement('div');
    wrap.className = 'meters';
    const entity = { ...ent, kind: isEnemy ? 'enemy' : 'player' };
    const plan = resourceBarPlan(registries, 'model', entity, entity, resourceDomainTable);
    const bars = resourceBars(plan, { surface: 'model' });
    const hp = bars.querySelector('.as-meter[data-res="hp"]');
    if (hp) {
      const next = hp.nextSibling;
      const health = combatHealthRow(hp, blockPresentation(ent));
      bars.insertBefore(health, next);
    }
    wrap.classList.add('as-meters', 'tight');
    while (bars.firstChild) wrap.append(bars.firstChild);
    if (ent.combatExpansionVersion === 2) {
      const protection = document.createElement('div'); protection.className = 'combat-expansion-protection';
      const stance = ent.combatStance?.maneuver;
      protection.textContent = [`Ward ${ent.persistentWard?.value || 0}/${ent.persistentWard?.max || 0}`,
        `Barrier ${ent.barrier || 0}`, stance ? stance[0].toUpperCase() + stance.slice(1) : ''].filter(Boolean).join(' · ');
      wrap.appendChild(protection);
    }
    if (isEnemy) {
      const arcane = renderArcaneExposure(registries, ent, recentEvents);
      if (arcane) wrap.appendChild(arcane);
    }
    return wrap;
  }
  function intentEl(intent, onTarget) {
    return combatantIntent(intent, () => intentTooltip(intent), registries, { onTarget });
  }

  function readEnemyIntent(entity, def) {
    const moveId = entity.intent?.moveId;
    const move = def?.moves?.[moveId];
    const profile = move ? combatProfileFor({ ...move, enemyId: def.id, moveId }) : null;
    return coopEnemyIntent(entity, me, profile);
  }

  function infoEl(entity, name, def = null) {
    return combatantInfo(name, opener => {
        const resources = [
        { label: 'HP', value: entity.hp, max: entity.maxHp },
        { label: 'MP', value: entity.mana, max: entity.maxMana },
          { label: 'Poise', value: entity.poiseMeter?.value, max: entity.poiseMeter?.max },
          { label: entity.combatExpansionVersion === 2 ? 'Ward rating' : t('combat.rating.ward'), value: entity.ratings?.ward },
          ...(entity.combatExpansionVersion === 2 ? [{ label: 'Ward pool', value: entity.persistentWard?.value || 0, max: entity.persistentWard?.max || 0 }, { label: 'Barrier', value: entity.barrier || 0 }] : []),
        { label: t('combat.protection.block'), value: entity.block || 0 },
      ].filter(row => row.value != null);
      const abilities = activeCombatAbilities(registries, entity, false);
      const intent = def ? readEnemyIntent(entity, def) : null;
      const owner = snap.scene.enemyKnowledge?.owners?.[me];
      const learning = def && owner ? projectEnemyKnowledge(def, owner.knowledge.enemies[def.id], { registries, combatMatchupRules: snap.scene.combatMatchupRules }) : null;
      const moveCards = learning ? learning.moveCards : def ? enemyMoveCards(def, { enemy: entity, preview: intent, registries, combatMatchupRules: snap.scene.combatMatchupRules }) : null;
      // PREVIOUS ACTIONS, oldest first — the moves that RESOLVED, which is what
      // solo reads off `entity.performedMoves`. The snapshot now carries the
      // field, so an enemy that has acted lists what it did and one that has
      // not says so; before this the section could only say `unknown`, which
      // reads as "not revealed" and is a different claim entirely.
      // Names and details come from the move cards already built above — one
      // source for both, so the history and the move set cannot word a move
      // two different ways. Indexed once: this runs on every inspector open,
      // and a scan per entry is a needless m×n in a path a player waits on.
      const cardsByMoveId = def && new Map(enemyMoveCards(def, { enemy: entity, registries, combatMatchupRules: snap.scene.combatMatchupRules }).map((c) => [c.moveId, c]));
      const history = def && Array.isArray(entity.performedMoves)
        ? entity.performedMoves.map((moveId) => {
          const card = cardsByMoveId.get(moveId);
          return { name: card ? card.name : moveId, detail: card ? card.detail : '' };
        })
        : null;
      const subject = { name, resources, statuses: abilities, ...(def
        ? { moveCards, history, ...(learning ? { learning, perception: snap.party.find(member => member.id === me)?.skills?.perception?.level || 0,
          prediction: entity.intentPredictions?.[me], onPredict: (actionSerial, maneuver) => {
            conn.send({ t: 'predictIntent', as: me, enemyInstanceId: entity.id, actionSerial, maneuver });
            return { accepted: false };
          } } : {}), intent: {
          ...intent,
          name: intent.hidden ? intent.label || '?' : (moveCards?.find(card => card.active)?.name || intent.label || intent.stance),
          detail: intent.hidden ? 'Exact move, damage, and effects unread.' : intentTooltip(intent),
        } }
        : { abilities }) };
      closeCombatantDoor();
      combatantDoor = openModal({ title: name, size: 'md', className: 'combatant-door', opener,
        bodyClassName: 'combatant-inspector-body',
        body: host => host.replaceChildren(...combatantDetailBody(subject, { heading: false })),
        onClose: () => { combatantDoor = null; },
      });
    });
  }


  // ---- combat (parity board) ------------------------------------------------
  // The action row's viewer half. Every count comes from the host snapshot:
  // it carries the seat's pile COUNTS, not their cards, so Draw and
  // Discard/Exhaust answer a tap with the count (their tooltip) rather than a
  // card viewer (D32, docs/FINISH.md).
  function wireCoopActionRow(meP) {
    const row = app.querySelector('.combat .combat-action-row');
    if (!row) return;
    setPotionRevealTiming(row, resolveTooltipSettings(meta.settings));
    paintCombatActionCounts(row, {
      energy: meP ? meP.energy : null, energyMax: meP ? meP.energyMax : null,
      mana: meP?.mana, maxMana: meP?.maxMana, settings: meta.settings || {},
      draw: meP?.drawCount ?? 0, discard: meP?.discardCount ?? 0, exhaust: meP?.exhaustCount ?? 0, browse: false,
    });
    const orb = row.querySelector('.energy-orb');
    const drawNode = row.querySelector('.pile.draw');
    const spent = row.querySelector('.pile.spent');
    const potions = row.querySelector('.combat-potions');
    orb.tabIndex = 0;
    attachTooltip(orb, () => actionsTipHtml(meP ? meP.energy : 0, meP ? meP.energyMax : 0));
    const countTip = (node, tip) => {
      attachTooltip(node, tip);
      node.addEventListener('click', () => showTooltipFor(node, tip()));
    };
    countTip(drawNode, () => drawTipHtml(meP?.drawCount ?? 0, { browse: false }));
    countTip(spent, () => spentTipHtml({ browse: false }));
    attachTooltip(potions, () => POTIONS_TIP_HTML);
    // A down or disconnected seat can still LOOK at its potions; the list
    // gates Use with the spelled-out reason (openCoopPotions seatReason).
    potions.disabled = !meP;
    const tray = row.querySelector('.combat-potion-tray');
    if (potionTray && potionTray !== tray) disposeCombatPotionTray(potionTray);
    potionTray = tray;
    if (meP) {
      potions.addEventListener('click', () => openCoopPotions());
      renderCombatPotionTray(tray, combatPotionRows(registries, meP), (key) => openCoopPotions(key ?? null));
    }
  }

  let discardShell = null;
  function showPendingDiscard() {
    showPendingReaction();
    const player = latestWireSnap?.scene?.players?.find(p => p.id === me);
    const pending = player?.pendingAbilityDiscard;
    if (!pending || pending.playerId !== me || discardShell || pacing) return;
    const owner = me;
    discardShell = openDiscardChoiceModal({
      count: pending.count, cardName: registries.cards.get(pending.cardId).name,
      cards: player.hand.map(card => ({ instanceId: card.instanceId, name: resolveCard(registries, card).name })),
      onClosed: () => { discardShell = null; },
      onChoose: cardInstanceIds => { if (me === owner) send({ t: 'chooseDiscard', cardInstanceIds }); },
    });
  }

  let reactionShell = null;
  let reactionOfferId = null;
  function showPendingReaction() {
    const sc = latestWireSnap?.scene;
    const owner = sc?.players?.find(player => seats.includes(player.id) && player.pendingReaction?.ownerId === player.id);
    if (!owner || reactionShell || pacing || sc.players.some(player => player.pendingAbilityDiscard)) return;
    const ownerId = owner.id;
    reactionOfferId = owner.pendingReaction.id;
    if (me !== ownerId) { seatIdx = seats.indexOf(ownerId); me = ownerId; }
    reactionShell = openReactionChoiceModal({ pending: owner.pendingReaction,
      onClosed: () => { reactionShell = null; reactionOfferId = null; },
      onAnswer: intent => {
        if (!disposed && me === ownerId && latestWireSnap?.scene?.reactionWaiting?.id === intent.offerId)
          send({ t: 'chooseReaction', ...intent });
      },
    });
  }

  function renderCombat() {
    const sc = snap.scene;
    const focusedTool = combatTools?.focusedTool();
    const focusedFriendlySeat = (app.querySelector('.coop-seat[data-friendly-target].gp-focus')
      || document.activeElement?.closest?.('.coop-seat[data-friendly-target]'))?.dataset.seat || null;
    let restoreFriendlyCardFocus = null;
    const living = sc.enemies.filter((e) => e.hp > 0);
    if (selectedCombatantId && ![...living, ...sc.players.filter(p => p.alive)].some(e => e.id === selectedCombatantId)) selectedCombatantId = null;
    if (armedFlask != null || armedFriendlyCard) selectedCombatantId = null;
    if (selectedEnemy == null || !living.find((e) => e.id === selectedEnemy)) selectedEnemy = living[0] ? living[0].id : null;
    const meP = sc.players.find((p) => p.id === me);
    let armedCardDef = armedFriendlyCard && meP ? (() => { const c = meP.hand.find((h) => h.instanceId === armedFriendlyCard); return c ? cardDef(c) : null; })() : null;
    if (armedFriendlyCard && !armedCardDef) armedFriendlyCard = null; // card left the hand
    let targetPlan = armedCardDef ? friendlyTargetPlan(armedCardDef, me, sc.players) : null;
    const focusedFriendlyInvalid = focusedFriendlySeat && targetPlan && !targetPlan.legalIds.includes(focusedFriendlySeat);
    if (armedFriendlyCard && targetPlan && (targetPlan.targets.length === 0 || focusedFriendlyInvalid)) {
      restoreFriendlyCardFocus = armedFriendlyCard;
      armedFriendlyCard = null;
      armedCardDef = null;
      targetPlan = null;
    }
    const arming = armedFlask != null || armedFriendlyCard != null;

    app.innerHTML = `
      <div class="combat coop" data-layout="formation" data-turn="${pacing || sc.phase === 'enemy' ? 'enemy' : 'player'}">
        <header class="topbar combat-hud">
          ${hudQuickSettingsHtml(hudQuickSettingsModel({
            place: 'combat',
            presentation: registries.balance.ui.hudQuickSettings,
            settings: meta.settings || {},
          }))}
          <div class="hud-top">
            <div class="resbars-host"></div>
            <span class="fight-label">${esc(actTitle(snap.actNumber, snap.seatName || null))} · FLOOR ${snap.floor} · SEED ${esc(snap.seedString)}</span>
            <button class="subtle coop-leave" id="coop-leave">Leave</button>
          </div>
          <div class="combat-blight-hud" aria-live="polite">${ashenBlightBarHtml(meP, { compact: true, cooperative: true })}</div>
        </header>
        ${progressionError ? `<p class="combat-error" role="status">${esc(progressionError)}</p>` : ''}
        ${meP?.ashenBlight?.milestones.some(row => row.path === null) ? '<button class="primary" id="coop-blight-feat">Choose Blight feat</button>' : ''}
        ${combatBackdropHtml(snap)}
        <div class="field"><div class="turn-ribbon" role="status" aria-live="polite">${pacing || sc.phase === 'enemy' ? 'Enemy Turn' : 'Player Turn'}</div>
          <div class="player-zone"></div>
          <div class="enemy-row"></div>
        </div>
        ${arming ? '<div class="coop-arm-host"></div>' : ''}
        <div class="hand-area">
          <!-- The strip is components/hand.js — THE one hand renderer, the same
               one solo combat mounts, so this hand honors data-hand-layout
               (overlap overlaps, paging pages), carries the inspect hold, and
               wears the mode-scoped Law 5 exemption from its one home
               (src/ui/handAxis.js). The unscoped exemption that lived here died
               with the second template; its A4 wake in axisfit fired the day
               this renderer gained the overlap arm, as designed. This screen
               supplies only the viewer half below: snapshot-fed entries with
               spelled-out reasons, and network intents as the play wiring. -->
          <div class="hand"></div>
          <div class="combat-recovery-controls">${(meP?.recoveryControls || []).map(row => `<button class="subtle" data-control-recovery="${esc(row.status)}" ${row.disabled || meP.ended || pacing || meP.energy < row.costPerStack ? 'disabled' : ''}>${row.status === 'prone' ? 'Stand up' : `Recover ${esc(row.status)}`} · ${row.costPerStack} SP</button>`).join('')}</div>
          <!-- THE ACTION ROW: solo's own footer (components/combatActionRow.js)
               — Actions, Draw, End Turn, Discard/Exhaust and Potions — sized by
               the same layout adapter. The flasks live behind Potions. -->
          ${combatActionRowHtml({ endTurnId: 'coop-endturn' })}
        </div>
        <div class="fx-layer"></div>
      </div>`;
    wireHudQuickSettings(app, { settings: meta.settings || {}, onSettingsChange });
    app.querySelector('#coop-blight-feat')?.addEventListener('click', () => {
      const pending = meP.ashenBlight.milestones.find(row => row.path === null), seatAtOpen = me;
      closeCardChoice();
      const shell = openAshenBlightMilestone({ threshold: pending.threshold,
        onChoose: selection => { if (me !== seatAtOpen) return false; send({ t: 'chooseBlightFeat', ...selection }); },
        onClosed: () => { if (cardChoiceShell === shell) cardChoiceShell = null; },
      }); cardChoiceShell = shell;
    });
    for (const control of app.querySelectorAll('[data-control-recovery]')) control.addEventListener('click', () => send({ t: 'recoverControl', selections: [{ status: control.dataset.controlRecovery, stacks: 1 }] }));

    // The active seat gets the same main-HUD plan as solo. Values come only
    // from the host snapshot; a missing current/max pair produces no bar.
    const mainHost = app.querySelector('.topbar .resbars-host');
    if (mainHost && meP) {
      const mainPlan = combatVitals(resourceBarPlan(registries, 'main', meP, meP, resourceDomainTable), meta.settings || {});
      mainHost.appendChild(resourceBars(mainPlan, { surface: 'main' }));
    }

    // Player seats (all party members in the fight).
    const zone = app.querySelector('.player-zone');
    for (const p of sc.players) {
      const m = snap.party.find((x) => x.id === p.id) || {};
      const box = document.createElement('div');
      const friendly = targetPlan && targetPlan.targets.find((target) => target.id === p.id);
      box.className = `combatant player coop-seat${p.id === me ? ' me' : ''}${p.ended ? ' ended' : ''}${p.alive ? '' : ' down'}${p.connected ? '' : ' away'}${armedFlask != null && p.alive && p.connected ? ' throw-target' : ''}`;
      box.dataset.seat = p.id;
      box.dataset.eid = p.id;
      if (p.alive) box.append(infoEl(p, m.name || p.id));
      const sprite = document.createElement('div');
      sprite.className = 'sprite';
      sprite.appendChild(playerSprite({ tint: m.tint, glyph: m.glyph, spriteStyle: m.spriteStyle, figureId: `seat:${m.id}` }, m.classId, figureSpec(registries, m.loadout, m.classId).armourId, { animation: equipmentAnimationForLoadout(registries, m.loadout, m.classId) }));
      const resume = posePresentations.get(p.id);
      stageFor(sprite)?.setStance?.(heldStances.get(p.id));
      stageFor(sprite)?.setRestPose?.(resolveCombatPose(p, combatRests.get(p.id), readinessOrders.get(p.id)), { resume, immediate: !resume });
      for (const reaction of poseReactions.get(p.id) || []) stageFor(sprite)?.react?.(reaction);
      box.appendChild(sprite);
      // THE SEAT LINE: the tinted name (the identity span hudbars reads,
      // first child), a "you" Pill, the energy Chip, and the seat's state as
      // a StatePill — one StatStrip, centred under the sprite.
      const seatState = !p.connected ? { label: 'away', on: false } : !p.alive ? { label: 'down', on: false } : p.ended ? { label: '✓ ended', on: false } : { label: '● turn', on: true };
      const nm = statStrip([
        el('span', { class: 'coop-seat-player', style: { color: tintCss(m.tint) }, text: m.name || p.id }),
        p.id === me ? pill({ label: 'you', round: true, on: true }) : null,
        chip({ key: '◆', value: `${p.energy}/${p.energyMax}`, attrs: { class: 'stamina-budget', 'aria-label': `${t('combat.actions')} ${p.energy} of ${p.energyMax}` } }),
        pill({ ...seatState, attrs: { class: 'coop-turnflag' } }),
      ], { class: 'centered coop-seat-name' });
      const name = document.createElement('div');
      name.className = 'nm'; name.textContent = m.name || p.id;
      name.title = `${name.textContent}: ${seatState.label}, ${p.energy}/${p.energyMax} energy`;
      box.appendChild(name);
      // Your own seat glows in YOUR accent, not a fixed gold.
      if (p.id === me) sprite.style.filter = `drop-shadow(0 0 6px ${tintCss(m.tint)})`;
      box.appendChild(meterBars(p, false));
      box.appendChild(statusRow(p.statuses));
      if (friendly) {
        decorateFriendlyTarget(box, { relationship: friendly.relationship, label: m.name || p.id });
        const playOnSeat = () => {
          const cardInstanceId = armedFriendlyCard;
          if (!cardInstanceId) return;
          armedFriendlyCard = null;
          hideTooltip();
          render();
          send({ t: 'playCard', cardInstanceId, targetId: p.id });
        };
        box.addEventListener('click', playOnSeat);
        box.addEventListener('click', event => {
          if (!event.target.closest('.combatant-mini-hud')) return;
          event.preventDefault(); event.stopPropagation(); playOnSeat();
        }, true);
      } else if (armedFlask != null && p.alive && p.connected) {
        box.addEventListener('click', () => {
          sendFlaskUse({ slot: armedFlask, targetId: p.id === me ? undefined : p.id });
          armedFlask = null;
        });
      } else if (p.alive) {
        box.addEventListener('click', () => selectCombatant(p.id));
      }
      if (p.alive) wireCombatantContext(box, m.name || p.id);
      adoptCombatantFrame(box);
      box.inert = !p.alive || (!!targetPlan && !friendly);
      if (box.inert) box.setAttribute('aria-disabled', 'true');
      zone.appendChild(box);
    }

    // Enemies (shared).
    const row = app.querySelector('.enemy-row');
    for (const e of sc.enemies) {
      const def = registries.enemies.get(e.enemyId);
      const dead = e.hp <= 0;
      const box = document.createElement('div');
      box.className = `combatant enemy${dead ? ' dead' : ''}${!dead && e.id === selectedEnemy ? ' selected-target' : ''}`;
      box.dataset.eid = e.id;
      box.dataset.stature = statureFor(registries, def.id);
      if (!dead) box.append(infoEl(e, def.name, def), intentEl(readEnemyIntent(e, def), () => {
        if (armedFriendlyCard) return false;
        selectedEnemy = e.id;
        const selected = meP?.hand.find(card => card.instanceId === litCard());
        const selectedDef = selected && cardDef(selected);
        if (!pacing && selectedDef && cardNeedsEnemyTarget(selectedDef) && cardAffordableFromSnapshot(selectedDef, meP)) {
          clearSelection();
          send({ t: 'playCard', cardInstanceId: selected.instanceId, targetId: e.id });
          return true;
        }
        selectCombatant(e.id);
        // Leave unarmed taps to the intent's selection-first tooltip.
        return false;
      }));
      const sprite = document.createElement('div');
      sprite.className = 'sprite';
      sprite.appendChild(enemySprite(def, e));
      box.appendChild(sprite);
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = def.name; box.appendChild(nm);
      box.appendChild(meterBars(e, true, (sc.events || []).filter((event) => (
        event.targetId === e.id && (event.type === 'arcaneExposureRefused' || event.type === 'arcaneBreak' || event.type === 'arcaneExposureChanged')
      ))));
      box.appendChild(statusRow(e.statuses));
      if (!dead) {
        wireCombatantContext(box, def.name);
        box.addEventListener('click', () => {
          if (armedFriendlyCard) return;
          selectedEnemy = e.id; selectCombatant(e.id); render();
        });
      }
      adoptCombatantFrame(box);
      box.inert = dead || !!targetPlan;
      if (box.inert) box.setAttribute('aria-disabled', 'true');
      row.appendChild(box);
    }

    wireBattlefieldStage(app.querySelector('.field'), battlefieldStageModel(registries.balance.ui.combatantStage));
    const area = app.querySelector('.hand-area');
    if (combatLayout) combatLayout.release();
    combatLayout = wireCombatLayout(app.querySelector('.combat'));
    combatTools?.release();
    const updateTools = () => combatTools.update(combatToolsModel({ supported: sc.reactionRulesVersion === 1,
      enabled: meP?.reactionsEnabled !== false, disabled: pacing || sc.phase !== 'player' || !!sc.reactionWaiting
        || !meP?.connected || !meP?.alive || !!meP?.pendingAbilityDiscard,
      ...combatToolsState, entries: sc.combatLog || [] }));
    combatTools = mountCombatTools(app.querySelector('.combat'), { state: combatToolsState,
      onViewChange: updateTools, onToggle: enabled => send({ t: 'setReactions', enabled }) });
    updateTools();
    combatTools.restoreFocus(focusedTool);
    wireCoopActionRow(meP);
    const hand = area.querySelector('.hand');
    hand.inert = pacing || !!sc.reactionWaiting || sc.phase !== 'player' || !!meP?.ended;
    hand.setAttribute('aria-disabled', String(hand.inert));

    // My hand — THE hand renderer, mounted fresh per snapshot render (this
    // screen rebuilds its DOM wholesale; the old strip's observers are torn
    // down first, the mapBoard discipline one screen over). The strip draws;
    // this callback is the network door: a played card is ALWAYS a server
    // intent (`send`), never local dispatch — the client renders snapshots
    // and asks, it does not resolve.
    if (handStrip) handStrip.teardown();
    handStrip = mountHand(app.querySelector('.hand'), {
      registries:memberRegistries(), fitFan: true,
      wireCard: (el, entry) => {
        const play = () => {
          if (pacing || meP?.ended || !entry.affordable) return;
          if (friendlyTargetPlan(entry.def, me, sc.players).active) {
            armFriendlyTargeting(entry.inst.instanceId);
            return;
          }
          const needs = cardNeedsEnemyTarget(entry.def);
          send({ t: 'playCard', cardInstanceId: entry.inst.instanceId, targetId: needs ? selectedEnemy : undefined });
        };
        if (upcastOptions(entry.def).length && meP?.combatExpansionVersion === 2) {
          const surcharge = (entry.def.upcastTier ?? entry.def.upcast.baseTier) - entry.def.upcast.baseTier;
          wireCoopUpcastControl(el, {
            label: surcharge ? `Upcast +${surcharge}` : 'Upcast',
            disabled: pacing || meP.ended || !meP.alive,
            selectBeforePlay: !friendlyTargetPlan(entry.def, me, sc.players).active,
            onPlay: play,
            onOpen: upcast => {
              closeCardChoice(); const seatAtOpen = me;
              const shell = openUpcastChoice({ definition: entry.def, opener: upcast,
                onClosed: () => { if (cardChoiceShell === shell) cardChoiceShell = null; },
                onChoose: ranks => {
                  if (me !== seatAtOpen) return;
                  upcastTiersByCard.set(upcastKey(entry.inst.instanceId), Number(ranks));
                  if (friendlyTargetPlan(cardDef(entry.inst), me, sc.players).active) {
                    // Choosing a tier keeps an already armed friendly card armed.
                    if (armedFriendlyCard !== entry.inst.instanceId) armFriendlyTargeting(entry.inst.instanceId);
                    else render();
                  } else { armedFriendlyCard = null; render(); }
                },
              }); cardChoiceShell = shell;
            },
          });
        } else el.addEventListener('click', play);
      },
    });
    if (meP && meP.alive && meP.connected) {
      handStrip.render({
        cards: meP.hand.map((c) => {
          const def = cardDef(c);
          const costs = snapshotCosts(def, meP);
          const energyAffordable = meP.energy >= costs.energy;
          const manaAffordable = meP.mana >= costs.mana;
          const staminaAffordable = (meP.stamina || 0) >= costs.stamina;
          const affordable = cardAffordableFromSnapshot(def, meP);
          // The spelled-out reason is this viewer's data: a co-op client reads
          // a snapshot, not the engine, so the card itself says why it is grey.
          const reason = affordable ? null
            : !manaAffordable ? `Need ${costs.mana} Mana; have ${meP.mana}`
              : !staminaAffordable ? `Need ${costs.stamina} Stamina; have ${meP.stamina || 0}`
                : !energyAffordable ? 'Not enough Stamina' : 'Turn already ended';
          return {
            inst: {...c},
            def, name: def.name, affordable, reason,
            preview: costs.preview,
            selected: c.instanceId === armedFriendlyCard,
          };
        }),
      });
    } else {
      handStrip.render({ cards: [], emptyHtml: '<div class="coop-note">Spectating the fight…</div>' });
    }

    // The arming prompt: a DetailCard saying what is in hand and what to do,
    // with the way out beside it.
    const ahost = app.querySelector('.coop-arm-host');
    if (ahost) {
      const throwing = armedFlask != null;
      const card = detailCard({
        eyebrow: throwing ? 'Throwing' : 'Playing',
        name: throwing ? registries.flasks.get(meP.flasks[armedFlask].flaskId).name : armedCardDef.name,
        line: throwing ? 'Click a hero seat to give it.' : 'Choose a highlighted hero.',
        attrs: { class: 'floating coop-arm', role: 'status' },
      });
      card.appendChild(buttonRow({ size: 'short', buttons: [button({ label: t('common.cancel'), role: 'exit', id: throwing ? 'coop-cancel-flask' : 'coop-cancel-target' })] }));
      ahost.replaceWith(card);
    }

    const canEnd = meP && meP.alive && meP.connected && !meP.ended;
    const et = app.querySelector('#coop-endturn');
    et.disabled = !canEnd;
    const hasPlayable = canEnd && meP.hand.some(card => {
      const def = cardDef(card);
      if (registries.framework.isUnplayable(def) || !cardAffordableFromSnapshot(def, meP)) return false;
      if (cardNeedsEnemyTarget(def) && !sc.enemies.some(enemy => enemy.hp > 0)) return false;
      const friendly = friendlyTargetPlan(def, me, sc.players);
      return !friendly.active || friendly.legalIds.length > 0;
    });
    et.classList.toggle('pulse', hasPlayable);
    et.dataset.confirmReady = String(canEnd && !hasPlayable);
    endTurnBeat = arm(et, 'endTurn', {
      onConfirm: () => {
        const current = snap && snap.scene && snap.scene.kind === 'combat'
          ? snap.scene.players.find((p) => p.id === me)
          : null;
        if (current && current.alive && current.connected && !current.ended) send({ t: 'endTurn' });
      },
    });
    endTurnBeat.refresh();
    const cf = app.querySelector('#coop-cancel-flask'); if (cf) cf.addEventListener('click', () => { armedFlask = null; armedFriendlyCard = null; render(); });
    const ct = app.querySelector('#coop-cancel-target'); if (ct) ct.addEventListener('click', () => cancelFriendlyTargeting());
    if (restoreFriendlyCardFocus) {
      const card = app.querySelector(`.hand .card[data-instance-id="${CSS.escape(restoreFriendlyCardFocus)}"]`);
      if (card) focusElement(card);
    } else if (armedFriendlyCard && isEngaged()) {
      const preservedTarget = focusedFriendlySeat && targetPlan?.legalIds.includes(focusedFriendlySeat)
        ? app.querySelector(`.coop-seat[data-friendly-target][data-seat="${CSS.escape(focusedFriendlySeat)}"]`)
        : null;
      if (!preservedTarget || !focusElement(preservedTarget)) focusFirst('.coop-seat[data-friendly-target]');
    }
    for (const [ownerId, plan] of pendingAnimations) {
      const stage = stageFor(app.querySelector(`[data-seat="${CSS.escape(String(ownerId))}"] .sprite`));
      const layer=app.querySelector('.fx-layer'),anchor=app.querySelector(`[data-seat="${CSS.escape(String(ownerId))}"] .sprite`),target=plan.targetId&&app.querySelector(`[data-eid="${CSS.escape(String(plan.targetId))}"]`);
      const effectTargets=combatEffectTargetIds(plan.spriteEffect,plan.effectEvents,ownerId).map(id=>app.querySelector(`[data-eid="${CSS.escape(String(id))}"] .sprite`)||app.querySelector(`[data-eid="${CSS.escape(String(id))}"]`)).filter(Boolean);
      const authoredTargets=presentationTargetIds(plan.effectEvents,ownerId,plan.spriteEffect?.bindingContext.objectId).map(id=>app.querySelector(`[data-eid="${CSS.escape(String(id))}"] .sprite`)||app.querySelector(`[data-eid="${CSS.escape(String(id))}"]`)).filter(Boolean);
      const pose = stage?.setRestPose ? plan.technique : plan.group === 'attack' ? 'attack' : plan.group === 'defend' ? 'guard' : 'idle';
      const duration = stage?.actionTiming?.(pose, ANIM_SPEEDS[getAnimSpeed()])?.totalMs ?? 420;
      if(layer&&anchor)playCombatEffectPlan(layer,anchorLocalBox(layer,anchor),plan.spriteEffect,{targets:effectTargets.map(el=>anchorLocalBox(layer,el)),authoredTargets:authoredTargets.map(el=>anchorLocalBox(layer,el)),duration,actor:anchor,localBox:anchorLocalBox});
      stage?.play(pose, duration, plan.aura);
    }
    lastSoundSeq = coopReceiptSounds(sc, lastSoundSeq, seats);
    spawnCombatFx(sc, prevCombat);
    prevCombat = sc;
    wireLeave();
  }

  // ---- map (THE act map, mounted with a co-op viewer) ------------------------
  function renderMap() {
    const member = snap.party.find(row => row.id === me);
    if (member?.classMasteryState?.initialTreeTiers?.length) {
      const treeRun = { ...member, class: member.classId };
      app.replaceChildren();
      return mountInitialClassMastery(app, { registries: registriesForClassMastery(registries, treeRun), run: treeRun, onChoose: nodeId => send({ t: 'chooseMasteryNode', nodeId }), onPersist: () => {}, onDone: render });
    }
    const map = snap.map;
    if (!map) { app.innerHTML = '<div class="screen"><div class="coop-note">Loading the path…</div></div>'; return; }

    // Fork voting: who has voted for which reachable node (2+ present members).
    const votes = snap.scene.votes || {};
    const votesByNode = {};
    for (const [pid, nid] of Object.entries(votes)) (votesByNode[nid] = votesByNode[nid] || []).push(pid);
    const present = snap.party.filter((p) => p.connected && p.alive);
    const voting = present.length > 1;
    // The vote count is a StatePill in the header (uppercase by the kit's
    // rule, never by the string); tools/coop-shoot.mjs reads it case-blind.
    const voteLine = voting
      ? html(pill({ label: Object.keys(votes).length ? `Votes ${Object.keys(votes).length}/${present.length}` : 'Vote for the path', on: true, attrs: { class: 'mh-stat coop-voteline' } }))
      : '';

    const smithReceipts = snap.party.filter((member) => member.lastSmithingReceipt);
    // The stones this seat's last treasure paid (SPEC §15.3), shown to a
    // present player here as the catch-up shows them to one who was away.
    const treasureStone = smithingStoneNote(myMember()?.treasureStoneReceipt, t);
    app.innerHTML = `
      <div class="mapscreen">
        <header class="topbar map-header">
          ${hudQuickSettingsHtml(hudQuickSettingsModel({
            place: 'map',
            presentation: registries.balance.ui.hudQuickSettings,
            settings: meta.settings || {},
          }))}
          <span class="mh-stat mh-prog">${snap.actNumber > 3 ? `Act ${snap.actNumber}` : `Act ${snap.actNumber} / 3`} · Floor ${snap.floor}</span>
          <span class="mh-stat mh-seed" title="Run seed">SEED ${esc(snap.seedString)}</span>
          ${voteLine}
          <div class="coop-partybar"></div>
          <div class="mh-actions"><button class="subtle coop-leave" id="coop-leave">Leave</button></div>
        </header>
        ${smithReceipts.length ? html(el('div', { class: 'as-kitline coop-smithing-receipts', 'aria-live': 'polite' }, smithReceipts.map((member) => {
          const receipt = member.lastSmithingReceipt;
          return kitItem({ glyph: '⚒', name: `${member.name} smithed ${receipt.armamentName} · tier ${receipt.beforeLevel}→${receipt.afterLevel} · ${receipt.cost} Stone · ${receipt.affectedCards.length} cards` });
        }))) : ''}
        ${treasureStone ? html(el('div', { class: 'as-kitline coop-treasure-stones', 'aria-live': 'polite' }, [kitItem({ glyph: '⚒', name: t('reward.stone.treasureNote', { note: treasureStone }) })])) : ''}
      </div>`;
    wireHudQuickSettings(app, { settings: meta.settings || {}, onSettingsChange });

    if (mapBoard) mapBoard.teardown();
    mapBoard = mountMapBoard(app.querySelector('.mapscreen'), {
      // THE MAP. Every field comes off the snapshot, so the host and every
      // client draw one act. `columns` was MISSING from `tools/session.mjs`'s
      // `snapshot()` until this commit — the comment here said it was read while
      // the producer had never sent it, and `?shot=coopmap` handed it a canned
      // snapshot that DID carry the field, so the harness was green about a value
      // no real host had ever produced. Fixed at the producer; the board still
      // warns by name for an older host, because a silent fallback is what let
      // this sit.
      act: {
        seedString: snap.seedString, nodes: map.nodes, columns: map.columns, actNumber: snap.actNumber,
        // The map title is `ACT <tier> — <SEAT>` (SPEC §13.2). The board has
        // read `act.seatName` since seats landed; this screen never passed it,
        // so co-op's map plate said a bare "ACT II" while solo named the seat.
        // Null for an older host that does not send it — actTitle() already
        // falls back to the bare plate rather than printing "undefined".
        seatName: snap.seatName || null,
        startIds: map.startIds, bossId: map.bossId, bossIds: map.bossIds,
      },
      // THE VIEWER — the half that is legitimately different on every screen.
      viewer: {
        // The player's own map-zoom preference. Mine, not the party's: nothing
        // syncs a camera and nothing should.
        meta,
        reachable: new Set(snap.reachableIds),
        // WHERE THE PARTY IS STANDING. `cursorId` has always been on the
        // snapshot and this screen never drew it, so a co-op player could not
        // see their own position — solo has marked it `current` since it
        // shipped. One field, read.
        current: snap.cursorId || null,
        // FOG IS OFF HERE, AND IT IS A SNAPSHOT GAP, NOT A CHOICE. The ladder
        // (model/mapknowledge.js) lights the trail behind you from `run.path`,
        // and `snapshot()` sends no path — so asking for fog would hide ground
        // the party has already walked. Until the host sends `path`, a co-op
        // client is honestly in `path` mode while a solo player now defaults to
        // fog, which means two people in one game know different amounts of it.
        // Named here so it is a card and not a surprise.
        mode: 'path',
        // Whose vote rides which node — the ONE thing two clients rendering the
        // same snapshot MUST draw differently. A mark and a class, not a second
        // renderer.
        classes: (n) => ((votesByNode[n.id] || []).includes(me) ? 'my-vote' : ''),
        mark: (n, geom) => {
          const voters = votesByNode[n.id] || [];
          if (!voters.length) return '';
          const glyphs = voters.map((pid) => classGlyph((snap.party.find((p) => p.id === pid) || {}).classId)).join('');
          return `<text class="vote-pips" x="${geom.x}" y="${geom.y - geom.r - 8}" text-anchor="middle" font-size="12" fill="var(--gold)">${glyphs}</text>`;
        },
        tooltip: (n, { shownType, reachable }) =>
          `<div class="tt-title">${esc(nodeName(shownType))}</div>${nodeBlurb(shownType)}`
            + (shownType === 'boss' && n.destinationLabel ? `<br><strong>${esc(n.destinationLabel)}</strong>` : '')
            + (reachable ? '<br>Click to vote for this path.' : ''),
        onPick: (id) => send({ t: 'chooseNode', nodeId: id }),
      },
    });
    mapBoard.recenter();
    renderPartyBar();
    wireLeave();
    if(member?.classRespecAvailable){const action=button({label:t('classRespec.title')});action.addEventListener('click',()=>send({t:'classRespecPreview',as:me}));app.querySelector('.mh-actions').prepend(action);}
    if(member?.classRespec)mountClassRespec({registries,view:member.classRespec,
      onPreview:input=>send({t:'classRespecPreview',as:me,draftId:member.classRespec.draftId,...input}),
      onApply:()=>{send({t:'classRespecApply',as:me,draftId:member.classRespec.draftId});return {ok:false};},
      onCancel:()=>send({t:'classRespecCancel',as:me,draftId:member.classRespec.draftId})});
  }

  // Compact party read-out in the map header (names + HP + presence): the
  // kit's party strip — one Member per seat, its glyph in its tint and an
  // inline HP Meter labelled with its name.
  const partyStrip = (attrs = {}) => el('div', { ...attrs, class: `as-party ${attrs.class || ''}`.trim(), role: 'group', 'aria-label': 'The party' });
  function renderPartyBar() {
    const bar = app.querySelector('.coop-partybar');
    if (!bar) return;
    bar.innerHTML = '';
    for (const p of snap.party) {
      const state = p.id === me ? 'me' : !p.connected ? 'away' : !p.alive ? 'dead' : '';
      bar.appendChild(el('span', { class: `as-member coop-pc${state ? ` ${state}` : ''}`, dataset: { pc: p.id, ...(state ? { state } : {}) } }, [
        kitGlyph(classGlyph(p.classId), { class: 'coop-pc-glyph', style: { color: tintCss(p.tint) } }),
        // The kit's one Meter (a plate beside a well). A party member reads as
        // name + hp over a short track, so the plate rides INSIDE the track
        // (`inset`) and the surface derives the fill the atom draws.
        meter({
          inset: true, tone: 'hp', label: p.name, value: `${Math.max(0, p.hp)}/${p.maxHp}`,
          cur: Math.max(0, p.hp), max: p.maxHp,
          pct: p.maxHp > 0 ? (Math.max(0, p.hp) / p.maxHp) * 100 : 0,
          attrs: { class: 'coop-pc-hp' },
        }),
      ]));
    }
    bar.querySelectorAll('.coop-pc').forEach((member) => {
      const p = snap.party.find((x) => x.id === member.dataset.pc);
      if (p) attachTooltip(member, () => {
        const cls = registries.classes.get(p.classId);
        return `<div class="tt-title">${esc(p.name)} — ${esc(cls ? cls.name : p.classId)}</div>` +
          `HP ${p.hp}/${p.maxHp} · ⛁ ${p.cinders ?? 0} · deck ${p.deckSize ?? '?'} · relics ${p.relics ?? 0}` +
          `${p.connected ? '' : '<br><b>Away</b> — missed rewards queue for their return.'}${p.alive ? '' : '<br><b>Fallen.</b>'}`;
      });
    });
  }

  // ---- reward / shrine / event (reuse renderCard + the kit's decision door) --
  // EVERY SCENE THAT ASKS THE SEAT SOMETHING IS BODY C ON THE PAGE: the party
  // strip above, a door whose head names the scene, a decide body (Title·L
  // + ornament, Flavour for a note, the shared renderCard row, OptionCards
  // for the ways on), and Leave on the foot's ladder. One shell, five scenes.
  function sceneDoor({ title, eyebrow: eb = 'Forsaken Together', children = [], note = '' }) {
    const leave = button({ label: 'Leave', role: 'exit', id: 'coop-leave' });
    const door = pageDoor({
      eyebrow: eb, title, size: 'md', className: 'coop-door',
      body: decide({ title, children: [note ? flavour(note, { class: 'coop-note' }) : null, ...children] }),
      secondary: [leave], footSize: 'short',
    });
    app.innerHTML = '';
    app.appendChild(el('div', { class: 'screen coop-scene' }, [partyStrip({ class: 'coop-partybar' }), door]));
    renderPartyBar();
    wireLeave();
    return door;
  }
  const waiting = (text) => flavour(text, { class: 'coop-note' });
  /** A way on: the kit's OptionCard, no chevron, with the seat's data hooks. */
  function choice({ name, description = '', glyph: g = '', disabled = false, reason = '', attrs = {}, className = '' }) {
    const card = optionCard({ glyph: g, name, description, arrow: false, disabled, attrs, className });
    if (reason) attachTooltip(card, () => esc(reason));
    return card;
  }
  function abilityDraftStrips(offer,{catchup=false,progressionPopup=false}={}) {
    return (offer.skillDrafts || []).flatMap(row=>{
      const grid=el('div',{class:'reward-row'});
      for(const choiceId of row.choiceIds || row.cardIds){
        const pick=abilityDraftChoice(row,choiceId);if(!pick)continue;
        const card=renderCard(memberRegistries(),{cardId:pick.cardId,abilityRank:pick.abilityRank,upgraded:false},{});
        card.classList.add('coop-progression-choice');card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`Choose ${registries.cards.get(pick.cardId).name}, rank ${pick.abilityRank}`);
        const take=()=>send({t:'chooseAbilityDraft',offerId:row.offerId,choiceId:pick.choiceId,catchup},{progressionPopup});
        card.addEventListener('click',take);card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();take();}});grid.appendChild(card);
      }
      return [subtitle(`${row.skillId==='combatManeuvers'?'Combat Maneuvers':'Spellcraft'} · Level ${row.level}`),grid];
    });
  }
  function progressionChoices(progression,{progressionPopup=false}={}){
    const children=abilityDraftStrips(progression,{progressionPopup});
    for(const row of progression.classMilestoneRewards || []){
      children.push(subtitle(`Class level ${row.level} · ${({cards:'Card',feat:t('progression.feat'),armory:'Equipment',relic:'Relic',attribute:'Attribute'})[row.rewardKind]}`));
      const grid=el('div',{class:row.rewardKind==='cards'?'reward-row':'coop-choices'});
      for(const [index,id] of row.options.entries()){
        const selection=row.choiceIds?.[index] || id,rank=row.abilityRanks?.[index],name=classRespecOptionName(registries,row.rewardKind,id,rank);
        const option=row.rewardKind==='cards'?renderCard(memberRegistries(),{cardId:id,upgraded:false,...(Number.isInteger(rank)?{abilityRank:rank}:{})},{}):button({label:name});
        option.classList.add('coop-progression-choice');option.tabIndex=0;option.setAttribute('role','button');option.setAttribute('aria-label',`Choose ${name}`);
        const take=()=>send({t:'chooseClassMilestone',receiptId:row.receiptId,selection},{progressionPopup});option.addEventListener('click',take);
        if(row.rewardKind==='cards')option.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();take();}});
        grid.append(option);
      }
      children.push(grid);
    }
    for(const row of progression.levelCards || []){const grid=el('div',{class:'reward-row'});children.push(subtitle(`Character level ${row.level} · Card`),grid);for(const id of row.cardIds){const card=renderCard(registries,{cardId:id,upgraded:false},{});card.classList.add('coop-progression-choice');card.tabIndex=0;card.setAttribute('role','button');const take=()=>send({t:'chooseLevelCard',key:row.key,cardId:id},{progressionPopup});card.addEventListener('click',take);card.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();take();}});grid.append(card);}}
    return children;
  }
  function renderProgression(){
    const member=myMember();if(member?.progressionRulesVersion!==1||['combat','complete','lobby'].includes(snap.scene.kind)){disposeProgression();return;}
    if(progressionSeat!==me){disposeProgression();progressionSeat=me;progressionHost=el('div');}
    const doorBody=app.querySelector('.coop-scene > .as-pagedoor > .modal-body');
    const section=el('section',{class:doorBody?'as-decide coop-progression':'as-body coop-progression','aria-label':t('reward.progress.heading')},[progressionHost,...(progressionError?[blocker(progressionError)]:[]),...progressionChoices(member.pendingProgression || {})]);
    // The page door owns one scrollable body. A sibling flex body can shrink
    // that door to its header/footer on phones, clipping Continue entirely.
    (doorBody || app.querySelector('.coop-scene') || app).append(section);
    if(!progressionDoor){
      progressionDoor=mountCoopProgressionDoor(progressionHost,{registries,member,
        settings:{xpFillSeconds:Number(meta.settings?.victoryXpSeconds ?? 3),levelUpRefillSeconds:Number(meta.settings?.levelUpRefillSeconds ?? .28)},
        onClaim:skillId=>send({t:'claimSkillLevel',skillId}),
        onReadyChange:ready=>gateCoopProgressionControls(app,ready),
        onChoices:(rows,resume)=>{
          const continueButton=button({label:t('reward.continue'),weight:'primary'}),seatAtOpen=me;
          let lastRows=rows,popupError='';
          const dialog=openModal({title:t('reward.level.choice.title'),eyebrow:t('reward.level.eyebrow'),primary:continueButton,onClose:resume});
          const update=nextRows=>{
            if(me!==seatAtOpen)return;
            lastRows=nextRows;
            const progression={};for(const {kind,row}of nextRows)(progression[kind] ||= []).push(row);
            dialog.body.replaceChildren(...(popupError?[blocker(popupError)]:[]),...progressionChoices(progression,{progressionPopup:true}));
            if(!nextRows.length)dialog.body.append(prose('Your rewards have been claimed.'));
          };
          continueButton.addEventListener('click',dialog.close);update(rows);
          return {update,close:dialog.close,rejectClaim:reason=>{popupError=reason || 'This reward could not be saved.';update(lastRows);}};
        },
      });
    }else progressionDoor.update(member);
    gateCoopProgressionControls(app,progressionDoor.ready);
  }
  function renderReward() {
    const offer = snap.scene.offers[me];
    if (!offer) { sceneDoor({ title: 'Spoils', children: [waiting('Waiting for the others to choose…')] }); return; }
    const stone = offer.smithingStoneReceipt;
    const grid = el('div', { class: 'reward-row' });
    const levelCardIds = levelPicks.picksFor(`${me}|reward|${snap.floor ?? ''}`, offer);
    let pick = { cardId: null, takeRelic: false, flask: false, levelCardIds };
    const submit = () => send({ t: 'chooseReward', pick });
    const levelStrips = levelCardStrips(registries, offer, levelCardIds);
    offer.cardIds.forEach((cid) => {
      const card = renderCard(registries, { cardId: cid, upgraded: false }, {});
      card.addEventListener('click', () => { pick.cardId = cid; submit(); });
      grid.appendChild(card);
    });
    const takes = [
      offer.relicId ? choice({ glyph: '◆', name: 'Take the relic', description: registries.relics.get(offer.relicId).name, className: 'coop-take', attrs: { dataset: { take: 'relic' } } }) : null,
      offer.flaskId ? choice({ glyph: '⚗', name: 'Take the flask', description: registries.flasks.get(offer.flaskId).name, className: 'coop-take', attrs: { dataset: { take: 'flask' } } }) : null,
      choice({ glyph: '›', name: myMember()?.progressionRulesVersion===1?t('reward.continue'):offer.cardIds.length ? 'Skip the card' : t('reward.continue'), attrs: { dataset: { take: 'skip' } } }),
    ];
    sceneDoor({
      title: `${String(snap.scene.pool || 'The').replace(/^./, (c) => c.toUpperCase())} spoils`,
      // Ordinary and refined stones (SPEC §15.3) on the one line, each when paid.
      note: smithingStoneNote(stone, t),
      children: [
        ...levelStrips,
        ...(levelStrips.length ? [el('p', { class: 'reward-note', dataset: { note: 'levelCardAuto' }, text: t('reward.note.levelCardAuto') })] : []),
        ...(offer.cardIds.length ? [subtitle(t('reward.card.eyebrow')), grid] : []),
        ...(offer.cardMissed ? [el('p', { class: 'reward-note', dataset: { note: 'cardMissed' }, text: t('reward.note.cardMissed') })] : []),
        options(takes, { class: 'coop-choices' }),
      ],
    });
    app.querySelectorAll('[data-take]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.take === 'relic') pick.takeRelic = true; else if (b.dataset.take === 'flask') pick.flask = true; submit(); }));
  }
  function renderShrine() {
    const done = snap.scene.done && snap.scene.done[me];
    const allies = snap.party.filter((p) => p.id !== me && p.alive && p.connected);
    const mm = myMember();
    const smith = snap.scene.smithing?.[me];
    const candidates = smith?.candidates || [];
    const stones = mm?.smithingStones || 0;
    // The host's word on this member's Rest (tools/session.mjs restView): what
    // it restores here, or the relic that forbids it — the option is disabled
    // with the reason rather than sent to be refused.
    const rest = snap.scene.rest?.[me] || null;
    const restDenied = rest?.denied || '';
    const restCopy = rest && !restDenied ? `Heal ${rest.heal} HP${rest.mana > 0 ? ` and restore ${rest.mana} Mana` : ''}.` : 'Heal yourself.';
    sceneDoor({
      title: 'Shrine of Emberlight',
      children: done ? [waiting('Waiting for the party…')] : [options([
        choice({ glyph: '✚', name: 'Rest', description: restDenied ? `The ${restDenied} will not let you rest here.` : restCopy, disabled: !!restDenied, reason: restDenied ? `The ${restDenied} will not let you rest here.` : '', attrs: restDenied ? {} : { dataset: { shrine: 'rest' } } }),
        choice({ glyph: '⚒', name: 'Upgrade an item', description: `${stones} Stone${stones === 1 ? '' : 's'}`, disabled: !candidates.length, reason: candidates.length ? '' : 'Nothing here can be upgraded.', attrs: { id: 'coop-smith' } }),
        ...allies.map((a) => choice({ glyph: '❤', name: `Mend ${a.name}`, description: '+30% HP', className: 'coop-take', attrs: { dataset: { mend: a.id } } })),
        // A denied Rest is not a way on: the member leaves instead, and the
        // host counts the leave as their choice (as the solo screen's LEAVE).
        ...(restDenied ? [choice({ glyph: '→', name: 'Leave', description: 'Take nothing here and move on with the party.', attrs: { dataset: { shrine: 'leave' } } })] : []),
      ], { class: 'coop-choices' })],
    });
    app.querySelectorAll('[data-shrine]').forEach((b) => b.addEventListener('click', () => send({ t: 'shrineChoice', choice: b.dataset.shrine })));
    app.querySelectorAll('[data-mend]').forEach((b) => b.addEventListener('click', () => send({ t: 'shrineChoice', choice: 'mend', targetId: b.dataset.mend })));
    // The shared modal keeps the co-op transaction identical to solo:
    // reversible selection, every real delta, explicit affordability, then a
    // separate Confirm. The client sends only that final stable item ref;
    // the host still rebuilds and revalidates before committing.
    const smithBtn = app.querySelector('#coop-smith');
    if (smithBtn && candidates.length) smithBtn.addEventListener('click', () => {
      let selectedItemRef = null;
      const model = () => smithSelectionModel(registries, smith, selectedItemRef);
      const modal = mountSmithUpgradeModal(app, model(), {
        registries,
        meta,
        returnFocusElement: smithBtn,
        onSelect: (itemRef) => {
          selectedItemRef = itemRef;
          modal.update(model());
        },
        onBack: () => {},
        onConfirm: (itemRef) => send({ t: 'shrineChoice', choice: 'smith', targetId: itemRef }),
      });
    });
  }
  /** An authored choice as a card; a priced one the seat cannot pay is drawn disabled and says why. */
  function eventChoice(c, i, purse, datasetKey) {
    const need = c.requires && typeof c.requires.cinders === 'number' ? c.requires.cinders : null;
    const short = need != null && purse < need;
    return choice({
      name: c.label || c.text || 'Choose',
      disabled: short, reason: short ? `Needs ${need} cinders` : '',
      attrs: { dataset: { [datasetKey]: String(i), ...(short ? { requires: '1' } : {}) } },
    });
  }
  function renderEvent() {
    const done = snap.scene.done && snap.scene.done[me];
    let ev = null; try { ev = registries.events.get(snap.scene.eventId); } catch { /* unknown */ }
    // THE RESULT SHOWS BEFORE THE ROOM MOVES ON: every seat reads its own
    // result first and asks for what follows — STEEL YOURSELF when the
    // choice bought a fight, CONTINUE otherwise; the host opens the shared
    // combat, or advances, once every present seat has (DEVELOPER.md's
    // event contract — control passes on after resultText shows).
    if (snap.scene.next) {
      const text = (snap.scene.results && snap.scene.results[me]) || '';
      const acked = !!(snap.scene.ack && snap.scene.ack[me]);
      // A FALLEN SEAT IS NOT IN THIS EVENT, and must not be handed a control
      // that cannot work. The host refuses `eventContinue` from a member whose
      // `alive` is false, and `settleEvent` waits only on connectedMembers()
      // — which is `connected && alive` — so this seat's ack is never wanted
      // and never arrives. The result: `acked` stays false forever, and the
      // branch below drew CONTINUE for a click the host answers by
      // rebroadcasting the same snapshot, leaving the button exactly where it
      // was. Every other surface in this file already asks `alive` before
      // offering an action (the flask menu, card affordability, targeting,
      // End Turn); the event result was the one that did not.
      const fallen = !(myMember() || {}).alive;
      sceneDoor({
        title: ev ? ev.name : 'A Happening',
        children: [
          prose(text, { class: 'coop-event-result' }),
          fallen ? waiting('You have fallen. The party reads on without you.')
            : acked ? waiting('Waiting for the party…') : options([
            choice({ glyph: '›', name: snap.scene.next.kind === 'combat' ? 'Steel yourself' : 'Continue', attrs: { dataset: { evContinue: '1' } } }),
          ], { class: 'coop-choices' }),
        ],
      });
      const go = app.querySelector('[data-ev-continue]');
      if (go) go.addEventListener('click', () => send({ t: 'eventContinue' }));
      return;
    }
    const purse = (myMember() || {}).cinders ?? 0;
    const cards = (ev && ev.choices ? ev.choices : [{ label: 'Continue' }]).map((c, i) => ({ c, i }))
      // Only the choices this seat's history admits (scene.open, by authored
      // index, from the host); a gated choice drawn here would be refused
      // with no visible answer. No projection = every authored choice.
      .filter(({ i }) => !(snap.scene.open && Array.isArray(snap.scene.open[me])) || snap.scene.open[me].includes(i))
      // A PRICED CHOICE THE SEAT CANNOT AFFORD IS DRAWN DISABLED, the solo
      // event screen's `meets` rule read off this seat's snapshot purse: the
      // host refuses it, and a refusal only rebroadcasts the same snapshot,
      // so an enabled button here would be one that does nothing.
      .map(({ c, i }) => eventChoice(c, i, purse, 'ev'));
    sceneDoor({
      title: ev ? ev.name : 'A Happening',
      children: [done ? waiting('Waiting for the party…') : options(cards, { class: 'coop-choices' })],
    });
    app.querySelectorAll('[data-ev]').forEach((b) => b.addEventListener('click', () => send({ t: 'eventChoice', choiceIndex: Number(b.dataset.ev) })));
  }

  // ---- catch-up + complete --------------------------------------------------
  // A MISSED EVENT IS CHOSEN THE WAY A LIVE ONE IS: the choices the seat's
  // history admitted when the party met it, priced ones disabled when short,
  // and the choice's result read before the next debt (DEVELOPER.md's event
  // contract). The pick is sent the moment it is made and the host keeps the
  // entry at the head of the queue, marked done with its result, until the
  // seat continues — so a reload between the choice and CONTINUE shows the
  // result again, never the choices (Codex on #549).
  function renderCatchup(mm) {
    const item = mm.catchupQueue[0];
    const remaining = mm.catchupQueue.length;
    const title = 'Ember debt';
    const debt = `${remaining} missed`;
    if (item.type === 'event') {
      let ev = null; try { ev = registries.events.get(item.eventId); } catch { ev = null; }
      const admitted = (ev && ev.choices ? ev.choices : []).map((c, i) => ({ c, i }))
        .filter(({ i }) => !Array.isArray(item.open) || item.open.includes(i));
      if (item.done) {
        sceneDoor({
          title, eyebrow: debt,
          children: [
            prose(item.done.resultText || '', { class: 'coop-event-result' }),
            options([choice({ glyph: '›', name: 'Continue', attrs: { dataset: { cuGo: '1' } } })], { class: 'coop-choices' }),
          ],
        });
        const go = app.querySelector('[data-cu-go]');
        if (go) go.addEventListener('click', () => send({ t: 'catchupChoice', index: 0, pick: { continue: true } }));
        return;
      }
      // The purse the seat had when the party met the event, and the one in hand.
      const purse = Math.min(mm.cinders ?? 0, typeof item.purse === 'number' ? item.purse : (mm.cinders ?? 0));
      const cards = admitted.map(({ c, i }) => eventChoice(c, i, purse, 'cuEv'));
      sceneDoor({
        title, eyebrow: debt,
        note: `The party met ${ev ? ev.name : 'a happening'} while you were away. Make the choice you would have made.`,
        children: [
          ev && ev.text ? prose(ev.text, { class: 'coop-event-result' }) : null,
          options(cards.length ? cards : [choice({ glyph: '›', name: 'Continue', attrs: { dataset: { cuEv: '-1' } } })], { class: 'coop-choices' }),
        ],
      });
      app.querySelectorAll('[data-cu-ev]').forEach((b) => b.addEventListener('click', () => {
        const choiceIndex = Number(b.dataset.cuEv);
        send({ t: 'catchupChoice', index: 0, pick: choiceIndex < 0 ? {} : { choiceIndex } });
      }));
      return;
    }
    const grid = item.type === 'reward' && item.offer.cardIds.length ? el('div', { class: 'reward-row' }) : null;
    const relic = (item.type === 'reward' && item.offer.relicId) || (item.type === 'treasure' && item.relicId);
    // The stones were granted when the party earned them; the catch-up says so.
    const stoneNote = smithingStoneNote(item.type === 'reward' ? item.offer.smithingStoneReceipt : item.smithingStoneReceipt, t);
    const levelCardIds = item.type === 'reward' ? levelPicks.picksFor(`${me}|catchup|${remaining}`, item.offer) : {};
    const levelStrips = item.type === 'reward' ? levelCardStrips(registries, item.offer, levelCardIds) : [];
    sceneDoor({
      title, eyebrow: debt,
      note: ['Claim what you would have earned while away.', stoneNote].filter(Boolean).join(' '),
      children: [
        ...levelStrips,
        grid,
        item.type === 'reward' && item.offer.cardMissed ? el('p', { class: 'reward-note', dataset: { note: 'cardMissed' }, text: t('reward.note.cardMissed') }) : null,
        options([
          relic ? choice({ glyph: '◆', name: 'Take the relic', className: 'coop-take', attrs: { dataset: { cu: 'relic' } } }) : null,
          choice({ glyph: '›', name: mm.progressionRulesVersion===1?t('reward.continue'):'Skip', attrs: { dataset: { cu: 'skip' } } }),
        ], { class: 'coop-choices' }),
      ],
    });
    // Every closing choice carries the level-card picks made above.
    const resolve = (pick) => send({ t: 'catchupChoice', index: 0, pick: levelStrips.length ? { ...pick, levelCardIds } : pick });
    if (grid) {
      item.offer.cardIds.forEach((cid) => { const card = renderCard(registries, { cardId: cid, upgraded: false }, {}); card.addEventListener('click', () => resolve({ cardId: cid })); grid.appendChild(card); });
    }
    app.querySelectorAll('[data-cu]').forEach((b) => b.addEventListener('click', () => resolve(b.dataset.cu === 'relic' ? { takeRelic: true } : {})));
  }
  function renderComplete() {
    const win = snap.scene.victory;
    const leave = button({ label: 'Return to the fire', weight: 'primary', id: 'coop-leave2' });
    const door = pageDoor({
      eyebrow: 'Forsaken Together', title: win ? 'Victory' : 'Defeat', size: 'md', className: 'coop-door',
      body: decide({ title: win ? 'The Spire is yours' : 'The party has fallen', children: [buttonRow({ size: 'long', buttons: [leave] })] }),
    });
    if (!win) door.querySelector('.as-title-l').dataset.tone = 'loss';
    app.innerHTML = '';
    app.appendChild(el('div', { class: 'screen coop-scene' }, door));
    leave.addEventListener('click', () => { teardown(); conn.close(); onLeave(); });
  }

  // ---- enemy-turn pacing -----------------------------------------------------
  // A turn-advancing snapshot means the whole enemy phase resolved server-side.
  // Instead of jumping to the result, hold the old board, announce ENEMY TURN,
  // lunge each acting enemy in order, THEN land the new state — whose diff-FX
  // spawns all the damage/block floats at once.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function receiveSnapshot(s) {
    void bankOwnedLearning(s);
    latestWireSnap = s;
    if (reactionShell && reactionOfferId !== s.scene?.reactionWaiting?.id) reactionShell.dismiss();
    receivedSnapshots += 1;
    if (pacing) {
      const seq = s.scene?.kind === 'combat' ? Number(s.scene.receiptSeq) || 0 : 0;
      const duplicate = seq > 0 && pendingSnaps.some((entry) => entry.scene?.receiptSeq === seq);
      if (!duplicate) pendingSnaps.push(s);
      return;
    }
    const sc = s.scene;
    if (sc?.kind === 'combat' && prevCombat && app.querySelector('.combat.coop')
      && (sc.events || []).some(event => ['enemyMoveStarted', 'enemyActorTurnStarted', 'combatCounterTriggered'].includes(event.type))) {
      paceReactionReceipts(s);
      return;
    }
    const moves = sc && sc.kind === 'combat' && sc.events ? sc.events.filter((e) => e.type === 'enemyMoveStarted') : [];
    if (moves.length && prevCombat && sc.turn > prevCombat.turn && app.querySelector('.combat.coop')) {
      paceEnemyTurn(s, moves);
      return;
    }
    snap = s;
    render();
  }

  async function paceEnemyTurn(s, moves) {
    pacing = true;
    try {
      const combat = app.querySelector('.combat');
      combat.dataset.turn = 'enemy';
      combat.querySelector('.turn-ribbon').textContent = 'Enemy Turn';
      combat.querySelector('.hand').inert = true;
      combat.querySelector('.end-turn').disabled = true;
      await sleep(650);
      for (const mv of moves) {
        const box = app.querySelector(`[data-eid="${mv.sourceId}"]`);
        if (box && !box.classList.contains('dead')) {
          const stage = stageFor(box);
          const enemyId = mv.enemyId || prevCombat.enemies.find(enemy => enemy.id === mv.sourceId)?.enemyId;
          const definition = registries.enemies.get(enemyId)?.moves?.[mv.moveId];
          const plan = resolveActionAnimation({ actorId: enemyId, actionId: mv.moveId,
            tags: definition?.tags || [], intent: mv.kind, availablePoses: stage?.poses || [] });
          const pose = enemyActionPose(mv.kind, plan);
          stage?.play(pose, 400);
          if (pose === 'attack') {
            const sprite = box.querySelector('.sprite');
            sprite?.classList.add('enemy-attack-pose');
            setTimeout(() => sprite?.classList.remove('enemy-attack-pose'), 400);
          }
          box.classList.add('acting');
          setTimeout(() => box.classList.remove('acting'), 420);
        }
        await sleep(400);
      }
      await sleep(160);
    } finally {
      const frames = [s, ...pendingSnaps];
      pendingSnaps = [];
      const unique = [];
      const seenReceiptSeqs = new Set();
      for (const frame of frames) {
        const seq = frame.scene?.kind === 'combat' ? Number(frame.scene.receiptSeq) || 0 : 0;
        if (seq > 0 && seenReceiptSeqs.has(seq)) continue;
        if (seq > 0) seenReceiptSeqs.add(seq);
        unique.push(frame);
      }
      const latest = unique[unique.length - 1] || s;
      const combatFrames = unique.filter((frame) => frame.scene?.kind === 'combat');
      // A FIGHT THAT ENDED WHILE ITS ENEMY TURN WAS PACED draws only the
      // scene that replaced it, so the held combat frames are never rendered:
      // their haptics (an enemy's hit on this seat, its next turn start)
      // play here, before that scene. Their sound was never played on this
      // path, and still is not.
      if (latest.scene?.kind !== 'combat') {
        for (const frame of combatFrames) lastSoundSeq = coopReceiptSounds(frame.scene, lastSoundSeq, seats, { hapticsOnly: true });
      }
      snap = combatFrames.length === unique.length && combatFrames.length > 1
        ? {
            ...latest,
            scene: {
              ...latest.scene,
              events: combatFrames.flatMap((frame) => frame.scene.events || []),
            },
          }
        : latest;
      pacing = false;
      render();
    }
  }

  function paceReactionReceipts(next) {
    pacing = true;
    const working = structuredClone(snap);
    working.scene.events = [];
    const events = (next.scene.events || []).map(event => ({ ...event,
      sourceId: event.sourceId === 'player' ? event.sourcePlayerId || event.playerId : event.sourceId,
      targetId: event.targetId === 'player' ? event.targetPlayerId || event.playerId : event.targetId }));
    const anchorFor = id => app.querySelector(`[data-seat="${CSS.escape(String(id))}"] .sprite`)
      || app.querySelector(`[data-eid="${CSS.escape(String(id))}"] .sprite`);
    const entityFor = id => [...working.scene.enemies, ...working.scene.players].find(entity => entity.id === id);
    const apply = beat => {
      for (const event of beat.events) {
        if (Number.isSafeInteger(event.eventIndex) && event.eventIndex >= 0)
          working.scene.combatLog = (next.scene.combatLog || []).filter(entry => entry.id <= event.eventIndex);
        const target = entityFor(event.targetId);
        if (event.type === 'hpLost' && target) target.hp = Math.max(0, target.hp - event.amount);
        if (event.type === 'healed' && target) target.hp = Math.min(target.maxHp, target.hp + event.amount);
        if (event.type === 'blockGained' && target) target.block += event.amount;
        if (event.type === 'damageDealt' && target) {
          target.hp = Math.max(0, target.hp - Math.max(0, event.amount - (event.blocked || 0)));
          if (event.blockRemaining !== undefined) target.block = event.blockRemaining;
        }
        if (event.type === 'cardPlayed') {
          const owner = entityFor(event.sourcePlayerId || event.playerId);
          if (owner) { owner.hand = owner.hand.filter(card => card.instanceId !== event.cardInstanceId);
            owner.energy -= event.staminaSpent ?? event.energySpent ?? 0; owner.mana -= event.manaSpent || 0; }
        }
        if (['cardDrawn', 'cardDiscarded', 'cardExhausted'].includes(event.type)) {
          const owner = entityFor(event.playerId || event.sourcePlayerId);
          if (owner && event.type !== 'cardDrawn') owner.hand = owner.hand.filter(card => card.instanceId !== event.cardInstanceId);
          const drawn = next.scene.players.find(player => player.id === owner?.id)?.hand.find(card => card.instanceId === event.cardInstanceId);
          if (owner && drawn && !owner.hand.some(card => card.instanceId === drawn.instanceId)) owner.hand.push(drawn);
        }
        if (event.type === 'enemyDied' && target) { target.hp = 0; target.alive = false; }
        if (event.type === 'impactDealt' && target && event.poiseMeter) target.poiseMeter = { ...event.poiseMeter };
        if (event.type === 'enemyActorTurnStarted') {
          const enemy = entityFor(event.sourceId);
          if (enemy) {
            delete enemy.executingCounterIntent;
            enemy.actorIntentRevealed = true; enemy.intent = event.intent;
            const profile = event.intent?.combatProfile || {};
            enemy.intentPreviews = Object.fromEntries(seats.map(id => [id, { ...event.intent, profile,
              stance: combatIntentStance(event.intent, profile), hidden: false, revealed: true }]));
          }
        }
        if (event.type === 'combatCounterTriggered' && event.sourceKind === 'enemy') {
          const enemy = entityFor(event.sourceId);
          if (enemy) enemy.executingCounterIntent = publicCounterIntent(event);
        }
      }
      snap = working; render();
    };
    snap = working; render();
    playTimeline(events, {
      get layer() { return app.querySelector('.fx-layer'); },
      get combatEl() { return app.querySelector('.combat'); }, anchorFor,
      maxActorAnimationMs(speed) {
        return Math.max(0, ...[...app.querySelectorAll('.sprite')].flatMap(sprite => {
          const stage = stageFor(sprite);
          return (stage?.poses || []).map(pose => stage.actionTiming?.(pose, speed)?.totalMs || 0);
        }));
      },
      animateActor(beat, sprite, speed) {
        const returned = beat.events.find(event => event.type === 'combatCounterTriggered');
        const played = returned?.sourceKind === 'player' ? returned : beat.events.find(event => event.type === 'cardPlayed');
        const moved = returned?.sourceKind === 'enemy' ? { ...returned, kind: 'attack' } : beat.events.find(event => event.type === 'enemyMoveStarted');
        if (!played && !moved) return null;
        const stage = stageFor(sprite);
        let pose = 'attack';
        if (played) {
          const ownerId = played.sourcePlayerId || played.playerId;
          const member = next.party.find(member => member.id === ownerId);
          const instance = played.cardInstance || working.scene.players.find(player => player.id === ownerId)?.hand.find(card => card.instanceId === played.cardInstanceId)
            || { cardId: played.cardId };
          let def = combatCardView({ registries: registriesForClassMastery(registries, { ...member, class: member?.classId }),
            player: working.scene.players.find(player => player.id === ownerId), combatExpansionVersion: next.scene.combatExpansionVersion,
            breakMeterVersion: next.scene.breakMeterVersion }, instance, played.upcastTier);
          if (returned) {
            const tags = (def.cardTags || def.tags || []).filter(tag => !tag.startsWith('kind:') && !tag.startsWith('maneuver:'));
            def = { ...def, type: 'attack', kindIds: ['classification.attack'], cardTags: [...tags, 'maneuver:attack'] };
          }
          const plan = resolveCombatAnimation(def, equippedPieces(registries, member?.loadout, member?.classId),
            { animation: equipmentAnimationForLoadout(registries, member?.loadout, member?.classId), classId: member?.classId,
              appearance: displayAppearance(), combatExpansionVersion: next.scene.combatExpansionVersion });
          sprite.dataset.actionFamily = plan.family;
          sprite.dataset.actionMotion = plan.motion;
          pose = stage?.setRestPose ? plan.technique : plan.group === 'attack' ? 'attack' : plan.group === 'defend' ? 'guard' : 'idle';
        } else {
          const definition = registries.enemies.get(moved.enemyId)?.moves?.[moved.moveId];
          const plan = resolveActionAnimation({ actorId: moved.enemyId, actionId: moved.moveId,
            tags: definition?.tags || [], intent: moved.kind, availablePoses: stage?.poses || [] });
          sprite.dataset.actionFamily = plan.family;
          sprite.dataset.actionMotion = plan.motion;
          pose = enemyActionPose(moved.kind, plan);
        }
        const timing = stage?.actionTiming?.(pose, speed);
        const duration = timing?.totalMs ?? speed.lungeMs;
        stage?.play(pose, duration);
        return { impactMs: timing?.impactMs ?? Math.min(speed.impactCapMs, duration / 2), totalMs: duration,
          cancel: () => stage?.settle?.() };
      },
      onBeatApplied: apply,
      onFlush() {
        animationReceiptSeq = Math.max(animationReceiptSeq, next.scene.receiptSeq || 0);
        lastSoundSeq = Math.max(lastSoundSeq, next.scene.receiptSeq || 0);
        lastReceiptSeq = Math.max(lastReceiptSeq, next.scene.receiptSeq || 0);
        snap = next; render();
      },
    }, () => {
      animationReceiptSeq = Math.max(animationReceiptSeq, next.scene.receiptSeq || 0);
      lastSoundSeq = Math.max(lastSoundSeq, next.scene.receiptSeq || 0);
      lastReceiptSeq = Math.max(lastReceiptSeq, next.scene.receiptSeq || 0);
      prevCombat = next.scene;
      snap = next;
      pacing = false;
      render();
      const queued = pendingSnaps; pendingSnaps = [];
      for (const pending of queued) receiveSnapshot(pending);
    });
  }

  function banner(text, small) {
    const node = kitBanner(text, { small: !!small, attrs: { class: 'coop-turn-banner' } });
    document.body.appendChild(node);
    setTimeout(() => node.remove(), small ? 900 : 1100);
  }

  // ---- snapshot-diff combat FX ---------------------------------------------
  // The client renders authoritative snapshots, so FX are derived by diffing
  // consecutive combat scenes: HP down -> damage float + hit recoil, block up ->
  // block float, HP up -> heal float, death -> crumble. Reuses the solo FX CSS.
  function spawnCombatFx(now, prev) {
    if (!prev) return;
    const layer = app.querySelector('.fx-layer');
    if (!layer) return;
    const put = (sel, cls, text, dy = 0.35, dx = 0, receiptRow = null) => {
      const anchor = app.querySelector(sel);
      if (!anchor) return;
      // Convert the anchor's on-screen box into the layer's local (pre-zoom)
      // coordinates, or the float lands at position×zoom (drifts left onto the
      // wrong enemy the further right the target is). See fx.js anchorLocalBox.
      const b = anchorLocalBox(layer, anchor);
      const el = document.createElement('div');
      el.className = cls;
      el.textContent = text;
      const centre = b.left + b.width / 2 + dx;
      const top = b.top + b.height * dy;
      el.style.left = `${centre}px`;
      el.style.top = `${top}px`;
      layer.appendChild(el);
      const half = el.offsetWidth / 2;
      const at = clampBox(
        { left: centre - half, top, width: el.offsetWidth, height: el.offsetHeight },
        anchorLocalBox(layer, layer),
        { pad: 6 },
      );
      el.style.left = `${at.left + half}px`;
      if (receiptRow) {
        receiptRow.baseTop = top;
        receiptRow.items.push(el);
      } else {
        el.style.top = `${at.top}px`;
      }
      setTimeout(() => el.remove(), 1100);
      return el;
    };
    const maxAnimationScale = (el) => {
      let scale = 1;
      for (const animation of el.getAnimations()) {
        for (const frame of animation.effect?.getKeyframes?.() || []) {
          if (!frame.transform || frame.transform === 'none') continue;
          try {
            const matrix = new DOMMatrixReadOnly(frame.transform);
            scale = Math.max(scale, Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
          } catch { /* an unparseable transform cannot reduce the measured box */ }
        }
      }
      return scale;
    };
    const layoutReceiptRows = (rowsByTarget) => {
      const view = anchorLocalBox(layer, layer);
      for (const rows of rowsByTarget.values()) {
        const all = rows.flatMap((row) => row.items);
        const gap = Math.max(2, ...all.map((el) => (parseFloat(getComputedStyle(el).fontSize) || 0) * 0.12));
        for (const row of rows) {
          row.height = Math.max(...row.items.map((el) => el.offsetHeight * maxAnimationScale(el)));
        }
        const height = rows.reduce((sum, row) => sum + row.height, 0) + gap * Math.max(0, rows.length - 1);
        let cursor = clampBox(
          { left: 0, top: rows[0].baseTop - height / 2, width: 0, height },
          view,
          { pad: 6 },
        ).top;
        for (const row of rows) {
          for (const el of row.items) el.style.top = `${cursor + row.height - el.offsetHeight}px`;
          cursor += row.height + gap;
        }
      }
    };
    const recoil = (sel, heavy) => {
      const box = app.querySelector(sel);
      if (!box) return;
      const duration = heavy ? 380 : 220;
      box.style.setProperty('--hurt-duration', `${duration}ms`);
      box.classList.remove('hitflash', 'hit-heavy', 'hit');
      void box.offsetWidth;
      if (!document.body.classList.contains('reduce-flashes')) box.classList.add('hitflash', heavy ? 'hit-heavy' : 'hit');
      playPoseOn(box, 'hit', duration);
    };
    // Authoritative receipts own hit floats. Snapshot deltas remain the home
    // for healing, guard gain and legacy non-attack HP changes only.
    const receiptLossByTarget = new Map();
    const receiptHealByTarget = new Map();
    // JSON resync creates a new object for an unchanged scene. The host's
    // receiptSeq, not local object identity, owns whether these receipts are new.
    const receiptSeq = Number(now.receiptSeq) || 0;
    const hasNewReceipts = receiptSeq > lastReceiptSeq;
    if(hasNewReceipts)for(const event of effectEvents){
      const effect=combatEffectForEvent(event);if(!effect)continue;
      const id=CSS.escape(String(effect.targetId));
      const anchor=app.querySelector('[data-eid="'+id+'"] .sprite')||app.querySelector('[data-eid="'+id+'"]')||app.querySelector('[data-seat="'+id+'"] .sprite');
      if(anchor)playCombatEffect(layer,anchorLocalBox(layer,anchor),effect.kind,{size:190});
    }
    const receipts = (hasNewReceipts ? (now.events || []) : [])
      .filter((ev) => ev.type === 'damageDealt' || ev.type === 'healed' || (ev.type === 'hpLost' && ev.cause !== 'attack'))
      .map((ev) => {
        const playerId = ev.playerId || (ev.targetId !== 'player' ? null : ev.targetId);
        const enemy = now.enemies.find((entry) => entry.id === ev.targetId);
        const sel = enemy ? `[data-eid="${enemy.id}"]` : playerId ? `[data-seat="${playerId}"]` : null;
        const targetKey = enemy ? `enemy:${enemy.id}` : playerId ? `player:${playerId}` : null;
        return { ev, sel, targetKey };
      })
      .filter((row) => row.sel && row.targetKey);
    const receiptRowsByTarget = new Map();
    for (const { ev, sel, targetKey } of receipts) {
      const receiptRow = { baseTop: 0, items: [], height: 0 };
      if (ev.type === 'healed') {
        const amount = Math.max(0, Number(ev.amount) || 0);
        if (!amount) continue;
        receiptHealByTarget.set(targetKey, (receiptHealByTarget.get(targetKey) || 0) + amount);
        const healingAnchor=app.querySelector(sel);if(healingAnchor)playCombatEffect(layer,anchorLocalBox(layer,healingAnchor),'heal');
        put(sel, 'float-num heal', `+${amount}`, 0.35, 0, receiptRow);
      } else if (ev.type === 'hpLost') {
        const amount = Math.max(0, Number(ev.amount) || 0);
        if (!amount) continue;
        const part = guardHitFloatParts({ amount, blocked: 0 }).damage;
        receiptLossByTarget.set(targetKey, (receiptLossByTarget.get(targetKey) || 0) + amount);
        put(sel, `float-num ${part.cls}`, part.text, 0.35, 0, receiptRow);
        recoil(`${sel} .sprite`, amount >= 12);
      } else {
        const parts = guardHitFloatParts(ev);
        receiptLossByTarget.set(targetKey, (receiptLossByTarget.get(targetKey) || 0) + parts.residual);
        const paired = !!(parts.guard && parts.damage);
        if (parts.guard) put(sel, `float-num ${parts.guard.cls}`, parts.guard.text, 0.35, paired ? -26 : 0, receiptRow);
        if (parts.guard && !parts.damage && targetKey.startsWith('enemy:')) {
          playPoseOn(app.querySelector(sel), 'guardHit', 220);
        }
        if (parts.damage) {
          put(sel, `float-num ${parts.damage.cls}`, parts.damage.text, 0.35, paired ? 26 : 0, receiptRow);
          recoil(`${sel} .sprite`, parts.residual >= 12);
        }
      }
      if (receiptRow.items.length) {
        if (!receiptRowsByTarget.has(targetKey)) receiptRowsByTarget.set(targetKey, []);
        receiptRowsByTarget.get(targetKey).push(receiptRow);
      }
    }
    layoutReceiptRows(receiptRowsByTarget);
    if (hasNewReceipts) lastReceiptSeq = receiptSeq;
    for (const e of now.enemies) {
      const pe = prev.enemies.find((x) => x.id === e.id);
      if (!pe) continue;
      const dmg = Math.max(0, pe.hp - e.hp);
      const unreceipted = Math.max(0, dmg - (receiptLossByTarget.get(`enemy:${e.id}`) || 0));
      if (unreceipted > 0) {
        put(`[data-eid="${e.id}"]`, unreceipted >= 12 ? 'float-num crit' : 'float-num dmg', `-${unreceipted}`);
        recoil(`[data-eid="${e.id}"] .sprite`, unreceipted >= 12);
      }
      if ((e.block || 0) > (pe.block || 0)) put(`[data-eid="${e.id}"]`, 'float-num blk small', `+${e.block - (pe.block || 0)}`);
      if (pe.hp > 0 && e.hp <= 0) {
        const b = app.querySelector(`[data-eid="${e.id}"] .sprite`);
        if (b) b.classList.add('crumble');
      }
    }
    for (const p of now.players) {
      const pp = prev.players.find((x) => x.id === p.id);
      if (!pp) continue;
      const dmg = Math.max(0, pp.hp - p.hp);
      const unreceipted = Math.max(0, dmg - (receiptLossByTarget.get(`player:${p.id}`) || 0));
      if (unreceipted > 0) {
        put(`[data-seat="${p.id}"]`, unreceipted >= 12 ? 'float-num heavy dmg' : 'float-num dmg', `-${unreceipted}`);
        recoil(`[data-seat="${p.id}"] .sprite`, unreceipted >= 12);
      }
      const heal = Math.max(0, p.hp - pp.hp);
      const unreceiptedHeal = Math.max(0, heal - (receiptHealByTarget.get(`player:${p.id}`) || 0));
      if (unreceiptedHeal > 0) put(`[data-seat="${p.id}"]`, 'float-num heal', `+${unreceiptedHeal}`);
      if ((p.block || 0) > (pp.block || 0)) put(`[data-seat="${p.id}"]`, 'float-num blk small', `+${p.block - (pp.block || 0)}`);
    }
  }

  if (conn.open) send({ t: 'resync' });
}
import { equipmentAnimationForLoadout } from '../../model/equipmentAnimation.js';
