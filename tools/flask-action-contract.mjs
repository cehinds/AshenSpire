#!/usr/bin/env node
// Placement-agnostic flask interaction contract. Selection opens a menu; it
// never spends state. Only a chosen action becomes a host-authorized intent.

import { readFileSync } from 'node:fs';
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
const map = text('src/ui/screens/map.js');
const session = text('tools/session.mjs');

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
check('co-op transports an explicit flask intent to host authority',
  /flaskIntent/.test(session) && /host/i.test(session) && /useFlask/.test(session));
check('host refusal remains a returned reason rather than client mutation',
  /flaskIntent[\s\S]*?ok:\s*false[\s\S]*?error/.test(session));

console.log(`\nflask-action-contract: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

