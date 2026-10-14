// CO-OP HUD MATCHES SOLO ON THREE THREADS (#1781 dropped them from #1772).
//
// 1. Player meters label their rows (showLabels for players, not enemies) and
//    mark every row with its meter kind, so multiple resources (Mana, Stamina,
//    Poise) read as named rows and the mini-HUD rules
//    ([data-meter-row='resource']) apply, as they do in solo combat.js.
// 2. The seat nameplate reads "name · Lv N" like the solo nameplate.
// 3. Co-op player sprites pass view: 'combat', as solo's playerSprite does.
// The node runner has no DOM, so each contract is pinned on the source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const coop = readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8');
const solo = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const body = (src, name) => {
  const start = src.indexOf(`\n  function ${name}(`);
  assert.ok(start > 0, `source must define ${name}()`);
  const next = src.indexOf('\n  function ', start + 1);
  return src.slice(start, next > 0 ? next : undefined);
};

test('co-op meters label player rows and not enemy rows', () => {
  const meters = body(coop, 'meterBars');
  assert.match(meters, /resourceBars\(plan, \{ surface: 'model', showLabels: !isEnemy \}\)/,
    'the co-op meter call must pass showLabels: !isEnemy, as solo does for players');
  assert.match(body(solo, 'meterBars'), /showLabels: entity\.kind === 'player'/, 'solo baseline');
});

test('co-op meter rows carry data-meter-row kinds for the mini-HUD rules', () => {
  const meters = body(coop, 'meterBars');
  assert.match(meters, /row\.dataset\.meterRow = kind/, 'each co-op meter row must be marked with its kind');
  assert.match(meters, /kind = row\.dataset\.meterRow === 'hp'[^;]*'resource'/s,
    'resource rows must be marked resource, as solo marks them');
  assert.match(meters, /meterRowSelectedOnly\(kind\)/, 'selected-only kinds must follow the same rule as solo');
  assert.match(coop, /import \{ meterRowSelectedOnly \} from '\.\.\/models\/CombatantMeterModel\.js';/);
});

test('co-op seat nameplate shows the level beside the name', () => {
  const seats = coop.slice(coop.indexOf('for (const p of sc.players)'));
  assert.match(seats, /name\.textContent = `\$\{m\.name \|\| p\.id\} · Lv \$\{characterLevel\(\{ level: m\.level \}\)\}`/,
    'the .nm nameplate must read name · Lv N');
  assert.match(coop, /import \{ characterLevel \} from '\.\.\/\.\.\/model\/levelup\.js';/);
  assert.match(solo, /Lv \$\{characterLevel\(run\)\}/, 'solo baseline');
});

test('co-op player sprites pass view combat, as solo does', () => {
  const seats = coop.slice(coop.indexOf('for (const p of sc.players)'), coop.indexOf('box.appendChild(sprite);'));
  assert.match(seats, /playerSprite\([^;]*\{ animation: equipmentAnimationForLoadout\(registries, m\.loadout, m\.classId\), view: 'combat' \}\)/,
    'the co-op player sprite must request the combat view');
  assert.match(solo, /playerSprite\(run\.customization \|\| \{\}, run\.class, figure\.armourId, \{ animation, view: 'combat', selectedWeaponProfile: selectedProfile\(\), classSmashProfile: smashProfile\(\) \}\)/,
    'solo keeps the combat view alongside its scoped selected-weapon presentation');
  assert.doesNotMatch(seats, /classSmashProfile/, 'co-op retains its existing animation presentation');
});
