// src/model/artCharge.js — the Weapon Art charge meter's one reader
// (SPEC §12.2.1). DOM-free and engine-free: the engine's bus listener
// (engine/artCharge.js) and the combat screen both ask these questions, so the
// hand, the HUD and the play always agree on what a meter holds.
//
// State is `combat.artCharge = { [armamentId]: integer }`. A missing entry is
// 0, and every read clamps to the weapon's CURRENT max, so a snapshot written
// under other balance numbers never shows more pips than the meter has.

import { equippedIn, slotHand } from './loadout.js';
import { ownerItemRef } from './cardMounts.js';

/** balance.weaponArtCharge, or null when the content carries no meter rules. */
export function artChargeRules(registries) {
  const rules = registries && registries.balance && registries.balance.weaponArtCharge;
  return rules && typeof rules === 'object' ? rules : null;
}

/** The unleashed form authored for an Art card id, or null. */
export function unleashedFormFor(registries, cardId) {
  const forms = registries && registries.weaponArtUnleashed;
  return forms && typeof cardId === 'string' && Object.hasOwn(forms, cardId) ? forms[cardId] : null;
}

function armamentById(registries, id) {
  return (((registries && registries.equipment) || {}).armaments || []).find((piece) => piece && piece.id === id) || null;
}

/** The combat-kit Art card id an armament lends, or null. */
export function artCardIdOf(piece) {
  return (piece && piece.weaponCardPackage && piece.weaponCardPackage.combatKit && piece.weaponCardPackage.combatKit.artCardId) || null;
}

/**
 * artChargeMax(registries, weaponId) → the meter's size; 0 means no meter.
 * A weapon has a meter only when the rules exist, its combat-kit Art has an
 * unleashed form, and its max (per-weapon row, else the default) is above 0.
 */
export function artChargeMax(registries, weaponId) {
  const rules = artChargeRules(registries);
  if (!rules) return 0;
  const piece = armamentById(registries, weaponId);
  if (!piece || !unleashedFormFor(registries, artCardIdOf(piece))) return 0;
  const byWeapon = rules.maxByWeapon || {};
  const max = Object.hasOwn(byWeapon, weaponId) ? byWeapon[weaponId] : rules.defaultMax;
  return Number.isInteger(max) && max > 0 ? max : 0;
}

/**
 * The stored charge for a weapon, clamped to its current max. `charge` is the
 * map to read: the live `combat.artCharge` by default, or the combat
 * screen's paced display copy (advanceArtChargeDisplay) during playback.
 */
export function artChargeValue(combat, weaponId, charge = combat.artCharge) {
  const max = artChargeMax(combat.registries, weaponId);
  const raw = charge && Number.isInteger(charge[weaponId]) ? charge[weaponId] : 0;
  return Math.max(0, Math.min(max, raw));
}

/**
 * The armaments the player's hands hold right now, right hand first, each
 * once (a two-handed piece fills both hand slots but has one meter).
 */
export function equippedWeaponIds(registries, loadout, classId) {
  if (!loadout) return [];
  const out = [];
  const slots = ((registries && registries.equipment) || {}).slots || [];
  for (const hand of ['right', 'left']) {
    for (const slot of slots.filter((row) => slotHand(row) === hand)) {
      const piece = equippedIn(registries, loadout, classId, slot.id);
      if (piece && piece.kind !== 'armor' && !out.includes(piece.id)) out.push(piece.id);
    }
  }
  return out;
}

/** Is this weapon in one of the player's hands in this fight? */
export function isWeaponEquipped(combat, weaponId) {
  return equippedWeaponIds(combat.registries, combat.loadout, combat.player && combat.player.classId).includes(weaponId);
}

/**
 * The armament a card (instance, card ref or damage event) was lent by, or
 * null: `sourceArmamentId` (stamped on kit and attack cards), else the
 * `grantedBy` owner when it names an armament.
 */
export function lendingWeaponOf(registries, card) {
  if (!card) return null;
  const direct = card.sourceArmamentId || card.weaponId;
  if (typeof direct === 'string' && armamentById(registries, direct)) return direct;
  const ref = ownerItemRef({ grantedBy: card.grantedBy });
  if (ref && ref.startsWith('armament/')) {
    const id = ref.slice('armament/'.length);
    if (armamentById(registries, id)) return id;
  }
  return null;
}

