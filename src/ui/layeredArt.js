import { assetUrl } from './assetmap.js';
/* LAYERED_ART_START */
const layeredArtMap = {};
/* LAYERED_ART_END */
// Served source uses ordinary paths; portable builds inject the same reviewed
// exports, and web builds resolve them through the common content-addressed pack.
export const layeredArtUrl = path => layeredArtMap[path] || assetUrl(path);
