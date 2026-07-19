// src/ui/screens/coop.js — Tarnished Together thin client (LAN co-op).
//
// Server-authoritative renderer: the launcher owns the run (tools/session.mjs)
// and pushes { t:'state', snapshot } over the lobby socket. This screen never
// mutates game state — it draws the snapshot and sends intents.
//
// Visual parity with solo: it reuses the SAME components and CSS as single-
// player — enemySprite/playerSprite, the shared renderCard, the SVG node map,
// and the .combat / .mapscreen shells. The only additions are co-op-specific:
// a seat per player, whose-turn indicators, and the throw/mend affordances.
// The board helpers below are snapshot-fed twins of combat.js's private ones
// (kept here so solo combat.js stays untouched).

import { enemySprite, playerSprite, classGlyph, tintCss } from '../assets.js';
import { renderCard } from '../components/card.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { resolveCard } from '../../model/registries.js';

const NODE_ICONS = { monster: '⚔', fight: '⚔', elite: '☠', shrine: '♨', merchant: '⚖', treasure: '▣', boss: '👁', unknown: '?' };
const ACT_NAMES = { 1: 'ACT I — THE FALLOW MARCHES', 2: 'ACT II — THE GRAFTED COURT', 3: 'ACT III — THE ASHEN CROWN' };
const COL_X = 95;
const ROW_H = 46;

function actTitle(actNumber) {
  const base = ACT_NAMES[((actNumber - 1) % 3) + 1] || `ACT ${actNumber}`;
  const loop = Math.floor((actNumber - 1) / 3);
  return loop > 0 ? `${base} · CYCLE ${loop + 1}` : base;
}
const STATUS_TINT = { bleed: 'var(--ember)', scarletRot: 'var(--rot)', staggered: 'var(--gold)', strength: 'var(--gold)', vulnerable: 'var(--grace)', weak: 'var(--muted)', frail: 'var(--muted)' };

