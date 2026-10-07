// src/content/changelog.js — the in-game reader for the root CHANGELOG.md.
//
// CHANGELOG.md is the authored owner. The generated module is only its bundled
// transport: tools/about-changelog.mjs derives it and refuses drift. Keeping
// that boundary explicit lets the standalone game show the receipts without
// creating a second hand-maintained copy of their prose.

import { GENERATED_CHANGELOG } from './changelog.generated.js';

export const PROJECT_REPOSITORY_URL = 'https://github.com/cehinds/AshenSpire';

export function validateChangelog(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('changelog has no entries');
  const ids = new Set();
  for (const entry of entries) {
    if (!/^pr-\d+$/.test(entry.id)) throw new Error(`unstable changelog id: ${entry.id}`);
    if (ids.has(entry.id)) throw new Error(`duplicate changelog id: ${entry.id}`);
    ids.add(entry.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) throw new Error(`invalid date for ${entry.id}`);
    if (!entry.group || !entry.summary || /[\r\n]/.test(entry.summary)) throw new Error(`invalid summary for ${entry.id}`);
    if (!entry.detail || !entry.build || !Number.isInteger(entry.pullRequest)) throw new Error(`incomplete receipt for ${entry.id}`);
    if (entry.url !== `${PROJECT_REPOSITORY_URL}/pull/${entry.pullRequest}`) throw new Error(`unsafe pull-request URL for ${entry.id}`);
  }
  return entries;
}

export const CHANGELOG = Object.freeze(validateChangelog(GENERATED_CHANGELOG));
