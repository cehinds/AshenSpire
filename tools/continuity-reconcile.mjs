#!/usr/bin/env node
// Read-only continuity graph reconciler.
//
// The pointer chooses exactly four immutable records. This tool validates that
// bounded graph; it does not discover, migrate, repair, or rewrite records.

import {
  appendFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const SELF = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SELF), '..');
const DEFAULT_ROOT = resolve(REPO_ROOT, 'ops/continuity');
const FIXTURE_ROOT = resolve(REPO_ROOT, 'tests/fixtures/continuity-cold-start');
const MAX_RECORD_BYTES = 1024 * 1024;
const SHA256 = /^[A-F0-9]{64}$/;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmpty = (value) => typeof value === 'string' && value.length > 0;
const isUtcDate = (value) => isNonEmpty(value) && value.endsWith('Z') && Number.isFinite(Date.parse(value));
const uniqueStrings = (value) => Array.isArray(value) && value.every(isNonEmpty) && new Set(value).size === value.length;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex').toUpperCase();

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function validateRelativePath(refPath) {
  if (!isNonEmpty(refPath)) return 'path must be a non-empty string';
  if (isAbsolute(refPath) || /^[A-Za-z]:/.test(refPath)) return 'absolute paths are forbidden';
  if (refPath.includes('\\')) return 'paths must use repository `/` separators';
  const parts = refPath.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return 'empty, dot, and traversal segments are forbidden';
  return null;
}

function readBounded(rootPath, refPath) {
  const pathFinding = validateRelativePath(refPath);
  if (pathFinding) throw new Error(`${refPath}: ${pathFinding}`);

  const root = realpathSync(rootPath);
  let cursor = root;
  for (const segment of refPath.split('/')) {
    cursor = join(cursor, segment);
    if (!existsSync(cursor)) throw new Error(`${refPath}: referenced file does not exist`);
    if (lstatSync(cursor).isSymbolicLink()) throw new Error(`${refPath}: symbolic links are forbidden`);
  }
  const target = realpathSync(cursor);
  if (!inside(root, target)) throw new Error(`${refPath}: resolved outside continuity root`);
  const stat = lstatSync(target);
  if (!stat.isFile()) throw new Error(`${refPath}: reference is not a regular file`);
  if (stat.size > MAX_RECORD_BYTES) throw new Error(`${refPath}: exceeds ${MAX_RECORD_BYTES} byte limit`);
  return readFileSync(target);
}

function parseJsonRecord(root, refPath, findings) {
  try {
    return JSON.parse(readBounded(root, refPath).toString('utf8'));
  } catch (error) {
    findings.push(`${refPath}: ${error.message}`);
    return null;
  }
}

function validateFileRef(value, label, findings) {
  if (!isObject(value)) {
    findings.push(`${label}: file reference must be an object`);
    return;
  }
  const pathFinding = validateRelativePath(value.path);
  if (pathFinding) findings.push(`${label}.path: ${pathFinding}`);
  if (!SHA256.test(value.sha256 || '')) findings.push(`${label}.sha256: expected 64 uppercase hexadecimal characters`);
}

function validatePointer(pointer, findings) {
  if (!isObject(pointer)) return findings.push('POINTER.json: root must be an object');
  if (pointer.schemaVersion !== 'ashenspire.continuity.pointer.v1') findings.push('POINTER.json: unsupported schemaVersion');
  if (!Number.isInteger(pointer.revision) || pointer.revision < 1) findings.push('POINTER.json: revision must be an integer >= 1');
  if (!isUtcDate(pointer.updatedAtUtc)) findings.push('POINTER.json: updatedAtUtc must be an ISO UTC timestamp');
  if (pointer.revision === 1 && pointer.previousHistoryId !== null) findings.push('POINTER.json: revision 1 must have previousHistoryId null');
  if (pointer.revision > 1 && !isNonEmpty(pointer.previousHistoryId)) findings.push('POINTER.json: revision >1 requires previousHistoryId');
  if (!isObject(pointer.current)) return findings.push('POINTER.json: current must be an object');
  if (!isNonEmpty(pointer.current.teamId)) findings.push('POINTER.json: current.teamId is required');
  if (!isNonEmpty(pointer.current.ticketId)) findings.push('POINTER.json: current.ticketId is required');
  for (const name of ['team', 'ticket', 'history', 'evidence']) validateFileRef(pointer.current[name], `POINTER.json current.${name}`, findings);
}

function validateOwner(owner, label, findings) {
  if (!isObject(owner) || !isNonEmpty(owner.role) || !isNonEmpty(owner.taskId)) findings.push(`${label}: owner requires role and taskId`);
}

