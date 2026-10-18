import path from 'node:path';
import {fileURLToPath} from 'node:url';
// The art repository and game checkout are siblings unless explicitly configured.
export const gameDirectory=path.resolve(process.env.ASHENSPIRE_DIR || fileURLToPath(new URL('../../../AshenSpire/',import.meta.url)));
export const gameAsset=relative=>path.resolve(gameDirectory,relative);
