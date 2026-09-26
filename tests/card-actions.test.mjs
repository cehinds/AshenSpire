// services/cardActions.js is the only answer to "what can I do with this card,
// on this surface, right now?". Its whole reason for existing is that the
// question used to have no home, and the shape of that absence was a DEFAULT:
// every surface but combat inherited combat's verb as a dead button. So the
// tests that matter most here are the ones about what the file REFUSES to do.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardActions, primaryVerb, verbs, SURFACES } from '../src/services/cardActions.js';

let checks = 0;
const ok = (cond, what) => { checks++; assert.ok(cond, what); };
const throws = (fn, re, what) => { checks++; assert.throws(fn, re, what); };

// ---- it is pure ------------------------------------------------------------
// Comments are stripped first: this file's own prose NAMES the browser globals
// it must never call, and a grep that cannot tell prose from code would read
// its own documentation as the violation.
const stripComments = (text) => text
  .split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
const source = stripComments(readFileSync(new URL('../src/services/cardActions.js', import.meta.url), 'utf8'));
ok(!/^import /m.test(source), 'the service imports nothing — no domain, no registries, no browser');
ok(!/\bdocument\b|\bwindow\b|addEventListener/.test(source), 'the service never touches a browser');

// ---- an unknown surface is a defect, not a default -------------------------
throws(() => cardActions('shrine'), /unknown surface 'shrine'/,
  'an unnamed surface throws rather than silently offering nothing');
throws(() => cardActions(undefined), /unknown surface/,
  'a missing surface throws too — this is where the old default lived');

// ---- a card you are only reading offers nothing, on purpose ----------------
ok(cardActions('none').length === 0, "'none' is a real surface with a real empty answer");

// ---- no surface inherits another's verb ------------------------------------
const combat = cardActions('combat', null, { availability: { play: true } });
ok(combat.length === 1 && combat[0].id === 'play', 'combat offers play');
for (const surface of SURFACES.filter((s) => s !== 'combat')) {
  const rows = cardActions(surface, null, { only: [] });
  ok(!rows.some((row) => row.id === 'play'), `${surface} never offers combat's verb`);
}

// ---- a refusal always carries its sentence ---------------------------------
throws(() => cardActions('reward', null, { availability: { choose: false } }),
  /refused 'choose' with no reason/,
  'a bare false is refused — a greyed button with no sentence is the defect');

const blocked = cardActions('reward', null, { availability: { choose: 'A card has already been taken.' } });
ok(blocked.length === 1 && !blocked[0].enabled && blocked[0].reason === 'A card has already been taken.',
  'a refusal keeps the words the surface gave it');

// ---- available by default when a surface offers exactly one verb -----------
const reward = cardActions('reward');
ok(reward.length === 1 && reward[0].enabled && reward[0].verb === 'Choose this card',
  'a single-verb surface with nothing in the way offers it enabled');

// ---- a two-shelf surface narrows itself without a second surface name ------
const buying = cardActions('shop', null, { only: ['buy'], availability: { buy: true } });
ok(buying.length === 1 && buying[0].id === 'buy', 'the merchant buys on one shelf');
const burning = cardActions('shop', null, { only: ['burn'], availability: { burn: 'Not enough cinders.' } });
ok(burning.length === 1 && burning[0].id === 'burn' && !burning[0].enabled, 'and burns on the other');

// ---- the rows are frozen ---------------------------------------------------
checks++;
assert.throws(() => { reward[0].enabled = false; }, TypeError, 'an action row cannot be edited by a caller');
checks++;
assert.throws(() => { verbs().play = 'Nope'; }, TypeError, 'the verb table cannot be edited by a caller');

// ---- the verbs are commands, not categories --------------------------------
for (const [id, verb] of Object.entries(verbs())) {
  ok(/^[A-Z]/.test(verb) && verb.length > 2, `'${id}' reads as a command: "${verb}"`);
}
ok(primaryVerb('reward') === 'Choose this card', 'the primary verb is the first a surface offers');
ok(primaryVerb('none') === '', 'a reading surface has no primary verb');

// ---- and the default that started all this is gone from the renderer -------
const card = readFileSync(new URL('../src/ui/components/card.js', import.meta.url), 'utf8');
const code = stripComments(card);
ok(!/Play cards from your combat hand/.test(code),
  "card.js no longer hands every surface combat's verb");
const door = stripComments(readFileSync(new URL('../src/ui/components/cardInspection.js', import.meta.url), 'utf8'));
ok(!/'Play card'|"Play card"/.test(door), 'the door writes no verb of its own');

console.log(`PASS ${checks}/${checks}; the card action service answers per surface and refuses to guess`);
