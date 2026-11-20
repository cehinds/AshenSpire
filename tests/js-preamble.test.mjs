import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { stripModulePreamble } from '../tools/js-preamble.mjs';

const lineEnds = text => text.match(/\r\n|[\r\n\u2028\u2029]/g) || [];
const evaluate = source => vm.runInNewContext(`"use strict";\n${source}`);
const parseFactory = source => new vm.Script(`"use strict"; (function () {\n${source}\n})`);

test('leading documentation shrinks while the first code token and suffix stay exact', () => {
  const body = "const value = 7; // body documentation stays\nvalue;";
  const source = `// ${'Documentation '.repeat(1500)}\n/* another header */${body}`;
  const packed = stripModulePreamble(source);
  assert.ok(packed.length < source.length - 15000, 'remove transport prose without raising the payload budget');
  assert.equal(packed, ` \n ${body}`);
  assert.deepEqual(lineEnds(packed), lineEnds(source));
  assert.equal(evaluate(packed), evaluate(source));
});

test('the first import permanently ends the walk, including subsequent body comments', () => {
  const body = "import { value } from './dependency.js';\n// leave this body comment\nexport const result = `${value} // data`;";
  assert.equal(stripModulePreamble(`// header\n${body}`), ` \n${body}`);
  assert.equal(stripModulePreamble(body), body, 'never rewrite imports, exports or their data');
});

test('the scanner counterexample keeps its regex and behavior after the first code token', () => {
  const body = "debugger\n/[/*][*/]/.test('**')";
  assert.equal(evaluate(body), true);
  assert.equal(stripModulePreamble(body), body);
  assert.equal(evaluate(stripModulePreamble(`// header\n${body}`)), true);
});

test('strings, regexes and nested multiline templates are untouched code or data', () => {
  const bodies = [
    "'https://example.test/a//b/*c*/'",
    '"/* text */ // text"',
    "/[/*][*/]/.test('**')",
    '`first\n// template data\n/* more data */ ${`nested ${1 + 2}`} last`',
    "const text = '/* data */';\n// body comment\ntext",
  ];
  for (const body of bodies) {
    assert.equal(stripModulePreamble(body), body);
    assert.equal(evaluate(stripModulePreamble(`/* header */${body}`)), evaluate(body));
  }
});

test('all JavaScript line terminators and existing prefix whitespace retain their order', () => {
  const source = '\uFEFF \t// one\r\n\t/* two\rthree\nfour\u2028five\u2029six */ \nconst value = 1;';
  const packed = stripModulePreamble(source);
  assert.equal(packed, '\uFEFF \t \r\n\t \r \n \u2028 \u2029 \nconst value = 1;');
  assert.deepEqual(lineEnds(packed), lineEnds(source));
  parseFactory(packed);
  for (const end of ['\r', '\n', '\r\n', '\u2028', '\u2029']) {
    const text = `// header${end}const value = 1;`;
    assert.equal(stripModulePreamble(text), ` ${end}const value = 1;`);
  }
});

test('license, preservation, copyright, SPDX and source annotations remain verbatim', () => {
  for (const comment of [
    '/*! retained license */',
    '//! retained notice',
    '/** @license MIT */',
    '/** @preserve retained notice */',
    '// Copyright Example contributors',
    '/* SPDX-License-Identifier: MIT */',
    '/* License: MIT */',
    '// Licensed under the MIT License',
    '/* Permission is hereby granted, free of charge. */',
    '// All rights reserved.',
    '//# sourceURL=module.js',
    '//@ sourceMappingURL=module.js.map',
    '/*# sourceMappingURL=module.js.map */',
    '// @ts-check',
  ]) {
    const source = `// preface\n${comment}\n// continuation with no identifying words\nconst value = 1;`;
    assert.equal(stripModulePreamble(source), source);
  }
});

test('only the preamble changes around directives and automatic semicolon insertion', () => {
  const body = "'use strict';\nfunction result() { return\n/* body comment */ 42; }\nresult();";
  assert.equal(stripModulePreamble(`/* header */${body}`), ` ${body}`);
  assert.equal(evaluate(stripModulePreamble(`/* header */${body}`)), undefined);
  const statement = 'let value = 1;\nvalue\n++value;\nvalue;';
  assert.equal(evaluate(stripModulePreamble(`// header\n${statement}`)), evaluate(statement));
});

test('a shebang stays unchanged and the existing strict factory parser refuses it', () => {
  const source = '#!/usr/bin/env node\n// body comment\nconst value = 1;';
  assert.equal(stripModulePreamble(source), source);
  assert.throws(() => parseFactory(source), SyntaxError);
  assert.throws(() => parseFactory(stripModulePreamble(source)), SyntaxError);
});

test('unterminated comments and existing strict syntax errors remain parse errors', () => {
  for (const source of ['/* unfinished', '// header\nconst value = ;', '// header\nwith ({}) {}']) {
    assert.deepEqual(lineEnds(stripModulePreamble(source)), lineEnds(source));
    assert.throws(() => parseFactory(source), SyntaxError);
    assert.throws(() => parseFactory(stripModulePreamble(source)), SyntaxError);
  }
  assert.equal(stripModulePreamble('/* unfinished'), '/* unfinished');
});

test('empty, whitespace-only and comment-only modules keep their line structure', () => {
  assert.equal(stripModulePreamble(''), '');
  assert.equal(stripModulePreamble('\uFEFF \t\r\n'), '\uFEFF \t\r\n');
  assert.equal(stripModulePreamble('// final comment'), ' ');
  assert.equal(stripModulePreamble('/* first */\n// second\n'), ' \n \n');
});
