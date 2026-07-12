// tools/lan.mjs — zero-dependency LAN session layer ("Tarnished Together").
//
// Adds three things to the launcher's static server (tools/serve.mjs):
//   • UDP auto-discovery: a hosting machine broadcasts a beacon every 2s on
//     port 48711; every launcher listens and exposes what it hears at
//     GET /api/lan/info, so the game can list joinable fires with no typing.
//   • A hand-rolled RFC6455 WebSocket endpoint at /lan (text frames only —
//     lobby/status JSON is tiny, so no extensions, no fragmentation).
//   • A lobby session: players join, pick classes, ready up; the host picks
//     the seed and starts; afterwards clients relay run status ("party"
//     broadcasts) so everyone sees the whole party's progress.
//
// The single-file dist build has no server, so LAN play needs the launcher
// (run.bat / node tools/launch.mjs). Nothing here touches the game engine.

import { createSocket } from 'node:dgram';
import { createHash, randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';

const DISCOVERY_PORT = 48711;
const BEACON_MS = 2000;
const HOST_STALE_MS = 6500;
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** Best-guess LAN IPv4 of this machine (for "join at ..." display). */
export function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) return ni.address;
    }
  }
  return '127.0.0.1';
}

// ---- WebSocket primitives (server side: masked in, unmasked out) ------------

function wsAccept(key) {
  return createHash('sha1').update(key + WS_MAGIC).digest('base64');
}

