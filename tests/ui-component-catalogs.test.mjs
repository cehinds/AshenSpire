// #1230: the Markdown component catalog and the interactive one must list the
// same component ids. The check is C22 of tools/ui-components.mjs; this file
// runs that rung in the suite and proves it goes red on a one-sided entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogDisagreement, findings, railUnderMeters, receipt } from '../tools/ui-components.mjs';

const md = readFileSync(new URL('../docs/COMPONENT-CATALOG.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const html = readFileSync(new URL('../docs/component-catalog.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const c22 = (r) => findings(r).filter((line) => line.startsWith('C22 '));

test('the two component catalogs list the same ids', () => {
  const split = catalogDisagreement(md, html);
  assert.equal(split.empty, false, 'a catalog listed no component ids — the parser lost its anchor');
  assert.deepEqual(split.markdownOnly, [], 'ids only in docs/COMPONENT-CATALOG.md');
  assert.deepEqual(split.htmlOnly, [], 'ids only in docs/component-catalog.html');
  assert.deepEqual(c22(receipt()), []);
});

test('an id only in the Markdown catalog fails the check', () => {
  const r = receipt();
  const bad = { ...r, catalogMarkdown: r.catalogMarkdown.replace('| `startup-gate` |', '| `markdown-only-component` | x | x | x | x |\n| `startup-gate` |') };
  assert.match(c22(bad).join('\n'), /only in COMPONENT-CATALOG\.md: markdown-only-component/);
});

test('an id only in the interactive catalog fails the check', () => {
  const r = receipt();
  const bad = { ...r, catalogHtml: r.catalogHtml.replace('const SEMANTIC_COMPONENTS = [', "const SEMANTIC_COMPONENTS = [\n ['html-only-component','x','x','primitive','x','x','panel'],") };
  assert.match(c22(bad).join('\n'), /only in component-catalog\.html: html-only-component/);
});

test('a catalog that lists nothing fails the check rather than agreeing vacuously', () => {
  const r = receipt();
  assert.equal(c22({ ...r, catalogHtml: '' }).length, 1);
});

test('an armoury asset id only in the interactive catalog fails the check', () => {
  const r = receipt();
  const bad = { ...r, catalogHtml: r.catalogHtml.replace('const RENDERED_ARMOURY_COMPONENTS = [', 'const RENDERED_ARMOURY_COMPONENTS = [\n ["armoury.htmlOnlyAsset",".x","x","x","x"],') };
  assert.match(c22(bad).join('\n'), /only in component-catalog\.html: armoury\.htmlOnlyAsset/);
});

test('an armoury asset id only in the Markdown family table fails the check', () => {
  const r = receipt();
  const bad = { ...r, catalogMarkdown: r.catalogMarkdown.replace('`armoury.disclosure` |', '`armoury.disclosure`, `armoury.markdownOnlyAsset` |') };
  assert.match(c22(bad).join('\n'), /only in COMPONENT-CATALOG\.md: armoury\.markdownOnlyAsset/);
});

test('a double-quoted semantic record is still read', () => {
  const r = receipt();
  const quoted = { ...r, catalogHtml: r.catalogHtml.replace("['startup-gate',", '["startup-gate",') };
  assert.notEqual(quoted.catalogHtml, r.catalogHtml);
  assert.deepEqual(c22(quoted), []);
});

// The two families are compared separately: an id that moves between the
// Markdown "| Rendered family |" table and a Component-ID table, or between
// the HTML SEMANTIC_COMPONENTS and RENDERED_ARMOURY_COMPONENTS arrays, is
// still listed once on each side, so one merged set would call it agreement.
test('an armoury asset id moved into a Markdown Component-ID table fails the check', () => {
  const r = receipt();
  const moved = r.catalogMarkdown
    .replace(', `armoury.disclosure` |', ' |')
    .replace('| `startup-gate` |', '| `armoury.disclosure` | x | x | x | x |\n| `startup-gate` |');
  assert.notEqual(moved, r.catalogMarkdown);
  assert.match(c22({ ...r, catalogMarkdown: moved }).join('\n'), /only in COMPONENT-CATALOG\.md: armoury\.disclosure \[semantic\]; only in component-catalog\.html: armoury\.disclosure \[armoury\]/);
});

test('an armoury record moved into the interactive SEMANTIC_COMPONENTS array fails the check', () => {
  const r = receipt();
  const record = ` ["armoury.shell",".armoury[data-composition='character-equipment']","Armoury shell and view routing","responsive shared shell","armouryPanel"],\n`;
  assert.ok(r.catalogHtml.includes(record));
  const moved = r.catalogHtml
    .replace(record, '')
    .replace('const SEMANTIC_COMPONENTS = [\n', `const SEMANTIC_COMPONENTS = [\n${record}`);
  assert.notEqual(moved, r.catalogHtml);
  assert.match(c22({ ...r, catalogHtml: moved }).join('\n'), /only in COMPONENT-CATALOG\.md: armoury\.shell \[armoury\]; only in component-catalog\.html: armoury\.shell \[semantic\]/);
});

// The whole verdict of tools/ui-components.mjs, not only its C22 rung. C5 and
// C12 sat red on dev because nothing in the suite ran the tool; this line is
// that run. Its plants live in `node tools/ui-components.mjs --selftest`.
test('every reusable component contract of tools/ui-components.mjs holds on this checkout', () => {
  assert.deepEqual(findings(receipt()), []);
});

// An empty family names itself: with the Markdown Rendered-family table gone,
// the message says that catalog listed no Armoury ids, not only that every
// Armoury id is one-sided.
test('an empty family says which catalog listed no ids for it', () => {
  const r = receipt();
  const emptied = r.catalogMarkdown.replace('| Rendered family |', '| Rendered families (renamed) |');
  assert.notEqual(emptied, r.catalogMarkdown);
  assert.match(c22({ ...r, catalogMarkdown: emptied }).join('\n'), /COMPONENT-CATALOG\.md listed no armoury ids/);
});

const c12 = (r) => findings(r).filter((line) => line.startsWith('C12 '));

// Codex, #1316: a HUD layout override that drops its `meters` row is a broken
// grid, not one to skip. railUnderMeters judges every shared-HUD grid.
test('a HUD layout override that drops its meters row fails C12', () => {
  const r = receipt();
  const kit = r.kit.replace('"info actions" "meters actions" "rail actions";', '"info actions" "rail actions";');
  assert.notEqual(kit, r.kit);
  assert.equal(railUnderMeters(kit), false);
  assert.equal(c12({ ...r, kit }).length, 1);
});

// Codex on #1316: CSS honours the LAST grid-template-areas in a rule, so a
// repeated declaration that drops `meters` must fail even when the first one
// still lays it out.
test('a repeated grid-template-areas that drops meters fails C12', () => {
  const r = receipt();
  const kit = r.kit.replace('"info actions" "meters actions" "rail actions";', '"info actions" "meters actions" "rail actions";\n  grid-template-areas: "info actions" "rail actions";');
  assert.notEqual(kit, r.kit);
  assert.equal(railUnderMeters(kit), false);
  assert.equal(c12({ ...r, kit }).length, 1);
});

// Codex on #1316: single-quoted rows are valid CSS and must be judged, not
// skipped as "no declaration".
test('a single-quoted grid-template-areas that drops meters fails C12', () => {
  const r = receipt();
  const kit = r.kit.replace('"info actions" "meters actions" "rail actions";', "'info actions' 'rail actions';");
  assert.notEqual(kit, r.kit);
  assert.equal(railUnderMeters(kit), false);
  assert.equal(c12({ ...r, kit }).length, 1);
});

// Codex on #1316: the authored-dungeon title is part of the contract, not an
// optional prefix, so dropping it fails C12.
test('dropping the authored map title fails C12', () => {
  const r = receipt();
  const map = r.map.replace('title: mapAdapter?.title || actTitle(', 'title: actTitle(');
  assert.notEqual(map, r.map);
  assert.equal(c12({ ...r, map }).length, 1);
});

// Codex on #1316: an effective declaration the check cannot read as rows
// (none, a custom property) fails; it is never skipped.
test('an unparseable final grid-template-areas fails C12', () => {
  const r = receipt();
  const kit = r.kit.replace('"info actions" "meters actions" "rail actions";', '"info actions" "meters actions" "rail actions";\n  grid-template-areas: none;');
  assert.notEqual(kit, r.kit);
  assert.equal(railUnderMeters(kit), false);
});

// Codex on #1316: a rule whose subject is .hud-bottom with another class
// (a state such as .expanded) that hangs the rail again fails.
test('a class-qualified .hud-bottom rule that hangs the rail fails C12', () => {
  const r = receipt();
  const kit = `${r.kit}\n.shared-hud .hud-bottom.expanded { position: absolute; }\n`;
  assert.equal(c12({ ...r, kit }).length, 1);
});

// Codex on #1316: C12 reads CSS through a small parser, so these valid forms
// are judged like any other, not missed by a line pattern.
test('a :has() state on .hud-bottom that hangs the rail fails C12', () => {
  const r = receipt();
  const kit = `${r.kit}\n.shared-hud .hud-bottom:has(> .icon-tray.expanded) { position: absolute; }\n`;
  assert.equal(c12({ ...r, kit }).length, 1);
});

test('a final grid-template-areas with no semicolon that drops meters fails C12', () => {
  const r = receipt();
  const kit = `${r.kit}\n.shared-hud[data-x] > .hud-top { grid-template-areas: "info actions" "rail actions" }\n`;
  assert.equal(railUnderMeters(kit), false);
});

test('a grid-template shorthand that drops meters fails C12', () => {
  const r = receipt();
  const kit = `${r.kit}\n.shared-hud[data-x] > .hud-top { grid-template: "info actions" auto "rail actions" auto / 1fr auto; }\n`;
  assert.equal(railUnderMeters(kit), false);
});

test('an override inside @media is judged too', () => {
  const r = receipt();
  const kit = `${r.kit}\n@media (max-width: 1px) { .shared-hud[data-x] > .hud-top { grid-template-areas: "info actions" "rail actions"; } }\n`;
  assert.equal(railUnderMeters(kit), false);
});

test('a rule inside @scope, @starting-style or any grouping at-rule is judged', () => {
  const r = receipt();
  for (const wrap of ['@scope (.shared-hud)', '@starting-style', '@layer hud']) {
    const kit = `${r.kit}\n${wrap} { .shared-hud .hud-bottom { position: absolute; } }\n`;
    assert.equal(c12({ ...r, kit }).length, 1, wrap);
  }
});

test('a subject written through :is() or :where() is judged', () => {
  const r = receipt();
  for (const sel of ['.shared-hud :is(.hud-bottom)', '.shared-hud :where(.hud-bottom.expanded)']) {
    const kit = `${r.kit}\n${sel} { position: absolute; }\n`;
    assert.equal(c12({ ...r, kit }).length, 1, sel);
  }
  const grid = `${r.kit}\n.shared-hud > :is(.hud-top) { grid-template-areas: "info actions" "rail actions"; }\n`;
  assert.equal(railUnderMeters(grid), false);
});

test('a nested rule (CSS nesting) is judged under its parent', () => {
  const r = receipt();
  const kit = `${r.kit}\n.shared-hud .hud-bottom { &.expanded { position: absolute; } }\n`;
  assert.equal(c12({ ...r, kit }).length, 1);
});

test(':not() and :has() arguments are not the subject', () => {
  const r = receipt();
  const kit = `${r.kit}\n.shared-hud .relic:not(.hud-bottom) { position: absolute; }\n.shared-hud .x:has(.hud-bottom) { position: absolute; }\n`;
  assert.equal(c12({ ...r, kit }).length, 0);
});

// Codex on #1316: inside :is()/:where() the subject is each argument's own
// last compound, so an ancestor class there is not the subject.
test('an ancestor class inside :is() is not the subject', () => {
  const r = receipt();
  const ok = `${r.kit}\n.shared-hud :is(.hud-bottom > .relic) { position: absolute; }\n`;
  assert.equal(c12({ ...r, kit: ok }).length, 0);
  const bad = `${r.kit}\n.shared-hud :is(.relic, .x > .hud-bottom.expanded) { position: absolute; }\n`;
  assert.equal(c12({ ...r, kit: bad }).length, 1);
});

// Codex on #1316: @scope's root is the rules' ancestor, so a scoped
// `.hud-top` grid is a shared-HUD grid and is judged; `:scope` is the root.
test('a rule inside @scope keeps its scope root', () => {
  const r = receipt();
  const grid = `${r.kit}\n@scope (.shared-hud) { .hud-top { grid-template-areas: "info actions" "rail actions"; } }\n`;
  assert.equal(railUnderMeters(grid), false);
  const rail = `${r.kit}\n@scope (.shared-hud) { :scope .hud-bottom { position: absolute; } }\n`;
  assert.equal(c12({ ...r, kit: rail }).length, 1);
  const fine = `${r.kit}\n@scope (.shared-hud) { .hud-top { grid-template-areas: "info actions" "meters actions" "rail actions"; } }\n`;
  assert.equal(railUnderMeters(fine), true);
});

// Review of #1316: declarations written straight into an @scope block apply
// to the scope root, so they are judged as a rule on it.
test('declarations directly in an @scope block are judged on its root', () => {
  const r = receipt();
  const base = 'position: static; grid-area: rail; min-width: 0; width: 100%;';
  const nested = r.kit.replace(base, `${base}\n  @scope { position: absolute; }`);
  assert.notEqual(nested, r.kit);
  assert.equal(c12({ ...r, kit: nested }).length, 1);
  const top = `${r.kit}\n@scope (.shared-hud .hud-bottom) { position: absolute; }\n`;
  assert.equal(c12({ ...r, kit: top }).length, 1);
});

// Review of #1316: @layer is not a condition; a base rule in a layer is still
// the base.
test('a base rail rule inside @layer is still the base', () => {
  const r = receipt();
  const i = r.kit.indexOf('.shared-hud .hud-bottom {');
  const j = r.kit.indexOf('}', i) + 1;
  const kit = `${r.kit.slice(0, i)}@layer hud { ${r.kit.slice(i, j)} }${r.kit.slice(j)}`;
  assert.equal(c12({ ...r, kit }).length, 0);
});

// Codex on #1316: any rail rule that sets grid-area must keep it `rail`; an
// override that moves it out of the rail row fails, in flow or not.
test('a rail override that moves grid-area off rail fails C12', () => {
  const r = receipt();
  for (const extra of ['@media (width < 1px) { .shared-hud .hud-bottom { grid-area: auto; } }', '.shared-hud .hud-bottom.expanded { grid-area: meters; }']) {
    assert.equal(c12({ ...r, kit: `${r.kit}\n${extra}\n` }).length, 1, extra);
  }
  assert.equal(c12({ ...r, kit: `${r.kit}\n.shared-hud .hud-bottom.expanded { grid-area: rail; }\n` }).length, 0);
});

// Codex on #1316: CSS drops a grid-template-areas whose rows differ in width
// or whose named areas are not rectangles, so such a grid is broken, not read.
test('an invalid grid-template-areas fails C12', () => {
  const r = receipt();
  for (const bad of ['"info info" "meters actions" "rail actions" "route";', '"info actions" "meters actions" "rail info";']) {
    const kit = r.kit.replace('"info actions" "meters actions" "rail actions";', bad);
    assert.notEqual(kit, r.kit);
    assert.equal(railUnderMeters(kit), false, bad);
  }
});

// Codex on #1316: a shared-HUD top rule that switches off grid display takes
// the areas with it.
test('a shared-HUD top rule with a non-grid display fails C12', () => {
  const r = receipt();
  assert.equal(railUnderMeters(`${r.kit}\n.shared-hud[data-x] > .hud-top { display: flex; }\n`), false);
  assert.equal(railUnderMeters(`${r.kit}\n.shared-hud[data-x] > .hud-top { display: grid; }\n`), true);
});

// Review of #1316: at-rule names and keywords are case-insensitive, and
// !important does not change which area a rule names.
test('case and !important do not hide a hung rail', () => {
  const r = receipt();
  for (const extra of ['@SCOPE (.shared-hud .hud-bottom) { position: absolute; }', '.shared-hud .hud-bottom.x { position: ABSOLUTE; }', '.shared-hud { @scope (.x, .hud-bottom) { position: absolute; } }']) {
    assert.equal(c12({ ...r, kit: `${r.kit}\n${extra}\n` }).length, 1, extra);
  }
  assert.equal(c12({ ...r, kit: `${r.kit}\n.shared-hud .hud-bottom.x { grid-area: rail !important; }\n` }).length, 0);
});

// Codex on #1316: a pseudo-element is its own box, not the rail.
test('a pseudo-element on the rail is not the rail', () => {
  const r = receipt();
  for (const sel of ['.shared-hud .hud-bottom::before', '.shared-hud .hud-bottom:after', '.shared-hud .hud-bottom.x::marker']) {
    assert.equal(c12({ ...r, kit: `${r.kit}\n${sel} { position: absolute; grid-area: auto; }\n` }).length, 0, sel);
  }
});

// Codex on #1316: `all` resets every property, grid-area and display too.
test('an all reset on the rail or the top grid fails C12', () => {
  const r = receipt();
  assert.equal(c12({ ...r, kit: `${r.kit}\n.shared-hud .hud-bottom.expanded { all: unset; }\n` }).length, 1);
  assert.equal(railUnderMeters(`${r.kit}\n.shared-hud[data-x] > .hud-top { all: initial; }\n`), false);
  assert.equal(c12({ ...r, kit: `${r.kit}\n.shared-hud .hud-bottom.expanded { all: unset; grid-area: rail; }\n` }).length, 0);
});

// Codex on #1316: pseudo-class names are case-insensitive, and the
// two-keyword display forms of grid are grid.
test('uppercase :IS() is a subject and two-keyword grid display is grid', () => {
  const r = receipt();
  assert.equal(c12({ ...r, kit: `${r.kit}\n.shared-hud :IS(.hud-bottom) { position: absolute; }\n` }).length, 1);
  assert.equal(railUnderMeters(`${r.kit}\n.shared-hud > :WHERE(.hud-top) { grid-template-areas: "info actions" "rail actions"; }\n`), false);
  for (const d of ['block grid', 'inline grid', 'grid block', 'INLINE-GRID']) {
    assert.equal(railUnderMeters(`${r.kit}\n.shared-hud[data-x] > .hud-top { display: ${d}; }\n`), true, d);
  }
});

// Codex on #1316: strings are read as CSS reads them. An escaped quote does
// not end one, and comment delimiters inside one are not a comment, so
// neither can hide a later rail rule. Keywords are case-insensitive.
test('strings, escapes and keyword case do not hide or fake a rail rule', () => {
  const r = receipt();
  const hung = '.shared-hud .hud-bottom.x { position: absolute; }';
  for (const before of ['.a::before { content: "\\""; }', ".a::before { content: '\\''; }", '.a::before { content: "/*"; }']) {
    const after = before.includes('/*') ? '\n.b::before { content: "*/"; }' : '';
    assert.equal(c12({ ...r, kit: `${r.kit}\n${before}\n${hung}${after}\n` }).length, 1, before);
  }
  const kit = r.kit.replace('position: static; grid-area: rail;', 'position: STATIC; grid-area: rail;');
  assert.notEqual(kit, r.kit);
  assert.equal(c12({ ...r, kit }).length, 0);
});

// Codex on #1316: a grouping rule nested in the base rail rule emits a
// conditional copy with the base selector; the base is the unconditional
// rule, so an unrelated nested @media does not hide its position/grid-area.
test('a nested @media in the base rail rule does not replace the base', () => {
  const r = receipt();
  const base = 'position: static; grid-area: rail; min-width: 0; width: 100%;';
  const kit = r.kit.replace(base, `${base}\n  @media (width < 1px) { color: red; }`);
  assert.notEqual(kit, r.kit);
  assert.equal(c12({ ...r, kit }).length, 0);
  const hung = r.kit.replace(base, `${base}\n  @media (width < 1px) { position: absolute; }`);
  assert.equal(c12({ ...r, kit: hung }).length, 1);
});

// Review of #1316: the rail is in flow only if nothing later hangs it again,
// in the same rule or in a later .hud-bottom rule.
test('a later declaration that hangs the relic rail again fails C12', () => {
  const r = receipt();
  const kit = r.kit.replace('align-self: start; pointer-events: none;\n}', 'align-self: start; pointer-events: none;\n  position: absolute;\n}');
  assert.notEqual(kit, r.kit);
  assert.equal(c12({ ...r, kit }).length, 1);
});

test('a later .hud-bottom rule that hangs the relic rail again fails C12', () => {
  const r = receipt();
  const kit = `${r.kit}\n:root[data-layout='narrow'] .shared-hud .hud-bottom { position: absolute; top: 100%; }\n`;
  assert.equal(c12({ ...r, kit }).length, 1);
});

// Codex on #1316: a string may hold an escaped delimiter or comment markers;
// neither may swallow the rules that follow it.
test('escaped quotes and comment markers inside strings do not hide a rail rule', () => {
  const r = receipt();
  const hung = '.shared-hud .hud-bottom.x { position: absolute; }';
  for (const kit of [
    `${r.kit}\n.a::before { content: "\\""; }\n${hung}\n`,
    `${r.kit}\n.a::before { content: '\\''; }\n${hung}\n`,
    `${r.kit}\n.a::before { content: "/*"; }\n${hung}\n.b::before { content: "*/"; }\n`,
  ]) assert.equal(c12({ ...r, kit }).length, 1, kit.slice(r.kit.length));
  // A real comment is still stripped.
  assert.equal(c12({ ...r, kit: `${r.kit}\n/* ${hung} */\n` }).length, 0);
});

// Codex on #1316: CSS keywords are ASCII case-insensitive.
test('an upper-case static base position is still in flow', () => {
  const r = receipt();
  const kit = r.kit.replace('position: static; grid-area: rail;', 'position: STATIC; grid-area: rail;');
  assert.notEqual(kit, r.kit);
  assert.equal(c12({ ...r, kit }).length, 0);
});

// Codex on #1316: display: none (or contents) takes the rail out of the grid.
// The shipped `:empty` rule hides a rail with no relics on purpose, so a rule
// whose subject is `:empty` may do it; no other rail rule may.
test('a rail rule that stops displaying the rail fails C12', () => {
  const r = receipt();
  for (const extra of ['.shared-hud .hud-bottom.expanded { display: none; }', '@media (width < 1px) { .shared-hud .hud-bottom { display: CONTENTS; } }']) {
    assert.equal(c12({ ...r, kit: `${r.kit}\n${extra}\n` }).length, 1, extra);
  }
  assert.equal(c12({ ...r, kit: `${r.kit}\n.shared-hud .hud-bottom.expanded { display: flex; }\n` }).length, 0);
  assert.match(r.kit, /\.shared-hud \.hud-bottom:empty \{[^}]*display: none/);
});

// Review of #1316: the `:empty` exemption holds only where `:empty` sits on
// the rail's own compound, not on another :is() argument or inside :not/:has.
test('only an :empty on the rail itself may hide the rail', () => {
  const r = receipt();
  for (const extra of [
    '.shared-hud :is(.hud-bottom, .x:empty) { display: none; }',
    '.shared-hud .hud-bottom:is(:empty, .x) { display: none; }',
    '.shared-hud .hud-bottom:not(:empty) { display: none; }',
    '.shared-hud .hud-bottom:has(:empty) { display: none; }',
  ]) assert.equal(c12({ ...r, kit: `${r.kit}\n${extra}\n` }).length, 1, extra);
  for (const extra of [
    '.shared-hud :is(.hud-bottom:empty, .x) { display: none; }',
    '.shared-hud .hud-bottom:is(:empty) { display: none; }',
  ]) assert.equal(c12({ ...r, kit: `${r.kit}\n${extra}\n` }).length, 0, extra);
});

// FINISH "C12 BOUNDARY stays stated": C12 reads CSS as text, and the limits of
// that reading are written down in tools/ui-components.mjs. Each one is named
// here so a later edit cannot drop a limit from the note without going red.
test('the C12 BOUNDARY note names each limit of reading CSS as text', () => {
  const src = readFileSync(new URL('../tools/ui-components.mjs', import.meta.url), 'utf8');
  const start = src.indexOf('// BOUNDARY:');
  assert.ok(start > 0, 'tools/ui-components.mjs lost its C12 BOUNDARY note');
  const lines = src.slice(start).split('\n');
  const note = lines.slice(0, lines.findIndex((line) => !line.startsWith('//'))).join('\n');
  for (const limit of [/cascade/, /specificity/, /!important/, /@layer order/, /@scope limits/, /var\(\) substitution/,
    /per-property value grammar/, /invalid later value/, /hud-visibility\.css/, /combat\.css/,
    /guard written with CSS nesting is rejected/, /hexadecimal escape in a quoted guard value/]) {
    assert.match(note, limit, `the C12 BOUNDARY note no longer names ${limit}`);
  }
});

// FINISH "C12 BOUNDARY stays stated": styles/hud-visibility.css is shipped and
// writes display on the rail (.hud-bottom), a property C12 judges. C12 reads
// it too: the player-preference hides it ships stay legal, and any other rail
// override written there fails exactly as it would in kit.css.
test('C12 judges the rail in styles/hud-visibility.css as well as kit.css', () => {
  const r = receipt();
  assert.ok(/\.hud-bottom/.test(r.hudVisibility), 'receipt() does not read styles/hud-visibility.css');
  assert.equal(c12(r).length, 0, 'the shipped preference hides must stay legal');
  for (const extra of [
    ":root[data-hud-show-relics='false'] .shared-hud .hud-bottom { position: absolute; }",
    '.shared-hud .hud-bottom.expanded { display: none !important; }',
    ":root[data-hud-show-relics='true'] .hud-bottom { display: none !important; }",
    '.shared-hud .hud-bottom { grid-area: auto; }',
  ]) {
    assert.equal(c12({ ...r, hudVisibility: `${r.hudVisibility}\n${extra}\n` }).length, 1, extra);
  }
});

// Review of #1368: a preference guard counts only when it is positive (a
// leading `:root[…]` compound, never inside :not()/:is()) and only when the
// preferences it names leave the rail empty. Both hide the rail while the
// default (preference on) holds, or hide relics still turned on, so each is
// judged in kit.css and in hud-visibility.css alike.
test('a HUD-preference guard hides the rail only when it empties the rail', () => {
  const r = receipt();
  const fail = [
    ":root:not([data-hud-show-relics='false']) .hud-bottom { display: none !important; }",
    ".shared-hud .hud-bottom:not([data-hud-show-relics='false']) { display: none; }",
    ".shared-hud .hud-bottom:is([data-hud-show-relics='false'], .expanded) { display: none; }",
    ':root[data-hud-show-potions="false"] .hud-bottom { display: none; }',
    ":root[data-hud-show-relics='false'] .hud-bottom { display: none; }",
    ":root[data-hud-show-vitality='false'] .hud-bottom { display: none; }",
    ":root[data-hud-show-currency='false'][data-hud-show-position='false'] .hud-bottom { display: none; }",
    ":root[data-hud-show-nonsense='false'] .hud-bottom { display: none; }",
    ":root[data-hud-show-relics='false'] .hud-bottom:not(:has(.hud-relics)) { display: none; }",
    ":root[data-hud-show-relics='false'] .hud-bottom:not(:not(:has(.hud-potions))) { display: none; }",
    ":root[data-hud-show-relics='false'].hud-bottom { display: none; }",
    // Review of #1368 (equivalent attribute syntax): the value stays
    // case-sensitive without the `i` flag, and only `=` means "is exactly".
    ":root[data-hud-show-relics='False'][data-hud-show-potions='false'] .hud-bottom { display: none; }",
    ":root[data-hud-show-relics~='false'][data-hud-show-potions='false'] .hud-bottom { display: none; }",
    // Review of #1368 (whitespace is a combinator): whitespace that is a
    // descendant combinator changes what the guard means, so it must never be
    // normalised away. `.hud- potions` is `.hud-` with a descendant
    // `potions`, which does not prove the potions are gone.
    ":root[data-hud-show-relics='false'] .hud-bottom:not(:has(.hud- potions)) { display: none; }",
    ":root[data-hud-show-relics='false'] .hud-bottom:not(:has(.hud-potions .x)) { display: none; }",
    ":root[data-hud-show-relics='false'] .hud-bottom:not(:has(. hud-potions)) { display: none; }",
    ":root [data-hud-show-relics='false'][data-hud-show-potions='false'] .hud-bottom { display: none; }",
    // Review of #1368: a guard written with CSS nesting reads as
    // `:is(:root[…]) .hud-bottom`, which is not a leading `:root[…]` compound,
    // so it is rejected (fails closed). No shipped sheet nests these rules;
    // the BOUNDARY note says to un-nest one instead.
    ":root[data-hud-show-relics='false'][data-hud-show-potions='false'] { .hud-bottom { display: none; } }",
    // Review of #1368: a hexadecimal escape in a quoted value is not decoded,
    // so the guard is rejected (fails closed). No shipped selector uses one.
    ":root[data-hud-show-relics='fal\\73 e'][data-hud-show-potions=false] .hud-bottom { display: none; }",
  ];
  const pass = [
    ":root[data-hud-show-relics='false'][data-hud-show-potions='false'] .shared-hud .hud-bottom { display: none; }",
    ':root[data-hud-show-relics="false"] .hud-bottom:not(:has(.hud-potions)) { display: none; }',
    ":root[data-hud-show-potions='false'] .shared-hud .hud-bottom:not( :has(.hud-relics) ) { display: none; }",
    // The same guards in equivalent CSS attribute syntax: whitespace around
    // `=`, an unquoted identifier value, an upper-case attribute name, the
    // `i` flag.
    ":root[data-hud-show-relics = 'false'][data-hud-show-potions = 'false'] .hud-bottom { display: none; }",
    ":root[data-hud-show-relics=false][ data-hud-show-potions=false ] .hud-bottom { display: none; }",
    ":root[DATA-HUD-SHOW-RELICS='false'] .hud-bottom:not(:has(.hud-potions)) { display: none; }",
    ":root[data-hud-show-potions='FALSE' i] .hud-bottom:not(:has(.hud-relics)) { display: none; }",
    // Whitespace that is not a combinator (inside parentheses, next to them)
    // and a CSS escape read as their plain forms.
    ":root[data-hud-show-relics='false'] .hud-bottom:not( :has( .hud-potions ) ) { display: none; }",
    ":root[data-hud-show-relics='false'] .hud-bottom:not(:has(.hud\\-potions)) { display: none; }",
  ];
  for (const sheet of ['kit', 'hudVisibility']) {
    for (const extra of fail) assert.equal(c12({ ...r, [sheet]: `${r[sheet]}\n${extra}\n` }).length, 1, `${sheet}: ${extra}`);
    for (const extra of pass) assert.equal(c12({ ...r, [sheet]: `${r[sheet]}\n${extra}\n` }).length, 0, `${sheet}: ${extra}`);
  }
});
