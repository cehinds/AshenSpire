import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { uiConfig } from '../src/config/generated/ui.js';

// Owner (2026-10-12): co-op is parked. The title menu hides Forsaken Together
// while content/config/ui/screens/title.json behavior.coopEnabled is false.
test('co-op is parked: the title menu offers Forsaken Together only when the flag is on', () => {
  assert.equal(uiConfig.screens.title.behavior.coopEnabled, false);
  const title = readFileSync(new URL('../src/ui/screens/title.js', import.meta.url), 'utf8');
  assert.match(title, /onLan && uiConfig\.screens\.title\.behavior\.coopEnabled \? \[entry\('Forsaken Together', 'lan', \{ id: 'lan-play' \}\)\] : \[\]/);
});
