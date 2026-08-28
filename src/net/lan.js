// src/net/lan.js — browser side of Forsaken Together (LAN play).
//
// Talks to the launcher's LAN layer (tools/lan.mjs): the game's OWN server
// answers /api/lan/* (discovery + hosting), and the lobby itself is a
// WebSocket to the HOST's server at ws://<host>:<port>/lan. When the game is
// opened without the launcher (file://, dist build), lanInfo() resolves null
// and the whole feature stays hidden.

/** null when no launcher server is behind the page (dist build / file://). */
export async function lanInfo() {
  try {
    const res = await fetch('/api/lan/info', { cache: 'no-store' });
    if (!res.ok) return null;
    const info = await res.json();
    return info && info.lan ? info : null;
  } catch {
    return null;
  }
}

/** Start hosting on this machine's launcher; returns { hostKey, addr, port }. */
export async function lanHost(name) {
  const res = await fetch('/api/lan/host', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`hosting failed (${res.status})`);
  return res.json();
}

export function lanUnhost() {
  return fetch('/api/lan/unhost', { method: 'POST' }).catch(() => {});
}

/**
 * Open the lobby socket to a host. Returns { send(obj), close() }.
 * onMessage(obj) per JSON message; onClose() once, on any disconnect.
 */
export function lanConnect({ addr, port, onMessage, onClose }) {
  const ws = new WebSocket(`ws://${addr}:${port}/lan`);
  let closed = false;
  let handler = onMessage;
  let closeHandler = onClose;
  const closeOnce = () => {
    if (closed) return;
    closed = true;
    if (closeHandler) closeHandler();
  };
  ws.addEventListener('message', (ev) => {
    try {
      if (handler) handler(JSON.parse(ev.data));
    } catch {
      /* non-JSON frame — ignored */
    }
  });
  ws.addEventListener('close', closeOnce);
  ws.addEventListener('error', closeOnce);
  return {
    send(obj) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
    },
    // The lobby opens the socket, then hands it to the run orchestrator —
    // swap handlers instead of reconnecting.
    setHandlers({ onMessage: m, onClose: c }) {
      if (m !== undefined) handler = m;
      if (c !== undefined) closeHandler = c;
    },
    close() {
      closed = true; // caller-initiated: suppress onClose
      try { ws.close(); } catch { /* already closed */ }
    },
    get open() {
      return ws.readyState === WebSocket.OPEN;
    },
  };
}
