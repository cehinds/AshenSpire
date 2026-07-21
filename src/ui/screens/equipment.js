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
  canSwap, cycleSet, equipPiece, equippedIn, cardMods, runMods, loadoutTags,
} from '../../model/loadout.js';
import { renderCard } from '../components/card.js';
import { esc } from '../components/tooltip.js';
import { playerSprite } from '../assets.js';
import { sfx } from '../sfx.js';

const CFG = () => balance.equipment;

/** The armour set a class is wearing right now (or its starting one). */
function wornArmourId(registries, run) {
  const worn = equippedIn(registries, run.loadout, run.class, 'armor');
  return worn ? worn.id : 'default';
}

/**
 * The figure. Armour is a whole repaint of the class body, so a set swap is a
 * different rendered PNG (tools/equipment-blender.py) rather than an overlay;
 * anything missing falls back to the ordinary class sprite, which keeps the
 * single-file dist and file:// play working exactly as before.
 */
function figureFor(registries, run, cz) {
  const el = document.createElement('div');
  el.className = 'armoury-figure';
  if (CFG().spriteReacts === 'none') {
    el.appendChild(playerSprite(cz, run.class));
    return el;
  }
  const img = document.createElement('img');
  img.src = `assets/equipment/body_${run.class}_${wornArmourId(registries, run)}.png`;
  img.alt = 'your figure';
  img.addEventListener('error', () => {
    img.remove();
    el.appendChild(playerSprite(cz, run.class));
  });
  el.appendChild(img);
  return el;
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
    `<img class="ec-art" src="assets/equipment/weapon_${esc(piece.id)}.png" alt="">` +
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
  let view = (meta.settings && meta.settings.equipView) || CFG().defaultView;
  let picking = null; // { slotId, setIndex }
  let notice = ''; // a refusal to show in place, cleared on the next draw

  const wrap = document.createElement('div');
  wrap.className = 'armoury-overlay';
  host.appendChild(wrap);

  const close = () => {
    wrap.remove();
    if (onClose) onClose();
  };

  function eligible(slot) {
    if (slot.kinds.includes('armor')) {
      return (eq.armour || [])
        .filter((o) => o.classId === run.class)
        .map((o) => ({ ...o, locked: o.unlock !== '' && !unlocked.has(o.unlock) }));
    }
    return (eq.armaments || [])
      .filter((a) => slot.kinds.includes(a.kind))
      .map((a) => ({ ...a, locked: a.unlock !== '' && !unlocked.has(a.unlock) }));
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
        ? `<img src="assets/equipment/weapon_${esc(piece.id)}.png" alt=""><span>${esc(piece.name)}</span>`
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
        hint: piece.blurb,
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
      <div class="armoury view-${esc(view)}">
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
    // 'grid' hangs the slots around the figure; 'rack' drops the figure
    // entirely for density; 'hybrid' keeps both, figure beside the rack.
    if (view !== 'rack') left.appendChild(figureFor(registries, run, cz));
    const slotHost = view === 'grid' ? left : right;
    const slotWrap = document.createElement('div');
    slotWrap.className = 'equip-slots';
    for (const slot of eq.slots) slotWrap.appendChild(slotBlock(slot));
    slotHost.appendChild(slotWrap);
    (view === 'grid' ? right : right).appendChild(pickerBlock());
    wrap.querySelector('.armoury-strip').appendChild(cardStrip());

    notice = '';
    wrap.querySelector('.armoury-close').addEventListener('click', close);
    for (const b of wrap.querySelectorAll('[data-view]')) {
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