/**
 * artUnleashFor(combat, inst) → { weaponId, value, max, ready, form } for a
 * `weaponArt` instance whose lender has a meter, else null. `ready` is the
 * unleash condition: the lender is equipped, the meter is full, and this
 * card id has an unleashed form.
 */
export function artUnleashFor(combat, inst, charge = combat.artCharge) {
  if (!inst || inst.equipmentRole !== 'weaponArt') return null;
  const weaponId = lendingWeaponOf(combat.registries, inst);
  if (!weaponId) return null;
  const max = artChargeMax(combat.registries, weaponId);
  if (!max) return null;
  const form = unleashedFormFor(combat.registries, inst.cardId);
  const value = artChargeValue(combat, weaponId, charge);
  const equipped = isWeaponEquipped(combat, weaponId);
  return { weaponId, value, max, form, ready: !!form && equipped && value >= max };
}

/**
 * artChargeView(combat) → one row per equipped weapon that has a meter:
 * { weaponId, name, artCardId, artName, value, max, full }. The HUD's input.
 */
export function artChargeView(combat, charge = combat.artCharge) {
  const registries = combat.registries;
  const rows = [];
  for (const weaponId of equippedWeaponIds(registries, combat.loadout, combat.player && combat.player.classId)) {
    const max = artChargeMax(registries, weaponId);
    if (!max) continue;
    const piece = armamentById(registries, weaponId);
    const artCardId = artCardIdOf(piece);
    const value = artChargeValue(combat, weaponId, charge);
    const artDef = registries.cards && registries.cards.has && registries.cards.has(artCardId) ? registries.cards.get(artCardId) : null;
    rows.push({ weaponId, name: piece.name || weaponId, artCardId, artName: (artDef && artDef.name) || artCardId, value, max, full: value >= max });
  }
  return rows;
}

/**
 * artChargeSnapshotProblems(value) → field-addressed problems for a saved
 * `artCharge` map (absent is fine: an older snapshot resumes with 0s).
 */
export function artChargeSnapshotProblems(value) {
  if (value === undefined) return [];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return ['artCharge must be an object keyed by armament id'];
  const problems = [];
  for (const [id, charge] of Object.entries(value)) {
    if (!id || !Number.isInteger(charge) || charge < 0) problems.push(`artCharge.${id || '<empty>'} must be a non-negative integer`);
  }
  return problems;
}

/**
 * shortStatusName(name) → the phone strip's word for a status: a name of six
 * letters or fewer as it is ("Bleed"), the last word of a longer multi-word
 * name when that is short ("Crimson Blight" → "Blight"), else its first four
 * letters and a stop ("Vulnerable" → "Vuln.").
 */
export function shortStatusName(name = '') {
  const s = String(name);
  if (s.length <= 6) return s;
  const last = s.split(/\s+/).pop();
  if (last !== s && last.length <= 6) return last;
  return `${s.slice(0, 4)}.`;
}

/**
 * unleashedTemplate(form, statusName, { short }) → the card-text line (SPEC §3.13) for an
 * unleashed form: "★ +{unleashed.0} damage, +{unleashed.1} Bleed". Compact on
 * purpose — it must fit a resting hand card in full; the ★ is the Unleashed
 * mark the meter and the card's edge already explain. `short` is the phone
 * hand's wording (dmg, shortStatusName), where only a card's uncovered step
 * shows at rest. Each value token is
 * `unleashed.<effect index>`, filled by previewCard with the same evaluator
 * the play uses, so the printed number is the number that lands.
 */
export function unleashedTemplate(form, statusName = (id) => id, { short = false } = {}) {
  const parts = [];
  const name = short ? (id) => shortStatusName(statusName(id)) : statusName;
  (form && form.effects || []).forEach((eff, i) => {
    const tok = `{unleashed.${i}}`;
    const hits = typeof eff.hits === 'number' && eff.hits > 1 ? `×${eff.hits}` : '';
    const all = eff.target === 'allEnemies' ? (short ? ' all' : ' to all') : '';
    switch (eff.op) {
      case 'damage': parts.push(`+${tok}${hits} ${short ? 'dmg' : 'damage'}${all}`); break;
      case 'poiseDamage': parts.push(`+${tok} Poise${all}`); break;
      case 'block': parts.push(`+${tok} Block`); break;
      case 'draw': parts.push(`draw ${tok}`); break;
      case 'heal': parts.push(`heal ${tok}`); break;
      case 'applyStatus': parts.push(`+${tok} ${name(eff.status)}${all}`); break;
      default: parts.push(eff.op);
    }
  });
  return parts.length ? `★ ${parts.join(', ')}` : '';
}

