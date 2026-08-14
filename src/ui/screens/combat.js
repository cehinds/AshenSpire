// src/ui/screens/combat.js — the combat screen (SPEC §7.2–7.4, mockup:
// docs/mockups/combat-screen.svg)
//
// Renders strictly from combat state; animates from dispatch events. Every
// number displayed comes from previewCard / previewIntent — no math here.

import { dispatch, previewCard, previewIntent, getEntity } from '../../engine/combat.js';
import { resolveCard } from '../../model/registries.js';
import { renderCard } from '../components/card.js';
import { openPileModal } from '../components/piles.js';
import { attachTooltip, hideTooltip, esc } from '../components/tooltip.js';
import { relicText } from '../components/card.js';
import { enemySprite, playerSprite, classGlyph, tintCss } from '../assets.js';
import { animateEvents, playTimeline, anchorLocalBox, viewportLocalBox, clampBox, VIEWPORT_ORIGIN } from '../fx.js';
import { intentBadge, intentTooltip, backdropClass, MENU, statusTooltipText, statusInstancePresentation, statusInstanceSemanticAttrs } from '../uiContent.js';
import { openQuickNav, quickNavMode, saveAction } from '../components/quicknav.js';
import { sfx } from '../sfx.js';
import { mountTutorial } from '../components/tutorial.js';
import { veilIsOpen } from '../components/veil.js';
import { focusFirst, matchAction, isEngaged, keyLabel, padLabel, hasGamepad } from '../input.js';
import { hintBarHtml, setHintMode } from '../components/hints.js';
import { dlog } from '../debuglog.js';
import { mountEquipment } from './equipment.js';
import { figureSpec } from '../../model/loadout.js';
import { trackGesture } from '../gesture.js';
import { resourceBars, markFlooredBars } from '../components/resbars.js';
import { renderArcaneExposure } from '../components/arcaneExposure.js';
import { resourceBarPlan, resourceDomains } from '../../model/resources.js';
import { beatArmer, armInspect } from '../components/holdconfirm.js';
import { flaskActionPlan } from '../../model/flaskActions.js';
import { flaskPresentation, mountFlaskActionMenu } from '../components/flask.js';
import { CHARGE_FLASK_KINDS, chargeFlaskDefinition } from '../../model/gracerefill.js';

