// Focused source contract for the compact Right-Dock HUD and its menu/settings
// companions. This stays browser-free so it can run before artifact generation.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const checks = [];
const check = (condition, name) => checks.push({ condition: !!condition, name });

const settings = read('src/ui/screens/settings.js');
const content = read('src/ui/uiContent.js');
const hud = read('src/ui/components/hudmeta.js');
const hudWire = read('src/ui/components/hudQuickSettings.js');
const quicknav = read('src/ui/components/quicknav.js');
const map = read('src/ui/screens/map.js');
const combatCss = read('styles/combat.css');
const uiCss = read('styles/ui.css');
const mapCss = read('styles/map.css');

check(/Changelog:\s*\{\s*mount:\s*'set-changelog-mount'/.test(settings)
  && /CATEGORY_ORDER\s*=\s*\[[^\]]*'Changelog'[^\]]*'About'/.test(settings)
  && !/id:\s*'Changelog'/.test(settings),
  'Changelog is a first-level Settings category');

const expectedOrder = ['settings', 'controls', 'fullscreen', 'music', 'inventory', 'character', 'load', 'save', 'saveQuit', 'quitWithoutSave'];
const declared = [...content.matchAll(/act:\s*'([^']+)'/g)].map((match) => match[1]);
let cursor = -1;
check(expectedOrder.every((id) => (cursor = declared.indexOf(id, cursor + 1)) >= 0),
  'Quick Menu declares the requested vertical order');
check(/Quit Without Saving/.test(content) && /confirmQuickMenuAction/.test(hudWire + quicknav)
  && /typeof confirmFn !== 'function'/.test(quicknav),
  'destructive and unsaved Quick Menu actions are named and confirmed');

check(/data-hud-mode=/.test(hud) && /data-hud-grip/.test(hud)
  && /resolveHudMode/.test(hudWire),
  'the shared HUD exposes two persisted snap states and a grip');
check(/\.hud-resize-grip[\s\S]*width:\s*var\(--tap-floor\)[\s\S]*height:\s*var\(--tap-floor\)/.test(combatCss)
  && /\.hud-resize-grip::before[\s\S]*width:\s*calc\(18px/.test(combatCss),
  'the grip has a tiny 18px face inside the tap-floor hit area');
check(/data-hud-mode='compact'[\s\S]*\.hud-right-dock[\s\S]*\.hud-quick-settings/.test(combatCss),
  'compact mode places the utility pair in the right dock under potions');
check(/data-layout='narrow'[\s\S]*\.hud-quick-setting-face[\s\S]*32px/.test(uiCss)
  && /\.hud-quick-setting[\s\S]*min-height:\s*var\(--tap-floor\)/.test(uiCss),
  'mobile utility faces are 20 percent smaller while targets keep the tap floor');

check(/visualViewport/.test(map) && /fullscreenchange/.test(map)
  && /requestAnimationFrame/.test(map) && /board\.recenter/.test(map),
  'map viewport changes settle before recentering the current node');
check(/--map-route-safe-inset[\s\S]*1\.2/.test(mapCss),
  'the Act Route Strip reserves symmetric 1.2x utility-rail safe insets');

const failed = checks.filter((entry) => !entry.condition);
for (const entry of checks) console.log(`${entry.condition ? 'PASS' : 'FAIL'}  ${entry.name}`);
if (failed.length) {
  console.error(`compact-hud-b: ${checks.length - failed.length} passed, ${failed.length} failed`);
  process.exit(1);
}
console.log(`compact-hud-b: OK - ${checks.length} checks passed`);
