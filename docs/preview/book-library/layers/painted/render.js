// Authoring and gameplay use the same renderer and verified release assets.
// The nested authoring page resolves source asset IDs from the repository root.
import { renderBookArt as renderGameBookArt } from '../../../../../src/ui/components/bookArt.js';
const resolveAsset = (path) => new URL(`../../../../../${path}`, import.meta.url).href;
export const symbolUrl = (symbol) => resolveAsset(`assets/shop/painted/symbols/${symbol}.webp`);
export const renderBookArt = (def, options = {}) => renderGameBookArt(def, { ...options, resolveAsset });
