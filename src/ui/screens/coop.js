// src/ui/screens/coop.js — Tarnished Together thin client (LAN co-op, S3).
//
// A server-authoritative renderer: the launcher's Node server owns the run
// (tools/session.mjs) and pushes { t:'state', snapshot } over the lobby socket.
// This screen NEVER mutates game state — it draws the snapshot and sends
// intents (chooseNode, playCard, endTurn, chooseReward, …). One shared fight,
// scaled to who's present; drop-in/out is just the party list changing.
//
// Deliberately functional, not the full solo combat chrome — the shared board
// reads clearly and every player sees the same authoritative state. Polish
// (animations, the SVG map) is a later pass; correctness of the shared loop
// comes first.

import { classGlyph } from '../assets.js';
import { esc } from '../components/tooltip.js';
import { resolveCard } from '../../model/registries.js';

const NODE_ICON = {
  monster: '⚔', fight: '⚔', elite: '☠', boss: '♛',
  shrine: '♨', treasure: '▣', merchant: '⚖', unknown: '?',
};

export function mountCoop(app, { registries, conn, myId, onLeave }) {
  let snap = null;
  let me = myId;
  let selectedEnemy = null;

  conn.setHandlers({
    onMessage: (msg) => {
      if (msg.t === 'rejoined') { me = msg.id; return; }
      if (msg.t === 'state') { snap = msg.snapshot; render(); }
    },
    onClose: () => {
      app.innerHTML = shell('<div class="coop-note">⚠ Connection to the fire was lost.</div>' + leaveBtn());
      wireLeave();
    },
  });

  const send = (obj) => conn.send(obj);
  const myMember = () => (snap ? snap.party.find((p) => p.id === me) : null);
  const cardDef = (c) => resolveCard(registries, { cardId: c.cardId, upgraded: c.upgraded });

  function render() {
    if (!snap) return;
    // A pending catch-up series takes over until the returning player clears it.
    const mm = myMember();
    if (mm && mm.catchupQueue && mm.catchupQueue.length) return renderCatchup(mm);
    switch (snap.scene.kind) {
      case 'map': return renderMap();
      case 'combat': return renderCombat();
      case 'reward': return renderReward();
      case 'shrine': return renderShrine();
      case 'event': return renderEvent();
      case 'complete': return renderComplete();
      default: return void (app.innerHTML = shell(`<div class="coop-note">${esc(snap.scene.kind)}…</div>`));
    }
  }

  // ---- shared chrome --------------------------------------------------------
  function partyStrip() {
    return `<div class="coop-party">${snap.party.map((p) => {
      const cls = `coop-pc${p.id === me ? ' me' : ''}${p.connected ? '' : ' away'}${p.alive ? '' : ' dead'}`;
      const pct = Math.max(0, Math.min(100, Math.round((p.hp / Math.max(1, p.maxHp)) * 100)));
      return `<div class="${cls}">
        <span class="coop-pc-glyph">${classGlyph(p.classId)}</span>
        <span class="coop-pc-name">${esc(p.name)}${p.connected ? '' : ' (away)'}</span>
        <span class="coop-pc-hp"><i style="width:${pct}%"></i><b>${p.hp}/${p.maxHp}</b></span>
      </div>`;
    }).join('')}</div>`;
  }
  function header(title) {
    return `<div class="coop-head">
      <span class="coop-act">${esc(title)}</span>
      <span class="coop-seed">SEED ${esc(snap.seedString)}</span>
      <button class="subtle coop-leave" id="coop-leave">Leave</button>
    </div>`;
  }
  function shell(body, title) {
    return `<div class="screen coop-screen">${header(title || `ACT ${snap ? snap.actNumber : ''}`)}${snap ? partyStrip() : ''}<div class="coop-body">${body}</div></div>`;
  }
  const leaveBtn = () => '<button class="subtle" id="coop-leave">Leave</button>';
  function wireLeave() { const b = app.querySelector('#coop-leave'); if (b) b.addEventListener('click', () => { conn.close(); onLeave(); }); }

  // ---- map ------------------------------------------------------------------
  function renderMap() {
    const nodes = snap.reachableNodes || [];
    const body = `
      <h2 class="coop-title">Choose the path — Act ${snap.actNumber} · Floor ${snap.floor}</h2>
      <p class="coop-sub">Any Tarnished may lead the party onward.</p>
      <div class="coop-nodes">${nodes.map((n) => `
        <button class="coop-node" data-node="${esc(n.id)}">
          <span class="ic">${NODE_ICON[n.type] || '•'}</span>
          <span class="nm">${nodeLabel(n.type)}</span>
        </button>`).join('')}</div>`;
    app.innerHTML = shell(body);
    app.querySelectorAll('.coop-node').forEach((b) =>
      b.addEventListener('click', () => send({ t: 'chooseNode', nodeId: b.dataset.node })));
    wireLeave();
  }
  function nodeLabel(t) {
    return { monster: 'Monster', fight: 'Monster', elite: 'Elite', boss: 'Boss', shrine: 'Shrine of Grace', treasure: 'Treasure', merchant: 'Merchant', unknown: 'Unknown' }[t] || t;
  }

  // ---- combat ---------------------------------------------------------------
  function renderCombat() {
    const sc = snap.scene;
    const living = sc.enemies.filter((e) => e.hp > 0);
    if (selectedEnemy == null || !living.find((e) => e.id === selectedEnemy)) selectedEnemy = living[0] ? living[0].id : null;
    const meP = sc.players.find((p) => p.id === me);

    const enemyRow = sc.enemies.map((e) => {
      const def = registries.enemies.get(e.enemyId);
      const dead = e.hp <= 0;
      const pct = Math.max(0, Math.round((e.hp / Math.max(1, e.maxHp)) * 100));
      return `<div class="coop-enemy${dead ? ' dead' : ''}${e.id === selectedEnemy ? ' sel' : ''}" data-enemy="${e.id}">
        <div class="coop-enemy-intent">${intentText(e.intent)}</div>
        <div class="coop-enemy-glyph">${esc(def.art || '☠')}</div>
        <div class="coop-enemy-nm">${esc(def.name)}</div>
        <div class="coop-hpbar"><i style="width:${pct}%"></i><b>${Math.max(0, e.hp)}/${e.maxHp}${e.block ? ' 🛡' + e.block : ''}</b></div>
      </div>`;
    }).join('');

    const seats = sc.players.map((p) => {
      const m = snap.party.find((x) => x.id === p.id) || {};
      return `<div class="coop-seat${p.id === me ? ' me' : ''}${p.ended ? ' ended' : ''}${p.alive ? '' : ' down'}${p.connected ? '' : ' away'}">
        <span class="coop-seat-nm">${classGlyph(m.classId)} ${esc(m.name || p.id)}</span>
        <span class="coop-seat-stats">♥ ${p.hp}/${p.maxHp}${p.block ? ' · 🛡' + p.block : ''} · ⚡${p.energy}/${p.energyMax}</span>
        <span class="coop-seat-flag">${!p.connected ? 'away' : !p.alive ? 'down' : p.ended ? 'ended turn' : 'thinking…'}</span>
      </div>`;
    }).join('');

    let handHtml = '<div class="coop-note">Spectating…</div>';
    if (meP && meP.alive && meP.connected) {
      handHtml = `<div class="coop-hand">${meP.hand.map((c) => {
        const def = cardDef(c);
        const cost = def.cost === 'X' ? 'X' : def.cost;
        const afford = def.cost === 'X' ? meP.energy > 0 : meP.energy >= def.cost;
        return `<button class="coop-card ${def.type}${afford && !meP.ended ? '' : ' disabled'}" data-card="${c.instanceId}" ${afford && !meP.ended ? '' : 'disabled'}>
          <span class="coop-card-cost">${cost}</span>
          <span class="coop-card-nm">${esc(def.name)}</span>
          <span class="coop-card-type">${def.type}</span>
        </button>`;
      }).join('')}</div>`;
    }
    const flasks = meP && meP.flasks && meP.flasks.length
      ? `<div class="coop-flasks">${meP.flasks.map((f, i) => `<button class="coop-flask" data-slot="${i}">⚗ ${esc(registries.flasks.get(f.flaskId).name)}</button>`).join('')}</div>` : '';

    const canEnd = meP && meP.alive && meP.connected && !meP.ended;
    const body = `
      <div class="coop-enemies">${enemyRow}</div>
      <div class="coop-seats">${seats}</div>
      ${flasks}
      ${handHtml}
      <div class="coop-actions">
        <button id="coop-endturn" ${canEnd ? '' : 'disabled'}>END TURN</button>
      </div>`;
    app.innerHTML = shell(body, `ACT ${snap.actNumber} · FLOOR ${snap.floor}`);

    app.querySelectorAll('.coop-enemy').forEach((el) =>
      el.addEventListener('click', () => { if (el.dataset.enemy && !el.classList.contains('dead')) { selectedEnemy = el.dataset.enemy; render(); } }));
    app.querySelectorAll('.coop-card').forEach((el) =>
      el.addEventListener('click', () => {
        if (el.disabled) return;
        const inst = el.dataset.card;
        const c = meP.hand.find((h) => h.instanceId === inst);
        const def = cardDef(c);
        const needs = (def.effects || []).some((e) => e.target === 'enemy');
        send({ t: 'playCard', cardInstanceId: inst, targetId: needs ? selectedEnemy : undefined });
      }));
    app.querySelectorAll('.coop-flask').forEach((el) =>
      el.addEventListener('click', () => send({ t: 'useFlask', slot: Number(el.dataset.slot), targetId: selectedEnemy })));
    const et = app.querySelector('#coop-endturn');
    if (et) et.addEventListener('click', () => send({ t: 'endTurn' }));
    wireLeave();
  }
  function intentText(intent) {
    if (!intent || !intent.moveId) return '…';
    if (intent.damage != null) return `⚔ ${intent.damage}${intent.hits > 1 ? '×' + intent.hits : ''}${intent.delayed ? ' ⏳' : ''}`;
    if (intent.block != null) return `🛡 ${intent.block}`;
    return { buff: '↑', debuff: '↓', unknown: '?' }[intent.kind] || '✦';
  }

  // ---- reward ---------------------------------------------------------------
  function renderReward() {
    const offer = snap.scene.offers[me];
    let body;
    if (!offer) {
      body = '<h2 class="coop-title">Spoils</h2><div class="coop-note">Waiting for the others to choose their rewards…</div>';
    } else {
      body = `<h2 class="coop-title">${esc((snap.scene.pool || '').toUpperCase())} — choose a card</h2>
        <div class="coop-cards">${offer.cardIds.map((cid) => {
          const def = registries.cards.get(cid);
          return `<button class="coop-card ${def.type}" data-card="${esc(cid)}"><span class="coop-card-cost">${def.cost}</span><span class="coop-card-nm">${esc(def.name)}</span><span class="coop-card-type">${def.type}</span></button>`;
        }).join('')}</div>
        <div class="coop-reward-extra">
          ${offer.relicId ? `<button class="coop-take" data-take="relic">Take relic: ${esc(registries.relics.get(offer.relicId).name)}</button>` : ''}
          ${offer.flaskId ? `<button class="coop-take" data-take="flask">Take flask: ${esc(registries.flasks.get(offer.flaskId).name)}</button>` : ''}
          <button class="subtle" data-take="skip">Skip card</button>
        </div>`;
    }
    app.innerHTML = shell(body);
    let pick = { cardId: null, takeRelic: false, flask: false };
    const submit = () => { send({ t: 'chooseReward', pick }); };
    app.querySelectorAll('.coop-card').forEach((b) => b.addEventListener('click', () => { pick.cardId = b.dataset.card; submit(); }));
    app.querySelectorAll('.coop-take').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.take === 'relic') pick.takeRelic = true;
      else if (b.dataset.take === 'flask') pick.flask = true;
      submit();
    }));
    wireLeave();
  }

  // ---- shrine / event -------------------------------------------------------
  function renderShrine() {
    const done = snap.scene.done && snap.scene.done[me];
    const body = `<h2 class="coop-title">Shrine of Grace</h2>
      ${done ? '<div class="coop-note">Waiting for the party…</div>' : `<div class="coop-choices">
        <button data-shrine="rest">Rest — heal</button>
        <button data-shrine="smith">Smith — upgrade a card</button>
      </div>`}`;
    app.innerHTML = shell(body);
    app.querySelectorAll('[data-shrine]').forEach((b) => b.addEventListener('click', () => send({ t: 'shrineChoice', choice: b.dataset.shrine })));
    wireLeave();
  }
  function renderEvent() {
    const done = snap.scene.done && snap.scene.done[me];
    let ev = null;
    try { ev = registries.events.get(snap.scene.eventId); } catch { /* unknown */ }
    const body = `<h2 class="coop-title">${esc(ev ? ev.name : 'A Happening')}</h2>
      ${done ? '<div class="coop-note">Waiting for the party…</div>' : `<div class="coop-choices">${(ev && ev.choices ? ev.choices : [{ label: 'Continue' }]).map((c, i) => `<button data-ev="${i}">${esc(c.label || c.text || 'Choose')}</button>`).join('')}</div>`}`;
    app.innerHTML = shell(body);
    app.querySelectorAll('[data-ev]').forEach((b) => b.addEventListener('click', () => send({ t: 'eventChoice', choiceIndex: Number(b.dataset.ev) })));
    wireLeave();
  }

  // ---- catch-up series (reconnect) -----------------------------------------
  function renderCatchup(mm) {
    const item = mm.catchupQueue[0];
    const remaining = mm.catchupQueue.length;
    let body = `<h2 class="coop-title">Grace Debt — you missed ${remaining} thing${remaining > 1 ? 's' : ''}</h2>
      <p class="coop-sub">Claim what you would have earned while away.</p>`;
    if (item.type === 'reward') {
      body += `<div class="coop-cards">${item.offer.cardIds.map((cid) => {
        const def = registries.cards.get(cid);
        return `<button class="coop-card ${def.type}" data-cu-card="${esc(cid)}"><span class="coop-card-cost">${def.cost}</span><span class="coop-card-nm">${esc(def.name)}</span></button>`;
      }).join('')}</div>
      <div class="coop-reward-extra">
        ${item.offer.relicId ? `<button class="coop-take" data-cu="relic">Take relic: ${esc(registries.relics.get(item.offer.relicId).name)}</button>` : ''}
        <button class="subtle" data-cu="skip">Skip</button>
      </div>`;
    } else if (item.type === 'treasure') {
      body += `<div class="coop-reward-extra">
        ${item.relicId ? `<button class="coop-take" data-cu="relic">Take relic: ${esc(registries.relics.get(item.relicId).name)}</button>` : ''}
        <button class="subtle" data-cu="skip">Skip</button></div>`;
    }
    app.innerHTML = shell(body);
    const resolve = (pick) => send({ t: 'catchupChoice', index: 0, pick });
    app.querySelectorAll('[data-cu-card]').forEach((b) => b.addEventListener('click', () => resolve({ cardId: b.dataset.cuCard })));
    app.querySelectorAll('[data-cu]').forEach((b) => b.addEventListener('click', () => resolve(b.dataset.cu === 'relic' ? { takeRelic: true } : {})));
    wireLeave();
  }

  // ---- complete -------------------------------------------------------------
  function renderComplete() {
    const win = snap.scene.victory;
    app.innerHTML = shell(`<h2 class="coop-title">${win ? '👑 The Spire is yours' : '☠ The party has fallen'}</h2>
      <div class="coop-choices"><button id="coop-leave2">Return to the fire</button></div>`);
    const b = app.querySelector('#coop-leave2');
    if (b) b.addEventListener('click', () => { conn.close(); onLeave(); });
    wireLeave();
  }

  // Ask the server for the current state (in case we mounted after 'started').
  if (conn.open) send({ t: 'resync' });
}
