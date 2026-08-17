// src/content/changelog.js — the one authored home for player-facing change notes.
//
// The About screen renders this data; it does not restate it. Each change has a
// short face and a longer receipt so the first read stays skimmable without
// discarding the detail a player needs when something changed under them.

import { contentBundle } from './index.js';

export const PROJECT_REPOSITORY_URL = 'https://github.com/cehinds/AshenSpire';

export const CHANGELOG = [
  {
    version: contentBundle.version,
    date: '2026-08-17',
    label: 'Current development line',
    changes: [
      {
        summary: 'Combat controls stay reachable beneath the hand.',
        detail: 'The action strip now sits below the cards, where End Turn and related controls remain visible without covering the hand.',
      },
      {
        summary: 'Level-up choices show whether you can afford them.',
        detail: 'Attribute controls now derive their enabled state from the real level cost and the run’s available currency before a choice is committed.',
      },
      {
        summary: 'Shrine smithing keeps the chosen card and its confirmation in view.',
        detail: 'Choosing an upgrade scrolls the confirmation into view and provides a clear action hint before the permanent change.',
      },
      {
        summary: 'Build identity is visible on the title, map, combat, and About surfaces.',
        detail: 'Version, source digest, build date, and run path are derived by the build so screenshots and bug reports can identify the exact artifact.',
      },
      {
        summary: 'Settings include clearer accessibility and project information.',
        detail: 'The Settings tabs, readable value labels, AI-use acknowledgement, and profile recovery surfaces give important controls and provenance a stable home.',
      },
    ],
  },
];

/**
 * validateChangelog(entries) -> a list of path-specific defects.
 *
 * This is the same public boundary the real CHANGELOG passes below. A malformed
 * release never becomes an empty expander or an ambiguous version heading.
 */
export function validateChangelog(entries) {
  const problems = [];
  if (!Array.isArray(entries) || entries.length === 0) {
    return ['CHANGELOG must contain at least one release'];
  }

  const versions = new Set();
  entries.forEach((release, releaseIndex) => {
    const path = `CHANGELOG[${releaseIndex}]`;
    if (!release || typeof release !== 'object' || Array.isArray(release)) {
      problems.push(`${path} must be an object`);
      return;
    }
    for (const field of ['version', 'date', 'label']) {
      if (typeof release[field] !== 'string' || !release[field].trim()) {
        problems.push(`${path}.${field} must be a non-empty string`);
      }
    }
    if (typeof release.version === 'string') {
      if (versions.has(release.version)) problems.push(`${path}.version duplicates '${release.version}'`);
      versions.add(release.version);
    }
    if (!Array.isArray(release.changes) || release.changes.length === 0) {
      problems.push(`${path}.changes must contain at least one change`);
      return;
    }
    release.changes.forEach((change, changeIndex) => {
      const changePath = `${path}.changes[${changeIndex}]`;
      if (!change || typeof change !== 'object' || Array.isArray(change)) {
        problems.push(`${changePath} must be an object`);
        return;
      }
      for (const field of ['summary', 'detail']) {
        if (typeof change[field] !== 'string' || !change[field].trim()) {
          problems.push(`${changePath}.${field} must be a non-empty string`);
        }
      }
      if (typeof change.summary === 'string' && /[\r\n]/.test(change.summary)) {
        problems.push(`${changePath}.summary must stay on one authored line`);
      }
    });
  });
  return problems;
}

const CHANGELOG_PROBLEMS = validateChangelog(CHANGELOG);
if (CHANGELOG_PROBLEMS.length) {
  throw new Error(`Invalid changelog:\n${CHANGELOG_PROBLEMS.join('\n')}`);
}
