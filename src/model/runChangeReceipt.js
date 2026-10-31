// The "what changed" receipt: a pure before/after diff of the parts of a run a choice, event, rest
// service or Blacksmith purchase can move. No DOM and no RNG; the modal (ui/components/whatChangedModal.js)
// draws the rows. Card upgrades carry the instance's before and after faces, resolved with the same
// applyUpgradeSteps the card-upgrade picker uses.
import { applyUpgradeSteps, upgradeStepsOf } from './cardUpgrade.js';
import { cardRank, rankedEffectsCapped } from './cardRank.js';

const freeze = Object.freeze;
const num = (v) => (Number.isFinite(v) ? v : 0);
const flatIds = (value, out = []) => {
  if (Array.isArray(value)) value.forEach((v) => flatIds(v, out));
  else if (typeof value === 'string' && value) out.push(value);
  return out;
};

/** A plain copy of what the receipt compares; safe to hold across a commit. */
export function snapshotRunForDiff(run) {
  const loadout = run?.loadout || {};
  const sets = flatIds(Object.values(loadout.sets || {}));
  const levels = run?.itemUpgradeLevels || {};
  return freeze({
    hp: num(run?.hp), maxHp: num(run?.maxHp),
    mana: num(run?.mana), maxMana: num(run?.maxMana),
    stamina: num(run?.stamina), maxStamina: num(run?.maxStamina),
    cinders: num(run?.cinders),
    smithingStones: num(run?.smithingStones),
    smithingStonesRefined: num(run?.smithingStonesRefined),
    relics: freeze([...(run?.relics || [])]),
    deck: freeze([...(run?.deck || []).map((c) => [c, 'deck']), ...(run?.sideboard || []).map((c) => [c, 'sideboard'])].map(([card, zone]) => freeze({
      instanceId: card.instanceId, cardId: card.cardId, zone,
      steps: freeze(upgradeStepsOf(card).map((s) => ({ ...s }))), rank: cardRank(card),
    }))),
    armaments: freeze([...new Set([...sets, ...flatIds(loadout.storage || [])])]),
    equipped: freeze(sets),
    itemUpgradeLevels: freeze({ ...levels }),
    classId: run?.class ?? null,
    flasks: freeze((run?.flasks || []).map((f) => (typeof f === 'string' ? f : f?.flaskId)).filter(Boolean)),
    flaskCharges: freeze({ capacity: num(run?.flaskCharges?.capacity), hp: num(run?.flaskCharges?.hp), mana: num(run?.flaskCharges?.mana) }),
    potions: freeze({ ...(run?.consumables || {}) }),
    sigilSlots: freeze(Object.fromEntries(Object.entries(run?.sigilSlots || {}).map(([ref, slots]) => [ref, freeze([...(slots || [])])]))),
  });
}

// A card face at some upgrade steps and rank: the steps first, then the rank bonus as gameProfile.js resolves it.
const faceAt = (base, steps, rank) => {
  const face = applyUpgradeSteps(base, steps);
  return rank > 1 ? { ...face, effects: rankedEffectsCapped(face, rank - 1), rank } : face;
};

const stat = (label, before, after, kind = 'stat') => freeze({ kind, label, before: String(before), after: String(after), delta: after - before });

const armamentName = (registries, id) => (registries?.equipment?.armaments || []).find((p) => p.id === id)?.name || id;
const cardName = (registries, cardId) => (registries?.cards?.has?.(cardId) ? registries.cards.get(cardId).name : cardId);

