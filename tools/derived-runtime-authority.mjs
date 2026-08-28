#!/usr/bin/env node

// Runtime authority contract for Energy and Draw. The run's versioned derived
// snapshot plus persisted outputs are the only combat/session authority; this
// tool deliberately says nothing about their visual placement.

// DOOR. Real input enters two ways: the model/engine modules are IMPORTED and
// driven (createRunState → save/load → combat → co-op → session resume), and
// the runtime sources are read by readFileSync for the fallback clause. The
// MUTANT lines at the foot test the predicates on hand-typed strings — the
// regex, not the road. `--selftest` plants each known-bad INTO A COPY of the
// real module on disk and re-runs this whole tool against it.
// (Vira's doors audit 2026-08-14 listed this tool NO-KNOWN-BAD.)
import fs from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import {
  createRunState, deserializeRun, initializeRunDerivedStats, serializeRun,
  validateRunShape,
} from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat } from '../src/engine/combat.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';
import { createSession, restoreSession } from './session.mjs';

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'derived-runtime-authority.mjs',
    plants: [
      {
        name: 'live content drift rewrites the persisted Energy/Draw stamp',
        file: 'src/model/state.js',
        find: '  const existing = snapshot || run.derivedStatRuleSnapshot;',
        replace: '  const existing = snapshot || undefined; // planted: the persisted snapshot is ignored',
        expectRed: /FAIL live content drift cannot rewrite persisted (Energy|Draw)/,
      },
      {
        name: 'a stamp/snapshot contradiction is accepted instead of thrown',
        file: 'src/model/state.js',
        find: 'if (value !== expected) throw new Error(`Persisted ${key} ${value} contradicts derived-stat snapshot value ${expected}`);',
        replace: '/* planted: contradiction accepted */',
        expectRed: /FAIL current stamped run refuses (energyMax|drawPerTurn)\/snapshot contradiction/,
      },
      {
        name: 'combat accepts an unstamped caller (the silent fallback door)',
        file: 'src/model/state.js',
        find: "if (!Number.isInteger(energyMax) || energyMax < 0) throw new Error('Player combat entity requires stamped non-negative integer energyMax');",
        replace: 'if (!Number.isInteger(energyMax) || energyMax < 0) energyMax = 3; // planted fallback',
        expectRed: /FAIL solo combat refuses an unstamped caller/,
      },
      {
        name: 'a fallback Energy 3 ships in the runtime',
        file: 'src/engine/combat.js',
        append: 'export const plantedEnergy = (run) => run.energyMax ?? 3;',
        expectRed: /FAIL runtime has no fallback Energy 3 or Draw 5/,
      },
    ],
  }));
}

const R = createRegistries(contentBundle);
const source = (path) => fs.readFileSync(path, 'utf8');
const sources = {
  combat: source('src/engine/combat.js'),
  coop: source('src/engine/coopCombat.js'),
  state: source('src/model/state.js'),
};
let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};
const throws = (fn) => { try { fn(); return false; } catch { return true; } };
const clone = (value) => structuredClone(value);

const run = createRunState({ seed: 41, classId: 'starseer', registries: R });
const stamped = { energyMax: run.energyMax, drawPerTurn: run.drawPerTurn };
check('fresh run stamps finite integer Energy and Draw',
  Number.isInteger(stamped.energyMax) && stamped.energyMax >= 0
  && Number.isInteger(stamped.drawPerTurn) && stamped.drawPerTurn >= 0);
check('fresh run owns a versioned derived-rule snapshot',
  run.derivedStatRuleSnapshot?.rulesetVersion === R.derivedStatRules.rulesetVersion);

for (const key of ['energyMax', 'drawPerTurn']) {
  const missing = clone(run);
  delete missing[key];
  check(`current stamped run refuses missing ${key}`,
    throws(() => initializeRunDerivedStats(missing, R)));

  const invalid = clone(run);
  invalid[key] = 2.5;
  check(`run shape refuses fractional ${key}`, validateRunShape(invalid).some((p) => p.includes(key)));

  const contradictory = clone(run);
  contradictory[key] += 1;
  check(`current stamped run refuses ${key}/snapshot contradiction`,
    throws(() => initializeRunDerivedStats(contradictory, R)));
}

const driftBundle = { ...contentBundle, derivedStatRules: clone(contentBundle.derivedStatRules) };
driftBundle.derivedStatRules.rules.energy.base += 7;
driftBundle.derivedStatRules.rules.draw.base += 6;
const driftR = createRegistries(driftBundle);
const drifted = clone(run);
initializeRunDerivedStats(drifted, driftR);
check('live content drift cannot rewrite persisted Energy', drifted.energyMax === stamped.energyMax);
check('live content drift cannot rewrite persisted Draw', drifted.drawPerTurn === stamped.drawPerTurn);

