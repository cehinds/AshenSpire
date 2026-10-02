#!/usr/bin/env node
// Placement-agnostic flask interaction contract. Selection opens a menu; it
// never spends state. Only a chosen action becomes a host-authorized intent.

// DOOR. Two real doors: src/model/flaskActions.js is IMPORTED and its plan
// driven, and the UI/host sources are entered by readFileSync of the real
// files. `--selftest` plants each known-bad INTO A COPY of the real file on
// disk and re-runs this whole tool from that copy.
// (Vira's doors audit 2026-08-14 listed this tool NO-KNOWN-BAD.)
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'flask-action-contract.mjs',
    plants: [
      {
        name: 'selection commits on select — the menu spends state by opening',
        file: 'src/model/flaskActions.js',
        find: 'commitOnSelect: false',
        replace: 'commitOnSelect: true',
        expectRed: /FAIL selection itself is inert/,
      },
      {
        name: 'a disabled action ships with no reason (the default is dropped at its one home)',
        file: 'src/model/flaskActions.js',
        find: "reason: enabled ? '' : String(reason || `${LABELS[id]} is unavailable`)",
        replace: "reason: ''",
        expectRed: /FAIL disabled actions always carry a reason/,
      },
      {
        name: 'combat drops the shared action availability plan',
        file: 'src/ui/components/combatActionRow.js',
        find: "const action = flaskActionPlan({ context: 'combat', canUse, useReason: reason })",
        replace: "const action = plantedActionPlan({ context: 'combat', canUse, useReason: reason })",
        all: false,
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'LAN stops routing the explicit flaskIntent through the host',
        file: 'tools/lan.mjs',
        find: "case 'flaskIntent': g.flaskIntent(id, msg.intent); break;",
        replace: "case 'plantedFlask': g.useFlask(id, msg.slot); break;",
        expectRed: /FAIL LAN routes only the explicit flaskIntent action through the host/,
      },
      {
        name: 'the map stops mounting its live Potions control (the map tray between fights)',
        file: 'src/ui/screens/map.js',
        find: 'mountRunPotions(potionsHost, {',
        replace: 'plantedRunPotions(potionsHost, {',
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the map Potions control hands its flask menu a plan that is not the shared one',
        file: 'src/ui/components/runPotions.js',
        find: 'def, plan: planFor(entry), charges:',
        replace: 'def, plan: { actions: [] }, charges:',
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the map Potions model stops building its plan with the shared flaskActionPlan',
        file: 'src/ui/models/RunPotionModel.js',
        find: "  return flaskActionPlan({ context: 'run', canUse: false, useReason: t('potions.run.combatOnly'), canDrop: true });",
        replace: "  return { actions: [], commitOnSelect: false };",
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the map Potions control transforms the shared plan before handing it to the menu',
        file: 'src/ui/components/runPotions.js',
        find: 'const planFor = (entry) => runPotionPlan(entry, { drinkOutsideCombat });',
        replace: 'const planFor = (entry) => runPotionPlan(entry, { drinkOutsideCombat }).actions;',
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'BOUNDARY: a planFor whose options argument nests braces fails closed (not a shipped form)',
        file: 'src/ui/components/runPotions.js',
        find: 'const planFor = (entry) => runPotionPlan(entry, { drinkOutsideCombat });',
        replace: 'const planFor = (entry) => runPotionPlan(entry, { drinkOutsideCombat, extra: {} });',
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the map Potions model returns only the shared plan\'s actions array, not the plan',
        file: 'src/ui/models/RunPotionModel.js',
        find: "  return flaskActionPlan({ context: 'run', canUse: false, useReason: t('potions.run.combatOnly'), canDrop: true });",
        replace: "  return flaskActionPlan({ context: 'run', canUse: false, useReason: t('potions.run.combatOnly'), canDrop: true }).actions;",
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the map Potions model hands a charge flask the shared plan\'s actions array, not the plan',
        file: 'src/ui/models/RunPotionModel.js',
        find: "      dropReason: t('potions.run.keep'),\n    });",
        replace: "      dropReason: t('potions.run.keep'),\n    }).actions;",
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'one run-HUD flask menu binds the shared plan\'s actions array, not the plan',
        file: 'src/ui/components/runHud.js',
        find: "          canDrop: true,\n        });",
        replace: "          canDrop: true,\n        }).actions;",
        expectRed: /FAIL every run-HUD flask menu is fed by the shared action plan/,
      },
      {
        name: 'one run-HUD flask menu opens without the shared action plan',
        file: 'src/ui/components/runHud.js',
        find: 'const plan = flaskActionPlan({',
        replace: 'const plan = plantedActionPlan({',
        all: false,
        expectRed: /FAIL every run-HUD flask menu is fed by the shared action plan/,
      },
      {
        name: 'one run-HUD flask menu is handed an empty plan in place of the shared one',
        file: 'src/ui/components/runHud.js',
        find: '          def,\n          plan,\n',
        replace: '          def,\n          plan: {},\n',
        expectRed: /FAIL every run-HUD flask menu is fed by the shared action plan/,
      },
    ],
  }));
}

