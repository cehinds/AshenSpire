#!/usr/bin/env node
// Focused source contract for remediation #7. The ActionRegistry owns only
// semantic destinations; Equipment alone adapts them to current Armoury views,
// regions, focus, and reachability. This gate does not execute a browser or a
// generated artifact.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL_PATH = 'tools/actionregistry-destinations.mjs';
const CEILING = [
  'src/main.js',
  'src/ui/input.js',
  'src/ui/screens/combat.js',
  'src/ui/screens/equipment.js',
  'src/ui/screens/map.js',
  'tools/actionregistry-destinations.mjs',
];

const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const sources = () => ({
  input: read('src/ui/input.js'),
  map: read('src/ui/screens/map.js'),
  combat: read('src/ui/screens/combat.js'),
  main: read('src/main.js'),
  equipment: read('src/ui/screens/equipment.js'),
  hints: read('src/ui/components/hints.js'),
});

const inputRuntime = await import('../src/ui/input.js');
const equipmentRuntime = await import('../src/ui/screens/equipment.js');
inputRuntime.setKeyBindings({ deck: 'x', relics: 'y', stats: 'z' });
const runtimeReceipts = ['deck', 'relics', 'stats'].map((actionId) => ({
  actionId,
  direct: inputRuntime.actionDestination(actionId),
  rebound: inputRuntime.actionDestinationForEvent({ key: { deck: 'x', relics: 'y', stats: 'z' }[actionId] }),
}));
inputRuntime.setKeyBindings({ deck: 'x', relics: 'x', stats: 'z' });
const duplicateBindingRefused = inputRuntime.actionDestinationForEvent({ key: 'x' }) === null;
const cardsPlan = equipmentRuntime.armouryDestinationPlan('cards');
cardsPlan.view = 'rack';
const planCopyIsolated = equipmentRuntime.armouryDestinationPlan('cards')?.view === 'grid';
const runtimeProjectionOk = JSON.stringify(runtimeReceipts) === JSON.stringify([
  { actionId: 'deck', direct: 'cards', rebound: { actionId: 'deck', destination: 'cards' } },
  { actionId: 'relics', direct: 'equipment', rebound: { actionId: 'relics', destination: 'equipment' } },
  { actionId: 'stats', direct: 'character', rebound: { actionId: 'stats', destination: 'character' } },
]) && duplicateBindingRefused
  && equipmentRuntime.armouryDestinationPlan('equipment')?.view === 'rack'
  && equipmentRuntime.armouryDestinationPlan('character')?.view === 'grid'
  && equipmentRuntime.armouryDestinationPlan('missing') === null
  && planCopyIsolated;

const actionBlock = (input) => input.slice(input.indexOf('export const ACTIONS = ['), input.indexOf('];', input.indexOf('export const ACTIONS = [')) + 2);
const functionBlock = (source, start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  return from >= 0 && to > from ? source.slice(from, to) : '';
};

const git = (...args) => execFileSync('git', args, {
  cwd: ROOT,
  encoding: 'utf8',
}).trimEnd();

function isAncestor(ancestor, descendant) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function currentBaseMerge(addition) {
  const rows = git('log', '--first-parent', '--merges', '--format=%H %P', 'HEAD')
    .split(/\r?\n/).filter(Boolean);
  for (const row of rows) {
    const [merge, currentBase, ...migrationParents] = row.split(/\s+/);
    if (isAncestor(addition, currentBase)) continue;
    const migrationParent = migrationParents.find((parent) => isAncestor(addition, parent));
    if (migrationParent) return { merge, currentBase, migrationParent };
  }
  return null;
}

