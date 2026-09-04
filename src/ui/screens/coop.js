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
import { renderCard } from '../components/card.js';
import { mountSmithUpgradeModal } from '../components/smithUpgradeModal.js';
import { smithSelectionModel } from '../models/SmithSelectionModel.js';
import { attachTooltip, hideTooltip, esc } from '../components/tooltip.js';
import { anchorLocalBox, clampBox, guardHitFloatParts } from '../fx.js';
import { nodeName, nodeBlurb, actTitle, intentBadge, intentTooltip, backdropClass, statusInstancePresentation, statusInstanceSemanticAttrs } from '../uiContent.js';
import { resolveCard, passiveSum } from '../../model/registries.js';
import { resourceBarPlan, resourceDomains } from '../../model/resources.js';
import { resourceBars } from '../components/resbars.js';
import { renderArcaneExposure } from '../components/arcaneExposure.js';
import { mountMapBoard } from '../components/mapboard.js';
import { flaskActionPlan } from '../../model/flaskActions.js';
import { flaskIdentityHtml, flaskTooltipHtml, mountFlaskActionMenu } from '../components/flask.js';
import { beatArmer } from '../../framework/optionDecision.js';
import { CHARGE_FLASK_KINDS, chargeFlaskDefinition } from '../../model/gracerefill.js';
import { mountHand } from '../components/hand.js';
import { focusElement, focusFirst, isEngaged, matchAction, setScreenKeyClaim } from '../input.js';
import { decorateFriendlyTarget } from '../components/friendlyTargets.js';
import { friendlyTargetPlan } from '../../model/friendlyTargets.js';
import { hudQuickSettingsHtml, wireHudQuickSettings } from '../components/hudQuickSettings.js';
import { hudQuickSettingsModel } from '../models/HudQuickSettingsModel.js';
// THE CHROME IS THE KIT'S: the seat strip is a Dock of Tabs with a Keycap and a
// StatePill, the turn announcement a Banner, the seat line a StatStrip (tinted
// name · energy Chip · state Pill), the party read-out a strip of Meters, the
// flasks a ButtonRow, the arming prompt a DetailCard, every asking scene a
// decision door (pageDoor + decide + OptionCards). Behaviour hooks the
// instruments read (`.coop-seat-tabs`, `.seat-tab`, `.coop-turn-banner`,
// `.coop-seat-name`, `.coop-voteline`, `.coop-flask(s)`, `#coop-*`) ride on
// the kit's parts and draw nothing.
import {
  el, html, button, buttonRow, tab, dock, keycap, pill, chip, statStrip, meter, banner as kitBanner, detailCard,
  kitItem, pageDoor, decide, options, optionCard, flavour, prose, subtitle, blocker, glyph as kitGlyph,
} from '../kit/index.js';

