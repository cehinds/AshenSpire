import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFeaturePreview, removeFeaturePreview, START, END } from '../tools/feature-preview.mjs';

const release = '\n\nAI acknowledgement\n<!-- readme-sync:channels -->\nRelease badge\n<!-- /readme-sync:channels -->\n## Screenshots\n![Release](docs/preview/releases/version/creation.png)\n';
const prefix = '# AshenSpire\n\n';
const block = `${START}\n## Feature preview\n[Play](https://example.com/branches/feature/latest/)\n${END}`;

test('removal preserves release gallery, disclosure and readme-sync bytes exactly', () => {
  assert.equal(removeFeaturePreview(prefix + block + release), prefix + release);
  assert.equal(removeFeaturePreview(prefix + release), prefix + release);
});

test('malformed markers are rejected before removal', () => {
  for (const malformed of [START, END, END + START, START + START + END, START + END + END]) {
    assert.throws(() => removeFeaturePreview(prefix + malformed + release), /marker/i);
    assert.throws(() => checkFeaturePreview(prefix + malformed + release), /marker/i);
  }
});

test('check requires a block directly after the title', () => {
  assert.doesNotThrow(() => checkFeaturePreview(prefix + block + release));
  assert.doesNotThrow(() => checkFeaturePreview((prefix + block + release).replaceAll('\n', '\r\n')));
  assert.throws(() => checkFeaturePreview(prefix + release), /missing/);
  assert.throws(() => checkFeaturePreview(prefix + 'Intro\n' + block + release), /directly after/);
});