function changedPaths() {
  try {
    const addition = git('log', '--diff-filter=A', '-n', '1', '--format=%H', '--', TOOL_PATH);
    if (!addition) return ['<actionregistry-addition-unavailable>'];
    const composed = currentBaseMerge(addition);
    let committed;
    let repairs = [];
    if (composed) {
      // The first parent is the preserved current dev base. The second-parent
      // history owns the migration source. Bound this gate to its migration
      // slice, then include the first-parent repair lineage that touched it.
      const migrationTip = git('log', '-n', '1', '--format=%H', composed.migrationParent, '--', TOOL_PATH);
      committed = git('diff', '--name-only', `${addition}^...${migrationTip}`)
        .split(/\r?\n/).filter(Boolean);
      const repairTip = git('log', '--first-parent', '-n', '1', '--format=%H', `${composed.merge}..HEAD`, '--', TOOL_PATH);
      if (repairTip) {
        repairs = git('diff', '--name-only', `${repairTip}^..HEAD`)
          .split(/\r?\n/).filter(Boolean);
      }
    } else {
      committed = git('diff', '--name-only', `${addition}^...HEAD`)
        .split(/\r?\n/).filter(Boolean);
    }
    const working = git('status', '--porcelain=v1', '--untracked-files=all')
      .split(/\r?\n/).filter(Boolean).map((line) => line.slice(3));
    return [...new Set([...committed, ...repairs, ...working])].sort();
  } catch {
    return ['<git-diff-unavailable>'];
  }
}

