// node --test workbench/tests/tool-restart.test.mjs — a child tool's start time in the Workbench
// tools listing: the Entity Browser uses it to tell a restarted game from the one it drew.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Tool } from '../core/tools.mjs';

test('the tools listing carries the start time of a tool the Workbench spawned', () => {
  const tool = new Tool({ id: 'game', name: 'Game', blurb: '', host: '127.0.0.1', path: '/', port: 4320 }, { root: '/x', origin: 'http://localhost' });
  assert.equal(tool.toJSON().startedAt, null, 'not started: no start time');
  tool.startedAt = 1234;
  assert.equal(tool.toJSON().startedAt, 1234);
});