function validateTeam(team, findings) {
  if (!isObject(team)) return findings.push('team: root must be an object');
  if (team.schemaVersion !== 'ashenspire.continuity.team.v1') findings.push('team: unsupported schemaVersion');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(team.id || '')) findings.push('team: id must be lowercase kebab-case');
  if (!isNonEmpty(team.name)) findings.push('team: name is required');
  validateOwner(team.owner, 'team', findings);
  if (team.writerPolicy !== 'ONE_WRITER_PER_PATH') findings.push('team: writerPolicy must be ONE_WRITER_PER_PATH');
  if (!uniqueStrings(team.activeTicketIds)) findings.push('team: activeTicketIds must contain unique non-empty strings');
}

function validateTicket(ticket, findings) {
  if (!isObject(ticket)) return findings.push('ticket: root must be an object');
  if (ticket.schemaVersion !== 'ashenspire.continuity.ticket.v1') findings.push('ticket: unsupported schemaVersion');
  for (const name of ['id', 'title', 'status', 'teamId', 'migrationBoundary']) {
    if (!isNonEmpty(ticket[name])) findings.push(`ticket: ${name} is required`);
  }
  if (!['T0', 'T1', 'T2', 'T3', 'T4'].includes(ticket.priority)) findings.push('ticket: priority must be T0-T4');
  validateOwner(ticket.owner, 'ticket', findings);
  if (!isObject(ticket.scope) || !uniqueStrings(ticket.scope.allowedRoots) || !uniqueStrings(ticket.scope.forbiddenActions)) {
    findings.push('ticket: scope requires unique allowedRoots and forbiddenActions');
  }
  if (!uniqueStrings(ticket.historyIds) || ticket.historyIds.length === 0) findings.push('ticket: historyIds must be a non-empty unique list');
}

function validateHistory(history, findings) {
  if (!isObject(history)) return findings.push('history: root must be an object');
  if (history.schemaVersion !== 'ashenspire.continuity.history.v1') findings.push('history: unsupported schemaVersion');
  for (const name of ['id', 'teamId', 'ticketId', 'event']) {
    if (!isNonEmpty(history[name])) findings.push(`history: ${name} is required`);
  }
  if (!Number.isInteger(history.sequence) || history.sequence < 1) findings.push('history: sequence must be an integer >= 1');
  if (!isUtcDate(history.recordedAtUtc)) findings.push('history: recordedAtUtc must be an ISO UTC timestamp');
  validateFileRef(history.evidence, 'history evidence', findings);
}

function verifyIntegrity(root, fileRef, label, findings) {
  if (!isObject(fileRef) || validateRelativePath(fileRef.path) || !SHA256.test(fileRef.sha256 || '')) return;
  try {
    const actual = sha256(readBounded(root, fileRef.path));
    if (actual !== fileRef.sha256) findings.push(`${label}: SHA-256 mismatch; expected ${fileRef.sha256}, got ${actual}`);
  } catch (error) {
    findings.push(`${label}: ${error.message}`);
  }
}

