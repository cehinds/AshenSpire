import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { uiConfig } from '../src/config/generated/ui.js';

// Co-op stays parked while the shared title exposes only the current solo flow.
test('co-op is parked in both configuration and the title menu', () => {
  assert.equal(uiConfig.screens.title.behavior.coopEnabled, false);
  const title = readFileSync(new URL('../src/ui/screens/title.js', import.meta.url), 'utf8');
  assert.doesNotMatch(title, /entry\('Forsaken Together'/);
});
