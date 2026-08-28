#!/usr/bin/env node
// Read-only continuity graph reconciler.
//
// The pointer selects one current ticket while its team record hash-locks every
// active ticket. Each active ticket hash-locks its complete bounded history.
// This tool validates that graph; it never discovers external ledgers, migrates,
// repairs, or writes repository records.

import {
  appendFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { reconcileFeatureDirectory, runFeatureChannelSelfTest } from './continuity-feature-channels.mjs';
import { reconcileEscalationRoot, runEscalationSelfTest } from './continuity-escalation.mjs';

const SELF = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SELF), '..');
const DEFAULT_ROOT = resolve(REPO_ROOT, 'ops/continuity');
const FIXTURE_ROOT = resolve(REPO_ROOT, 'tests/fixtures/continuity-cold-start');
const MAX_RECORD_BYTES = 1024 * 1024;
const MAX_ACTIVE_TICKETS = 64;
const MAX_HISTORY_FILES = 1024;
const SHA256 = /^[A-F0-9]{64}$/;
const LIFECYCLE = new Set([
  'NEW',
  'TRIAGED',
  'CONTRACT READY',
  'ASSIGNED',
  'IN PROGRESS',
  'CANDIDATE FROZEN',
  'FUNCTIONAL QA',
  'EXPERIENCE QA',
  'READY FOR MAIN',
  'DEV INTEGRATED',
  'HOSTED VERIFIED',
  'RESOLVED',
  'WAITING ON DECISION',
  'BLOCKED',
  'STALE',
  'CANCELLED',
]);
const BLOCKER_STATUSES = new Set(['WAITING ON DECISION', 'BLOCKED', 'STALE']);
const DELIVERY_FACT_NAMES = [
  'localCandidate',
  'pushed',
  'pullRequest',
  'devIntegrated',
  'hostedVerified',
  'resolved',
  'released',
];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmpty = (value) => typeof value === 'string' && value.length > 0;
const isUtcDate = (value) =>
  isNonEmpty(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
const uniqueStrings = (value, max = Number.MAX_SAFE_INTEGER) =>
  Array.isArray(value) && value.length <= max && value.every(isNonEmpty) && new Set(value).size === value.length;
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

function exactObject(value, label, required, allowed, findings) {
  if (!isObject(value)) {
    findings.push(`${label}: expected an object`);
    return false;
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) findings.push(`${label}: missing required property ${key}`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) findings.push(`${label}: additional property ${key} is forbidden`);
  }
  return true;
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

function listBoundedHistoryPaths(rootPath, findings) {
  const root = realpathSync(rootPath);
  const historyDir = join(root, 'history');
  try {
    if (!existsSync(historyDir)) throw new Error('history directory does not exist');
    if (lstatSync(historyDir).isSymbolicLink()) throw new Error('history directory symbolic links are forbidden');
    const realHistory = realpathSync(historyDir);
    if (!inside(root, realHistory) || !lstatSync(realHistory).isDirectory()) throw new Error('history must resolve to a directory inside continuity root');
    const entries = readdirSync(realHistory, { withFileTypes: true });
    if (entries.length > MAX_HISTORY_FILES + 32) throw new Error(`history directory exceeds bounded entry limit ${MAX_HISTORY_FILES + 32}`);
    const paths = [];
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        findings.push(`history/${entry.name}: symbolic links are forbidden`);
        continue;
      }
      if (entry.name.endsWith('.json')) {
        if (!entry.isFile()) findings.push(`history/${entry.name}: history JSON must be a regular file`);
        else paths.push(`history/${entry.name}`);
      }
    }
    if (paths.length > MAX_HISTORY_FILES) findings.push(`history: exceeds ${MAX_HISTORY_FILES} JSON file limit`);
    return paths.sort();
  } catch (error) {
    findings.push(`history: ${error.message}`);
    return [];
  }
}

function parseJsonRecord(root, refPath, findings) {
  try {
    return JSON.parse(readBounded(root, refPath).toString('utf8'));
  } catch (error) {
    findings.push(`${refPath}: ${error.message}`);
    return null;
  }
}

