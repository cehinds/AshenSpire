// src/ui/screens/equipment.js — the Armoury.
//
// Three views of the same loadout, because the two obvious layouts are both
// right for different things and neither should have to win:
//
//   grid    the figure in the middle, slots as squares around it — you are
//           looking at a PERSON, and the kit hangs off them
//   rack    a dense two-column armament rack — you are looking at a LIST, and
//           you want to compare eight shields quickly
//   hybrid  the rack, with the figure and its slot squares alongside
//
// The panel builds itself from registries.equipment.slots, so a new row in
// equipSlots.csv appears here with no change to this file. The card strip at
// the bottom is the whole point of the system made visible: pick up a dagger
// and watch Strike become 3×2 before you commit to it.

import { balance } from '../../content/balance.js';
import { resolveCard } from '../../model/registries.js';
import {
  canSwap, cycleSet, equipPiece, cardMods, runMods, loadoutTags, figureSpec, carriedIds,
} from '../../model/loadout.js';
import { renderCard } from '../components/card.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { playerSprite, equippedFigure } from '../assets.js';
import { assetUrl } from '../assetmap.js';
import { sfx } from '../sfx.js';

const CFG = () => balance.equipment;

/**
 * The figure, as layers: a bare-handed body in the armour set's palette with
 * each held armament stacked over it (see assets.js equippedFigure). Anything
 * missing falls back to the ordinary class sprite, so the single-file dist and
 * file:// play keep working exactly as before.
 */
function figureFor(registries, run, cz) {
  const el = document.createElement('div');
  el.className = 'armoury-figure';
  const reacts = CFG().spriteReacts;
  if (reacts === 'none') {
    el.appendChild(playerSprite(cz, run.class));
    return el;
  }
  const spec = figureSpec(registries, run.loadout, run.class);
  if (reacts === 'hands') spec.armourId = 'default';
  const fig = equippedFigure({ classId: run.class, ...spec });
  el.appendChild(fig || playerSprite(cz, run.class));
  return el;
}

/**
 * A piece's thumbnail. Armaments have a tight icon render; an armour set's
 * "icon" is the set itself — the body in its own palette — because there is no
 * separate object to photograph.
 */
function thumbSrc(piece) {
  return piece.kind === 'armor'
    ? assetUrl(`assets/equipment/body_${piece.classId}_${piece.id}.webp`)
    : assetUrl(`assets/equipment/icon_${piece.id}.webp`);
}

/** A piece's mods, written the way a player reads them. */
function modSummary(registries, piece) {
  const fields = registries.equipment.modFields || {};
  const parts = [];
  for (const raw of piece.mods || []) {
    const m = /^(\w+)\.(\w+)=([+-]?\d+)$/.exec(raw);
    if (!m) continue;
    const spec = fields[m[2]];
    if (!spec) continue;
    const where = m[1] === 'self' ? '' : `${m[1][0].toUpperCase()}${m[1].slice(1)} `;
    const sign = m[3][0] === '+' || m[3][0] === '-' ? m[3] : `= ${m[3]}`;
    parts.push(`${where}${spec.label} ${sign}`);
  }
  return parts;
}

function pieceChip(registries, piece, { selected, locked, hint }) {
  const el = document.createElement('button');
  el.className = `equip-chip rarity-${piece.rarity || 'common'}${selected ? ' on' : ''}${locked ? ' locked' : ''}`;
  el.type = 'button';
  const mods = modSummary(registries, piece);
  el.innerHTML =
    `<img class="ec-art" src="${esc(thumbSrc(piece))}" alt="">` +
    `<span class="ec-name">${esc(piece.name)}</span>` +
    `<span class="ec-tags">${(piece.tags || []).map((t) => `<em>${esc(t)}</em>`).join('')}</span>` +
    `<span class="ec-mods">${mods.length ? mods.map(esc).join(' · ') : '—'}</span>` +
    (locked ? `<span class="ec-lock">🔒 ${esc(hint || 'Locked')}</span>` : '');
  const art = el.querySelector('.ec-art');
  art.addEventListener('error', () => art.remove());
  return el;
}

/**
 * mountEquipment(host, opts) → { close() }
 *
 *   inCombat  seals storage and honours each slot's swap rule
 *   onSwap    called with (slotId, setIndex) instead of mutating, so combat can
 *             route the change through the engine intent that charges for it
 */
