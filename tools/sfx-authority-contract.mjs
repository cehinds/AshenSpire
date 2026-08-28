#!/usr/bin/env node

// Issue #67: played ids and authored SFX rows are one two-way authority.
// This contract intentionally drives the public content-build doors. It does
// not reimplement the scanner, so a green means the build path itself owns the
// check and its selftest can still make both defects fail by name.

import { spawnSync } from 'node:child_process';

const run = (...args) => spawnSync(process.execPath, ['tools/content-build.mjs', ...args], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
});
const text = (result) => `${result.stdout || ''}\n${result.stderr || ''}`;

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

const build = run('--check');
const buildText = text(build);
check('plain content check runs the SFX caller/table authority',
  /sfx authority:\s*\d+ caller id\(s\),\s*\d+ recipe row\(s\),\s*0 defect\(s\)/i.test(buildText),
  `exit ${build.status}`);
check('plain content check is green only when both SFX sets agree',
  build.status === 0 && /0 defect\(s\)/i.test(buildText));

const selftest = run('--selftest');
const selfText = text(selftest);
check('selftest plants a caller without a recipe and names its id',
  /K17[^\n]*caller without (?:a )?recipe[\s\S]{0,500}sfxMissingCallerRow/i.test(selfText));
check('selftest plants a recipe without a caller and names its id',
  /K18[^\n]*recipe without (?:a )?caller[\s\S]{0,500}sfxOrphanRecipeRow/i.test(selfText));
check('selftest names the current composed-family baseline',
  /beat_[^\s'"`]*[\s\S]{0,200}(?:family|recipe)/i.test(selfText));
check('family exemptions are exported content data, not inferred from underscores',
  /SFX_FAMILY_IDS/.test(buildText));

console.log(`RESULT ${pass}/${pass + fail}`);
process.exitCode = fail ? 1 : 0;
