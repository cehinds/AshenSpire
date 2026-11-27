// Hex digest of a text with WebCrypto, matching node's createHash digest of the same text.
const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;
const ZERO = '0';

function toHex(byte)
{
    return byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, ZERO);
}

/** The `algorithm` (a WebCrypto name such as SHA-256) digest of `text` as lowercase hex. */
export async function TextHash(text, algorithm)
{
    const bytes = new TextEncoder().encode(text);
    const digest = new Uint8Array(await crypto.subtle.digest(algorithm, bytes));
    return [...digest].map(toHex).join('');
}
