// src/model/cardMounts.js — where an item's cards sit, and what has happened
// to them since they were authored.
//
// A MOUNT is one position on an item that a card occupies. An item's mounts
// are whatever its authoring lends: a row in the `bound` table, a package's
// grantedCards, its weaponArtDefaults. Each mount has a deterministic key —
// the instance id the composer mints for it — so "the sword's second
// Quickstep" is the same mount on every restamp, every save and every fight.
//
// `run.itemMounts` records what a smith has done to a mount:
//
//   { [itemRef]: { [mountKey]: { card, upgraded?, extractions } } }
//
//   card === null   EMPTIED. The card was extracted and is now the run's own.
//                   The mount shows its kind's FALLBACK (the Dodge Roll, for a
//                   weapon-art mount — the owner's rule) until it is refilled.
//   card === id     REFILLED with another card.
//   absent          untouched: the authored card.
//
// Extra mounts (`extraMounts`, behind a flag so a later rune feature can add
// slots) are keyed `mount:<itemRef>:<n>` and exist only while an entry names
// a card; emptying one deletes it, which is what makes it "open" again.
//
// Every tag, number and fallback here is balance (equipment.cardMounts). The
// model is deliberately free of engine imports so the content door, the
// composer and the smith services all read one normaliser.

export const MOUNT_KINDS = Object.freeze(['granted', 'weaponArt']);

const EXTRA_MOUNT_PREFIX = 'mount:';

/**
 * The one place a mount key is spelled. The composer mints instances with
 * these ids; the smith services address mounts by them; `run.itemMounts`
 * is keyed by them. Three readers, one spelling.
 */
export const mountKey = Object.freeze({
  bound: (ownerRef, cardId, index) => `bound:${ownerRef}:${cardId}:${index}`,
  granted: (weaponId, cardId, index) => `granted:${weaponId}:${cardId}:${index}`,
  weaponArt: (weaponId, artId) => `weaponArt:${weaponId}:${artId}`,
  extra: (ownerRef, index) => `${EXTRA_MOUNT_PREFIX}${ownerRef}:${index}`,
});

export function isExtraMountKey(key) {
  return typeof key === 'string' && key.startsWith(EXTRA_MOUNT_PREFIX);
}

/**
 * The item an instance rides with, as the namespaced ref the rest of the
 * model keys on (`armament/<id>`, `armor/<class>/<id>`). Null for a run-owned
 * card and for the empty hand's Dodge Roll, which no item owns. Package
 * instances write the bare armament id in `grantedBy` (a save-stable legacy
 * spelling); it is normalised here rather than at every reader.
 */
export function ownerItemRef(inst) {
  const by = inst && inst.grantedBy;
  if (typeof by !== 'string' || !by) return null;
  if (by.startsWith('unarmed:')) return null;
  return by.includes('/') ? by : `armament/${by}`;
}

// ---- rules -----------------------------------------------------------------

function ownObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || !value) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function stringList(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry)) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  return value;
}

