import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('only combat clamps the scenery floor; dialogue keeps its own floor line', () => {
  const art = read('../src/ui/alternativeArt.js');
  assert.match(art, /fitAlternativeBackdrop\(combat, \{[^}]*coverFloor = false \}\)/, 'the clamp is opt-in');
  assert.match(art, /const cameraGround = coverFloor\s*\?/);
  const stage = read('../src/ui/components/battlefieldStage.js');
  const combatCall = stage.slice(stage.indexOf('fitAlternativeBackdrop(combat, {'), stage.indexOf('});', stage.indexOf('fitAlternativeBackdrop(combat, {')));
  assert.match(combatCall, /coverFloor: true/);
  const dialogue = read('../src/ui/components/dialogueStage.js');
  const at = dialogue.indexOf('fitAlternativeBackdrop(wrap, {');
  assert.ok(at >= 0);
  assert.doesNotMatch(dialogue.slice(at, dialogue.indexOf('});', at)), /coverFloor/, 'dialogue honours its 60% floor split');
});
