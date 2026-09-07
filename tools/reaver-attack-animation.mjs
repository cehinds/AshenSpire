// Standing validation for the owner-approved painted Reaver attack. The
// runtime deliberately carries sixteen unique WebPs and expands them into a
// sixty-step timeline, so this check guards both asset identity and choreography.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REAVER_ATTACK,
  REAVER_ATTACK_RUNS,
  REAVER_ATTACK_SEQUENCE,
  isReaverAttackEligible,
  reaverAttackTiming,
} from '../src/ui/reaverAttack.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FRAME_DIR = join(ROOT, 'assets', 'animations', 'reaver', 'default-greatsword', 'right');
const EXPECTED_RUNS = [
  ['F03', 3], ['F04', 3], ['F05', 3], ['F06', 3], ['F03', 3], ['F08', 4],
  ['F10', 3], ['F09', 6], ['F12', 1], ['F11', 1], ['F13', 1], ['F14', 7],
  ['F15', 4], ['F17', 3], ['F16', 2], ['F18', 4], ['F02', 3], ['F03', 6],
];
const EXPECTED_HASHES = new Map(Object.entries({
  F02: 'a16dce816be05a61be022ae7c15b581bf99a5e471b1b837fdfe22702f4638558',
  F03: 'd2eccc29f7e6d4ca1131a66d0797fb82ee836a0a527589817f3c50907fea7427',
  F04: 'ed5789c79b5093a4b1a2021cc6d4159e489fe651ce4ebd2a9c114933e8ca537b',
  F05: '61153cd71d3821ada10c1a851ba9e31315d6845c9a8850d812c8858e0022ca40',
  F06: 'a9fd58074093f784cc67cdeb0e9a04ebdb825d10823519e7c7e303c54bac2f16',
  F08: 'ab33b7eb5845342381420af774ed3b794c8f4b87b465b134d9e4417875d1319a',
  F09: '158c80a72ad7c2a93a4d9cba7ec36b86f692d87eeff1e585ef7faeb26c293abb',
  F10: '73d55142a76980707d1205110894b9d16190ac5871486586fef9adc620ffadd1',
  F11: 'bd7bddcc3c96dbe3dec9a57e199e16d573e9f6e7de29eba8c2c7a680b0b37af4',
  F12: '9efb6c2cad9b5f8d7e08d51d87ba9ccac91706bfac08227ffd06a30a75809af4',
  F13: '02a1fd865a133da78998374c032bd1faa155cc879038aadb65c41628b7b30bc1',
  F14: 'c35aafe874bd7486d07a7a3dcba72c7b9ffca837d68850e9bd9faaec4e38518a',
  F15: '0fc11da8d7f93e2e34788325a2728aa9c9b3aae9854758e4b1e7ad3989c1877a',
  F16: '8ffc4c159a62d8655b0979317ed3591ec7c17c9b497460fbc5737abf8ef48dc5',
  F17: '282b71c61e65afb62315f6439e7d62f41e16a6697507aac20e435410276387e9',
  F18: '5f20fae293701d693a76422909835f1236a04a64eceb050f61d62604a395a5dd',
}));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateDescriptor({ attack, runs, sequence }) {
  assert(JSON.stringify(runs) === JSON.stringify(EXPECTED_RUNS), 'approved repeat runs changed');
  assert(sequence.length === 60, `expected 60 playback steps, got ${sequence.length}`);
  assert(new Set(sequence).size === 16, 'expected exactly 16 deduplicated frame IDs');
  assert(attack.facing === 'right', 'runtime facing must remain right');
  assert(attack.frameMs === 56, 'normal frame timing must remain 56 ms');
  assert(attack.frameCount === 60 && attack.durationMs === 3360, 'normal duration must remain 3,360 ms');
  assert(attack.impactFrameIndex === 31 && attack.impactMs === 1736, 'impact must begin at P32');
  assert(sequence[0] === 'F03', 'P01 must begin in guard');
  assert(sequence[30] === 'F13' && sequence[31] === 'F14', 'P31/P32 strike-to-impact cut changed');
  assert(sequence[59] === 'F03', 'P60 must return to guard');
}

function validateEligibility() {
  const base = {
    classId: 'reaver',
    figure: { armourId: 'default', rightId: 'greatsword', leftId: null, rightMirror: false },
    customization: { spriteStyle: 'rendered' },
    spritesEnabled: true,
  };
  assert(isReaverAttackEligible(base), 'approved Reaver loadout was rejected');
  for (const [name, patch] of [
    ['class', { classId: 'rogue' }],
    ['armour', { figure: { ...base.figure, armourId: 'other' } }],
    ['weapon', { figure: { ...base.figure, rightId: 'dagger' } }],
    ['off-hand', { figure: { ...base.figure, leftId: 'buckler' } }],
    ['mirror', { figure: { ...base.figure, rightMirror: true } }],
    ['style', { customization: { spriteStyle: 'classic' } }],
    ['sprite setting', { spritesEnabled: false }],
  ]) assert(!isReaverAttackEligible({ ...base, ...patch }), `${name} mismatch was accepted`);
}

function validateAssets() {
  for (const [id, expectedHash] of EXPECTED_HASHES) {
    const bytes = readFileSync(join(FRAME_DIR, `${id}.webp`));
    assert(bytes.subarray(0, 4).toString('ascii') === 'RIFF', `${id} lacks a RIFF header`);
    assert(bytes.subarray(8, 12).toString('ascii') === 'WEBP', `${id} is not WebP`);
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    assert(actualHash === expectedHash, `${id} SHA-256 mismatch`);
  }
}

function validateTimings() {
  const normal = reaverAttackTiming({ lungeMs: 260 });
  const slow = reaverAttackTiming({ lungeMs: 340 });
  const fast = reaverAttackTiming({ lungeMs: 160 });
  assert(normal.frameMs === 56 && normal.totalMs === 3360, 'normal timing changed');
  assert(slow.frameMs === 73 && slow.totalMs === 4380, 'slow timing scale changed');
  assert(fast.frameMs === 34 && fast.totalMs === 2040, 'fast timing scale changed');
}

function main() {
  validateDescriptor({ attack: REAVER_ATTACK, runs: REAVER_ATTACK_RUNS, sequence: REAVER_ATTACK_SEQUENCE });
  validateEligibility();
  validateAssets();
  validateTimings();

  if (process.argv.includes('--selftest')) {
    let caught = false;
    try {
      validateDescriptor({ attack: REAVER_ATTACK, runs: REAVER_ATTACK_RUNS, sequence: REAVER_ATTACK_SEQUENCE.slice(1) });
    } catch (error) {
      caught = /60 playback steps/.test(error.message);
    }
    assert(caught, 'selftest failed to catch a missing playback step');
  }

  console.log(`reaver-attack-animation: PASS (60 steps, ${EXPECTED_HASHES.size} unique WebPs, P32 impact)`);
}

main();
