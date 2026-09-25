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
