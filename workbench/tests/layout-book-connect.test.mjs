// node --test workbench/tests/layout-book-connect.test.mjs — Layout Studio's Book recipes view
// finds the game's render page again after a restart or a content rebuild. The plan is pure
// (book-model.mjs connectPlan, the same shape as Motion's); the view's subscription is checked
// at source level, since this suite runs without a DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as B from '../modules/layout/book-model.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = 'http://127.0.0.1:4320/';
const ORIGIN = 'http://127.0.0.1:4320';

test('no game server is a setup state, whatever else is known', () => {
  assert.equal(B.connectPlan({ base: null, ready: true, currentOrigin: ORIGIN }), 'setup');
});

test('a ready frame on the same server is kept, and nothing is reloaded', () => {
  assert.equal(B.connectPlan({ base: BASE, currentOrigin: ORIGIN, ready: true, serverId: 7, currentServerId: 7 }), 'keep');
});

test('a first connect, or a frame that is not ready, loads the page', () => {
  assert.equal(B.connectPlan({ base: BASE }), 'load');
  assert.equal(B.connectPlan({ base: BASE, currentOrigin: ORIGIN, ready: false }), 'load');
});

test('a restarted game (new start time, same origin) is a new server, so the frame reloads', () => {
  assert.equal(B.connectPlan({ base: BASE, currentOrigin: ORIGIN, ready: true, serverId: 8, currentServerId: 7 }), 'load');
});

test('a forced reload (a content rebuild) always loads', () => {
  assert.equal(B.connectPlan({ base: BASE, currentOrigin: ORIGIN, ready: true, force: true, serverId: 7, currentServerId: 7 }), 'load');
});

test('the start time comes from the game tool, and a missing one is null', () => {
  assert.equal(B.gameStartOf([{ id: 'game', status: 'up', url: BASE, startedAt: 42 }]), 42);
  assert.equal(B.gameStartOf([{ id: 'game', status: 'down' }]), null);
  assert.equal(B.gameStartOf([]), null);
});

test('a nonce gives the render page a new URL, and no nonce keeps the old one', () => {
  assert.equal(B.renderUrl(BASE, { parentOrigin: 'http://127.0.0.1:4300', nonce: 3 }),
    'http://127.0.0.1:4320/workbench/modules/layout/book-render.html?po=http%3A%2F%2F127.0.0.1%3A4300&r=3');
  assert.equal(B.renderUrl(BASE), 'http://127.0.0.1:4320/workbench/modules/layout/book-render.html');
});

test('the view subscribes to the host reload notices while shown, and unsubscribes on hide', () => {
  const src = readFileSync(join(ROOT, 'workbench/modules/layout/book-view.mjs'), 'utf8');
  // A content rebuild forces the frame; a game start only reloads when the plan says the server changed.
  assert.match(src, /offReload = host\.onReload\(\(ev\) => \{ connect\(\{ force: ev\?\.kind === 'reload' \}\); \}\);/);
  assert.match(src, /function unsubscribe\(\) \{ if \(offReload\) \{ offReload\(\); offReload = null; \} \}/);
  assert.match(src, /hide\(\) \{ unsubscribe\(\); \}/);
  assert.match(src, /show\(\) \{\s*subscribe\(\);/);
  assert.match(src, /K\.connectPlan\(/);
});