function integer(value, label, { minimum = 0 } = {}) {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${label} must be an integer >= ${minimum}`);
  return value;
}

const ITEM_REF_RE = /^(armament\/[^/]+|armor\/[^/]+\/[^/]+)$/;

/**
 * A fallback names a card one of two ways: outright (`cardId`), or by the
 * unarmed profile whose base card it is (`unarmedProfile: 'technique'` is the
 * Dodge Roll, read from balance.equipment.unarmedProfiles rather than typed).
 * Exactly one of the two.
 */
function normalizeFallback(raw, label) {
  if (raw === null) return null;
  const src = ownObject(raw, label);
  const keys = Object.keys(src);
  if (keys.length !== 1 || !['cardId', 'unarmedProfile'].includes(keys[0])) {
    throw new Error(`${label} must name exactly one of cardId or unarmedProfile`);
  }
  return Object.freeze({ [keys[0]]: nonEmptyString(src[keys[0]], `${label}.${keys[0]}`) });
}

/**
 * The inert rules: nothing is extractable, an emptied mount shows nothing,
 * no extra mounts. What a bundle without the block gets, so a hand-built
 * fixture composes exactly as it did before mounts existed.
 */
export const INERT_CARD_MOUNT_RULES = Object.freeze({
  extractableTag: null,
  kinds: Object.freeze(Object.fromEntries(MOUNT_KINDS.map((kind) => [kind, Object.freeze({ accepts: Object.freeze([]), fallback: null })]))),
  fallbackByItem: Object.freeze({}),
  extraMounts: Object.freeze({ enabled: false, perItem: 0, kind: 'granted' }),
});

/** Validate and freeze balance.equipment.cardMounts. Throws by name. */
export function normalizeCardMountRules(raw) {
  const src = ownObject(raw, 'equipment.cardMounts');
  const extractableTag = nonEmptyString(src.extractableTag, 'equipment.cardMounts.extractableTag');
  const kindsRaw = ownObject(src.kinds, 'equipment.cardMounts.kinds');
  const kinds = {};
  for (const kind of MOUNT_KINDS) {
    const label = `equipment.cardMounts.kinds.${kind}`;
    const row = ownObject(kindsRaw[kind], label);
    kinds[kind] = Object.freeze({
      accepts: Object.freeze([...stringList(row.accepts, `${label}.accepts`)]),
      fallback: normalizeFallback(row.fallback === undefined ? null : row.fallback, `${label}.fallback`),
    });
  }
  for (const key of Object.keys(kindsRaw)) {
    if (!MOUNT_KINDS.includes(key)) throw new Error(`equipment.cardMounts.kinds.${key}: unknown mount kind (known: ${MOUNT_KINDS.join(', ')})`);
  }
  const byItemRaw = src.fallbackByItem === undefined ? {} : ownObject(src.fallbackByItem, 'equipment.cardMounts.fallbackByItem');
  const fallbackByItem = {};
  for (const [itemRef, perKind] of Object.entries(byItemRaw)) {
    if (!ITEM_REF_RE.test(itemRef)) throw new Error(`equipment.cardMounts.fallbackByItem.${itemRef}: not a namespaced item ref`);
    const rows = ownObject(perKind, `equipment.cardMounts.fallbackByItem.${itemRef}`);
    const out = {};
    for (const [kind, fallback] of Object.entries(rows)) {
      if (!MOUNT_KINDS.includes(kind)) throw new Error(`equipment.cardMounts.fallbackByItem.${itemRef}.${kind}: unknown mount kind`);
      out[kind] = normalizeFallback(fallback, `equipment.cardMounts.fallbackByItem.${itemRef}.${kind}`);
    }
    fallbackByItem[itemRef] = Object.freeze(out);
  }
  const extraRaw = ownObject(src.extraMounts, 'equipment.cardMounts.extraMounts');
  if (typeof extraRaw.enabled !== 'boolean') throw new Error('equipment.cardMounts.extraMounts.enabled must be boolean');
  const perItem = integer(extraRaw.perItem, 'equipment.cardMounts.extraMounts.perItem');
  if (!MOUNT_KINDS.includes(extraRaw.kind)) throw new Error(`equipment.cardMounts.extraMounts.kind must be one of ${MOUNT_KINDS.join(', ')}`);
  return Object.freeze({
    extractableTag,
    kinds: Object.freeze(kinds),
    fallbackByItem: Object.freeze(fallbackByItem),
    extraMounts: Object.freeze({ enabled: extraRaw.enabled, perItem, kind: extraRaw.kind }),
  });
}

/** The rules a registry carries, or the inert set when it authors none. */
export function cardMountRules(registries) {
  const raw = registries?.balance?.equipment?.cardMounts;
  return raw == null ? INERT_CARD_MOUNT_RULES : normalizeCardMountRules(raw);
}

/**
 * The card an EMPTIED mount shows: the item's own override when one is
 * authored, else its kind's. Null means the mount shows nothing.
 */
export function resolveFallbackCard(registries, rules, itemRef, kind) {
  const perItem = rules.fallbackByItem[itemRef];
  const fallback = perItem && Object.hasOwn(perItem, kind) ? perItem[kind] : (rules.kinds[kind] || {}).fallback;
  if (!fallback) return null;
  if (fallback.cardId) return fallback.cardId;
  const profileId = ((registries.balance || {}).equipment || {}).unarmedProfiles?.[fallback.unarmedProfile];
  const profile = ((registries.equipment || {}).basicCardProfiles || []).find((row) => row.id === profileId);
  return profile && profile.baseCardId ? profile.baseCardId : null;
}

/** The mount entries recorded for one item, or an empty object. */
export function itemMountEntries(run, itemRef) {
  const all = run && run.itemMounts;
  const entries = all && typeof all === 'object' ? all[itemRef] : null;
  return entries && typeof entries === 'object' ? entries : {};
}

/**
 * applyMountOverrides(registries, run, desired) -> desired'
 *
 * The composer mints what an item's authoring says it lends; this is where
 * what a smith has DONE to those mounts is applied. An emptied mount shows
 * its fallback or nothing; a refilled one shows the installed card. Ids are
 * kept — the mount is the same mount whatever sits in it — so the reconcile's
 * sweep and every save stay stable across an extraction.
 */
export function applyMountOverrides(registries, run, desired) {
  const rules = cardMountRules(registries);
  const out = [];
  for (const inst of desired) {
    const itemRef = ownerItemRef(inst);
    const entry = itemRef ? itemMountEntries(run, itemRef)[inst.instanceId] : null;
    if (!entry) { out.push(inst); continue; }
    if (entry.card) {
      out.push({ ...inst, cardId: entry.card, upgraded: entry.upgraded === true });
      continue;
    }
    const fallback = resolveFallbackCard(registries, rules, itemRef, inst.equipmentRole);
    if (fallback) out.push({ ...inst, cardId: fallback, upgraded: false });
  }
  return out;
}

/**
 * The extra-mount instances an item currently carries: one per recorded
 * `mount:` entry naming a card. The flag gates INSTALLING into an extra
 * mount, not showing one already filled — turning the flag off must not make
 * an installed card vanish from a saved run.
 */
export function extraMountInstances(registries, run, itemRef, { grantSource = null } = {}) {
  const rules = cardMountRules(registries);
  const out = [];
  for (const [key, entry] of Object.entries(itemMountEntries(run, itemRef))) {
    if (!isExtraMountKey(key) || !entry || !entry.card) continue;
    out.push({
      instanceId: key,
      cardId: entry.card,
      upgraded: entry.upgraded === true,
      equipmentRole: rules.extraMounts.kind,
      grantedBy: itemRef,
      ...(grantSource ? { grantSource } : {}),
    });
  }
  return out;
}

/** The next open extra-mount key for an item, or null when the flag or the cap says no. */
export function openExtraMountKey(registries, run, itemRef) {
  const rules = cardMountRules(registries);
  if (!rules.extraMounts.enabled) return null;
  const used = Object.entries(itemMountEntries(run, itemRef)).filter(([key, entry]) => isExtraMountKey(key) && entry && entry.card).length;
  if (used >= rules.extraMounts.perItem) return null;
  for (let index = 0; index < rules.extraMounts.perItem; index++) {
    const key = mountKey.extra(itemRef, index);
    const entry = itemMountEntries(run, itemRef)[key];
    if (!entry || !entry.card) return key;
  }
  return null;
}
