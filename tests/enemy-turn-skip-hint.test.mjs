// While the enemies act, a small hint says a press skips their playback (ui/fx.js skip on pointerdown), and it is gone
// when the hand is playable again (the combat screen's data-turn leaves 'enemy').
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { t } from '../src/ui/strings.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the skip hint is a string-table row shown only while the turn is the enemies\'', () => {
  assert.equal(t('combat.skipHint'), 'Tap to skip');
  assert.match(read('../src/ui/screens/combat.js'), /<div class="turn-skip-hint" aria-hidden="true">\$\{t\('combat\.skipHint'\)\}<\/div>/);
  const css = read('../styles/combat.css');
  assert.match(css, /\.turn-skip-hint \{[^}]*opacity: 0;/s, 'hidden by default');
  assert.match(css, /\[data-turn='enemy'\] \.turn-skip-hint \{ opacity: \.8; \}/, 'visible only on the enemies\' turn');
});
