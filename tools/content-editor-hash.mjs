// Hex digest of a file's text, matching the browser's WebCrypto digest (textHash.js).
import { createHash } from 'node:crypto';
import { CONTENT_API } from './content-editor-config.mjs';

const TEXT_ENCODING = 'utf8';
const HEX_DIGEST = 'hex';

export function TextHash(text)
{
    return createHash(CONTENT_API.hash.node).update(text, TEXT_ENCODING).digest(HEX_DIGEST);
}