const text = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
let pass = 0;
let fail = 0;
function check(name, ok) {
  if (ok) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.error(`FAIL ${name}`); }
}

let actions = null;
try { actions = await import('../src/model/flaskActions.js'); } catch { /* observed red */ }
const component = text('src/ui/components/flask.js');
const combat = text('src/ui/screens/combat.js');
// The Potions list both boards open (2026-10-01): solo and co-op mount the one
// footer and the one list in components/combatActionRow.js.
const potions = text('src/ui/components/combatActionRow.js');
const coop = text('src/ui/screens/coop.js');
const map = text('src/ui/screens/map.js');
// THE MAP'S LIVE FLASK MENU (e1ff8c9f4). Between fights the map's flasks are
// the Potions control in the map tray: map.js mounts components/runPotions.js,
// whose minis open the shared flask menu with a plan from
// models/RunPotionModel.js `runPotionPlan`. That is the path the map half
// follows. The run HUD's room-rail icons (components/runHud.js) also open the
// menu, but `wireframeUi.hud.potions.roomRail` is off, so they are checked on
// their own and never stand in for the map.
const runPotions = text('src/ui/components/runPotions.js');
const runPotionModel = text('src/ui/models/RunPotionModel.js');
const runHud = text('src/ui/components/runHud.js');
const session = text('tools/session.mjs');
const lan = text('tools/lan.mjs');

