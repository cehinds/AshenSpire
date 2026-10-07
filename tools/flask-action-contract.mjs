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
        name: 'applyRunPotion stops consulting the plan it is handed',
        file: 'src/ui/models/RunPotionModel.js',
        find: 'const action = plan.actions.find((row) => row.id === actionId);',
        replace: 'const action = { id: actionId, enabled: true };',
        expectRed: /FAIL the map Potions model hands every entry the shared action plan/,
      },
      {
        name: 'LAN stops routing the explicit flaskIntent through the host',
        file: 'tools/lan.mjs',
        find: "case 'flaskIntent': g.flaskIntent(id, msg.intent); break;",
        replace: "case 'plantedFlask': g.useFlask(id, msg.slot); break;",
        expectRed: /FAIL LAN routes only the explicit flaskIntent action through the host/,
      },
      {
        name: 'the map Potions model gives the Azure (mana) flask an empty plan',
        file: 'src/ui/models/RunPotionModel.js',
        find: "  if (entry.category === 'charge') {\n",
        replace: "  if (entry.category === 'charge' && entry.kind === 'mana') return { actions: [], commitOnSelect: false };\n  if (entry.category === 'charge') {\n",
        expectRed: /FAIL the map Potions model hands every entry the shared action plan/,
      },
      {
        name: 'applyRunPotion drinks a charge flask without consulting the plan',
        file: 'src/ui/models/RunPotionModel.js',
        find: '  const action = plan.actions.find((row) => row.id === actionId);\n',
        replace: "  if (actionId === 'use' && entry.category === 'charge') { useRunChargeFlask({ run, registries, rng: null, kind: entry.kind }); return true; }\n  const action = plan.actions.find((row) => row.id === actionId);\n",
        expectRed: /FAIL the map Potions model hands every entry the shared action plan/,
      },
      {
        name: 'the map Potions model stops building its plan with the shared flaskActionPlan',
        file: 'src/ui/models/RunPotionModel.js',
        find: "  return flaskActionPlan({ context: 'run', canUse: false, useReason: t('potions.run.combatOnly'), canDrop: true });",
        replace: "  return { actions: [], commitOnSelect: false };",
        expectRed: /FAIL the map Potions model hands every entry the shared action plan/,
      },
      {
        name: 'the map Potions model returns only the shared plan\'s actions array, not the plan',
        file: 'src/ui/models/RunPotionModel.js',
        find: "  return flaskActionPlan({ context: 'run', canUse: false, useReason: t('potions.run.combatOnly'), canDrop: true });",
        replace: "  return flaskActionPlan({ context: 'run', canUse: false, useReason: t('potions.run.combatOnly'), canDrop: true }).actions;",
        expectRed: /FAIL the map Potions model hands every entry the shared action plan/,
      },
      {
        name: 'the map Potions model hands a charge flask the shared plan\'s actions array, not the plan',
        file: 'src/ui/models/RunPotionModel.js',
        find: "      dropReason: t('potions.run.keep'),\n    });",
        replace: "      dropReason: t('potions.run.keep'),\n    }).actions;",
        expectRed: /FAIL the map Potions model hands every entry the shared action plan/,
      },
      {
        name: 'the Potions model reads the row verb from somewhere other than the plan it is handed',
        file: 'src/ui/models/RunPotionModel.js',
        find: "return plan.actions.find((action) => action.id === (entry.category === 'charge' ? 'use' : 'drop'));",
        replace: "return { id: entry.category === 'charge' ? 'use' : 'drop', enabled: true, reason: '' };",
        expectRed: /FAIL the map Potions model hands every entry the shared action plan/,
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
const session = text('tools/session.mjs');
const lan = text('tools/lan.mjs');

// WHAT THE BROWSER NOW OWNS (FINISH §11, D36). The source half that read
// combat's Potions list, the map's Potions control (screens/map.js →
// components/runPotions.js) and the run HUD's room-rail menus
// (components/runHud.js) is gone: tools/flask-menu-probe.mjs opens each of
// those menus in Chromium and compares what it offers to flaskActionPlan for
// the Crimson and Azure flasks (setting off and on, full and empty), drives
// every map Potions choice for what it does, and proves a Potions action and a
// "Use flasks outside combat" change are saved and survive the map's remount.
// Its own --selftest carries the plants that used to live here for those
// paths. What stays below is what that probe does not cover: the pure plan,
// the map model driven in Node, the menu's cancel contract, combat's
// confirm-before-use wiring, and co-op's host-authorized intent.

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

// THE MAP MODEL, BEHAVIOURAL (three review rounds of `….actions`-style
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
// The setting the map reads is the player's "Use flasks outside combat",
// through settingOn: driven on and off.
let settingReadsLive = false;
try {
  const { settingOn } = await import('../src/ui/screens/settings.js');
  const key = 'useRestorativeFlasksOutsideCombat';
  settingReadsLive = settingOn({ [key]: true }, key) === true && settingOn({ [key]: false }, key) === false;
} catch { settingReadsLive = false; /* observed red */ }
check('the map Potions model hands every entry the shared action plan', modelShares && settingReadsLive);
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
