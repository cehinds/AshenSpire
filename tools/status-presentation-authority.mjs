#!/usr/bin/env node

// Status instance presentation authority. Names and mechanic fields never
// decide whether an instance value is stacks or a percent; an explicit closed
// display token does. This is semantic markup only, not layout or styling.

import fs from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import * as Schema from '../src/model/schemas.js';
import * as UI from '../src/ui/uiContent.js';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};
const errors = (bundle) => validateContent(bundle).errors.map((e) => `${e.path}: ${e.msg}`).join('\n');
const bundleWithStatus = (mutate) => ({
  ...contentBundle,
  statuses: contentBundle.statuses.map((row) => {
    const copy = { ...row, ...(row.instancePresentation ? { instancePresentation: { ...row.instancePresentation } } : {}) };
    if (row.id === 'magicVulnerable') mutate(copy);
    return copy;
  }),
});

check('one closed status-value display-token vocabulary is exported',
  Array.isArray(Schema.STATUS_VALUE_TOKENS) && Schema.STATUS_VALUE_TOKENS.join(',') === 'stacks,percent');
check('display-token vocabulary remains separate from engine keyword structure',
  Array.isArray(Schema.ENGINE_KEYWORDS)
  && !(Schema.STATUS_VALUE_TOKENS || []).some((token) => Schema.ENGINE_KEYWORDS.includes(token)));

const magic = contentBundle.statuses.find((row) => row.id === 'magicVulnerable');
check('Magic Vulnerable explicitly authors its instance presentation',
  magic?.instancePresentation?.valueToken === 'percent' && magic.instancePresentation.durationToken === 'turns');
check('shipping status presentation passes the production boot schema', errors(contentBundle) === '', errors(contentBundle).slice(0, 240));

check('unknown value display token is refused at the status row', (() => {
  const said = errors(bundleWithStatus((row) => { row.instancePresentation = { valueToken: 'percentage', durationToken: 'turns' }; }));
  return /statuses\.magicVulnerable\.instancePresentation\.valueToken/.test(said);
})());
check('unknown duration display token is refused at the status row', (() => {
  const said = errors(bundleWithStatus((row) => { row.instancePresentation = { valueToken: 'percent', durationToken: 'rounds' }; }));
  return /statuses\.magicVulnerable\.instancePresentation\.durationToken/.test(said);
})());
check('partial presentation row is refused rather than defaulted', (() => {
  const said = errors(bundleWithStatus((row) => { row.instancePresentation = { valueToken: 'percent' }; }));
  return /statuses\.magicVulnerable\.instancePresentation\.durationToken/.test(said);
})());

check('one shared instance presenter is exported', typeof UI.statusInstancePresentation === 'function');
const present = UI.statusInstancePresentation;
if (typeof present === 'function' && magic) {
  const shown = present(magic, { stacks: 25, duration: 2 });
  check('registered percent token presents value and duration separately',
    shown.valueToken === 'percent' && shown.valueText === '25%' && shown.durationText === '2 turns');
  check('semantic markup receipt names id, token, and accessible truth',
    JSON.stringify(shown.semantic) === JSON.stringify({
      statusId: 'magicVulnerable', valueToken: 'percent', ariaLabel: 'Magic Vulnerable 25% · 2 turns',
    }), JSON.stringify(shown.semantic));

  const renamed = { ...magic, id: 'moonFracture', name: 'Moon Fracture' };
  const renamedShown = present(renamed, { stacks: 25, duration: 2 });
  check('renaming id and label preserves authored percent semantics',
    renamedShown.valueText === '25%' && renamedShown.semantic?.statusId === 'moonFracture'
    && renamedShown.semantic?.ariaLabel === 'Moon Fracture 25% · 2 turns');

  const neutral = {
    id: 'quietMeasure', name: 'Quiet Measure', icon: '?', stackMode: 'refresh', decay: 'none',
    instancePresentation: { valueToken: 'percent', durationToken: 'turns' }, tooltip: '',
  };
  check('explicit token needs no magic/vulnerability mechanic or name', present(neutral, { stacks: 17 }).valueText === '17%');

  const misleading = {
    ...neutral, id: 'vulnerableMagicPercent', name: 'Magic Vulnerable Percent',
    instancePresentation: { valueToken: 'stacks', durationToken: 'turns' },
  };
  check('misleading id/name cannot infer percent semantics', present(misleading, { stacks: 17 }).valueText === '17');

  const mechanicButStacks = {
    ...magic, id: 'mechanicButStacks', name: 'Mechanic But Stacks',
    instancePresentation: { valueToken: 'stacks', durationToken: 'turns' },
  };
  check('mechanic field cannot override the authored display token', present(mechanicButStacks, { stacks: 17 }).valueText === '17');

  const ordinary = contentBundle.statuses.find((row) => row.id === 'strength');
  check('ordinary status retains structural stack presentation',
    present(ordinary, { stacks: 3 }).valueToken === 'stacks' && present(ordinary, { stacks: 3 }).valueText === '3');
}

const uiSource = fs.readFileSync('src/ui/uiContent.js', 'utf8');
const solo = fs.readFileSync('src/ui/screens/combat.js', 'utf8');
const coop = fs.readFileSync('src/ui/screens/coop.js', 'utf8');
check('shared presenter contains no status-id/name regex branch',
  !/(?:magicVulnerable|Magic Vulnerable|\.test\(def\.(?:id|name)\)|match\(.*def\.(?:id|name))/i.test(uiSource));
check('solo and co-op consume the same semantic status receipt',
  /statusInstanceSemanticAttrs/.test(solo) && /statusInstanceSemanticAttrs/.test(coop));
check('both combat surfaces stamp stable semantic status selectors',
  /data-status-id/.test(solo) && /data-status-value-token/.test(solo)
  && /data-status-id/.test(coop) && /data-status-value-token/.test(coop));

const plants = [
  ['name regex', 'const token=def.instancePresentation.valueToken', "const token=/magic|vulnerable/i.test(def.name)?'percent':'stacks'", (s) => !/magic\|vulnerable|test\(def\.name/.test(s)],
  ['id branch', 'const token=def.instancePresentation.valueToken', "const token=def.id==='magicVulnerable'?'percent':'stacks'", (s) => !/magicVulnerable/.test(s)],
  ['unknown token', "const token='percent'", "const token='percentage'", (s) => !/['"]percentage['"]/.test(s)],
  ['semantic token omission', 'data-status-value-token', 'data-status-value-kind', (s) => /data-status-value-token/.test(s)],
];
for (const [name, clean, planted, accepts] of plants) check(`MUTANT ${name}`, accepts(clean) && !accepts(planted));

console.log(`RESULT ${pass}/${pass + fail}`);
process.exitCode = fail ? 1 : 0;
