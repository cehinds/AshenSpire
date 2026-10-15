import test from 'node:test';
import assert from 'node:assert/strict';
import { publicPreviewIdentity, assertCompatiblePublicBuild, loadEligiblePublicPreview, HOSTED_URL } from '../tools/combat-audit/hosted-preview.mjs';

const commit = 'a'.repeat(40), head = 'b'.repeat(40);
const html = "const SOURCE = '368140ce27'; const ORDINAL = '1530'; const coreContentBundle = {\n  version: '0.7.1'\n}";
const site = `<section class="card"><h3>feature/FullCombatAudit</h3><a href="https://github.com/cehinds/AshenSpire/commit/${commit}">commit</a></section>`;
test('hosted proof pins real branch metadata and complete compiled identity', () => {
  const identity = publicPreviewIdentity(html, site);
  assert.equal(HOSTED_URL, 'https://cehinds.github.io/AshenSpire/branches/feature/FullCombatAudit/latest/');
  assert.equal(identity.commit, commit); assert.equal(identity.source, '368140ce27'); assert.equal(identity.version, '0.7.1.1530');
  assert.match(identity.htmlSha256, /^[0-9a-f]{64}$/);
  assert.throws(() => publicPreviewIdentity(html, site.replace('FullCombatAudit', 'Other')), /source commit/);
  assert.throws(() => publicPreviewIdentity(html.replace('368140ce27', 'UNSTAMPED'), site), /complete source/);
});
test('hosted polling rejects stale public commit before downloading the large build', async () => {
  const fetched = [];
  const fetchText = async url => {
    fetched.push(url);
    if (url.endsWith('build.txt')) throw Error('stale build must not be fetched');
    return url === HOSTED_URL ? '<iframe id="preview" sandbox="allow-scripts"></iframe>' : site;
  };
  await assert.rejects(loadEligiblePublicPreview({ fetchText, expectedCommit: head, expectedSource: '368140ce27',
    api: async () => ({ status: 'ahead', merge_base_commit: { sha: commit }, total_commits: 1, files: [{ filename: 'src/engine/combat.js' }] }) }), /existing Pages eligibility/);
  assert.equal(fetched.length, 2);
  assert.ok(fetched.every(url => !url.endsWith('build.txt')));
});
test('eligible public metadata permits one build download and still checks its source', async () => {
  const fetched = [];
  const fetchText = async url => {
    fetched.push(url);
    return url.endsWith('build.txt') ? html : url === HOSTED_URL ? '<iframe id="preview"></iframe>' : site;
  };
  const input = { fetchText, expectedCommit: commit, expectedSource: '368140ce27', api: () => { throw Error('exact commit needs no API'); } };
  const proof = await loadEligiblePublicPreview(input);
  assert.equal(proof.identity.commit, commit);
  assert.equal(proof.identity.htmlSha256, publicPreviewIdentity(html, site).htmlSha256);
  assert.equal(fetched.filter(url => url.endsWith('build.txt')).length, 1);
  await assert.rejects(loadEligiblePublicPreview({ ...input, expectedSource: 'different' }), /production source digest/);
});
test('hosted proof uses existing Pages freshness rules and rejects stale code or source', async () => {
  const identity = publicPreviewIdentity(html, site);
  await assertCompatiblePublicBuild(identity, { expectedCommit: commit, expectedSource: identity.source, api: () => { throw Error('same commit needs no API'); } });
  const comparison = { status: 'ahead', merge_base_commit: { sha: commit }, total_commits: 1, files: [{ filename: 'docs/preview/features/full-combat-audit/CAPTURE.md' }] };
  await assertCompatiblePublicBuild(identity, { expectedCommit: head, expectedSource: identity.source, api: async () => comparison });
  await assert.rejects(assertCompatiblePublicBuild(identity, { expectedCommit: head, expectedSource: identity.source,
    api: async () => ({ ...comparison, files: [{ filename: 'tools/combat-audit/proof-index.json' }] }) }), /existing Pages eligibility/);
  await assert.rejects(assertCompatiblePublicBuild(identity, { expectedCommit: commit, expectedSource: 'different', api: async () => comparison }), /production source digest/);
});
