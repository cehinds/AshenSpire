#!/usr/bin/env node
// Direct host-authority probe for contextual flask Use. Inspect/cancel/drop are
// client/run actions and must never arrive at the combat mutation boundary.

// DOOR. The real input is the host itself: tools/session.mjs is imported and
// driven through `flaskIntent` — the same function the LAN router calls
// (tools/lan.mjs `case 'flaskIntent'`). `--selftest` plants each known-bad
// INTO A COPY of the real host source on disk and re-runs this whole tool
// from that copy, so the planted host is the one that boots and answers.
// (Vira's doors audit 2026-08-14 listed this tool NO-KNOWN-BAD.)
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createSession } from './session.mjs';

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'flask-intent-smoke.mjs',
    plants: [
      {
        name: 'the host accepts any action, not only Use (Inspect crosses the mutation boundary)',
        file: 'tools/session.mjs',
        find: "if (!intent || intent.action !== 'use') return { ok: false, error: 'host refused unsupported flask intent' };",
        replace: "if (!intent) return { ok: false, error: 'host refused unsupported flask intent' };",
        expectRed: /FAIL host refuses non-Use actions/,
      },
      {
        name: 'the host stops requiring a slot or charge kind',
        file: 'tools/session.mjs',
        find: "if (slot == null && chargeKind == null) return { ok: false, error: 'host refused flask intent without a slot or charge kind' };",
        replace: "/* planted: malformed Use is allowed through */",
        expectRed: /FAIL host refuses Use without slot or charge kind/,
      },
      {
        name: 'a refused intent spends a charge anyway',
        file: 'tools/session.mjs',
        find: "  function flaskIntent(memberId, intent = {}) {",
        replace: "  function flaskIntent(memberId, intent = {}) {\n    if (intent && intent.action === 'inspect') { const p = live && live.combat.players.get(memberId); if (p && p.entity.flaskCharges) p.entity.flaskCharges.hpCurrent -= 1; }",
        expectRed: /FAIL refused action spends nothing/,
      },
    ],
  }));
}

const registries = createRegistries(contentBundle);
const session = createSession({ registries, seedString: 'FLASKINTENT' });
session.addMember({ id: 'p1', name: 'Rune', classId: 'reaver' });
session.start();
session.resolveNode({ type: 'monster' });

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

const player = session.live.combat.players.get('p1').entity;
player.hp = Math.max(1, player.hp - 10);
const before = { hp: player.hp, charge: player.flaskCharges.hpCurrent };

const inspect = session.flaskIntent('p1', { action: 'inspect', chargeKind: 'hp' });
check('host refuses non-Use actions', inspect.ok === false && /unsupported flask intent/.test(inspect.error));
check('refused action spends nothing', player.hp === before.hp && player.flaskCharges.hpCurrent === before.charge);

const malformed = session.flaskIntent('p1', { action: 'use' });
check('host refuses Use without slot or charge kind', malformed.ok === false && /without a slot or charge kind/.test(malformed.error));
check('malformed action spends nothing', player.hp === before.hp && player.flaskCharges.hpCurrent === before.charge);

const used = session.flaskIntent('p1', { action: 'use', chargeKind: 'hp' });
check('host accepts an explicit valid Use intent', used.ok === true);
check('accepted Use heals through the real engine', player.hp > before.hp, `${before.hp}→${player.hp}`);
check('accepted Use spends exactly one host-owned charge', player.flaskCharges.hpCurrent === before.charge - 1,
  `${before.charge}→${player.flaskCharges.hpCurrent}`);
const snap = session.snapshot().scene.players.find((row) => row.id === 'p1');
check('broadcast snapshot carries the resulting host state',
  snap.hp === player.hp && snap.flaskCharges.hpCurrent === player.flaskCharges.hpCurrent);

const wrongMember = session.flaskIntent('intruder', { action: 'use', chargeKind: 'hp' });
check('host refuses a member outside the fight', wrongMember.ok === false && !!wrongMember.error);

console.log(`\nflask-intent-smoke: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
