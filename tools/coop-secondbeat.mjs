#!/usr/bin/env node

// Co-op End Turn must ask the same action table as solo. This is intentionally
// placement-neutral: it inspects the control's semantic arming/lifecycle and
// the host intent, never its classes, geometry, or CSS.

import fs from 'node:fs';

const source = fs.readFileSync('src/ui/screens/coop.js', 'utf8');
const secondbeat = fs.readFileSync('src/model/secondbeat.js', 'utf8');
const hold = fs.readFileSync('src/ui/components/holdconfirm.js', 'utf8');
let pass = 0;
let fail = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  ok ? pass++ : fail++;
};

const directClick = /#coop-endturn[\s\S]{0,500}addEventListener\(['"]click['"],\s*\(\)\s*=>\s*send\(\{\s*t:\s*['"]endTurn['"]/;
const armed = /beatArmer\(meta,\s*registries\)/.test(source)
  && /arm\(et,\s*['"]endTurn['"],\s*\{[\s\S]{0,500}onConfirm/.test(source);

check('ACTIONS declares unconditional End Turn pointer protection',
  /endTurn:\s*\{[\s\S]{0,500}stakes:\s*['"]turn['"][\s\S]{0,200}hazard:\s*['"]pointing['"]/.test(secondbeat));
check('co-op imports the shared beat armer', /import \{ beatArmer \}/.test(source));
check('co-op creates the armer from profile settings and registries', /beatArmer\(meta,\s*registries\)/.test(source));
check('co-op End Turn pointer is armed under the canonical action id', armed);
check('co-op End Turn pointer has no direct click-to-host bypass', !directClick.test(source));
check('keyboard End Turn stays immediate for named-focus activation',
  /ev\.key === ['"]e['"][\s\S]{0,180}send\(\{\s*t:\s*['"]endTurn['"]/.test(source));
const lifecycleDisarms = [...source.matchAll(/if \(endTurnBeat\) endTurnBeat\(\);/g)].length;
check('render replacement disarms the old pointer lifecycle',
  lifecycleDisarms >= 2);
check('screen teardown disarms the active pointer lifecycle',
  /function teardown\(\)[\s\S]{0,500}if \(endTurnBeat\) endTurnBeat\(\);/.test(source));
check('shared armer derives hold duration from balance data',
  /registries\.balance\.ui\.holdConfirm/.test(hold));

// The old direct-click door must be caught even when all visual classes remain.
const planted = source + "\nconst et = app.querySelector('#coop-endturn'); et.addEventListener('click', () => send({ t: 'endTurn' }));";
check('MUTANT direct co-op click bypass is rejected', directClick.test(planted));

console.log(`RESULT ${pass}/${pass + fail}`);
process.exitCode = fail ? 1 : 0;
