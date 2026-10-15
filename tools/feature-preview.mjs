#!/usr/bin/env node
// Keep feature-only README evidence removable without touching release content.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const START = '<!-- feature-preview:start -->';
export const END = '<!-- feature-preview:end -->';

export function featurePreviewRange(source) {
  const starts = source.split(START).length - 1;
  const ends = source.split(END).length - 1;
  if (!starts && !ends) return null;
  if (starts !== 1 || ends !== 1) throw new Error('Expected exactly one matching feature-preview marker pair.');
  const start = source.indexOf(START);
  const end = source.indexOf(END);
  if (end < start) throw new Error('Feature-preview markers are reversed.');
  return { start, end: end + END.length };
}

export function checkFeaturePreview(source) {
  const range = featurePreviewRange(source);
  if (!range) throw new Error('Feature preview block is missing.');
  if (!/^# [^\r\n]+\r?\n\s*$/.test(source.slice(0, range.start))) {
    throw new Error('Feature preview block must be directly after the README title.');
  }
  return range;
}

export function removeFeaturePreview(source) {
  const range = featurePreviewRange(source);
  if (!range) return source;
  // Remove only the marked bytes; retain all surrounding text verbatim.
  return source.slice(0, range.start) + source.slice(range.end);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, file = 'README.md', ...extra] = process.argv.slice(2);
  try {
    if (!['--check', '--remove'].includes(mode) || extra.length) {
      throw new Error('Usage: node tools/feature-preview.mjs --check|--remove [README.md]');
    }
    const source = readFileSync(file, 'utf8');
    if (mode === '--check') {
      checkFeaturePreview(source);
      console.log('Feature preview markers and placement are valid; verify build and screenshots manually.');
    } else {
      const result = removeFeaturePreview(source);
      if (result !== source) writeFileSync(file, result);
      console.log(result === source ? 'No feature preview block to remove.' : 'Removed feature preview block.');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
