// Stale-doc greps stay at zero hits. Each row below is a sentence that once
// restated a fact whose one home is elsewhere (a hand-counted test total, a
// release number, a cut status, the pre-rename project name) and went false
// without anybody editing it. The docs now point at the home instead; this
// file keeps the old wording from coming back.
//
// NOT checked: whether the remaining "M1 known deviations" rows are still true
// (Guilt, Warrior's Vow, Goreblood are checked by hand against src/content),
// any other doc in the repository, or stale numbers phrased differently from
// the patterns below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(root + file, 'utf8');

const BANNED = [
  // [file, pattern, why it is stale]
  ['DEVELOPER.md', /\(\d+ assertions, SPEC §8\)/, 'a hand-kept test count; SPEC §8 says the index is `grep -n "test(\'" tests/engine.test.js`'],
  ['DEVELOPER.md', /\*\*Frostbite\*\* is specced/, 'Frostbite is CUT (SPEC §4.4), not a deferred deviation'],
  ['docs/versioning.md', /currently `\d+\.\d+\.\d+/, 'the release triple lives only in src/content/index.js (contentBundle.version)'],
  ['LICENSE', /EldenSpire/, 'the project is AshenSpire'],
];

for (const [file, pattern, why] of BANNED) {
  test(`${file} has no ${pattern}`, () => {
    const hits = read(file).split('\n').map((line, i) => [i + 1, line]).filter(([, line]) => pattern.test(line));
    assert.deepEqual(hits, [], `${file}: ${why}`);
  });
}

test('the replacements point at the one home', () => {
  assert.match(read('DEVELOPER.md'), /grep -n "test\('" tests\/engine\.test\.js/);
  assert.match(read('docs/versioning.md').split('\n').slice(0, 8).join('\n'), /src\/content\/index\.js/);
  assert.match(read('LICENSE'), /AshenSpire contributors/);
});
