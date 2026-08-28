import { cpSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const SELF = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SELF), '..');
const PILOT_ROOT = resolve(REPO_ROOT, 'tests/fixtures/continuity-escalation-pilot');
const CLASSIFICATIONS = ['NEEDS_CONSTANTINE_NOW', 'ITM3_DECISION_OVERDUE', 'TEAM_REMEDIABLE_BLOCKER'];
const ITEM_KEYS = ['schemaVersion', 'id', 'helpDeskTicketId', 'dedupKey', 'classification', 'status', 'enteredAtUtc', 'lastReviewedAtUtc', 'ageSeconds', 'attempts', 'wake', 'continuingWork', 'guard', 'ownerPacket', 'closure'];
const HISTORY_KEYS = ['schemaVersion', 'sequence', 'atUtc', 'itemId', 'event', 'classification', 'status', 'attemptCount', 'guardCode', 'detail'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmpty = (value) => typeof value === 'string' && value.length > 0;
const isUtcDate = (value) => isNonEmpty(value) && Number.isFinite(Date.parse(value)) && value.endsWith('Z');
const uniqueStrings = (value, min = 0) => Array.isArray(value) && value.length >= min && value.every(isNonEmpty) && new Set(value).size === value.length;

function exact(value, label, keys, findings) {
  if (!isObject(value)) { findings.push(`${label}: expected object`); return false; }
  for (const key of keys) if (!Object.hasOwn(value, key)) findings.push(`${label}: missing required property ${key}`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) findings.push(`${label}: additional property ${key} is forbidden`);
  return true;
}

function readJson(path, label, findings) {
  try {
    if (lstatSync(path).isSymbolicLink()) throw new Error('symbolic links are forbidden');
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) { findings.push(`${label}: ${error.message}`); return null; }
}

function validateCell(cell, findings) {
  const keys = ['schemaVersion', 'name', 'ticketSystem', 'seats', 'fallbackHistory', 'classifications', 'queuePolicy'];
  if (!exact(cell, 'cell', keys, findings)) return;
  if (cell.schemaVersion !== 'ashenspire.escalation.cell.v1' || cell.name !== 'ITM3 Decision and Escalation Cell' || cell.ticketSystem !== 'HELP_DESK_DEDUPLICATED') findings.push('cell: identity contract invalid');
  if (!Array.isArray(cell.seats) || cell.seats.length !== 3) findings.push('cell: exactly three seats required');
  else for (const [index, seat] of cell.seats.entries()) {
    const seatKeys = ['role', 'assignment', 'agentSession', 'ticketRow', 'evidence', 'wake', 'writerAuthority', 'qaVerdictAuthority', 'responsibility'];
    if (exact(seat, `cell.seats[${index}]`, seatKeys, findings)) {
      if (!isNonEmpty(seat.role) || seat.assignment !== 'PERMANENT' || !isNonEmpty(seat.agentSession) || !isNonEmpty(seat.ticketRow) || !isNonEmpty(seat.evidence) || !isNonEmpty(seat.wake) || !isNonEmpty(seat.writerAuthority) || typeof seat.qaVerdictAuthority !== 'boolean' || !isNonEmpty(seat.responsibility)) findings.push(`cell.seats[${index}]: incomplete permanent assignment`);
    }
  }
  if (Array.isArray(cell.seats)) {
    if (JSON.stringify(cell.seats.map((seat) => seat.role)) !== JSON.stringify(['TRIAGE', 'RESOLUTION', 'DECISION_AND_ESCALATION'])) findings.push('cell: permanent roles must be TRIAGE, RESOLUTION, DECISION_AND_ESCALATION');
    const sessions = cell.seats.map((seat) => seat.agentSession);
    if (new Set(sessions).size !== 3) findings.push('cell: permanent seats require three distinct agent sessions');
  }
  if (!Array.isArray(cell.fallbackHistory)) findings.push('cell.fallbackHistory: expected array');
  else for (const [index, fallback] of cell.fallbackHistory.entries()) {
    const fallbackKeys = ['role', 'agentSession', 'ticketRow', 'status', 'writerAuthority', 'qaVerdictAuthority', 'evidence', 'wake'];
    if (exact(fallback, `cell.fallbackHistory[${index}]`, fallbackKeys, findings)) {
      if (![fallback.role, fallback.agentSession, fallback.ticketRow, fallback.evidence, fallback.wake].every(isNonEmpty) || fallback.status !== 'HISTORICAL_TEMPORARY_HANDOFF' || fallback.writerAuthority !== 'NONE' || fallback.qaVerdictAuthority !== false) findings.push(`cell.fallbackHistory[${index}]: fallback must be historical, non-writing, and non-verdict`);
    }
  }
  if (JSON.stringify(cell.classifications) !== JSON.stringify(CLASSIFICATIONS)) findings.push('cell: classification queue must use the exact three values');
  const booleanPolicyKeys = ['oneActiveItemPerDedupKey', 'ownerPacketRequired', 'attemptsAndAgeRequired', 'wakeAndContinuingWorkRequired', 'exactGuardOnly', 'noAcknowledgementLoop'];
  const policyKeys = [...booleanPolicyKeys, 'overdueFallbackSeconds', 'overdueClassification'];
  if (exact(cell.queuePolicy, 'cell.queuePolicy', policyKeys, findings)) {
    for (const key of booleanPolicyKeys) if (cell.queuePolicy[key] !== true) findings.push(`cell.queuePolicy.${key}: must be true`);
    if (cell.queuePolicy.overdueFallbackSeconds !== 900 || cell.queuePolicy.overdueClassification !== 'ITM3_DECISION_OVERDUE') findings.push('cell.queuePolicy: overdue fallback must classify ITM3_DECISION_OVERDUE at 900 seconds');
  }
}

function validateItem(item, findings, label) {
  if (!exact(item, label, ITEM_KEYS, findings)) return;
  if (item.schemaVersion !== 'ashenspire.escalation.item.v1' || !isNonEmpty(item.id) || !isNonEmpty(item.helpDeskTicketId) || !isNonEmpty(item.dedupKey)) findings.push(`${label}: identity fields invalid`);
  if (!CLASSIFICATIONS.includes(item.classification) || !['ACTIVE', 'ESCALATED', 'CLOSED'].includes(item.status)) findings.push(`${label}: classification or status invalid`);
  if (!isUtcDate(item.enteredAtUtc) || !isUtcDate(item.lastReviewedAtUtc) || !Number.isInteger(item.ageSeconds) || item.ageSeconds < 0) findings.push(`${label}: timestamps/age invalid`);
  else {
    const actualAge = Math.floor((Date.parse(item.lastReviewedAtUtc) - Date.parse(item.enteredAtUtc)) / 1000);
    if (actualAge !== item.ageSeconds) findings.push(`${label}: ageSeconds must equal entered-to-review age ${actualAge}`);
  }
  if (!Array.isArray(item.attempts) || item.attempts.length > 128) findings.push(`${label}: attempts must be bounded array`);
  else for (const [index, attempt] of item.attempts.entries()) {
    if (exact(attempt, `${label}.attempts[${index}]`, ['atUtc', 'actor', 'action', 'outcome'], findings) && (!isUtcDate(attempt.atUtc) || !isNonEmpty(attempt.actor) || !isNonEmpty(attempt.action) || !isNonEmpty(attempt.outcome))) findings.push(`${label}.attempts[${index}]: incomplete attempt`);
  }
  if (exact(item.wake, `${label}.wake`, ['trigger', 'nextAction'], findings) && (!isNonEmpty(item.wake.trigger) || !isNonEmpty(item.wake.nextAction))) findings.push(`${label}.wake: trigger and nextAction required`);
  if (!uniqueStrings(item.continuingWork, 1)) findings.push(`${label}.continuingWork: non-empty unique work required`);
  if (exact(item.guard, `${label}.guard`, ['code', 'blocks', 'doesNotBlock'], findings) && (!isNonEmpty(item.guard.code) || !uniqueStrings(item.guard.blocks, 1) || !uniqueStrings(item.guard.doesNotBlock, 1))) findings.push(`${label}.guard: exact blocked and continuing transitions required`);
  const packetKeys = ['hazard', 'attempts', 'options', 'recommendation', 'delayConsequence', 'exactAuthority'];
  if (exact(item.ownerPacket, `${label}.ownerPacket`, packetKeys, findings)) {
    for (const key of ['hazard', 'attempts', 'recommendation', 'delayConsequence', 'exactAuthority']) if (!isNonEmpty(item.ownerPacket[key])) findings.push(`${label}.ownerPacket.${key}: required`);
    if (!uniqueStrings(item.ownerPacket.options, 2) || item.ownerPacket.options.length > 3) findings.push(`${label}.ownerPacket.options: exactly 2-3 distinct options required`);
  }
  if (item.status === 'CLOSED') {
    if (!exact(item.closure, `${label}.closure`, ['atUtc', 'actor', 'outcome', 'evidence'], findings)) return;
    if (!isUtcDate(item.closure.atUtc) || !isNonEmpty(item.closure.actor) || !isNonEmpty(item.closure.outcome) || !isNonEmpty(item.closure.evidence)) findings.push(`${label}.closure: complete closure evidence required`);
  } else if (item.closure !== null) findings.push(`${label}.closure: must be null until CLOSED`);
}

function readHistory(path, findings, label) {
  try {
    if (lstatSync(path).isSymbolicLink()) throw new Error('symbolic links are forbidden');
    const records = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
    if (records.length < 1 || records.length > 1024) findings.push(`${label}: expected 1-1024 records`);
    return records;
  } catch (error) { findings.push(`${label}: ${error.message}`); return []; }
}

function validateHistory(records, item, findings, label) {
  for (const [index, record] of records.entries()) {
    if (!exact(record, `${label}[${index}]`, HISTORY_KEYS, findings)) continue;
    if (record.schemaVersion !== 'ashenspire.escalation.history.v1' || record.sequence !== index + 1 || !isUtcDate(record.atUtc) || record.itemId !== item.id || !['ENTERED', 'ATTEMPTED', 'REVIEWED', 'ESCALATED', 'CLOSED', 'PERMANENT_TAKEOVER'].includes(record.event) || !CLASSIFICATIONS.includes(record.classification) || !['ACTIVE', 'ESCALATED', 'CLOSED'].includes(record.status) || !Number.isInteger(record.attemptCount) || record.attemptCount < 0 || !isNonEmpty(record.guardCode) || !isNonEmpty(record.detail)) findings.push(`${label}[${index}]: invalid history transition`);
  }
  const tip = records.at(-1);
  if (tip && (tip.status !== item.status || tip.classification !== item.classification || tip.attemptCount !== item.attempts.length || tip.guardCode !== item.guard.code)) findings.push(`${label}: tip must match current item status, classification, attempts, and guard`);
  if (item.status === 'CLOSED' && tip?.event !== 'CLOSED') findings.push(`${label}: closed item requires terminal CLOSED event`);
}

export function reconcileEscalationRoot(rootPath) {
  const root = resolve(rootPath);
  const findings = [];
  const cell = readJson(join(root, 'cell.json'), 'cell.json', findings);
  if (cell) validateCell(cell, findings);
  let queueEntries = [];
  try {
    if (lstatSync(join(root, 'queue')).isSymbolicLink()) findings.push('queue: symbolic links are forbidden');
    queueEntries = readdirSync(join(root, 'queue'), { withFileTypes: true });
    if (queueEntries.length > 256) findings.push('queue: exceeds 256 item limit');
  } catch (error) { findings.push(`queue: ${error.message}`); }
  const items = [];
  for (const entry of queueEntries) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith('.json')) { findings.push(`queue/${entry.name}: expected regular JSON file`); continue; }
    const item = readJson(join(root, 'queue', entry.name), `queue/${entry.name}`, findings);
    if (!item) continue;
    validateItem(item, findings, `queue/${entry.name}`);
    const historyName = `${item.helpDeskTicketId}.jsonl`;
    const records = readHistory(join(root, 'history', historyName), findings, `history/${historyName}`);
    validateHistory(records, item, findings, `history/${historyName}`);
    items.push(item);
  }
  const activeKeys = items.filter((item) => item.status !== 'CLOSED').map((item) => item.dedupKey);
  if (new Set(activeKeys).size !== activeKeys.length) findings.push('queue: duplicate active Help Desk dedup linkage');
  const activeTickets = items.filter((item) => item.status !== 'CLOSED').map((item) => item.helpDeskTicketId);
  if (new Set(activeTickets).size !== activeTickets.length) findings.push('queue: more than one active item links the same Help Desk ticket');
  return { ok: findings.length === 0, findings, items: items.length, active: activeKeys.length };
}