function contract(s, { paths = changedPaths() } = {}) {
  const actions = actionBlock(s.input);
  const mapKeys = functionBlock(s.map, 'const mapKeys = (ev) => {', 'addEventListener(\'keydown\', mapKeys);');
  const combatKeys = functionBlock(s.combat, 'const keyHandler = (ev) => {', 'addEventListener(\'keydown\', keyHandler);');
  const showArmoury = functionBlock(s.main, 'function showArmoury(', 'function showHistory(');
  const combatArmoury = functionBlock(s.combat, 'function openCombatArmoury(', "$('#combat-armoury').addEventListener");
  const mountPrefix = functionBlock(s.equipment, 'export function mountEquipment(', 'const cz =');
  const exactRows = [
    /id: 'deck'.*defKey: 'd'.*defBtn: 3.*destination: 'cards'/,
    /id: 'relics'.*defKey: 'r'.*defBtn: 4.*destination: 'equipment'/,
    /id: 'stats'.*defKey: 't'.*defBtn: 5.*destination: 'character'/,
  ];
  const destinationFields = [...actions.matchAll(/destination: '([^']+)'/g)].map((match) => match[1]);
  const quickMap = "inventory: () => onArmoury('rack'), character: () => onArmoury('grid')";
  const quickCombat = "inventory: () => openCombatArmoury('rack'),\n          character: () => openCombatArmoury('grid')";
  const s6Anchors = [
    'onEquipmentChanged: captureEquipmentChanged',
    "box.dataset.component = 'armoury.cardList';",
    "row.dataset.component = 'armoury.cardRow';",
    "host.dispatchEvent(new CustomEvent('ashenspire:equipmentChanged'",
  ];
  return [
    {
      code: 'REGISTRY-SEMANTICS',
      ok: exactRows.every((pattern) => pattern.test(actions))
        && destinationFields.length === 3
        && new Set(destinationFields).size === 3,
      detail: 'stable deck/relics/stats rows retain D/R/T + pad3/4/5 and own distinct Cards/Equipment/Character semantics',
    },
    {
      code: 'REGISTRY-NO-RAW-VIEW',
      ok: !/destination: '(?:grid|rack|hybrid|relics)'/.test(actions),
      detail: 'the ActionRegistry contains no raw Armoury view, selector, or relic-only destination',
    },
    {
      code: 'REGISTRY-FAIL-CLOSED',
      ok: /export function actionDestination\(id\)/.test(s.input)
        && /rows\.length !== 1/.test(s.input)
        && /ACTION_DESTINATIONS\.has\(rows\[0\]\.destination\)/.test(s.input)
        && /export function actionDestinationForEvent\(ev\)/.test(s.input)
        && /matches\.length !== 1/.test(s.input),
      detail: 'unknown, duplicate, or dangling destination rows return null instead of falling back',
    },
    {
      code: 'RUNTIME-PROJECTION',
      ok: runtimeProjectionOk,
      detail: 'direct and rebound ActionRegistry reads resolve exact semantics; duplicate bindings and unknown plans fail closed',
    },
    {
      code: 'MAP-CONSUMER',
      ok: /actionDestinationForEvent/.test(s.map)
        && /const armouryAction = actionDestinationForEvent\(ev\);/.test(mapKeys)
        && /else if \(armouryAction\)[\s\S]*onArmoury\(armouryAction\)/.test(mapKeys)
        && !/matchAction\(ev, 'deck'\) \|\| matchAction\(ev, 'relics'\)/.test(mapKeys),
      detail: 'Map preserves the matched semantic destination instead of collapsing the three actions',
    },
    {
      code: 'COMBAT-CONSUMER',
      ok: /actionDestinationForEvent/.test(s.combat)
        && /const armouryAction = actionDestinationForEvent\(ev\);/.test(combatKeys)
        && /if \(armouryAction\)[\s\S]*openCombatArmoury\(armouryAction\)/.test(combatKeys)
        && !/\$\('#combat-armoury'\)\.click\(\)/.test(combatKeys),
      detail: 'Combat preserves the same semantic destination and opens through its inCombat adapter',
    },
    {
      code: 'INPUT-PARITY',
      ok: /synthKey\(keyBindings\[id\] \|\| a\.defKey \|\| a\.key\)/.test(s.input)
        && /if \(tabRingButton\(i\)\) continue;[\s\S]*const a = actionForButton\(i\)/.test(s.input)
        && /beginActionPress\(chip\.dataset\.action\)/.test(s.hints),
      detail: 'rebound keyboard, pad, and hint chips converge while tab-ring pad4/5 precedence remains first',
    },
    {
      code: 'QUICK-MENU-UNCHANGED',
      ok: s.map.includes(quickMap) && s.combat.includes(quickCombat),
      detail: 'Quick Menu inventory/character retain their existing rack/grid behavior',
    },
    {
      code: 'TRANSIENT-BRIDGES',
      ok: /typeof request === 'string'/.test(showArmoury)
        && /request\.destination/.test(showArmoury)
        && /destination,/.test(showArmoury)
        && /typeof request === 'string'/.test(combatArmoury)
        && /request\.destination/.test(combatArmoury)
        && /destination,/.test(combatArmoury)
        && !/settings\.(?:destination|actionDestination)/.test(`${showArmoury}${combatArmoury}`),
      detail: 'main and combat pass destination as transient mount state without changing equipView preference semantics',
    },
    {
      code: 'EQUIPMENT-ADAPTER',
      ok: /export function armouryDestinationPlan\(destination\)/.test(s.equipment)
        && /cards: Object\.freeze\(\{ view: 'grid', region: 'cards' \}\)/.test(s.equipment)
        && /equipment: Object\.freeze\(\{ view: 'rack', region: null \}\)/.test(s.equipment)
        && /character: Object\.freeze\(\{ view: 'grid', region: null \}\)/.test(s.equipment)
        && /const destinationPlan = destination \? armouryDestinationPlan\(destination\) : null;/.test(mountPrefix)
        && /if \(destination && !destinationPlan\)[\s\S]*return null;/.test(mountPrefix)
        && /destinationPlan\?\.view \|\|/.test(s.equipment)
        && /folded\.set\(destinationPlan\.region, false\)/.test(s.equipment)
        && /focusArmouryDestination/.test(s.equipment),
      detail: 'Equipment alone maps semantic destination to current view, tray reveal, focus, and reachability',
    },
    {
      code: 'MUTATION-FREE-OPEN',
      ok: !/(?:saveMeta|persist|stampDeck|run\.(?:deck|loadout|relics)|combat\.piles)\s*[=(]/.test(showArmoury.slice(0, showArmoury.indexOf('mountEquipment')))
        && !/(?:saveMeta|persist|run\.(?:deck|loadout|relics)|combat\.piles)\s*[=(]/.test(combatArmoury.slice(0, combatArmoury.indexOf('mountEquipment'))),
      detail: 'opening a semantic destination performs no run, loadout, deck, pile, relic, profile, or session mutation',
    },
    {
      code: 'VEIL-PRECEDENCE',
      ok: /if \(veilIsOpen\(\)\) return;[\s\S]*actionDestinationForEvent/.test(mapKeys)
        && /if \(veilIsOpen\(\)\) return;[\s\S]*actionDestinationForEvent/.test(combatKeys),
      detail: 'a standing veil still consumes the actions before destination dispatch',
    },
    {
      code: 'S6-PRESERVED',
      ok: s6Anchors.every((anchor) => s.equipment.includes(anchor)),
      detail: 'the accepted S6 equipment event and weapon-card grouping anchors remain present',
    },
    {
      code: 'PATH-CEILING',
      ok: paths.length > 0 && paths.every((path) => CEILING.includes(path))
        && paths.includes('tools/actionregistry-destinations.mjs'),
      detail: `the exact source-only delta stays inside the six-path ceiling (${paths.join(', ')})`,
    },
  ];
}

let checks = 0;
let failures = 0;
function report(ok, code, detail) {
  checks += 1;
  if (ok) console.log(`PASS ACTIONREGISTRY-${code} - ${detail}`);
  else {
    failures += 1;
    console.error(`RED ACTIONREGISTRY-${code} - ${detail}`);
  }
}

if (process.argv.includes('--selftest')) {
  const clean = sources();
  const baseline = contract(clean);
  report(baseline.every(({ ok }) => ok), 'PLANT-CLEAN', 'clean source satisfies the complete focused contract');
  const plants = [
    ['deck/stats destination swap', 'REGISTRY-SEMANTICS', (s) => ({
      ...s,
      input: s.input.replace("destination: 'cards'", "destination: '__swap__'")
        .replace("destination: 'character'", "destination: 'cards'")
        .replace("destination: '__swap__'", "destination: 'character'"),
    })],
    ['generic Armoury collapse', 'MAP-CONSUMER', (s) => ({
      ...s,
      map: s.map.replace('onArmoury(armouryAction)', 'onArmoury()'),
    })],
    ['pad/hint drift', 'INPUT-PARITY', (s) => ({
      ...s,
      input: s.input.replace("if (tabRingButton(i)) continue;", "if (false && tabRingButton(i)) continue;"),
    })],
    ['stable id/default drift', 'REGISTRY-SEMANTICS', (s) => ({
      ...s,
      input: s.input.replace("id: 'deck', label: 'Open Armoury (Deck)'", "id: 'cards', label: 'Open Armoury (Deck)'")
        .replace("defKey: 'd', defBtn: 3", "defKey: 'x', defBtn: 8"),
    })],
    ['relic-only misroute', 'REGISTRY-NO-RAW-VIEW', (s) => ({
      ...s,
      input: s.input.replace("destination: 'equipment'", "destination: 'relics'"),
    })],
    ['missing destination subject', 'EQUIPMENT-ADAPTER', (s) => ({
      ...s,
      equipment: s.equipment.replace("view: 'grid', region: 'cards'", "view: 'grid', region: 'missing'"),
    })],
    ['opening mutates the run deck', 'MUTATION-FREE-OPEN', (s) => ({
      ...s,
      main: s.main.replace('  mountEquipment(document.body, {', '  run.deck = []; // actionregistry plant\n  mountEquipment(document.body, {'),
    })],
    ['tab-ring precedence bypass', 'INPUT-PARITY', (s) => ({
      ...s,
      input: s.input.replace('if (tabRingButton(i)) continue;', 'tabRingButton(i); // actionregistry plant'),
    })],
    ['duplicate destination row falls through', 'REGISTRY-FAIL-CLOSED', (s) => ({
      ...s,
      input: s.input.replace('if (rows.length !== 1', 'if (rows.length < 1'),
    })],
  ];
  for (const [name, expectedCode, plant] of plants) {
    const planted = contract(plant(clean)).find(({ code }) => code === expectedCode);
    report(planted?.ok === false, `PLANT-${expectedCode}`, `${name} is caught by ${expectedCode}`);
  }
  const unrelatedPath = contract(clean, {
    paths: [...CEILING, 'src/ui/screens/unrelated-first-parent.js'],
  }).find(({ code }) => code === 'PATH-CEILING');
  report(
    unrelatedPath?.ok === false,
    'PLANT-PATH-CEILING',
    'an unrelated path introduced beside the migration source is rejected by PATH-CEILING',
  );
  console.log(`\n${checks - failures}/${checks} ActionRegistry source plants passed.`);
  process.exit(failures ? 1 : 0);
}

for (const { ok, code, detail } of contract(sources())) report(ok, code, detail);
console.log(`\n${checks - failures}/${checks} ActionRegistry source checks passed.`);
process.exit(failures ? 1 : 0);
