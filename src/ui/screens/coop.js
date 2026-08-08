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
// ones (kept here so solo combat.js stays untouched).
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
import { anchorLocalBox } from '../fx.js';
import { nodeName, nodeBlurb, actTitle, intentBadge, intentTooltip, backdropClass } from '../uiContent.js';
import { resolveCard } from '../../model/registries.js';
import { mountMapBoard } from '../components/mapboard.js';

export function mountCoop(app, { registries, conn, myId, myIds, meta, onLeave }) {
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
  let pendingSnap = null; // newest snapshot that arrived while pacing
  let mapBoard = null; // the live act-map board, so a re-render can stop the old one

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
    if (fl != null && meP.flasks && meP.flasks[fl]) { send({ t: 'useFlask', slot: fl, targetId: selectedEnemy }); return; }
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
    removeSeatTabs();
    if (mapBoard) { mapBoard.teardown(); mapBoard = null; }
  }
  const myMember = () => (snap ? snap.party.find((p) => p.id === me) : null);
  const cardDef = (c) => resolveCard(registries, { cardId: c.cardId, upgraded: c.upgraded, mods: c.mods });
  const wireLeave = () => { const b = app.querySelector('#coop-leave'); if (b) b.addEventListener('click', () => { teardown(); conn.close(); onLeave(); }); };

  function render() {
    if (!snap) return;
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
      const el = document.createElement('div');
      el.className = 'status-icon';
      el.style.borderColor = def.tint || 'var(--muted)'; // status-pip accent (data: status def)
      el.innerHTML = `${esc(def.icon || '?')}<span class="stk">${stacks}</span>`;
      attachTooltip(el, () => `<div class="tt-title">${esc(def.name)} ×${stacks}</div>${esc(def.tooltip || '')}`);
      row.appendChild(el);
    }
    return row;
  }
  function meterBars(ent, isEnemy) {
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
        <header class="topbar">
          <span class="fight-label">${esc(actTitle(snap.actNumber))} · FLOOR ${snap.floor} · SEED ${esc(snap.seedString)}</span>
          <button class="subtle coop-leave" id="coop-leave" style="margin-left:auto">Leave</button>
        </header>
        <div class="${backdropClass(snap.actNumber)}"></div>
        <div class="field">
          <div class="player-zone"></div>
          <div class="enemy-row"></div>
        </div>
        ${meP && meP.flasks && meP.flasks.length ? '<div class="coop-flasks"></div>' : ''}
        ${armedFlask != null ? `<div class="coop-arm">Throwing <b>${esc(registries.flasks.get(meP.flasks[armedFlask].flaskId).name)}</b> — click a hero seat to give it. <button class="subtle" id="coop-cancel-flask">Cancel</button></div>` : ''}
        ${armedCardDef ? `<div class="coop-arm">Playing <b>${esc(armedCardDef.name)}</b> — click the hero who receives it. <button class="subtle" id="coop-cancel-flask">Cancel</button></div>` : ''}
        <div class="hand-area">
          <div class="energy-orb">${meP ? `${meP.energy}/${meP.energyMax}` : ''}</div>
          <div class="hand"></div>
          <button class="end-turn" id="coop-endturn">END TURN</button>
        </div>
        <div class="fx-layer"></div>
      </div>`;

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
        else { send({ t: 'useFlask', slot: armedFlask, targetId: p.id === me ? undefined : p.id }); armedFlask = null; }
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
      box.appendChild(meterBars(e, true));
      box.appendChild(statusRow(e.statuses));
      if (!dead) box.addEventListener('click', () => { selectedEnemy = e.id; render(); });
      row.appendChild(box);
    }

    // My hand — the real card component.
    const hand = app.querySelector('.hand');
    if (meP && meP.alive && meP.connected) {
      const n = meP.hand.length;
      meP.hand.forEach((c, i) => {
        const def = cardDef(c);
        const affordable = !meP.ended && (def.cost === 'X' ? meP.energy > 0 : meP.energy >= def.cost);
        const el = renderCard(registries, { cardId: c.cardId, upgraded: c.upgraded, instanceId: c.instanceId, mods: c.mods }, { affordable });
        const spread = Math.min(6, n) * 1.2;
        el.style.transform = `rotate(${(i - (n - 1) / 2) * (spread / Math.max(n - 1, 1))}deg) translateY(${Math.abs(i - (n - 1) / 2) * 6}px)`;
        el.style.zIndex = i;
        if (c.instanceId === armedAllyCard) el.classList.add('selected');
        el.addEventListener('click', () => {
          if (!affordable) return;
          const needsAlly = (def.effects || []).some((ef) => ef.target === 'ally');
          if (needsAlly) { armedAllyCard = armedAllyCard === c.instanceId ? null : c.instanceId; armedFlask = null; render(); return; }
          const needs = (def.effects || []).some((ef) => ef.target === 'enemy');
          send({ t: 'playCard', cardInstanceId: c.instanceId, targetId: needs ? selectedEnemy : undefined });
        });
        hand.appendChild(el);
      });
    } else {
      hand.innerHTML = '<div class="coop-note">Spectating the fight…</div>';
    }

    // Flasks.
    const fwrap = app.querySelector('.coop-flasks');
    if (fwrap && meP) {
      meP.flasks.forEach((f, i) => {
        const fd = registries.flasks.get(f.flaskId);
        const b = document.createElement('button');
        b.className = `coop-flask${armedFlask === i ? ' armed' : ''}`;
        b.innerHTML = `⚗ ${esc(fd.name)}${fd.targeted ? '' : ' ▾'}`;
        attachTooltip(b, () => `<div class="tt-title">${esc(fd.name)}</div>${esc(fd.textTemplate || '')}`);
        b.addEventListener('click', () => {
          if (fd.targeted) { send({ t: 'useFlask', slot: i, targetId: selectedEnemy }); armedFlask = null; }
          else { armedFlask = armedFlask === i ? null : i; render(); }
        });
        fwrap.appendChild(b);
      });
    }

    const canEnd = meP && meP.alive && meP.connected && !meP.ended;
    const et = app.querySelector('#coop-endturn');
    et.disabled = !canEnd;
    et.classList.toggle('pulse', canEnd && meP.energy > 0);
    if (canEnd) et.addEventListener('click', () => send({ t: 'endTurn' }));
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
        ${offer.flaskId ? `<button class="coop-take" data-take="flask">Take flask: ${esc(registries.flasks.get(offer.flaskId).name)}</button>` : ''}
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
    if (pacing) { pendingSnap = s; return; }
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
      pacing = false;
      snap = pendingSnap || s;
      pendingSnap = null;
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
    const put = (sel, cls, text, dy = 0.35) => {
      const anchor = app.querySelector(sel);
      if (!anchor) return;
      // Convert the anchor's on-screen box into the layer's local (pre-zoom)
      // coordinates, or the float lands at position×zoom (drifts left onto the
      // wrong enemy the further right the target is). See fx.js anchorLocalBox.
      const b = anchorLocalBox(layer, anchor);
      const el = document.createElement('div');
      el.className = cls;
      el.textContent = text;
      el.style.left = `${b.left + b.width / 2}px`;
      el.style.top = `${b.top + b.height * dy}px`;
      layer.appendChild(el);
      setTimeout(() => el.remove(), 1100);
    };
    const recoil = (sel, heavy) => {
      const box = app.querySelector(sel);
      if (box) box.classList.add('hitflash', heavy ? 'hit-heavy' : 'hit');
    };
    for (const e of now.enemies) {
      const pe = prev.enemies.find((x) => x.id === e.id);
      if (!pe) continue;
      const dmg = Math.max(0, pe.hp - e.hp);
      if (dmg > 0) {
        put(`[data-eid="${e.id}"]`, dmg >= 12 ? 'float-num crit' : 'float-num dmg', `-${dmg}`);
        recoil(`[data-eid="${e.id}"] .sprite`, dmg >= 12);
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
      if (dmg > 0) {
        put(`[data-seat="${p.id}"]`, dmg >= 12 ? 'float-num heavy dmg' : 'float-num dmg', `-${dmg}`);
        recoil(`[data-seat="${p.id}"] .sprite`, dmg >= 12);
      }
      if (p.hp > pp.hp) put(`[data-seat="${p.id}"]`, 'float-num heal', `+${p.hp - pp.hp}`);
      if ((p.block || 0) > (pp.block || 0)) put(`[data-seat="${p.id}"]`, 'float-num blk small', `+${p.block - (pp.block || 0)}`);
    }
  }

  if (conn.open) send({ t: 'resync' });
}