/**
 * advanceArtChargeDisplay(charge, events) -> the same map, moved by one beat's
 * events the way the engine moved the live one (SPEC 7.4 paced playback):
 * `artChargeChanged` sets that weapon's value, `artUnleashed` empties it.
 * The combat screen snapshots the pre-dispatch map and advances it here, so
 * the pips, the full flash and the Art's unleashed face land ON the hit that
 * earned them; when playback ends (or is skipped) the live map is read again.
 */
export function advanceArtChargeDisplay(charge, events = []) {
  for (const e of events) {
    if (!e || typeof e.weaponId !== 'string') continue;
    if (e.type === 'artChargeChanged' && Number.isInteger(e.value)) charge[e.weaponId] = e.value;
    else if (e.type === 'artUnleashed') charge[e.weaponId] = 0;
  }
  return charge;
}

/**
 * beatRepaintsHand(events) -> boolean: whether a paced-playback beat changes
 * what the displayed hand shows. The four card events move cards between
 * piles; the two charge events move the shown meter, and an Art card in hand
 * wears that meter (its full edge, pips and unleashed strip/tab), so a beat
 * that fills or empties it must repaint the hand ON that beat, not at the end
 * of the timeline (SPEC 12.2.1).
 */
export const HAND_BEAT_EVENTS = new Set(['cardDrawn', 'cardPlayed', 'cardDiscarded', 'cardExhausted', 'artChargeChanged', 'artUnleashed']);
export function beatRepaintsHand(events = []) {
  return events.some((event) => !!event && HAND_BEAT_EVENTS.has(event.type));
}

/**
 * newlyFullIds(previous, fullIds) -> { fresh, next }: which ids are full now
 * that were not at the last paint (`fresh`), and the set to remember for the
 * next paint (`next`). A meter or an Art card flashes once when it FILLS,
 * never again on a repaint that rebuilds its node while it stays full.
 */
export function newlyFullIds(previous, fullIds = []) {
  const next = new Set(fullIds);
  const fresh = new Set([...next].filter((id) => !(previous && previous.has(id))));
  return { fresh, next };
}

/**
 * pacedArtPreview(pv, shown, before) -> the preview an Art card in hand is
 * drawn from during paced playback (SPEC 7.4, 12.2.1). `pv` is the live
 * previewCard answer, `shown` the artUnleashFor answer against the SHOWN
 * charge, `before` the card's pre-dispatch preview (captured when the
 * display snapshot was taken, or null). The face follows the shown meter:
 * not unleashed before the hit that fills it has played, and still
 * unleashed until the beat that spends it. Playing a full Art empties the
 * live meter at dispatch, so the live preview has lost the unleashed line
 * and its `unleashed.N` numbers; those come from `before`, which was
 * resolved by the same math before the play.
 */
export function pacedArtPreview(pv, shown, before = null) {
  if (!pv || !pv.artCharge || !shown || shown.ready === pv.artCharge.unleashed) return pv;
  const { textTemplate, shortTemplate, ...rest } = pv.artCharge;
  if (!shown.ready) return { ...pv, artCharge: { ...rest, value: shown.value, unleashed: false } };
  const source = textTemplate ? pv : (before && before.artCharge && before.artCharge.textTemplate ? before : null);
  if (!source) return { ...pv, artCharge: { ...rest, value: shown.value, unleashed: false } };
  const unleashedTokens = Object.fromEntries(Object.entries(source.tokens || {}).filter(([key]) => key.startsWith('unleashed.')));
  return {
    ...pv,
    tokens: { ...(pv.tokens || {}), ...unleashedTokens },
    artCharge: { ...rest, value: shown.value, unleashed: true, textTemplate: source.artCharge.textTemplate, ...(source.artCharge.shortTemplate ? { shortTemplate: source.artCharge.shortTemplate } : {}) },
  };
}
