import { readFileSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import { normalizeLfText } from '../../tools/working-tree-text.mjs';

/** Normalize checkout CRLF at the boundary for assertions about source text. */
export function normalizeSourceText(text) {
  return normalizeLfText(text);
}

export function readSourceTextSync(path) {
  return normalizeSourceText(readFileSync(path, 'utf8'));
}

export async function readSourceText(path) {
  return normalizeSourceText(await readFileAsync(path, 'utf8'));
}
