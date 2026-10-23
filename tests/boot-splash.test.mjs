// tests/boot-splash.test.mjs — the first-paint splash and the CSS comment strip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripCssComments } from '../tools/css-strip.mjs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('index.html carries the splash before the first stylesheet and the app script', () => {
  const style = index.indexOf('id="boot-splash-style"');
  const firstLink = index.indexOf('rel="stylesheet"');
  const el = index.indexOf('id="boot-splash"');
  const script = index.indexOf('<script');
  assert.ok(style > 0 && style < firstLink, 'splash style precedes the big stylesheets');
  assert.ok(el > index.indexOf('id="app"') && el < script, 'splash element sits after #app and before the script');
  assert.match(index, /#app:not\(:empty\)~#boot-splash\s*\{display:none\}/, 'hidden once #app has a child');
  assert.match(index, /prefers-reduced-motion:reduce/, 'pulse is disabled for reduced motion');
});

test('stripCssComments removes comments but keeps strings and urls', () => {
  assert.equal(stripCssComments('a{/* x */color:red}/* y\n z */b{}'), 'a{color:red}b{}');
  assert.equal(stripCssComments('a{content:"/* keep */"}'), 'a{content:"/* keep */"}');
  assert.equal(stripCssComments("a{content:'it\\'s /*'}"), "a{content:'it\\'s /*'}");
  assert.equal(stripCssComments('a{}/* unterminated'), 'a{}');
});