export function transitionEscalationItem(source, sourceHistory, event) {
  if (!isObject(source) || !Array.isArray(sourceHistory) || !isObject(event) || !['ATTEMPT', 'ESCALATE', 'CLOSE', 'REVIEW'].includes(event.type) || !isUtcDate(event.atUtc) || !isNonEmpty(event.actor)) throw new Error('transition event requires item, history, type, atUtc, and actor');
  const item = structuredClone(source);
  const history = structuredClone(sourceHistory);
  if (item.status === 'CLOSED') throw new Error('closed escalation item is immutable');
  if (Date.parse(event.atUtc) < Date.parse(item.lastReviewedAtUtc)) throw new Error('transition time cannot move backward');
  item.lastReviewedAtUtc = event.atUtc;
  item.ageSeconds = Math.floor((Date.parse(event.atUtc) - Date.parse(item.enteredAtUtc)) / 1000);
  if (event.type === 'ATTEMPT') {
    if (!isNonEmpty(event.action) || !isNonEmpty(event.outcome)) throw new Error('ATTEMPT requires action and outcome');
    item.attempts.push({ atUtc: event.atUtc, actor: event.actor, action: event.action, outcome: event.outcome });
  } else if (event.type === 'ESCALATE') {
    item.status = 'ESCALATED';
    item.classification = event.classification || (item.ageSeconds >= 900 ? 'ITM3_DECISION_OVERDUE' : 'NEEDS_CONSTANTINE_NOW');
    if (!['NEEDS_CONSTANTINE_NOW', 'ITM3_DECISION_OVERDUE'].includes(item.classification)) throw new Error('ESCALATE requires owner escalation classification');
  } else if (event.type === 'CLOSE') {
    if (!isNonEmpty(event.outcome) || !isNonEmpty(event.evidence)) throw new Error('CLOSE requires outcome and evidence');
    item.status = 'CLOSED';
    item.closure = { atUtc: event.atUtc, actor: event.actor, outcome: event.outcome, evidence: event.evidence };
  }
  const record = {
    schemaVersion: 'ashenspire.escalation.history.v1',
    sequence: history.length + 1,
    atUtc: event.atUtc,
    itemId: item.id,
    event: { ATTEMPT: 'ATTEMPTED', ESCALATE: 'ESCALATED', CLOSE: 'CLOSED', REVIEW: 'REVIEWED' }[event.type],
    classification: item.classification,
    status: item.status,
    attemptCount: item.attempts.length,
    guardCode: item.guard.code,
    detail: event.detail || event.outcome || event.action || `Reviewed by ${event.actor}.`,
  };
  history.push(record);
  return { item, history, record };
}

