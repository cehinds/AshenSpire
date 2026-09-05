// src/ui/screens/combat.js — the combat screen (SPEC §7.2–7.4, mockup:
// docs/mockups/combat-screen.svg)
//
// Renders strictly from combat state; animates from dispatch events. Every
// number displayed comes from previewCard / previewIntent — no math here.

import { dispatch, previewCard, previewIntent, getEntity } from '../../engine/combat.js';
import { resolveCard } from '../../model/registries.js';
import { openPileModal } from '../components/piles.js';
import { attachTooltip, ensureTooltip, hideTooltip, showTooltipFor, showTooltipForRect, esc } from '../components/tooltip.js';
import { combatantDetailBody } from '../components/combatantInspector.js';
import { relicText } from '../components/card.js';
import { enemySprite, playerSprite, spritesAreEnabled } from '../assets.js';
import { animateEvents, playTimeline, anchorLocalBox, viewportLocalBox, clampBox, VIEWPORT_ORIGIN } from '../fx.js';
import { figureSpec } from '../../model/loadout.js';
import {
  isReaverAttackEligible,
  playReaverAttack,
  preloadReaverAttackFrames,
  reaverAttackTiming,
} from '../reaverAttack.js';
import { intentBadge, backdropClass, MENU, statusTooltipText, statusInstancePresentation, statusInstanceSemanticAttrs } from '../uiContent.js';
import { openQuickNav, quickNavMode, saveAction } from '../components/quicknav.js';
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
import { resourceBars } from '../components/resbars.js';
import { renderArcaneExposure } from '../components/arcaneExposure.js';
import { resourceBarPlan, resourceDomains } from '../../model/resources.js';
import { beatArmer } from '../../framework/optionDecision.js';
import { flaskActionPlan } from '../../model/flaskActions.js';
import { flaskIdentityHtml, flaskTooltipHtml, mountFlaskActionMenu } from '../components/flask.js';
import { CHARGE_FLASK_KINDS, chargeFlaskDefinition } from '../../model/gracerefill.js';
import { mountHand } from '../components/hand.js';
import { hudShellHtml } from '../components/hudmeta.js';
import { runHudViewModel } from '../viewModels/RunHudViewModel.js';
import { combatantFrame } from '../components/combatantFrame.js';
import { statureFor } from '../components/stature.js';
import { UI_COMPONENTS as UI, uiComponentAttrs, markUiComponent } from '../components/uiComponents.js';
import { wireHudQuickSettings } from '../components/hudQuickSettings.js';
import { wireHudModeGrip } from '../components/hudModeGrip.js';
import { battlefieldStageModel } from '../models/BattlefieldStageModel.js';
import { wireBattlefieldStage } from '../components/battlefieldStage.js';
import { tooltipPlacementModel } from '../models/TooltipPlacementModel.js';
import { el, slot, meter, meters, pill, pips, pip, labelStack, statPair, keycap, glyph, iconButton, button, html, openModal } from '../kit/index.js';

/** A pile control: a kit button carrying a stacked StatPair (count over name). */
function pileButton(kind, label) {
  const count = statPair({ key: label, value: '0', attrs: { class: 'stack' } });
  count.querySelector('.sp-v').classList.add('n'); // the hook the instruments count by
  const node = button({ label: '', className: `pile ${kind} tall` });
  node.appendChild(count);
  return node;
}