/** diffRunSnapshots(before, after, registries) → frozen { rows, empty }. */
export function diffRunSnapshots(before, after, registries) {
  const rows = [];
  const pair = (label, a, b, kind = 'stat') => { if (a !== b) rows.push(stat(label, a, b, kind)); };
  pair('HP', before.hp, after.hp);
  pair('MAX HP', before.maxHp, after.maxHp);
  pair('MANA', before.mana, after.mana);
  pair('MAX MANA', before.maxMana, after.maxMana);
  pair('STAMINA', before.stamina, after.stamina);
  pair('MAX STAMINA', before.maxStamina, after.maxStamina);
  pair('CINDERS', before.cinders, after.cinders, 'resource');
  pair('SMITHING STONES', before.smithingStones, after.smithingStones, 'resource');
  pair('REFINED STONES', before.smithingStonesRefined, after.smithingStonesRefined, 'resource');

  for (const id of after.relics) {
    if (!before.relics.includes(id)) {
      rows.push(freeze({ kind: 'relic', label: registries?.relics?.has?.(id) ? registries.relics.get(id).name : id, before: '', after: 'gained', relicId: id, gained: true }));
    }
  }
  for (const id of before.relics) {
    if (!after.relics.includes(id)) {
      rows.push(freeze({ kind: 'relic', label: registries?.relics?.has?.(id) ? registries.relics.get(id).name : id, before: 'held', after: '', relicId: id, gained: false }));
    }
  }

  const beforeById = new Map(before.deck.map((c) => [c.instanceId, c]));
  const afterById = new Map(after.deck.map((c) => [c.instanceId, c]));
  for (const card of after.deck) {
    const prev = beforeById.get(card.instanceId);
    const name = cardName(registries, card.cardId);
    if (!prev) {
      rows.push(freeze({ kind: 'card', label: name, before: '', after: card.zone === 'sideboard' ? 'gained' : 'added', cardId: card.cardId, instanceId: card.instanceId, change: card.zone === 'sideboard' ? 'gained' : 'added' }));
      continue;
    }
    const stepsChanged = JSON.stringify(prev.steps) !== JSON.stringify(card.steps);
    if (!stepsChanged && prev.rank === card.rank) continue;
    const base = registries?.cards?.has?.(card.cardId) ? registries.cards.get(card.cardId) : null;
    const faces = base ? freeze({ before: faceAt(base, prev.steps, prev.rank), after: faceAt(base, card.steps, card.rank) }) : undefined;
    const row = { kind: 'card', label: name, cardId: card.cardId, instanceId: card.instanceId, change: stepsChanged ? 'upgraded' : 'ranked' };
    if (stepsChanged) Object.assign(row, { before: `+${prev.steps.length}`, after: `+${card.steps.length}`, delta: card.steps.length - prev.steps.length });
    else Object.assign(row, { before: `RANK ${prev.rank}`, after: `RANK ${card.rank}`, delta: card.rank - prev.rank });
    if (faces) row.faces = faces;
    rows.push(freeze(row));
  }
  for (const card of before.deck) {
    if (!afterById.has(card.instanceId)) {
      rows.push(freeze({ kind: 'card', label: cardName(registries, card.cardId), before: 'removed', after: '', cardId: card.cardId, instanceId: card.instanceId, change: 'removed' }));
    }
  }

  for (const id of after.armaments) {
    if (!before.armaments.includes(id)) rows.push(freeze({ kind: 'armament', label: armamentName(registries, id), before: '', after: 'gained', armamentId: id, change: 'added' }));
  }
  for (const id of before.armaments) {
    if (!after.armaments.includes(id)) rows.push(freeze({ kind: 'armament', label: armamentName(registries, id), before: 'held', after: '', armamentId: id, change: 'removed' }));
  }
  for (const ref of new Set([...Object.keys(before.itemUpgradeLevels), ...Object.keys(after.itemUpgradeLevels)])) {
    const a = before.itemUpgradeLevels[ref] || 0;
    const b = after.itemUpgradeLevels[ref] || 0;
    if (a === b) continue;
    const id = ref.includes('/') ? ref.slice(ref.indexOf('/') + 1) : ref;
    // A piece bought at a tier is one "gained" row (the receipt reads its tier stats), not also a tier-up.
    if (!before.armaments.includes(id) && after.armaments.includes(id)) continue;
    rows.push(freeze({ kind: 'armament', label: armamentName(registries, id), before: `TIER ${a}`, after: `TIER ${b}`, delta: b - a, armamentId: id, itemRef: ref, change: 'tier', tierBefore: a, tierAfter: b }));
  }

  const slotBase = registries?.shops?.blacksmith?.offerings?.find?.((o) => o.id === 'sigilSlots')?.sigilSlots?.base ?? 0;
  // Sigil work: a slot that now holds a different sigil is "installed X on Y" or "removed X from Y".
  const sigilName = (id) => (registries?.sigils?.has?.(id) ? registries.sigils.get(id).name : String(id));
  for (const ref of new Set([...Object.keys(before.sigilSlots), ...Object.keys(after.sigilSlots)])) {
    const a = before.sigilSlots[ref] || [], b = after.sigilSlots[ref] || [];
    const piece = armamentName(registries, ref.includes('/') ? ref.slice(ref.indexOf('/') + 1) : ref);
    // A cut slot appends an empty one. An item with no record yet has the authored base number of slots.
    const countOf = (list, hasRecord) => (hasRecord ? list.length : slotBase);
    const nA = countOf(a, ref in before.sigilSlots), nB = countOf(b, ref in after.sigilSlots);
    if (nA !== nB) rows.push(stat(`${piece} · SIGIL SLOTS`, nA, nB, 'sigil'));
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if ((a[i] ?? null) === (b[i] ?? null)) continue;
      if (a[i]) rows.push(freeze({ kind: 'sigil', label: sigilName(a[i]), before: 'removed', after: '', change: 'removed', sigilId: a[i], itemRef: ref, pieceName: piece }));
      if (b[i]) rows.push(freeze({ kind: 'sigil', label: sigilName(b[i]), before: '', after: 'installed', change: 'installed', sigilId: b[i], itemRef: ref, pieceName: piece }));
    }
  }

  if (before.classId !== after.classId) {
    const name = (id) => (id && registries?.classes?.has?.(id) ? registries.classes.get(id).name : String(id ?? ''));
    rows.push(freeze({ kind: 'class', label: 'CLASS', before: name(before.classId), after: name(after.classId) }));
  }

  const counted = (list) => list.reduce((m, id) => m.set(id, (m.get(id) || 0) + 1), new Map());
  const flaskB = counted(before.flasks), flaskA = counted(after.flasks);
  for (const id of new Set([...flaskB.keys(), ...flaskA.keys()])) {
    const a = flaskB.get(id) || 0, b = flaskA.get(id) || 0;
    const name = registries?.flasks?.has?.(id) ? registries.flasks.get(id).name : id;
    if (a !== b) rows.push(stat(String(name).toUpperCase(), a, b, 'resource'));
  }
  pair('FLASK CHARGES', before.flaskCharges.capacity, after.flaskCharges.capacity, 'resource');
  for (const id of new Set([...Object.keys(before.potions), ...Object.keys(after.potions)])) {
    const a = num(before.potions[id]), b = num(after.potions[id]);
    if (a !== b) rows.push(stat(String(id).toUpperCase(), a, b, 'resource'));
  }
  return freeze({ rows: freeze(rows), empty: rows.length === 0 });
}