function validateFileRef(value, label, findings, withId = false) {
  const required = withId ? ['id', 'path', 'sha256'] : ['path', 'sha256'];
  if (!exactObject(value, label, required, required, findings)) return;
  if (withId && !isNonEmpty(value.id)) findings.push(`${label}.id: expected a non-empty string`);
  const pathFinding = validateRelativePath(value.path);
  if (pathFinding) findings.push(`${label}.path: ${pathFinding}`);
  if (!SHA256.test(value.sha256 || '')) findings.push(`${label}.sha256: expected 64 uppercase hexadecimal characters`);
}

function validateOwner(owner, label, findings) {
  if (!exactObject(owner, label, ['role', 'taskId'], ['role', 'taskId'], findings)) return;
  if (!isNonEmpty(owner.role) || !isNonEmpty(owner.taskId)) findings.push(`${label}: owner requires non-empty role and taskId`);
}

function validatePointer(pointer, findings) {
  const keys = ['schemaVersion', 'revision', 'updatedAtUtc', 'previousHistoryId', 'current'];
  if (!exactObject(pointer, 'POINTER.json', keys, keys, findings)) return;
  if (pointer.schemaVersion !== 'ashenspire.continuity.pointer.v2') findings.push('POINTER.json: unsupported schemaVersion');
  if (!Number.isInteger(pointer.revision) || pointer.revision < 1) findings.push('POINTER.json: revision must be an integer >= 1');
  if (!isUtcDate(pointer.updatedAtUtc)) findings.push('POINTER.json: updatedAtUtc must be an ISO UTC timestamp');
  if (pointer.revision === 1 && pointer.previousHistoryId !== null) findings.push('POINTER.json: revision 1 must have previousHistoryId null');
  if (pointer.revision > 1 && !isNonEmpty(pointer.previousHistoryId)) findings.push('POINTER.json: revision >1 requires previousHistoryId');
  const currentKeys = ['teamId', 'ticketId', 'team', 'ticket', 'history', 'evidence'];
  if (!exactObject(pointer.current, 'POINTER.json current', currentKeys, currentKeys, findings)) return;
  if (!isNonEmpty(pointer.current.teamId)) findings.push('POINTER.json: current.teamId is required');
  if (!isNonEmpty(pointer.current.ticketId)) findings.push('POINTER.json: current.ticketId is required');
  for (const name of ['team', 'ticket', 'history', 'evidence']) validateFileRef(pointer.current[name], `POINTER.json current.${name}`, findings);
}

function validateTeam(team, findings, label = 'team') {
  const keys = ['schemaVersion', 'id', 'name', 'owner', 'writerPolicy', 'activeTickets'];
  if (!exactObject(team, label, keys, keys, findings)) return;
  if (team.schemaVersion !== 'ashenspire.continuity.team.v2') findings.push(`${label}: unsupported schemaVersion`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(team.id || '')) findings.push(`${label}: id must be lowercase kebab-case`);
  if (!isNonEmpty(team.name)) findings.push(`${label}: name is required`);
  validateOwner(team.owner, `${label}.owner`, findings);
  if (team.writerPolicy !== 'ONE_WRITER_PER_PATH') findings.push(`${label}: writerPolicy must be ONE_WRITER_PER_PATH`);
  if (!Array.isArray(team.activeTickets) || team.activeTickets.length < 1 || team.activeTickets.length > MAX_ACTIVE_TICKETS) {
    findings.push(`${label}: activeTickets must contain 1-${MAX_ACTIVE_TICKETS} entries`);
    return;
  }
  for (const [index, ref] of team.activeTickets.entries()) validateFileRef(ref, `${label}.activeTickets[${index}]`, findings, true);
  const ids = team.activeTickets.map((ref) => ref?.id);
  const paths = team.activeTickets.map((ref) => ref?.path);
  if (new Set(ids).size !== ids.length) findings.push(`${label}: active ticket ids must be unique`);
  if (new Set(paths).size !== paths.length) findings.push(`${label}: active ticket paths must be unique`);
}

