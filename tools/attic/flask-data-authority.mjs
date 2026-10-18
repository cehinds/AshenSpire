#!/usr/bin/env node

// Data-authority contract for capacity, charge identity, and Grace labels.
// Layout is out of scope; every check is model/content/source semantic.
//
// DOOR. Real input enters two ways: the content bundle by import, and the
// production sources by readFileSync of the files named in `sources` below.
// The MUTANT lines at the foot test only the acceptance predicates on
// hand-typed strings — Vira's doors audit (2026-08-14) rated that DOWNSTREAM:
// no plant walked the readFileSync road, so a shape drift in a real file
// could blind the regex while the plants stayed green. `--selftest` is the
// repair: each plant is written INTO A COPY of the real source file on disk
// and this whole tool re-runs against that copy — the same road, observed red.

import fs from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as G from '../src/model/gracerefill.js';

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'flask-data-authority.mjs',
    plants: [
      {
        name: 'silent fallback 3 ships in a carry-cap reader',
        file: 'src/model/gracerefill.js',
        append: "export const plantedCarryCap = (balance) => balance.flaskSlots || 3;",
        expectRed: /FAIL production carry-cap readers have no silent fallback 3/,
      },
      {
        name: 'a charge id is retyped in the engine',
        file: 'src/engine/combat.js',
        append: "export const plantedFlaskId = 'crimsonFlask';",
        expectRed: /FAIL solo\/co-op\/UI\/migration do not retype charge ids/,
      },
      {
        name: 'the Grace screen hardcodes a flask label',
        file: 'src/ui/screens/rest.js',
        append: "const plantedGraceLabel = 'Fixed capacity — Crimson & Azure';",
        expectRed: /FAIL Grace allocation does not hardcode Crimson\/Azure labels/,
      },
    ],
  }));
}

const R = createRegistries(contentBundle);
const read = (p) => fs.readFileSync(p, 'utf8');
const sources = {
  grace: read('src/model/gracerefill.js'),
  actions: read('src/engine/actions.js'),
  combat: read('src/engine/combat.js'),
  coop: read('src/engine/coopCombat.js'),
  state: read('src/model/state.js'),
  soloUi: read('src/ui/screens/combat.js'),
  coopUi: read('src/ui/screens/coop.js'),
  rest: read('src/ui/screens/rest.js'),
  shop: read('src/ui/screens/shop.js'),
  reward: read('src/ui/screens/reward.js'),
  session: read('tools/session.mjs'),
};
let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

check('flaskCapacity reads the authored positive integer', G.flaskCapacity(R.balance) === 3);
check('flaskCapacity refuses missing', throws(() => G.flaskCapacity({})));
check('flaskSlotCap reads the authored positive integer', G.flaskSlotCap(R.balance) === 3);
check('flaskSlotCap refuses missing', throws(() => G.flaskSlotCap({})));
check('flaskSlotCap refuses zero', throws(() => G.flaskSlotCap({ flaskSlots: 0 })));
check('flaskSlotCap refuses fractional', throws(() => G.flaskSlotCap({ flaskSlots: 2.5 })));
check('flaskSlotCap refuses string', throws(() => G.flaskSlotCap({ flaskSlots: '3' })));

const productionReaders = [sources.grace, sources.actions, sources.shop, sources.reward, sources.session].join('\n');
check('production carry-cap readers have no silent fallback 3',
  !/(?:flaskSlots[^\n]{0,80}(?:\|\||:)\s*3\b|cap[^\n]{0,60}\?[^\n]{0,60}:\s*3\b)/.test(productionReaders));

check('chargeFlaskDefinition is exported', typeof G.chargeFlaskDefinition === 'function');
check('chargeFlaskId is exported', typeof G.chargeFlaskId === 'function');
check('chargeKindForFlask is exported', typeof G.chargeKindForFlask === 'function');
if (typeof G.chargeFlaskDefinition === 'function' && typeof G.chargeFlaskId === 'function'
  && typeof G.chargeKindForFlask === 'function') {
  check('HP charge definition resolves from authored effects', G.chargeFlaskDefinition(R, 'hp')?.name === 'Crimson Flask');
  check('Mana charge definition resolves from authored effects', G.chargeFlaskDefinition(R, 'mana')?.name === 'Azure Flask');
  check('kind-to-id and id-to-kind round-trip', ['hp', 'mana'].every((kind) => {
    const id = G.chargeFlaskId(R, kind);
    return G.chargeKindForFlask(R, id) === kind;
  }));
  const renamedDefs = R.flasks.all().map((def) => def.id === 'crimsonFlask'
    ? { ...def, id: 'emberVial', name: 'Ember Vial' } : def);
  const renamed = { ...R, flasks: { all: () => renamedDefs, ids: () => renamedDefs.map((d) => d.id), get: (id) => renamedDefs.find((d) => d.id === id) } };
  check('renaming an authored charge requires no resolver edit',
    G.chargeFlaskId(renamed, 'hp') === 'emberVial' && G.chargeKindForFlask(renamed, 'emberVial') === 'hp');
} else {
  for (const name of ['HP definition resolves', 'Mana definition resolves', 'kind/id round-trip', 'renamed authored charge resolves']) check(name, false);
}

const duplicatedIds = [sources.combat, sources.coop, sources.state, sources.soloUi, sources.coopUi].join('\n');
check('solo/co-op/UI/migration do not retype charge ids',
  !/['"](?:crimsonFlask|azureFlask)['"]/.test(duplicatedIds));
check('Grace allocation resolves charge definitions', /chargeFlaskDefinition/.test(sources.rest));
check('Grace allocation does not hardcode Crimson/Azure labels',
  !/Fixed capacity[^\n]*(?:Crimson|Azure)/.test(sources.rest));

// Known-bad plants each pair a clean fixture with the duplicate it must catch.
const plants = [
  ['fallback 3', 'const cap=flaskSlotCap(balance)', 'const cap=balance.flaskSlots||3', (s) => !/\|\|\s*3/.test(s)],
  ['charge id literal', 'const id=chargeFlaskId(R,kind)', "const id='crimsonFlask'", (s) => !/['"]crimsonFlask['"]/.test(s)],
  ['Grace name literal', 'const name=def.name', "const name='Crimson'", (s) => !/['"]Crimson['"]/.test(s)],
];
for (const [name, clean, planted, accepts] of plants) {
  check(`MUTANT ${name}`, accepts(clean) && !accepts(planted));
}

console.log(`RESULT ${pass}/${pass + fail}`);
console.log('DOOR: sources entered by readFileSync of the real files named above; content by the real');
console.log('      bundle import. The MUTANT rows above test predicates only; the same-door known-bads');
console.log('      live in `--selftest`, which plants each defect into a copy of the real file and');
console.log('      re-runs this whole tool against it (observed red 2026-08-15, re-runnable).');
process.exitCode = fail ? 1 : 0;
