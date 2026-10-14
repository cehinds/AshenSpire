// workbench/lib/gate.mjs — the local-only request gate the studios share.
//
// A loopback tool server answers its own page and nothing else:
//   * the Host header must be one of `hosts` (DNS rebinding cannot pass),
//   * an Origin header, when present, must be one of `origins`,
//   * a browser-declared cross-site fetch is refused,
//   * every API call but the session handshake carries the session token,
//     in the `x-studio-token` header (or `?token=` where a header cannot be
//     set, e.g. EventSource — opt in per path with `queryTokenPaths`).
// The token is minted per process, so a page from an earlier run must reload.
import { randomBytes, timingSafeEqual } from 'node:crypto';

export const TOKEN_HEADER = 'x-studio-token';
export const newToken = () => randomBytes(32).toString('hex');

function sameToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * createGate({ token, hosts, origins, open, queryTokenPaths }) → check(req, url)
 * `hosts` and `origins` may be arrays or functions returning arrays (a port
 * picked at listen time). `open` lists API paths that need no token. check()
 * returns null when the request may proceed, else { status, error }.
 */
export function createGate({ token, hosts, origins, open = [], queryTokenPaths = [] }) {
  const list = (v) => (typeof v === 'function' ? v() : v) || [];
  return function check(req, url) {
    if (!list(hosts).includes(req.headers.host)) return { status: 403, error: 'Use the local address' };
    if (req.headers.origin && !list(origins).includes(req.headers.origin)) return { status: 403, error: 'Cross-origin request refused' };
    if (req.headers['sec-fetch-site'] === 'cross-site') return { status: 403, error: 'Cross-site request refused' };
    if (open.includes(url.pathname)) return null;
    const presented = req.headers[TOKEN_HEADER] || (queryTokenPaths.includes(url.pathname) ? url.searchParams.get('token') : null);
    if (!sameToken(presented, token)) return { status: 403, error: 'Reload the page to reconnect' };
    return null;
  };
}
