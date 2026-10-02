// The call each pack file's `.js` twin makes, as tools/asset-pack.mjs writes
// it (`<call>("<id>", "<text>");`). The names are a file format the model reads,
// kept here so the model layer names no browser global (architecture-sync's
// "model has no DOM/storage references" check).
export const PACK_TWIN_CALL = 'window.__ashenPack';
export const FONT_TWIN_CALL = '__ashenFonts';