export function mountCombat(app, { registries, run, combat, meta, onEnd, showTutorial, onTutorialDone, onSettings, onSettingsChange, onMenu, onSave, onQuit, onLoad, onQuitWithoutSave, quickControls = {} }) {
  // THE ONE DOOR for every action on this screen that the second-beat table has
  // ruled on. This screen names actions; it does not know what a hold is and it
  // does not decide which of its buttons deserve one (model/secondbeat.js).
  const arm = beatArmer(meta, registries);
  // Declared here, assigned where End Turn is wired. `renderControls` re-dresses
  // it every frame and runs before that line on the first paint, so it must be
  // a `let` that reads null rather than a `const` in its temporal dead zone —
  // which throws, and would throw on the FIRST RENDER OF EVERY FIGHT.
  let endTurnBeat = null;
  app.innerHTML = `
    <div class="combat">
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
        identity: { className: registries.classes.get(run.class).name },
        controls: {
          armouryId: 'combat-armoury',
          menuId: 'combat-menu',
          menuHint: actionHint('menu'),
        },
        // The settings bag, for `runHudMode` — the band's compact/expanded
        // state. `presentation` went with the fullscreen/music pair.
        quickSettings: { settings: meta.settings || {} },
      }))}
      <div class="${backdropClass(run.actNumber)}"></div>
      <div class="field" ${uiComponentAttrs(UI.battlefieldStage)}>
        <div class="player-zone"></div>
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
             the three piles as buttons carrying a StatPair each, End Turn the
             primary at twice the width with its Keycap and, from the second-beat
             machinery, its HOLD hint. Exhaust stays present at zero so no
             control appears late or shifts the row. -->
        <div class="combat-action-row as-btnrow" data-size="fill" ${uiComponentAttrs(UI.combatActionRail)} role="group" aria-label="Combat actions">
          ${html(statPair({ key: 'Actions', value: '', attrs: { class: 'energy-orb cell stack lg', role: 'status', 'aria-label': 'Actions remaining' } }))}
          ${html(pileButton('draw', 'Draw'))}
          ${html(button({ label: 'End Turn', weight: 'primary', className: 'end-turn wide tall' }))}
          ${html(pileButton('discard', 'Discard'))}
          ${html(pileButton('exhaust', 'Exhausted'))}
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
  wireHudModeGrip(app, { settings: meta.settings || {}, onSettingsChange });

  const $ = (sel) => app.querySelector(sel);
  const combatEl = $('.combat');
  // The bar ceilings, DERIVED from the content (classes + equipment for the
  // player surface, plus every enemy for the under-model one) rather than typed.
  // Once per mount: it is a fact about the content, not about the frame.
  const resDomains = resourceDomains(registries);
  const battlefieldStage = wireBattlefieldStage($('.field'), battlefieldStageModel(registries.balance.ui.combatantStage));
  const tooltipPlacement = tooltipPlacementModel(registries.balance.ui.tooltipPlacement);
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
    maxActorAnimationMs: (speed) => reaverAttackTiming(speed).totalMs,
    animateActor: (beat, actorEl, speed) => {
      if (beat.actorId !== 'player' || beat.kind !== 'attack') return null;
      const figure = figureSpec(registries, run.loadout, run.class);
      const eligible = isReaverAttackEligible({
        classId: run.class,
        figure,
        customization: run.customization,
        spritesEnabled: spritesAreEnabled(),
      });
      return eligible ? playReaverAttack(actorEl, reaverAttackTiming(speed)) : null;
    },
  };

  let selected = null; // card instanceId in click-targeting mode
  let selectedFlask = null; // flask slot index awaiting a target
  let selfArm = null; // self/buff card armed for a confirm (keyboard/gamepad)
  let selectedEnemyId = null; // contextual reading selection; never combat targeting
  let combatantTooltipDelayTimer = null;
  let busy = false; // animating / resolving
  let lastTargetId = null; // remember the last enemy aimed at (keyboard/pad QoL)
  let aimScheduled = false; // debounce for the aim-highlight observer
  let handPageCursor = null; // survives focus moving onto Previous/Next itself
  const HAND_PAGE_THRESHOLD = 7;
  const handOverlay = $('.hand-overlay');
  const handPages = [$('.hand-prev'), $('.hand-next')];

  // A blank press dismisses only the floating explanation. The edge inspector
  // is a separately owned Folding Tray and remains until its label is folded.
  combatEl.addEventListener('click', (event) => {
    if (event.target.closest('.combatant, .combatant-inspector-host')) return;
    clearTimeout(combatantTooltipDelayTimer);
    selectedEnemyId = null;
    combatEl.querySelectorAll('.combatant.enemy.context-selected').forEach((enemy) => enemy.classList.remove('context-selected'));
    combatEl.querySelectorAll('.combatant.enemy[aria-pressed="true"]').forEach((enemy) => enemy.setAttribute('aria-pressed', 'false'));
    hideTooltip();
  });

  // THE ONE HAND RENDERER (components/hand.js) — the strip, its fan, key
  // hints, the inspect hold, the overlap arm of balance.ui.handLayout and the
  // Law 5 exemption all live there, once, for both surfaces. This screen
  // supplies the viewer half per render (renderHand below): live previewCard
  // entries off the paced snapshot, and wireCardInput as the play wiring.
  // wireCardInput is a hoisted declaration below; cards with no preview
  // (stale playback snapshot on a combat-ending play) render inert.
  const handStrip = mountHand($('.hand'), {
    registries,
    wireCard: (el, entry) => { if (entry.preview) wireCardInput(el, entry.inst, entry.preview, entry.affordable); },
  });

  function openCombatFlaskMenu(anchor, def, { slot = null, chargeKind = null, remaining = 1, charges = null, useActionId = null } = {}) {
    const canUse = !busy && !combat.result && combat.phase === 'player' && remaining > 0;
    const useReason = remaining <= 0 ? 'No charges remaining'
      : busy ? 'Wait for the current action to finish'
        : combat.result ? 'Combat is already over' : combat.phase !== 'player' ? 'Wait for your turn' : '';
    const plan = flaskActionPlan({ context: 'combat', canUse, useReason });
    mountFlaskActionMenu(anchor, {
      def,
      plan,
      charges,
      useActionId,
      onCancel: () => {},
      onAction: (actionId) => {
        if (actionId !== 'use') return;
        if (def.targeted) {
          selectedFlask = selectedFlask === slot ? null : slot;
          selected = null;
          selfArm = null;
          render();
          if (selectedFlask != null) focusTargeting();
        } else {
          useFlask(slot, null, chargeKind);
        }
      },
      // The menu is the selection boundary; the explicit Use row still reads
      // the shared second-beat rule rather than inventing a screen-local rule.
      wireAction: (row, button, invoke) => {
        if (row.id !== 'use' || !row.enabled) return false;
        arm(button, 'useFlask', {
          ctx: { targeted: !!def.targeted },
          question: `Use ${def.name}? ${remaining} charge${remaining === 1 ? '' : 's'} remaining.`,
          confirmLabel: 'USE',
          onConfirm: invoke,
        });
        return true;
      },
    });
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

  // The single prospective target right now: an armed self-card → the player
  // (blue); an enemy-targeting card → the hovered or focused enemy (red).
  function currentAim() {
    if (selfArm) {
      const p = $('.combatant.player');
      return p ? { el: p, kind: 'self' } : null;
    }
    if (selected || selectedFlask != null) {
      const el = $('.combatant.enemy.hover-target') || $('.combatant.enemy.gp-focus');
      return el ? { el, kind: 'enemy' } : null;
    }
    return null;
  }

  function refreshAim() {
    // Drag targeting owns the same red silhouettes while a pointer is down.
    // The class observer below also sees those class changes; yielding here
    // prevents click/focus targeting from erasing a proximity highlight on the
    // next task turn. One visual, two mutually exclusive input owners.
    if (combatEl.classList.contains('drag-targeting')) return;
    const want = currentAim();
    const cur = $('.combatant.aiming');
    if ((want && cur === want.el && cur.querySelector('.aim-silho')) || (!want && !cur)) return;
    clearAim();
    if (want) setAim(want.el, want.kind);
  }

  // Arm a self/buff card: highlight the player blue and wait for a second
  // Confirm (keyboard/gamepad). Mouse plays such cards on the first click.
  function armSelf(instanceId) {
    selfArm = selfArm === instanceId ? null : instanceId;
    selected = null;
    selectedFlask = null;
    hideTooltip();
    render();
    if (selfArm) focusFirst('.combatant.player');
    refreshAim();
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

  function moveDetail(move, preview = null) {
    const source = preview || move || {};
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
      const stance = entity.stanceId ? registries.frameworkTerms.withStanceWords(registries.stances.get(entity.stanceId)) : null;
      const skills = [];
      if (stance) skills.push({ name: stance.name, detail: stance.tooltip || 'Current stance.', active: true });
      skills.push({ name: classDef.name, detail: classDef.description || 'Current combat role.', active: true });
      return {
        role: 'player',
        name: (run.customization?.name || classDef.name).toUpperCase(),
        subtitle: `${classDef.name} · Level ${run.level}`,
        resources: [
          { label: 'HP', value: v.hp, max: entity.maxHp },
          { label: 'MP', value: v.mana, max: entity.maxMana },
          { label: 'Poise', value: v.poiseMeter?.value || 0, max: v.poiseMeter?.max || entity.poiseMeter?.max || 0 },
          { label: 'Block', value: v.block || 0 },
        ],
        skillLabel: 'Active skills & stance',
        skills,
        statuses: statusDetails(entity),
      };
    }

    const def = registries.enemies.get(entity.enemyId);
    const intent = previewIntent(combat, entity.id);
    const currentMoveId = intent.moveId;
    const skills = Object.entries(def.moves || {}).map(([moveId, move]) => ({
      name: words(moveId),
      detail: moveDetail(move, moveId === currentMoveId ? intent : null),
      active: moveId === currentMoveId,
    }));
    const current = currentMoveId && def.moves?.[currentMoveId];
    return {
      role: 'enemy',
      name: def.name,
      subtitle: (def.tags || []).map(words).join(' · ') || 'Enemy',
      resources: [
        { label: 'HP', value: v.hp, max: entity.maxHp },
        { label: 'Poise', value: v.poiseMeter?.value || 0, max: v.poiseMeter?.max || entity.poiseMeter?.max || 0 },
        { label: 'Block', value: v.block || 0 },
      ],
      intent: {
        name: currentMoveId ? words(currentMoveId) : words(intent.kind || 'Unknown'),
        detail: moveDetail(current, intent),
        active: true,
      },
      skillLabel: 'Move set',
      skills,
      statuses: statusDetails(entity),
    };
  }

  function combatantContextTooltip(subject) {
    const hp = subject.resources.find((row) => row.label === 'HP');
    const poise = subject.resources.find((row) => row.label === 'Poise');
    const effects = subject.statuses.map((row) => row.name).join(', ') || 'None';
    return `<div class="tt-title">${esc(subject.name)}</div>`
      + `<div class="tt-combatant-line"><b>HP</b> ${esc(hp?.value ?? '—')}/${esc(hp?.max ?? '—')}</div>`
      + `<div class="tt-combatant-line"><b>Poise</b> ${esc(poise?.value ?? '—')}/${esc(poise?.max ?? '—')}</div>`
      + `<div class="tt-combatant-line"><b>Effects</b> ${esc(effects)}</div>`
      + `<div class="ti-detail">Press <b>I</b>${subject.role === 'enemy' ? ', or tap the name,' : ''} for the full read.</div>`;
  }

  /**
   * openCombatantDoor(subject) — THE FULL READ, in the kit's own door
   * (Constantine, 2026-09-04: "no way to expand combatant tooltip to see more
   * details"). The tooltip is the glance: HP, poise, effects. This is the
   * study: pools as Meters, the current intent, the whole move set, every
   * active effect — `combatantDetailBody`, the same sections the edge tray
   * renders, so the two can never drift.
   */
  function openCombatantDoor(subject) {
    if (!subject?.name) return;
    hideTooltip();
    openModal({
      size: 'md',
      className: 'combatant-door',
      eyebrow: subject.subtitle || 'Combatant',
      title: subject.name,
      closeLabel: `Close ${subject.name}`,
      bodyClassName: 'combatant-inspector-body',
      body: (host) => host.replaceChildren(...combatantDetailBody(subject, { heading: false })),
      primary: button({ label: 'Close', weight: 'primary', attrs: { 'data-focusable': 'true' } }),
      footSize: 'short',
    });
  }

  function renderedContentRect(el) {
    const rects = [...(el?.children || [])]
      .map((child) => child.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    if (!rects.length) return el?.getBoundingClientRect() || null;
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  /**
   * showCombatantContext(box, role, entity) — THE GLANCE, for either side of
   * the field. #045/#046 made this the single battlefield tooltip surface;
   * until 2026-09-05 it answered for enemies only, so the player's own frame
   * answered nothing at all (Constantine: "no tool tip for ... player
   * combatants"). One surface, both roles: `combatantContextTooltip` already
   * wrote the player's footer sentence, and `combatantSubject` already read
   * the player's pools, stance and effects — nothing new is being invented
   * here, the door was simply never opened on his side.
   */
  function showCombatantContext(box, role, entity) {
    clearTimeout(combatantTooltipDelayTimer);
    if (!box.isConnected) return false;
    if (role === 'enemy' && !entity.alive) return false;
    const card = renderedContentRect(box.querySelector('.combatant-card'));
    if (!card) return false;
    showTooltipForRect(card, combatantContextTooltip(combatantSubject(role, entity)), {
      intent: 'above',
      align: 'center',
      clear: [box.querySelector('.intent'), app.querySelector('.topbar.combat-hud')],
      appearance: { variant: 'combatant-context', maxWidthRem: 21 },
      autoHideMs: tooltipPlacement.tokens.autoFadeMs,
    });
    return true;
  }

  const showEnemyContext = (box, enemy) => showCombatantContext(box, 'enemy', enemy);

  function restoreSelectedEnemyContext(exceptId = null) {
    if (!selectedEnemyId || selectedEnemyId === exceptId) {
      hideTooltip();
      return;
    }
    const selectedEntity = combat.enemies.find((enemy) => enemy.id === selectedEnemyId && enemy.alive);
    const selectedBox = selectedEntity && app.querySelector(`.combatant.enemy[data-eid="${CSS.escape(selectedEnemyId)}"]`);
    if (!selectedBox || !showEnemyContext(selectedBox, selectedEntity)) hideTooltip();
  }

  /**
   * childAnswers(box, event) — does a surface INSIDE the frame own this
   * pointer or focus cursor? A status pip answers for itself (#045/#046's
   * one-surface rule, reversed for the status surfaces on 2026-09-05), and the
   * frame must not talk over it with its own glance. The two input paths need
   * two readings: the focus cursor arrives as a bubbling `gpfocus`, so the
   * frame sees the pip's own event with `target` still the pip; hover does not
   * bubble, so the pointer's real subject is whatever sits under it. Without
   * this the frame's timer, scheduled second on the bubbling path, replaced
   * the pip's reading a moment after it opened.
   */
  function childAnswers(box, event) {
    if (event.target && event.target !== box && event.target.closest) return !!event.target.closest('[data-tip-attached]');
    if (event.clientX == null) return false;
    const under = document.elementFromPoint(event.clientX, event.clientY);
    return !!under && box.contains(under) && !!under.closest('[data-tip-attached]');
  }

  function wireEnemyContext(box, enemy) {
    ensureTooltip();
    box.classList.add('inspectable');
    box.dataset.focusable = '';
    box.tabIndex = -1;
    box.setAttribute('role', 'button');
    box.setAttribute('aria-pressed', selectedEnemyId === enemy.id ? 'true' : 'false');
    box.setAttribute('aria-describedby', 'tooltip');
    box.setAttribute('aria-label', `Select ${combatantSubject('enemy', enemy).name} for combat details`);
    box.addEventListener('pointerenter', (event) => {
      if (childAnswers(box, event)) return;
      clearTimeout(combatantTooltipDelayTimer);
      combatantTooltipDelayTimer = setTimeout(() => showEnemyContext(box, enemy), tooltipPlacement.tokens.hoverDelayMs);
    });
    box.addEventListener('pointerleave', () => {
      if (selectedEnemyId === enemy.id) return;
      clearTimeout(combatantTooltipDelayTimer);
      restoreSelectedEnemyContext(enemy.id);
    });
    box.addEventListener('gpfocus', (event) => {
      if (childAnswers(box, event)) return;
      clearTimeout(combatantTooltipDelayTimer);
      combatantTooltipDelayTimer = setTimeout(() => showEnemyContext(box, enemy), tooltipPlacement.tokens.hoverDelayMs);
    });
    box.addEventListener('gpblur', (event) => {
      if (childAnswers(box, event)) return;
      if (selectedEnemyId === enemy.id) return;
      clearTimeout(combatantTooltipDelayTimer);
      restoreSelectedEnemyContext(enemy.id);
    });
    box.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      box.click();
    });
  }
  // The player's half of the same door. Deliberately NOT a copy of
  // wireEnemyContext: the player is never a context selection (nothing to
  // restore on leave) and never a target (no role, no tabIndex, no
  // data-focusable — the armed-card branch in renderPlayer owns those, and
  // publishing a second, permanent focus stop would reorder the controller
  // cursor). What is left is the glance itself: hover, the focus cursor, and
  // on touch a tap, on the same clock the enemies use.
  function wirePlayerContext(box, player) {
    ensureTooltip();
    box.classList.add('inspectable');
    box.setAttribute('aria-describedby', 'tooltip');
    const open = (event) => {
      if (childAnswers(box, event)) return;
      clearTimeout(combatantTooltipDelayTimer);
      combatantTooltipDelayTimer = setTimeout(
        () => showCombatantContext(box, 'player', player),
        tooltipPlacement.tokens.hoverDelayMs,
      );
    };
    const close = (event) => {
      if (childAnswers(box, event)) return;
      clearTimeout(combatantTooltipDelayTimer);
      restoreSelectedEnemyContext();
    };
    box.addEventListener('pointerenter', open);
    box.addEventListener('pointerleave', close);
    box.addEventListener('gpfocus', open);
    box.addEventListener('gpblur', close);
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
      poiseMeter: e.poiseMeter ? { value: e.poiseMeter.value, max: e.poiseMeter.max } : null,
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
    clearTimeout(combatantTooltipDelayTimer);
    hideTooltip();
    if (selected || selectedFlask != null) selectedEnemyId = null;
    if (selectedEnemyId && !combat.enemies.some((enemy) => enemy.id === selectedEnemyId && enemy.alive)) selectedEnemyId = null;
    renderPlayer();
    renderEnemies();
    if (selectedEnemyId) {
      const selectedEntity = combat.enemies.find((enemy) => enemy.id === selectedEnemyId && enemy.alive);
      const selectedBox = selectedEntity && app.querySelector(`.combatant.enemy[data-eid="${CSS.escape(selectedEnemyId)}"]`);
      if (selectedBox) {
        combatantTooltipDelayTimer = setTimeout(
          () => showEnemyContext(selectedBox, selectedEntity),
          tooltipPlacement.tokens.hoverDelayMs,
        );
      }
    }
    battlefieldStage.refresh();
  }

  function render() {
    renderTopbar();
    renderCombatantStage();
    renderHand();
    renderControls();
    refreshAim(); // re-apply the target glow after the board rebuilds
    // Hint bar context: while aiming, show Confirm/Cancel instead of zone keys.
    setHintMode(selected || selectedFlask != null || selfArm ? 'targeting' : null);
  }
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('shot')) {
    window.__renderCombatForShot = render;
  }

  function renderTopbar() {
    const p = combat.player;
    const pv = dv(p);
    // THE MAIN HUD BAR STACK — HP, MP, SP, vertically. Which rows appear is
    // content/resources.js's business, not this screen's. Player Poise belongs
    // only on the combat character card's model surface; it is deliberately
    // absent from this shared map/combat top HUD.
    const host = $('.topbar .resbars-host');
    host.innerHTML = '';
    const mainPlan = resourceBarPlan(registries, 'main', pv, p, resDomains);
    host.appendChild(resourceBars(mainPlan, { surface: 'main', tooltipExtra: poiseTip('player') }));
    const relics = $('.topbar .relics');
    relics.innerHTML = '';
    for (const rid of p.relicIds) {
      const def = registries.relics.get(rid);
      const el = slot({ art: def.icon || '◆', small: true, static: true, tag: 'div', label: def.name, className: 'relic', attrs: { dataset: { relicId: rid } } });
      markUiComponent(el, UI.relicSlot);
      attachTooltip(el, () => `<div class="tt-title">${esc(def.name)}</div>${esc(relicText(def, registries))}`);
      relics.appendChild(el);
    }
    // Flask selection is inert. Every slot opens one shared action plan; only
    // its explicit Use row may spend a charge or enter targeting mode.
    const chargeFlasks = $('.topbar .hud-charge-flasks');
    const potions = $('.topbar .hud-potions');
    chargeFlasks.innerHTML = '';
    potions.innerHTML = '';
    // THE KEYCAP IS DERIVED, NEVER TYPED: the live binding and the connected
    // device, so a rebind moves the cap with the key and a pad shows its glyph.
    const flaskHotkey = (hotkeySlot) => {
      if (hotkeySlot >= 3) return '';
      const id = `flask${hotkeySlot + 1}`;
      return hasGamepad() ? padLabel(id) || keyLabel(id) : keyLabel(id);
    };
    const appendFlaskHotkey = (el, hotkeySlot) => {
      if (hotkeySlot >= 3) return;
      el.dataset.flaskHotkeySlot = String(hotkeySlot);
      el.querySelector('.sl-key')?.classList.add('flask-key');
    };
    const flaskArt = (def) => el('span', { class: 'sl-art', 'aria-hidden': 'true', html: flaskIdentityHtml(def, { showName: false }) });
    for (const [hotkeySlot, kind] of CHARGE_FLASK_KINDS.entries()) {
      const def = chargeFlaskDefinition(registries, kind);
      const current = p.flaskCharges ? p.flaskCharges[`${kind}Current`] : 0;
      // The charge flask is a kit Slot: art, its count as a round StatePill,
      // its key as a Keycap — one box, at the IconButton's size.
      const el = slot({
        art: flaskArt(def), count: current, key: flaskHotkey(hotkeySlot), label: def.name,
        disabled: current <= 0, className: 'relic flask-slot flask-charge',
      });
      markUiComponent(el, kind === 'hp' ? UI.crimsonFlaskControl : UI.azureFlaskControl);
      el.querySelector('.sl-count').classList.add('flask-charge-count');
      appendFlaskHotkey(el, hotkeySlot);
      attachTooltip(el, () => flaskTooltipHtml(def, { charges: current }));
      el.addEventListener('click', () => openCombatFlaskMenu(el, def, { chargeKind: kind, remaining: current, charges: current, useActionId: hotkeySlot < 3 ? `flask${hotkeySlot + 1}` : null }));
      chargeFlasks.appendChild(el);
    }
    p.flasks.forEach((f, slotIndex) => {
      const def = registries.flasks.get(f.flaskId);
      // Health and Mana own the first two HUD flask shortcuts. The first
      // carried potion receives the third; every remaining potion stays
      // reachable through ordinary spatial focus.
      const el = slot({
        art: flaskArt(def), key: flaskHotkey(CHARGE_FLASK_KINDS.length + slotIndex), label: def.name,
        selected: selectedFlask === slotIndex, className: 'relic flask-slot', attrs: { dataset: { flaskSlot: String(slotIndex) } },
      });
      markUiComponent(el, UI.potionControl);
      appendFlaskHotkey(el, CHARGE_FLASK_KINDS.length + slotIndex);
      // THE LABEL READS THE BEAT, IT DOES NOT RESTATE IT. `data-beat` is written
      // by the machinery from the table, so the sentence a player reads and the
      // gesture the button actually wants cannot drift — and the icon is far too
      // small for the HOLD word the event bars carry (hidden by the kit).
      attachTooltip(el, () => flaskTooltipHtml(def, { hint: 'Open actions to Use or Inspect.' }));
      el.addEventListener('click', () => openCombatFlaskMenu(el, def, { slot: slotIndex, useActionId: (CHARGE_FLASK_KINDS.length + slotIndex) < 3 ? `flask${CHARGE_FLASK_KINDS.length + slotIndex + 1}` : null }));
      potions.appendChild(el);
    });
    potions.closest('.shared-hud').dataset.hasUtilityPotions = potions.children.length ? 'true' : 'false';
  }

  // #61 M4 — ONE meter grammar for every threshold-proc row, data-driven so a
  // fourth row needs zero new UI. Display cap is a RULE: at most two proc
  // meters render as bars (the two closest to threshold); the rest collapse
  // to ring-fill pips in the status row — same fill semantics, smaller
  // grammar, independent of how many rows content ships.
  // All three read the PACED view (dv) — the snapshot during playback, the
  // live entity otherwise — so meters move on their own beat (Sunna's gate).
  function procDisplayPlan(entity) {
    const live = Object.entries(dv(entity).statuses || {})
      .filter(([sid, inst]) => {
        const def = registries.statuses.get(sid);
        return def && def.proc && inst.meter && inst.meter.value > 0;
      })
      .sort((a, b) => b[1].meter.value / b[1].meter.max - a[1].meter.value / a[1].meter.max);
    return { bars: live.slice(0, 2).map(([sid]) => sid), pips: live.slice(2).map(([sid]) => sid) };
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
    el.addEventListener('click', (event) => {
      if (selected || selectedFlask != null || selfArm) return;
      event.stopPropagation();
      showTooltipFor(el, contentFn(), { intent: 'above', align: 'center' });
    });
  }

  function statusRow(entity) {
    // The status row is the kit's Pips: one round badge per effect, its count a
    // round StatePill on the corner.
    // EVERY PIP ANSWERS FOR ITSELF — the one exception to #045/#046's single
    // battlefield tooltip surface, and Constantine's own reversal of it
    // (2026-09-05: "no tool tip for Status effects"). The frame's context
    // reading repeats HP, Poise and the intent, so a second tooltip on those
    // is redundant and stays suppressed; it only NAMES the effects ("Effects
    // Crimson Blight"), so a pip with no tooltip is a glyph the player cannot
    // read. Naming without explaining is the gap this closes. The same holds
    // for the threshold proc bars below — they are status rows too.
    const row = pips([], { class: 'statuses' });
    markUiComponent(row, UI.statusEffectTray, entity.kind);
    const plan = entity.kind === 'enemy' ? procDisplayPlan(entity) : { bars: [], pips: [] };
    for (const [sid, inst] of Object.entries(dv(entity).statuses || {})) {
      const def = registries.frameworkTerms.withStatusWords(registries.statuses.get(sid));
      const stacks = inst.meter ? inst.meter.value : inst.stacks;
      const presentation = statusInstancePresentation(def, inst);
      // M1's "absent at zero", applied to pips too: a spent proc row (💧0
      // after a burst) is an empty frame, not information (Sunna's S-flag).
      if (def.proc && stacks <= 0) continue;
      const shownValue = def.resists && inst.duration != null ? inst.duration : presentation.valueText;
      const el = pip({ glyph: def.icon || '?', count: shownValue, tone: def.tint || 'var(--muted)', ring: plan.pips.includes(sid), attrs: { class: 'status-icon' } });
      const semanticAttrs = statusInstanceSemanticAttrs(presentation);
      el.setAttribute('data-status-id', semanticAttrs['data-status-id']);
      el.setAttribute('data-status-value-token', semanticAttrs['data-status-value-token']);
      el.setAttribute('aria-label', semanticAttrs['aria-label']);
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
      const statusTip = () => {
        let extra = '';
        if (inst.meter) extra = `<br>Build-up: ${inst.meter.value} / ${inst.meter.max}`;
        if (inst.duration != null) extra += `<br>Turns left: ${inst.duration}`;
        return `<div class="tt-title">${esc(presentation.label)}</div>${esc(presentation.tooltip)}${extra}`;
      };
      attachTooltip(el, statusTip);
      answerOnTap(el, statusTip);
      row.appendChild(el);
    }
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
  function poiseTip(kind) {
    return (bar) => {
      if (bar.id !== 'poise') return '';
      if (kind === 'player') {
        return 'Your Stagger threshold — your armament, armour and relics steady it. Nothing deals Poise damage to you yet.';
      }
      const staggered = registries.frameworkTerms.statusDisplay('staggered');
      const stagDesc = (staggered && staggered.tooltip) || '';
      return `Fill it to Stagger. ${esc(stagDesc)}`;
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
    const plan = resourceBarPlan(registries, 'model', v, entity, resDomains);
    const bars = resourceBars(plan, { surface: 'model', tooltipExtra: poiseTip(entity.kind), tooltips });
    for (const bar of plan) {
      const el = bars.querySelector(`[data-res="${bar.id}"]`);
      if (!el) continue;
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
      const arcane = renderArcaneExposure(registries, v, disp ? disp.arcaneEvents : recentArcaneEvents, { tooltips });
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
    return wrap;
  }

  // Block is a StatePill in the frost tone, filled: a number a player reads off
  // the sprite at a glance.
  function blockBadge(entity, { tooltips = true } = {}) {
    const v = dv(entity);
    if (v.block <= 0) return null;
    const b = pill({ label: String(v.block), round: true, attrs: { class: 'block-badge solid lg' } });
    markUiComponent(b, UI.blockBadge);
    if (tooltips) attachTooltip(b, () => `<div class="tt-title">Block ${v.block}</div>Absorbs attack damage. Expires at the start of the owner's turn.`);
    return b;
  }

  function renderPlayer() {
    const zone = $('.player-zone');
    zone.innerHTML = '';
    const p = combat.player;
    const figure = figureSpec(registries, run.loadout, run.class);
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
      trailing.push(chip);
    }
    trailing.push(statusRow(p));
    const box = combatantFrame({
      role: 'player',
      entityId: 'player',
      classNames: selfArm ? ['armed'] : [],
      sprite: playerSprite(run.customization || {}, run.class),
      blockBadge: blockBadge(p, { tooltips: false }),
      meters: meterBars(p, { tooltips: false }),
      trailing,
    });
    wirePlayerContext(box, p);
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
    box.addEventListener('click', (event) => {
      event.stopPropagation();
      if (selfArm) playCard(selfArm, null);
      else showCombatantContext(box, 'player', p);
    });
    zone.appendChild(box);
  }

  // The intent is one StatePill in the fact's own tone, glyph first — the kit's
  // `pill.lg` (uiContent.js intentBadge picks the tone and the words).
  function intentEl(enemy) {
    const iv = previewIntent(combat, enemy.id);
    const badge = intentBadge(iv);
    const node = pill({
      label: badge.label,
      attrs: { class: `intent lg ${badge.cls}${badge.dashed ? ' dashed' : ''}`, dataset: { tone: badge.tone || undefined } },
    });
    if (badge.glyph) node.prepend(glyph(badge.glyph, { class: 'ic' }));
    markUiComponent(node, UI.intentIndicator, badge.cls);
    return node;
  }

  function renderEnemies() {
    const row = $('.enemy-row');
    row.innerHTML = '';
    const targeting = selected || selectedFlask != null;
    const living = combat.enemies.filter((e) => e.alive);
    for (const enemy of combat.enemies) {
      const def = registries.enemies.get(enemy.enemyId);
      const leading = [];
      if (enemy.alive) leading.push(intentEl(enemy));
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
      nm.classList.add('nm-inspect');
      nm.setAttribute('role', 'button');
      nm.tabIndex = 0;
      nm.setAttribute('aria-label', `${def.name} — the full read`);
      const openThisRead = (event) => {
        event.stopPropagation();
        openCombatantDoor(combatantSubject('enemy', enemy));
      };
      nm.addEventListener('click', openThisRead);
      nm.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openThisRead(event);
      });
      const box = combatantFrame({
        role: 'enemy',
        entityId: enemy.id,
        classNames: [dv(enemy).alive ? '' : 'dead', targeting ? 'targetable' : '', selectedEnemyId === enemy.id ? 'context-selected' : ''],
        leading,
        sprite: enemySprite(def),
        blockBadge: blockBadge(enemy, { tooltips: false }),
        name: nm,
        meters: meterBars(enemy, { tooltips: false }),
        trailing: [statusRow(enemy)],
      });
      box.dataset.stature = statureFor(registries, def.id);
      if (enemy.alive) {
        wireEnemyContext(box, enemy);
        box.addEventListener('click', (event) => {
          event.stopPropagation();
          if (selected) playCard(selected, enemy.id);
          else if (selectedFlask != null) useFlask(selectedFlask, enemy.id);
          else {
            selectedEnemyId = enemy.id;
            row.querySelectorAll('.combatant.enemy').forEach((candidate) => {
              const current = candidate === box;
              candidate.classList.toggle('context-selected', current);
              candidate.setAttribute('aria-pressed', current ? 'true' : 'false');
            });
            clearTimeout(combatantTooltipDelayTimer);
            // Selection state answers immediately through aria-pressed and the
            // selected treatment; its contextual reading uses the same configured,
            // cancellable delay as pointer and focus preview.
            combatantTooltipDelayTimer = setTimeout(
              () => showEnemyContext(box, enemy),
              tooltipPlacement.tokens.hoverDelayMs,
            );
          }
        });
        box.addEventListener('pointerenter', () => (selected || selectedFlask != null) && box.classList.add('hover-target'));
        box.addEventListener('pointerleave', () => box.classList.remove('hover-target'));
      }
      row.appendChild(box);
    }
  }

  function renderHand() {
    const handList = disp ? disp.hand : combat.piles.hand;
    handStrip.render({
      cards: handList.map((inst) => {
        // disp.hand is a pre-dispatch snapshot; on a combat-ending play the
        // engine strands the in-flight card in no pile (finishCombat clears the
        // queue), so previewCard can no longer resolve it. Such cards render
        // inert (no preview → no play wiring) instead of letting the throw
        // wedge the timeline (this froze the game on the killing blow).
        let pv = null;
        try {
          pv = previewCard(combat, inst.instanceId);
        } catch (e) {
          console.warn('[combat] hand card not previewable (stale snapshot):', inst.instanceId);
        }
        const affordable = !!pv && combat.player.energy >= (pv.costIsX ? 0 : pv.cost) && combat.player.mana >= pv.manaCost && combat.player.stamina >= (pv.staminaCost || 0) && !isUnplayable(inst);
        return { inst, preview: pv, affordable, selected: inst.instanceId === selected || inst.instanceId === selfArm };
      }),
    });
    syncHandPager(handList);
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

  function isUnplayable(inst) {
    return registries.framework.isUnplayable(resolveCard(registries, inst));
  }

  /** The pulse reports that the player still has an affordable play. */
  function endTurnHasPlayable() {
    const anyPlayable = combat.piles.hand.some((inst) => {
      if (registries.framework.isUnplayable(resolveCard(registries, inst))) return false;
      // The live preview — class-priced dodge costs, Power reductions — the
      // same numbers the badge shows and the engine charges, in all three
      // pools. A card the preview cannot resolve is not a playable card.
      let pv = null;
      try { pv = previewCard(combat, inst.instanceId); } catch (e) { return false; }
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
    $('.end-turn').replaceChildren('End Turn', keycap(etKey, { class: 'et-key' }));
    $('.end-turn').classList.toggle('pulse', endTurnHasPlayable());
    // The innerHTML above just dropped the HOLD hint on the floor. `refresh()`
    // re-reads the action's state and re-dresses the button — and it is the
    // reason a beat can live on a control its own screen repaints every frame
    // without any screen tracking the dressing.
    if (endTurnBeat) endTurnBeat.refresh();
    $('.pile.draw .sp-v').textContent = combat.piles.draw.length;
    $('.pile.discard .sp-v').textContent = combat.piles.discard.length;
    $('.pile.exhaust .sp-v').textContent = combat.piles.exhaust.length;
    $('.pile.draw').setAttribute('aria-label', `Draw pile, ${combat.piles.draw.length}`);
    $('.pile.discard').setAttribute('aria-label', `Discard pile, ${combat.piles.discard.length}`);
    $('.pile.exhaust').setAttribute('aria-label', `Exhausted pile, ${combat.piles.exhaust.length}`);
  }

  // ---------- input: click-to-target + drag (SPEC §7.3, both modes) ----------
  function wireCardInput(el, inst, pv, affordable) {
    let dragGhost = null;
    let dragging = false;
    let suppressClick = false; // a finished drag must not double-fire as a click
    let startX = 0;
    let startY = 0;
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

    const nearestEnemy = (x, y) => livingEnemyEls().reduce((best, enemy) => {
      const r = enemy.getBoundingClientRect();
      const distance = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      return !best || distance < best.distance ? { enemy, distance } : best;
    }, null)?.enemy || null;

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

    const updateDropTarget = (x, y) => {
      if (!dragGhost) return;
      const under = document.elementFromPoint(x, y);
      const inField = !!(under && under.closest && under.closest('.field'));
      let legal = inField;
      if (dragTargetMode === 'single') {
        const nearest = inField ? nearestEnemy(x, y) : null;
        showDragAims(nearest ? [nearest] : []);
        legal = !!nearest;
      } else if (dragTargetMode === 'all') {
        const enemies = inField ? livingEnemyEls() : [];
        showDragAims(enemies);
        legal = enemies.length > 0;
      } else {
        showDragAims([]);
      }
      // An ADDITION on top of the enemy silence above, never a branch around it:
      // `showDragAims([])` is the one line that keeps a non-enemy drag from
      // painting enemy silhouettes, and it has to keep running for a self-only
      // card. 9 shipped cards reach that `else` with no self effect either
      // (enterGorefire, enterBulwark, warriorsVow, transmute, masterOfStrategy
      // and the four curses), so it is live code, not a fallback.
      if (selfOnlyTarget) showSelfAim(legal);
      const state = legal ? 'legal' : 'illegal';
      combatEl.dataset.dropState = state;
      dragGhost.dataset.dropState = state;
      const verdict = dragGhost.querySelector('.drop-verdict');
      if (verdict) verdict.textContent = legal ? 'DROP' : 'NO TARGET';
    };

    el.addEventListener('pointerdown', (ev) => {
      if (busy || !affordable || ev.button !== 0) return;
      startX = ev.clientX;
      startY = ev.clientY;
      // The lifecycle lives in trackGesture (src/ui/gesture.js — #22): capture
      // on the card, pointerId-scoped, and the end handler runs on pointerup
      // AND pointercancel. The old shape — window listeners removed only in
      // onUp — is the one that played a cancelled drag's card on the next tap
      // (Vira's misplay: discard 0->1 from a tap on a DIFFERENT pointerId).
      const onMove = (mv) => {
        // An OPEN inspect owns this press: a finger drifting while reading an
        // expanded card must not start a drag whose release over the field
        // would PLAY a no-target card — a read must never be able to become a
        // commit. Guarded on 'open' only: while merely pending, a real drag
        // crossing the shared 12 px boundary abandons the inspect in the same
        // event and proceeds here, whichever handler ran first.
        if (el.dataset.inspect === 'open') return;
        if (!dragging && Math.hypot(mv.clientX - startX, mv.clientY - startY) > 12) {
          dragging = true;
          hideTooltip();
          dragGhost = el.cloneNode(true);
          dragGhost.classList.add('card-drag-ghost');
          dragGhost.setAttribute('aria-hidden', 'true');
          const verdict = document.createElement('span');
          verdict.className = 'drop-verdict';
          verdict.textContent = 'NO TARGET';
          dragGhost.appendChild(verdict);
          // The pointer still owns the established 70x100 grip, but the card is
          // translucent enough that the target beneath it remains readable.
          dragGhost.style.cssText += 'position:fixed;z-index:600;pointer-events:none;opacity:.58;transform:scale(1.1);';
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
          const p = clampBox({ left: at.left - 70, top: at.top - 100, width: g.width, height: g.height }, view, { keep: 40 });
          dragGhost.style.left = `${p.left}px`;
          dragGhost.style.top = `${p.top}px`;
          updateDropTarget(mv.clientX, mv.clientY);
        }
      };
      trackGesture(ev, {
        onMove,
        onEnd: (up, { cancelled }) => {
          clearDragTargeting();
          if (dragGhost) { dragGhost.remove(); dragGhost = null; }
          const wasDragging = dragging;
          dragging = false;
          if (!wasDragging) return; // plain click handled by 'click'
          // A CANCELLED DRAG DROPS NOTHING — AND COSTS NOTHING. The cancelled
          // return sits ABOVE the suppressClick arm, and the order is Vira's
          // gate finding on this very fix: suppressClick guards a COMPLETED
          // drag against double-firing as a click, but no click follows a
          // cancel — armed here, the flag sat live and ate the card's next
          // real tap (one tap swallowed, self-recovering, both shapes;
          // introduced by the first version of this fix, on exactly the
          // gesture the fix exists to make safe). elementFromPoint on a
          // cancel would aim the card at wherever the finger happened to die.
          if (cancelled) return;
          suppressClick = true; // whatever happens next, this drag is not a click
          const under = document.elementFromPoint(up.clientX, up.clientY);
          const inField = !!(under && under.closest && under.closest('.field'));
          if (dragTargetMode === 'single') {
            const enemyBox = inField ? nearestEnemy(up.clientX, up.clientY) : null;
            if (enemyBox) playCard(inst.instanceId, enemyBox.dataset.eid);
          } else if (inField) {
            playCard(inst.instanceId, null);
          }
        },
      });
    });

    el.addEventListener('click', (ev) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (busy || !affordable || dragging) return;
      if (pv.needsTarget) {
        selected = selected === inst.instanceId ? null : inst.instanceId;
        selfArm = null;
        render();
        if (selected) focusTargeting();
      } else if (ev.isTrusted || dragTargetMode === 'all') {
        // Controller Confirm is a synthetic click, but an all-enemy attack has
        // no second target to confirm. Do not misclassify it as a self/buff
        // card; self/buff controller clicks still take the blue path below.
        // Real mouse click on a self/buff card → play immediately.
        playCard(inst.instanceId, null);
      } else {
        // Synthetic click from keyboard/gamepad Confirm → arm the blue confirm.
        armSelf(inst.instanceId);
      }
    });
  }

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
      const selected = combat.enemies.find((enemy) => enemy.id === selectedEnemyId && enemy.alive);
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
      if (selectedEnemyId) {
        clearTimeout(combatantTooltipDelayTimer);
        selectedEnemyId = null;
        hideTooltip();
        app.querySelectorAll('.combatant.enemy.context-selected').forEach((enemy) => enemy.classList.remove('context-selected'));
        app.querySelectorAll('.combatant.enemy[aria-pressed="true"]').forEach((enemy) => enemy.setAttribute('aria-pressed', 'false'));
      }
      return;
    }
    if (busy || combat.result || combat.phase !== 'player') return;

    if (matchAction(ev, 'endTurn')) {
      ev.preventDefault();
      $('.end-turn').click();
      return;
    }

    // Flask keys activate the corresponding visible Quick Access control; they
    // never auto-use.
    for (let slot = 0; slot < 3; slot++) {
      if (matchAction(ev, `flask${slot + 1}`)) {
        ev.preventDefault();
        const slotEl = $(`.flask-slot[data-flask-hotkey-slot="${slot}"]`);
        if (slotEl) slotEl.click();
        return;
      }
    }

    // Positional card keys: 1–9 then Q for the 10th (hand caps at 10). The key
    // is tied to the SLOT, not the card — leftmost is always 1.
    const cardIdx = /^[1-9]$/.test(ev.key) ? Number(ev.key) - 1 : ev.key === 'q' || ev.key === 'Q' ? 9 : -1;
    if (cardIdx >= 0) {
      ev.preventDefault();
      // Targeting mode: a NUMBER picks the Nth living enemy (Q never targets).
      if ((selected || selectedFlask != null) && cardIdx < 9) {
        const enemy = combat.enemies.filter((e) => e.alive)[cardIdx];
        if (!enemy) return;
        if (selected) playCard(selected, enemy.id);
        else useFlask(selectedFlask, enemy.id);
        return;
      }
      // Selection mode: play the Nth hand card (auto-target a lone enemy).
      const inst = combat.piles.hand[cardIdx];
      if (!inst) return;
      const pv = previewCard(combat, inst.instanceId);
      const affordable = combat.player.energy >= (pv.costIsX ? 0 : pv.cost) && combat.player.mana >= pv.manaCost && combat.player.stamina >= (pv.staminaCost || 0) && !isUnplayable(inst);
      if (!affordable) return;
      if (pv.needsTarget) {
        const living = combat.enemies.filter((e) => e.alive);
        if (living.length === 1) playCard(inst.instanceId, living[0].id);
        else {
          selected = inst.instanceId;
          selectedFlask = null;
          render();
          focusTargeting();
        }
      } else {
        playCard(inst.instanceId, null);
      }
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
    // Nothing between here and playTimeline may prevent the timeline from
    // starting: busy is already true, and only the timeline's finish releases
    // it (and fires onEnd on victory/defeat). A render throw here once froze
    // the game permanently on the killing blow.
    try {
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
          applyBeatToDisp(beat);
          renderTopbar();
          renderCombatantStage();
          renderHand();
          renderControls();
        },
        onFlush: () => {
          disp = null;
          render();
        },
      },
      () => {
        disp = null;
        render();
        busy = false;
        if (combat.result) {
          removeEventListener('keydown', keyHandler);
          setTimeout(() => onEnd(combat.result, combat), 350);
        } else {
          focusHandDefault(); // land on the leftmost playable card for kb/pad
        }
      }
    );
  }

  // Ghost the played card flying toward its target (≤220 ms, purely cosmetic).
  function flyCard(instanceId, targetId) {
    const cardEl = app.querySelector(`.hand .card[data-instance-id="${instanceId}"]`);
    if (!cardEl) return;
    const dest = (targetId && fxCtx.anchorFor(targetId)) || fxCtx.anchorFor('player');
    // Container: THE VIEWPORT — `.card-ghost` is `position: fixed` (combat.css:364).
    // EldenSpire#15: `from`/`to` are raw visual rects, so at 1920×1080 the ghost
    // started 190 local px below the card it was a ghost of, entirely under the
    // bottom edge, and flew to a point that was not the enemy.
    //
    // THE TRANSFORM IS THE SAME SPACE, and it is the half no instrument here can
    // see: zoomunits.mjs reads neither `transform` nor `cssText` and says so in its
    // own boundary block, so `dx`/`dy` below were never in the carried set and
    // never could have been. Marina measured the mechanism — `translate(100px)`
    // under `zoom: 1.5` moves 150 visual px — which is why the deltas convert too.
    // Found by hand, on a screen. Not by the detector, which cannot.
    const view = viewportLocalBox();
    const b = anchorLocalBox(VIEWPORT_ORIGIN, cardEl);
    const t = anchorLocalBox(VIEWPORT_ORIGIN, dest || cardEl);
    const ghost = cardEl.cloneNode(true);
    ghost.className = `${cardEl.className} card-ghost`;
    // keep:40 — the start box is the card's own, already on screen, so this never
    // fires in play; it is here so a future wrong `b` is a misplaced ghost rather
    // than an invisible one.
    const at = clampBox(b, view, { keep: 40 });
    ghost.style.left = `${at.left}px`;
    ghost.style.top = `${at.top}px`;
    ghost.style.width = `${b.width}px`;
    ghost.style.margin = '0';
    document.body.appendChild(ghost);
    requestAnimationFrame(() => {
      // Centred on the CARD's box — the original model, kept. I tried measuring the
      // ghost's own box here instead, since the ghost is the thing that flies, and
      // it is worse: the clone inherits the card's class list including its entry
      // animation, so a rect read inside this rAF catches that animation mid-frame
      // (measured 203.59 tall against a 196 layout box — an 8.18 px offset that
      // changes with WHEN you look). A number read off a running animation is not a
      // measurement. The card's box holds still.
      //
      // What that leaves is a real ~3.5 local px approximation: the card carries
      // `.hand .card.selected` — translateY(-56px) scale(1.32), combat.css:180 —
      // and the ghost stops matching that selector the moment it is reparented to
      // <body>. It is CONSTANT at every zoom, which is exactly how zoomplace.mjs
      // separates it from the #15 defect, whose error is (1−1/z)·offset and runs
      // from −207 to +403 local px across the dial. Cosmetic, pre-existing, and not
      // this card's subject — named here so the next reader does not re-find it.
      const dx = t.left + t.width / 2 - (at.left + b.width / 2);
      const dy = t.top + t.height / 2 - (at.top + b.height / 2);
      ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.35) rotate(6deg)`;
      ghost.style.opacity = '0';
    });
    setTimeout(() => ghost.remove(), 260);
  }

  function playCard(instanceId, targetId) {
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
    flyCard(instanceId, targetId);
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
    selected = null;
    selectedFlask = null;
    hideTooltip();
    disp = takeSnapshot();
    let out;
    try {
      out = dispatch(combat, { type: 'endTurn' });
    } catch (err) {
      console.warn("[combat] dispatch rejected:", err && err.message);
      dlog('rejected', 'endTurn', err && err.message);
      disp = null;
      return;
    }
    dlog('dispatch', 'endTurn', { events: out.events.length });
    busy = true;
    afterDispatch(out.events);
    },
  });
  endTurnBeat.refresh();

  const showDraw = () => openPileModal(registries, 'Draw pile', combat.piles.draw, { shuffleForDisplay: true });
  const showDiscard = () => openPileModal(registries, 'Discard pile', combat.piles.discard);
  const showExhaust = () => openPileModal(registries, 'Exhausted pile', combat.piles.exhaust);
  $('.pile.draw').addEventListener('click', showDraw);
  $('.pile.discard').addEventListener('click', showDiscard);
  $('.pile.exhaust').addEventListener('click', showExhaust);
  // THE BOTTOM ROW SAYS WHAT IT IS (Constantine, 2026-09-04: "no tool tips on
  // bottom row for end turn, draw, end turn, discard and exhaust"). Every
  // other control on this screen carries a tooltip; the five that decide a
  // turn carried none. Counts are read at open time, so the panel is never a
  // stale copy of a number the row already shows.
  attachTooltip($('.energy-orb'), () => `<div class="tt-title">Actions</div>`
    + `${dv(combat.player).energy ?? combat.player.energy} of ${combat.player.energyMax} left this turn.`
    + `<div class="ti-detail">Playing a card spends its cost. Unspent actions do not carry over.</div>`);
  attachTooltip($('.pile.draw'), () => `<div class="tt-title">Draw pile</div>`
    + `${combat.piles.draw.length} card${combat.piles.draw.length === 1 ? '' : 's'} left to draw.`
    + `<div class="ti-detail">Tap to look through it. When it empties, the discard pile is shuffled back in.</div>`);
  attachTooltip($('.pile.discard'), () => `<div class="tt-title">Discard pile</div>`
    + `${combat.piles.discard.length} card${combat.piles.discard.length === 1 ? '' : 's'} played or dropped.`
    + `<div class="ti-detail">Tap to look through it. It returns to the draw pile when that runs out.</div>`);
  attachTooltip($('.pile.exhaust'), () => `<div class="tt-title">Exhausted</div>`
    + `${combat.piles.exhaust.length} card${combat.piles.exhaust.length === 1 ? '' : 's'} gone for this fight.`
    + `<div class="ti-detail">Tap to look through it. Exhausted cards do not come back until the fight ends.</div>`);
  attachTooltip($('.end-turn'), () => `<div class="tt-title">End Turn</div>`
    + `Hand off to the enemies, then draw a fresh hand.`
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
  const menuBtn = $('#combat-menu');
  if (onMenu) {
    menuBtn.addEventListener('click', (e) => {
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
    if (row) attachTooltip($('#combat-armoury'), () => `<div class="tt-title">${esc(row.label)}</div>${esc(row.tip)}`);
    attachTooltip(menuBtn, () =>
      `<div class="tt-title">Menu</div>${esc(quickNavMode() === 'off'
        ? 'Armoury, settings, controls and saving.'
        : 'Everywhere you can go from here.')}`);
  }

  // The Armoury mid-fight is the SAME panel, told it is in combat. Both active
  // set switches and item replacement route through engine intents so Energy,
  // live card piles, resources, Poise, and the combat snapshot stay atomic.
  function openCombatArmoury(request = '') {
    if (!registries.balance.equipment.enabled) return;
    const equipView = typeof request === 'string' ? request : '';
    const destination = request && typeof request === 'object' ? request.destination || '' : '';
    const panel = mountEquipment(document.body, {
      registries,
      run,
      meta: { settings: { customization: run.customization, ...(equipView ? { equipView } : {}) } },
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
  $('#combat-armoury').addEventListener('click', (event) => openCombatArmoury(event.currentTarget.dataset.equipView || ''));

  render();

  // Veils mount beside #app, not inside it. Watch that ownership boundary plus
  // the originating combat mount itself: #app is reused across screens and
  // fights, so finding *a* later `.combat` must never keep this mount's captured
  // pager nodes alive. The marker is a focused lifecycle probe, not a styling
  // hook; teardown removes it before a fresh combat creates its own owner.
  if (document.body && typeof MutationObserver !== 'undefined') {
    const pagerVeilObserver = new MutationObserver(() => {
      if (!combatEl.isConnected || app.querySelector('.combat') !== combatEl) {
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
  if (field && typeof MutationObserver !== 'undefined') {
    const aimObs = new MutationObserver(() => {
      if (aimScheduled) return;
      aimScheduled = true;
      setTimeout(() => {
        aimScheduled = false;
        if (app.querySelector('.combat')) refreshAim();
      }, 0);
    });
    aimObs.observe(field, { attributes: true, attributeFilter: ['class'], subtree: true });
  }
  focusHandDefault();

  // Combat-start events (relic triggers, opening draw) get a quick pass too.
  animateEvents(combat.eventLog.filter((e) => e.type === 'relicTriggered'), fxCtx, () => {});

  // First-run guided callouts (SPEC §9 M4) — once per player, over a live board.
  if (showTutorial) mountTutorial(app, { onDone: () => onTutorialDone && onTutorialDone() });
}