function validateStatus(status, label, findings) {
  if (!exactObject(status, label, ['value', 'atUtc'], ['value', 'atUtc'], findings)) return;
  if (!LIFECYCLE.has(status.value)) findings.push(`${label}.value: unsupported canonical lifecycle value`);
  if (!isUtcDate(status.atUtc)) findings.push(`${label}.atUtc: expected an ISO UTC timestamp`);
}

function validateFact(fact, label, findings) {
  if (!exactObject(fact, label, ['value', 'atUtc', 'evidence'], ['value', 'atUtc', 'evidence'], findings)) return;
  if (typeof fact.value !== 'boolean') findings.push(`${label}.value: expected boolean`);
  if (fact.value === true) {
    if (!isUtcDate(fact.atUtc) || !isNonEmpty(fact.evidence)) findings.push(`${label}: true requires atUtc and evidence`);
  } else if (fact.value === false && (fact.atUtc !== null || fact.evidence !== null)) {
    findings.push(`${label}: false requires null atUtc and evidence`);
  }
}

function validateBlocker(blocker, status, label, findings) {
  const requiresBlocker = BLOCKER_STATUSES.has(status?.value);
  if (blocker === null) {
    if (requiresBlocker) findings.push(`${label}: ${status.value} requires a structured blocker`);
    return;
  }
  const keys = ['condition', 'owner', 'retryTrigger', 'safeWork'];
  if (!exactObject(blocker, label, keys, keys, findings)) return;
  if (!requiresBlocker) findings.push(`${label}: blocker must be null outside BLOCKED, WAITING ON DECISION, or STALE`);
  if (!isNonEmpty(blocker.condition) || !isNonEmpty(blocker.retryTrigger)) findings.push(`${label}: condition and retryTrigger are required`);
  validateOwner(blocker.owner, `${label}.owner`, findings);
  if (!uniqueStrings(blocker.safeWork, 128)) findings.push(`${label}.safeWork: expected up to 128 unique non-empty strings`);
}

function validateScope(scope, label, findings) {
  const keys = ['allowedRoots', 'serializedLanes', 'forbiddenActions'];
  if (!exactObject(scope, label, keys, keys, findings)) return;
  if (!uniqueStrings(scope.allowedRoots, 128) || scope.allowedRoots.length < 1) findings.push(`${label}.allowedRoots: expected 1-128 unique paths`);
  else for (const path of scope.allowedRoots) {
    const issue = validateRelativePath(path);
    if (issue) findings.push(`${label}.allowedRoots ${path}: ${issue}`);
  }
  if (!uniqueStrings(scope.serializedLanes, 128)) findings.push(`${label}.serializedLanes: expected up to 128 unique strings`);
  else for (const lane of scope.serializedLanes) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(lane)) findings.push(`${label}.serializedLanes ${lane}: expected lowercase kebab-case`);
  }
  if (!uniqueStrings(scope.forbiddenActions, 128) || scope.forbiddenActions.length < 1) findings.push(`${label}.forbiddenActions: expected 1-128 unique strings`);
}

