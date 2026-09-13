import { wireframeUi } from '../../content/wireframeUi.js';

// WCI0 identity and artwork. The nameplate (WCI1), the contained artwork
// (WCI2) and the metadata band (WCI3) are parts an owner composes only where
// its contract gives them a slot. This model holds the rules those parts
// share; the values come from the live owner (a card def, a combatant, the
// run's deck), never from here.

export const IDENTITY_PARTS = Object.freeze(['name', 'artwork', 'metadata']);
export const METADATA_KINDS = Object.freeze(['rarity', 'owned']);
const METADATA_SLOTS = Object.freeze(['start', 'end']);
const ANCHORS = Object.freeze(['center', 'bottom']);

// WCI3: each configured slot holds one kind of metadata. A kind the owner
// cannot state is absent (null), never a blank label or an invented zero.
export function metadataFooter({ rarity = null, owned = null } = {}, config = wireframeUi.identity) {
  const slots = config.metadataSlots || {};
  for (const slot of METADATA_SLOTS) {
    if (!METADATA_KINDS.includes(slots[slot])) {
      throw new Error(`identity: metadata slot '${slot}' needs one of ${METADATA_KINDS.join(', ')}`);
    }
  }
  if (slots.start === slots.end) throw new Error(`identity: metadata slots cannot both hold '${slots.start}'`);
  const values = {
    rarity: typeof rarity === 'string' && rarity.trim() ? rarity.trim() : null,
    owned: Number.isInteger(owned) && owned >= 0 ? owned : null,
  };
  const entry = (kind) => (values[kind] == null ? null : Object.freeze({ kind, value: values[kind] }));
  return Object.freeze({ start: entry(slots.start), end: entry(slots.end) });
}

// WCI2: where contained artwork sits inside the bounds its owner allocates.
// It always keeps its intrinsic ratio; the anchor only says where the spare
// room goes (around it, or above it so the figure stands on the baseline).
export function artworkAnchor(host, config = wireframeUi.identity) {
  const anchor = config.artworkAnchorByHost?.[host];
  if (anchor === undefined) throw new Error(`Unknown artwork host '${host}'`);
  if (!ANCHORS.includes(anchor)) throw new Error(`identity: ${host} artwork anchor must be one of ${ANCHORS.join(', ')}`);
  return anchor;
}