export function mountEquipment(host, {
  registries, run, meta = {}, inCombat = false, onClose, onChange, onSwap,
}) {
  const eq = registries.equipment;
  const cz = (meta.settings && meta.settings.customization) || run.customization || {};
  const unlocked = new Set(meta.unlocked || []);
  // WHICH VIEW A PHONE OPENS ON — EldenSpire#38, and the order of these three
  // terms is the whole rule:
  //   1. the player's own saved choice, always, on every shape;
  //   2. otherwise the narrow default, if this is a narrow layout;
  //   3. otherwise the desktop default.
  // Sunna's ruling was "hybrid must not be what a phone OPENS" — opens, not
  // shows. Someone who picked hybrid on a phone keeps it, and since #38 the
  // stylesheet makes it fit, so honouring that choice is no longer a trap.
  //
  // `data-layout` is READ, never computed. autoLayout() writes it in the same
  // call that chooses --ui-zoom, so mode and zoom cannot disagree; asking the
  // width here would make a second decider, which is exactly the fight that
  // became unadvanceable in #24. The value is validated against the content's
  // own closed set rather than trusted, so a bad table entry degrades to the
  // desktop default instead of rendering a view class that does not exist.
  const CV = CFG();
  const narrow = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-layout') === 'narrow';
  // LAW 1 CLAUSE 5 — bad data fails LOUD and names the entry. Vira's condition on
  // #41: `narrowDefaultView: 'racks'` is a one-character typo that fell through
  // to `hybrid` in silence, and tools/menufit.mjs stayed green because the other
  // half of this PR had just made hybrid fit. THE TWO HALVES MASKED EACH OTHER —
  // a silent fallback plus a check that asks "does it fit" rather than "is it the
  // one the table names". A validated-then-discarded value is exactly the shape
  // clause 5 exists to forbid.
  const named = narrow ? CV.narrowDefaultView : CV.defaultView;
  if (named != null && !CV.views.includes(named)) {
    console.error(`[content] balance.equipment.${narrow ? 'narrowDefaultView' : 'defaultView'}`
      + ` = ${JSON.stringify(named)} is not one of ${JSON.stringify(CV.views)}`
      + ' — falling back, and this line is the defect, not the fallback.');
  }
  const shapeDefault = (named != null && CV.views.includes(named)) ? named : CV.defaultView;
  let view = (meta.settings && meta.settings.equipView) || shapeDefault;
  let picking = null; // { slotId, setIndex }
  let notice = ''; // a refusal to show in place, cleared on the next draw

  const wrap = document.createElement('div');
  wrap.className = 'armoury-overlay';
  host.appendChild(wrap);

  const close = () => {
    wrap.remove();
    if (onClose) onClose();
  };

  // A piece gated behind an unlock shows locked with that unlock's HINT — the
  // thing you'd have to do — rather than its flavour blurb. A 'hidden' unlock
  // drops out of the list entirely: a genuine secret should not advertise the
  // shape of its own hole.
  const unlockById = new Map((registries.unlocks || []).map((u) => [u.id, u]));
  // `persistence` decides what counts as yours: what this run has picked up,
  // what the profile has ever held, or both (the default — a climb that ends
  // badly still widens the wardrobe).
  const drops = CFG().drops || {};
  const persistence = CFG().persistence;
  const available = new Set([
    ...(persistence !== 'perRun' ? meta.found || [] : []),
    ...(persistence !== 'unlocked' ? carriedIds(run.loadout) : []),
  ]);
  function gate(piece) {
    // Two independent gates. A CONDITION unlock is something you achieve; being
    // FOUND is something you pick up. Armour uses the first, armaments the
    // second, and a piece could one day use both.
    if (piece.unlock !== '' && !unlocked.has(piece.unlock)) {
      const u = unlockById.get(piece.unlock);
      if (u && u.reveal === 'hidden') return null;
      return { ...piece, locked: true, hint: (u && u.hint) || 'Not yet earned.' };
    }
    if (piece.kind !== 'armor' && drops.requireFound && !available.has(piece.id)) {
      return { ...piece, locked: true, hint: 'Not yet found. Armaments turn up in treasure, and on the bodies of things that owned them.' };
    }
    return { ...piece, locked: false };
  }

  function eligible(slot) {
    const pool = slot.kinds.includes('armor')
      ? (eq.armour || []).filter((o) => o.classId === run.class)
      : (eq.armaments || []).filter((a) => slot.kinds.includes(a.kind));
    return pool.map(gate).filter(Boolean);
  }

  function slotBlock(slot) {
    const box = document.createElement('div');
    box.className = 'equip-slot';
    const rule = canSwap(registries, slot.id, { inCombat });
    box.innerHTML =
      `<div class="es-head"><span class="es-label">${esc(slot.label)}</span>` +
      (rule.ok ? '' : `<span class="es-sealed" title="${esc(rule.reason)}">sealed</span>`) +
      `</div><div class="es-sets"></div>`;
    const sets = box.querySelector('.es-sets');

    (run.loadout.sets[slot.id] || []).forEach((itemId, i) => {
      const active = (run.loadout.active[slot.id] || 0) === i;
      const piece = itemId
        ? (slot.kinds.includes('armor')
          ? (eq.armour || []).find((o) => o.classId === run.class && o.id === itemId)
          : (eq.armaments || []).find((a) => a.id === itemId))
        : null;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `es-cell${active ? ' on' : ''}${piece ? '' : ' empty'}`;
      cell.title = piece ? piece.name : 'Empty';
      cell.innerHTML = piece
        ? `<img src="${esc(thumbSrc(piece))}" alt=""><span>${esc(piece.name)}</span>`
        : `<span class="es-empty">＋</span>`;
      const im = cell.querySelector('img');
      if (im) im.addEventListener('error', () => { im.replaceWith(Object.assign(document.createElement('span'), { textContent: '⚔' })); });

      cell.addEventListener('click', () => {
        // Clicking a set you're not in switches to it; clicking the one you're
        // already in opens the picker. Same square, two jobs, no extra chrome.
        if (!active) {
          if (!rule.ok) { notice = rule.reason; draw(); return; }
          if (onSwap) {
            // In combat the swap is the engine's to allow or refuse — it may
            // say no because the energy isn't there, and the player should be
            // told that in the panel rather than in the console.
            const refused = onSwap(slot.id, i);
            if (refused) { notice = refused; draw(); }
            return;
          }
          cycleSet(run.loadout, slot.id, i);
          sfx.play('cardPlay');
          commit();
        } else if (!inCombat) {
          picking = picking && picking.slotId === slot.id && picking.setIndex === i ? null : { slotId: slot.id, setIndex: i };
          draw();
        }
      });
      sets.appendChild(cell);
    });
    return box;
  }

  function pickerBlock() {
    const box = document.createElement('div');
    box.className = 'equip-picker';
    if (!picking) {
      box.innerHTML = inCombat
        ? '<p class="ep-hint">Storage is sealed in combat. Cycle between the sets you brought.</p>'
        : '<p class="ep-hint">Pick a slot above to change what is in it.</p>';
      return box;
    }
    const slot = eq.slots.find((s) => s.id === picking.slotId);
    box.innerHTML = `<h4>${esc(slot.label)} · set ${picking.setIndex + 1}</h4><div class="ep-list"></div>`;
    const list = box.querySelector('.ep-list');

    const bare = document.createElement('button');
    bare.type = 'button';
    bare.className = 'equip-chip bare';
    bare.innerHTML = '<span class="ec-name">Bare</span><span class="ec-mods">Nothing at all</span>';
    bare.addEventListener('click', () => {
      equipPiece(run.loadout, picking.slotId, picking.setIndex, null);
      commit();
    });
    list.appendChild(bare);

    const current = (run.loadout.sets[picking.slotId] || [])[picking.setIndex];
    for (const piece of eligible(slot)) {
      const chip = pieceChip(registries, piece, {
        selected: piece.id === current,
        locked: piece.locked,
        hint: piece.hint,
      });
      if (!piece.locked) {
        chip.addEventListener('click', () => {
          equipPiece(run.loadout, picking.slotId, picking.setIndex, piece.id);
          sfx.play('cardPlay');
          commit();
        });
      }
      list.appendChild(chip);
    }
    return box;
  }

  /** The rewrites, live: the actual cards this loadout produces right now. */
  function cardStrip() {
    const box = document.createElement('div');
    box.className = 'equip-cards';
    const mods = cardMods(registries, run.loadout, run.class);
    const ids = [...new Set((eq.targets || [])
      .filter((t) => t.classId === '*' || t.classId === run.class)
      .map((t) => t.cardId))];
    for (const cardId of ids) {
      if (!registries.cards.has(cardId)) continue;
      box.appendChild(renderCard(registries, { cardId, mods: mods.get(cardId) }, { small: true }));
    }
    const rm = runMods(registries, run.loadout, run.class);
    const bits = [];
    if (rm.maxHp) bits.push(`Max HP ${rm.maxHp > 0 ? '+' : ''}${rm.maxHp}`);
    for (const s of rm.startStatuses) bits.push(`${registries.statuses.get(s.status).name} ${s.stacks}`);
    const tags = loadoutTags(registries, run.loadout, run.class);
    const foot = document.createElement('div');
    foot.className = 'equip-foot';
    foot.innerHTML =
      `<span class="ef-tags">${tags.map((t) => `<em>${esc(t)}</em>`).join('') || '<em class="none">no tags</em>'}</span>` +
      (bits.length ? `<span class="ef-run">${bits.map(esc).join(' · ')}</span>` : '');
    box.appendChild(foot);
    return box;
  }

  function commit() {
    if (onChange) onChange(run.loadout);
    draw();
  }

  function draw() {
    wrap.innerHTML = `
      <div class="armoury view-${esc(view)}${picking ? ' picking' : ''}">
        <header class="armoury-head">
          <h2>ARMOURY</h2>
          <div class="armoury-views">
            ${CFG().views.map((v) => `<button type="button" data-view="${esc(v)}" class="${v === view ? 'on' : ''}">${esc(v)}</button>`).join('')}
          </div>
          <button type="button" class="armoury-close" title="Close (Esc)">✕</button>
        </header>
        ${notice ? `<p class="armoury-notice">${esc(notice)}</p>` : ''}
        <div class="armoury-body">
          <div class="armoury-left"></div>
          <div class="armoury-right"></div>
        </div>
        <div class="armoury-strip"></div>
      </div>`;

    const left = wrap.querySelector('.armoury-left');
    const right = wrap.querySelector('.armoury-right');
    const blocks = eq.slots
      // A slot with nothing that fits it isn't a slot yet: Talisman is declared
      // in equipSlots.csv but has no pieces authored, and three empty squares
      // read as broken rather than as a promise. It appears the day a talisman
      // row exists.
      .filter((slot) => eligible(slot).length)
      .map((slot) => ({ slot, el: slotBlock(slot) }));

    if (view === 'grid') {
      // The figure in the middle with its kit hanging off it, hands on the side
      // they are actually held: the sprite carries the right-hand armament at
      // screen right, so the Right Hand column is the right one.
      const cols = { l: document.createElement('div'), r: document.createElement('div') };
      cols.l.className = 'ag-col';
      cols.r.className = 'ag-col';
      blocks.forEach(({ slot, el: b }, i) => {
        const id = slot.id.toLowerCase();
        const side = id.includes('right') ? 'r' : id.includes('left') ? 'l' : (i % 2 ? 'r' : 'l');
        cols[side].appendChild(b);
      });
      left.appendChild(cols.l);
      left.appendChild(figureFor(registries, run, cz));
      left.appendChild(cols.r);
      right.appendChild(pickerBlock());
    } else {
      // 'rack' drops the figure entirely for density; 'hybrid' keeps it beside
      // the same list.
      if (view !== 'rack') left.appendChild(figureFor(registries, run, cz));
      const slotWrap = document.createElement('div');
      slotWrap.className = 'equip-slots';
      for (const b of blocks) slotWrap.appendChild(b.el);
      right.appendChild(slotWrap);
      right.appendChild(pickerBlock());
    }
    wrap.querySelector('.armoury-strip').appendChild(cardStrip());

    notice = '';
    wrap.querySelector('.armoury-close').addEventListener('click', close);
    for (const b of wrap.querySelectorAll('[data-view]')) {
      // Law 3 clause 4 — hover AND pad focus, text from balance (one home).
      const tip = (CFG().viewTips || {})[b.dataset.view];
      if (tip) attachTooltip(b, () => esc(tip));
      b.addEventListener('click', () => {
        view = b.dataset.view;
        if (onChange) onChange(run.loadout, { equipView: view });
        draw();
      });
    }
  }

  const onKey = (e) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);

  draw();
  return { close, redraw: draw };
}