// Comments out, so a call that only survives in prose does not count.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
// The balanced text from the bracket at `open` to its partner (strings skipped).
function balanced(src, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const stack = [];
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack[stack.length - 1]) { stack.pop(); if (!stack.length) return src.slice(open, i + 1); }
  }
  return null;
}
// The top-level properties of an object literal's text, as [key, value] pairs.
function props(obj) {
  const out = [];
  let depth = 0;
  let start = 1;
  const push = (end) => {
    const part = obj.slice(start, end).trim();
    if (!part) return;
    const m = part.match(/^([A-Za-z_$][\w$]*)\s*(?::\s*([\s\S]*))?$/);
    out.push(m ? [m[1], m[2] === undefined ? m[1] : m[2].trim()] : [null, part]);
  };
  for (let i = 1; i < obj.length - 1; i++) {
    const c = obj[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < obj.length && obj[i] !== c; i++) if (obj[i] === '\\') i++;
      continue;
    }
    if ('({['.includes(c)) depth++;
    else if (')}]'.includes(c)) depth--;
    else if (c === ',' && depth === 0) { push(i); start = i + 1; }
  }
  push(obj.length - 1);
  return out;
}
// Each `mountFlaskActionMenu(node, { … })` call: where it is, and its `plan` value.
function menuMounts(src) {
  const out = [];
  for (const m of src.matchAll(/\bmountFlaskActionMenu\(/g)) {
    const call = balanced(src, m.index + m[0].length - 1);
    const brace = call ? call.indexOf('{') : -1;
    const obj = brace >= 0 ? balanced(call, brace) : null;
    const plan = obj ? props(obj).find(([key]) => key === 'plan') : null;
    out.push({ at: m.index, plan: plan ? plan[1] : null });
  }
  return out;
}

check('one pure flaskActionPlan owns action availability', typeof actions?.flaskActionPlan === 'function');
if (actions?.flaskActionPlan) {
  const combatPlan = actions.flaskActionPlan({ context: 'combat', canUse: true, canDrop: false, canStore: false });
  const runPlan = actions.flaskActionPlan({ context: 'run', canUse: false, useReason: 'Combat only', canDrop: true, canStore: false });
  const storagePlan = actions.flaskActionPlan({ context: 'storage', canUse: false, useReason: 'Combat only', canDrop: false, canStore: true });
  check('combat offers Use and Inspect in stable order', combatPlan.actions.map((a) => a.id).join(',') === 'use,inspect');
  check('run and storage contexts expose Drop or Store explicitly',
    runPlan.actions.some((a) => a.id === 'drop') && storagePlan.actions.some((a) => a.id === 'store'));
  check('disabled actions always carry a reason', [...runPlan.actions, ...storagePlan.actions].every((a) => a.enabled || a.reason));
  check('selection itself is inert', combatPlan.commitOnSelect === false);
} else {
  check('combat offers Use and Inspect in stable order', false);
  check('run and storage contexts expose Drop or Store explicitly', false);
  check('disabled actions always carry a reason', false);
  check('selection itself is inert', false);
}

// MAP HALF, on the live path: map.js mounts the Potions control; every flask
// menu that control opens is handed `planFor(entry)`; planFor is
// runPotionPlan; and runPotionPlan, driven for real, returns the shared plan.
// planFor is matched as the WHOLE statement, through its closing `);`, so a
// transform of the helper's result (`runPotionPlan(...).actions`) goes red.
// BOUNDARY: the options argument must be a flat `{ ... }` with no nested
// braces (the shipped `{ drinkOutsideCombat }` is). A nested-object options
// argument fails closed here; widen the match only when the code needs it.
const mapCode = code(map);
const runPotionsCode = code(runPotions);
const potionMounts = menuMounts(runPotionsCode);
// BEHAVIOURAL, not a source match (three review rounds of `….actions`-style
// bypasses ended the regex approach): import the real model and drive
// runPotionPlan on fixture entries, a carried potion and a charge flask (with
// charges and empty), with "Use flasks outside combat" on and off. Each result
// must deep-equal what the shared flaskActionPlan returns for the inputs the
// model documents, and its `.actions` must be an array of the shared action ids
// in the shared order. Any transform of the helper's result goes red here.
let modelShares = false;
try {
  const model = await import('../src/ui/models/RunPotionModel.js');
  const { t } = await import('../src/ui/strings.js');
  const shared = actions.flaskActionPlan;
  const ids = (plan) => plan.actions.map((row) => row.id);
  const sharedIds = ids(shared({ context: 'run' }));
  const cases = [];
  for (const drinkOutsideCombat of [false, true]) {
    cases.push([{ category: 'carried', flaskId: 'fixture-potion', count: 1 }, { drinkOutsideCombat },
      { context: 'run', canUse: false, useReason: t('potions.run.combatOnly'), canDrop: true }]);
    for (const count of [2, 0]) {
      cases.push([{ category: 'charge', kind: 'hp', count }, { drinkOutsideCombat },
        { context: 'run', canUse: drinkOutsideCombat && count > 0,
          useReason: count <= 0 ? t('potions.run.empty') : t('potions.run.setting'),
          canDrop: false, dropReason: t('potions.run.keep') }]);
    }
  }
  modelShares = cases.every(([entry, opts, inputs]) => {
    const got = model.runPotionPlan(entry, opts);
    return !!got && Array.isArray(got.actions)
      && JSON.stringify(ids(got)) === JSON.stringify(sharedIds)
      && isDeepStrictEqual(got, shared(inputs));
  });
} catch { modelShares = false; /* observed red */ }
const mapShares = /import \{[^}]*\bmountRunPotions\b[^}]*\} from '\.\.\/components\/runPotions\.js'/.test(mapCode)
  && /\bmountRunPotions\(potionsHost, \{/.test(mapCode)
  && /import \{[^}]*\brunPotionPlan\b[^}]*\} from '\.\.\/models\/RunPotionModel\.js'/.test(runPotionsCode)
  && /const planFor = \(entry\) => runPotionPlan\(entry(?:, \{[^{}]*\})?\);/.test(runPotionsCode)
  && potionMounts.length > 0 && potionMounts.every((mount) => mount.plan === 'planFor(entry)')
  && /import \{ flaskActionPlan \} from '\.\.\/\.\.\/model\/flaskActions\.js'/.test(runPotionModel)
  && modelShares;