function validateTicket(ticket, findings, label = 'ticket') {
  const keys = ['schemaVersion', 'id', 'title', 'priority', 'status', 'teamId', 'owner', 'entry', 'scope', 'authority', 'blocker', 'deliveryFacts', 'migrationBoundary', 'historyRefs'];
  if (!exactObject(ticket, label, keys, keys, findings)) return;
  if (ticket.schemaVersion !== 'ashenspire.continuity.ticket.v2') findings.push(`${label}: unsupported schemaVersion`);
  for (const name of ['id', 'title', 'teamId', 'migrationBoundary']) {
    if (!isNonEmpty(ticket[name])) findings.push(`${label}.${name}: expected a non-empty string`);
  }
  if (!['T0', 'T1', 'T2', 'T3', 'T4'].includes(ticket.priority)) findings.push(`${label}.priority: expected T0-T4`);
  validateStatus(ticket.status, `${label}.status`, findings);
  validateOwner(ticket.owner, `${label}.owner`, findings);
  const entryKeys = ['agentSession', 'branch', 'worktree', 'base', 'candidateHeadAtEntry', 'objective', 'firstAction', 'evidenceTarget', 'nextHandoff'];
  if (exactObject(ticket.entry, `${label}.entry`, entryKeys, entryKeys, findings)) {
    for (const name of ['agentSession', 'branch', 'worktree', 'objective', 'firstAction', 'evidenceTarget', 'nextHandoff']) {
      if (!isNonEmpty(ticket.entry[name])) findings.push(`${label}.entry.${name}: expected a non-empty string`);
    }
    if (!/^[a-f0-9]{40}$/.test(ticket.entry.base || '') || !/^[a-f0-9]{40}$/.test(ticket.entry.candidateHeadAtEntry || '')) findings.push(`${label}.entry: base and candidateHeadAtEntry must be commits`);
  }
  validateScope(ticket.scope, `${label}.scope`, findings);
  if (exactObject(ticket.authority, `${label}.authority`, ['allowedActions', 'withheldActions'], ['allowedActions', 'withheldActions'], findings)) {
    if (!uniqueStrings(ticket.authority.allowedActions, 128) || ticket.authority.allowedActions.length < 1) findings.push(`${label}.authority.allowedActions: expected unique non-empty actions`);
    if (!uniqueStrings(ticket.authority.withheldActions, 128) || ticket.authority.withheldActions.length < 1) findings.push(`${label}.authority.withheldActions: expected unique non-empty actions`);
  }
  validateBlocker(ticket.blocker, ticket.status, `${label}.blocker`, findings);
  if (!exactObject(ticket.deliveryFacts, `${label}.deliveryFacts`, DELIVERY_FACT_NAMES, DELIVERY_FACT_NAMES, findings)) return;
  for (const name of DELIVERY_FACT_NAMES) validateFact(ticket.deliveryFacts[name], `${label}.deliveryFacts.${name}`, findings);
  if (ticket.status?.value === 'RESOLVED' && ticket.deliveryFacts.resolved?.value !== true) findings.push(`${label}: RESOLVED requires deliveryFacts.resolved true`);
  if (ticket.deliveryFacts.released?.value === true && ticket.deliveryFacts.resolved?.value !== true) findings.push(`${label}: released requires resolved true`);
  if (!Array.isArray(ticket.historyRefs) || ticket.historyRefs.length < 1 || ticket.historyRefs.length > MAX_HISTORY_FILES) {
    findings.push(`${label}.historyRefs: expected 1-${MAX_HISTORY_FILES} entries`);
    return;
  }
  for (const [index, ref] of ticket.historyRefs.entries()) validateFileRef(ref, `${label}.historyRefs[${index}]`, findings, true);
  const ids = ticket.historyRefs.map((ref) => ref?.id);
  const paths = ticket.historyRefs.map((ref) => ref?.path);
  if (new Set(ids).size !== ids.length) findings.push(`${label}: history ref ids must be unique`);
  if (new Set(paths).size !== paths.length) findings.push(`${label}: history ref paths must be unique`);
}

