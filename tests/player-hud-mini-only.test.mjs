import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { targetHudDesiredIds, targetHudTintIds, targetHudPinnedIds, targetHudPinnedOnly } from '../src/ui/models/TargetHudModel.js';

// Owner 2026-11-07: "Disable select HUD and just do mini HUD ... Bring back the player's health bar and disable the mini select HUD."
const entries = [{ id: 'player', role: 'player' }, { id: 'e1', role: 'enemy' }, { id: 'e2', role: 'enemy' }];

test('the player is never pinned and never gets a selected panel', () => {
  assert.deepEqual(targetHudPinnedIds(entries), []);
  assert.equal(targetHudPinnedOnly({ entries, id: 'player' }), false);
  assert.deepEqual(targetHudDesiredIds({ entries }), []);
  assert.ok(!targetHudDesiredIds({ entries, eligible: ['player'], focused: 'player', hover: 'player', focusWithin: 'player' }).includes('player'));
});

test('no selected panel opens for any combatant (owner 2026-11-07)', () => {
  for (const input of [{ eligible: ['e1'] }, { eligible: ['player', 'e1'], focused: 'e2' }, { hover: 'e1', focusWithin: 'e2' }, { eligible: ['gone'] }])
    assert.deepEqual(targetHudDesiredIds({ entries, ...input }), []);
});

test('the rules accept a one-shot iterator (Map.values) as the mount passes it', () => {
  const map = new Map(entries.map(entry => [entry.id, entry]));
  assert.deepEqual(targetHudDesiredIds({ entries: map.values(), eligible: ['e1'] }), []);
  assert.deepEqual(targetHudTintIds({ entries: map.values(), shown: ['e2'], focused: 'e2' }), ['e2']);
});

test('nothing hides the player overhead mini HUD', () => {
  const css = ['combat.css', 'combat-target-responsive.css', 'combat-layers.css'].map(f => readFileSync(new URL(`../styles/${f}`, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(css, /data-hud-pinned/, 'no pinned-player state remains');
  const rules = css.split('}').filter(r => /\.player\b/.test(r) && /overhead-meters|combatant-mini-hud/.test(r.split('{')[0]) && /visibility\s*:\s*hidden|display\s*:\s*none/.test(r));
  for (const r of rules) assert.match(r.split('{')[0], /\.m-track|\.nm|resource|\.m-label|\.m-plate|\.m-well|\.engraved-icon|context-selected|selected-target/, `unexpected player mini HUD hide: ${r.trim()}`);
  const js = readFileSync(new URL('../src/ui/components/combatTargetHud.js', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /hudPinned/);
});

test('the HUD meter plan always carries the Poise bar (an empty trough at 0/0); the inspect panel still lists Poise', () => {
  const js = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /bar\.id !== 'poise' && !stackHidden/, 'meterInputs no longer filters poise out of the plan');
  assert.match(js, /!stackHidden\.has\(bar\.id\) && \(!expanded \|\| bar\.id === 'hp' \|\| bar\.id === 'poise'\)/, 'the expanded rules keep HP and Poise');
  assert.match(js, /if \(!plan\.some\(\(bar\) => bar\.id === 'poise'\)\)/, 'meterInputs adds an empty Poise bar when the entity has no meter');
  assert.match(js, /label: 'Poise', value: v\.poiseMeter/, 'combatantSubject resources keep Poise');
});

test('inspect is the existing figure-hold / mini-HUD-click door only; the target HUD adds no second gesture', () => {
  const hud = readFileSync(new URL('../src/ui/components/combatTargetHud.js', import.meta.url), 'utf8');
  assert.doesNotMatch(hud, /figureHold/);
  const js = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(js, /openCombatantDoor\(combatantSubject\(/);
  assert.match(js, /closest\('\.combatant-mini-hud, \.meters'\)/);
});
