// tests/relic-properties.test.mjs — the relic→property migration's snapshot
// (docs/plan-progression-and-property-system.md phase 2).
//
// WHY A FILE OF ITS OWN rather than a case in engine.test.js: the claim this
// makes is byte-identity against a RECORDED fixture, and the fixture is a file.
// engine.test.js runs in the browser too (tests/index.html), where there is no
// readFileSync and a JSON import is a different module grammar. The behavioural
// half of phase 2 — that a relic still fires, once, through the mount path —
// belongs in the engine suite and is asserted there; this owns the half that
// needs a disk read.
//
// WHAT THE FIXTURE IS: every shipped relic's rendered sentence, captured on
// `dev` at 0.7.1.57, BEFORE the relics' triggers moved into propertyRules. A
// relic's numbers are derived from the entries that produce them, and phase 2
// moved half of those entries to another table — so "the sentence did not
// change" is exactly the claim a reader wants and exactly the one a refactor of
// this shape can break without any test noticing.
//
// WHEN A RELIC IS DELIBERATELY RETUNED, the fixture is re-recorded in the same
// pull request that retunes it, and the diff on this file is the receipt for
// what the player will read differently. Regenerating it to make a red go away
// is the one use it does not have.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { contentBundle } from '../src/content/index.js';
import { createRegistries, relicPropertyRules } from '../src/model/registries.js';
import { relicTokens, tokenRe } from '../src/model/validate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, 'fixtures/relic-text-pre-properties.json');
const REG = createRegistries(contentBundle);

// The substitution ui/components/card.js relicText performs, minus the
// flask-growth clause it appends — that clause is derived from balance rows and
// no relic trigger feeds it, so it is unaffected by the move and carrying it
// here would test flaskGrowthClause instead of this.
function sentence(def) {
  const tokens = relicTokens(def, relicPropertyRules(REG, def), REG);
  return (def.textTemplate || '').replace(tokenRe(), (m, tok) => (
    typeof tokens[tok] === 'number' ? String(tokens[tok]) : m));
}

test('every shipped relic reads exactly as it did before its triggers moved', () => {
  const pre = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const defs = REG.relics.all();
  assert.equal(defs.length, Object.keys(pre).length,
    'the fixture covers every shipped relic — a relic added or removed since it was recorded needs it re-recorded');
  for (const def of defs) {
    assert.ok(pre[def.id], `relic '${def.id}' is not in the fixture`);
    assert.equal(sentence(def), pre[def.id].text, `relic '${def.id}' now reads differently`);
  }
});

test('no relic sentence leaves a token unresolved', () => {
  // The failure the move would actually produce: a relic whose triggers are in
  // its rule and whose reader was not handed the rule renders `{poiseDamage}`
  // to the player. It is the shape of EldenSpire#38, which is why it is asked
  // directly rather than left to the byte comparison to catch sideways.
  for (const def of REG.relics.all()) {
    assert.doesNotMatch(sentence(def), /\{[A-Za-z]/, `relic '${def.id}' renders an unresolved token`);
  }
});

test('a relic with triggers carries the property tag that holds them', () => {
  // The two tables agree in both directions: every relic whose rule has
  // triggers holds that rule's tag, and no relic holds a tag with no rule.
  for (const def of REG.relics.all()) {
    const rules = relicPropertyRules(REG, def);
    const triggers = rules.reduce((n, rule) => n + (rule.triggers || []).length, 0);
    assert.equal(Array.isArray(def.triggers) && def.triggers.length > 0, false,
      `relic '${def.id}' still authors triggers on the relic itself`);
    if (rules.length) {
      assert.ok(triggers > 0,
        `relic '${def.id}' carries a property tag whose rule confers nothing — drop the tagging row or give the rule its effects`);
    }
  }
  // …and the census, so a silent drop of the whole table cannot pass the loop
  // above by having nothing to iterate.
  const carrying = REG.relics.all().filter((def) => relicPropertyRules(REG, def).length);
  assert.equal(carrying.length, 48,
    'the 48 trigger-carrying relics each hold their property tag; the other 7 are passives-only');
});
