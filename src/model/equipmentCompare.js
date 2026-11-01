// The Replace comparison (owner wireframe, 2026-11-01): the facts of the item
// that is equipped beside the facts of the one that would replace it, row by
// row, each marked better, worse or unchanged. Pure: it reads items and
// registries and mutates nothing, so the modal only draws what is decided here.
//
// DIRECTION. A higher AR, DR or Poise is better; a higher requirement is worse
// (it is harder to wield). Text facts (weapon art, modifiers) carry no order, so
// a changed one is `changed`, never better or worse.
import { equipmentRequirementReceipt } from './loadout.js';

/** Authored modifier strings ("strike.poise=+3") as the short phrases the Armoury shows. */
export function equipmentModLines(registries, piece) {
  const fields = (registries.equipment && registries.equipment.modFields) || {};
  const lines = [];
  for (const raw of (piece && piece.mods) || []) {
    const m = /^(\w+)\.(\w+)=([+-]?\d+)$/.exec(raw);
    if (!m) continue;
    const spec = fields[m[2]];
    if (!spec) continue;
    const where = m[1] === 'self' ? '' : `${m[1][0].toUpperCase()}${m[1].slice(1)} `;
    const sign = m[3][0] === '+' || m[3][0] === '-' ? m[3] : `= ${m[3]}`;
    lines.push(`${where}${spec.label} ${sign}`);
  }
  return lines;
}

/** The weapon art a weapon grants, by name, or '' when it grants none. */
export function weaponArtName(registries, piece) {
  const id = piece && piece.weaponCardPackage && piece.weaponCardPackage.combatKit && piece.weaponCardPackage.combatKit.artCardId;
  if (!id) return '';
  return registries.cards.has(id) ? registries.cards.get(id).name : id;
}

const NUMBER_ROWS = Object.freeze([
  { id: 'attackRating', label: 'AR', field: 'attackRating', better: 'higher' },
  { id: 'defenseRating', label: 'DR', field: 'defenseRating', better: 'higher' },
  { id: 'poise', label: 'Poise', field: 'poiseThreshold', better: 'higher' },
]);

const verdict = (before, after, better) => {
  if (before === after) return 'same';
  const up = after > before;
  return (better === 'higher' ? up : !up) ? 'better' : 'worse';
};

/**
 * equipmentCompareRows(registries, current, next, { attributes, itemUpgradeLevels, armamentLevels })
 * → [{ id, label, kind: 'number'|'text', before, after, verdict: 'better'|'worse'|'same'|'changed' }]
 * `before` is the equipped item, `after` the candidate. A number row appears
 * when either side has the stat; a text row only when it differs.
 */
export function equipmentCompareRows(registries, current, next, context = {}) {
  if (!current || !next) throw new Error('equipmentCompareRows needs the equipped item and the candidate');
  const rows = [];
  for (const spec of NUMBER_ROWS) {
    const a = Number(current[spec.field]), b = Number(next[spec.field]);
    if (!Number.isFinite(a) && !Number.isFinite(b)) continue;
    const before = Number.isFinite(a) ? a : 0, after = Number.isFinite(b) ? b : 0;
    rows.push({ id: spec.id, label: spec.label, kind: 'number', before, after, verdict: verdict(before, after, spec.better) });
  }
  const reqOf = (piece) => new Map(equipmentRequirementReceipt(registries, piece, context.attributes || {}, {
    itemUpgradeLevels: context.itemUpgradeLevels, armamentLevels: context.armamentLevels,
  }).requirements.map((row) => [row.attributeId, row.required]));
  const had = reqOf(current), will = reqOf(next);
  for (const attributeId of new Set([...had.keys(), ...will.keys()])) {
    const attribute = registries.attributes.get(attributeId);
    const before = had.get(attributeId) ?? 0, after = will.get(attributeId) ?? 0;
    rows.push({
      id: `req:${attributeId}`, label: `${attribute.shortLabel || attribute.label} req`, kind: 'number',
      before, after, verdict: verdict(before, after, 'lower'),
    });
  }
  const textRow = (id, label, before, after) => {
    if (before === after) return;
    rows.push({ id, label, kind: 'text', before: before || 'None', after: after || 'None', verdict: 'changed' });
  };
  textRow('weaponArt', 'Weapon art', weaponArtName(registries, current), weaponArtName(registries, next));
  textRow('mods', 'Modifiers', equipmentModLines(registries, current).join(', '), equipmentModLines(registries, next).join(', '));
  return rows;
}