function wsEncode(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

/** Parse complete frames out of `buf`; returns { frames, rest }. */
function wsDecode(buf) {
  const frames = [];
  let off = 0;
  while (buf.length - off >= 2) {
    const opcode = buf[off] & 0x0f;
    const masked = (buf[off + 1] & 0x80) !== 0;
    let len = buf[off + 1] & 0x7f;
    let p = off + 2;
    if (len === 126) {
      if (buf.length - p < 2) break;
      len = buf.readUInt16BE(p); p += 2;
    } else if (len === 127) {
      if (buf.length - p < 8) break;
      len = Number(buf.readBigUInt64BE(p)); p += 8;
    }
    const maskLen = masked ? 4 : 0;
    if (buf.length - p < maskLen + len) break;
    let payload = buf.subarray(p + maskLen, p + maskLen + len);
    if (masked) {
      const mask = buf.subarray(p, p + 4);
      const un = Buffer.alloc(len);
      for (let i = 0; i < len; i++) un[i] = payload[i] ^ mask[i % 4];
      payload = un;
    }
    frames.push({ opcode, payload });
    off = p + maskLen + len;
  }
  return { frames, rest: buf.subarray(off) };
}

// ---- the LAN layer -----------------------------------------------------------

/**
 * attachLan(server, { port }) → { handleHttp, close }
 * `port` is the HTTP port the game is served on (announced in beacons).
 */
export function attachLan(server, { port }) {
  const selfId = randomBytes(6).toString('hex');
  const discovered = new Map(); // id → { name, addr, port, seen }
  let hosting = null; // { name, hostKey, beaconTimer }
  let session = null; // { seedString, started, clients: Map<socket, player> }
  let nextPlayerId = 1;

  // -- discovery socket (always listening; beacons only while hosting) --------
  const udp = createSocket({ type: 'udp4', reuseAddr: true });
  udp.on('error', (e) => console.error(`lan: discovery socket error — ${e.message}`));
  udp.on('message', (msg, rinfo) => {
    try {
      const b = JSON.parse(msg.toString('utf8'));
      if (b.t !== 'eldenspire' || b.id === selfId) return;
      discovered.set(b.id, { name: b.name, addr: rinfo.address, port: b.port, seen: Date.now() });
    } catch { /* not ours */ }
  });
  udp.bind(DISCOVERY_PORT, () => {
    try { udp.setBroadcast(true); } catch { /* best-effort */ }
  });

  function sendBeacon() {
    const msg = Buffer.from(JSON.stringify({ t: 'eldenspire', id: selfId, name: hosting.name, port }));
    // Broadcast for the LAN, loopback so two launchers on one machine also see
    // each other (same-machine testing, split-screen households).
    for (const addr of ['255.255.255.255', '127.0.0.1']) {
      udp.send(msg, DISCOVERY_PORT, addr, () => {});
    }
  }

  function hostsAlive() {
    const now = Date.now();
    return [...discovered.values()]
      .filter((h) => now - h.seen < HOST_STALE_MS)
      .map(({ name, addr, port: p }) => ({ name, addr, port: p }));
  }

  // -- lobby session ------------------------------------------------------------
  function roster() {
    return [...session.clients.values()].map((pl) => ({
      id: pl.id, name: pl.name, classId: pl.classId, ready: pl.ready, isHost: pl.isHost,
    }));
  }

  function broadcast(obj) {
    const frame = wsEncode(JSON.stringify(obj));
    for (const sock of session.clients.keys()) sock.write(frame);
  }

  function partyStatus() {
    return [...session.clients.values()]
      .filter((pl) => pl.status)
      .map((pl) => ({ id: pl.id, name: pl.name, ...pl.status }));
  }

  function onLobbyMessage(sock, pl, msg) {
    switch (msg.t) {
      case 'hello':
        pl.name = String(msg.name || 'Tarnished').slice(0, 18);
        pl.classId = msg.classId || null;
        pl.isHost = !!(hosting && msg.hostKey === hosting.hostKey);
        broadcast({ t: 'roster', players: roster(), seedString: session.seedString });
        break;
      case 'pick':
        pl.classId = msg.classId;
        broadcast({ t: 'roster', players: roster(), seedString: session.seedString });
        break;
      case 'ready':
        pl.ready = !!msg.ready;
        broadcast({ t: 'roster', players: roster(), seedString: session.seedString });
        break;
      case 'seed':
        if (!pl.isHost) return;
        session.seedString = String(msg.seedString || '').slice(0, 10);
        broadcast({ t: 'roster', players: roster(), seedString: session.seedString });
        break;
      case 'start':
        if (!pl.isHost) return;
        session.started = true;
        broadcast({ t: 'start', seedString: session.seedString, players: roster() });
        break;
      case 'status':
        pl.status = {
          act: msg.act, floor: msg.floor, hp: msg.hp, maxHp: msg.maxHp,
          scene: msg.scene, dead: !!msg.dead, victory: !!msg.victory,
        };
        broadcast({ t: 'party', players: partyStatus() });
        break;
      default:
        break;
    }
  }

  server.on('upgrade', (req, sock) => {
    if (!(req.url || '').startsWith('/lan')) { sock.destroy(); return; }
    const key = req.headers['sec-websocket-key'];
    if (!key) { sock.destroy(); return; }
    sock.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${wsAccept(key)}\r\n\r\n`
    );
    if (!session) session = { seedString: '', started: false, clients: new Map() };
    const pl = { id: `p${nextPlayerId++}`, name: 'Tarnished', classId: null, ready: false, isHost: false, status: null };
    session.clients.set(sock, pl);
    sock.setNoDelay(true);
    sock.write(wsEncode(JSON.stringify({ t: 'welcome', id: pl.id })));

    let buf = Buffer.alloc(0);
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const { frames, rest } = wsDecode(buf);
      buf = rest;
      for (const f of frames) {
        if (f.opcode === 8) { sock.end(); return; }
        if (f.opcode === 9) { // ping → pong
          const pong = Buffer.concat([Buffer.from([0x8a, f.payload.length]), f.payload]);
          sock.write(pong);
          continue;
        }
        if (f.opcode !== 1) continue;
        try { onLobbyMessage(sock, pl, JSON.parse(f.payload.toString('utf8'))); } catch { /* bad msg */ }
      }
    });
    const drop = () => {
      if (!session || !session.clients.has(sock)) return;
      const wasHost = pl.isHost;
      session.clients.delete(sock);
      if (!session.clients.size) { session = null; return; }
      broadcast({ t: 'roster', players: roster(), seedString: session.seedString });
      broadcast({ t: 'party', players: partyStatus() });
      if (wasHost && !session.started) broadcast({ t: 'hostGone' });
    };
    sock.on('close', drop);
    sock.on('error', drop);
  });

  // -- HTTP API -------------------------------------------------------------------
  async function handleHttp(req, res) {
    const path = (req.url || '').split('?')[0];
    if (!path.startsWith('/api/lan/')) return false;
    const json = (code, obj) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(obj));
    };
    if (path === '/api/lan/info' && req.method === 'GET') {
      json(200, {
        lan: true,
        addr: lanAddress(),
        port,
        hosting: hosting ? { name: hosting.name } : null,
        hosts: hostsAlive(),
      });
      return true;
    }
    if (path === '/api/lan/host' && req.method === 'POST') {
      let body = '';
      req.on('data', (d) => (body += d));
      await new Promise((r) => req.on('end', r));
      let name = 'Tarnished';
      try { name = String(JSON.parse(body || '{}').name || name).slice(0, 18); } catch { /* default */ }
      if (hosting) clearInterval(hosting.beaconTimer);
      hosting = { name, hostKey: randomBytes(8).toString('hex'), beaconTimer: null };
      hosting.beaconTimer = setInterval(sendBeacon, BEACON_MS);
      sendBeacon();
      json(200, { hostKey: hosting.hostKey, addr: lanAddress(), port });
      return true;
    }
    if (path === '/api/lan/unhost' && req.method === 'POST') {
      if (hosting) { clearInterval(hosting.beaconTimer); hosting = null; }
      json(200, { ok: true });
      return true;
    }
    json(404, { error: 'unknown lan endpoint' });
    return true;
  }

  function close() {
    if (hosting) clearInterval(hosting.beaconTimer);
    try { udp.close(); } catch { /* already closed */ }
  }

  return { handleHttp, close };
}
