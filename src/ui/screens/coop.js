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
import { renderCard, upgradePreviewHtml } from '../components/card.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { anchorLocalBox, clampBox, guardHitFloatParts } from '../fx.js';
import { nodeName, nodeBlurb, actTitle, intentBadge, intentTooltip, backdropClass, statusInstancePresentation, statusInstanceSemanticAttrs } from '../uiContent.js';
import { resolveCard } from '../../model/registries.js';
import { resourceBarPlan, resourceDomains } from '../../model/resources.js';
import { resourceBars } from '../components/resbars.js';
import { renderArcaneExposure } from '../components/arcaneExposure.js';
import { mountMapBoard } from '../components/mapboard.js';
import { flaskActionPlan } from '../../model/flaskActions.js';
import { flaskIdentityHtml, mountFlaskActionMenu } from '../components/flask.js';
import { beatArmer } from '../components/holdconfirm.js';
import { CHARGE_FLASK_KINDS, chargeFlaskDefinition } from '../../model/gracerefill.js';
import { mountHand } from '../components/hand.js';

export function mountCoop(app, { registries, conn, myId, myIds, meta, onLeave }) {
  const resourceDomainTable = resourceDomains(registries);
  const arm = beatArmer(meta, registries);
  let snap = null;
  // Couch co-op: this screen may control several seats; `me` is the ACTIVE one.
  let seats = (myIds && myIds.length ? myIds : [myId]).slice();
  let seatIdx = 0;
  let me = seats[0];
  let selectedEnemy = null;
  let armedFlask = null; // non-offensive flask slot awaiting a throw seat
  let armedAllyCard = null; // ally-targeted card instanceId awaiting a seat
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
    onClose: () => { teardown(); app.innerHTML = `<div class="screen"><div class="coop-note">⚠ Connection to the fire was lost.</div><button class="subtle" id="coop-leave">Leave</button></div>`; wireLeave(); },
  });

  // Every game intent carries the ACTIVE seat (`as`); the server validates
  // ownership and falls back to the connection's main seat.
  const send = (obj) => conn.send(obj.t === 'resync' ? obj : { ...obj, as: me });

  const sendFlaskUse = ({ slot = null, targetId = undefined, chargeKind = null } = {}) => send({
    t: 'flaskIntent',
    intent: { action: 'use', ...(slot != null ? { slot } : {}), ...(targetId ? { targetId } : {}), ...(chargeKind ? { chargeKind } : {}) },
  });

  function openCoopFlaskMenu(anchor, def, meP, { slot = null, chargeKind = null, remaining = 1 } = {}) {
    const canUse = meP.alive && meP.connected && !meP.ended && remaining > 0;
    const useReason = remaining <= 0 ? 'No charges remaining'
      : !meP.connected ? 'This player is disconnected'
        : !meP.alive ? 'This player is down' : meP.ended ? 'This turn has ended' : '';
    const plan = flaskActionPlan({ context: 'combat', canUse, useReason });
    mountFlaskActionMenu(anchor, {
      def,
      plan,
      onCancel: () => {},
      onAction: (actionId) => {
        if (actionId !== 'use') return;
        if (chargeKind) sendFlaskUse({ chargeKind });
        else if (def.targeted) sendFlaskUse({ slot, targetId: selectedEnemy });
        else { armedFlask = armedFlask === slot ? null : slot; armedAllyCard = null; render(); }
      },
    });
  }

  function setSeat(i) {
    if (i === seatIdx || !seats[i]) return;
    seatIdx = i;
    me = seats[i];
    armedFlask = null;
    armedAllyCard = null;
    render();
  }

  // A seat has something to do in the current scene (drives the tab pips).
  function seatPending(id) {
    const sc = snap && snap.scene;
    if (!sc) return false;
    if (sc.kind === 'map') return !!(sc.votes && !sc.votes[id]) || !sc.votes;
    if (sc.kind === 'combat') { const p = sc.players.find((x) => x.id === id); return !!(p && p.alive && p.connected && !p.ended); }
    if (sc.kind === 'reward') return !!(sc.offers[id] && !sc.chosen[id]);
    if (sc.kind === 'shrine' || sc.kind === 'event') return !(sc.done && sc.done[id]);
    return false;
  }

  function renderSeatTabs() {
    if (seats.length < 2) return;
    // The tab bar lives on document.body (a fixed overlay), so look it up there
    // — querying inside `app` never finds it and would spawn a duplicate per
    // render (stacking stale seat tabs).
    const host = document.querySelector('.coop-seat-tabs') || (() => {
      const d = document.createElement('div');
      d.className = 'coop-seat-tabs';
      document.body.appendChild(d);
      return d;
    })();
    host.innerHTML = seats.map((id, i) => {
      const p = snap.party.find((x) => x.id === id) || {};
      return `<button class="seat-tab${i === seatIdx ? ' on' : ''}" data-seat-i="${i}" style="border-color:${tintCss(p.tint)}">
        ${classGlyph(p.classId)} ${esc(p.name || id)}${seatPending(id) ? ' <span class="pip">●</span>' : ''}</button>`;
    }).join('') + '<span class="seat-hint">Tab</span>';
    host.querySelectorAll('.seat-tab').forEach((b) => b.addEventListener('click', () => setSeat(Number(b.dataset.seatI))));
  }

  function removeSeatTabs() {
    const d = document.querySelector('.coop-seat-tabs');
    if (d) d.remove();
  }

  // ---- couch input: keyboard drives the active seat; pads own their seats ---
  const keyHandler = (ev) => {
    if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
    if (ev.key === 'Tab' && seats.length > 1) { ev.preventDefault(); setSeat((seatIdx + 1) % seats.length); return; }
    if (!snap || snap.scene.kind !== 'combat') return;
    const sc = snap.scene;
    const meP = sc.players.find((p) => p.id === me);
    if (!meP || !meP.alive || !meP.connected) return;
    if (ev.key === 'e' || ev.key === 'E') { if (!meP.ended) send({ t: 'endTurn' }); return; }
    const fl = { f: 0, g: 1, h: 2 }[ev.key.toLowerCase()];
    if (fl != null && meP.flasks && meP.flasks[fl]) {
      app.querySelector(`[data-coop-flask-slot="${fl}"]`)?.click();
      return;
    }
    const idx = /^[1-9]$/.test(ev.key) ? Number(ev.key) - 1 : ev.key === 'q' || ev.key === 'Q' ? 9 : -1;
    if (idx >= 0 && !meP.ended && meP.hand[idx]) {
      const c = meP.hand[idx];
      const def = cardDef(c);
      if ((def.effects || []).some((e) => e.target === 'ally')) { armedAllyCard = c.instanceId; render(); return; }
      const needs = (def.effects || []).some((e) => e.target === 'enemy');
      send({ t: 'playCard', cardInstanceId: c.instanceId, targetId: needs ? selectedEnemy : undefined });
    }
  };
  document.addEventListener('keydown', keyHandler);
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
    document.removeEventListener('keydown', keyHandler);
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
          && player.energy >= (def.cost === 'X' ? 1 : def.cost)
          && player.mana >= (def.manaCost || 0);
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
      default: app.innerHTML = `<div class="screen"><div class="coop-note">${esc(snap.scene.kind)}…</div></div>`;
    }
  }

  // ---- shared board helpers (snapshot-fed twins of combat.js) ---------------
  function statusRow(statuses) {
    const row = document.createElement('div');
    row.className = 'statuses';
    for (const [sid, inst] of Object.entries(statuses || {})) {
      if (!registries.statuses.has(sid)) continue;
      const def = registries.statuses.get(sid);
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
      const stagDesc = (registries.statuses.has('staggered') && registries.statuses.get('staggered').tooltip) || '';
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
    const living = sc.enemies.filter((e) => e.hp > 0);
    if (selectedEnemy == null || !living.find((e) => e.id === selectedEnemy)) selectedEnemy = living[0] ? living[0].id : null;
    const meP = sc.players.find((p) => p.id === me);
    const arming = armedFlask != null || armedAllyCard != null;
    const armedCardDef = armedAllyCard && meP ? (() => { const c = meP.hand.find((h) => h.instanceId === armedAllyCard); return c ? cardDef(c) : null; })() : null;
    if (armedAllyCard && !armedCardDef) armedAllyCard = null; // card left the hand

    app.innerHTML = `
      <div class="combat coop">
        <header class="topbar combat-hud">
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
        ${meP && ((meP.flasks && meP.flasks.length) || meP.flaskCharges) ? '<div class="coop-flasks"></div>' : ''}
        ${armedFlask != null ? `<div class="coop-arm">Throwing <b>${esc(registries.flasks.get(meP.flasks[armedFlask].flaskId).name)}</b> — click a hero seat to give it. <button class="subtle" id="coop-cancel-flask">Cancel</button></div>` : ''}
        ${armedCardDef ? `<div class="coop-arm">Playing <b>${esc(armedCardDef.name)}</b> — click the hero who receives it. <button class="subtle" id="coop-cancel-flask">Cancel</button></div>` : ''}
        <div class="hand-area">
          <div class="energy-orb">${meP ? `${meP.energy}/${meP.energyMax}` : ''}</div>
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
          <button class="end-turn" id="coop-endturn">END TURN</button>
        </div>
        <div class="fx-layer"></div>
      </div>`;

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
      box.className = `combatant player coop-seat${p.id === me ? ' me' : ''}${p.ended ? ' ended' : ''}${p.alive ? '' : ' down'}${p.connected ? '' : ' away'}${arming && p.alive && p.connected ? ' throw-target' : ''}`;
      box.dataset.seat = p.id;
      const sprite = document.createElement('div');
      sprite.className = 'sprite';
      sprite.appendChild(playerSprite({ tint: m.tint, glyph: m.glyph, spriteStyle: m.spriteStyle }, m.classId));
      const bb = blockBadge(p.block); if (bb) sprite.appendChild(bb);
      box.appendChild(sprite);
      const nm = document.createElement('div');
      nm.className = 'coop-seat-name';
      nm.innerHTML = `<span style="color:${tintCss(m.tint)}">${esc(m.name || p.id)}</span>${p.id === me ? ' <b>(you)</b>' : ''} · ⚡${p.energy}/${p.energyMax} <span class="coop-turnflag">${!p.connected ? 'away' : !p.alive ? 'down' : p.ended ? '✓ ended' : '● turn'}</span>`;
      box.appendChild(nm);
      // Your own seat glows in YOUR accent, not a fixed gold.
      if (p.id === me) sprite.style.filter = `drop-shadow(0 0 6px ${tintCss(m.tint)})`;
      box.appendChild(meterBars(p, false));
      box.appendChild(statusRow(p.statuses));
      if (arming && p.alive && p.connected) box.addEventListener('click', () => {
        if (armedAllyCard) { send({ t: 'playCard', cardInstanceId: armedAllyCard, targetId: p.id }); armedAllyCard = null; }
        else { sendFlaskUse({ slot: armedFlask, targetId: p.id === me ? undefined : p.id }); armedFlask = null; }
      });
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
          if (effects.some((ef) => ef.target === 'ally')) {
            armedAllyCard = armedAllyCard === entry.inst.instanceId ? null : entry.inst.instanceId;
            armedFlask = null;
            render();
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
          const energyAffordable = def.cost === 'X' ? meP.energy > 0 : meP.energy >= def.cost;
          const manaAffordable = meP.mana >= (def.manaCost || 0);
          const affordable = !meP.ended && energyAffordable && manaAffordable;
          // The spelled-out reason is this viewer's data: a co-op client reads
          // a snapshot, not the engine, so the card itself says why it is grey.
          const reason = affordable ? null
            : !manaAffordable ? `Need ${def.manaCost || 0} Mana; have ${meP.mana}`
              : !energyAffordable ? 'Not enough Energy' : 'Turn already ended';
          return {
            inst: { cardId: c.cardId, upgraded: c.upgraded, instanceId: c.instanceId, mods: c.mods },
            def, name: def.name, affordable, reason,
            selected: c.instanceId === armedAllyCard,
          };
        }),
      });
    } else {
      handStrip.render({ cards: [], emptyHtml: '<div class="coop-note">Spectating the fight…</div>' });
    }

    // Flasks.
    const fwrap = app.querySelector('.coop-flasks');
    if (fwrap && meP) {
      for (const kind of CHARGE_FLASK_KINDS) {
        const fd = chargeFlaskDefinition(registries, kind);
        const current = meP.flaskCharges ? meP.flaskCharges[`${kind}Current`] : 0;
        const b = document.createElement('button');
        b.className = 'coop-flask flask-charge';
        b.setAttribute('aria-disabled', String(current <= 0));
        b.innerHTML = `${flaskIdentityHtml(fd)} <b>${current}</b>`;
        b.setAttribute('aria-label', `${fd.name}: ${current} charges remaining`);
        attachTooltip(b, () => `<div class="tt-title">${esc(fd.name)}</div>${esc(fd.textTemplate || '')}`);
        b.addEventListener('click', () => openCoopFlaskMenu(b, fd, meP, { chargeKind: kind, remaining: current }));
        fwrap.appendChild(b);
      }
      meP.flasks.forEach((f, i) => {
        const fd = registries.flasks.get(f.flaskId);
        const b = document.createElement('button');
        b.className = `coop-flask${armedFlask === i ? ' armed' : ''}`;
        b.dataset.coopFlaskSlot = String(i);
        b.innerHTML = `${flaskIdentityHtml(fd)}${fd.targeted ? '' : ' ▾'}`;
        attachTooltip(b, () => `<div class="tt-title">${esc(fd.name)}</div>${esc(fd.textTemplate || '')}`);
        b.addEventListener('click', () => openCoopFlaskMenu(b, fd, meP, { slot: i }));
        fwrap.appendChild(b);
      });
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
    const cf = app.querySelector('#coop-cancel-flask'); if (cf) cf.addEventListener('click', () => { armedFlask = null; armedAllyCard = null; render(); });
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
    const voteLine = voting
      ? `<span class="mh-stat coop-voteline">${Object.keys(votes).length ? `VOTES ${Object.keys(votes).length}/${present.length}` : 'VOTE FOR THE PATH'}</span>`
      : '';

    app.innerHTML = `
      <div class="mapscreen">
        <header class="topbar map-header">
          <span class="mh-stat mh-prog">${snap.actNumber > 3 ? `Act ${snap.actNumber}` : `Act ${snap.actNumber} / 3`} · Floor ${snap.floor}</span>
          <span class="mh-stat mh-seed" title="Run seed">SEED ${esc(snap.seedString)}</span>
          ${voteLine}
          <div class="coop-partybar"></div>
          <div class="mh-actions"><button class="subtle coop-leave" id="coop-leave">Leave</button></div>
        </header>
      </div>`;

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

  // Compact party read-out in the map header (names + HP + presence).
  function renderPartyBar() {
    const bar = app.querySelector('.coop-partybar');
    if (!bar) return;
    bar.innerHTML = snap.party.map((p) => {
      const pct = Math.max(0, Math.min(100, Math.round((p.hp / Math.max(1, p.maxHp)) * 100)));
      return `<span class="coop-pc${p.id === me ? ' me' : ''}${p.connected ? '' : ' away'}${p.alive ? '' : ' dead'}" data-pc="${p.id}" style="border-color:${tintCss(p.tint)}">
        <span class="coop-pc-glyph" style="color:${tintCss(p.tint)}">${classGlyph(p.classId)}</span>${esc(p.name)}
        <span class="coop-pc-hp"><i style="width:${pct}%"></i><b>${p.hp}/${p.maxHp}</b></span></span>`;
    }).join('');
    bar.querySelectorAll('.coop-pc').forEach((chip) => {
      const p = snap.party.find((x) => x.id === chip.dataset.pc);
      if (p) attachTooltip(chip, () => {
        const cls = registries.classes.get(p.classId);
        return `<div class="tt-title">${esc(p.name)} — ${esc(cls ? cls.name : p.classId)}</div>` +
          `HP ${p.hp}/${p.maxHp} · ⛁ ${p.cinders ?? 0} · deck ${p.deckSize ?? '?'} · relics ${p.relics ?? 0}` +
          `${p.connected ? '' : '<br><b>Away</b> — missed rewards queue for their return.'}${p.alive ? '' : '<br><b>Fallen.</b>'}`;
      });
    });
  }

  // ---- reward / shrine / event (reuse renderCard + solo styling) ------------
  function rewardShell(inner) {
    return `<div class="screen"><div class="coop-partybar" style="margin-bottom:10px"></div>${inner}<button class="subtle" id="coop-leave" style="margin-top:14px">Leave</button></div>`;
  }
  const rTitle = (t) => `<h2 style="color:var(--gold);font-size:26px">${esc(t)}</h2>`;
  function renderReward() {
    const offer = snap.scene.offers[me];
    if (!offer) { app.innerHTML = rewardShell(`${rTitle('Spoils')}<div class="coop-note">Waiting for the others to choose…</div>`); renderPartyBar(); wireLeave(); return; }
    app.innerHTML = rewardShell(`${rTitle(`${(snap.scene.pool || '').toUpperCase()} — CHOOSE A CARD`)}<div class="reward-row"></div>
      <div class="coop-choices" style="margin-top:12px">
        ${offer.relicId ? `<button class="coop-take" data-take="relic">Take relic: ${esc(registries.relics.get(offer.relicId).name)}</button>` : ''}
        ${offer.flaskId ? `<button class="coop-take" data-take="flask">Take flask: ${flaskIdentityHtml(registries.flasks.get(offer.flaskId))}</button>` : ''}
        <button class="subtle" data-take="skip">Skip card</button>
      </div>`);
    const grid = app.querySelector('.reward-row');
    let pick = { cardId: null, takeRelic: false, flask: false };
    const submit = () => send({ t: 'chooseReward', pick });
    offer.cardIds.forEach((cid) => {
      const el = renderCard(registries, { cardId: cid, upgraded: false }, {});
      el.addEventListener('click', () => { pick.cardId = cid; submit(); });
      grid.appendChild(el);
    });
    app.querySelectorAll('.coop-take').forEach((b) => b.addEventListener('click', () => { if (b.dataset.take === 'relic') pick.takeRelic = true; else if (b.dataset.take === 'flask') pick.flask = true; submit(); }));
    renderPartyBar(); wireLeave();
  }
  function renderShrine() {
    const done = snap.scene.done && snap.scene.done[me];
    const allies = snap.party.filter((p) => p.id !== me && p.alive && p.connected);
    const mm = myMember();
    const upgradable = ((mm && mm.deck) || []).filter((c) => !c.upgraded && registries.cards.get(c.cardId).upgrade);
    app.innerHTML = rewardShell(`${rTitle('Shrine of Emberlight')}
      ${done ? '<div class="coop-note">Waiting for the party…</div>' : `<div class="coop-choices">
        <button data-shrine="rest">Rest — heal yourself</button>
        <button id="coop-smith" ${upgradable.length ? '' : 'disabled'}>Smith — upgrade a card</button>
        ${allies.map((a) => `<button class="coop-take" data-mend="${a.id}">Mend ${esc(a.name)} (+30% HP)</button>`).join('')}
      </div>
      <div id="coop-smith-grid" class="reward-row" style="display:none;max-width:900px;flex-wrap:wrap"></div>`}`);
    app.querySelectorAll('[data-shrine]').forEach((b) => b.addEventListener('click', () => send({ t: 'shrineChoice', choice: b.dataset.shrine })));
    app.querySelectorAll('[data-mend]').forEach((b) => b.addEventListener('click', () => send({ t: 'shrineChoice', choice: 'mend', targetId: b.dataset.mend })));
    // Smith opens a picker of your unupgraded cards; hover/focus previews the
    // exact upgrade (changed values highlighted) before you commit.
    const smithBtn = app.querySelector('#coop-smith');
    if (smithBtn && upgradable.length) smithBtn.addEventListener('click', () => {
      const grid = app.querySelector('#coop-smith-grid');
      if (grid.style.display !== 'none') return;
      grid.style.display = 'flex';
      for (const inst of upgradable) {
        const el = renderCard(registries, inst, { small: true, tooltipFn: () => upgradePreviewHtml(registries, inst) });
        el.addEventListener('click', () => send({ t: 'shrineChoice', choice: 'smith', targetId: inst.instanceId }));
        grid.appendChild(el);
      }
    });
    renderPartyBar(); wireLeave();
  }
  function renderEvent() {
    const done = snap.scene.done && snap.scene.done[me];
    let ev = null; try { ev = registries.events.get(snap.scene.eventId); } catch { /* unknown */ }
    app.innerHTML = rewardShell(`${rTitle(ev ? ev.name : 'A Happening')}
      ${done ? '<div class="coop-note">Waiting for the party…</div>' : `<div class="coop-choices">${(ev && ev.choices ? ev.choices : [{ label: 'Continue' }]).map((c, i) => `<button data-ev="${i}">${esc(c.label || c.text || 'Choose')}</button>`).join('')}</div>`}`);
    app.querySelectorAll('[data-ev]').forEach((b) => b.addEventListener('click', () => send({ t: 'eventChoice', choiceIndex: Number(b.dataset.ev) })));
    renderPartyBar(); wireLeave();
  }

  // ---- catch-up + complete --------------------------------------------------
  function renderCatchup(mm) {
    const item = mm.catchupQueue[0];
    const remaining = mm.catchupQueue.length;
    let inner = `${rTitle(`Ember Debt — ${remaining} missed`)}<p class="coop-note">Claim what you would have earned while away.</p>`;
    if (item.type === 'reward') inner += '<div class="reward-row"></div>';
    inner += `<div class="coop-choices" style="margin-top:12px">
      ${(item.type === 'reward' && item.offer.relicId) || (item.type === 'treasure' && item.relicId) ? `<button class="coop-take" data-cu="relic">Take relic</button>` : ''}
      <button class="subtle" data-cu="skip">Skip</button></div>`;
    app.innerHTML = rewardShell(inner);
    const resolve = (pick) => send({ t: 'catchupChoice', index: 0, pick });
    if (item.type === 'reward') {
      const grid = app.querySelector('.reward-row');
      item.offer.cardIds.forEach((cid) => { const el = renderCard(registries, { cardId: cid, upgraded: false }, {}); el.addEventListener('click', () => resolve({ cardId: cid })); grid.appendChild(el); });
    }
    app.querySelectorAll('[data-cu]').forEach((b) => b.addEventListener('click', () => resolve(b.dataset.cu === 'relic' ? { takeRelic: true } : {})));
    renderPartyBar(); wireLeave();
  }
  function renderComplete() {
    const win = snap.scene.victory;
    app.innerHTML = `<div class="screen"><h1 class="title-big" style="color:var(--gold)">${win ? '👑 The Spire is Yours' : '☠ The Party Has Fallen'}</h1>
      <button id="coop-leave2" style="margin-top:20px">Return to the fire</button></div>`;
    const b = app.querySelector('#coop-leave2'); if (b) b.addEventListener('click', () => { teardown(); conn.close(); onLeave(); });
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
    const el = document.createElement('div');
    el.className = `coop-turn-banner${small ? ' small' : ''}`;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), small ? 900 : 1100);
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
