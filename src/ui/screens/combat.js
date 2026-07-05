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
import { animateEvents, playTimeline } from '../fx.js';
import { sfx } from '../sfx.js';
import { mountTutorial } from '../components/tutorial.js';
import { overlayIsOpen } from '../components/overlay.js';
import { focusFirst, matchAction } from '../input.js';
import { hintBarHtml } from '../components/hints.js';

export function mountCombat(app, { registries, run, combat, label, onEnd, showTutorial, onTutorialDone, onSettings, onMenu }) {
  app.innerHTML = `
    <div class="combat">
      <header class="topbar">
        <div class="portrait" style="border-color:${tintCss(run.customization && run.customization.tint)}">${esc((run.customization && run.customization.glyph) || classGlyph(run.class))}</div>
        <div class="who">
          <span class="nm">${esc(((run.customization && run.customization.name) || registries.classes.get(run.class).name).toUpperCase())} · ${esc(registries.classes.get(run.class).name.toUpperCase())}</span>
          <div class="bar hpbar"><div class="fill"></div><div class="label"></div></div>
        </div>
        <span class="runes" style="color:var(--gold);font-size:13px">⛁ ${run.runes}</span>
        <div class="flasks" style="display:flex;gap:6px"></div>
        <div class="relics"></div>
        <span class="fight-label">${esc(label)} · SEED ${esc(run.seedString)}</span>
        <button class="topbar-btn" id="combat-menu" title="Menu (M)">☰</button>
        <button class="topbar-btn" id="combat-settings" title="Settings">⚙</button>
      </header>
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
  const fxCtx = {
    layer: $('.fx-layer'),
    combatEl,
    anchorFor: (id) => app.querySelector(`[data-eid="${id}"] .sprite`) || app.querySelector(`[data-eid="${id}"]`),
    relicAnchor: (relicId) => app.querySelector(`[data-relic-id="${relicId}"]`),
    orb: () => app.querySelector('.energy-orb'),
  };

  let selected = null; // card instanceId in click-targeting mode
  let selectedFlask = null; // flask slot index awaiting a target
  let busy = false; // animating / resolving
  let lastTargetId = null; // remember the last enemy aimed at (keyboard/pad QoL)

  // Entering targeting mode: move the focus cursor onto an enemy so keyboard /
  // gamepad players confirm a target next, not wander into the top bar. Prefer
  // the last enemy they attacked (if still alive), else the first living one.
  function focusTargeting() {
    const living = combat.enemies.filter((e) => e.alive);
    if (!living.length) return;
    const pref = (lastTargetId && living.find((e) => e.id === lastTargetId)) || living[0];
    focusFirst(`.combatant.enemy[data-eid="${pref.id}"]`);
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
      el.className = 'relic';
      el.style.cursor = 'pointer';
      if (selectedFlask === slot) el.style.borderColor = 'var(--parchment)';
      el.textContent = def.icon || '🧪';
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
      el.style.borderColor = statusTint(sid);
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

  function statusTint(sid) {
    return (
      { bleed: 'var(--ember)', scarletRot: 'var(--rot)', staggered: 'var(--gold)', strength: 'var(--gold)', vulnerable: 'var(--grace)', weak: 'var(--muted)', frail: 'var(--muted)' }[sid] ||
      'var(--muted)'
    );
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
      attachTooltip(poise, () => `<div class="tt-title">Poise</div>${entity.poiseMeter.value} / ${entity.poiseMeter.max} — filling this Staggers the enemy: it skips a turn and takes +50% damage.`);
      wrap.appendChild(poise);
      const bleedInst = entity.statuses.bleed;
      if (bleedInst && bleedInst.meter && bleedInst.meter.value > 0) {
        const bl = document.createElement('div');
        bl.className = 'bar bleedbar';
        bl.innerHTML = `<div class="fill" style="width:${Math.min(100, (bleedInst.meter.value / bleedInst.meter.max) * 100)}%"></div>`;
        attachTooltip(bl, () => `<div class="tt-title">Bleed</div>${bleedInst.meter.value} / ${bleedInst.meter.max} — bursts at the threshold for 15% max HP (min 8, max 35).`);
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
    box.className = 'combatant player';
    box.dataset.eid = 'player';
    const sprite = document.createElement('div');
    sprite.className = 'sprite';
    sprite.appendChild(playerSprite(run.customization || {}, run.class));
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
    let cls = iv.kind;
    let inner = '';
    if (iv.kind === 'staggered') {
      inner = '✦ STAGGERED';
    } else if (iv.kind === 'attack') {
      inner = `<span class="ic">⚔</span>${iv.hits > 1 ? `${iv.damage}×${iv.hits}` : iv.damage}`;
      if (iv.delayed) inner += ' ⌛';
      cls = `attack${iv.delayed ? ' delayed' : ''}`;
    } else if (iv.kind === 'block') {
      inner = '<span class="ic">🛡</span>';
    } else if (iv.kind === 'buff') {
      inner = '<span class="ic">↑</span>';
    } else if (iv.kind === 'debuff') {
      inner = '<span class="ic">☾</span>';
    } else {
      inner = '?';
    }
    el.className = `intent ${cls}`;
    el.innerHTML = inner;
    attachTooltip(el, () => intentTooltip(iv, enemy));
    return el;
  }

  function intentTooltip(iv, enemy) {
    if (iv.kind === 'staggered') return `<div class="tt-title">Staggered</div>Poise broken — this enemy's turn is skipped and it takes +50% damage.`;
    if (iv.kind === 'attack') {
      let t = `<div class="tt-title">Intent: Attack</div>Attacking for <b>${iv.damage}${iv.hits > 1 ? ` × ${iv.hits} (${iv.totalDamage} total)` : ''}</b> damage (modifiers included).`;
      if (iv.pending) t += '<br><b>Committed:</b> this delayed attack lands this coming turn — Stagger cancels it.';
      else if (iv.delayed) t += '<br><b>Delayed:</b> it will hold this turn and strike the next. Stagger cancels it.';
      return t;
    }
    if (iv.kind === 'block') return `<div class="tt-title">Intent: Defend</div>Gaining Block.`;
    if (iv.kind === 'buff') return `<div class="tt-title">Intent: Buff</div>Strengthening itself.`;
    if (iv.kind === 'debuff') return `<div class="tt-title">Intent: Debuff</div>Hindering you.`;
    return `<div class="tt-title">Intent: Unknown</div>`;
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
      const pv = previewCard(combat, inst.instanceId);
      const affordable = combat.player.energy >= (pv.costIsX ? 0 : pv.cost) && !isUnplayable(inst);
      const el = renderCard(registries, inst, { preview: pv, affordable });
      const spread = Math.min(6, n) * 1.2;
      el.style.transform = `rotate(${(i - (n - 1) / 2) * (spread / Math.max(n - 1, 1))}deg) translateY(${Math.abs(i - (n - 1) / 2) * 6}px)`;
      el.style.zIndex = i;
      if (inst.instanceId === selected) el.classList.add('selected');
      if (i < 9) {
        const hint = document.createElement('span');
        hint.className = 'key-hint';
        hint.textContent = i + 1;
        el.appendChild(hint);
      }
      wireCardInput(el, inst, pv, affordable);
      hand.appendChild(el);
    });
  }

  function isUnplayable(inst) {
    return (resolveCard(registries, inst).keywords || []).includes('unplayable');
  }

  function renderControls() {
    $('.energy-orb').textContent = `${combat.player.energy}/${combat.player.energyMax}`;
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
          dragGhost.style.left = `${mv.clientX - 70}px`;
          dragGhost.style.top = `${mv.clientY - 100}px`;
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

    el.addEventListener('click', () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (busy || !affordable || dragging) return;
      if (pv.needsTarget) {
        selected = selected === inst.instanceId ? null : inst.instanceId;
        render();
        if (selected) focusTargeting();
      } else {
        playCard(inst.instanceId, null);
      }
    });
  }

  // Cancel targeting with right-click / Esc.
  combatEl.addEventListener('contextmenu', (ev) => {
    if (selected || selectedFlask != null) {
      ev.preventDefault();
      selected = null;
      selectedFlask = null;
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
      if (selected || selectedFlask != null) {
        selected = null;
        selectedFlask = null;
        hideTooltip();
        render();
      }
      return;
    }
    if (busy || combat.result || combat.phase !== 'player') return;

    if (matchAction(ev, 'endTurn')) {
      ev.preventDefault();
      $('.end-turn').click();
      return;
    }

    if (/^[1-9]$/.test(ev.key)) {
      ev.preventDefault();
      const n = Number(ev.key) - 1;
      // Targeting mode: the number picks the Nth living enemy.
      if (selected || selectedFlask != null) {
        const enemy = combat.enemies.filter((e) => e.alive)[n];
        if (!enemy) return;
        if (selected) playCard(selected, enemy.id);
        else useFlask(selectedFlask, enemy.id);
        return;
      }
      // Selection mode: play the Nth hand card (auto-target a lone enemy).
      const inst = combat.piles.hand[n];
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
    if (busy || combat.result) return;
    selectedFlask = null;
    selected = null;
    hideTooltip();
    disp = takeSnapshot();
    let out;
    try {
      out = dispatch(combat, { type: 'useFlask', slot, targetId: targetId || undefined });
    } catch (err) {
      disp = null;
      render();
      return;
    }
    sfx.play('flask');
    busy = true;
    afterDispatch(out.events);
  }

  function afterDispatch(events) {
    trackStats(events);
    render(); // hand/energy react now; bars render from the pre-dispatch snapshot
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
        }
      }
    );
  }

  // Ghost the played card flying toward its target (≤220 ms, purely cosmetic).
  function flyCard(instanceId, targetId) {
    const cardEl = app.querySelector(`.hand .card[data-instance-id="${instanceId}"]`);
    if (!cardEl) return;
    const dest = (targetId && fxCtx.anchorFor(targetId)) || fxCtx.anchorFor('player');
    const from = cardEl.getBoundingClientRect();
    const to = dest ? dest.getBoundingClientRect() : from;
    const ghost = cardEl.cloneNode(true);
    ghost.className = `${cardEl.className} card-ghost`;
    ghost.style.left = `${from.left}px`;
    ghost.style.top = `${from.top}px`;
    ghost.style.width = `${from.width}px`;
    ghost.style.margin = '0';
    document.body.appendChild(ghost);
    requestAnimationFrame(() => {
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.35) rotate(6deg)`;
      ghost.style.opacity = '0';
    });
    setTimeout(() => ghost.remove(), 260);
  }

  function playCard(instanceId, targetId) {
    if (busy || combat.result) return;
    if (targetId) lastTargetId = targetId; // remembered for the next card's aim
    selected = null;
    selectedFlask = null;
    hideTooltip();
    flyCard(instanceId, targetId);
    disp = takeSnapshot();
    let out;
    try {
      out = dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId: targetId || undefined });
    } catch (err) {
      disp = null;
      render(); // illegal input: show nothing, just resync (ENGINE-API §12)
      return;
    }
    sfx.play('cardPlay');
    busy = true;
    afterDispatch(out.events);
  }

  $('.end-turn').addEventListener('click', () => {
    if (busy || combat.result || combat.phase !== 'player') return;
    selected = null;
    selectedFlask = null;
    hideTooltip();
    disp = takeSnapshot();
    let out;
    try {
      out = dispatch(combat, { type: 'endTurn' });
    } catch (err) {
      disp = null;
      return;
    }
    busy = true;
    afterDispatch(out.events);
  });

  $('.pile.draw').addEventListener('click', () => openPileModal(registries, 'Draw pile', combat.piles.draw, { shuffleForDisplay: true }));
  $('.pile.discard').addEventListener('click', () => openPileModal(registries, 'Discard pile', combat.piles.discard));
  $('.pile.exhaust').addEventListener('click', () => openPileModal(registries, 'Exhaust pile', combat.piles.exhaust));
  if (onSettings) $('#combat-settings').addEventListener('click', onSettings);
  if (onMenu) $('#combat-menu').addEventListener('click', () => onMenu('deck'));

  render();
  // Combat-start events (relic triggers, opening draw) get a quick pass too.
  animateEvents(combat.eventLog.filter((e) => e.type === 'relicTriggered'), fxCtx, () => {});

  // First-run guided callouts (SPEC §9 M4) — once per player, over a live board.
  if (showTutorial) mountTutorial(app, { onDone: () => onTutorialDone && onTutorialDone() });
}