const loaded = deserializeRun(serializeRun(run));
initializeRunDerivedStats(loaded, R);
check('save/load preserves Energy, Draw, and snapshot together',
  loaded.energyMax === stamped.energyMax && loaded.drawPerTurn === stamped.drawPerTurn
  && JSON.stringify(loaded.derivedStatRuleSnapshot) === JSON.stringify(run.derivedStatRuleSnapshot));

const player = {
  classId: run.class, maxHp: run.maxHp, hp: run.hp, maxMana: run.maxMana, mana: run.mana,
  maxStamina: run.maxStamina, stamina: run.stamina, deck: run.deck, relicIds: run.relics,
  flasks: run.flasks, flaskCharges: run.flaskCharges, energyMax: run.energyMax,
  drawPerTurn: run.drawPerTurn, loadout: run.loadout, attributes: run.attributes,
  equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot,
};
const solo = createCombat({ registries: R, rng: createRng(7), player, enemyIds: [R.enemies.ids()[0]] });
check('solo combat consumes the persisted Energy and Draw stamp',
  solo.player.energyMax === stamped.energyMax && solo.player.drawPerTurn === stamped.drawPerTurn);
check('solo combat refuses an unstamped caller',
  throws(() => createCombat({ registries: R, rng: createRng(7), player: { ...player, energyMax: undefined }, enemyIds: [R.enemies.ids()[0]] }))
  && throws(() => createCombat({ registries: R, rng: createRng(7), player: { ...player, drawPerTurn: undefined }, enemyIds: [R.enemies.ids()[0]] })));

const coop = createCoopCombat({ registries: R, rng: createRng(8), players: [{ id: 'p1', ...player }], enemyIds: [R.enemies.ids()[0]] });
const coopPlayer = coop.players.get('p1').entity;
check('co-op combat consumes each seat persisted Energy and Draw stamp',
  coopPlayer.energyMax === stamped.energyMax && coopPlayer.drawPerTurn === stamped.drawPerTurn);
check('co-op combat refuses an unstamped seat',
  throws(() => createCoopCombat({ registries: R, rng: createRng(8), players: [{ id: 'p1', ...player, energyMax: undefined }], enemyIds: [R.enemies.ids()[0]] }))
  && throws(() => createCoopCombat({ registries: R, rng: createRng(8), players: [{ id: 'p1', ...player, drawPerTurn: undefined }], enemyIds: [R.enemies.ids()[0]] })));

const session = createSession({ registries: R, seedString: 'STAMP' });
session.addMember({ id: 'p1', name: 'Wren', classId: 'starseer' });
session.start();
const beforeMember = session.session.members.get('p1').run;
const restored = restoreSession(R, clone(session.serialize()));
const afterMember = restored.session.members.get('p1').run;
check('host session resume preserves Energy and Draw stamp',
  afterMember.energyMax === beforeMember.energyMax && afterMember.drawPerTurn === beforeMember.drawPerTurn
  && JSON.stringify(afterMember.derivedStatRuleSnapshot) === JSON.stringify(beforeMember.derivedStatRuleSnapshot));
const party = restored.snapshot().party[0];
check('co-op snapshot transports host-owned Energy, Draw, and rules',
  party.energyMax === afterMember.energyMax && party.drawPerTurn === afterMember.drawPerTurn
  && JSON.stringify(party.derivedStatRuleSnapshot) === JSON.stringify(afterMember.derivedStatRuleSnapshot));

const runtimeSources = `${sources.combat}\n${sources.coop}\n${sources.state}`;
check('runtime has no fallback Energy 3 or Draw 5',
  !/(?:energyMax|bal\.energy)[^\n]{0,100}(?:\?|:|\|\|)[^\n]{0,50}\b3\b/.test(runtimeSources)
  && !/(?:drawPerTurn|bal\.draw)[^\n]{0,100}(?:\?|:|\|\|)[^\n]{0,50}\b5\b/.test(runtimeSources));

const plants = [
  ['Energy fallback', 'const energy=requiredStamp(run,"energyMax")', 'const energy=run.energyMax??3', (s) => !/\?\?\s*3/.test(s)],
  ['Draw fallback', 'const draw=requiredStamp(run,"drawPerTurn")', 'const draw=run.drawPerTurn||5', (s) => !/\|\|\s*5/.test(s)],
  ['missing stamp', 'if(value===undefined)throw Error()', 'if(value===undefined)return', (s) => /throw\s+Error/.test(s)],
];
for (const [name, clean, planted, accepts] of plants) {
  check(`MUTANT ${name}`, accepts(clean) && !accepts(planted));
}

console.log(`RESULT ${pass}/${pass + fail}`);
process.exitCode = fail ? 1 : 0;