check('combat and map menus share action availability',
  /mountFlaskActionMenu/.test(component)
    && /const action = flaskActionPlan\(\{ context: 'combat', canUse, useReason: reason \}\)/.test(potions) && /openCombatPotions\(/.test(combat)
    && mapShares);
// The run HUD's room-rail flask icons (switched off by config today, so this
// never stands in for the map): each menu it mounts takes the `plan` shorthand
// bound by `const plan = flaskActionPlan({` in that same activate block.
const runHudCode = code(runHud);
// The WHOLE initializer: `flaskActionPlan({ … })` and then the statement's `;`,
// so `flaskActionPlan({ … }).actions` (or any other tail) goes red. The run
// HUD's activate path needs a DOM, so this half stays a source check.
function wholeInit(block) {
  const m = block.match(/\bconst plan = flaskActionPlan\(/);
  const call = m ? balanced(block, m.index + m[0].length - 1) : null;
  return !!call && /^\s*;/.test(block.slice(m.index + m[0].length - 1 + call.length));
}
const hudMounts = menuMounts(runHudCode);
check('every run-HUD flask menu is fed by the shared action plan',
  /import \{ flaskActionPlan \} from '\.\.\/\.\.\/model\/flaskActions\.js'/.test(runHud)
    && hudMounts.length > 0 && hudMounts.every((mount) => {
      if (mount.plan !== 'plan') return false;
      const block = runHudCode.slice(runHudCode.lastIndexOf('activate: (node) => {', mount.at), mount.at);
      return /activate: \(node\) => \{/.test(block)
        && (block.match(/\bconst plan = flaskActionPlan\(\{/g) || []).length === 1
        && (block.match(/\bplan\s*=[^=]/g) || []).length === 1
        && wholeInit(block);
    }));
check('menu supports focus navigation, cancel, and back without dispatch',
  /focusFirst|\.focus\(/.test(component) && /Escape|cancel/i.test(component)
    && /onCancel/.test(component) && /remove\(\)/.test(component));
check('flask selection does not call useFlask directly',
  /if \(action.enabled\) arm\(use, 'useFlask', \{[\s\S]*?onConfirm: \(\) => \{[\s\S]*?onUse\(row\)/.test(potions)
    && /onUse: [\s\S]*?else useFlask\(slot, null, chargeKind\)/.test(combat)
    && /fold.addEventListener\('toggle', moveUse\)/.test(potions));
check('co-op flask selection also opens the shared Potions list instead of sending use',
  /openCombatPotions\(/.test(coop) && /combat-potions/.test(potions) && !/send\(\{ t: 'useFlask'/.test(coop));
check('co-op transports an explicit flask intent to host authority',
  /flaskIntent/.test(session) && /host/i.test(session) && /useFlask/.test(session));
check('LAN routes only the explicit flaskIntent action through the host',
  /case 'flaskIntent'/.test(lan) && /g\.flaskIntent/.test(lan));
check('host refusal remains a returned reason rather than client mutation',
  /flaskIntent[\s\S]*?ok:\s*false[\s\S]*?error/.test(session));

console.log(`\nflask-action-contract: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
