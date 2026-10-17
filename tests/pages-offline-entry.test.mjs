import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../tools/pages-offline.mjs', import.meta.url), 'utf8');
const start = source.indexOf('async function openDownloads(');
const end = source.indexOf('\nlet server =', start);
const openDownloads = runInNewContext('(' + source.slice(start, end).trim() + ')');

test('offline UI entry completes a trusted press and waits for title before opening downloads', async () => {
  const events = [];
  await openDownloads({
    sessionId: 'page',
    until: async expression => { events.push(expression.includes('startup-gate') ? 'gate' : expression.includes('settings-download') ? 'settings-ready' : 'title'); return true; },
    cdp: { send: async (method, params, session) => { assert.equal(method, 'Input.dispatchKeyEvent'); assert.equal(session, 'page'); events.push(params.type + ':' + params.key); } },
    ev: async expression => { assert.match(expression, /#settings/); events.push(expression.includes('settings-download') ? 'downloads' : 'settings'); },
  });
  assert.deepEqual(events, ['gate', 'keyDown:Enter', 'keyUp:Enter', 'title', 'settings', 'settings-ready', 'downloads']);
});

test('a missing title is an explicit startup failure and never a null button click', async () => {
  let checks = 0, clicked = false;
  await assert.rejects(openDownloads({
    cdp: { send: async () => {} }, sessionId: 'page',
    until: async () => ++checks === 1,
    ev: async () => { clicked = true; },
  }), /startup activation did not reveal title Settings/);
  assert.equal(clicked, false);
});
