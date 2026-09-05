import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const files = {
  css: read('styles/combat.css'),
  hud: read('src/ui/components/hudmeta.js'),
  route: (() => { try { return read('src/ui/components/actRouteStrip.js'); } catch { return ''; } })(),
  map: read('src/ui/screens/map.js'),
  combat: read('src/ui/screens/combat.js'),
};

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

// THE COMPACT HUD, AFTER THE KIT SWEEP (2026-09-04).
//
// Variant D was a second composition: its own grid areas, its own control cell,
// its own absolute rail for Fullscreen/Music, its own 18×2 px dash. The HUD is
// one kit Band now (styles/kit.css `.as-band`), and compact is that Band FOLDED
// — `data-hud-mode="compact"` hides whatever the composition marked `.fold`,
// which is one statement in one place instead of thirty overrides. So these
// contracts hold the fold, not the variant; every clause below is the same
// promise its D-number made, restated against what the game now draws.
const kit = read('styles/kit.css');
const grip = read('src/ui/components/hudModeGrip.js');

check(/\.as-band\[data-hud-mode="compact"\] \.fold, \.as-band\[data-fold="compact"\] \.fold \{ display: none; \}/.test(kit),
  'D1 the kit Band has no compact fold, so there is no compact HUD');
check(/class="hud-bottom as-band-row fold"/.test(files.hud),
  'D2 the belt of relics and potions is not what compact folds away');
check(/data-has-utility-potions="false"/.test(files.hud),
  'D3 the shared HUD does not default to an empty collapsed potion row');
// D4 WAS "the context line is part of the fold" UNTIL 2026-09-05, when the band
// stopped carrying any identity at all (owner: "it should just be vitals,
// relics, cinders, armory, menu and hp and mp potions in the Hud"). A check
// whose subject is gone cannot be left asserting it, and deleting it outright
// would drop the element from cover — so it is inverted onto the new invariant:
// the cluster is still THERE (it is the grid's first track, and the middle
// track is what centres the Cinders receipt) and it is EMPTY. Re-adding a name,
// a class, a sigil or a context line to the band fires this.
check(/class: 'hud-identity as-labelstack'/.test(files.hud)
  && !/hud-context/.test(files.hud)
  && !/eyebrow\(/.test(files.hud),
  'D4 the band carries identity content again — it is meant to be an empty track');
// D5 reads the rung in the two halves it became: the build stamp drops its
// source, and a progress Chip drops its "/ total" — never the value, which one
// blanket `:nth-child(n+2)` did (photographed at 390x844: "ACT" and "FLOOR"
// labelling nothing).
check(/@media \(max-width: 640px\)[\s\S]*?\.as-statstrip\.trail > \.build-stamp > :nth-child\(n\+2\) \{ display: none; \}/.test(kit)
    && /@media \(max-width: 640px\)[\s\S]*?\.as-statstrip\.trail > \.as-chip > \.cv > \* \{ display: none; \}/.test(kit),
  'D5 the run trail has no rung at which Build\'s source and each fact\'s tail yield');
check(/iconButton\(\{[\s\S]*?className: 'hud-mode-grip as-grip'/.test(files.hud)
    && /grip\.textContent = mode === 'compact' \? '⌄' : '⌃'/.test(grip),
  'D6 the fold control is not one kit IconButton whose glyph says which way it folds');
check(!/height:\s*calc\(132px/.test(files.css),
  'D7 compact HUD still has the rejected fixed 132px height');

// D8 WAS "Fullscreen/Music are in the same cluster as Armoury and the Menu".
// They are not in the band at all now (owner, 2026-09-05: "the full screen and
// music buttons don't need to be there since we have it in the quick and main
// menu settings"), so this asserts the two things that make that safe, which is
// more than the original did:
//   · the run HUD mounts no quick-settings pair — no import, no interpolation,
//     and `quickAccessPanelHtml` takes no options bag that could carry one back;
//   · Settings still carries BOTH controls, so neither affordance is stranded.
// The second half is the one worth having. Removing a control from a HUD is only
// correct while another surface offers it, and this is what would catch someone
// later removing the Settings rows and leaving no fullscreen anywhere.
// A BARE TOKEN SEARCH WAS THE WRONG TEST, and this check caught it on itself:
// the first draft looked for `quickSettingsHtml` anywhere in the file, and the
// COMMENT explaining the removal contains that word. A contract a comment can
// fail is a contract that punishes documentation. It reads CODE shapes now — the
// import statement and the interpolation — so the prose can name what it likes.
const settingsSrc = read('src/ui/screens/settings.js');
check(!/^import .*hudQuickSettingsHtml/m.test(files.hud)
  && !/\$\{quickSettingsHtml\}/.test(files.hud)
  && !/quickSettingsHtml\s*=/.test(files.hud)
  && /key: 'fullscreen'/.test(settingsSrc)
  && /key: 'musicEnabled'/.test(settingsSrc),
  'D8 the band mounts the quick pair again, or Settings no longer offers fullscreen and music');
check(/class="as-iconbtn modal-iconbtn hud-quick-setting/.test(read('src/ui/components/hudQuickSettings.js')),
  'D9 Fullscreen/Music are not kit IconButtons');

for (const [surface, source] of [['map', files.map], ['combat', files.combat]]) {
  check(/dataset\.hasUtilityPotions\s*=\s*[^;]*children\.length\s*\?\s*'true'\s*:\s*'false'/.test(source),
    `D10 ${surface} does not publish whether its utility-potion row has content`);
}

check(/actRouteStripHtml\(\{\s*title:\s*actTitle\(run\.actNumber\)\s*\}\)/.test(files.map)
    && !/routeTitle|actRouteStripHtml|act-route-strip/.test(files.combat),
  'D11 the Act route strip is not Map-only');
check(/export function actRouteStripHtml[\s\S]*class: 'act-route-strip map-entrance-orientation'/.test(files.route)
    && !/actRouteStripHtml|act-route-strip|routeTitle/.test(files.hud),
  'D12 the Act route strip remains owned by the shared HUD instead of a Map component');
check(/band\(\{[\s\S]*quiet: true/.test(files.route),
  'D13 the Act route strip is not a quiet kit Band');

if (failures.length) {
  console.error(`compact-hud-layout: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('compact-hud-layout: OK — 13 compact composition contracts passed');
