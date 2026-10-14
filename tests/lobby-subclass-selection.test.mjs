import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { mountLobby } from '../src/ui/screens/lobby.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const registries = createRegistries(contentBundle);

test('new lobby UI sends explicit subclass picks for remote and couch seats while old roster seats stay legacy', () => withKitDom(async dom => {
  const originalFetch = globalThis.fetch;
  const originalSocket = globalThis.WebSocket;
  const sockets = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    listeners = new Map();
    messages = [];
    constructor() { sockets.push(this); }
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    send(data) { this.messages.push(JSON.parse(data)); }
    close() {}
    receive(message) { this.listeners.get('message')({ data: JSON.stringify(message) }); }
  }
  globalThis.WebSocket = Socket;
  globalThis.fetch = async url => ({ ok: true, json: async () => url === '/api/lan/host'
    ? { port: 3333, addr: 'localhost', hostKey: 'test-key' }
    : { lan: true, hosts: [] } });
  const proto = Object.getPrototypeOf(dom.document.body);
  proto.replaceWith = function replaceWith(node) { this.before(node); this.remove(); };
  const app = dom.document.createElement('div');
  dom.document.body.append(app);
  try {
    mountLobby(app, { registries, defaultSeedString: 'GOLDBOUGH', onBack() {}, onStart() {} });
    app.querySelector('#lb-host').click();
    await new Promise(resolve => setImmediate(resolve));
    const socket = sockets[0];
    assert.ok(socket);
    socket.receive({ t: 'welcome', id: 'me' });
    assert.equal(socket.messages.at(-1).subclassId, 'heavyKnight');
    socket.receive({ t: 'roster', players: [
      { id: 'me', name: 'Host', classId: 'reaver', subclassId: 'heavyKnight', isHost: true },
      { id: 'old-client', name: 'Guest', classId: 'herald', ready: true },
    ] });
    assert.match(app.querySelector('[data-seat="me"] .as-status').textContent, /Heavy Knight/);
    assert.equal(app.querySelector('[data-seat="old-client"] .as-status').textContent, registries.classes.get('herald').name);
    app.querySelector('#lb-subclasses button[data-subclass="swordMaster"]').click();
    assert.equal(socket.messages.at(-1).subclassId, 'swordMaster');
    app.querySelector('#lb-classes [data-member="herald"]').click();
    assert.equal(socket.messages.at(-1).subclassId, 'cleric');
    assert.equal(app.querySelector('#lb-subclasses .cc-subclass-tile[aria-pressed="true"]').dataset.subclass, 'cleric');
    app.querySelector('#lb-addlocal').click();
    assert.equal(socket.messages.at(-1).locals[0].subclassId, 'battleMage');
    app.querySelector('#lb-locals button[data-subclass="frostMonarch"]').click();
    assert.equal(socket.messages.at(-1).locals[0].subclassId, 'frostMonarch');
    app.querySelector('#lb-locals .ll-class').click();
    assert.equal(socket.messages.at(-1).locals[0].subclassId, 'ranger', 'changing local base class replaces stale subclass');
    assert.equal(socket.messages.at(-1).locals[0].classId, 'rogue');
  } finally {
    app.querySelector('#lb-leave')?.click();
    globalThis.fetch = originalFetch;
    if (originalSocket === undefined) delete globalThis.WebSocket; else globalThis.WebSocket = originalSocket;
  }
}));