export function mountCoop(app, { registries, conn, myId, myIds, meta, onSettingsChange, onLeave }) {
  const resourceDomainTable = resourceDomains(registries);
  const arm = beatArmer(meta, registries);
  let snap = null;
  // Couch co-op: this screen may control several seats; `me` is the ACTIVE one.
  let seats = (myIds && myIds.length ? myIds : [myId]).slice();
  let seatIdx = 0;
  let me = seats[0];
  let selectedEnemy = null;
  let armedFlask = null; // non-offensive flask slot awaiting a throw seat
  let armedFriendlyCard = null; // friendly-targeted card instanceId awaiting a legal seat
  let prevCombat = null; // last combat scene, for snapshot-diff FX
  let pacing = false; // an enemy-turn replay is holding the render
  let pendingSnaps = []; // every unrendered authoritative frame, causal order
  let latestWireSnap = null; // newest wire state, even while the old board paces
  let receivedSnapshots = 0;
  let lastReceiptSeq = 0; // rendered authoritative combat receipt identity
  let guardCoopTool = null; // query-gated real-wire browser control
  let mapBoard = null; // the live act-map board, so a re-render can stop the old one
  let handStrip = null; // the live hand strip (components/hand.js), same discipline
  // The beat is the same on pointer, keyboard and pad since S7 went wide
  // (2026-08-17); the dial is the only switch. This line said "pointer-only;
  // named keyboard/pad activation is immediate" and was true when written.
  // UNMEASURED HERE, and said rather than assumed: no `?shot=` state opens a
  // co-op board, so nothing has driven a key or a pad at THIS End Turn. What is
  // measured is that it goes through the same `arm()` as combat's.
  let endTurnBeat = null;

  conn.setHandlers({
    onMessage: (msg) => {
      if (msg.t === 'rejoined') { seats = [msg.id]; seatIdx = 0; me = msg.id; return; }
      if (msg.t === 'state') receiveSnapshot(msg.snapshot);
    },
    onClose: () => {
      teardown();
      const leave = button({ label: 'Leave', weight: 'primary', id: 'coop-leave' });
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
  const send = (obj) => conn.send(obj.t === 'resync' ? obj : { ...obj, as: me });

  const sendFlaskUse = ({ slot = null, targetId = undefined, chargeKind = null } = {}) => send({
    t: 'flaskIntent',
    intent: { action: 'use', ...(slot != null ? { slot } : {}), ...(targetId ? { targetId } : {}), ...(chargeKind ? { chargeKind } : {}) },
  });

  function openCoopFlaskMenu(anchor, def, meP, { slot = null, chargeKind = null, remaining = 1, charges = null, useActionId = null } = {}) {
    const canUse = meP.alive && meP.connected && !meP.ended && remaining > 0;
    const useReason = remaining <= 0 ? 'No charges remaining'
      : !meP.connected ? 'This player is disconnected'
        : !meP.alive ? 'This player is down' : meP.ended ? 'This turn has ended' : '';
    const plan = flaskActionPlan({ context: 'combat', canUse, useReason });
    mountFlaskActionMenu(anchor, {
      def,
      plan,
      charges,
      useActionId,
      onCancel: () => {},
      onAction: (actionId) => {
        if (actionId !== 'use') return;
        if (chargeKind) sendFlaskUse({ chargeKind });
        else if (def.targeted) sendFlaskUse({ slot, targetId: selectedEnemy });
        else { armedFlask = armedFlask === slot ? null : slot; armedFriendlyCard = null; render(); }
      },
    });
  }

  function setSeat(i) {
    if (i === seatIdx || !seats[i]) return;
    seatIdx = i;
    me = seats[i];
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
    const pools = registries.framework.costProfile(def, {
      powerCostReduction: passiveSum(registries, player.relicIds, 'powerCostReduction', player.itemUpgradeLevels || {}),
      weightClass: player.weightClass || null,
    });
    return {
      energy: pools.variable ? 1 : pools.action, mana: pools.mana || 0, stamina: pools.stamina || 0,
      // The same numbers as a live preview, so the card face and its tooltip
      // show what the host will charge (renderCard reads opts.preview).
      preview: { costIsX: !!pools.variable, cost: pools.action, manaCost: pools.mana || 0, staminaCost: pools.stamina || 0, tokens: {} },
    };
  }
  function cardAffordableFromSnapshot(def, player) {
    if (!def || !player || player.ended || !player.alive || !player.connected) return false;
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
    if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
    if (!snap || snap.scene.kind !== 'combat') return;
    const meP = snap.scene.players.find((p) => p.id === me);
    if (!meP || !meP.alive || !meP.connected) return;
    const slot = matchedFlaskSlot(ev);
    if (slot >= 0) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (meP.flasks && meP.flasks[slot]) app.querySelector(`[data-coop-flask-slot="${slot}"]`)?.click();
      return;
    }
  };
  const keyHandler = (ev) => {
    if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
    if (ev.key === 'Tab' && seats.length > 1) { ev.preventDefault(); setSeat((seatIdx + 1) % seats.length); return; }
    if (ev.key === 'Escape' && (armedFriendlyCard || armedFlask != null)) {
      ev.preventDefault();
      if (!cancelFriendlyTargeting()) { armedFlask = null; render(); }
      return;
    }
    if (!snap || snap.scene.kind !== 'combat') return;
    const sc = snap.scene;
    const meP = sc.players.find((p) => p.id === me);
    if (!meP || !meP.alive || !meP.connected) return;
    if (ev.key === 'e' || ev.key === 'E') { if (!meP.ended) send({ t: 'endTurn' }); return; }
    const idx = /^[1-9]$/.test(ev.key) ? Number(ev.key) - 1 : ev.key === 'q' || ev.key === 'Q' ? 9 : -1;
    if (idx >= 0 && meP.hand[idx]) {
      const c = meP.hand[idx];
      const def = cardDef(c);
      if (!cardAffordableFromSnapshot(def, meP)) return;
      if (friendlyTargetPlan(def, me, sc.players).active) { armFriendlyTargeting(c.instanceId); return; }
      const needs = (def.effects || []).some((e) => e.target === 'enemy');
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
    releaseFlaskKeyClaim();
    removeEventListener('keydown', flaskKeyHandler, true);
    removeEventListener('keydown', keyHandler);
    clearInterval(padTimer);
    if (endTurnBeat) endTurnBeat();
    endTurnBeat = null;
    removeSeatTabs();
    if (mapBoard) { mapBoard.teardown(); mapBoard = null; }
    if (handStrip) { handStrip.teardown(); handStrip = null; }
    if (typeof window !== 'undefined' && window.__guardCoopTool === guardCoopTool) delete window.__guardCoopTool;
  }
  const myMember = () => (snap ? snap.party.find((p) => p.id === me) : null);
  const cardDef = (c) => resolveCard(registries, { cardId: c.cardId, upgraded: c.upgraded, mods: c.mods });
  guardCoopTool = typeof window !== 'undefined' && new URLSearchParams(location.search).has('guardTool') ? {
    resync: () => send({ t: 'resync' }),
    playFirstFromLatest: () => {
      const sc = latestWireSnap?.scene;
      const player = sc?.kind === 'combat' ? sc.players.find((entry) => entry.id === me) : null;
      const card = player?.hand.find((entry) => {
        const def = cardDef(entry);
        return (def.effects || []).some((effect) => effect.target === 'enemy')
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
    if (!snap) return;
    if (typeof window !== 'undefined') window.__coopSnapshot = snap; // read-only receipt handle
    if (endTurnBeat) endTurnBeat();
    endTurnBeat = null;
    const mm = myMember();
    if (mm && mm.catchupQueue && mm.catchupQueue.length) return renderCatchup(mm);
    if (snap.scene.kind !== 'combat') prevCombat = null;
    // The board holds a ResizeObserver and a timeout aimed at a scrollport the
    // next render is about to replace. The same leak the solo screen fixes at
    // its own re-mount, one screen over.
    if (mapBoard && snap.scene.kind !== 'map') { mapBoard.teardown(); mapBoard = null; }
    renderSeatTabs();
    switch (snap.scene.kind) {
      case 'map': return renderMap();
      case 'combat': return renderCombat();
      case 'reward': return renderReward();
      case 'shrine': return renderShrine();
      case 'event': return renderEvent();
      case 'complete': return renderComplete();
      default: app.innerHTML = ''; app.appendChild(el('div', { class: 'screen coop-scene' }, flavour(`${snap.scene.kind}…`, { class: 'coop-note' })));
    }
  }

  // ---- shared board helpers (snapshot-fed twins of combat.js) ---------------
  function statusRow(statuses) {
    const row = document.createElement('div');
    row.className = 'statuses';
    for (const [sid, inst] of Object.entries(statuses || {})) {
      if (!registries.statuses.has(sid)) continue;
      const def = registries.frameworkTerms.withStatusWords(registries.statuses.get(sid));
      const stacks = inst.meter ? inst.meter.value : inst.stacks;
      const presentation = statusInstancePresentation(def, inst);
      const el = document.createElement('div');
      el.className = 'status-icon';
      const semanticAttrs = statusInstanceSemanticAttrs(presentation);
      el.setAttribute('data-status-id', semanticAttrs['data-status-id']);
      el.setAttribute('data-status-value-token', semanticAttrs['data-status-value-token']);
      el.setAttribute('aria-label', semanticAttrs['aria-label']);
      el.style.borderColor = def.tint || 'var(--muted)'; // status-pip accent (data: status def)
      el.innerHTML = `${esc(def.icon || '?')}<span class="stk">${esc(presentation.valueText)}</span>`;
      attachTooltip(el, () => `<div class="tt-title">${esc(presentation.label)}</div>${esc(presentation.tooltip)}`);
      row.appendChild(el);
    }
    return row;
  }
  function meterBars(ent, isEnemy, recentEvents = []) {
    const wrap = document.createElement('div');
    wrap.className = 'meters';
    const hp = document.createElement('div');
    hp.className = 'bar hpbar';
    hp.innerHTML = `<div class="fill" style="width:${(Math.max(0, ent.hp) / ent.maxHp) * 100}%"></div><div class="label">${Math.max(0, ent.hp)} / ${ent.maxHp}</div>`;
    wrap.appendChild(hp);
    if (isEnemy && ent.poiseMeter && ent.poiseMeter.max) {
      const poise = document.createElement('div');
      poise.className = `bar poisebar${ent.poiseMeter.value >= ent.poiseMeter.max * 0.75 ? ' full' : ''}`;
      poise.innerHTML = `<div class="fill" style="width:${Math.min(100, (ent.poiseMeter.value / ent.poiseMeter.max) * 100)}%"></div>`;
      const staggered = registries.frameworkTerms.statusDisplay('staggered');
      const stagDesc = (staggered && staggered.tooltip) || '';
      attachTooltip(poise, () => `<div class="tt-title">Poise</div>${ent.poiseMeter.value} / ${ent.poiseMeter.max} — fill it to Stagger. ${stagDesc}`);
      wrap.appendChild(poise);
    }
    if (isEnemy) {
      const arcane = renderArcaneExposure(registries, ent, recentEvents);
      if (arcane) wrap.appendChild(arcane);
    }
    return wrap;
  }
  function blockBadge(block) {
    if (!block || block <= 0) return null;
    const b = document.createElement('div');
    b.className = 'block-badge';
    b.textContent = block;
    attachTooltip(b, () => `<div class="tt-title">Block ${block}</div>Absorbs attack damage.`);
    return b;
  }
  function intentEl(intent) {
    const el = document.createElement('div');
    const badge = intentBadge(intent);
    el.className = `intent ${badge.cls}`;
    el.innerHTML = badge.html;
    attachTooltip(el, () => intentTooltip(intent, { victim: 'each hero' }));
    return el;
  }

  // ---- combat (parity board) ------------------------------------------------
  function renderCombat() {
    const sc = snap.scene;
    const focusedFriendlySeat = (app.querySelector('.coop-seat[data-friendly-target].gp-focus')
      || document.activeElement?.closest?.('.coop-seat[data-friendly-target]'))?.dataset.seat || null;
    let restoreFriendlyCardFocus = null;
    const living = sc.enemies.filter((e) => e.hp > 0);
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
      <div class="combat coop">
        <header class="topbar combat-hud">
          ${hudQuickSettingsHtml(hudQuickSettingsModel({
            place: 'combat',
            presentation: registries.balance.ui.hudQuickSettings,
            settings: meta.settings || {},
          }))}
          <div class="hud-top">
            <div class="resbars-host"></div>
            <span class="fight-label">${esc(actTitle(snap.actNumber))} · FLOOR ${snap.floor} · SEED ${esc(snap.seedString)}</span>
            <button class="subtle coop-leave" id="coop-leave">Leave</button>
          </div>
        </header>
        <div class="${backdropClass(snap.actNumber)}"></div>
        <div class="field">
          <div class="player-zone"></div>
          <div class="enemy-row"></div>
        </div>
        ${meP && ((meP.flasks && meP.flasks.length) || meP.flaskCharges) ? '<div class="coop-flasks-host"></div>' : ''}
        ${arming ? '<div class="coop-arm-host"></div>' : ''}
        <div class="hand-area">
          <!-- The kit's StatPair and Button (styles/kit.css): the co-op board's
               two hand-rolled controls wear the same atoms the solo action row
               does, so neither surface carries a shape of its own. -->
          <span class="as-statpair energy-orb cell stack lg" role="status" aria-label="Actions remaining"><span class="sp-k">Actions</span><span class="sp-v">${meP ? `${meP.energy}/${meP.energyMax}` : ''}</span></span>
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
          <button type="button" class="as-btn primary end-turn tall" id="coop-endturn">End Turn</button>
        </div>
        <div class="fx-layer"></div>
      </div>`;
    wireHudQuickSettings(app, { settings: meta.settings || {}, onSettingsChange });

    // The active seat gets the same main-HUD plan as solo. Values come only
    // from the host snapshot; a missing current/max pair produces no bar.
    const mainHost = app.querySelector('.topbar .resbars-host');
    if (mainHost && meP) {
      const mainPlan = resourceBarPlan(registries, 'main', meP, meP, resourceDomainTable);
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
      const sprite = document.createElement('div');
      sprite.className = 'sprite';
      sprite.appendChild(playerSprite({ tint: m.tint, glyph: m.glyph, spriteStyle: m.spriteStyle }, m.classId));
      const bb = blockBadge(p.block); if (bb) sprite.appendChild(bb);
      box.appendChild(sprite);
      // THE SEAT LINE: the tinted name (the identity span hudbars reads,
      // first child), a "you" Pill, the energy Chip, and the seat's state as
      // a StatePill — one StatStrip, centred under the sprite.
      const seatState = !p.connected ? { label: 'away', on: false } : !p.alive ? { label: 'down', on: false } : p.ended ? { label: '✓ ended', on: false } : { label: '● turn', on: true };
      const nm = statStrip([
        el('span', { class: 'coop-seat-player', style: { color: tintCss(m.tint) }, text: m.name || p.id }),
        p.id === me ? pill({ label: 'you', round: true, on: true }) : null,
        chip({ key: '⚡', value: `${p.energy}/${p.energyMax}`, attrs: { 'aria-label': `Energy ${p.energy} of ${p.energyMax}` } }),
        pill({ ...seatState, attrs: { class: 'coop-turnflag' } }),
      ], { class: 'centered coop-seat-name' });
      box.appendChild(nm);
      // Your own seat glows in YOUR accent, not a fixed gold.
      if (p.id === me) sprite.style.filter = `drop-shadow(0 0 6px ${tintCss(m.tint)})`;
      box.appendChild(meterBars(p, false));
      box.appendChild(statusRow(p.statuses));
      if (friendly) {
        decorateFriendlyTarget(box, { relationship: friendly.relationship, label: m.name || p.id });
        box.addEventListener('click', () => {
          const cardInstanceId = armedFriendlyCard;
          if (!cardInstanceId) return;
          armedFriendlyCard = null;
          hideTooltip();
          render();
          send({ t: 'playCard', cardInstanceId, targetId: p.id });
        });
      } else if (armedFlask != null && p.alive && p.connected) {
        box.addEventListener('click', () => {
          sendFlaskUse({ slot: armedFlask, targetId: p.id === me ? undefined : p.id });
          armedFlask = null;
        });
      }
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
      if (!dead) box.appendChild(intentEl(e.intent));
      const sprite = document.createElement('div');
      sprite.className = 'sprite';
      sprite.appendChild(enemySprite(def));
      const bb = blockBadge(e.block); if (bb) sprite.appendChild(bb);
      box.appendChild(sprite);
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = def.name; box.appendChild(nm);
      box.appendChild(meterBars(e, true, (sc.events || []).filter((event) => (
        event.targetId === e.id && (event.type === 'arcaneExposureRefused' || event.type === 'arcaneBreak' || event.type === 'arcaneExposureChanged')
      ))));
      box.appendChild(statusRow(e.statuses));
      if (!dead) box.addEventListener('click', () => { selectedEnemy = e.id; render(); });
      row.appendChild(box);
    }

    // My hand — THE hand renderer, mounted fresh per snapshot render (this
    // screen rebuilds its DOM wholesale; the old strip's observers are torn
    // down first, the mapBoard discipline one screen over). The strip draws;
    // this callback is the network door: a played card is ALWAYS a server
    // intent (`send`), never local dispatch — the client renders snapshots
    // and asks, it does not resolve.
    if (handStrip) handStrip.teardown();
    handStrip = mountHand(app.querySelector('.hand'), {
      registries,
      wireCard: (el, entry) => {
        el.addEventListener('click', () => {
          if (!entry.affordable) return;
          const effects = entry.def.effects || [];
          if (friendlyTargetPlan(entry.def, me, sc.players).active) {
            armFriendlyTargeting(entry.inst.instanceId);
            return;
          }
          const needs = effects.some((ef) => ef.target === 'enemy');
          send({ t: 'playCard', cardInstanceId: entry.inst.instanceId, targetId: needs ? selectedEnemy : undefined });
        });
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
                : !energyAffordable ? 'Not enough Energy' : 'Turn already ended';
          return {
            inst: { cardId: c.cardId, upgraded: c.upgraded, instanceId: c.instanceId, mods: c.mods },
            def, name: def.name, affordable, reason,
            preview: costs.preview,
            selected: c.instanceId === armedFriendlyCard,
          };
        }),
      });
    } else {
      handStrip.render({ cards: [], emptyHtml: '<div class="coop-note">Spectating the fight…</div>' });
    }

    // Flasks — a ButtonRow of the kit's buttons; an armed one wears primary.
    const fhost = app.querySelector('.coop-flasks-host');
    if (fhost && meP) {
      const flaskButtons = [];
      for (const kind of CHARGE_FLASK_KINDS) {
        const fd = chargeFlaskDefinition(registries, kind);
        const current = meP.flaskCharges ? meP.flaskCharges[`${kind}Current`] : 0;
        const b = button({ label: '', className: 'coop-flask flask-charge', attrs: { 'aria-disabled': String(current <= 0), 'aria-label': `${fd.name}: ${current} charges remaining` } });
        b.innerHTML = `${flaskIdentityHtml(fd)} <b>${current}</b>`;
        attachTooltip(b, () => flaskTooltipHtml(fd, { charges: current }));
        b.addEventListener('click', () => openCoopFlaskMenu(b, fd, meP, { chargeKind: kind, remaining: current, charges: current }));
        flaskButtons.push(b);
      }
      meP.flasks.forEach((f, i) => {
        const fd = registries.flasks.get(f.flaskId);
        const b = button({ label: '', className: `coop-flask${armedFlask === i ? ' armed primary' : ''}`, attrs: { dataset: { coopFlaskSlot: String(i) }, 'aria-pressed': armedFlask === i ? 'true' : 'false' } });
        b.innerHTML = `${flaskIdentityHtml(fd)}${fd.targeted ? '' : ' ▾'}`;
        attachTooltip(b, () => flaskTooltipHtml(fd));
        b.addEventListener('click', () => openCoopFlaskMenu(b, fd, meP, { slot: i }));
        flaskButtons.push(b);
      });
      fhost.replaceWith(buttonRow({ size: 'medium', buttons: flaskButtons, className: 'center coop-flasks' }));
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
      card.appendChild(buttonRow({ size: 'short', buttons: [button({ label: 'Cancel', id: throwing ? 'coop-cancel-flask' : 'coop-cancel-target' })] }));
      ahost.replaceWith(card);
    }

    const canEnd = meP && meP.alive && meP.connected && !meP.ended;
    const et = app.querySelector('#coop-endturn');
    et.disabled = !canEnd;
    et.classList.toggle('pulse', canEnd && meP.energy > 0);
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
    spawnCombatFx(sc, prevCombat);
    prevCombat = sc;
    wireLeave();
  }

  // ---- map (THE act map, mounted with a co-op viewer) ------------------------
  function renderMap() {
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
        nodes: map.nodes, columns: map.columns, actNumber: snap.actNumber,
        startIds: map.startIds, bossId: map.bossId,
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
          `<div class="tt-title">${esc(nodeName(shownType))}</div>${nodeBlurb(shownType)}${reachable ? '<br>Click to vote for this path.' : ''}`,
        onPick: (id) => send({ t: 'chooseNode', nodeId: id }),
      },
    });
    mapBoard.recenter();
    renderPartyBar();
    wireLeave();
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
    const leave = button({ label: 'Leave', id: 'coop-leave' });
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
  function renderReward() {
    const offer = snap.scene.offers[me];
    if (!offer) { sceneDoor({ title: 'Spoils', children: [waiting('Waiting for the others to choose…')] }); return; }
    const stone = offer.smithingStoneReceipt;
    const grid = el('div', { class: 'reward-row' });
    let pick = { cardId: null, takeRelic: false, flask: false };
    const submit = () => send({ t: 'chooseReward', pick });
    offer.cardIds.forEach((cid) => {
      const card = renderCard(registries, { cardId: cid, upgraded: false }, {});
      card.addEventListener('click', () => { pick.cardId = cid; submit(); });
      grid.appendChild(card);
    });
    const takes = [
      offer.relicId ? choice({ glyph: '◆', name: 'Take the relic', description: registries.relics.get(offer.relicId).name, className: 'coop-take', attrs: { dataset: { take: 'relic' } } }) : null,
      offer.flaskId ? choice({ glyph: '⚗', name: 'Take the flask', description: registries.flasks.get(offer.flaskId).name, className: 'coop-take', attrs: { dataset: { take: 'flask' } } }) : null,
      choice({ glyph: '›', name: 'Skip the card', attrs: { dataset: { take: 'skip' } } }),
    ];
    sceneDoor({
      title: `${String(snap.scene.pool || 'The').replace(/^./, (c) => c.toUpperCase())} spoils`,
      note: stone?.amount > 0 ? `⚒ ${stone.amount} Smithing Stone secured · ${stone.stoneBalanceAfter} total` : '',
      children: [subtitle('Choose a card'), grid, options(takes, { class: 'coop-choices' })],
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
    sceneDoor({
      title: 'Shrine of Emberlight',
      children: done ? [waiting('Waiting for the party…')] : [options([
        choice({ glyph: '✚', name: 'Rest', description: 'Heal yourself.', attrs: { dataset: { shrine: 'rest' } } }),
        choice({ glyph: '⚒', name: 'Upgrade an item', description: `${stones} Stone${stones === 1 ? '' : 's'}`, disabled: !candidates.length, reason: candidates.length ? '' : 'Nothing here can be upgraded.', attrs: { id: 'coop-smith' } }),
        ...allies.map((a) => choice({ glyph: '❤', name: `Mend ${a.name}`, description: '+30% HP', className: 'coop-take', attrs: { dataset: { mend: a.id } } })),
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
      sceneDoor({
        title: ev ? ev.name : 'A Happening',
        children: [
          prose(text, { class: 'coop-event-result' }),
          acked ? waiting('Waiting for the party…') : options([
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
    const grid = item.type === 'reward' ? el('div', { class: 'reward-row' }) : null;
    const relic = (item.type === 'reward' && item.offer.relicId) || (item.type === 'treasure' && item.relicId);
    sceneDoor({
      title, eyebrow: debt,
      note: 'Claim what you would have earned while away.',
      children: [
        grid,
        options([
          relic ? choice({ glyph: '◆', name: 'Take the relic', className: 'coop-take', attrs: { dataset: { cu: 'relic' } } }) : null,
          choice({ glyph: '›', name: 'Skip', attrs: { dataset: { cu: 'skip' } } }),
        ], { class: 'coop-choices' }),
      ],
    });
    const resolve = (pick) => send({ t: 'catchupChoice', index: 0, pick });
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
    latestWireSnap = s;
    receivedSnapshots += 1;
    if (pacing) {
      const seq = s.scene?.kind === 'combat' ? Number(s.scene.receiptSeq) || 0 : 0;
      const duplicate = seq > 0 && pendingSnaps.some((entry) => entry.scene?.receiptSeq === seq);
      if (!duplicate) pendingSnaps.push(s);
      return;
    }
    const sc = s.scene;
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
      banner('ENEMY TURN');
      await sleep(650);
      for (const mv of moves) {
        const box = app.querySelector(`[data-eid="${mv.sourceId}"]`);
        if (box && !box.classList.contains('dead')) {
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
      if (snap.scene.kind === 'combat') banner(`TURN ${snap.scene.turn}`, true);
    }
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
      if (box) box.classList.add('hitflash', heavy ? 'hit-heavy' : 'hit');
    };
    // Authoritative receipts own hit floats. Snapshot deltas remain the home
    // for healing, guard gain and legacy non-attack HP changes only.
    const receiptLossByTarget = new Map();
    const receiptHealByTarget = new Map();
    // JSON resync creates a new object for an unchanged scene. The host's
    // receiptSeq, not local object identity, owns whether these receipts are new.
    const receiptSeq = Number(now.receiptSeq) || 0;
    const hasNewReceipts = receiptSeq > lastReceiptSeq;
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
