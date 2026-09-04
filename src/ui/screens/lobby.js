// src/ui/screens/lobby.js — Forsaken Together lobby (LAN play, phase 1).
//
// Browse: light a fire (host) or join one found by UDP discovery (the list
// refreshes every 2s from this machine's launcher at /api/lan/info).
// Room: roster + class picks + ready-up; the host sets the seed and begins.
// On start every player launches the SAME seeded run on their own machine and
// the socket is handed to the orchestrator for live party-status broadcasts.
// Shared-map voting and true co-op combat are the next phases.
//
// ON THE KIT: both views are a Pane on the page. The browse view is a
// Row·setting for the name, a ButtonRow to host, and one OptionCard per fire
// found. The room is a roster of Rows (Glyph = host flag, label = the tinted
// name, StatusText = class, trail = a StatePill for ready/host/local seat),
// the class OptionCards, a Segmented for the kit and the sprite, Swatches for
// the accent, one Row·setting per couch seat, the host's seed as a Row·setting
// and the foot on the ButtonRow ladder. The ids and hooks the LAN instruments
// drive (`#lb-*`, `.lb-join`, `.cr-class`, `.class-pick h3`, `#lb-roster .slot
// span[style*="color"]`, `.tint-dot`, `.seed-line`) ride on the kit's parts.

import { lanInfo, lanHost, lanUnhost, lanConnect } from '../../net/lan.js';
import { classGlyph, PORTRAIT_TINTS, SPRITE_STYLES, tintCss } from '../assets.js';
import { esc, attachTooltip } from '../components/tooltip.js';
import { refusesWhen } from '../components/refusal.js';
import { attachSeedField } from '../components/seedfield.js';
import { startingKitViews } from '../../model/startingKits.js';
import { createRunState } from '../../model/state.js';
import {
  el, pane, row, labelStack, button, buttonRow, optionCard, options, pill, flavour, blocker, eyebrow,
  segmented, swatch, swatches, iconButton, hairline,
} from '../kit/index.js';

const NAME_KEY = 'sote_lan_name';
const TINT_KEY = 'sote_lan_tint';

const sectionHead = (label, hint = '') => el('div', { class: 'set-section-head' }, [eyebrow(label), hint ? flavour(hint) : null]);
const textInput = (attrs) => el('input', { type: 'text', spellcheck: 'false', autocomplete: 'off', ...attrs });

