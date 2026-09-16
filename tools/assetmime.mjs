// tools/assetmime.mjs — which files under assets/ are shippable art, and as what.
//
// ONE HOME, BECAUSE THE SECOND COPY IS THE BUG. tools/bundle.mjs decides what to
// inline (single file) or copy (external art) by this table, and
// tools/verify-external.mjs decides what MUST be present beside a de-inlined
// build by the same table. Those two answers have to be the same answer: a gate
// that re-derives "shippable" from its own list passes the day the lists drift,
// which is the shape of the art-less-build bug bundle.mjs's header describes.
//
// Audio is listed before any audio exists, deliberately — see the note in
// bundle.mjs. The sweep skips unknown extensions and says so loudly; the first
// .ogg anyone adds must not be dropped in silence.
export const MIME = {
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.m4a': 'audio/mp4', '.woff2': 'font/woff2',
};

/** True when this extension is art the build ships. */
export function shippable(ext) {
  return Object.prototype.hasOwnProperty.call(MIME, ext.toLowerCase());
}

// Authoring-only layered equipment experiments. Runtime figures use the
// reviewed outfits/poses instead. Keep these sources in git, outside payloads.
export function runtimeAsset(path) {
  return !path.replace(/\\/g, '/').startsWith('equipment/components/');
}
