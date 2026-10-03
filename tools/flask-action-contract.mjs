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
        name: 'combat drives its Use control from an action other than use in the shared plan',
        file: 'src/ui/components/combatActionRow.js',
        find: ".actions.find(r => r.id === 'use');",
        replace: ".actions.find(r => r.id === 'inspect');",
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'applyRunPotion stops consulting the plan it is handed',
        file: 'src/ui/models/RunPotionModel.js',
        find: 'const action = plan.actions.find((row) => row.id === actionId);',
        replace: 'const action = { id: actionId, enabled: true };',
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
        name: 'the map hands its Potions control a stand-in run instead of the live one',
        file: 'src/ui/screens/map.js',
        find: 'mountRunPotions(potionsHost, { registries, run, meta,',
        replace: 'mountRunPotions(potionsHost, { registries, run: { flasks: [], flaskCharges: {} }, meta,',
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the map hands its Potions control a second run after the live one',
        file: 'src/ui/screens/map.js',
        find: 'mountRunPotions(potionsHost, { registries, run, meta,',
        replace: 'mountRunPotions(potionsHost, { registries, run, run: { flasks: [] }, meta,',
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the map Potions control ignores the "Use flasks outside combat" setting',
        file: 'src/ui/components/runPotions.js',
        find: "const drinkOutsideCombat = settingOn(meta.settings, 'useRestorativeFlasksOutsideCombat');",
        replace: 'const drinkOutsideCombat = false;',
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the map Potions control reads a different setting for outside-combat drinking',
        file: 'src/ui/components/runPotions.js',
        find: "const drinkOutsideCombat = settingOn(meta.settings, 'useRestorativeFlasksOutsideCombat');",
        replace: "const drinkOutsideCombat = settingOn(meta.settings, 'reducedMotion');",
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'combat offers Use always-enabled while the expected lookup survives only in a comment',
        file: 'src/ui/components/combatActionRow.js',
        find: "const action = flaskActionPlan({ context: 'combat', canUse, useReason: reason }).actions.find(r => r.id === 'use');",
        replace: "const action = { id: 'use', enabled: true, reason: '' }; // const action = flaskActionPlan({ context: 'combat', canUse, useReason: reason }).actions.find(r => r.id === 'use');",
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'one run-HUD charge flask is always usable, ignoring the setting and its charges',
        file: 'src/ui/components/runHud.js',
        find: "const canUse = settingOn(meta.settings, 'useRestorativeFlasksOutsideCombat') && current > 0;",
        replace: 'const canUse = true;',
        expectRed: /FAIL every run-HUD flask menu is fed by the shared action plan/,
      },
      {
        name: 'the run HUD comments out the shared import and plans with a local stand-in',
        file: 'src/ui/components/runHud.js',
        find: "import { flaskActionPlan } from '../../model/flaskActions.js';",
        replace: "// import { flaskActionPlan } from '../../model/flaskActions.js';\nconst flaskActionPlan = () => ({ actions: [] });",
        expectRed: /FAIL every run-HUD flask menu is fed by the shared action plan/,
      },
      {
        name: 'the map Potions model gives the Azure (mana) flask an empty plan',
        file: 'src/ui/models/RunPotionModel.js',
        find: "  if (entry.category === 'charge') {\n",
        replace: "  if (entry.category === 'charge' && entry.kind === 'mana') return { actions: [], commitOnSelect: false };\n  if (entry.category === 'charge') {\n",
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the Potions control aliases the shared runPotionPlan and plans with a local stand-in',
        file: 'src/ui/components/runPotions.js',
        find: "import { applyRunPotion, runPotionPlan, runPotionRows, runPotionVerb } from '../models/RunPotionModel.js';",
        replace: "import { applyRunPotion, runPotionPlan as sharedRunPotionPlan, runPotionRows, runPotionVerb } from '../models/RunPotionModel.js';\nconst runPotionPlan = () => ({ actions: [] });",
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the map aliases the shared mountRunPotions and mounts a local stand-in',
        file: 'src/ui/screens/map.js',
        find: "import { mountRunPotions } from '../components/runPotions.js';",
        replace: "import { mountRunPotions as sharedMountRunPotions } from '../components/runPotions.js';\nconst mountRunPotions = () => {};",
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the Potions control hard-codes outside-combat drinking on instead of forwarding the setting',
        file: 'src/ui/components/runPotions.js',
        find: 'const planFor = (entry) => runPotionPlan(entry, { drinkOutsideCombat });',
        replace: 'const planFor = (entry) => runPotionPlan(entry, { drinkOutsideCombat: true });',
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the Potions control drops the options, so the setting never reaches the plan',
        file: 'src/ui/components/runPotions.js',
        find: 'const planFor = (entry) => runPotionPlan(entry, { drinkOutsideCombat });',
        replace: 'const planFor = (entry) => runPotionPlan(entry);',
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'combat offers Use whatever useReason(row) says',
        file: 'src/ui/components/combatActionRow.js',
        find: 'const canUse = !reason;',
        replace: 'const canUse = true;',
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the map Potions control drops its registries binding',
        file: 'src/ui/screens/map.js',
        find: 'mountRunPotions(potionsHost, { registries, run, meta,',
        replace: 'mountRunPotions(potionsHost, { registries: {}, run, meta,',
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'applyRunPotion drinks a charge flask without consulting the plan',
        file: 'src/ui/models/RunPotionModel.js',
        find: '  const action = plan.actions.find((row) => row.id === actionId);\n',
        replace: "  if (actionId === 'use' && entry.category === 'charge') { useRunChargeFlask({ run, registries, rng: null, kind: entry.kind }); return true; }\n  const action = plan.actions.find((row) => row.id === actionId);\n",
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
        name: 'one run-HUD flask menu is handed a second plan property that overrides the shared one',
        file: 'src/ui/components/runHud.js',
        find: '          def,\n          plan,\n',
        replace: '          def,\n          plan,\n          plan: {},\n',
        all: false,
        expectRed: /FAIL every run-HUD flask menu is fed by the shared action plan/,
      },
      {
        name: 'the map Potions control hands its flask menu a second plan property after the shared one',
        file: 'src/ui/components/runPotions.js',
        find: 'def, plan: planFor(entry), charges:',
        replace: 'def, plan: planFor(entry), plan: { actions: [] }, charges:',
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the Potions list reads each row verb from a plan that is not the shared one',
        file: 'src/ui/components/runPotions.js',
        find: 'const verb = runPotionVerb(entry, planFor(entry));',
        replace: 'const verb = runPotionVerb(entry, { actions: [] });',
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the Potions action handler authorizes against a plan that is not the shared one',
        file: 'src/ui/components/runPotions.js',
        find: 'applyRunPotion({ registries, run, entry, actionId, plan: planFor(entry) })',
        replace: 'applyRunPotion({ registries, run, entry, actionId, plan: { actions: [] } })',
        expectRed: /FAIL combat and map menus share action availability/,
      },
      {
        name: 'the Potions model reads the row verb from somewhere other than the plan it is handed',
        file: 'src/ui/models/RunPotionModel.js',
        find: "return plan.actions.find((action) => action.id === (entry.category === 'charge' ? 'use' : 'drop'));",
        replace: "return { id: entry.category === 'charge' ? 'use' : 'drop', enabled: true, reason: '' };",
        expectRed: /FAIL combat and map menus share action availability/,
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
// The argument must carry EXACTLY ONE top-level `plan` and no spread (or other
// unkeyed) entry: a second `plan:` or a `...rest` after it would override the
// one checked, so either makes `plan` null and the mount red.
function menuMounts(src) {
  const out = [];
  for (const m of src.matchAll(/\bmountFlaskActionMenu\(/g)) {
    const call = balanced(src, m.index + m[0].length - 1);
    const brace = call ? call.indexOf('{') : -1;
    const obj = brace >= 0 ? balanced(call, brace) : null;
    const entries = obj ? props(obj) : [];
    const plans = entries.filter(([key]) => key === 'plan');
    const unkeyed = entries.some(([key]) => key === null);
    out.push({ at: m.index, plan: plans.length === 1 && !unkeyed ? plans[0][1] : null });
  }
  return out;
}

// BOUNDARY (source half). The runHud.js and runPotions.js mount checks, the
// planFor statement match and the runHud `const plan` initializer match are
// SOURCE checks. They prove the shipped form against accidental drift; they do
// not recognise every equivalent JavaScript spelling, and an unrecognised
// spelling fails closed (red), never open. The map's plan path is BEHAVIOURAL:
// runPotionPlan is imported and driven below. A review finding that builds a
// deliberately adversarial spelling beyond the shipped form is answered with
// this boundary and, where cheap, a must-fail plant; the matchers are not
// widened to chase it.

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
// BOUNDARY: the options argument must be exactly the shipped
// `{ drinkOutsideCombat }` shorthand, which forwards the derived setting. Any
// other options argument (a constant, a nested object, none) fails closed.
// Scope cap (D36): a derivation a source check cannot prove is left to the
// real-browser flask-menu test recorded in FINISH §11, not chased here.
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
  // Every shipped charge-flask kind (Crimson and Azure), from the one list
  // the game uses, so a kind-specific branch cannot slip past.
  const { CHARGE_FLASK_KINDS } = await import('../src/model/gracerefill.js');
  if (!CHARGE_FLASK_KINDS.length) throw new Error('no charge-flask kinds');
  const cases = [];
  for (const drinkOutsideCombat of [false, true]) {
    cases.push([{ category: 'carried', flaskId: 'fixture-potion', count: 1 }, { drinkOutsideCombat },
      { context: 'run', canUse: false, useReason: t('potions.run.combatOnly'), canDrop: true }]);
    for (const kind of CHARGE_FLASK_KINDS) for (const count of [2, 0]) {
      cases.push([{ category: 'charge', kind, count }, { drinkOutsideCombat },
        { context: 'run', canUse: drinkOutsideCombat && count > 0,
          useReason: count <= 0 ? t('potions.run.empty') : t('potions.run.setting'),
          canDrop: false, dropReason: t('potions.run.keep') }]);
    }
  }
  modelShares = cases.every(([entry, opts, inputs]) => {
    const got = model.runPotionPlan(entry, opts);
    const verb = typeof model.runPotionVerb === 'function' ? model.runPotionVerb(entry, got) : null;
    return !!got && Array.isArray(got.actions)
      && JSON.stringify(ids(got)) === JSON.stringify(sharedIds)
      && isDeepStrictEqual(got, shared(inputs))
      // The Potions list's row verb is read from that same plan.
      && !!verb && verb.id === (entry.category === 'charge' ? 'use' : 'drop')
      && got.actions.includes(verb);
  });
  // applyRunPotion is the last gate: it must authorize against the plan it is
  // handed. Drive it on a carried potion: drop under a plan that enables drop
  // removes one, under a plan that refuses drop (or lacks the action) changes
  // nothing.
  const carried = { category: 'carried', flaskId: 'fixture-potion', count: 1 };
  const runWith = () => ({ flasks: [{ flaskId: 'fixture-potion' }] });
  const apply = (plan, actionId = 'drop') => {
    const run = runWith();
    const changed = model.applyRunPotion({ registries: {}, run, entry: carried, actionId, plan });
    return { changed, left: run.flasks.length };
  };
  const allowed = apply(shared({ context: 'run', canUse: false, useReason: 'x', canDrop: true }));
  const refused = apply(shared({ context: 'run', canUse: false, useReason: 'x', canDrop: false, dropReason: 'x' }));
  const missing = apply({ actions: [] });
  // And on a charge flask (the Drink verb): use under a plan that enables use
  // spends exactly one charge; under a plan that refuses use (or lacks the
  // action) the charges are untouched. Real registries and a real run, so an
  // early charge branch that skips the plan goes red.
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { createRunState } = await import('../src/model/state.js');
  const registries = createRegistries(contentBundle);
  const drink = (kind, plan) => {
    const run = createRunState({ seed: 0x5eed, classId: 'reaver', registries });
    const key = `${kind}Current`;
    run.flaskCharges[key] = Math.max(1, run.flaskCharges[key] || 0);
    const before = run.flaskCharges[key];
    let changed;
    try { changed = model.applyRunPotion({ registries, run, entry: { category: 'charge', kind, count: before }, actionId: 'use', plan }); }
    catch { changed = 'threw'; }
    return { changed, spent: before - run.flaskCharges[key] };
  };
  const drinks = CHARGE_FLASK_KINDS.map((kind) => [
    drink(kind, shared({ context: 'run', canUse: true, canDrop: false, dropReason: 'x' })),
    drink(kind, shared({ context: 'run', canUse: false, useReason: 'x', canDrop: false, dropReason: 'x' })),
    drink(kind, { actions: [] }),
  ]);
  modelShares = modelShares
    && allowed.changed === true && allowed.left === 0
    && refused.changed === false && refused.left === 1
    && missing.changed === false && missing.left === 1
    && drinks.every(([ok, refusedUse, missingUse]) => ok.changed === true && ok.spent === 1
      && refusedUse.changed === false && refusedUse.spent === 0
      && missingUse.changed === false && missingUse.spent === 0);
} catch { modelShares = false; /* observed red */ }
// Each `mountRunPotions(potionsHost, { … })` call must hand the control the
// live run: its argument carries exactly one each of the `registries`, `run`
// and `meta` shorthands (the screen's own bindings) and no spread or other
// unkeyed entry, so a stand-in `run: { flasks: [] }` goes red. Source check of
// the shipped form (see BOUNDARY above menuMounts).
const runPotionsMounts = [...mapCode.matchAll(/\bmountRunPotions\(potionsHost, /g)].map((m) => {
  const call = balanced(mapCode, m.index + m[0].length - 'potionsHost, '.length - 1);
  const brace = call ? call.indexOf('{') : -1;
  const obj = brace >= 0 ? balanced(call, brace) : null;
  if (!obj) return false;
  const entries = props(obj);
  if (entries.some(([key]) => key === null)) return false;
  return ['registries', 'run', 'meta'].every((name) => {
    const hits = entries.filter(([key]) => key === name);
    return hits.length === 1 && hits[0][1] === name;
  });
});
let settingReadsLive = false;
try {
  const { settingOn } = await import('../src/ui/screens/settings.js');
  const key = 'useRestorativeFlasksOutsideCombat';
  settingReadsLive = settingOn({ [key]: true }, key) === true && settingOn({ [key]: false }, key) === false;
} catch { settingReadsLive = false; /* observed red */ }
// A named import must be the binding itself (no `as` alias), and the file
// must not declare a local of the same name, so a same-named stand-in cannot
// take the shared helper's place. Comment-stripped source.
const importsShared = (src, name, from) => {
  const m = src.match(new RegExp(`import \\{([^}]*)\\} from '${from.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}'`));
  return !!m && m[1].split(',').map((part) => part.trim()).includes(name)
    && !new RegExp(`(?:\\b(?:const|let|var|function|class)\\s+${name}\\b|\\b${name}\\s*=[^=])`).test(src);
};
const mapShares = importsShared(mapCode, 'mountRunPotions', '../components/runPotions.js')
  && ['runPotionPlan', 'runPotionVerb', 'applyRunPotion'].every((name) => importsShared(runPotionsCode, name, '../models/RunPotionModel.js'))
  && runPotionsMounts.length > 0 && runPotionsMounts.every((ok) => ok)
  // planFor forwards the derived setting itself: exactly one planFor, and it
  // is the shipped `{ drinkOutsideCombat }` shorthand (no constant, no
  // omitted options).
  && (runPotionsCode.match(/\bplanFor\s*=[^=>]/g) || []).length === 1
  && /const planFor = \(entry\) => runPotionPlan\(entry, \{ drinkOutsideCombat \}\);/.test(runPotionsCode)
  // The live setting reaches the plan: `drinkOutsideCombat` is bound once,
  // from the player's "Use flasks outside combat" setting via settingOn, and
  // settingOn (imported and driven) reads that setting on and off. A constant
  // or another key would make Drink's availability ignore the setting.
  && /import \{ settingOn \} from '\.\.\/screens\/settings\.js'/.test(runPotionsCode)
  && (runPotionsCode.match(/\bdrinkOutsideCombat\s*=[^=>]/g) || []).length === 1
  && /\bconst drinkOutsideCombat = settingOn\(meta\.settings, 'useRestorativeFlasksOutsideCombat'\);/.test(runPotionsCode)
  && settingReadsLive
  && potionMounts.length > 0 && potionMounts.every((mount) => mount.plan === 'planFor(entry)')
  // The Potions LIST (openRunPotions) and the action handler use the same
  // planFor: each row's verb is `runPotionVerb(entry, planFor(entry))`, the
  // list is opened with the `planFor` shorthand, and every action is applied
  // through `applyRunPotion({ …, plan: planFor(entry) })`. Source checks of
  // the shipped form (see BOUNDARY above menuMounts).
  && /\bopenRunPotions\(\{ registries, run, opener: control, planFor, onAction: act \}\)/.test(runPotionsCode)
  && (runPotionsCode.match(/\brunPotionVerb\(/g) || []).length === 1
  && /\bconst verb = runPotionVerb\(entry, planFor\(entry\)\);/.test(runPotionsCode)
  && (runPotionsCode.match(/\bapplyRunPotion\(/g) || []).length === 1
  && /\bapplyRunPotion\(\{ registries, run, entry, actionId, plan: planFor\(entry\) \}\)/.test(runPotionsCode)
  && /import \{ flaskActionPlan \} from '\.\.\/\.\.\/model\/flaskActions\.js'/.test(runPotionModel)
  && modelShares;
check('combat and map menus share action availability',
  /mountFlaskActionMenu/.test(component)
    && (code(potions).match(/\bflaskActionPlan\(/g) || []).length === 1
    && /const action = flaskActionPlan\(\{ context: 'combat', canUse, useReason: reason \}\)\.actions\.find\(r => r\.id === 'use'\);/.test(code(potions))
    // combat's canUse is derived from the refusal reason: `!reason`, where
    // `reason = useReason(row)`, each bound exactly once.
    && (code(potions).match(/\bcanUse\s*=[^=>]/g) || []).length === 1
    && /\bconst canUse = !reason;/.test(code(potions))
    && (code(potions).match(/\breason\s*=[^=>]/g) || []).length === 1
    && /\bconst reason = useReason\(row\);/.test(code(potions))
    && /import \{ flaskActionPlan \} from '\.\.\/\.\.\/model\/flaskActions\.js'/.test(code(potions))
    && !/\bflaskActionPlan\s*=[^=]|function\s+flaskActionPlan\b/.test(code(potions))
    && /openCombatPotions\(/.test(code(combat))
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
  // Comment-stripped: a commented-out import beside a local stand-in is red.
  /import \{ flaskActionPlan \} from '\.\.\/\.\.\/model\/flaskActions\.js'/.test(runHudCode)
    && !/\bflaskActionPlan\s*=[^=]|function\s+flaskActionPlan\b/.test(runHudCode)
    // The availability inputs: every plan's `canUse` is either `false` or the
    // `canUse` shorthand, bound once from the live "Use flasks outside combat"
    // setting and the remaining charges (settingOn is imported and driven in
    // the map half above), so `const canUse = true` goes red.
    && /import \{ settingOn \} from '\.\.\/screens\/settings\.js'/.test(runHudCode)
    && (runHudCode.match(/\bcanUse\s*=[^=>]/g) || []).length === 1
    && /\bconst canUse = settingOn\(meta\.settings, 'useRestorativeFlasksOutsideCombat'\) && current > 0;/.test(runHudCode)
    && settingReadsLive
    && [...runHudCode.matchAll(/\bconst plan = flaskActionPlan\(/g)].every((m) => {
      const call = balanced(runHudCode, m.index + m[0].length - 1);
      const obj = call ? balanced(call, call.indexOf('{')) : null;
      const uses = obj ? props(obj).filter(([key]) => key === 'canUse') : [];
      return uses.length === 1 && (uses[0][1] === 'canUse' || uses[0][1] === 'false')
        && !props(obj).some(([key]) => key === null);
    })
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