export function mountLobby(app, { registries, meta = {}, defaultSeedString, onBack, onStart }) {
  let conn = null;
  let hosting = false;
  let myId = null;
  let pollTimer = null;
  const state = {
    name: localStorage.getItem(NAME_KEY) || 'Forsaken',
    classId: registries.classes.all()[0].id,
    startingKitId: null,
    discoveredArmaments: [...new Set(meta.discoveredArmaments || [])],
    tint: localStorage.getItem(TINT_KEY) || 'gold',
    spriteStyle: localStorage.getItem('sote_lan_style') || 'rendered',
    ready: false,
    seedString: defaultSeedString,
    players: [],
    locals: [], // couch seats riding this connection: {name, classId, tint, spriteStyle}
  };
  const kitsFor = (classId) => startingKitViews(registries, classId, meta).filter((r) => r.available);
  const baselineKit = (classId) => (kitsFor(classId).find((r) => r.baseline) || kitsFor(classId)[0]).id;
  state.startingKitId = baselineKit(state.classId);

  function cleanup() {
    clearInterval(pollTimer);
    if (conn) { conn.close(); conn = null; }
    if (hosting) { lanUnhost(); hosting = false; }
  }

  function back(note) {
    cleanup();
    onBack(note);
  }

  function mountScreen(panel) {
    app.innerHTML = '';
    app.appendChild(el('div', { class: 'screen lobby' }, panel));
  }

  // ---- browse view -----------------------------------------------------------
  function renderBrowse(note) {
    const nameInput = textInput({ id: 'lb-name', maxlength: '18', value: state.name });
    const hostBtn = button({ label: 'Light a fire (host)', weight: 'primary', id: 'lb-host' });
    const backBtn = button({ label: 'Back', id: 'lb-back' });
    const hostsBox = options([flavour('Scanning…', { id: 'lb-scanning' })], { id: 'lb-hosts' });
    mountScreen(pane({
      eyebrow: 'Forsaken Together',
      title: 'Light a fire',
      subtitle: 'Climb with friends on your local network.',
      children: [
        note ? blocker(note) : null,
        row({ tag: 'div', setting: true, labelNode: labelStack({ label: 'Your name', hint: 'How the party sees you.' }), trail: [nameInput] }),
        buttonRow({ size: 'long', buttons: [hostBtn] }),
        hairline(),
        sectionHead('Fires on your network', 'Both machines must run the game via run.bat.'),
        hostsBox,
        buttonRow({ size: 'short', buttons: [backBtn] }),
      ],
      attrs: { class: 'lobby-browse' },
    }));
    backBtn.addEventListener('click', () => back());
    nameInput.addEventListener('input', (e) => {
      state.name = e.target.value.trim() || 'Forsaken';
      localStorage.setItem(NAME_KEY, state.name);
    });
    hostBtn.addEventListener('click', host);

    const refresh = async () => {
      const info = await lanInfo();
      if (!info || !hostsBox.isConnected) return;
      // Discovered fires, plus THIS launcher's own fire if it is hosting — so a
      // friend who opened the host's URL directly (the address the launcher
      // banner advertises) can join with one click, no launcher of their own.
      const hosts = [...(info.hosts || [])];
      if (info.hosting) hosts.unshift({ name: info.hosting.name, addr: location.hostname, port: info.port, local: true });
      hostsBox.innerHTML = '';
      if (!hosts.length) {
        hostsBox.appendChild(flavour('No fires found yet — host one, or have a friend host.'));
        return;
      }
      hosts.forEach((h, i) => {
        const card = optionCard({
          glyph: '⚑', name: h.name, meta: h.local ? 'This fire' : `${h.addr}:${h.port}`,
          className: 'lb-join', attrs: { dataset: { i } },
        });
        card.addEventListener('click', () => join(hosts[Number(card.dataset.i)]));
        hostsBox.appendChild(card);
      });
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
          conn.send({ t: 'hello', name: state.name, classId: state.classId, startingKitId: state.startingKitId, discoveredArmaments: state.discoveredArmaments, tint: state.tint, spriteStyle: state.spriteStyle, hostKey });
        } else if (msg.t === 'roster') {
          state.players = msg.players;
          if (msg.seedString) state.seedString = msg.seedString;
          renderRoom(shareAddr);
        } else if (msg.t === 'started') {
          // The server-authoritative run has begun. Hand the live socket to the
          // co-op client; yourIds lists EVERY seat this screen controls (couch).
          clearInterval(pollTimer);
          const handoff = conn;
          conn = null;
          onStart({ conn: handoff, myId, myIds: msg.yourIds || [myId], name: state.name });
        } else if (msg.t === 'resumed') {
          // A saved run was restored; the server assigned this screen its seats.
          clearInterval(pollTimer);
          const handoff = conn;
          conn = null;
          onStart({ conn: handoff, myId: msg.yourId, myIds: msg.yourIds || [msg.yourId], name: state.name });
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

  /** One roster seat: Glyph (host flag) · tinted name · class · state pill. */
  function seatRow(p) {
    const seatState = p.isLocal ? { label: 'Local seat', on: true }
      : p.isHost ? { label: 'Host', on: true }
        : p.ready ? { label: 'Ready', on: true } : { label: 'Not ready', on: false };
    return row({
      tag: 'div', setting: true,
      glyph: p.isHost ? '⚑' : (p.classId ? classGlyph(p.classId) : '…'),
      labelNode: el('span', { class: 'r-label' }, [
        el('span', { style: { color: tintCss(p.tint) }, text: p.name }),
        p.id === myId ? ' (you)' : '',
      ]),
      status: p.classId ? registries.classes.get(p.classId).name : 'choosing…',
      trail: [pill(seatState)],
      className: 'slot occupied',
      attrs: { dataset: { seat: p.id } },
    });
  }

  /** A class card under the names the LAN instruments read (`.class-pick h3`). */
  function classCard(cls, chosen) {
    const card = optionCard({ glyph: classGlyph(cls.id), name: cls.name, selected: chosen, arrow: false, className: 'class-pick cr-class', attrs: { dataset: { member: cls.id } } });
    const heading = el('h3', { class: 'on', text: cls.name });
    card.querySelector('.on').replaceWith(heading);
    return card;
  }

  function renderRoom(shareAddr) {
    const iAmHost = isHostMe();
    const others = state.players.filter((p) => !p.isHost);
    const allReady = others.every((p) => p.ready);

    const classes = el('div', { class: 'class-row', id: 'lb-classes' });
    const kitBox = el('div', { id: 'lb-kits' });
    const tints = swatches([], { id: 'lb-tints', 'aria-label': 'Your accent' });
    const styles = el('div', { id: 'lb-styles' });
    const localsBox = el('div', { class: 'lobby-locals', id: 'lb-locals' });
    const addLocal = button({ label: '＋ Add local player', id: 'lb-addlocal' });
    const resumeWrap = el('div', { id: 'lb-resume-wrap' });
    const seedInput = iAmHost ? textInput({ id: 'lb-seed', value: state.seedString }) : null;
    const startBtn = iAmHost ? button({ label: allReady ? 'Begin the climb' : 'Begin the climb (waiting for ready)', weight: 'primary', id: 'lb-start', disabled: !(state.players.length && allReady) }) : null;
    const readyBtn = iAmHost ? null : button({ label: state.ready ? '✓ Ready — waiting for the host' : 'Ready up', weight: 'primary', id: 'lb-ready' });
    const leaveBtn = button({ label: 'Leave', id: 'lb-leave' });

    mountScreen(pane({
      eyebrow: 'Forsaken Together',
      title: 'At the fire',
      subtitle: shareAddr ? `Friends join from their own launcher — your fire is at ${shareAddr}.` : 'Waiting at the fire.',
      children: [
        el('div', { id: 'lb-roster', class: 'lobby-roster' }, state.players.map(seatRow)),
        hairline(),
        sectionHead('Your class'),
        classes,
        row({ tag: 'div', setting: true, labelNode: labelStack({ label: 'Starting kit' }), trail: [kitBox] }),
        row({ tag: 'div', setting: true, labelNode: labelStack({ label: 'Accent', hint: 'Colours your hero for the whole party.' }), trail: [tints] }),
        row({ tag: 'div', setting: true, labelNode: labelStack({ label: 'Sprite' }), trail: [styles] }),
        hairline(),
        sectionHead('Local party', 'More players on this screen. Each gets their own hero; keyboard and mouse drive the active seat (Tab switches), each controller drives its own.'),
        localsBox,
        buttonRow({ size: 'long', buttons: [addLocal] }),
        iAmHost ? hairline() : null,
        iAmHost ? resumeWrap : null,
        iAmHost ? row({ tag: 'div', setting: true, labelNode: labelStack({ label: 'Seed', hint: 'Everyone at the fire launches this seed.' }), trail: [el('span', { class: 'seed-line' }, seedInput)] }) : null,
        buttonRow({ size: 'long', buttons: [leaveBtn, startBtn || readyBtn] }),
      ],
      attrs: { class: 'lobby-room' },
    }));

    // Host only: if this launcher has a saved run, offer to resume it.
    if (iAmHost) {
      lanInfo().then((info) => {
        if (!resumeWrap.isConnected || !info || !info.hasSave) return;
        const s = info.save || {};
        const resume = optionCard({
          glyph: '⟳', name: 'Resume last run',
          meta: `Act ${s.act || '?'} · Floor ${s.floor || 0}${s.players ? ' · ' + s.players.join(', ') : ''}`,
          className: 'coop-take', attrs: { id: 'lb-resume' },
        });
        resume.addEventListener('click', () => conn.send({ t: 'resume' }));
        resumeWrap.appendChild(options([resume]));
      });
    }

    for (const cls of registries.classes.all()) {
      const card = classCard(cls, cls.id === state.classId);
      // Derived HP from the run's own home (createRunState: class base +
      // attribute tiers + baseline kit), never bare cls.maxHp — a component
      // posing as a total (#175 rider; same fix as the customize chip and the
      // Custom Climb chip). Baseline kit on purpose: this tooltip is the
      // class's advert to a player who hasn't picked yet, and profileMeta is
      // inert with no requested kit — meta passed anyway so the read stays
      // honest if a kit ever rides this call.
      attachTooltip(card, () => `<div class="tt-title">${esc(cls.name)}</div>${esc(cls.description || '')}<br>HP ${createRunState({ seed: 0, classId: cls.id, registries, profileMeta: meta }).maxHp} · ${registries.balance.startingDeckSize} cards`);
      card.addEventListener('click', () => {
        state.classId = cls.id;
        state.startingKitId = baselineKit(cls.id);
        conn.send({ t: 'pick', classId: cls.id, startingKitId: state.startingKitId, discoveredArmaments: state.discoveredArmaments });
      });
      classes.appendChild(card);
    }
    const kitSeg = segmented({
      options: kitsFor(state.classId).map((kit) => ({ label: kit.label, value: kit.id, pressed: kit.id === state.startingKitId })),
    });
    kitSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      state.startingKitId = b.dataset.val;
      conn.send({ t: 'pick', startingKitId: b.dataset.val, discoveredArmaments: state.discoveredArmaments });
    }));
    kitBox.appendChild(kitSeg);
    // Accent swatches: the chosen tint colors your sprite + party chips for
    // everyone, so two Reavers still read apart on the shared board.
    for (const t of PORTRAIT_TINTS) {
      const dot = swatch({ color: t.css, label: t.name, on: t.id === state.tint, className: 'tint-dot', attrs: { dataset: { tint: t.id } } });
      attachTooltip(dot, () => `<div class="tt-title">${esc(t.name)}</div>Colors your hero's accents for the whole party.`);
      dot.addEventListener('click', () => {
        state.tint = t.id;
        localStorage.setItem(TINT_KEY, t.id);
        conn.send({ t: 'pick', tint: t.id });
        tints.querySelectorAll('.tint-dot').forEach((d) => { d.classList.toggle('on', d === dot); d.setAttribute('aria-pressed', d === dot ? 'true' : 'false'); });
      });
      tints.appendChild(dot);
    }
    const styleSeg = segmented({
      options: SPRITE_STYLES.map((st) => ({ label: st.name, value: st.id, pressed: st.id === state.spriteStyle, className: 'lb-style' })),
    });
    styleSeg.querySelectorAll('button').forEach((b) => {
      const st = SPRITE_STYLES.find((x) => x.id === b.dataset.val);
      attachTooltip(b, () => `<div class="tt-title">${esc(st.name)}</div>${st.id === 'rendered' ? 'The painted class figure.' : st.id === 'classic' ? 'The classic hand-drawn silhouette.' : 'Your sigil in a tinted panel.'}`);
      b.addEventListener('click', () => {
        state.spriteStyle = st.id;
        localStorage.setItem('sote_lan_style', st.id);
        conn.send({ t: 'pick', spriteStyle: st.id });
        styleSeg.querySelectorAll('.lb-style').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      });
    });
    styles.appendChild(styleSeg);

    // ---- local (couch) party editor ----
    const sendLocals = () => conn.send({ t: 'locals', locals: state.locals });
    const classList = registries.classes.all();
    const renderLocals = () => {
      localsBox.innerHTML = '';
      state.locals.forEach((lp, i) => {
        const nameField = textInput({ class: 'll-name', maxlength: '14', value: lp.name, 'aria-label': `Player ${i + 2} name` });
        const classBtn = button({ label: `${classGlyph(lp.classId)} ${classList.find((c) => c.id === lp.classId).name}`, className: 'll-class' });
        const kitBtn = button({ label: (kitsFor(lp.classId).find((kit) => kit.id === lp.startingKitId) || kitsFor(lp.classId)[0]).label, className: 'll-kit' });
        const tintBtn = swatch({ color: tintCss(lp.tint), label: 'Next accent', className: 'll-tint' });
        const del = iconButton({ glyph: '✕', label: 'Remove this player', className: 'll-del' });
        const seat = row({
          tag: 'div', setting: true,
          labelNode: labelStack({ label: `Seat ${i + 2}` }),
          trail: [nameField, classBtn, kitBtn, tintBtn, del],
          className: 'lobby-local',
        });
        nameField.addEventListener('input', (e) => { lp.name = e.target.value.trim() || `Player ${i + 2}`; sendLocals(); });
        classBtn.addEventListener('click', () => {
          const ci = classList.findIndex((c) => c.id === lp.classId);
          lp.classId = classList[(ci + 1) % classList.length].id;
          lp.startingKitId = baselineKit(lp.classId);
          renderLocals(); sendLocals();
        });
        kitBtn.addEventListener('click', () => {
          const rows = kitsFor(lp.classId);
          const ki = rows.findIndex((kit) => kit.id === lp.startingKitId);
          lp.startingKitId = rows[(ki + 1) % rows.length].id;
          renderLocals(); sendLocals();
        });
        tintBtn.addEventListener('click', () => {
          const ti = PORTRAIT_TINTS.findIndex((x) => x.id === lp.tint);
          lp.tint = PORTRAIT_TINTS[(ti + 1) % PORTRAIT_TINTS.length].id;
          renderLocals(); sendLocals();
        });
        del.addEventListener('click', () => { state.locals.splice(i, 1); renderLocals(); sendLocals(); });
        localsBox.appendChild(seat);
      });
    };
    renderLocals();
    addLocal.disabled = state.players.length + 0 >= 4 || state.locals.length >= 3;
    addLocal.addEventListener('click', () => {
      if (state.players.length >= 4 || state.locals.length >= 3) return;
      const n = state.locals.length + 2;
      const classId = classList[(n - 1) % classList.length].id;
      state.locals.push({ name: `Player ${n}`, classId, startingKitId: baselineKit(classId), discoveredArmaments: state.discoveredArmaments, tint: PORTRAIT_TINTS[(n - 1) % PORTRAIT_TINTS.length].id, spriteStyle: 'rendered' });
      renderLocals(); sendLocals();
    });
    leaveBtn.addEventListener('click', () => back());
    if (iAmHost) {
      // THE THIRD SEED FIELD, and the only one whose value crosses a wire.
      // Measured before this change: a host typing `MY-SEED` did not get six
      // different maps like the solo screens — every guest got the SAME map,
      // because tools/session.mjs's safeSeed() caught the throw and substituted
      // GOLDBOUGH. Two different unusable seeds produced one identical climb,
      // and the roster went on displaying what the host typed. The same law
      // broken from the other side, so it gets the same component.
      const seed = attachSeedField(seedInput);
      const seedRefusal = refusesWhen(startBtn, () => seed.problem(),
        () => 'Start the climb — everyone at the fire launches this seed.');
      seed.onChange(() => seedRefusal());
      seedInput.addEventListener('change', (e) => {
        // A seed the run cannot use is never broadcast: the roster must not
        // show the party a seed their climb will not be generated from.
        if (seed.problem()) return;
        state.seedString = e.target.value.trim();
        conn.send({ t: 'seed', seedString: state.seedString });
      });
      startBtn.addEventListener('click', () => {
        if (seed.problem()) return; // the refusal already said why, at the button
        conn.send({ t: 'seed', seedString: state.seedString });
        conn.send({ t: 'start' });
      });
    } else {
      readyBtn.addEventListener('click', () => {
        state.ready = !state.ready;
        conn.send({ t: 'ready', ready: state.ready });
      });
    }
  }

  renderBrowse();
}
