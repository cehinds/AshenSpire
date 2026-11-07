// R12 (FixCoreAlign): HUD icons keep their aspect ratio. The overhead Poise/Ward badge is a square box
// (width == height), and the illustrated HUD icon is an svg viewBox crop that never stretches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const target = readFileSync(new URL('../styles/combat-target-responsive.css', import.meta.url), 'utf8');
const polish = readFileSync(new URL('../styles/player-polish.css', import.meta.url), 'utf8');
const meta = readFileSync(new URL('../src/ui/components/hudmeta.js', import.meta.url), 'utf8');

test('overhead Poise/Ward badge is square: equal width and height, aspect-ratio 1, no min-width stretch', () => {
  const rule = target.match(/\.target-hud-overhead-meters \.combat-health-badge \{([^}]*)\}/);
  assert.ok(rule, 'overhead badge rule exists');
  const w = rule[1].match(/(?<![-\w])width:([^;]+);/)[1].trim();
  const h = rule[1].match(/(?<![-\w])height:([^;]+);/)[1].trim();
  assert.equal(w, h, 'badge width equals height');
  assert.match(rule[1], /aspect-ratio:\s*1/);
  assert.match(rule[1], /min-width:\s*0/);
  assert.match(rule[1], /flex:\s*0 0 /, 'badge does not flex-stretch');
});

test('illustrated HUD icons crop with an svg viewBox and meet-fit, not stretched img percentages', () => {
  assert.match(meta, /preserveAspectRatio="xMidYMid meet"/);
  assert.doesNotMatch(meta, /illustrated-hud-icon[^`]*<img/);
  assert.doesNotMatch(polish, /illustrated-hud-icon img[^}]*object-fit:\s*fill/);
});

test('Defense (Block) is the leftmost badge, then Poise, Evade, Ward (owner 2026-10-18, order revised 2026-11-01)', async () => {
  const { combatHealthModel } = await import('../src/ui/models/CombatHealthModel.js');
  const kinds = combatHealthModel({ evasion: 2, poise: 3, ward: 4, defense: 5 }).badges.map(b => b.kind);
  assert.deepEqual(kinds, ['shield', 'poise', 'evade', 'ward']);
});
