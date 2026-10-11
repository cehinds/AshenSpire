#!/usr/bin/env node
// tools/readme-sync.mjs — keeps the generated parts of README.md current.
//
//   node tools/readme-sync.mjs --check   exit 1 with a diff when a region is
//                                        stale or its markers are missing
//   node tools/readme-sync.mjs --write   rewrite the stale regions in place
//
// WHAT IT OWNS. Only the text between a pair of markers in README.md:
//   <!-- readme-sync:<name> -->  …  <!-- /readme-sync:<name> -->
// Everything outside those pairs is hand-written and is never touched. The
// Windows installer lines are outside every region and stay that way.
//
// Regions:
//   channels — the "Play and download" table: Test, Dev, Release, Main only.
//              The retired Alternative Dev / Alternative Test rows are gone;
//              they are frozen root branches (CONTRIBUTING.md, Branch model).
//
// Zero dependencies, Node core only. Imported by tests/readme-sync.test.mjs.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const README = resolve(ROOT, 'README.md');

const BASE = 'https://cehinds.github.io/AshenSpire';

// The four playable channels the README lists. `slug` is the Pages path
// segment; `label` is the first-column text as the README words it.
export const CHANNELS = Object.freeze([
  { name: 'Test', slug: 'test', label: '**Test** — promoted' },
  { name: 'Dev', slug: 'dev', label: 'Dev — integration' },
  { name: 'Release', slug: 'release', label: 'Release — candidate' },
  { name: 'Main', slug: 'main', label: 'Main — earlier stable' },
]);

function channelRow({ name, slug, label }) {
  return `| ${label} | [![${name} build](${BASE}/${slug}/latest/build.svg)](${BASE}/${slug}/) `
    + `| [Play ${name}](${BASE}/${slug}/latest/) `
    + `| [HTML](${BASE}/${slug}/latest/download/AshenSpire.html) |`;
}

export function renderChannels() {
  return [
    '| Channel | Published build / history | Play | Download |',
    '| --- | --- | --- | --- |',
    ...CHANNELS.map(channelRow),
  ].join('\n');
}

export const REGIONS = Object.freeze([
  { name: 'channels', render: renderChannels },
]);

export const markers = (name) => ({
  open: `<!-- readme-sync:${name} -->`,
  close: `<!-- /readme-sync:${name} -->`,
});

// Returns { text, problems }. `text` is the source with every region rewritten
// to its rendered body; `problems` lists regions whose markers are missing or
// malformed. A stale region is one whose `text` differs from the source.
export function syncText(source, regions = REGIONS) {
  let text = source;
  const problems = [];
  for (const region of regions) {
    const { open, close } = markers(region.name);
    const openAt = text.indexOf(open);
    const closeAt = text.indexOf(close);
    if (openAt < 0 || closeAt < 0) {
      problems.push(`missing markers for region "${region.name}" (${open} … ${close})`);
      continue;
    }
    if (text.indexOf(open, openAt + 1) >= 0 || text.indexOf(close, closeAt + 1) >= 0) {
      problems.push(`duplicate markers for region "${region.name}"`);
      continue;
    }
    if (closeAt < openAt) {
      problems.push(`markers out of order for region "${region.name}"`);
      continue;
    }
    const bodyStart = openAt + open.length;
    const body = `\n${region.render()}\n`;
    text = text.slice(0, bodyStart) + body + text.slice(closeAt);
  }
  return { text, problems };
}

// Line-level diff of two blocks, for the --check report. Lines only in `want`
// get "- ", lines only in `have` get "+ ". Order is kept, which is enough to
// point at the stale row without a full LCS.
export function lineDiff(have, want) {
  const a = have.split('\n');
  const b = want.split('\n');
  const out = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    if (a[i] === b[i]) continue;
    if (a[i] !== undefined) out.push(`+ ${a[i]}`);
    if (b[i] !== undefined) out.push(`- ${b[i]}`);
  }
  return out.join('\n');
}

function main() {
  const check = process.argv.includes('--check');
  const write = process.argv.includes('--write');
  if (check === write) {
    console.error('usage: node tools/readme-sync.mjs --check | --write');
    process.exitCode = 2;
    return;
  }
  const source = readFileSync(README, 'utf8');
  const { text, problems } = syncText(source);
  if (problems.length) {
    for (const problem of problems) console.error(`README SYNC: ${problem}`);
    process.exitCode = 1;
    return;
  }
  if (text === source) {
    console.log('README SYNC CURRENT');
    return;
  }
  if (write) {
    writeFileSync(README, text, 'utf8');
    console.log('README SYNC UPDATED');
    return;
  }
  console.error('README SYNC OUT OF DATE (run node tools/readme-sync.mjs --write):');
  console.error(lineDiff(source, text));
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