export function mountCoop(app, { registries, conn, myId, onLeave }) {
  let snap = null;
  let me = myId;
  let selectedEnemy = null;
  let armedFlask = null; // non-offensive flask slot awaiting a throw seat
  let armedAllyCard = null; // ally-targeted card instanceId awaiting a seat

  conn.setHandlers({
    onMessage: (msg) => {
      if (msg.t === 'rejoined') { me = msg.id; return; }
      if (msg.t === 'state') { snap = msg.snapshot; render(); }
    },
    onClose: () => { app.innerHTML = `<div class="screen"><div class="coop-note">⚠ Connection to the fire was lost.</div><button class="subtle" id="coop-leave">Leave</button></div>`; wireLeave(); },
  });

  const send = (obj) => conn.send(obj);
  const myMember = () => (snap ? snap.party.find((p) => p.id === me) : null);
  const cardDef = (c) => resolveCard(registries, { cardId: c.cardId, upgraded: c.upgraded });
  const wireLeave = () => { const b = app.querySelector('#coop-leave'); if (b) b.addEventListener('click', () => { conn.close(); onLeave(); }); };

  function render() {
    if (!snap) return;
    const mm = myMember();
    if (mm && mm.catchupQueue && mm.catchupQueue.length) return renderCatchup(mm);
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
      el.style.borderColor = STATUS_TINT[sid] || 'var(--muted)';
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
      attachTooltip(poise, () => `<div class="tt-title">Poise</div>${ent.poiseMeter.value} / ${ent.poiseMeter.max} — filling this Staggers the enemy.`);
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
    let cls = intent ? intent.kind : 'unknown';
    let inner = '?';
    if (!intent || !intent.moveId) { inner = '?'; }
    else if (intent.kind === 'staggered') { inner = '✦ STAGGERED'; }
    else if (intent.damage != null) { inner = `<span class="ic">⚔</span>${intent.hits > 1 ? `${intent.damage}×${intent.hits}` : intent.damage}${intent.delayed ? ' ⌛' : ''}`; cls = `attack${intent.delayed ? ' delayed' : ''}`; }
    else if (intent.block != null) { inner = '<span class="ic">🛡</span>'; cls = 'block'; }
    else if (intent.kind === 'buff') { inner = '<span class="ic">↑</span>'; }
    else if (intent.kind === 'debuff') { inner = '<span class="ic">☾</span>'; }
    el.className = `intent ${cls}`;
    el.innerHTML = inner;
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
        const el = renderCard(registries, { cardId: c.cardId, upgraded: c.upgraded, instanceId: c.instanceId }, { affordable });
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
    wireLeave();
  }

  // ---- map (parity SVG node map) --------------------------------------------
  function renderMap() {
    const map = snap.map;
    if (!map) { app.innerHTML = '<div class="screen"><div class="coop-note">Loading the path…</div></div>'; return; }
    const nodes = map.nodes;
    const reachable = new Set(snap.reachableIds);
    const maxFloor = Math.max(...nodes.map((n) => n.floor));
    const width = 7 * COL_X + 60;
    const height = (maxFloor + 1) * ROW_H + 30;
    const x = (col) => 60 + col * COL_X;
    const y = (floor) => height - floor * ROW_H;

    let edgeSvg = '';
    for (const n of nodes) for (const toId of n.next || []) {
      const to = nodes.find((m) => m.id === toId);
      if (to) edgeSvg += `<line class="map-edge" x1="${x(n.col)}" y1="${y(n.floor)}" x2="${x(to.col)}" y2="${y(to.floor)}"/>`;
    }

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
        <div class="map-scroll"><div class="map-canvas">
          <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <text x="${width / 2}" y="24" text-anchor="middle" fill="var(--gold)" font-size="17" letter-spacing="4" font-family="Georgia,serif">${esc(actTitle(snap.actNumber))}</text>
            ${edgeSvg}
            <g id="map-nodes"></g>
          </svg>
        </div></div>
      </div>`;

    const g = app.querySelector('#map-nodes');
    for (const n of nodes) {
      const isReachable = reachable.has(n.id);
      const voters = votesByNode[n.id] || [];
      const cls = ['map-node', n.type, isReachable ? 'reachable' : '', voters.includes(me) ? 'my-vote' : ''].filter(Boolean).join(' ');
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      el.setAttribute('class', cls);
      const r = n.type === 'boss' ? 20 : 15;
      const halo = isReachable ? `<circle class="node-halo" cx="${x(n.col)}" cy="${y(n.floor)}" r="${r + 6}"/>` : '';
      // Vote pips: the voters' class glyphs ride above a voted node.
      const pips = voters.length
        ? `<text class="vote-pips" x="${x(n.col)}" y="${y(n.floor) - r - 8}" text-anchor="middle" font-size="12" fill="var(--gold)">${voters.map((pid) => classGlyph((snap.party.find((p) => p.id === pid) || {}).classId)).join('')}</text>`
        : '';
      el.innerHTML = `${halo}<circle cx="${x(n.col)}" cy="${y(n.floor)}" r="${r}"/><text x="${x(n.col)}" y="${y(n.floor)}">${NODE_ICONS[n.type] || '?'}</text>${pips}`;
      if (isReachable) el.addEventListener('click', () => send({ t: 'chooseNode', nodeId: n.id }));
      g.appendChild(el);
    }
    renderPartyBar();
    wireLeave();
  }

  // Compact party read-out in the map header (names + HP + presence).
  function renderPartyBar() {
    const bar = app.querySelector('.coop-partybar');
    if (!bar) return;
    bar.innerHTML = snap.party.map((p) => {
      const pct = Math.max(0, Math.min(100, Math.round((p.hp / Math.max(1, p.maxHp)) * 100)));
      return `<span class="coop-pc${p.id === me ? ' me' : ''}${p.connected ? '' : ' away'}${p.alive ? '' : ' dead'}" style="border-color:${tintCss(p.tint)}">
        <span class="coop-pc-glyph" style="color:${tintCss(p.tint)}">${classGlyph(p.classId)}</span>${esc(p.name)}
        <span class="coop-pc-hp"><i style="width:${pct}%"></i><b>${p.hp}/${p.maxHp}</b></span></span>`;
    }).join('');
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
    app.innerHTML = rewardShell(`${rTitle('Shrine of Grace')}
      ${done ? '<div class="coop-note">Waiting for the party…</div>' : `<div class="coop-choices">
        <button data-shrine="rest">Rest — heal yourself</button>
        <button data-shrine="smith">Smith — upgrade a card</button>
        ${allies.map((a) => `<button class="coop-take" data-mend="${a.id}">Mend ${esc(a.name)} (+30% HP)</button>`).join('')}
      </div>`}`);
    app.querySelectorAll('[data-shrine]').forEach((b) => b.addEventListener('click', () => send({ t: 'shrineChoice', choice: b.dataset.shrine })));
    app.querySelectorAll('[data-mend]').forEach((b) => b.addEventListener('click', () => send({ t: 'shrineChoice', choice: 'mend', targetId: b.dataset.mend })));
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
    let inner = `${rTitle(`Grace Debt — ${remaining} missed`)}<p class="coop-note">Claim what you would have earned while away.</p>`;
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
    const b = app.querySelector('#coop-leave2'); if (b) b.addEventListener('click', () => { conn.close(); onLeave(); });
  }

  if (conn.open) send({ t: 'resync' });
}
