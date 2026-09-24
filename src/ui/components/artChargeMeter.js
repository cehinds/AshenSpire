// src/ui/components/artChargeMeter.js — the Weapon Art charge pip bars
// (SPEC §12.2.1, item 9). Pure presentation over model/artCharge.js rows:
// { weaponId, name, artName, value, max, full }. The engine decides what a
// meter holds; this draws it, and marks a meter that has JUST filled so the
// stylesheet can flash it once (a static highlight under reduced motion —
// styles/combat.css owns both).

import { el } from '../kit/index.js';

/** The accessible sentence for one meter. */
export function artChargeLabel(row) {
  return row.full
    ? `${row.name}: Art charged, ${row.artName} is unleashed on its next play`
    : `${row.name}: Art charge ${row.value} of ${row.max}`;
}

/** One pip strip: `max` pips, the first `value` lit. */
export function artChargePips(value, max) {
  const strip = el('span', { class: 'art-charge-pips', aria: { hidden: 'true' } });
  for (let i = 0; i < max; i++) strip.appendChild(el('span', { class: `art-charge-pip${i < value ? ' lit' : ''}` }));
  return strip;
}

/**
 * artChargeMeter(rows, { flashIds }) → element, or null with no meters.
 * `flashIds` names the weapons whose meter became full since the last paint.
 */
export function artChargeMeter(rows, { flashIds = new Set() } = {}) {
  if (!rows || !rows.length) return null;
  const box = el('div', { class: 'art-charge', role: 'group', aria: { label: 'Weapon Art charge' } });
  for (const row of rows) {
    const item = el('div', {
      class: `art-charge-row${row.full ? ' full' : ''}${row.full && flashIds.has(row.weaponId) ? ' flash' : ''}`,
      role: 'img',
      dataset: { weaponId: row.weaponId, value: row.value, max: row.max },
      aria: { label: artChargeLabel(row) },
    });
    item.appendChild(el('span', { class: 'art-charge-name', text: row.name, aria: { hidden: 'true' } }));
    item.appendChild(artChargePips(row.value, row.max));
    if (row.full) item.appendChild(el('span', { class: 'art-charge-ready', text: 'Unleash', aria: { hidden: 'true' } }));
    box.appendChild(item);
  }
  return box;
}

/**
 * The words for an unleashed form's extra effects, read off the effect DSL
 * rows themselves (never a second authored sentence that could drift).
 */
export function unleashedSummary(effects = [], statusName = (id) => id) {
  const parts = [];
  for (const eff of effects) {
    const n = typeof eff.amount === 'number' ? eff.amount : null;
    const hits = typeof eff.hits === 'number' && eff.hits > 1 ? `×${eff.hits}` : '';
    const all = eff.target === 'allEnemies' ? ' to all' : '';
    switch (eff.op) {
      case 'damage': parts.push(`+${n}${hits} damage${all}`); break;
      case 'poiseDamage': parts.push(`+${n} Poise${all}`); break;
      case 'block': parts.push(`+${n} Block`); break;
      case 'draw': parts.push(`draw ${n}`); break;
      case 'heal': parts.push(`heal ${n}`); break;
      case 'applyStatus': parts.push(`${eff.target === 'self' ? 'gain' : 'apply'} ${eff.stacks ?? 1} ${statusName(eff.status)}${all}`); break;
      default: parts.push(eff.op);
    }
  }
  return parts.join(', ');
}
