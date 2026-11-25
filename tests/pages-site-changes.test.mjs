import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  parseChangelogEntries,
  selectBuildChanges,
  changesForCommit,
  changesListHtml,
  rootIndex,
  branchIndex,
  branchPreviewSection,
} from '../tools/pages-site.mjs';

const SAMPLE_CHANGELOG = `# Changelog

<details>
<summary>History</summary>

- **Archived note** ([#1](https://github.com/cehinds/AshenSpire/pull/1), \`0.4.0.1\`). Must never appear in recent bullets.

</details>

## 2026-11-24

- **Development checks split their longest group** ([#2988](https://github.com/cehinds/AshenSpire/pull/2988), \`0.7.5.102\`). The Dev discovery group that repeatedly reached its time limit now runs in three smaller groups with the same test coverage.
- **Combat effects get a timing editor in Score Studio** ([#2980](https://github.com/cehinds/AshenSpire/pull/2980), \`0.7.5.96\`). Effects now play one at a time across the battlefield with a 30 ms gap and 80% opacity. Second sentence omitted.
- **The desktop render check script is tidied** ([#2976](https://github.com/cehinds/AshenSpire/pull/2976), \`0.7.5.89\`). The packaged-app render check script is reformatted and typed, with no change in what it does.
- **Cards get names built from what they do** ([#2974](https://github.com/cehinds/AshenSpire/pull/2974), \`0.7.5.93\`). A name reads rarity, extra effect, element for spells, then the base word and rank.
- **Ward is now a health buffer on the health bar** ([#2971](https://github.com/cehinds/AshenSpire/pull/2971), \`0.7.5.84\`). Ward no longer adds to Poise: each Ward stack adds 5 Ward HP in blue on the health bar.
- **The Bestiary and the Compendium share one screen** ([#2978](https://github.com/cehinds/AshenSpire/pull/2978), \`0.7.5.87\`). Both now open on the same knowledge door.
`;

test('parseChangelogEntries skips <details> history and parses titles, PRs, stamps, and first sentences', () => {
  const entries = parseChangelogEntries(SAMPLE_CHANGELOG);
  assert.equal(entries.length, 6);
  assert.ok(!entries.some((e) => e.title.includes('Archived note')));
  assert.equal(entries[1].title, 'Combat effects get a timing editor in Score Studio');
  assert.equal(entries[1].pr, 2980);
  assert.equal(entries[1].stamp, '0.7.5.96');
  assert.equal(entries[1].summary, 'Effects now play one at a time across the battlefield with a 30 ms gap and 80% opacity.');
  assert.equal(entries[0].substantial, false, 'CI discovery split is marked housekeeping');
  assert.equal(entries[2].substantial, false, 'render script tidy is marked housekeeping');
  assert.equal(entries[1].substantial, true);
});

test('selectBuildChanges picks up to 4 most substantial recent changes, backfills when sparse, and falls back to commits', () => {
  const picked = selectBuildChanges(SAMPLE_CHANGELOG);
  assert.equal(picked.length, 4);
  assert.deepEqual(picked.map((c) => c.pr), [2980, 2974, 2971, 2978], 'skips CI/tidy chores when 4 substantial entries exist');

  // When fewer than 3 substantial entries exist, backfills from newest remaining receipts
  const sparse = `## 2026-11-24\n- **Development checks split their longest group** ([#10](https://github.com/cehinds/AshenSpire/pull/10), \`0.7.5.10\`). Workflow split.\n- **Ward reworked** ([#9](https://github.com/cehinds/AshenSpire/pull/9), \`0.7.5.9\`). Ward blocks HP damage.\n- **The desktop render check script is tidied** ([#8](https://github.com/cehinds/AshenSpire/pull/8), \`0.7.5.8\`). Reformatted and typed, with no change in what it does.\n`;
  const sparsePicked = selectBuildChanges(sparse);
  assert.equal(sparsePicked.length, 3);
  assert.deepEqual(sparsePicked.map((c) => c.pr), [10, 9, 8]);

  // Empty changelog falls back to non-noise commit subjects
  const fromCommits = selectBuildChanges('', {
    fallbackCommits: [
      'build: stamp 0.7.5.102 [build-stamp]',
      'version-advance: 0.7.5',
      'feat: add auto-balance modal (#2991)',
      'fix: stop blacksmith upgrade lag',
      'Merge pull request #2990 from cehinds/foo',
      'ui: compact relic card layout',
    ],
  });
  assert.equal(fromCommits.length, 3);
  assert.equal(fromCommits[0].title, 'Add auto-balance modal');
  assert.equal(fromCommits[0].pr, 2991);
  assert.equal(fromCommits[1].title, 'Stop blacksmith upgrade lag');
  assert.equal(fromCommits[2].title, 'Compact relic card layout');
});

test('changesForCommit reads 3-4 real recent bullets from HEAD and origin/dev', () => {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const changes = changesForCommit(sha);
  assert.ok(changes.length >= 3 && changes.length <= 4, `expected 3-4 bullets, got ${changes.length}`);
  assert.ok(changes.every((c) => typeof c.title === 'string' && c.title.length > 0));
});

test('rootIndex, branchIndex, and branchPreviewSection render escaped bullet lists and omit them when empty', () => {
  assert.equal(changesListHtml([]), '');
  assert.equal(changesListHtml(null), '');

  const changes = [
    { title: 'Ward <rework>', summary: 'Absorbs HP hits.', pr: 2971, prUrl: 'https://github.com/cehinds/AshenSpire/pull/2971' },
    { title: 'Score Studio timing', summary: 'Live preview.', pr: 2980, prUrl: 'https://github.com/cehinds/AshenSpire/pull/2980' },
    { title: 'Card naming', summary: 'Names reflect effects.', pr: 2974, prUrl: 'https://github.com/cehinds/AshenSpire/pull/2974' },
  ];
  const build = {
    branch: 'dev', ordinal: 102, sha: 'a'.repeat(40), digest: 'deadbeef', built: '2026-11-24',
    version: '0.7.5', bytes: 1000, source: 'rebuild', edition: 'light', changes,
  };
  const root = rootIndex([{ branch: 'dev', builds: [build], headTracksBuild: false, headOrdinal: 102 }], 'now', []);
  assert.match(root, /<ul class="changes">/);
  assert.match(root, /Ward &lt;rework&gt;/);
  assert.doesNotMatch(root, /Ward <rework>/);
  assert.match(root, /#2971/);
  assert.match(root, /<ul class="changes compact">/);

  const branchHtml = branchIndex('dev', [build], build.sha, 'now', true, false);
  assert.match(branchHtml, /<ul class="changes">/);
  assert.match(branchHtml, /<ul class="changes compact">/);

  const previewHtml = branchPreviewSection([{
    branch: 'feature/x', path: 'feature/x', pr: 99, sha: 'b'.repeat(40), file: 'a.html',
    changes: [{ title: 'Preview change 1', summary: 'Does something new.' }],
  }]);
  assert.match(previewHtml, /<ul class="changes">/);
  assert.match(previewHtml, /Preview change 1/);
});