export function mountCombat(app, { registries, run, combat, label, meta, onEnd, showTutorial, onTutorialDone, onSettings, onMenu, onSave, onQuit }) {
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
      <!-- THE MAIN HUD, TWO ROWS, HIS ASSIGNMENT (D10 wave 4):
           "the size of those bars to scale depending on max value ... with the
            max size filling up the full top row, with the menu and armament
            buttons at the end of that row, at the bottom of the hud should be
            the other hud items."
           Top row: the bar stack + the two buttons, nothing else. The stack is
           flex:1 with min-width:0, so ITS TRACK IS DERIVED — row width minus the
           buttons, minus padding and gaps. No width is typed anywhere, which is
           what lets a bar's length be an honest statement about a maximum. -->
      <header class="topbar combat-hud">
        <div class="hud-top">
          <div class="resbars-host"></div>
          <button class="topbar-btn" id="combat-armoury" title="Armaments">⚒</button>
          <button class="topbar-btn" id="combat-menu" title="Menu (M)">☰</button>
        </div>
        <div class="hud-bottom">
          <div class="portrait" style="border-color:${tintCss(run.customization && run.customization.tint)}">${esc((run.customization && run.customization.glyph) || classGlyph(run.class))}</div>
          <span class="nm">${esc(((run.customization && run.customization.name) || registries.classes.get(run.class).name).toUpperCase())} · ${esc(registries.classes.get(run.class).name.toUpperCase())}</span>
          <span class="cinders" style="color:var(--gold);font-size:13px">⛁ ${run.cinders}</span>
          <div class="flasks" style="display:flex;gap:6px"></div>
          <div class="relics"></div>
          <span class="fight-label">${esc(label)} · SEED ${esc(run.seedString)}</span>
        </div>
      </header>
      <div class="${backdropClass(run.actNumber)}"></div>
      <div class="field">
        <div class="player-zone"></div>
        <div class="enemy-row"></div>
      </div>
      <div class="hand-area">
        <div class="energy-orb"></div>
        <div class="hand"></div>
        <button class="end-turn">END TURN</button>
      </div>
      <div class="pile draw"><span class="n"></span><small>DRAW</small></div>
      <div class="pile discard"><span class="n"></span><small>DISCARD</small></div>
      <div class="pile exhaust" style="display:none"><span class="n"></span><small>EXHAUST</small></div>
      <div class="fx-layer"></div>
      <svg id="target-arrow" width="100%" height="100%" style="display:none">
        <line x1="0" y1="0" x2="0" y2="0" stroke="var(--gold)" stroke-width="3" stroke-dasharray="8 6"/>
      </svg>
      ${hintBarHtml('combat')}
    </div>`;

  const $ = (sel) => app.querySelector(sel);
  const combatEl = $('.combat');
  // The bar ceilings, DERIVED from the content (classes + equipment for the
  // player surface, plus every enemy for the under-model one) rather than typed.
  // Once per mount: it is a fact about the content, not about the frame.
  const resDomains = resourceDomains(registries);
  if (typeof window !== 'undefined') window.__combat = combat; // debug handle
  const fxCtx = {
    layer: $('.fx-layer'),
    combatEl,
    anchorFor: (id) => app.querySelector(`[data-eid="${id}"] .sprite`) || app.querySelector(`[data-eid="${id}"]`),
    relicAnchor: (relicId) => app.querySelector(`[data-relic-id="${relicId}"]`),
    orb: () => app.querySelector('.energy-orb'),
    // #61: fx beats read a proc row's display data (name/tint/icon) through
    // this accessor — one home, the status def itself.
    statusInfo: (sid) => registries.statuses.get(sid),
  };

  let selected = null; // card instanceId in click-targeting mode
  let selectedFlask = null; // flask slot index awaiting a target
  let selfArm = null; // self/buff card armed for a confirm (keyboard/gamepad)
  let busy = false; // animating / resolving
  let lastTargetId = null; // remember the last enemy aimed at (keyboard/pad QoL)
  let aimScheduled = false; // debounce for the aim-highlight observer

  // ---- hand layout: the OVERLAP arm of balance.ui.handLayout (C2) ----------
  //
  // The word's one home is balance.ui.handLayout; main.js derives it onto
  // <html data-hand-layout>; this block reads the ATTRIBUTE and nothing else.
  // When the word is 'paging' (the default), every line below is inert and
  // renderHand is byte-for-byte the shipped strip — that inertness is the C2
  // ruling ("the shipped behaviour keeps its seat") made checkable.
  //
  // OVERLAP, on the narrow shape: the whole hand lays inside the strip's own
  // width, each card overlapped by the next, z-order left-under-right (the
  // zIndex renderHand already writes). THE OVERLAP IS DERIVED, NEVER TYPED:
  // measured container width, measured card width, hand size — the same three
  // facts every render, so ten cards at Text XL fit exactly where five at S
  // spread out. Law 5 clause 1 is the constraint the arithmetic serves:
  // horizontal scroll travel ZERO in this mode (the strip's clause-2
  // exemption is PAGING's, and it does not travel with the word).
  //
  // The narrow fan transform is flattened here on purpose: a rotated card's
  // hit edge is a wedge, and in overlap the exposed sliver of every card but
  // the top IS its tap target — the sliver is the composition, so it stays
  // rectangular and measurable. Cramped slivers are the mode's stated cost;
  // the compensating reader is the inspect hold on every card (hold ~400 ms
  // → the card expands, unclipped, above everything — armInspect below).
  //
  // On the wide shape the word changes nothing: the wide hand is already an
  // overlapping fan (margin -1.4rem, combat.css), so 'overlap' is its shipped
  // truth and 'paging' has no wide meaning either — the word picks the NARROW
  // arrangement. Reconciliation still runs on shape flips so a resize from
  // narrow back to wide restores the fan transform this mode flattened.
  let handEls = []; // the rendered cards, in hand order (filled by renderHand)
  let handFan = []; // each card's shipped fan transform, same index
  const handLayoutWord = () => document.documentElement.dataset.handLayout;
  function applyHandLayout() {
    if (handLayoutWord() !== 'overlap') return;
    const hand = app.querySelector('.hand');
    if (!hand) return;
    const els = handEls.filter((el) => el.parentNode === hand);
    const n = els.length;
    if (!n) return;
    const narrow = document.documentElement.getAttribute('data-layout') === 'narrow';
    if (!narrow) {
      // wide: the shipped fan, exactly — undo anything the narrow arm wrote.
      els.forEach((el, i) => { el.style.transform = handFan[i]; el.style.marginLeft = ''; });
      return;
    }
    // Flatten first so the measurement below reads border-box widths, not the
    // axis-aligned box of a rotated card.
    els.forEach((el) => { el.style.transform = 'none'; });
    const cs = getComputedStyle(hand);
    // ONE COORDINATE SPACE, or the arithmetic lies (Law 2's whole subject).
    // The app scales under `body { zoom: var(--ui-zoom) }`, and the two rulers
    // available here disagree about it: clientWidth / scrollWidth / the margin
    // this writes are LOCAL px (pre-zoom), getBoundingClientRect is the zoomed
    // viewport. First cut mixed them and shipped 115 px of travel at 390x844 —
    // observed, not hypothetical. Everything below is LOCAL: the card's bcr
    // width is divided back through the body zoom it rendered under.
    const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
    // clientWidth is integer-rounded; solving against it exactly can leave the
    // content edge a sub-pixel past it, which scrollWidth then rounds UP into
    // one pixel of travel. One px is donated to certainty instead: the row is
    // solved to fit clientWidth - 1, so travel is zero by construction and
    // the instrument (tools/handlayout.mjs) can hold it at zero, not "small".
    const W = hand.clientWidth - 1 - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const gap = parseFloat(cs.columnGap) || 0;
    const C = els[0].getBoundingClientRect().width / zoom;
    const need = n * C + (n - 1) * gap;
    const o = n > 1 ? Math.max(0, (need - W) / (n - 1)) : 0;
    els.forEach((el, i) => { el.style.marginLeft = i && o ? `${-o}px` : ''; });
  }
  // Re-derive when the measured facts move: container width (window resize),
  // card width (Text size), and the narrow/wide word main.js writes. All three
  // observers reconcile through the same function, are attached only when the
  // layout word asks for them, and dispose themselves when this screen's DOM
  // is replaced (no unmount hook exists to hang cleanup on).
  if (typeof ResizeObserver !== 'undefined' && handLayoutWord() === 'overlap') {
    const alive = () => document.body.contains(combatEl);
    const ro = new ResizeObserver(() => { if (alive()) applyHandLayout(); else ro.disconnect(); });
    const mo = new MutationObserver(() => { if (alive()) applyHandLayout(); else mo.disconnect(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-layout'] });
    ro.observe($('.hand'));
    combatEl.__handRo = ro; // renderHand re-points card observation each render
  }

  function openCombatFlaskMenu(anchor, def, { slot = null, chargeKind = null, remaining = 1 } = {}) {
    const canUse = !busy && !combat.result && combat.phase === 'player' && remaining > 0;
    const useReason = remaining <= 0 ? 'No charges remaining'
      : busy ? 'Wait for the current action to finish'
        : combat.result ? 'Combat is already over' : combat.phase !== 'player' ? 'Wait for your turn' : '';
    const plan = flaskActionPlan({ context: 'combat', canUse, useReason });
    mountFlaskActionMenu(anchor, {
      def,
      plan,
      onCancel: () => {},
      onAction: (actionId) => {
        if (actionId !== 'use') return;
        if (def.targeted) {
          selectedFlask = selectedFlask === slot ? null : slot;
          selected = null;
          selfArm = null;
          render();
        } else {
          useFlask(slot, null, chargeKind);
        }
      },
      // The menu is the selection boundary; the explicit Use row still reads
      // the shared second-beat rule rather than inventing a screen-local rule.
      wireAction: (row, button, invoke) => {
        if (row.id !== 'use' || !row.enabled) return false;
        arm(button, 'useFlask', { ctx: { targeted: !!def.targeted }, onConfirm: invoke });
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
  const AIM_RED = '#e0463c';
  const AIM_BLUE = '#4d94e0';

  function tintClone(spriteWrap, color) {
    const src = spriteWrap.firstElementChild;
    if (!src) return null;
    const clone = src.cloneNode(true);
    const svg = clone.matches && clone.matches('svg') ? clone : clone.querySelector && clone.querySelector('svg');
    if (svg) {
      svg.querySelectorAll('*').forEach((n) => {
        const f = n.getAttribute && n.getAttribute('fill');
        const s = n.getAttribute && n.getAttribute('stroke');
        if (f && f !== 'none') n.setAttribute('fill', color);
        if (s && s !== 'none') n.setAttribute('stroke', color);
      });
    } else if (clone.style) {
      clone.style.background = color;
      clone.style.borderColor = color;
      clone.style.color = 'transparent';
      clone.style.boxShadow = 'none';
    }
    return clone;
  }

  function clearAim() {
    app.querySelectorAll('.aim-silho').forEach((n) => n.remove());
    app.querySelectorAll('.combatant.aiming').forEach((n) => n.classList.remove('aiming', 'aim-enemy', 'aim-self'));
  }

  function setAim(combatantEl, kind) {
    const spriteWrap = combatantEl.querySelector('.sprite');
    if (!spriteWrap) return;
    const clone = tintClone(spriteWrap, kind === 'self' ? AIM_BLUE : AIM_RED);
    if (!clone) return;
    const holder = document.createElement('div');
    holder.className = 'aim-silho';
    holder.appendChild(clone);
    spriteWrap.insertBefore(holder, spriteWrap.firstChild);
    combatantEl.classList.add('aiming', kind === 'self' ? 'aim-self' : 'aim-enemy');
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
  function render() {
    renderTopbar();
    renderPlayer();
    renderEnemies();
    renderHand();
    renderControls();
    refreshAim(); // re-apply the target glow after the board rebuilds
    // Hint bar context: while aiming, show Confirm/Cancel instead of zone keys.
    setHintMode(selected || selectedFlask != null || selfArm ? 'targeting' : null);
  }

  function renderTopbar() {
    const p = combat.player;
    const pv = dv(p);
    // THE MAIN HUD BAR STACK — health, then whatever rows sit under it, then
    // poise. Which rows those are is content/resources.js's business, not this
    // screen's: this call is the whole of the main HUD's meter code and it does
    // not change when a resource is added.
    //
    // The player has NO poise meter (state.js:204 — poiseMeter is created on
    // enemies only), so the poise row's reader returns null and the bar is
    // ABSENT. Not a 0/0 trough. That refusal is the same one a stamina row
    // would hit today, and it is visible on this screen right now.
    const host = $('.topbar .resbars-host');
    host.innerHTML = '';
    const mainPlan = resourceBarPlan(registries, 'main', pv, p, resDomains);
    host.appendChild(resourceBars(mainPlan, { surface: 'main', tooltipExtra: poiseTooltipExtra }));
    markFlooredBars(host);
    const relics = $('.topbar .relics');
    relics.innerHTML = '';
    for (const rid of p.relicIds) {
      const def = registries.relics.get(rid);
      const el = document.createElement('div');
      el.className = 'relic';
      el.dataset.relicId = rid;
      el.textContent = def.icon || '◆';
      attachTooltip(el, () => `<div class="tt-title">${esc(def.name)}</div>${esc(relicText(def))}`);
      relics.appendChild(el);
    }
    // Flask selection is inert. Every slot opens one shared action plan; only
    // its explicit Use row may spend a charge or enter targeting mode.
    const flasks = $('.topbar .flasks');
    flasks.innerHTML = '';
    for (const kind of CHARGE_FLASK_KINDS) {
      const def = chargeFlaskDefinition(registries, kind);
      const current = p.flaskCharges ? p.flaskCharges[`${kind}Current`] : 0;
      const el = document.createElement('button');
      el.className = 'relic flask-slot flask-charge';
      el.type = 'button';
      el.setAttribute('aria-disabled', String(current <= 0));
      el.appendChild(flaskPresentation(def, { showName: false }));
      const count = document.createElement('b');
      count.className = 'flask-charge-count';
      count.textContent = String(current);
      el.appendChild(count);
      attachTooltip(el, () => `<div class="tt-title">${esc(def.name)}</div>${esc(def.textTemplate || '')}<br>${current} charge${current === 1 ? '' : 's'} remaining.`);
      el.addEventListener('click', () => openCombatFlaskMenu(el, def, { chargeKind: kind, remaining: current }));
      flasks.appendChild(el);
    }
    p.flasks.forEach((f, slot) => {
      const def = registries.flasks.get(f.flaskId);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'relic flask-slot';
      el.dataset.flaskSlot = String(slot);
      el.style.cursor = 'pointer';
      if (selectedFlask === slot) el.style.borderColor = 'var(--parchment)';
      el.appendChild(flaskPresentation(def, { showName: false }));
      // Quick-use key badge (F/G/H by default; pad glyph while a pad drives).
      if (slot < 3) {
        const kb = document.createElement('span');
        kb.className = 'flask-key';
        const id = `flask${slot + 1}`;
        kb.textContent = hasGamepad() ? padLabel(id) || keyLabel(id) : keyLabel(id);
        el.appendChild(kb);
      }
      // THE LABEL READS THE BEAT, IT DOES NOT RESTATE IT. `data-beat` is written
      // by the machinery from the table, so the sentence a player reads and the
      // gesture the button actually wants cannot drift — and the icon is far too
      // small for the HOLD word the event bars carry (hidden in ui.css).
      attachTooltip(el, () => `<div class="tt-title">${esc(def.name)}</div>${esc(def.textTemplate || '')}`
        + '<br><i>Open actions to Use or Inspect.</i>');
      el.addEventListener('click', () => openCombatFlaskMenu(el, def, { slot }));
      flasks.appendChild(el);
    });
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

  function statusRow(entity) {
    const row = document.createElement('div');
    row.className = 'statuses';
    const plan = entity.kind === 'enemy' ? procDisplayPlan(entity) : { bars: [], pips: [] };
    for (const [sid, inst] of Object.entries(dv(entity).statuses || {})) {
      const def = registries.statuses.get(sid);
      const stacks = inst.meter ? inst.meter.value : inst.stacks;
      const presentation = statusInstancePresentation(def, inst);
      // M1's "absent at zero", applied to pips too: a spent proc row (💧0
      // after a burst) is an empty frame, not information (Sunna's S-flag).
      if (def.proc && stacks <= 0) continue;
      const el = document.createElement('div');
      el.className = 'status-icon';
      const semanticAttrs = statusInstanceSemanticAttrs(presentation);
      el.setAttribute('data-status-id', semanticAttrs['data-status-id']);
      el.setAttribute('data-status-value-token', semanticAttrs['data-status-value-token']);
      el.setAttribute('aria-label', semanticAttrs['aria-label']);
      el.style.borderColor = def.tint || 'var(--muted)'; // status-pip accent (data: status def)
      // Collapsed proc meter (M4 display cap): ring-fill pip — the pip's own
      // background is a conic fill in the row's tint, same value/threshold
      // semantics as the bar it stands in for.
      if (plan.pips.includes(sid)) {
        const fillPct = Math.min(100, (inst.meter.value / inst.meter.max) * 100);
        el.classList.add('proc-pip');
        el.style.background = `conic-gradient(${def.tint || 'var(--muted)'} ${fillPct}%, transparent ${fillPct}%)`;
      }
      // A resistance pip's number is its countdown (M3 — the receipt reads in
      // turns); every other pip keeps its stack count.
      const shown = def.resists && inst.duration != null ? inst.duration : presentation.valueText;
      el.innerHTML = `${esc(def.icon || '?')}<span class="stk">${shown}</span>`;
      attachTooltip(el, () => {
        let extra = '';
        if (inst.meter) extra = `<br>Build-up: ${inst.meter.value} / ${inst.meter.max}`;
        if (inst.duration != null) extra += `<br>Turns left: ${inst.duration}`;
        return `<div class="tt-title">${esc(presentation.label)}</div>${esc(presentation.tooltip)}${extra}`;
      });
      row.appendChild(el);
    }
    return row;
  }

  // Stagger's own text, from the status def (data), so a poise tooltip cannot
  // drift from the balance numbers. Passed INTO the renderer rather than known
  // by it — resbars.js must not learn what poise is.
  function poiseTooltipExtra(bar) {
    if (bar.id !== 'poise') return '';
    const stagDesc = (registries.statuses.has('staggered') && registries.statuses.get('staggered').tooltip) || '';
    return `Fill it to Stagger. ${esc(stagDesc)}`;
  }

  function meterBars(entity) {
    const v = dv(entity);
    const wrap = document.createElement('div');
    wrap.className = 'meters';
    // THE UNDER-MODEL HUD — "should really just show health and poise", his
    // words. Same renderer, same table, different surface: the rows carry which
    // surfaces they appear on, so the two-HUD split he drew is DATA and neither
    // screen decides it. Poise is absent under the player for the same reason
    // it is absent from his main HUD — the player has no poise meter — and
    // present under every enemy.
    const plan = resourceBarPlan(registries, 'model', v, entity, resDomains);
    const bars = resourceBars(plan, { surface: 'model', tooltipExtra: poiseTooltipExtra });
    // The 0.75 pulse is a per-row display rule, not a resource fact; it stays
    // on this screen rather than moving into the shared renderer.
    for (const bar of plan) {
      if (bar.id === 'poise' && bar.cur >= bar.max * 0.75) {
        const el = bars.querySelector('[data-res="poise"]');
        if (el) el.classList.add('full');
      }
    }
    while (bars.firstChild) wrap.appendChild(bars.firstChild);
    if (entity.kind === 'enemy') {
      const arcane = renderArcaneExposure(registries, v, disp ? disp.arcaneEvents : recentArcaneEvents);
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
        const def = registries.statuses.get(sid);
        const bar = document.createElement('div');
        bar.className = 'bar procbar';
        bar.dataset.status = sid;
        // S2: an active resistance dims the meter — the state reads without
        // opening a tooltip.
        if (hasResistAgainst(entity, sid)) bar.classList.add('resisted');
        bar.style.setProperty('--proc-tint', def.tint || 'var(--muted)');
        bar.innerHTML =
          `<div class="fill" style="width:${Math.min(100, (inst.meter.value / inst.meter.max) * 100)}%"></div>` +
          `<span class="glyph">${esc(def.icon || '?')}</span>`; // hue is never the only channel
        attachTooltip(bar, () => `<div class="tt-title">${esc(def.name)}</div>${inst.meter.value} / ${inst.meter.max}. ${esc(statusTooltipText(def))}`);
        wrap.appendChild(bar);
      }
    }
    return wrap;
  }

  function blockBadge(entity) {
    const v = dv(entity);
    if (v.block <= 0) return null;
    const b = document.createElement('div');
    b.className = 'block-badge';
    b.textContent = v.block;
    attachTooltip(b, () => `<div class="tt-title">Block ${v.block}</div>Absorbs attack damage. Expires at the start of the owner's turn.`);
    return b;
  }

  function renderPlayer() {
    const zone = $('.player-zone');
    zone.innerHTML = '';
    const p = combat.player;
    const box = document.createElement('div');
    box.className = `combatant player${selfArm ? ' armed' : ''}`;
    box.dataset.eid = 'player';
    // When a self/buff card is armed, the player is a confirmable target.
    if (selfArm) {
      box.dataset.focusable = '';
      box.style.cursor = 'pointer';
      box.addEventListener('click', () => {
        if (selfArm) playCard(selfArm, null);
      });
    }
    const sprite = document.createElement('div');
    sprite.className = 'sprite';
    sprite.appendChild(playerSprite(run.customization || {}, run.class, figureSpec(registries, run.loadout, run.class)));
    const badge = blockBadge(p);
    if (badge) sprite.appendChild(badge);
    box.appendChild(sprite);
    box.appendChild(meterBars(p));
    if (p.stanceId) {
      const st = registries.stances.get(p.stanceId);
      const chip = document.createElement('div');
      chip.className = `stance-chip ${p.stanceId}`;
      chip.innerHTML = `${esc(st.icon || '')} ${esc(st.name)}`;
      attachTooltip(chip, () => `<div class="tt-title">${esc(st.name)}</div>${esc(st.tooltip || '')}`);
      box.appendChild(chip);
    }
    box.appendChild(statusRow(p));
    zone.appendChild(box);
  }

  function intentEl(enemy) {
    const iv = previewIntent(combat, enemy.id);
    const el = document.createElement('div');
    const badge = intentBadge(iv);
    el.className = `intent ${badge.cls}`;
    el.innerHTML = badge.html;
    attachTooltip(el, () => intentTooltip(iv)); // solo → 'you'
    return el;
  }

  function renderEnemies() {
    const row = $('.enemy-row');
    row.innerHTML = '';
    const targeting = selected || selectedFlask != null;
    const living = combat.enemies.filter((e) => e.alive);
    for (const enemy of combat.enemies) {
      const def = registries.enemies.get(enemy.enemyId);
      const box = document.createElement('div');
      box.className = `combatant enemy${dv(enemy).alive ? '' : ' dead'}${targeting ? ' targetable' : ''}`;
      box.dataset.eid = enemy.id;
      if (enemy.alive) box.appendChild(intentEl(enemy));
      // Target-number badge for keyboard targeting (SPEC §7.3).
      if (enemy.alive && targeting) {
        const idx = living.indexOf(enemy);
        if (idx < 9) {
          const kh = document.createElement('span');
          kh.className = 'enemy-key';
          kh.textContent = idx + 1;
          box.appendChild(kh);
        }
      }
      const sprite = document.createElement('div');
      sprite.className = 'sprite';
      sprite.appendChild(enemySprite(def));
      const badge = blockBadge(enemy);
      if (badge) sprite.appendChild(badge);
      box.appendChild(sprite);
      const nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = def.name;
      box.appendChild(nm);
      box.appendChild(meterBars(enemy));
      box.appendChild(statusRow(enemy));
      if (enemy.alive) {
        box.addEventListener('click', () => {
          if (selected) playCard(selected, enemy.id);
          else if (selectedFlask != null) useFlask(selectedFlask, enemy.id);
        });
        box.addEventListener('pointerenter', () => (selected || selectedFlask != null) && box.classList.add('hover-target'));
        box.addEventListener('pointerleave', () => box.classList.remove('hover-target'));
      }
      row.appendChild(box);
    }
  }

  function renderHand() {
    const hand = $('.hand');
    hand.innerHTML = '';
    // The one home of the duration is balance.ui.inspectHold; the Number()||0
    // shape is why model/validate.js checks that row loud — an unreadable
    // value here would silently turn the gesture off.
    const inspectMs = Number((registries.balance.ui.inspectHold || {}).ms) || 0;
    const handList = disp ? disp.hand : combat.piles.hand;
    const n = handList.length;
    handList.forEach((inst, i) => {
      // disp.hand is a pre-dispatch snapshot; on a combat-ending play the engine
      // strands the in-flight card in no pile (finishCombat clears the queue),
      // so previewCard can no longer resolve it. Render such cards inert instead
      // of letting the throw wedge the timeline (this froze the game on the
      // killing blow).
      let pv = null;
      try {
        pv = previewCard(combat, inst.instanceId);
      } catch (e) {
        console.warn('[combat] hand card not previewable (stale snapshot):', inst.instanceId);
      }
      const affordable = !!pv && combat.player.energy >= (pv.costIsX ? 0 : pv.cost) && combat.player.mana >= pv.manaCost && !isUnplayable(inst);
      const el = renderCard(registries, inst, pv ? { preview: pv, affordable } : { affordable });
      const spread = Math.min(6, n) * 1.2;
      el.style.transform = `rotate(${(i - (n - 1) / 2) * (spread / Math.max(n - 1, 1))}deg) translateY(${Math.abs(i - (n - 1) / 2) * 6}px)`;
      el.style.zIndex = i;
      if (inst.instanceId === selected || inst.instanceId === selfArm) el.classList.add('selected');
      // Positional quick-play key badge: 1–9 then Q, tied to the slot not the
      // card. Hidden while a gamepad drives (body.pad-mode via refreshHintBars).
      if (i < 10) {
        const hint = document.createElement('span');
        hint.className = 'key-hint';
        hint.textContent = i < 9 ? i + 1 : 'Q';
        el.appendChild(hint);
      }
      // The reading hold — EVERY card, before the play wiring on purpose:
      // affordability gates playing, never reading (the card you cannot pay
      // for is the one you most need to read), and same-element listeners run
      // in registration order, which is what lets a completed read's lift die
      // in armInspect's click handler instead of selecting or playing below.
      armInspect(el, { ms: inspectMs, onOpen: hideTooltip });
      if (pv) wireCardInput(el, inst, pv, affordable);
      hand.appendChild(el);
    });
    // The overlap arm (block above renderHand): record what this render made,
    // then reconcile. Inert — including the observer re-point — unless the
    // layout word is 'overlap'; in 'paging' the loop above was the whole
    // render, unchanged.
    handEls = [...hand.children];
    handFan = handEls.map((el) => el.style.transform);
    if (combatEl.__handRo && handLayoutWord() === 'overlap') {
      const ro = combatEl.__handRo;
      ro.disconnect();
      ro.observe(hand);
      handEls.forEach((el) => ro.observe(el));
    }
    applyHandLayout();
  }

  function isUnplayable(inst) {
    return (resolveCard(registries, inst).keywords || []).includes('unplayable');
  }

  /** The pulse reports that the player still has an affordable play. */
  function endTurnHasPlayable() {
    const anyPlayable = combat.piles.hand.some((inst) => {
      const def = resolveCard(registries, inst);
      if ((def.keywords || []).includes('unplayable')) return false;
      return combat.player.energy >= (def.cost === 'X' ? 0 : def.cost)
        && combat.player.mana >= (def.manaCost || 0);
    });
    return combat.player.energy > 0 && anyPlayable;
  }

  function renderControls() {
    $('.energy-orb').textContent = `${combat.player.energy}/${combat.player.energyMax}`;
    // The bound key (or pad button) rides on the End Turn button itself, so the
    // shortcut is discoverable without reading the hint bar. Tracks rebinds.
    const etKey = hasGamepad() ? padLabel('endTurn') || keyLabel('endTurn') : keyLabel('endTurn');
    $('.end-turn').innerHTML = `END TURN <kbd class="et-key">${esc(etKey)}</kbd>`;
    $('.end-turn').classList.toggle('pulse', endTurnHasPlayable());
    // The innerHTML above just dropped the HOLD hint on the floor. `refresh()`
    // re-reads the action's state and re-dresses the button — and it is the
    // reason a beat can live on a control its own screen repaints every frame
    // without any screen tracking the dressing.
    if (endTurnBeat) endTurnBeat.refresh();
    $('.pile.draw .n').textContent = combat.piles.draw.length;
    $('.pile.discard .n').textContent = combat.piles.discard.length;
    const ex = $('.pile.exhaust');
    ex.style.display = combat.piles.exhaust.length ? '' : 'none';
    ex.querySelector('.n').textContent = combat.piles.exhaust.length;
  }

  // ---------- input: click-to-target + drag (SPEC §7.3, both modes) ----------
  function wireCardInput(el, inst, pv, affordable) {
    let dragGhost = null;
    let dragging = false;
    let suppressClick = false; // a finished drag must not double-fire as a click
    let startX = 0;
    let startY = 0;

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
          dragGhost.style.cssText += 'position:fixed;z-index:600;pointer-events:none;opacity:.9;transform:scale(1.1);';
          document.body.appendChild(dragGhost);
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
        }
      };
      trackGesture(ev, {
        onMove,
        onEnd: (up, { cancelled }) => {
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
          const enemyBox = under && under.closest ? under.closest('.enemy:not(.dead)') : null;
          if (pv.needsTarget) {
            if (enemyBox) playCard(inst.instanceId, enemyBox.dataset.eid);
          } else if (under && under.closest && under.closest('.field')) {
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
      } else if (ev.isTrusted) {
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

    // Dedicated (rebindable) overlay keys: Menu → Deck, plus jump-to-tab keys.
    for (const [id, tab] of [['menu', 'deck'], ['deck', 'deck'], ['relics', 'relics'], ['stats', 'stats']]) {
      if (matchAction(ev, id)) {
        ev.preventDefault();
        if (onMenu) onMenu(tab);
        return;
      }
    }

    if (ev.key === 'Escape') {
      if (selected || selectedFlask != null || selfArm) {
        selected = null;
        selectedFlask = null;
        selfArm = null;
        hideTooltip();
        render();
        focusHandDefault();
      }
      return;
    }
    if (busy || combat.result || combat.phase !== 'player') return;

    if (matchAction(ev, 'endTurn')) {
      ev.preventDefault();
      $('.end-turn').click();
      return;
    }

    // Flask keys select a slot and open its menu; they never auto-use.
    for (let slot = 0; slot < 3; slot++) {
      if (matchAction(ev, `flask${slot + 1}`)) {
        ev.preventDefault();
        const slotEl = $(`.flask-slot[data-flask-slot="${slot}"]`);
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
      const affordable = combat.player.energy >= (pv.costIsX ? 0 : pv.cost) && combat.player.mana >= pv.manaCost && !isUnplayable(inst);
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
          renderPlayer();
          renderEnemies();
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
  $('.pile.draw').addEventListener('click', showDraw);
  $('.pile.discard').addEventListener('click', showDiscard);
  $('.pile.exhaust').addEventListener('click', () => openPileModal(registries, 'Exhaust pile', combat.piles.exhaust));
  // Settings lives inside the Menu overlay (Settings tab) — one button, one home.
  //
  // Under the quick-nav experiment ☰ opens the list instead. Combat is the
  // screen that MAKES "context-specific" mean something: the draw and discard
  // piles are real destinations that exist nowhere else, and today the only way
  // to them is two small corner targets a thumb has to find.
  const menuBtn = $('#combat-menu');
  if (onMenu) {
    menuBtn.addEventListener('click', (e) => {
      if (quickNavMode() === 'off') return onMenu('deck');
      e.stopPropagation();
      openQuickNav(menuBtn, 'combat', {
        counts: { deck: run.deck.length, draw: combat.piles.draw.length, discard: combat.piles.discard.length },
        hasSave: !!(onSave || onQuit),
        actions: {
          tab: (id) => onMenu(id),
          armoury: () => $('#combat-armoury').click(), // the button's own handler, not a copy of it
          draw: () => showDraw(),
          discard: () => showDiscard(),
          ...(onSave ? { save: saveAction(onSave) } : {}),
          ...(onQuit ? { quit: () => onQuit() } : {}),
        },
      });
    });
  }

  // Law 3 clause 4 — real tooltips on the two topbar buttons, text from the same
  // MENU table. Note the label: the ⚒ glyph is "Armoury" on the map and
  // "Armaments" here, and it was ALREADY context-specific before anyone asked.
  {
    const row = (MENU.combat || []).find((r) => r.act === 'armoury');
    if (row) attachTooltip($('#combat-armoury'), () => `<div class="tt-title">${esc(row.label)}</div>${esc(row.tip)}`);
    attachTooltip(menuBtn, () =>
      `<div class="tt-title">Menu</div>${esc(quickNavMode() === 'off'
        ? 'Deck, relics, stats, settings and saving.'
        : 'Everywhere you can go from here.')}`);
  }

  // The Armoury mid-fight is the SAME panel, told it is in combat: armour and
  // storage seal themselves, and picking another hand set routes through the
  // engine intent that charges for it instead of mutating the loadout here.
  $('#combat-armoury').addEventListener('click', () => {
    if (!registries.balance.equipment.enabled) return;
    const panel = mountEquipment(document.body, {
      registries,
      run,
      meta: { settings: { customization: run.customization } },
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
    });
  });

  render();

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
