// tests/capture-config-baseline.mjs — write tests/fixtures/config-migration-baseline.json
//
// The migration's safety net. Run on dev BEFORE the shims exist, it records what
// every migrated module exported, KEY ORDER INCLUDED, as a structural transcript.
// tests/config-migration.test.mjs then replays it against the shims: any change
// of value, of type, or of the order keys come back in is a failure.
//
//   node tests/capture-config-baseline.mjs
//
// Key order matters because consumers iterate these tables (legendEntries walks
// NODE_TYPES; menuRows walks bands) and a reordered JSON round-trip would change
// what the screen draws while every value stayed equal.
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const MIGRATED = [
  'src/ui/uiContent.js',
  'src/content/mapPresentation.js',
  'src/content/localMapPresentation.js',
  'src/content/combatEffectPresentation.js',
  'src/content/combatPoseStates.js',
  'src/content/actionAnimations.js',
  'src/content/classArtAnchors.js',
  'src/content/environments.js',
  'src/ui/combatAura.js',
];

// Calls whose RESULTS are part of the contract: a module may export a function
// over a table rather than the table, and the table moving must not move these.
export const PROBES = {
  'src/content/localMapPresentation.js': [['localMapPolicy', []], ['localMapPolicy', ['ashen-crown']]],
  'src/content/combatEffectPresentation.js': [
    ['combatEffectPresentation', ['slash']], ['combatEffectPresentation', ['steelGlint']],
    ['combatEffectPresentation', ['bloodAura']], ['combatEffectPresentation', ['unknownKind']],
    ['combatEffectOpacity', ['slash']], ['combatEffectOpacity', ['steelGlint']],
  ],
  'src/content/classArtAnchors.js': [
    ['medallionAnchor', ['reaver']], ['medallionAnchor', ['starseer']], ['medallionAnchor', ['rogue']],
    ['medallionAnchor', ['herald']], ['medallionAnchor', ['nobody']],
    ['medallionDeclared', ['reaver']], ['medallionDeclared', ['nobody']],
  ],
  'src/ui/combatAura.js': [
    ['auraFilter', ['power1', 'idle', [], false]], ['auraFilter', ['power2', 'guard', ['hp'], true]],
    ['auraFilter', ['idle', 'bloodRite', [], false]], ['auraFilter', ['idle', 'guard', [], false]],
    ['auraFilter', ['idle', 'idle', [], false]], ['auraFilter', ['power3', 'idle', ['stamina','mana'], true]],
    ['resourceAura', [{ staminaCost: 2, manaCost: 0 }]],
    ['resourceAura', [{ hpCost: 3 }]],
    ['resourceAura', [{ effects: [{ op: 'loseHp', target: 'self', amount: 2 }] }]],
    ['resourceAura', [{}]],
  ],
  'src/ui/uiContent.js': [
    ['nodeIcon', ['boss']], ['nodeIcon', ['nope']], ['nodeName', ['shrine']], ['nodeBlurb', ['event']],
    ['legendEntries', []],
    ['actTitle', [1]], ['actTitle', [2]], ['actTitle', [7]], ['actTitle', [4, 'The Pale Marches']],
    ['actPlate', [7, 3]], ['actPlate', [0, 3]], ['actPlate', [5, 0]],
    ['backdropClass', [4]], ['parchmentAsset', [5]], ['parchmentClass', [2]],
    ['padGlyph', [0]], ['padGlyph', [99]], ['padName', [14]], ['padName', [null]], ['padName', [99]],
    ['armamentKindLabel', ['staff']], ['armamentKindLabel', ['weapon']],
    ['menuTabRefs', []],
    ['menuTabs', [{}]], ['menuTabs', [{ hasSave: false }]],
    ['menuRows', ['map', {}]], ['menuRows', ['combat', { current: 'settings' }]],
    ['menuRows', ['overlay', { fixedEnds: false, hasSave: false }]],
    ['intentBadge', [{ kind: 'unknown' }]], ['intentBadge', [{ kind: 'staggered' }]],
    ['intentBadge', [{ damage: 5, hits: 2, delayed: true }]], ['intentBadge', [{ block: 4 }]],
    ['intentBadge', [{ kind: 'buff' }]], ['intentBadge', [{ kind: 'debuff' }]],
    ['intentTooltip', [{ kind: 'unknown' }]], ['intentTooltip', [{ kind: 'staggered' }]],
    ['intentTooltip', [{ damage: 5, hits: 2, totalDamage: 10, pending: true }]],
    ['intentTooltip', [{ damage: 5, hits: 1, delayed: true }, { victim: 'each hero' }]],
    ['intentTooltip', [{ block: 3 }]], ['intentTooltip', [{ kind: 'buff' }]],
    ['intentTooltip', [{ kind: 'debuff' }, { victim: 'each hero' }]],
  ],
};

/**
 * A structural transcript of `value`. Plain objects become
 * `{ __keys: [...], ... }` so a key-order change is a value change, and the
 * things JSON cannot hold (undefined, NaN, functions) get named rather than
 * silently becoming null.
 */
export function transcribe(value) {
  if (value === undefined) return { __undefined: true };
  if (value === null) return null;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { __number: 'NaN' };
    if (!Number.isFinite(value)) return { __number: String(value) };
    // Round-trip through the shortest exact decimal: the transcript must not
    // lose a bit that `===` would have seen.
    return { __number: value === 0 && Object.is(value, -0) ? '-0' : String(value) };
  }
  if (typeof value === 'function') return { __function: value.name, length: value.length };
  if (typeof value !== 'object') return { [`__${typeof value}`]: value };
  if (Array.isArray(value)) return { __array: value.map(transcribe), frozen: Object.isFrozen(value) };
  return {
    __keys: Object.keys(value),
    frozen: Object.isFrozen(value),
    values: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, transcribe(v)])),
  };
}

export async function captureModule(rel) {
  const mod = await import(new URL(`../${rel}`, import.meta.url).href);
  const exports = {};
  for (const name of Object.keys(mod).sort()) exports[name] = transcribe(mod[name]);
  const probes = {};
  for (const [name, args] of PROBES[rel] || []) {
    const key = `${name}(${JSON.stringify(args)})`;
    try {
      probes[key] = transcribe(mod[name](...args));
    } catch (e) {
      probes[key] = { __threw: e.message };
    }
  }
  return { exports, probes };
}

export async function capture() {
  const out = {};
  for (const rel of MIGRATED) out[rel] = await captureModule(rel);
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = await capture();
  const path = resolve(ROOT, 'tests/fixtures/config-migration-baseline.json');
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`captured ${MIGRATED.length} module(s) → tests/fixtures/config-migration-baseline.json`);
}
