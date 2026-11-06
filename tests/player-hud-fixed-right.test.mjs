// The player mini HUD stands directly right of the figure, level with its upper body, placed once per layout
// pass (owner, 2026-11-06: "keep it fixed right of player"). Later calls (pose tracking, selection, enemy
// panels) leave it where it is; only a new layout pass moves it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the stage places the player HUD from the figure once per layout pass', () => {
  const source = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  const begin = source.indexOf('  function placePlayerHud('), end = source.indexOf('  function trackPlayerHud()', begin);
  assert.ok(begin >= 0 && end > begin);
  const body = source.slice(begin, end);
  assert.match(body, /player\.hudEpoch === layoutEpoch\)\) return;/, 'a call in the same pass places nothing');
  assert.match(body, /staticLeft = [^;]*art\.right/, 'the HUD stands right of the art');
  assert.match(body, /art\.top \+ 0\.3 \* \(art\.bottom - art\.top\)/, 'level with the upper body');
  assert.doesNotMatch(body, /playerDetailsPlacement\(|previous:/, 'no avoid/previous-position relocation');
});
test('the layout epoch advances only on a real layout pass', () => {
  const source = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  assert.equal((source.match(/layoutEpoch\+\+/g) || []).length, 1);
  assert.doesNotMatch(source, /addEventListener\('handlayoutchange'/);
});
