#!/usr/bin/env node
// Keep the durable owner-ask mirror deterministic and make GitHub drift loud.
//
//   node tools/asks-ledger.mjs --write   regenerate the Markdown view
//   node tools/asks-ledger.mjs --check   validate data + committed view
//   node tools/asks-ledger.mjs --github  also compare current issue bodies/labels
//   node tools/asks-ledger.mjs --selftest prove the local validator catches drift

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = resolve(ROOT, 'docs/asks/asks-ledger.json');
const VIEW_PATH = resolve(ROOT, 'docs/asks/asks-ledger.md');
const EXPECTED_IDS = ['C19', 'C18', 'C11', 'C6', 'C5', 'R2', 'E13', 'E12', 'E5', 'E3'];

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const fail = (message) => { throw new Error(message); };

function loadData() {
  return JSON.parse(readFileSync(DATA_PATH, 'utf8'));
}

function validate(data) {
  if (data.schema !== 'ashenspire/owner-asks-ledger/v1') fail(`unknown schema: ${data.schema}`);
  if (data.repository !== 'cehinds/AshenSpire') fail(`wrong repository: ${data.repository}`);
  if (!Array.isArray(data.entries) || data.entries.length !== EXPECTED_IDS.length) {
    fail(`expected ${EXPECTED_IDS.length} entries, found ${data.entries?.length ?? 'none'}`);
  }
  const ids = data.entries.map((entry) => entry.ask_id);
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_IDS)) fail(`ask order/denominator drift: ${ids.join(',')}`);
  if (new Set(ids).size !== ids.length) fail('duplicate ask_id');
  if (new Set(data.entries.map((entry) => entry.issue)).size !== data.entries.length) fail('duplicate issue');
  for (const entry of data.entries) {
    for (const key of ['ask_id', 'issue', 'said_on', 'verbatim', 'body_ledger_state', 'issue_state_label',
      'source_created_at', 'source_updated_at', 'source_fingerprint', 'source_body_sha256', 'where_it_stands']) {
      if (entry[key] === undefined || entry[key] === '') fail(`${entry.ask_id || '?'} missing ${key}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.said_on)) fail(`${entry.ask_id} invalid said_on`);
    if (!/^state:/.test(entry.issue_state_label)) fail(`${entry.ask_id} invalid issue_state_label`);
    if (!/^[0-9a-f]{16}$/.test(entry.source_fingerprint)) fail(`${entry.ask_id} invalid source_fingerprint`);
    if (!/^[0-9a-f]{64}$/.test(entry.source_body_sha256)) fail(`${entry.ask_id} invalid body SHA256`);
  }
  return data;
}

function render(data) {
  const lines = [
    '# Durable owner asks ledger',
    '',
    '> Preservation mirror for [Issue #397](https://github.com/cehinds/AshenSpire/issues/397).',
    '> These entries preserve source wording and provenance; they do not resolve, approve, reprioritize, or close any ask.',
    '',
    'Canonical data: [`asks-ledger.json`](asks-ledger.json). Regenerate with `node tools/asks-ledger.mjs --write`.',
    'Check local drift with `node tools/asks-ledger.mjs --check`; add `--github` to compare the ten live issue bodies and labels.',
    '',
    `Denominator: **${data.entries.length}/${EXPECTED_IDS.length}** asks.`,
    '',
  ];
  for (const entry of data.entries) {
    lines.push(
      `## ${entry.ask_id} · Issue #${entry.issue}`,
      '',
      `- Source: https://github.com/cehinds/AshenSpire/issues/${entry.issue}`,
      `- Said: ${entry.said_on}`,
      `- Body ledger state: \`${entry.body_ledger_state}\``,
      `- Current preserved issue-state label: \`${entry.issue_state_label}\``,
      `- Issue body SHA-256: \`${entry.source_body_sha256}\``,
      `- Legacy ledger fingerprint: \`${entry.source_fingerprint}\``,
      `- Source timestamps: created \`${entry.source_created_at}\`; updated \`${entry.source_updated_at}\``,
      '',
      '**Owner words preserved verbatim from the issue body:**',
      '',
      `> ${entry.verbatim}`,
      '',
      '**Preserved issue context:**',
      '',
      entry.where_it_stands,
      '',
    );
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

async function checkGitHub(data) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'AshenSpire-asks-ledger-check' };
  let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    try {
      token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      // Public repositories remain checkable without authentication until the
      // public REST limit is exhausted; a non-2xx response is still a hard red.
    }
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  for (const entry of data.entries) {
    const response = await fetch(`https://api.github.com/repos/${data.repository}/issues/${entry.issue}`, { headers });
    if (!response.ok) fail(`${entry.ask_id} GitHub read failed: ${response.status} ${response.statusText}`);
    const issue = await response.json();
    const labels = issue.labels.map((label) => typeof label === 'string' ? label : label.name);
    const actualAsk = labels.find((label) => label.startsWith('ask:'));
    const actualState = labels.find((label) => label.startsWith('state:'));
    if (actualAsk !== `ask:${entry.ask_id}`) fail(`${entry.ask_id} live ask label drift: ${actualAsk || 'missing'}`);
    if (actualState !== entry.issue_state_label) fail(`${entry.ask_id} live state label drift: ${actualState || 'missing'}`);
    const actualSha = sha256(issue.body || '');
    if (actualSha !== entry.source_body_sha256) fail(`${entry.ask_id} live issue body drift: ${actualSha}`);
  }
}

function selftest(data) {
  const plants = [
    ['missing row', (copy) => copy.entries.pop()],
    ['duplicate issue', (copy) => { copy.entries[1].issue = copy.entries[0].issue; }],
    ['invalid source digest', (copy) => { copy.entries[0].source_body_sha256 = '0'.repeat(63); }],
  ];
  let caught = 0;
  for (const [name, plant] of plants) {
    const copy = structuredClone(data);
    plant(copy);
    try { validate(copy); }
    catch { caught += 1; console.log(`CAUGHT ${name}`); }
  }
  if (caught !== plants.length) fail(`selftest ${caught}/${plants.length} plants caught`);
  console.log(`asks ledger selftest: ${caught}/${plants.length} CAUGHT`);
}

const data = validate(loadData());
const expected = render(data);

if (process.argv.includes('--write')) {
  writeFileSync(VIEW_PATH, expected, 'utf8');
  console.log(`asks ledger: wrote ${data.entries.length} entries`);
} else {
  const actual = readFileSync(VIEW_PATH, 'utf8');
  if (actual !== expected) fail('asks-ledger.md drift; run node tools/asks-ledger.mjs --write');
  console.log(`asks ledger: local ${data.entries.length}/${EXPECTED_IDS.length} PASS`);
}

if (process.argv.includes('--github')) {
  await checkGitHub(data);
  console.log(`asks ledger: live GitHub ${data.entries.length}/${EXPECTED_IDS.length} PASS`);
}
if (process.argv.includes('--selftest')) selftest(data);
