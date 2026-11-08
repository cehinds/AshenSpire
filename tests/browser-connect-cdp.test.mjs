// tests/browser-connect-cdp.test.mjs — connectCdp in tools/browser.mjs is the one
// CDP client the browser tools share (CODE-REVIEW-DEV-2026-11-06 H5).
//   node --test tests/browser-connect-cdp.test.mjs
//
// No browser: a fake WebSocket class is injected through `WebSocketImpl`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectCdp } from '../tools/browser.mjs';

class FakeSocket {
  static last = null;
  constructor(url) {
    this.url = url; this.sent = []; this.listeners = {}; this.readyState = 0;
    FakeSocket.last = this;
  }
  addEventListener(type, fn, opts) { (this.listeners[type] ||= []).push({ fn, once: !!opts?.once }); }
  emit(type, event = {}) {
    const list = this.listeners[type] || [];
    this.listeners[type] = list.filter((l) => !l.once);
    for (const l of list) l.fn(event);
  }
  open() { this.readyState = 1; this.emit('open'); }
  send(data) { this.sent.push(JSON.parse(data)); }
  reply(message) { this.emit('message', { data: JSON.stringify(message) }); }
  close() { this.readyState = 3; this.emit('close'); }
}

const connect = async (options = {}) => {
  const cdp = connectCdp('ws://fake/devtools', { WebSocketImpl: FakeSocket, ...options });
  const socket = FakeSocket.last;
  socket.open();
  await cdp.ready;
  return { cdp, socket };
};

test('each call gets its own id and its own answer, in any order', async () => {
  const { cdp, socket } = await connect();
  const a = cdp.send('Page.enable');
  const b = cdp.send('Runtime.evaluate', { expression: '1' });
  assert.deepEqual(socket.sent.map((m) => [m.id, m.method]), [[1, 'Page.enable'], [2, 'Runtime.evaluate']]);
  assert.deepEqual(socket.sent[0].params, {});
  socket.reply({ id: 2, result: { value: 'second' } });
  socket.reply({ id: 1, result: { value: 'first' } });
  assert.deepEqual(await a, { value: 'first' });
  assert.deepEqual(await b, { value: 'second' });
});

test('an error response rejects that call only, with the message and code', async () => {
  const { cdp, socket } = await connect();
  const bad = cdp.send('Nope');
  const good = cdp.send('Page.enable');
  socket.reply({ id: 1, error: { code: -32601, message: "'Nope' wasn't found" } });
  socket.reply({ id: 2, result: {} });
  await assert.rejects(bad, (e) => e.message === "'Nope' wasn't found" && e.code === -32601 && !e.cdp);
  assert.deepEqual(await good, {});
});

test('sessionId is sent only when given', async () => {
  const { cdp, socket } = await connect();
  cdp.send('A'); cdp.send('B', { x: 1 }, 'sess-1');
  assert.equal('sessionId' in socket.sent[0], false);
  assert.equal(socket.sent[1].sessionId, 'sess-1');
  assert.deepEqual(socket.sent[1].params, { x: 1 });
});

test('events dispatch by method, to every listener, with the session id', async () => {
  const { cdp, socket } = await connect();
  const seen = []; const all = [];
  const off = cdp.on('Runtime.exceptionThrown', (params, sessionId) => seen.push([params.n, sessionId]));
  cdp.on('Runtime.exceptionThrown', (params) => seen.push(['second', params.n]));
  cdp.onEvent((m) => all.push(m.method));
  socket.reply({ method: 'Runtime.exceptionThrown', params: { n: 1 }, sessionId: 's' });
  socket.reply({ method: 'Page.loadEventFired', params: {} });
  off();
  socket.reply({ method: 'Runtime.exceptionThrown', params: { n: 2 } });
  assert.deepEqual(seen, [[1, 's'], ['second', 1], ['second', 2]]);
  assert.deepEqual(all, ['Runtime.exceptionThrown', 'Page.loadEventFired', 'Runtime.exceptionThrown']);
});

test('once resolves on the first event the predicate accepts', async () => {
  const { cdp, socket } = await connect();
  const got = cdp.once('Page.frameNavigated', (p) => p.url === 'b');
  socket.reply({ method: 'Page.frameNavigated', params: { url: 'a' } });
  socket.reply({ method: 'Page.frameNavigated', params: { url: 'b' } });
  assert.deepEqual(await got, { url: 'b' });
});

test('closing the socket rejects every call in flight, and later calls at once', async () => {
  const { cdp, socket } = await connect();
  const inflight = cdp.send('Runtime.evaluate');
  const waiting = cdp.once('Never');
  socket.close();
  await assert.rejects(inflight, (e) => e.cdp === true && /closed/.test(e.message));
  await assert.rejects(waiting, (e) => e.cdp === true);
  await assert.rejects(cdp.send('Page.enable'), (e) => e.cdp === true && /was not sent/.test(e.message));
});

test('a socket error after open rejects calls in flight', async () => {
  const { cdp, socket } = await connect();
  const inflight = cdp.send('X');
  socket.emit('error', { message: 'boom' });
  await assert.rejects(inflight, (e) => e.cdp === true && /boom/.test(e.message));
});

test('ready rejects if the socket closes before it opens', async () => {
  const cdp = connectCdp('ws://fake', { WebSocketImpl: FakeSocket });
  FakeSocket.last.close();
  await assert.rejects(cdp.ready, (e) => e.cdp === true && /before it opened/.test(e.message));
});

test('a call past its deadline rejects as a transport error, and a late answer is ignored', async () => {
  const { cdp, socket } = await connect({ timeoutMs: (method) => (method === 'Slow' ? 20 : 0) });
  const keepAlive = setTimeout(() => {}, 1000); // the call's own deadline timer is unref'd by design
  const slow = cdp.send('Slow');
  const unbounded = cdp.send('Fast');
  await assert.rejects(slow, (e) => e.cdp === true && /did not answer within 20 ms/.test(e.message));
  socket.reply({ id: 1, result: {} });
  socket.reply({ id: 2, result: { ok: true } });
  assert.deepEqual(await unbounded, { ok: true });
  clearTimeout(keepAlive);
});

test('close() settles pending calls and closes the socket', async () => {
  const { cdp, socket } = await connect();
  const inflight = cdp.send('X');
  cdp.close();
  await assert.rejects(inflight, (e) => e.cdp === true);
  assert.equal(socket.readyState, 3);
  assert.equal(cdp.ws, socket);
});
