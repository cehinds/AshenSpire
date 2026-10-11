// node --test workbench/tests/tool-restart.test.mjs — a child tool's start time in the Workbench
// tools listing: the Entity Browser uses it to tell a restarted game from the one it drew.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Tool } from '../core/tools.mjs';
import { toolCameUp } from '../ui/logic.mjs';

test('the tools listing carries the start time of a tool the Workbench spawned', () => {
  const tool = new Tool({ id: 'game', name: 'Game', blurb: '', host: '127.0.0.1', path: '/', port: 4320 }, { root: '/x', origin: 'http://localhost' });
  assert.equal(tool.toJSON().startedAt, null, 'not started: no start time');
  tool.startedAt = 1234;
  assert.equal(tool.toJSON().startedAt, 1234);
});

test('a tool that comes up, or starts again, is reported once per start; other changes are not', () => {
  const listing = (status, startedAt) => [{ id: 'editor', status: 'up', startedAt: 1 }, { id: 'game', status, startedAt }];
  assert.equal(toolCameUp(listing('down', 1000), listing('up', 1000), 'game'), true, 'down to up');
  assert.equal(toolCameUp(listing('starting', 1000), listing('up', 1000), 'game'), true, 'starting to up');
  assert.equal(toolCameUp(listing('up', 1000), listing('up', 2000), 'game'), true, 'up again with a new start');
  assert.equal(toolCameUp(listing('up', 1000), listing('up', 1000), 'game'), false, 'still the same server');
  assert.equal(toolCameUp(listing('up', 1000), listing('down', 1000), 'game'), false, 'up to down is not a start');
  assert.equal(toolCameUp([], listing('up', 1000), 'game'), false, 'no earlier listing to compare');
  assert.equal(toolCameUp(listing('down', 1000), listing('up', 1000), 'missing'), false, 'an unknown tool');
});
