#!/usr/bin/env node
// Placement-agnostic flask interaction contract. Selection opens a menu; it
// never spends state. Only a chosen action becomes a host-authorized intent.

// DOOR. Two real doors: src/model/flaskActions.js is IMPORTED and its plan
// driven, and the UI/host sources are entered by readFileSync of the real
// files. `--selftest` plants each known-bad INTO A COPY of the real file on
// disk and re-runs this whole tool from that copy.
// (Vira's doors audit 2026-08-14 listed this tool NO-KNOWN-BAD.)
import { readFileSync } from 'node:fs';

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
        name: 'the combat screen calls useFlask on selection instead of opening the shared menu',
        file: 'src/ui/screens/combat.js',
        find: 'mountFlaskActionMenu',
        replace: 'plantedDirectUseFlask',
        all: true, // the token appears twice in the real file; half a plant is a false NOT-CAUGHT
        expectRed: /FAIL one shared menu surface is used in and out of combat/,
      },
      {
        name: 'LAN stops routing the explicit flaskIntent through the host',
        file: 'tools/lan.mjs',
        find: "case 'flaskIntent': g.flaskIntent(id, msg.intent); break;",
        replace: "case 'plantedFlask': g.useFlask(id, msg.slot); break;",
        expectRed: /FAIL LAN routes only the explicit flaskIntent action through the host/,
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
const coop = text('src/ui/screens/coop.js');
const map = text('src/ui/screens/map.js');
const session = text('tools/session.mjs');
const lan = text('tools/lan.mjs');

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

check('one shared menu surface is used in and out of combat',
  /mountFlaskActionMenu/.test(component) && /mountFlaskActionMenu/.test(combat) && /mountFlaskActionMenu/.test(map));
check('menu supports focus navigation, cancel, and back without dispatch',
  /focusFirst|\.focus\(/.test(component) && /Escape|cancel/i.test(component)
    && /onCancel/.test(component) && /remove\(\)/.test(component));
check('flask selection does not call useFlask directly',
  /mountFlaskActionMenu/.test(combat)
    && !/flask-slot[\s\S]{0,500}(?:onConfirm|click)[\s\S]{0,120}useFlask/.test(combat));
check('co-op flask selection also opens the shared menu instead of sending use',
  /mountFlaskActionMenu/.test(coop) && !/coop-flask[\s\S]{0,500}send\(\{ t: 'useFlask'/.test(coop));
check('co-op transports an explicit flask intent to host authority',
  /flaskIntent/.test(session) && /host/i.test(session) && /useFlask/.test(session));
check('LAN routes only the explicit flaskIntent action through the host',
  /case 'flaskIntent'/.test(lan) && /g\.flaskIntent/.test(lan));
check('host refusal remains a returned reason rather than client mutation',
  /flaskIntent[\s\S]*?ok:\s*false[\s\S]*?error/.test(session));

console.log(`\nflask-action-contract: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