function copyPilot(name) {
  const temp = mkdtempSync(join(tmpdir(), `ashenspire-escalation-${name}-`));
  cpSync(PILOT_ROOT, temp, { recursive: true });
  return temp;
}

function mutateItem(root, mutate) {
  const path = join(root, 'queue/PILOT-001.json');
  const item = JSON.parse(readFileSync(path, 'utf8'));
  mutate(item);
  writeFileSync(path, `${JSON.stringify(item, null, 2)}\n`);
}

export function runEscalationSelfTest() {
  const cases = [];
  const clean = copyPilot('clean');
  try { const result = reconcileEscalationRoot(clean); cases.push({ name: 'three-seat blocker cell closes a remediable pilot end to end', passed: result.ok, detail: result.findings.join('; ') }); } finally { rmSync(clean, { recursive: true, force: true }); }
  const plants = [
    ['unknown queue classification is refused', (root) => mutateItem(root, (item) => { item.classification = 'UNKNOWN'; }), /classification or status invalid/],
    ['owner packet without 2-3 options is refused', (root) => mutateItem(root, (item) => { item.ownerPacket.options = ['only']; }), /exactly 2-3/],
    ['incorrect blocker age is refused', (root) => mutateItem(root, (item) => { item.ageSeconds = 1; }), /ageSeconds must equal/],
    ['missing wake trigger is refused', (root) => mutateItem(root, (item) => { item.wake.trigger = ''; }), /trigger and nextAction required/],
    ['duplicate permanent agent sessions are refused', (root) => {
      const path = join(root, 'cell.json'); const cell = JSON.parse(readFileSync(path, 'utf8'));
      cell.seats[1].agentSession = cell.seats[0].agentSession; writeFileSync(path, `${JSON.stringify(cell, null, 2)}\n`);
    }, /three distinct agent sessions/],
    ['same Help Desk ticket with a different active dedup key is refused', (root) => {
      const originalPath = join(root, 'queue/PILOT-001.json');
      const source = JSON.parse(readFileSync(originalPath, 'utf8'));
      source.status = 'ACTIVE'; source.closure = null; source.attempts = []; source.lastReviewedAtUtc = source.enteredAtUtc; source.ageSeconds = 0;
      writeFileSync(originalPath, `${JSON.stringify(source, null, 2)}\n`);
      const entered = JSON.parse(readFileSync(join(root, 'history/PILOT-001.jsonl'), 'utf8').split(/\r?\n/)[0]);
      writeFileSync(join(root, 'history/PILOT-001.jsonl'), `${JSON.stringify(entered)}\n`);
      source.id = 'PILOT-001/SECOND'; source.dedupKey = 'PILOT-001:SECOND';
      writeFileSync(join(root, 'queue/PILOT-002.json'), `${JSON.stringify(source, null, 2)}\n`);
    }, /more than one active item links the same Help Desk ticket/],
  ];
  for (const [name, mutate, expected] of plants) {
    const root = copyPilot(name.replace(/\W+/g, '-'));
    try { mutate(root); const result = reconcileEscalationRoot(root); const detail = result.findings.join('; '); cases.push({ name, passed: !result.ok && expected.test(detail), detail }); } finally { rmSync(root, { recursive: true, force: true }); }
  }
  const transitions = copyPilot('transitions');
  try {
    const closed = JSON.parse(readFileSync(join(transitions, 'queue/PILOT-001.json'), 'utf8'));
    const entered = readHistory(join(transitions, 'history/PILOT-001.jsonl'), [], 'pilot');
    closed.status = 'ACTIVE'; closed.closure = null; closed.lastReviewedAtUtc = closed.enteredAtUtc; closed.ageSeconds = 0; closed.attempts = [];
    const attempt = transitionEscalationItem(closed, entered.slice(0, 1), { type: 'ATTEMPT', atUtc: '2026-08-28T00:01:00Z', actor: 'pilot-resolution', action: 'repair', outcome: 'retry ready' });
    const closure = transitionEscalationItem(attempt.item, attempt.history, { type: 'CLOSE', atUtc: '2026-08-28T00:02:00Z', actor: 'pilot-resolution', outcome: 'resolved', evidence: 'pilot://closure' });
    const findings = []; validateItem(closure.item, findings, 'transition.item'); validateHistory(closure.history, closure.item, findings, 'transition.history');
    cases.push({ name: 'transition executor atomically emits coherent item and immutable history through closure', passed: findings.length === 0 && closure.record.event === 'CLOSED', detail: findings.join('; ') });
    const overdue = transitionEscalationItem(closed, entered.slice(0, 1), { type: 'ESCALATE', atUtc: '2026-08-28T00:15:00Z', actor: 'pilot-decision', detail: '900-second owner fallback.' });
    const overdueFindings = []; validateItem(overdue.item, overdueFindings, 'overdue.item'); validateHistory(overdue.history, overdue.item, overdueFindings, 'overdue.history');
    cases.push({ name: '900-second executor fallback classifies ITM3 decision overdue with matching history', passed: overdueFindings.length === 0 && overdue.item.classification === 'ITM3_DECISION_OVERDUE' && overdue.record.event === 'ESCALATED', detail: overdueFindings.join('; ') });
  } finally { rmSync(transitions, { recursive: true, force: true }); }
  const failed = cases.filter((entry) => !entry.passed);
  return { ok: failed.length === 0, cases, passed: cases.length - failed.length, failed: failed.length };
}
