// src/ui/screens/lobby.js — Tarnished Together lobby (LAN play, phase 1).
//
// Browse: light a fire (host) or join one found by UDP discovery (the list
// refreshes every 2s from this machine's launcher at /api/lan/info).
// Room: roster + class picks + ready-up; the host sets the seed and begins.
// On start every player launches the SAME seeded run on their own machine and
// the socket is handed to the orchestrator for live party-status broadcasts.
// Shared-map voting and true co-op combat are the next phases.

import { lanInfo, lanHost, lanUnhost, lanConnect } from '../../net/lan.js';
import { classGlyph, PORTRAIT_TINTS, SPRITE_STYLES, tintCss } from '../assets.js';
import { esc, attachTooltip } from '../components/tooltip.js';

const NAME_KEY = 'sote_lan_name';
const TINT_KEY = 'sote_lan_tint';

export function mountLobby(app, { registries, defaultSeedString, onBack, onStart }) {
  let conn = null;
  let hosting = false;
  let myId = null;
  let pollTimer = null;
  const state = {
    name: localStorage.getItem(NAME_KEY) || 'Tarnished',
    classId: registries.classes.all()[0].id,
    tint: localStorage.getItem(TINT_KEY) || 'gold',
    spriteStyle: localStorage.getItem('sote_lan_style') || 'rendered',
    ready: false,
    seedString: defaultSeedString,
    players: [],
  };

  function cleanup() {
    clearInterval(pollTimer);
    if (conn) { conn.close(); conn = null; }
    if (hosting) { lanUnhost(); hosting = false; }
  }

  function back(note) {
    cleanup();
    onBack(note);
  }

  // ---- browse view -----------------------------------------------------------
  function renderBrowse(note) {
    app.innerHTML = `
      <div class="screen lobby" style="gap:18px">
        <h2 style="color:var(--gold);font-size:24px;letter-spacing:.2em">TARNISHED TOGETHER</h2>
        <p class="subtitle">CLIMB WITH FRIENDS ON YOUR LOCAL NETWORK</p>
        ${note ? `<p style="color:var(--ember);font-size:13px">${esc(note)}</p>` : ''}
        <div style="display:flex;flex-direction:column;gap:14px;width:min(480px,92%)">
          <div class="seed-line" style="justify-content:center">Your name
            <input id="lb-name" maxlength="18" spellcheck="false" value="${esc(state.name)}">
          </div>
          <button id="lb-host">⚑ LIGHT A FIRE (HOST)</button>
          <p class="cz-label" style="margin-top:6px">FIRES ON YOUR NETWORK</p>
          <div id="lb-hosts" style="display:flex;flex-direction:column;gap:8px">
            <p class="set-note" id="lb-scanning">Scanning…</p>
          </div>
        </div>
        <button class="subtle" id="lb-back">Back</button>
      </div>`;
    app.querySelector('#lb-back').addEventListener('click', () => back());
    app.querySelector('#lb-name').addEventListener('input', (e) => {
      state.name = e.target.value.trim() || 'Tarnished';
      localStorage.setItem(NAME_KEY, state.name);
    });
    app.querySelector('#lb-host').addEventListener('click', host);

    const hostsBox = app.querySelector('#lb-hosts');
    const refresh = async () => {
      const info = await lanInfo();
      if (!info || !hostsBox.isConnected) return;
      // Discovered fires, plus THIS launcher's own fire if it is hosting — so a
      // friend who opened the host's URL directly (the address the launcher
      // banner advertises) can join with one click, no launcher of their own.
      const hosts = [...(info.hosts || [])];
      if (info.hosting) hosts.unshift({ name: info.hosting.name, addr: location.hostname, port: info.port, local: true });
      hostsBox.innerHTML = hosts.length
        ? hosts.map((h, i) =>
            `<button class="mod-chip lb-join" data-i="${i}" style="text-align:left">
               <b>⚑ ${esc(h.name)}</b><span>${h.local ? 'this fire' : `${esc(h.addr)}:${h.port}`}</span>
             </button>`).join('')
        : '<p class="set-note">No fires found yet — host one, or have a friend host. (Both machines must run the game via run.bat.)</p>';
      hostsBox.querySelectorAll('.lb-join').forEach((b) =>
        b.addEventListener('click', () => join(hosts[Number(b.dataset.i)])));
    };
    refresh();
    pollTimer = setInterval(refresh, 2000);
  }

  // ---- connect paths ----------------------------------------------------------
  async function host() {
    try {
      const h = await lanHost(state.name);
      hosting = true;
      connect({ addr: 'localhost', port: h.port, hostKey: h.hostKey, shareAddr: `${h.addr}:${h.port}` });
    } catch (e) {
      renderBrowse(`Could not host: ${e.message}`);
    }
  }

  function join(h) {
    connect({ addr: h.addr, port: h.port });
  }

  function connect({ addr, port, hostKey, shareAddr }) {
    clearInterval(pollTimer);
    conn = lanConnect({
      addr,
      port,
      onMessage: (msg) => {
        if (msg.t === 'welcome') {
          myId = msg.id;
          conn.send({ t: 'hello', name: state.name, classId: state.classId, tint: state.tint, spriteStyle: state.spriteStyle, hostKey });
        } else if (msg.t === 'roster') {
          state.players = msg.players;
          if (msg.seedString) state.seedString = msg.seedString;
          renderRoom(shareAddr);
        } else if (msg.t === 'started') {
          // The server-authoritative run has begun. Hand the live socket to the
          // co-op client (it renders snapshots; cleanup must not close it).
          clearInterval(pollTimer);
          const handoff = conn;
          conn = null;
          onStart({ conn: handoff, myId, name: state.name });
        } else if (msg.t === 'resumed') {
          // A saved run was restored; the server assigned me this member.
          clearInterval(pollTimer);
          const handoff = conn;
          conn = null;
          onStart({ conn: handoff, myId: msg.yourId, name: state.name });
        } else if (msg.t === 'hostGone') {
          cleanup();
          renderBrowse('The host left the fire.');
        }
      },
      onClose: () => {
        conn = null;
        cleanup();
        renderBrowse('Connection lost.');
      },
    });
  }

  // ---- room view --------------------------------------------------------------
  function isHostMe() {
    const me = state.players.find((p) => p.id === myId);
    return !!(me && me.isHost);
  }

  function renderRoom(shareAddr) {
    const iAmHost = isHostMe();
    const others = state.players.filter((p) => !p.isHost);
    const allReady = others.every((p) => p.ready);
    app.innerHTML = `
      <div class="screen lobby" style="gap:16px">
        <h2 style="color:var(--gold);font-size:24px;letter-spacing:.2em">AT THE FIRE</h2>
        ${shareAddr ? `<p class="subtitle">FRIENDS JOIN FROM THEIR OWN LAUNCHER — YOUR FIRE IS AT ${esc(shareAddr)}</p>` : '<p class="subtitle">WAITING AT THE FIRE</p>'}
        <div id="lb-roster" style="display:flex;flex-direction:column;gap:8px;width:min(460px,92%)">
          ${state.players.map((p) => `
            <div class="slot occupied" style="padding:10px 14px">
              <div class="slot-info">
                <span class="slot-title">${p.isHost ? '⚑ ' : ''}${esc(p.name)}${p.id === myId ? ' (you)' : ''}</span>
                <span class="slot-meta">${p.classId ? esc(registries.classes.get(p.classId).name) : 'choosing…'}${p.isHost ? ' · host' : p.ready ? ' · READY' : ' · not ready'}</span>
              </div>
              <span style="font-size:26px;color:${tintCss(p.tint)}">${p.classId ? classGlyph(p.classId) : '…'}</span>
            </div>`).join('')}
        </div>
        <div><p class="cz-label">YOUR CLASS</p><div id="lb-classes" class="class-row" style="flex-wrap:wrap;justify-content:center"></div></div>
        <div><p class="cz-label">YOUR ACCENT</p><div id="lb-tints" class="lb-tints"></div></div>
        <div><p class="cz-label">SPRITE</p><div id="lb-styles" class="lb-tints"></div></div>
        ${iAmHost
          ? `<div id="lb-resume-wrap"></div>
             <div class="seed-line">Seed <input id="lb-seed" maxlength="10" spellcheck="false" value="${esc(state.seedString)}"></div>
             <button id="lb-start" ${state.players.length && allReady ? '' : 'disabled'}>BEGIN THE CLIMB${allReady ? '' : ' (waiting for ready)'}</button>`
          : `<button id="lb-ready">${state.ready ? '✓ READY — WAITING FOR THE HOST' : 'READY UP'}</button>`}
        <button class="subtle" id="lb-leave">Leave</button>
      </div>`;

    // Host only: if this launcher has a saved run, offer to resume it.
    if (iAmHost) {
      lanInfo().then((info) => {
        const wrap = app.querySelector('#lb-resume-wrap');
        if (!wrap || !info || !info.hasSave) return;
        const s = info.save || {};
        wrap.innerHTML = `<button id="lb-resume" class="coop-take" style="border-color:var(--gold)">⟳ RESUME LAST RUN — Act ${s.act || '?'} · Floor ${s.floor || 0}${s.players ? ' · ' + s.players.map(esc).join(', ') : ''}</button>`;
        wrap.querySelector('#lb-resume').addEventListener('click', () => conn.send({ t: 'resume' }));
      });
    }

    const classes = app.querySelector('#lb-classes');
    for (const cls of registries.classes.all()) {
      const el = document.createElement('div');
      el.className = `class-pick cr-class${cls.id === state.classId ? ' chosen' : ''}`;
      el.innerHTML = `<div class="glyph">${classGlyph(cls.id)}</div><h3>${esc(cls.name)}</h3>`;
      attachTooltip(el, () => `<div class="tt-title">${esc(cls.name)}</div>${esc(cls.description || '')}<br>HP ${cls.maxHp} · ${cls.startingDeck.length} cards`);
      el.addEventListener('click', () => {
        state.classId = cls.id;
        conn.send({ t: 'pick', classId: cls.id });
      });
      classes.appendChild(el);
    }
    // Accent swatches: the chosen tint colors your sprite + party chips for
    // everyone, so two Vagabonds still read apart on the shared board.
    const tints = app.querySelector('#lb-tints');
    for (const t of PORTRAIT_TINTS) {
      const dot = document.createElement('button');
      dot.className = `tint-dot${t.id === state.tint ? ' chosen' : ''}`;
      dot.style.background = t.css;
      attachTooltip(dot, () => `<div class="tt-title">${esc(t.name)}</div>Colors your hero's accents for the whole party.`);
      dot.addEventListener('click', () => {
        state.tint = t.id;
        localStorage.setItem(TINT_KEY, t.id);
        conn.send({ t: 'pick', tint: t.id });
        tints.querySelectorAll('.tint-dot').forEach((d) => d.classList.toggle('chosen', d === dot));
      });
      tints.appendChild(dot);
    }
    const styles = app.querySelector('#lb-styles');
    for (const st of SPRITE_STYLES) {
      const b = document.createElement('button');
      b.className = `mod-chip lb-style${st.id === state.spriteStyle ? ' on' : ''}`;
      b.style.cssText = 'padding:5px 12px;font-size:12px;';
      b.innerHTML = `<b>${esc(st.name)}</b>`;
      attachTooltip(b, () => `<div class="tt-title">${esc(st.name)}</div>${st.id === 'rendered' ? 'The rendered low-poly figure.' : st.id === 'classic' ? 'The classic hand-drawn silhouette.' : 'Your sigil in a tinted panel.'}`);
      b.addEventListener('click', () => {
        state.spriteStyle = st.id;
        localStorage.setItem('sote_lan_style', st.id);
        conn.send({ t: 'pick', spriteStyle: st.id });
        styles.querySelectorAll('.lb-style').forEach((x) => x.classList.toggle('on', x === b));
      });
      styles.appendChild(b);
    }
    app.querySelector('#lb-leave').addEventListener('click', () => back());
    if (iAmHost) {
      app.querySelector('#lb-seed').addEventListener('change', (e) => {
        state.seedString = e.target.value.trim();
        conn.send({ t: 'seed', seedString: state.seedString });
      });
      const startBtn = app.querySelector('#lb-start');
      if (startBtn) startBtn.addEventListener('click', () => {
        conn.send({ t: 'seed', seedString: state.seedString });
        conn.send({ t: 'start' });
      });
    } else {
      app.querySelector('#lb-ready').addEventListener('click', () => {
        state.ready = !state.ready;
        conn.send({ t: 'ready', ready: state.ready });
      });
    }
  }

  renderBrowse();
}
