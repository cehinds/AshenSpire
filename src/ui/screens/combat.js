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
import { enemySprite, playerSprite, classGlyph, tintCss } from '../assets.js';
import { animateEvents, playTimeline, anchorLocalBox, viewportLocalBox, clampBox, VIEWPORT_ORIGIN } from '../fx.js';
import { intentBadge, intentTooltip, backdropClass } from '../uiContent.js';
import { sfx } from '../sfx.js';
import { mountTutorial } from '../components/tutorial.js';
import { overlayIsOpen } from '../components/overlay.js';
import { focusFirst, matchAction, isEngaged, keyLabel, padLabel, hasGamepad } from '../input.js';
import { hintBarHtml, setHintMode } from '../components/hints.js';
import { dlog } from '../debuglog.js';
import { mountEquipment } from './equipment.js';
import { figureSpec } from '../../model/loadout.js';

export function mountCombat(app, { registries, run, combat, label, onEnd, showTutorial, onTutorialDone, onSettings, onMenu }) {
  app.innerHTML = `
    <div class="combat">
      <header class="topbar">
        <div class="portrait" style="border-color:${tintCss(run.customization && run.customization.tint)}">${esc((run.customization && run.customization.glyph) || classGlyph(run.class))}</div>
        <div class="who">
          <span class="nm">${esc(((run.customization && run.customization.name) || registries.classes.get(run.class).name).toUpperCase())} · ${esc(registries.classes.get(run.class).name.toUpperCase())}</span>
          <div class="bar hpbar"><div class="fill"></div><div class="label"></div></div>
        </div>
        <span class="cinders" style="color:var(--gold);font-size:13px">⛁ ${run.cinders}</span>
        <div class="flasks" style="display:flex;gap:6px"></div>
        <div class="relics"></div>
        <span class="fight-label">${esc(label)} · SEED ${esc(run.seedString)}</span>
        <button class="topbar-btn" id="combat-armoury" title="Armaments">⚒</button>
        <button class="topbar-btn" id="combat-menu" title="Menu (M)">☰</button>
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
  if (typeof window !== 'undefined') window.__combat = combat; // debug handle
  const fxCtx = {
    layer: $('.fx-layer'),
    combatEl,
    anchorFor: (id) => app.querySelector(`[data-eid="${id}"] .sprite`) || app.querySelector(`[data-eid="${id}"]`),
    relicAnchor: (relicId) => app.querySelector(`[data-relic-id="${relicId}"]`),
    orb: () => app.querySelector('.energy-orb'),
  };

  let selected = null; // card instanceId in click-targeting mode
  let selectedFlask = null; // flask slot index awaiting a target
  let selfArm = null; // self/buff card armed for a confirm (keyboard/gamepad)
  let busy = false; // animating / resolving
  let lastTargetId = null; // remember the last enemy aimed at (keyboard/pad QoL)
  let aimScheduled = false; // debounce for the aim-highlight observer

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
  const dv = (ent) => (disp && disp.ents[ent.id]) || ent;
  function takeSnapshot() {
    const ents = {
      player: { hp: combat.player.hp, block: combat.player.block, alive: true },
    };
    for (const e of combat.enemies) ents[e.id] = { hp: e.hp, block: e.block, alive: e.alive };
    return { ents, hand: [...combat.piles.hand] };
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
        case 'enemyDied':
          if (t) {
            t.alive = false;
            t.hp = 0;
          }
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
    const hp = $('.topbar .hpbar');
    hp.querySelector('.fill').style.width = `${(pv.hp / p.maxHp) * 100}%`;
    hp.querySelector('.label').textContent = `${pv.hp} / ${p.maxHp}`;
    const relics = $('.topbar .relics');
    relics.innerHTML = '';
    for (const rid of p.relicIds) {
      const def = registries.relics.get(rid);
      const el = document.createElement('div');
      el.className = 'relic';
      el.dataset.relicId = rid;
      el.textContent = def.icon || '◆';
      attachTooltip(el, () => `<div class="tt-title">${esc(def.name)}</div>${esc(def.textTemplate.replace(/[{}]/g, ''))}`);
      relics.appendChild(el);
    }
    // Flask slots — click to drink; targeted flasks enter targeting mode.
    const flasks = $('.topbar .flasks');
    flasks.innerHTML = '';
    p.flasks.forEach((f, slot) => {
      const def = registries.flasks.get(f.flaskId);
      const el = document.createElement('div');
      el.className = 'relic flask-slot';
      el.style.cursor = 'pointer';
      if (selectedFlask === slot) el.style.borderColor = 'var(--parchment)';
      el.textContent = def.icon || '🧪';
      // Quick-use key badge (F/G/H by default; pad glyph while a pad drives).
      if (slot < 3) {
        const kb = document.createElement('span');
        kb.className = 'flask-key';
        const id = `flask${slot + 1}`;
        kb.textContent = hasGamepad() ? padLabel(id) || keyLabel(id) : keyLabel(id);
        el.appendChild(kb);
      }
      attachTooltip(el, () => `<div class="tt-title">${esc(def.name)}</div>${esc(def.textTemplate || '')}${def.targeted ? '<br><i>Click, then choose a target.</i>' : '<br><i>Click to drink.</i>'}`);
      el.addEventListener('click', () => {
        if (busy || combat.result) return;
        if (def.targeted) {
          selectedFlask = selectedFlask === slot ? null : slot;
          selected = null;
          render();
        } else {
          useFlask(slot, null);
        }
      });
      flasks.appendChild(el);
    });
  }

  function statusRow(entity) {
    const row = document.createElement('div');
    row.className = 'statuses';
    for (const [sid, inst] of Object.entries(entity.statuses)) {
      const def = registries.statuses.get(sid);
      const stacks = inst.meter ? inst.meter.value : inst.stacks;
      const el = document.createElement('div');
      el.className = 'status-icon';
      el.style.borderColor = def.tint || 'var(--muted)'; // status-pip accent (data: status def)
      el.innerHTML = `${esc(def.icon || '?')}<span class="stk">${stacks}</span>`;
      attachTooltip(el, () => {
        let extra = '';
        if (inst.meter) extra = `<br>Build-up: ${inst.meter.value} / ${inst.meter.max}`;
        if (inst.duration != null) extra += `<br>Turns left: ${inst.duration}`;
        return `<div class="tt-title">${esc(def.name)} ×${stacks}</div>${esc(def.tooltip || '')}${extra}`;
      });
      row.appendChild(el);
    }
    return row;
  }

  function meterBars(entity) {
    const v = dv(entity);
    const wrap = document.createElement('div');
    wrap.className = 'meters';
    const hp = document.createElement('div');
    hp.className = 'bar hpbar';
    hp.innerHTML = `<div class="fill" style="width:${(v.hp / entity.maxHp) * 100}%"></div><div class="label">${v.hp} / ${entity.maxHp}</div>`;
    wrap.appendChild(hp);
    if (entity.kind === 'enemy') {
      const poise = document.createElement('div');
      poise.className = `bar poisebar${entity.poiseMeter.value >= entity.poiseMeter.max * 0.75 ? ' full' : ''}`;
      poise.innerHTML = `<div class="fill" style="width:${Math.min(100, (entity.poiseMeter.value / entity.poiseMeter.max) * 100)}%"></div>`;
      // Meter-bar tooltips render the STATUS def's own text (data) so they can't
      // drift from the balance/formula numbers.
      const stagDesc = (registries.statuses.has('staggered') && registries.statuses.get('staggered').tooltip) || '';
      attachTooltip(poise, () => `<div class="tt-title">Poise</div>${entity.poiseMeter.value} / ${entity.poiseMeter.max} — fill it to Stagger. ${stagDesc}`);
      wrap.appendChild(poise);
      const bleedInst = entity.statuses.bleed;
      if (bleedInst && bleedInst.meter && bleedInst.meter.value > 0) {
        const bl = document.createElement('div');
        bl.className = 'bar bleedbar';
        bl.innerHTML = `<div class="fill" style="width:${Math.min(100, (bleedInst.meter.value / bleedInst.meter.max) * 100)}%"></div>`;
        const bleedDef = registries.statuses.get('bleed');
        attachTooltip(bl, () => `<div class="tt-title">${esc(bleedDef.name)}</div>${bleedInst.meter.value} / ${bleedInst.meter.max}. ${esc(bleedDef.tooltip || '')}`);
        wrap.appendChild(bl);
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
      const affordable = !!pv && combat.player.energy >= (pv.costIsX ? 0 : pv.cost) && !isUnplayable(inst);
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
      if (pv) wireCardInput(el, inst, pv, affordable);
      hand.appendChild(el);
    });
  }

  function isUnplayable(inst) {
    return (resolveCard(registries, inst).keywords || []).includes('unplayable');
  }

  function renderControls() {
    $('.energy-orb').textContent = `${combat.player.energy}/${combat.player.energyMax}`;
    // The bound key (or pad button) rides on the End Turn button itself, so the
    // shortcut is discoverable without reading the hint bar. Tracks rebinds.
    const etKey = hasGamepad() ? padLabel('endTurn') || keyLabel('endTurn') : keyLabel('endTurn');
    $('.end-turn').innerHTML = `END TURN <kbd class="et-key">${esc(etKey)}</kbd>`;
    const anyPlayable = combat.piles.hand.some((inst) => {
      const def = resolveCard(registries, inst);
      if ((def.keywords || []).includes('unplayable')) return false;
      return combat.player.energy >= (def.cost === 'X' ? 0 : def.cost);
    });
    $('.end-turn').classList.toggle('pulse', combat.player.energy > 0 && anyPlayable);
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
      const onMove = (mv) => {
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
      const onUp = (up) => {
        removeEventListener('pointermove', onMove);
        removeEventListener('pointerup', onUp);
        if (dragGhost) dragGhost.remove();
        if (!dragging) return; // plain click handled by 'click'
        dragging = false;
        suppressClick = true; // whatever happens next, this drag is not a click
        const under = document.elementFromPoint(up.clientX, up.clientY);
        const enemyBox = under && under.closest ? under.closest('.enemy:not(.dead)') : null;
        if (pv.needsTarget) {
          if (enemyBox) playCard(inst.instanceId, enemyBox.dataset.eid);
        } else if (under && under.closest && under.closest('.field')) {
          playCard(inst.instanceId, null);
        }
      };
      addEventListener('pointermove', onMove);
      addEventListener('pointerup', onUp);
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
    if (overlayIsOpen()) return; // the overlay owns input while open

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

    // Flask quick-use (F/G/H by default, rebindable; pads route through the
    // same bound keys). Drinks immediately, or enters aim mode when targeted.
    for (let slot = 0; slot < 3; slot++) {
      if (matchAction(ev, `flask${slot + 1}`)) {
        ev.preventDefault();
        const f = combat.player.flasks[slot];
        if (!f) return;
        const fdef = registries.flasks.get(f.flaskId);
        if (fdef.targeted) {
          selectedFlask = slot;
          selected = null;
          selfArm = null;
          render();
          focusTargeting();
        } else {
          useFlask(slot, null);
        }
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
      const affordable = combat.player.energy >= (pv.costIsX ? 0 : pv.cost) && !isUnplayable(inst);
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

  function useFlask(slot, targetId) {
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
      out = dispatch(combat, { type: 'useFlask', slot, targetId: targetId || undefined });
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

  $('.end-turn').addEventListener('click', () => {
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
  });

  $('.pile.draw').addEventListener('click', () => openPileModal(registries, 'Draw pile', combat.piles.draw, { shuffleForDisplay: true }));
  $('.pile.discard').addEventListener('click', () => openPileModal(registries, 'Discard pile', combat.piles.discard));
  $('.pile.exhaust').addEventListener('click', () => openPileModal(registries, 'Exhaust pile', combat.piles.exhaust));
  // Settings lives inside the Menu overlay (Settings tab) — one button, one home.
  if (onMenu) $('#combat-menu').addEventListener('click', () => onMenu('deck'));

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