function validateHistory(history, findings, label = 'history') {
  if (!isObject(history)) return findings.push(`${label}: expected an object`);
  const baseKeys = ['schemaVersion', 'id', 'sequence', 'recordedAtUtc', 'teamId', 'ticketId', 'event', 'supersedesHistoryId', 'evidence'];
  const v2 = history.schemaVersion === 'ashenspire.continuity.history.v2';
  const keys = v2 ? [...baseKeys, 'lifecycle'] : baseKeys;
  const required = history.schemaVersion === 'ashenspire.continuity.history.v1'
    ? ['schemaVersion', 'id', 'sequence', 'recordedAtUtc', 'teamId', 'ticketId', 'event', 'evidence']
    : keys;
  if (!exactObject(history, label, required, keys, findings)) return;
  if (!['ashenspire.continuity.history.v1', 'ashenspire.continuity.history.v2'].includes(history.schemaVersion)) findings.push(`${label}: unsupported schemaVersion`);
  for (const name of ['id', 'teamId', 'ticketId', 'event']) {
    if (!isNonEmpty(history[name])) findings.push(`${label}.${name}: expected a non-empty string`);
  }
  if (!Number.isInteger(history.sequence) || history.sequence < 1) findings.push(`${label}.sequence: expected integer >= 1`);
  if (!isUtcDate(history.recordedAtUtc)) findings.push(`${label}.recordedAtUtc: expected an ISO UTC timestamp`);
  if (history.supersedesHistoryId !== null && !isNonEmpty(history.supersedesHistoryId)) findings.push(`${label}.supersedesHistoryId: expected string or null`);
  validateFileRef(history.evidence, `${label}.evidence`, findings);
  if (v2) {
    if (exactObject(history.lifecycle, `${label}.lifecycle`, ['from', 'to', 'legacyFrom'], ['from', 'to', 'legacyFrom'], findings)) {
      if (history.lifecycle.from !== null && !LIFECYCLE.has(history.lifecycle.from)) findings.push(`${label}.lifecycle.from: unsupported canonical lifecycle value`);
      if (!LIFECYCLE.has(history.lifecycle.to)) findings.push(`${label}.lifecycle.to: unsupported canonical lifecycle value`);
      if (history.lifecycle.legacyFrom !== null && !isNonEmpty(history.lifecycle.legacyFrom)) findings.push(`${label}.lifecycle.legacyFrom: expected string or null`);
    }
  }
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

function claimsOverlap(a, b) {
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function validateAuthorityCollisions(activeTickets, findings) {
  for (let left = 0; left < activeTickets.length; left++) {
    for (let right = left + 1; right < activeTickets.length; right++) {
      const a = activeTickets[left];
      const b = activeTickets[right];
      if (!a.ticket?.scope || !b.ticket?.scope) continue;
      for (const aPath of a.ticket.scope.allowedRoots || []) {
        for (const bPath of b.ticket.scope.allowedRoots || []) {
          if (claimsOverlap(aPath, bPath)) findings.push(`authority collision: active tickets ${a.ticket.id} and ${b.ticket.id} overlap path ${aPath} <> ${bPath}`);
        }
      }
      for (const lane of a.ticket.scope.serializedLanes || []) {
        if ((b.ticket.scope.serializedLanes || []).includes(lane)) findings.push(`authority collision: active tickets ${a.ticket.id} and ${b.ticket.id} share serialized lane ${lane}`);
      }
    }
  }
}

function reconcileTicketHistory(root, team, ticket, frontierByPath, findings) {
  if (!Array.isArray(ticket?.historyRefs)) return { histories: [], integrityLinks: 0 };
  const histories = [];
  for (const [index, ref] of ticket.historyRefs.entries()) {
    verifyIntegrity(root, ref, `ticket ${ticket.id} historyRefs[${index}]`, findings);
    const history = parseJsonRecord(root, ref?.path || '', findings);
    validateHistory(history, findings, `ticket ${ticket.id} history[${index}]`);
    if (history) {
      if (history.id !== ref.id) findings.push(`history chain: ref id ${ref.id} does not match history.id ${history.id}`);
      if (history.sequence !== index + 1) findings.push(`history chain: ${history.id} sequence must equal ${index + 1}`);
      if (history.teamId !== team.id || history.ticketId !== ticket.id) findings.push(`history chain: ${history.id} subject does not match team/ticket`);
      const expectedPrevious = index === 0 ? null : histories[index - 1]?.id;
      if (history.supersedesHistoryId !== expectedPrevious) findings.push(`history chain: ${history.id} must supersede ${expectedPrevious ?? 'null'}`);
      histories.push(history);
    }
  }
  const claimed = new Set(ticket.historyRefs.map((ref) => ref?.path));
  for (const [path, history] of frontierByPath) {
    if (history?.teamId === team.id && history?.ticketId === ticket.id && !claimed.has(path)) {
      findings.push(`stale pointer: active ticket ${ticket.id} has unclaimed history frontier record ${path}`);
    }
  }
  return { histories, integrityLinks: ticket.historyRefs.length };
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
  validateTeam(team, findings);
  if (!team) return { ok: false, findings, root, pointer };

  const frontierByPath = new Map();
  for (const path of listBoundedHistoryPaths(root, findings)) {
    const history = parseJsonRecord(root, path, findings);
    validateHistory(history, findings, `frontier ${path}`);
    frontierByPath.set(path, history);
  }

  const activeTickets = [];
  let integrityLinks = 4;
  if (Array.isArray(team.activeTickets)) {
    for (const [index, ref] of team.activeTickets.entries()) {
      verifyIntegrity(root, ref, `team activeTickets[${index}]`, findings);
      const ticket = parseJsonRecord(root, ref?.path || '', findings);
      validateTicket(ticket, findings, `active ticket ${ref?.id || index}`);
      if (ticket) {
        if (ticket.id !== ref.id) findings.push(`active ticket ref ${ref.id} does not match ticket.id ${ticket.id}`);
        if (ticket.teamId !== team.id) findings.push(`active ticket ${ticket.id} does not belong to team ${team.id}`);
      }
      activeTickets.push({ ref, ticket });
      integrityLinks++;
    }
  }
  validateAuthorityCollisions(activeTickets, findings);

  const selected = activeTickets.find((entry) => entry.ref?.id === pointer.current.ticketId);
  if (!selected) findings.push('cross-link: selected ticket is not active on selected team');
  if (team.id !== pointer.current.teamId) findings.push('cross-link: pointer teamId does not match team.id');
  if (selected) {
    if (selected.ref.path !== pointer.current.ticket?.path || selected.ref.sha256 !== pointer.current.ticket?.sha256) {
      findings.push('cross-link: selected team ticket ref does not equal pointer ticket ref');
    }
    if (team.owner?.role !== selected.ticket?.owner?.role || team.owner?.taskId !== selected.ticket?.owner?.taskId) {
      findings.push('cross-link: selected team and ticket do not name one owner');
    }
  }

  for (const entry of activeTickets) {
    if (!entry.ticket) continue;
    const result = reconcileTicketHistory(root, team, entry.ticket, frontierByPath, findings);
    integrityLinks += result.integrityLinks;
    if (entry === selected) {
      const tip = result.histories.at(-1);
      const prior = result.histories.at(-2);
      if (entry.ticket.historyRefs.length !== pointer.revision) findings.push('stale pointer: pointer revision must equal selected complete history length');
      if (tip?.id !== pointer.current.history?.path?.split('/').at(-1)?.replace(/\.json$/, '') && entry.ticket.historyRefs.at(-1)?.path !== pointer.current.history?.path) {
        findings.push('cross-link: pointer current history is not selected ticket history tip');
      }
      const tipRef = entry.ticket.historyRefs.at(-1);
      if (tipRef?.path !== pointer.current.history?.path || tipRef?.sha256 !== pointer.current.history?.sha256) findings.push('cross-link: pointer history ref does not equal selected ticket history tip ref');
      if ((prior?.id ?? null) !== pointer.previousHistoryId) findings.push('history chain: pointer previousHistoryId does not equal selected predecessor');
      if (tip?.evidence?.path !== pointer.current.evidence?.path || tip?.evidence?.sha256 !== pointer.current.evidence?.sha256) findings.push('cross-link: history evidence does not equal pointer evidence');
      if (tip?.lifecycle?.to && tip.lifecycle.to !== entry.ticket.status?.value) findings.push('cross-link: history lifecycle destination does not equal ticket status');
    }
  }

  const featurePath = join(root, 'feature');
  let featureChannels = 0;
  if (existsSync(featurePath)) {
    const featureResult = reconcileFeatureDirectory(featurePath);
    featureChannels = featureResult.channels.length;
    for (const finding of featureResult.findings) findings.push(finding);
  }
  let escalationItems = 0;
  const escalationPath = join(root, 'escalation');
  if (existsSync(escalationPath)) {
    const escalationResult = reconcileEscalationRoot(escalationPath);
    escalationItems = escalationResult.items;
    for (const finding of escalationResult.findings) findings.push(`escalation: ${finding}`);
  }

  return {
    ok: findings.length === 0,
    findings,
    root,
    revision: pointer.revision,
    teamId: pointer.current.teamId,
    ticketId: pointer.current.ticketId,
    activeTickets: activeTickets.length,
    historyRecords: frontierByPath.size,
    featureChannels,
    escalationItems,
    integrityLinks,
  };
}

function plantCopy(name) {
  const temp = mkdtempSync(join(tmpdir(), `ashenspire-continuity-${name}-`));
  const root = join(temp, 'root');
  cpSync(FIXTURE_ROOT, root, { recursive: true });
  return { temp, root };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function rehashSelectedTicket(root) {
  const ticketPath = join(root, 'tickets/COLD-START/ticket.json');
  const teamPath = join(root, 'teams/coordination/team.json');
  const team = readJson(teamPath);
  const selected = team.activeTickets.find((ref) => ref.id === 'COLD-START');
  selected.sha256 = sha256(readFileSync(ticketPath));
  writeJson(teamPath, team);
  const pointerPath = join(root, 'POINTER.json');
  const pointer = readJson(pointerPath);
  pointer.current.ticket.sha256 = selected.sha256;
  pointer.current.team.sha256 = sha256(readFileSync(teamPath));
  writeJson(pointerPath, pointer);
}

function fixtureHistoryTwo(root, supersedesHistoryId = '000001-cold-start-entered') {
  const history = readJson(join(root, 'history/000001-cold-start-entered.json'));
  history.id = '000002-cold-start-current';
  history.sequence = 2;
  history.recordedAtUtc = '2026-08-28T00:01:00Z';
  history.event = 'CANDIDATE_FROZEN';
  history.supersedesHistoryId = supersedesHistoryId;
  history.lifecycle = { from: 'IN PROGRESS', to: 'CANDIDATE FROZEN', legacyFrom: null };
  const historyPath = join(root, 'history/000002-cold-start-current.json');
  writeJson(historyPath, history);
  return { history, historyPath, relativePath: 'history/000002-cold-start-current.json', hash: sha256(readFileSync(historyPath)) };
}

export function runContinuitySelfTest() {
  const cases = [];
  const clean = reconcileContinuityRoot(FIXTURE_ROOT);
  cases.push({ name: 'cold-start fixture is accepted without external context', passed: clean.ok, detail: clean.findings.join('; ') });

  const plants = [
    ['tampered ticket hash is refused', ({ root }) => appendFileSync(join(root, 'tickets/COLD-START/ticket.json'), '\n'), /SHA-256 mismatch/],
    ['traversing reference is refused', ({ root }) => {
      const pointerPath = join(root, 'POINTER.json');
      const pointer = readJson(pointerPath);
      pointer.current.team.path = '../outside.json';
      writeJson(pointerPath, pointer);
    }, /traversal segments are forbidden/],
    ['junctioned ticket directory is refused', ({ root }) => {
      const ticketDir = join(root, 'tickets');
      rmSync(ticketDir, { recursive: true, force: true });
      symlinkSync(join(FIXTURE_ROOT, 'tickets'), ticketDir, process.platform === 'win32' ? 'junction' : 'dir');
    }, /symbolic links are forbidden/],
    ['stale pointer with newer history is refused', ({ root }) => {
      fixtureHistoryTwo(root);
    }, /stale pointer:.*unclaimed history frontier/],
    ['broken predecessor chain is refused', ({ root }) => {
      const next = fixtureHistoryTwo(root, null);
      const ticketPath = join(root, 'tickets/COLD-START/ticket.json');
      const ticket = readJson(ticketPath);
      ticket.status = { value: 'CANDIDATE FROZEN', atUtc: '2026-08-28T00:01:00Z' };
      ticket.historyRefs.push({ id: next.history.id, path: next.relativePath, sha256: next.hash });
      writeJson(ticketPath, ticket);
      rehashSelectedTicket(root);
      const pointerPath = join(root, 'POINTER.json');
      const pointer = readJson(pointerPath);
      pointer.revision = 2;
      pointer.previousHistoryId = '000001-cold-start-entered';
      pointer.current.history = { path: next.relativePath, sha256: next.hash };
      writeJson(pointerPath, pointer);
    }, /history chain:.*must supersede/],
    ['duplicate active path or lane authority is refused', ({ root }) => {
      const duplicateHistory = readJson(join(root, 'history/000001-cold-start-entered.json'));
      duplicateHistory.id = '000001-duplicate-entered';
      duplicateHistory.ticketId = 'DUPLICATE';
      const duplicateHistoryPath = join(root, 'history/000001-duplicate-entered.json');
      writeJson(duplicateHistoryPath, duplicateHistory);
      const sourceTicket = readJson(join(root, 'tickets/COLD-START/ticket.json'));
      sourceTicket.id = 'DUPLICATE';
      sourceTicket.owner = { role: 'Other Owner', taskId: 'other-task' };
      sourceTicket.historyRefs = [{ id: duplicateHistory.id, path: 'history/000001-duplicate-entered.json', sha256: sha256(readFileSync(duplicateHistoryPath)) }];
      const duplicateDir = join(root, 'tickets/DUPLICATE');
      mkdirSync(duplicateDir, { recursive: true });
      const duplicateTicketPath = join(duplicateDir, 'ticket.json');
      writeJson(duplicateTicketPath, sourceTicket);
      const teamPath = join(root, 'teams/coordination/team.json');
      const team = readJson(teamPath);
      team.activeTickets.push({ id: 'DUPLICATE', path: 'tickets/DUPLICATE/ticket.json', sha256: sha256(readFileSync(duplicateTicketPath)) });
      writeJson(teamPath, team);
      const pointerPath = join(root, 'POINTER.json');
      const pointer = readJson(pointerPath);
      pointer.current.team.sha256 = sha256(readFileSync(teamPath));
      writeJson(pointerPath, pointer);
    }, /authority collision/],
    ['undeclared schema property is refused', ({ root }) => {
      const ticketPath = join(root, 'tickets/COLD-START/ticket.json');
      const ticket = readJson(ticketPath);
      ticket.undeclaredAuthority = 'release';
      writeJson(ticketPath, ticket);
      rehashSelectedTicket(root);
    }, /additional property undeclaredAuthority is forbidden/],
    ['release collapsed into lifecycle is refused', ({ root }) => {
      const ticketPath = join(root, 'tickets/COLD-START/ticket.json');
      const ticket = readJson(ticketPath);
      ticket.status.value = 'RELEASED';
      writeJson(ticketPath, ticket);
      rehashSelectedTicket(root);
    }, /unsupported canonical lifecycle value/],
    ['blocking lifecycle without blocker contract is refused', ({ root }) => {
      const ticketPath = join(root, 'tickets/COLD-START/ticket.json');
      const ticket = readJson(ticketPath);
      ticket.status.value = 'BLOCKED';
      ticket.blocker = null;
      writeJson(ticketPath, ticket);
      rehashSelectedTicket(root);
    }, /BLOCKED requires a structured blocker/],
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

  const feature = runFeatureChannelSelfTest();
  for (const entry of feature.cases) cases.push({ ...entry, name: `feature channel: ${entry.name}` });
  const escalation = runEscalationSelfTest();
  for (const entry of escalation.cases) cases.push({ ...entry, name: `escalation cell: ${entry.name}` });

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
    console.log(`RESULT: continuity current graph valid — revision ${result.revision}, team ${result.teamId}, ticket ${result.ticketId}, ${result.activeTickets} active ticket(s), ${result.historyRecords} history record(s), ${result.featureChannels} feature channel(s), ${result.escalationItems} escalation item(s), ${result.integrityLinks} integrity links, 0 findings.`);
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
