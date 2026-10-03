// tests/haptics.test.mjs — haptics on card play, damage taken and turn start,
// and the setting that turns them off (docs/FINISH.md, wave 13 "Haptics").
//
// The FINISH line's test, exactly: a stubbed `navigator.vibrate` records 0
// calls when the setting is off. The same stub records one call per cue when
// it is on (and when it was never set, because the default is on).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HAPTIC_PATTERNS, HAPTICS_DEFAULT_ON, hapticPatternIssues } from '../src/content/haptics.js';
import { createHaptics, hapticsEnabled } from '../src/ui/haptics.js';

// The three moments the FINISH line names, as the sfx cue ids that report them
// (combat.js plays 'cardPlay', ui/fx.js plays 'playerHurt' and 'turnStinger').
const NAMED = ['cardPlay', 'playerHurt', 'turnStinger'];

function stubNavigator() {
  const calls = [];
  const before = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, writable: true,
    value: { vibrate: (pattern) => { calls.push(pattern); return true; } },
  });
  const restore = () => {
    if (before) Object.defineProperty(globalThis, 'navigator', before);
    else delete globalThis.navigator;
  };
  return { calls, restore };
}

function fire(settings) {
  const stub = stubNavigator();
  try {
    const cue = createHaptics({ getSettings: () => settings });
    for (const id of [...NAMED, 'cardDraw', 'buy', 'toString']) cue(id);
    return stub.calls;
  } finally { stub.restore(); }
}

test('the pattern table is data and names card play, damage taken and turn start', () => {
  assert.deepEqual(hapticPatternIssues(), []);
  for (const id of NAMED) assert.ok(Array.isArray(HAPTIC_PATTERNS[id]), `${id} has a pattern`);
  assert.equal(HAPTICS_DEFAULT_ON, true, 'haptics default on');
});

test('the validator names a malformed pattern', () => {
  assert.ok(hapticPatternIssues({ cardPlay: [] }).length > 0);
  assert.ok(hapticPatternIssues({ cardPlay: [-5] }).length > 0);
  assert.ok(hapticPatternIssues({ cardPlay: ['x'] }).length > 0);
});

test('setting off: a stubbed navigator.vibrate records 0 calls', () => {
  assert.equal(fire({ haptics: false }).length, 0);
});

test('setting on (and unset, the default): one vibrate per named cue, with its pattern', () => {
  for (const settings of [{ haptics: true }, {}]) {
    const calls = fire(settings);
    assert.equal(calls.length, NAMED.length, 'cues without a pattern, and inherited keys, do not vibrate');
    assert.deepEqual(calls, NAMED.map((id) => HAPTIC_PATTERNS[id]));
  }
});

test('the setting is read live, and a missing navigator.vibrate is silent, not a throw', () => {
  const settings = { haptics: true };
  const stub = stubNavigator();
  try {
    const cue = createHaptics({ getSettings: () => settings });
    cue('cardPlay');
    settings.haptics = false;
    cue('cardPlay');
    assert.equal(stub.calls.length, 1);
    globalThis.navigator = {};
    settings.haptics = true;
    assert.equal(cue('cardPlay'), false);
  } finally { stub.restore(); }
  assert.equal(hapticsEnabled({ haptics: 'no' }), HAPTICS_DEFAULT_ON, 'a non-boolean store reads as the default');
});

test('Settings offers the switch once, under Audio, defaulting to the data value', async () => {
  const { settingsRow, settingOn, generalGroups } = await import('../src/ui/screens/settings.js');
  const row = settingsRow('haptics');
  assert.equal(row.cat, 'Audio');
  assert.equal(row.def, HAPTICS_DEFAULT_ON);
  assert.equal(settingOn({}, 'haptics'), hapticsEnabled({}), 'the row and the runtime agree on an unset key');
  assert.equal(settingOn({ haptics: false }, 'haptics'), false);
  assert.equal(generalGroups('Audio').get('Audio').filter((r) => r.key === 'haptics').length, 1);
});

test('main.js feeds every sfx cue to both the audio engine and the haptics cue', () => {
  // The wiring itself: without it the module above is never reached and the
  // game ships no haptics, while every other test here still passes.
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /import\s*\{\s*createHaptics\s*\}\s*from\s*'\.\/ui\/haptics\.js'/);
  const m = main.match(/const\s+(\w+)\s*=\s*createHaptics\(/);
  assert.ok(m, 'main.js creates the haptics cue');
  const sink = main.match(/sfx\.sink\s*=\s*\((\w+)\)\s*=>\s*\{([^}]*)\}/);
  assert.ok(sink, 'main.js sets sfx.sink');
  const [, arg, body] = sink;
  assert.match(body, new RegExp(`audio\\.sfx\\(${arg}\\)`), 'sfx.sink plays the sound');
  assert.match(body, new RegExp(`\\b${m[1]}\\(${arg}\\)`), 'sfx.sink fires the haptics cue');
});
