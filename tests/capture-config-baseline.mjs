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

/**
 * PHASE 2 (tier A): the self-contained authored presentation tables the
 * post-#1124 audit found still written in JS. Same contract as MIGRATED, and
 * the same reason for capturing first: these modules are read by screens that
 * iterate them, so a value, a type or a key order that moves is a defect.
 *
 * Three of them export only DOM builders and no table at all
 * (combatantEffectLayers, combatEffectSprites, ui/presentationSequence). They
 * are here so the fixture records their exported shape — a function that loses
 * an argument is a change this catches — and so the no-literals guard covers
 * them; they are not expected to collapse into shims.
 */
export const TIER_A = [
  'src/content/combatEffectAnchors.js',
  'src/content/tooltipHelp.js',
  'src/ui/combatEffectDirection.js',
  'src/ui/combatantEffectLayers.js',
  'src/ui/combatEffectSprites.js',
  'src/model/presentationSequence.js',
  'src/ui/presentationSequence.js',
  'src/ui/reaverAttack.js',
  'src/model/armouryLayout.js',
  'src/ui/models/StartupGateModels.js',
  'src/ui/models/CombatFormationModel.js',
  'src/ui/models/TooltipPlacementModel.js',
  'src/ui/models/CombatLayout.js',
  'src/ui/services/PoseAnimator.js',
];

// Calls whose RESULTS are part of the contract: a module may export a function
// over a table rather than the table, and the table moving must not move these.
export const PROBES = {
  // ---- phase 2 (tier A) ----------------------------------------------------
  'src/content/combatEffectAnchors.js': [
    ['combatPoseAttachment', ['reaver']], ['combatPoseAttachment', ['reaver', 'attack3']],
    ['combatPoseAttachment', ['reaver', 'attack4', 'hand']], ['combatPoseAttachment', ['rogue', 'shieldBash2', 'shield']],
    ['combatPoseAttachment', ['herald-pilgrim', 'idle', 'hand']], ['combatPoseAttachment', ['starseer', 'attack1', 'shield']],
    ['combatPoseAttachment', ['nobody']],
    ['combatEffectAttachment', [{ kind: 'slash', targetEvent: 'damageDealt' }]],
    ['combatEffectAttachment', [{ kind: 'shieldBash', targetEvent: 'damageDealt' }]],
    ['combatEffectAttachment', [{ kind: 'starbolt', targetEvent: 'damageDealt' }]],
    ['combatEffectAttachment', [{ kind: 'slash', targetEvent: 'damageDealt', projectile: true }]],
    ['combatEffectAttachment', [{ kind: 'slash', targetEvent: 'turnStart' }]],
    ['combatEffectAttachment', [null]],
  ],
  'src/ui/combatEffectDirection.js': [
    ['combatEffectAngle', [{ top: 0, left: 0, width: 10, height: 10 }, { top: 0, left: 100, width: 10, height: 10 }]],
    ['combatEffectAngle', [{ top: 0, left: 0, width: 10, height: 10 }, { top: 100, left: 0, width: 10, height: 10 }]],
    ['combatEffectAngle', [null, null]],
    ['combatEffectOrientation', []], ['combatEffectOrientation', ['left']],
    ['combatEffectOrientation', ['up']], ['combatEffectOrientation', ['down']],
  ],
  'src/model/presentationSequence.js': [
    ['title', ['shield-bash_study']], ['starter', []],
    ['startTime', [{ cue: 'contact', offset: 0 }, { duration: 1200 }]],
    ['startTime', [{ cue: 'nope', offset: 25 }, { duration: 1200 }]],
  ],
  'src/ui/models/CombatFormationModel.js': [
    ['figureCeiling', [{ width: 800, height: 600 }]], ['figureCeiling', [{ width: 375, height: 812 }]],
    ['combatFormation', [{ width: 800, height: 600, friends: ['a', 'b'], enemies: ['x', 'y', 'z'] }]],
    ['combatFormation', [{ width: 375, height: 812, friends: ['a'], enemies: ['x'] }]],
    ['combatFormation', [{ width: 1400, height: 900, friends: ['a', 'b', 'c', 'd'], enemies: ['w', 'x', 'y', 'z'] }]],
  ],
  'src/ui/models/CombatLayout.js': [
    ['allocateCombatBands', [{ width: 800, height: 600 }]],
    ['allocateCombatBands', [{ width: 375, height: 812 }]],
    ['minimumHandHeight', []],
    ['packCombatFooter', [{ width: 800, height: 600 }]],
    ['packCombatRails', [{ width: 800 }]],
  ],
  'src/ui/models/TooltipPlacementModel.js': [
    ['tooltipPlacementModel', []], ['tooltipWireframeConfig', []],
    ['tooltipWireframe', ['medium']], ['tooltipWireframe', ['expanded']],
    ['tooltipArrowSize', []], ['tooltipArrowSize', [{ zoom: 2, rootFontPx: 20 }]],
  ],
  'src/ui/reaverAttack.js': [
    ['reaverAttackTiming', []], ['reaverAttackTiming', [1.5]], ['reaverAttackTiming', [0.5]],
    ['reaverAttackFrameUrls', []],
    ['isReaverAttackEligible', [{ classId: 'reaver', figure: 'painted', customization: {}, spritesEnabled: true }]],
    ['isReaverAttackEligible', [{ classId: 'rogue', figure: 'painted', customization: {}, spritesEnabled: true }]],
  ],
  'src/ui/services/PoseAnimator.js': [
    ['poseFrame', ['reaver', 'idle', 'gold']], ['poseFrame', ['nobody', 'idle', 'gold']],
    ['hasPoses', ['reaver', 'gold']], ['hasPoses', ['nobody', 'gold']],
    ['posesFor', ['reaver', 'gold']],
  ],
  'src/model/armouryLayout.js': [
    ['normalizeArmouryLayout', []], ['normalizeArmouryLayout', [{}]],
    ['trayPresentationState', [{ collapsed: false, savedHeightRatio: null, defaultHeightRatio: 0.5 }]],
    ['trayPresentationState', [{ collapsed: true, savedHeightRatio: 0.7, defaultHeightRatio: 0.5 }]],
    ['orderArmouryPositions', [[{ slot: 'leftHand' }, { slot: 'armor' }, { slot: 'rightHand' }]]],
  ],
  // ---- phase 1 -------------------------------------------------------------
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

export async function capture(list = MIGRATED) {
  const out = {};
  for (const rel of list) out[rel] = await captureModule(rel);
  return out;
}

/**
 * The phases, each with its OWN fixture.
 *
 * A phase's fixture is written once, on dev, before that phase's shims exist,
 * and then never regenerated — that is the whole of its value. Re-capturing
 * phase 1 now would record what its shims produce rather than what the
 * hand-written modules produced, and the file would go on looking like
 * evidence while having stopped being any.
 *
 *   node tests/capture-config-baseline.mjs            phase 1
 *   node tests/capture-config-baseline.mjs --phase-2  phase 2 (tier A)
 */
export const PHASES = {
  1: { list: MIGRATED, fixture: 'tests/fixtures/config-migration-baseline.json' },
  2: { list: TIER_A, fixture: 'tests/fixtures/config-migration-baseline-tier-a.json' },
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const which = process.argv.includes('--phase-2') ? 2 : 1;
  const { list, fixture } = PHASES[which];
  const data = await capture(list);
  writeFileSync(resolve(ROOT, fixture), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`captured ${list.length} module(s) → ${fixture}`);
}