export function reconcileContinuityRoot(rootPath = DEFAULT_ROOT) {
  const root = resolve(rootPath);
  const findings = [];
  let pointer = null;
  try {
    if (lstatSync(root).isSymbolicLink()) findings.push('continuity root: symbolic links are forbidden');
    pointer = JSON.parse(readBounded(root, 'POINTER.json').toString('utf8'));
  } catch (error) {
    findings.push(`POINTER.json: ${error.message}`);
  }
  if (!pointer) return { ok: false, findings, root };

  validatePointer(pointer, findings);
  if (!isObject(pointer.current)) return { ok: false, findings, root, pointer };
  for (const name of ['team', 'ticket', 'history', 'evidence']) verifyIntegrity(root, pointer.current[name], `current.${name}`, findings);

  const team = parseJsonRecord(root, pointer.current.team?.path || '', findings);
  const ticket = parseJsonRecord(root, pointer.current.ticket?.path || '', findings);
  const history = parseJsonRecord(root, pointer.current.history?.path || '', findings);
  validateTeam(team, findings);
  validateTicket(ticket, findings);
  validateHistory(history, findings);

  if (team && ticket && history) {
    if (team.id !== pointer.current.teamId) findings.push('cross-link: pointer teamId does not match team.id');
    if (ticket.id !== pointer.current.ticketId) findings.push('cross-link: pointer ticketId does not match ticket.id');
    if (ticket.teamId !== team.id) findings.push('cross-link: ticket.teamId does not match team.id');
    if (!team.activeTicketIds.includes(ticket.id)) findings.push('cross-link: selected ticket is not active on selected team');
    if (history.teamId !== team.id || history.ticketId !== ticket.id) findings.push('cross-link: history subject does not match selected team/ticket');
    if (!ticket.historyIds.includes(history.id)) findings.push('cross-link: selected history is absent from ticket.historyIds');
    if (history.sequence !== pointer.revision) findings.push('cross-link: history.sequence must equal pointer.revision');
    if (history.evidence?.path !== pointer.current.evidence?.path || history.evidence?.sha256 !== pointer.current.evidence?.sha256) {
      findings.push('cross-link: history evidence does not equal pointer evidence');
    }
    if (team.owner?.role !== ticket.owner?.role || team.owner?.taskId !== ticket.owner?.taskId) {
      findings.push('cross-link: team and ticket do not name one owner');
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    root,
    revision: pointer.revision,
    teamId: pointer.current.teamId,
    ticketId: pointer.current.ticketId,
    integrityLinks: 4,
  };
}

function plantCopy(name) {
  const temp = mkdtempSync(join(tmpdir(), `ashenspire-continuity-${name}-`));
  const root = join(temp, 'root');
  cpSync(FIXTURE_ROOT, root, { recursive: true });
  return { temp, root };
}

export function runContinuitySelfTest() {
  const cases = [];
  const clean = reconcileContinuityRoot(FIXTURE_ROOT);
  cases.push({ name: 'cold-start fixture is accepted', passed: clean.ok, detail: clean.findings.join('; ') });

  const plants = [
    ['tampered ticket hash is refused', ({ root }) => appendFileSync(join(root, 'tickets/COLD-START/ticket.json'), '\n'), /SHA-256 mismatch/],
    ['traversing reference is refused', ({ root }) => {
      const pointerPath = join(root, 'POINTER.json');
      const pointer = JSON.parse(readFileSync(pointerPath, 'utf8'));
      pointer.current.team.path = '../outside.json';
      writeFileSync(pointerPath, `${JSON.stringify(pointer, null, 2)}\n`);
    }, /traversal segments are forbidden/],
    ['cross-linked team drift is refused', ({ root }) => {
      const ticketPath = join(root, 'tickets/COLD-START/ticket.json');
      const ticket = JSON.parse(readFileSync(ticketPath, 'utf8'));
      ticket.teamId = 'other-team';
      writeFileSync(ticketPath, `${JSON.stringify(ticket, null, 2)}\n`);
      const pointerPath = join(root, 'POINTER.json');
      const pointer = JSON.parse(readFileSync(pointerPath, 'utf8'));
      pointer.current.ticket.sha256 = sha256(readFileSync(ticketPath));
      writeFileSync(pointerPath, `${JSON.stringify(pointer, null, 2)}\n`);
    }, /ticket\.teamId does not match team\.id/],
  ];

  for (const [name, mutate, expected] of plants) {
    const copy = plantCopy(name.replace(/\W+/g, '-'));
    try {
      mutate(copy);
      const result = reconcileContinuityRoot(copy.root);
      const detail = result.findings.join('; ');
      cases.push({ name, passed: !result.ok && expected.test(detail), detail });
    } finally {
      rmSync(copy.temp, { recursive: true, force: true });
    }
  }

  const failed = cases.filter((entry) => !entry.passed);
  return { ok: failed.length === 0, cases, passed: cases.length - failed.length, failed: failed.length };
}

function cliRoot(value) {
  const candidate = resolve(REPO_ROOT, value || 'ops/continuity');
  if (!inside(REPO_ROOT, candidate)) throw new Error('--root must stay inside the repository');
  return candidate;
}

function printResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (result.ok) {
    console.log(`RESULT: continuity current graph valid — revision ${result.revision}, team ${result.teamId}, ticket ${result.ticketId}, ${result.integrityLinks} integrity links, 0 findings.`);
  } else {
    for (const finding of result.findings) console.error(`FINDING: ${finding}`);
    console.log(`RESULT: continuity current graph invalid — ${result.findings.length} finding(s).`);
  }
}

if (resolve(process.argv[1] || '') === resolve(SELF)) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  if (args.includes('--selftest')) {
    const result = runContinuitySelfTest();
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      for (const entry of result.cases) console.log(`${entry.passed ? 'PASS' : 'FAIL'} ${entry.name}${entry.passed ? '' : ` — ${entry.detail}`}`);
      console.log(`RESULT: continuity reconciler self-test ${result.ok ? 'passed' : 'failed'} — ${result.passed}/${result.cases.length} cases passed.`);
    }
    process.exit(result.ok ? 0 : 1);
  }
  const rootIndex = args.indexOf('--root');
  try {
    const result = reconcileContinuityRoot(cliRoot(rootIndex >= 0 ? args[rootIndex + 1] : undefined));
    printResult(result, json);
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    const result = { ok: false, findings: [error.message] };
    printResult(result, json);
    process.exit(2);
  }
}
