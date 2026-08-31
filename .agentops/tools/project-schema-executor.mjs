#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateSchema } from './opsctl.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROJECT = Object.freeze({ owner: 'cehinds', owner_type: 'user', number: 4, id: 'PVT_kwHOCSCyJ84BgfH9', title: 'Family Delivery', closed: false });
export const PRIORITY_FIELD_ID = 'PVTSSF_lAHOCSCyJ84BgfH9zhfelc4';
export const PRIORITY_OPTIONS = Object.freeze([
  { id: '5901e7b3', name: 'P0', color: 'GRAY', description: '' },
  { id: 'c3bc1e0d', name: 'P1', color: 'GRAY', description: '' },
  { id: 'f2b023f2', name: 'P2', color: 'GRAY', description: '' },
  { id: 'f85da77c', name: 'P3', color: 'GRAY', description: '' }
]);
export const DEV_REF = 'refs/heads/dev';
const AUTHORITY_PATH = '.github/workflows/owner-command.yml:owner-command/v1';
const ACTION = 'authorize-project-schema-change';
const ATTEMPT_ROOT = '.agentops/scheduler/project-schema-attempts';
const OID = /^[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;
const CAPSULE_PATH = (ticket) => `.agentops/work/${ticket}/CURRENT.json`;
const TRUSTED_EVENT_SCHEMA_PROJECT_BINDING_HASH = '9b917be964be302359c62ffa21f8e83ebcdcfa6dfc3af01a7c6f704088435072';
const TRUSTED_POLICY_ACTION_HASH = '9a846f000a95ae8239d770287880b6f8cfc5569bd957734106e0b5bca4dc33ec';
const TRUSTED_CAPSULE_SCHEMA_HASH = '21472865935e3894132a745c6b3227f192b04f08349e86f7b4de6560f2bb8337';
const AUDIT_REF = 'refs/heads/agentops/project-schema-audit';
const AUDIT_ROOT = '.agentops/scheduler/project-schema-attempts';
const AUDIT_JOURNAL = `${AUDIT_ROOT}/journal.jsonl`;
const AUDIT_RESULT_LOCAL = '.git/agentops-project-schema/audit-result.json';
const EXECUTABLE_HASH_CACHE = new Map();

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export function sha256(value) {
  const bytes = typeof value === 'string' || Buffer.isBuffer(value) || ArrayBuffer.isView(value) ? value : stableStringify(value);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

const statusOptions = [
  ['READY', 'GREEN', 'Eligible for scheduler admission.'],
  ['BLOCKED', 'RED', 'Blocked by a recorded condition.'],
  ['PAUSED', 'GRAY', 'Intentionally paused and not schedulable.'],
  ['IN_PROGRESS', 'YELLOW', 'Implementation is active.'],
  ['QA_REVIEW', 'PURPLE', 'Awaiting or undergoing independent QA.'],
  ['PR_OPEN', 'BLUE', 'A pull request is open.'],
  ['DONE', 'GREEN', 'Completed and terminal.'],
  ['CANCELLED', 'GRAY', 'Cancelled and terminal.'],
  ['SUPERSEDED', 'PINK', 'Superseded by another work item or candidate.']
];
const roleOptions = [
  ['owner', 'PURPLE', 'Owner authority.'],
  ['it-manager-iii', 'RED', 'Technical integration and delivery authority.'],
  ['project-management-lead', 'BLUE', 'Portfolio, dependency, and sequencing stewardship.'],
  ['data-architecture-lead', 'PURPLE', 'Schema, lineage, and compatibility authority.'],
  ['help-desk', 'GRAY', 'Intake, routing, and status hygiene.'],
  ['maker', 'GREEN', 'Bounded implementation owner.'],
  ['qa-independent', 'YELLOW', 'Independent exact-head verification.'],
  ['it-support', 'ORANGE', 'Tooling and environment support.'],
  ['app-dev-i', 'GREEN', 'Application developer I.'],
  ['app-dev-ii', 'GREEN', 'Application developer II.'],
  ['app-dev-iii', 'GREEN', 'Application developer III.'],
  ['artist-i', 'PINK', 'Designer or artist I.'],
  ['artist-ii', 'PINK', 'Designer or artist II.'],
  ['artist-iii', 'PINK', 'Designer or artist III.'],
  ['qa-technician-i', 'YELLOW', 'QA technician I.'],
  ['qa-technician-ii', 'YELLOW', 'QA technician II.'],
  ['qa-technician-iii', 'YELLOW', 'QA technician III.'],
  ['team-lead', 'BLUE', 'Team staffing and capacity lead.']
];
const select = (ordinal, name, tuples) => Object.freeze({ ordinal, name, dataType: 'SINGLE_SELECT', singleSelectOptions: tuples.map(([optionName, color, description]) => ({ name: optionName, color, description })) });
const text = (ordinal, name) => Object.freeze({ ordinal, name, dataType: 'TEXT' });

export const FIELD_DEFINITIONS = Object.freeze([
  select(1, 'Scheduler Status', statusOptions),
  select(2, 'Owner Role', roleOptions),
  text(3, 'Affected Paths'),
  text(4, 'Affected Resources'),
  text(5, 'Dependencies'),
  text(6, 'External Claims'),
  text(7, 'Human Gate'),
  select(8, 'Scope Complete', [
    ['TRUE', 'GREEN', 'Affected scope is complete.'],
    ['FALSE', 'RED', 'Affected scope is incomplete.']
  ])
]);

export const DEFINITIONS_MANIFEST = FIELD_DEFINITIONS;
export const DEFINITIONS_HASH = sha256(DEFINITIONS_MANIFEST);

const FIELD_QUERY = `query ProjectFields($login:String!,$number:Int!,$cursor:String){viewer{login} user(login:$login){projectV2(number:$number){id number title closed updatedAt fields(first:100,after:$cursor){totalCount pageInfo{hasNextPage endCursor} nodes{__typename ... on ProjectV2Field{id name dataType createdAt updatedAt isIssueField} ... on ProjectV2SingleSelectField{id name dataType createdAt updatedAt isIssueField options{id name color description}} ... on ProjectV2MultiSelectField{id name dataType createdAt updatedAt isIssueField multiSelectOptions{id name color description}} ... on ProjectV2IterationField{id name dataType createdAt updatedAt isIssueField}}}}}}`;
const ITEM_QUERY = `query ProjectItems($login:String!,$number:Int!,$cursor:String){user(login:$login){projectV2(number:$number){id number title closed updatedAt items(first:100,after:$cursor){totalCount pageInfo{hasNextPage endCursor} nodes{id createdAt updatedAt isArchived type content{__typename ... on Issue{id number title state stateReason repository{nameWithOwner}} ... on PullRequest{id number title state repository{nameWithOwner}} ... on DraftIssue{id title}}}}}}}`;
const VALUE_FIELDS = `totalCount pageInfo{hasNextPage endCursor} nodes{__typename ... on ProjectV2ItemFieldTextValue{id updatedAt text field{... on ProjectV2Field{id name dataType}}} ... on ProjectV2ItemFieldSingleSelectValue{id updatedAt name optionId color description field{... on ProjectV2SingleSelectField{id name dataType}}} ... on ProjectV2ItemFieldNumberValue{id updatedAt number field{... on ProjectV2Field{id name dataType}}} ... on ProjectV2ItemFieldDateValue{id updatedAt date field{... on ProjectV2Field{id name dataType}}} ... on ProjectV2ItemFieldIterationValue{id updatedAt iterationId title startDate duration field{... on ProjectV2IterationField{id name dataType}}} ... on ProjectV2ItemFieldMultiSelectValue{id updatedAt value options{id name color description} field{... on ProjectV2MultiSelectField{id name dataType}}} ... on ProjectV2ItemFieldLabelValue{field{... on ProjectV2Field{id name dataType}} labels(first:100){totalCount pageInfo{hasNextPage endCursor} nodes{id name color description}}} ... on ProjectV2ItemFieldMilestoneValue{field{... on ProjectV2Field{id name dataType}} milestone{id number title state dueOn updatedAt}} ... on ProjectV2ItemFieldPullRequestValue{field{... on ProjectV2Field{id name dataType}} pullRequests(first:100){totalCount pageInfo{hasNextPage endCursor} nodes{id number title state repository{nameWithOwner}}}} ... on ProjectV2ItemFieldRepositoryValue{field{... on ProjectV2Field{id name dataType}} repository{id nameWithOwner}} ... on ProjectV2ItemFieldReviewerValue{field{... on ProjectV2Field{id name dataType}} reviewers(first:100){totalCount pageInfo{hasNextPage endCursor} nodes{__typename ... on Node{id}}}} ... on ProjectV2ItemFieldUserValue{field{... on ProjectV2Field{id name dataType}} users(first:100){totalCount pageInfo{hasNextPage endCursor} nodes{id login}}} ... on ProjectV2ItemIssueFieldValue{field{... on ProjectV2Field{id name dataType}} issueFieldValue{__typename ... on IssueFieldTextValue{id value} ... on IssueFieldSingleSelectValue{id value name optionId color description} ... on IssueFieldNumberValue{id value} ... on IssueFieldDateValue{id value} ... on IssueFieldMultiSelectValue{id value options{id name color description}}}}}`;
const VALUE_QUERY = `query ProjectItemValues($itemId:ID!,$cursor:String){node(id:$itemId){... on ProjectV2Item{id fieldValues(first:100,after:$cursor){${VALUE_FIELDS}}}}}`;
const VALUE_BATCH_QUERY = `query ProjectItemValuesBatch($ids:[ID!]!){nodes(ids:$ids){... on ProjectV2Item{id fieldValues(first:100){${VALUE_FIELDS}}}}}`;
const PROJECT_CLOSE_QUERY = `query ProjectInventoryClose($login:String!,$number:Int!){viewer{login} user(login:$login){projectV2(number:$number){id number title closed updatedAt fields{totalCount} items{totalCount}}}}`;
export const CREATE_FIELD_MUTATION = `mutation CreateProjectV2Field($input:CreateProjectV2FieldInput!){createProjectV2Field(input:$input){clientMutationId projectV2Field{__typename ... on ProjectV2Field{id name dataType createdAt updatedAt} ... on ProjectV2SingleSelectField{id name dataType createdAt updatedAt options{id name color description}}}}}`;

export class ExecutorError extends Error {
  constructor(code, message, details = null) { super(message); this.name = 'ExecutorError'; this.code = code; this.details = details; }
}

export function defaultRunner(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 30_000,
    windowsHide: true,
    env: { ...process.env, ...(options.env ?? {}) }
  });
  return { status: result.status, signal: result.signal, error: result.error, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function checked(runner, command, args, options = {}, code = 'COMMAND_FAILED') {
  const result = runner(command, args, options);
  if (result.error || result.signal || result.status !== 0) throw new ExecutorError(code, `${command} ${args.join(' ')} failed`, { status: result.status, signal: result.signal, stderr: result.stderr });
  return result.stdout.trim();
}

function git(root, args, runner = defaultRunner, options = {}) { return checked(runner, 'git', args, { cwd: root, ...options }, options.code ?? 'GIT_FAILED'); }

export function resolveGhExecutable(root, runner = defaultRunner) {
  const configured = process.env.AGENTOPS_GH_EXE;
  const candidates = [configured, 'gh', ...(process.platform === 'win32' ? ['C:\\Program Files\\GitHub CLI\\gh.exe', path.join(process.env.LOCALAPPDATA ?? '', 'GitHub CLI', 'gh.exe')] : [])].filter(Boolean);
  for (const candidate of candidates) {
    const probe = runner(candidate, ['--version'], { cwd: root, timeoutMs: 10_000 });
    if (!probe.error && !probe.signal && probe.status === 0 && /^gh version /m.test(probe.stdout ?? '')) return candidate;
  }
  throw new ExecutorError('GH_EXECUTABLE_MISSING', 'GitHub CLI executable was not found in configured or standard locations');
}

function graphql(root, query, variables, runner = defaultRunner, { ambiguous = false } = {}) {
  const body = { query, variables };
  const request = `${stableStringify(body)}\n`;
  const gh = resolveGhExecutable(root, runner);
  const result = runner(gh, ['api', 'graphql', '--input', '-'], { cwd: root, input: request, timeoutMs: 30_000 });
  if (result.error || result.signal || result.status !== 0) {
    throw new ExecutorError(ambiguous ? 'MUTATION_AMBIGUOUS' : 'GRAPHQL_TRANSPORT_FAILED', 'GitHub GraphQL transport failed', { status: result.status, signal: result.signal, stderr: result.stderr, request_sha256: sha256(request) });
  }
  let parsed;
  try { parsed = JSON.parse(result.stdout); } catch {
    throw new ExecutorError(ambiguous ? 'MUTATION_AMBIGUOUS' : 'GRAPHQL_RESPONSE_INVALID', 'GitHub GraphQL response is not JSON', { response_sha256: sha256(result.stdout), request_sha256: sha256(request) });
  }
  if (Array.isArray(parsed.errors) && parsed.errors.length) {
    throw new ExecutorError(ambiguous ? 'MUTATION_REJECTED' : 'GRAPHQL_ERRORS', 'GitHub GraphQL returned errors', { errors: parsed.errors, response_sha256: sha256(result.stdout), request_sha256: sha256(request) });
  }
  return { data: parsed.data, raw: result.stdout, request, request_sha256: sha256(request), response_sha256: sha256(result.stdout) };
}

function projectIdentity(project) {
  return { id: project?.id, number: project?.number, title: project?.title, closed: project?.closed, updated_at: project?.updatedAt };
}

function sameProjectIdentity(left, right) { return stableStringify(left) === stableStringify(right); }

function connectionPages(root, { query, variables, extract, label, identityOf, nodeKey }, runner) {
  const nodes = []; const pages = []; const seenCursors = new Set(); const seenNodes = new Set();
  let cursor = null; let total = null; let identity = null;
  for (let index = 0; index < 1000; index += 1) {
    const cursorKey = cursor ?? '<root>';
    if (seenCursors.has(cursorKey)) throw new ExecutorError('PAGINATION_CURSOR_REPEAT', `${label} repeated cursor ${cursorKey}`);
    seenCursors.add(cursorKey);
    const response = graphql(root, query, { ...variables, cursor }, runner);
    const extracted = extract(response.data);
    const connection = extracted?.connection;
    const pageIdentity = identityOf(extracted);
    if (!connection || !Array.isArray(connection.nodes) || !Number.isInteger(connection.totalCount) || typeof connection.pageInfo?.hasNextPage !== 'boolean') throw new ExecutorError('PAGINATION_INCOMPLETE', `${label} connection is incomplete`);
    if (identity !== null && !sameProjectIdentity(identity, pageIdentity)) throw new ExecutorError('PREFLIGHT_DRIFT', `${label} identity changed during pagination`);
    identity = pageIdentity;
    if (total !== null && total !== connection.totalCount) throw new ExecutorError('PREFLIGHT_DRIFT', `${label} total changed during pagination`);
    total = connection.totalCount;
    const hashes = [];
    for (const node of connection.nodes) {
      const key = nodeKey(node);
      if (!key || seenNodes.has(key)) throw new ExecutorError('DUPLICATE_NODE_ID', `${label} contains a missing or duplicate node identity`);
      seenNodes.add(key); nodes.push(node); hashes.push(sha256(stableStringify(node)));
    }
    const proof = { page_index: index, request_cursor: cursor, end_cursor: connection.pageInfo.endCursor ?? null, has_next_page: connection.pageInfo.hasNextPage, total_count: connection.totalCount, node_count: connection.nodes.length, node_hashes: hashes, identity: pageIdentity, source_response_sha256: response.response_sha256 };
    pages.push({ ...proof, page_sha256: sha256(proof) });
    if (!connection.pageInfo.hasNextPage) {
      if (nodes.length !== total) throw new ExecutorError('PAGINATION_INCOMPLETE', `${label} is truncated (${nodes.length}/${total})`);
      return { nodes, totalCount: total, pages, identity };
    }
    const next = connection.pageInfo.endCursor;
    if (!next || next === cursor) throw new ExecutorError('PAGINATION_CURSOR_REPEAT', `${label} cursor did not advance`);
    cursor = next;
  }
  throw new ExecutorError('PAGINATION_INCOMPLETE', `${label} exceeded 1000 pages`);
}

function normalizeField(field) {
  if (!field?.id || !field.name || !field.dataType || !field.__typename) throw new ExecutorError('PAGINATION_INCOMPLETE', 'Project field configuration is incomplete or unsupported');
  const rawOptions = field.options ?? field.multiSelectOptions ?? [];
  if (!Array.isArray(rawOptions)) throw new ExecutorError('PAGINATION_INCOMPLETE', `Project field ${field.name} options are incomplete`);
  const ids = new Set();
  const options = rawOptions.map((option) => {
    if (!option?.id || !option.name || !option.color || typeof option.description !== 'string' || ids.has(option.id)) throw new ExecutorError('DUPLICATE_NODE_ID', `Project field ${field.name} contains an incomplete or duplicate option identity`);
    ids.add(option.id);
    return { id: option.id, name: option.name, color: option.color, description: option.description };
  });
  return { id: field.id, name: field.name, kind: field.__typename, data_type: field.dataType, created_at: field.createdAt, updated_at: field.updatedAt, is_issue_field: field.isIssueField, options };
}

const SUPPORTED_VALUE_TYPES = new Set([
  'ProjectV2ItemFieldDateValue', 'ProjectV2ItemFieldIterationValue', 'ProjectV2ItemFieldLabelValue',
  'ProjectV2ItemFieldMilestoneValue', 'ProjectV2ItemFieldMultiSelectValue', 'ProjectV2ItemFieldNumberValue',
  'ProjectV2ItemFieldPullRequestValue', 'ProjectV2ItemFieldRepositoryValue', 'ProjectV2ItemFieldReviewerValue',
  'ProjectV2ItemFieldSingleSelectValue', 'ProjectV2ItemFieldTextValue', 'ProjectV2ItemFieldUserValue',
  'ProjectV2ItemIssueFieldValue'
]);

function completeNestedConnection(value, label) {
  if (!value) return;
  if (!Number.isInteger(value.totalCount) || !Array.isArray(value.nodes) || value.pageInfo?.hasNextPage !== false || value.totalCount !== value.nodes.length) throw new ExecutorError('PAGINATION_INCOMPLETE', `${label} nested connection exceeds the exact one-page read or is incomplete`);
}

function normalizeValue(value) {
  if (!SUPPORTED_VALUE_TYPES.has(value?.__typename)) throw new ExecutorError('UNSUPPORTED_FIELD_VALUE', `unsupported Project item field value type ${value?.__typename ?? 'missing'}`);
  if (!value.field?.id || !value.field?.name || !value.field?.dataType) throw new ExecutorError('PAGINATION_INCOMPLETE', `${value.__typename} is missing field identity`);
  const nodeBacked = !['ProjectV2ItemFieldLabelValue', 'ProjectV2ItemFieldMilestoneValue', 'ProjectV2ItemFieldPullRequestValue', 'ProjectV2ItemFieldRepositoryValue', 'ProjectV2ItemFieldReviewerValue', 'ProjectV2ItemFieldUserValue', 'ProjectV2ItemIssueFieldValue'].includes(value.__typename);
  if (nodeBacked && (!value.id || !value.updatedAt)) throw new ExecutorError('PAGINATION_INCOMPLETE', `${value.__typename} is missing node identity or update data`);
  completeNestedConnection(value.labels, `${value.__typename}.labels`);
  completeNestedConnection(value.pullRequests, `${value.__typename}.pullRequests`);
  completeNestedConnection(value.reviewers, `${value.__typename}.reviewers`);
  completeNestedConnection(value.users, `${value.__typename}.users`);
  if (value.__typename === 'ProjectV2ItemIssueFieldValue' && !['IssueFieldDateValue', 'IssueFieldMultiSelectValue', 'IssueFieldNumberValue', 'IssueFieldSingleSelectValue', 'IssueFieldTextValue'].includes(value.issueFieldValue?.__typename)) throw new ExecutorError('UNSUPPORTED_FIELD_VALUE', `unsupported Project issue field value type ${value.issueFieldValue?.__typename ?? 'missing'}`);
  return value;
}

function authEvidence(root, runner) {
  const gh = resolveGhExecutable(root, runner);
  const result = runner(gh, ['auth', 'status', '--hostname', 'github.com', '--active'], { cwd: root, timeoutMs: 30_000 });
  if (result.error || result.signal || result.status !== 0) throw new ExecutorError('AUTH_SCOPE_MISSING', 'GitHub authentication status failed');
  const status = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const login = /Logged in to github\.com account\s+([^\s(]+)/i.exec(status)?.[1] ?? null;
  const scopes = [...status.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
  if (login !== 'cehinds') throw new ExecutorError('AUTH_LOGIN_MISMATCH', `authenticated login is ${login ?? 'unknown'}, expected cehinds`);
  if (!scopes.includes('project')) throw new ExecutorError('AUTH_SCOPE_MISSING', 'authenticated token lacks exact project write scope');
  if (!EXECUTABLE_HASH_CACHE.has(gh)) EXECUTABLE_HASH_CACHE.set(gh, fs.existsSync(gh) ? sha256(fs.readFileSync(gh)) : sha256(gh));
  return { login, scopes, executable: gh, executable_sha256: EXECUTABLE_HASH_CACHE.get(gh) };
}

export function fetchProjectInventory(root = ROOT, runner = defaultRunner, { verifyAuth = true } = {}) {
  const auth = verifyAuth ? authEvidence(root, runner) : null;
  const fields = connectionPages(root, {
    query: FIELD_QUERY, variables: { login: PROJECT.owner, number: PROJECT.number }, label: 'Project fields',
    extract: (data) => ({ connection: data?.user?.projectV2?.fields, project: data?.user?.projectV2, viewer: data?.viewer }),
    identityOf: (value) => ({ ...projectIdentity(value?.project), viewer_login: value?.viewer?.login }),
    nodeKey: (node) => node?.id
  }, runner);
  if (fields.identity.viewer_login !== 'cehinds') throw new ExecutorError('AUTH_LOGIN_MISMATCH', 'GraphQL viewer does not match cehinds');
  const items = connectionPages(root, {
    query: ITEM_QUERY, variables: { login: PROJECT.owner, number: PROJECT.number }, label: 'Project items',
    extract: (data) => ({ connection: data?.user?.projectV2?.items, project: data?.user?.projectV2 }),
    identityOf: (value) => projectIdentity(value?.project), nodeKey: (node) => node?.id
  }, runner);
  const fieldsProject = { id: fields.identity.id, number: fields.identity.number, title: fields.identity.title, closed: fields.identity.closed, updated_at: fields.identity.updated_at };
  if (!sameProjectIdentity(fieldsProject, items.identity)) throw new ExecutorError('PREFLIGHT_DRIFT', 'Project identity changed between field and item pagination');
  const valueManifest = []; let fieldValueCount = 0; const normalizedItems = [];
  for (let offset = 0; offset < items.nodes.length; offset += 25) {
    const batch = items.nodes.slice(offset, offset + 25); const batchResponse = graphql(root, VALUE_BATCH_QUERY, { ids: batch.map((item) => item.id) }, runner);
    const batchNodes = batchResponse.data?.nodes;
    if (!Array.isArray(batchNodes) || batchNodes.length !== batch.length) throw new ExecutorError('PAGINATION_INCOMPLETE', 'Project item value batch is incomplete');
    for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
      const item = batch[batchIndex]; const first = batchNodes[batchIndex];
      if (first?.id !== item.id) throw new ExecutorError('PREFLIGHT_DRIFT', `Project item ${item.id} identity changed in value batch`);
      const connection = first.fieldValues;
      if (!connection || !Array.isArray(connection.nodes) || !Number.isInteger(connection.totalCount) || typeof connection.pageInfo?.hasNextPage !== 'boolean') throw new ExecutorError('PAGINATION_INCOMPLETE', `Project item ${item.id} values are incomplete`);
      const nodes = [...connection.nodes]; const seen = new Set(nodes.map((node) => node?.id ?? sha256(node))); const pages = [];
      const firstProof = { page_index: 0, request_cursor: null, end_cursor: connection.pageInfo.endCursor ?? null, has_next_page: connection.pageInfo.hasNextPage, total_count: connection.totalCount, node_count: connection.nodes.length, node_hashes: connection.nodes.map((node) => sha256(node)), identity: { item_id: item.id }, source_response_sha256: batchResponse.response_sha256 };
      pages.push({ ...firstProof, page_sha256: sha256(firstProof) });
      let cursor = connection.pageInfo.endCursor; let hasNext = connection.pageInfo.hasNextPage;
      while (hasNext) {
        if (!cursor) throw new ExecutorError('PAGINATION_CURSOR_REPEAT', `Project item ${item.id} value cursor is missing`);
        const response = graphql(root, VALUE_QUERY, { itemId: item.id, cursor }, runner); const next = response.data?.node;
        if (next?.id !== item.id || !Array.isArray(next.fieldValues?.nodes) || next.fieldValues.totalCount !== connection.totalCount) throw new ExecutorError('PREFLIGHT_DRIFT', `Project item ${item.id} value pagination drifted`);
        for (const node of next.fieldValues.nodes) { const key = node?.id ?? sha256(node); if (seen.has(key)) throw new ExecutorError('DUPLICATE_NODE_ID', `Project item ${item.id} contains duplicate values`); seen.add(key); nodes.push(node); }
        const proof = { page_index: pages.length, request_cursor: cursor, end_cursor: next.fieldValues.pageInfo?.endCursor ?? null, has_next_page: next.fieldValues.pageInfo?.hasNextPage, total_count: next.fieldValues.totalCount, node_count: next.fieldValues.nodes.length, node_hashes: next.fieldValues.nodes.map((node) => sha256(node)), identity: { item_id: item.id }, source_response_sha256: response.response_sha256 };
        pages.push({ ...proof, page_sha256: sha256(proof) });
        const prior = cursor; cursor = next.fieldValues.pageInfo?.endCursor; hasNext = next.fieldValues.pageInfo?.hasNextPage;
        if (hasNext && (!cursor || cursor === prior)) throw new ExecutorError('PAGINATION_CURSOR_REPEAT', `Project item ${item.id} value cursor did not advance`);
      }
      if (nodes.length !== connection.totalCount) throw new ExecutorError('PAGINATION_INCOMPLETE', `Project item ${item.id} values are truncated`);
      fieldValueCount += connection.totalCount; valueManifest.push({ item_id_hash: sha256(item.id), pages });
      normalizedItems.push({ ...item, field_values: nodes.map(normalizeValue).sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))) });
    }
  }
  const normalizedFields = fields.nodes.map(normalizeField).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(normalizedFields.map((field) => field.name.toLowerCase())).size !== normalizedFields.length) throw new ExecutorError('DUPLICATE_NODE_ID', 'Project contains duplicate case-insensitive field names');
  normalizedItems.sort((a, b) => a.id.localeCompare(b.id));
  const close = graphql(root, PROJECT_CLOSE_QUERY, { login: PROJECT.owner, number: PROJECT.number }, runner);
  const closeProject = close.data?.user?.projectV2;
  const closeIdentity = projectIdentity(closeProject);
  if (close.data?.viewer?.login !== 'cehinds' || !sameProjectIdentity(fieldsProject, closeIdentity) || closeProject?.fields?.totalCount !== fields.totalCount || closeProject?.items?.totalCount !== items.totalCount) throw new ExecutorError('PREFLIGHT_DRIFT', 'Project identity, updatedAt, or counts changed across the full inventory snapshot');
  const paginationManifest = { fields: fields.pages, items: items.pages, field_values: valueManifest, closing_read_sha256: close.response_sha256 };
  const priority = normalizedFields.find((field) => field.id === PRIORITY_FIELD_ID);
  const preflight = {
    field_count: fields.totalCount, field_state_root: sha256({ fields: normalizedFields }),
    item_count: items.totalCount, field_value_count: fieldValueCount, item_state_root: sha256({ items: normalizedItems }),
    pagination_manifest_hash: sha256(paginationManifest), priority_field_id: PRIORITY_FIELD_ID,
    priority_contract_hash: priority ? sha256(priority) : sha256(null)
  };
  return { auth, project: fieldsProject, fields: normalizedFields, items: normalizedItems, pagination_manifest: paginationManifest, preflight };
}

function schemaDocument(root, name) {
  return JSON.parse(fs.readFileSync(path.join(root, '.agentops', 'scheduler', 'schemas', `${name}.json`), 'utf8'));
}

function assertDocument(root, value, name) {
  const errors = validateSchema(value, schemaDocument(root, name), '$');
  if (errors.length) throw new ExecutorError('DOCUMENT_SCHEMA_INVALID', `${name} schema: ${errors.join('; ')}`);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || stableStringify(Object.keys(value).sort()) !== stableStringify([...expected].sort())) throw new ExecutorError('AUTHORITY_INVALID', `${label} does not have its exact closed key set`);
}

function remoteDevOid(root, runner) {
  const oid = remoteRefOid(root, DEV_REF, runner, 'REMOTE_DEV_UNAVAILABLE');
  if (!oid) throw new ExecutorError('REMOTE_DEV_UNAVAILABLE', 'origin/dev is absent');
  return oid;
}

function remoteRefOid(root, refName, runner, code = 'REMOTE_REF_UNAVAILABLE') {
  const output = git(root, ['ls-remote', '--refs', 'origin', refName], runner, { code });
  const lines = output.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return null;
  if (lines.length !== 1) throw new ExecutorError(code, `${refName} did not resolve to at most one ref`);
  const [oid, ref] = lines[0].split(/\s+/);
  if (!OID.test(oid ?? '') || ref !== refName) throw new ExecutorError(code, `${refName} returned an invalid identity`);
  return oid;
}

function ensureCommitObject(root, oid, runner) {
  const found = runner('git', ['cat-file', '-e', `${oid}^{commit}`], { cwd: root, timeoutMs: 30_000 });
  if (found.status === 0) return;
  checked(runner, 'git', ['fetch', '--no-tags', '--no-write-fetch-head', 'origin', DEV_REF], { cwd: root, timeoutMs: 30_000 }, 'AUTHORITY_EVENT_UNAVAILABLE');
  const fetched = runner('git', ['cat-file', '-e', `${oid}^{commit}`], { cwd: root, timeoutMs: 30_000 });
  if (fetched.status !== 0) throw new ExecutorError('AUTHORITY_EVENT_UNAVAILABLE', `authority state ${oid} is unavailable`);
}

function committedJson(root, oid, relative, runner, code = 'AUTHORITY_EVENT_UNAVAILABLE') {
  const result = runner('git', ['show', `${oid}:${relative}`], { cwd: root, timeoutMs: 30_000 });
  if (result.status !== 0) throw new ExecutorError(code, `${relative} is not committed at ${oid}`);
  try { return JSON.parse(result.stdout); } catch { throw new ExecutorError(code, `${relative} at ${oid} is not JSON`); }
}

function computeCapsuleHash(capsule) {
  return `sha256:${sha256({ ...capsule, current_hash: '' })}`;
}

function commitParents(root, oid, runner) {
  const parts = git(root, ['show', '-s', '--format=%P', oid], runner, { code: 'AUTHORITY_INVALID' }).split(/\s+/).filter(Boolean);
  if (parts.length !== 1 || !OID.test(parts[0])) throw new ExecutorError('AUTHORITY_INVALID', 'authority state must be one ordinary single-parent owner-command commit');
  return parts[0];
}

function validateAuthorityChain(root, authorityStateOid, eventPath, event, eventSchema, runner) {
  const ticket = event.ticket;
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(ticket ?? '') || event.decision?.target !== ticket || event.id !== `${ticket}-${String(event.seq).padStart(4, '0')}` || eventPath !== `.agentops/events/${ticket}/${event.id}.json`) throw new ExecutorError('AUTHORITY_INVALID', 'event ticket, target, id, sequence, or canonical path is inconsistent');
  const parent = commitParents(root, authorityStateOid, runner);
  if (committedPathExists(root, parent, eventPath, runner)) throw new ExecutorError('AUTHORITY_INVALID', 'authority event was not introduced by the authority-state commit');
  const listed = git(root, ['ls-tree', '-r', '--name-only', authorityStateOid, `--`, `.agentops/events/${ticket}`], runner, { code: 'AUTHORITY_INVALID' }).split(/\r?\n/).filter((entry) => entry.endsWith('.json'));
  const chain = listed.map((relative) => ({ relative, value: committedJson(root, authorityStateOid, relative, runner) })).sort((a, b) => a.value.seq - b.value.seq);
  let prior = null;
  for (let index = 0; index < chain.length; index += 1) {
    const item = chain[index]; const value = item.value;
    const errors = validateSchema(value, eventSchema, '$');
    if (errors.length || value.ticket !== ticket || value.seq !== index + 1 || value.id !== `${ticket}-${String(index + 1).padStart(4, '0')}` || value.parent_event !== prior || item.relative !== `.agentops/events/${ticket}/${value.id}.json`) throw new ExecutorError('AUTHORITY_INVALID', 'committed event history is not one exact validated append-only chain');
    prior = value.id;
  }
  if (!chain.length || chain.at(-1).relative !== eventPath || event.parent_event !== (chain.length === 1 ? null : chain.at(-2).value.id)) throw new ExecutorError('AUTHORITY_INVALID', 'authority event is not the terminal canonical event');
  const capsuleSchema = committedJson(root, authorityStateOid, '.agentops/schemas/work-capsule.schema.json', runner);
  if (sha256(capsuleSchema) !== TRUSTED_CAPSULE_SCHEMA_HASH) throw new ExecutorError('AUTHORITY_INVALID', 'committed work-capsule schema is not the exact trusted canonical schema');
  const parentCapsule = committedJson(root, parent, CAPSULE_PATH(ticket), runner);
  const currentCapsule = committedJson(root, authorityStateOid, CAPSULE_PATH(ticket), runner);
  if (validateSchema(parentCapsule, capsuleSchema, '$').length || validateSchema(currentCapsule, capsuleSchema, '$').length) throw new ExecutorError('AUTHORITY_INVALID', 'authority target capsule does not validate against the canonical schema');
  if (parentCapsule.ticket !== ticket || currentCapsule.ticket !== ticket || parentCapsule.current_hash !== computeCapsuleHash(parentCapsule) || event.decision.expected_current_hash !== parentCapsule.current_hash || currentCapsule.parent_hash !== parentCapsule.current_hash || currentCapsule.revision !== parentCapsule.revision + 1 || currentCapsule.current_hash !== computeCapsuleHash(currentCapsule)) throw new ExecutorError('AUTHORITY_INVALID', 'authority target capsule seal or owner-command compare-and-swap transition is invalid');
  return { parent_oid: parent, target_capsule_path: CAPSULE_PATH(ticket), parent_capsule_hash: parentCapsule.current_hash, current_capsule_hash: currentCapsule.current_hash };
}

function validFuture(value, now) {
  const instant = Date.parse(value); return Number.isFinite(instant) && instant > Date.parse(now);
}

export function validateAuthority(root, { authorityStateOid, eventPath, now = new Date().toISOString() }, runner = defaultRunner) {
  if (!OID.test(authorityStateOid ?? '')) throw new ExecutorError('AUTHORITY_INVALID', 'authority-state-oid must be 40 lowercase hexadecimal characters');
  if (!/^\.agentops\/events\/.+\.json$/.test(eventPath ?? '') || eventPath.includes('..')) throw new ExecutorError('AUTHORITY_INVALID', 'authority-event must be a canonical AgentOps event path');
  if (remoteDevOid(root, runner) !== authorityStateOid) throw new ExecutorError('AUTHORITY_EVENT_NOT_CURRENT', 'authority_state_oid is not the freshly observed origin/dev head');
  ensureCommitObject(root, authorityStateOid, runner);
  const event = committedJson(root, authorityStateOid, eventPath, runner);
  const eventSchema = committedJson(root, authorityStateOid, '.agentops/schemas/event.schema.json', runner);
  const bindingSchema = eventSchema?.properties?.decision?.properties?.project_schema_change;
  if (sha256(bindingSchema) !== TRUSTED_EVENT_SCHEMA_PROJECT_BINDING_HASH) throw new ExecutorError('AUTHORITY_INVALID', 'committed event schema Project authority binding is not canonical');
  const requestSchema = committedJson(root, authorityStateOid, '.agentops/schemas/owner-command-request.schema.json', runner);
  if (sha256(requestSchema?.properties?.project_schema_change) !== TRUSTED_EVENT_SCHEMA_PROJECT_BINDING_HASH) throw new ExecutorError('AUTHORITY_INVALID', 'committed request schema Project authority binding is not canonical');
  const eventErrors = validateSchema(event, eventSchema, '$');
  if (eventErrors.length) throw new ExecutorError('AUTHORITY_INVALID', `authority event schema: ${eventErrors.join('; ')}`);
  if (event.kind !== 'owner-decision' || event.actor !== 'owner' || event.decision?.action !== ACTION || event.decision.authenticated_role !== 'owner' || event.decision.authority_path !== AUTHORITY_PATH) throw new ExecutorError('AUTHORITY_INVALID', 'authority event is not the exact authenticated owner Project-schema action');
  const eventHash = sha256(event);
  const binding = event.decision.project_schema_change;
  exactKeys(binding, ['schema', 'executor_head', 'executor_tree', 'project', 'authenticated_login', 'required_scope', 'project_updated_at', 'preflight', 'definitions_hash', 'mode', 'allowed_mutation', 'forbid_item_mutation', 'forbid_existing_field_update', 'forbid_backfill', 'abort_on_any_drift', 'retry_mode', 'one_use', 'expires_at', 'audit_ref', 'expected_audit_remote_oid', 'audit_push_mode', 'journal_mode', 'recovery_mode', 'audit_paths', 'audit_guards', 'audit_result_contract'], 'project_schema_change');
  exactKeys(binding.project, ['owner', 'owner_type', 'number', 'id', 'title', 'closed'], 'project_schema_change.project');
  exactKeys(binding.preflight, ['field_count', 'field_state_root', 'item_count', 'field_value_count', 'item_state_root', 'pagination_manifest_hash', 'priority_field_id', 'priority_contract_hash'], 'project_schema_change.preflight');
  if (stableStringify(binding.project) !== stableStringify(PROJECT) || binding.authenticated_login !== 'cehinds' || binding.required_scope !== 'project') throw new ExecutorError('AUTHORITY_INVALID', 'authority Project identity or authentication binding is wrong');
  const auditPaths = { root: AUDIT_ROOT, journal_path: AUDIT_JOURNAL, attempt_path_template: `${AUDIT_ROOT}/attempts/{attempt_id}.json`, receipt_path_template: `${AUDIT_ROOT}/receipts/{attempt_id}.json`, manifest_path_template: `${AUDIT_ROOT}/manifests/{attempt_id}.json` };
  const auditGuards = { expected_absence: true, initial_commit_parent_binding: 'derived-owner-authority-a', initial_creation_authorized_if_absent: true, subsequent_linear_direct_successors: true, allowed_mutation: 'append-intent-result-attempt-and-receipt-records-only', intent_before_each_create: true, result_after_each_response: true, consumed_create_retry_forbidden: true, read_only_recovery: true, ref_recreation_forbidden: true, development_ref_mutation_forbidden: true };
  const auditResultContract = { schema: 'agentops/project-schema-audit-result-contract/v1', result_schema: 'agentops/project-schema-audit-result/v1', path: AUDIT_RESULT_LOCAL, schema_pointer: '.agentops/schemas/owner-command-request.schema.json#/definitions/project_schema_audit_result_receipt', construction_timing: 'after-manifest-publication-and-single-postinspection', finalization_timing: 'after-manifest-publication-and-single-postinspection', ambiguity_policy: 'inspect-once-never-create', no_self_reference: true };
  if (binding.schema !== 'agentops/project-schema-change-authority/v2' || binding.mode !== 'create-missing-only' || binding.allowed_mutation !== 'project-field-create' || binding.forbid_item_mutation !== true || binding.forbid_existing_field_update !== true || binding.forbid_backfill !== true || binding.abort_on_any_drift !== true || binding.retry_mode !== 'never' || binding.one_use !== true || binding.audit_ref !== AUDIT_REF || binding.expected_audit_remote_oid !== null || binding.audit_push_mode !== 'create-if-absent-then-non-force-forward-only-cas' || binding.journal_mode !== 'append-only-intent-result' || binding.recovery_mode !== 'inspect-once-never-create' || stableStringify(binding.audit_paths) !== stableStringify(auditPaths) || stableStringify(binding.audit_guards) !== stableStringify(auditGuards) || stableStringify(binding.audit_result_contract) !== stableStringify(auditResultContract)) throw new ExecutorError('AUTHORITY_INVALID', 'authority safety and audit constants are incomplete');
  if (!validFuture(binding.expires_at, now)) throw new ExecutorError('AUTHORITY_EXPIRED', 'Project schema authority is expired');
  if (binding.definitions_hash !== DEFINITIONS_HASH) throw new ExecutorError('DEFINITIONS_HASH_MISMATCH', 'authority definitions_hash does not match the executor manifest');
  const head = git(root, ['rev-parse', 'HEAD'], runner, { code: 'EXECUTOR_BINDING_MISMATCH' });
  const tree = git(root, ['rev-parse', 'HEAD^{tree}'], runner, { code: 'EXECUTOR_BINDING_MISMATCH' });
  if (git(root, ['status', '--porcelain=v1'], runner, { code: 'EXECUTOR_BINDING_MISMATCH' }) !== '') throw new ExecutorError('EXECUTOR_BINDING_MISMATCH', 'executor worktree is not clean');
  if (head !== binding.executor_head || tree !== binding.executor_tree || event.decision.candidate_oid !== head) throw new ExecutorError('EXECUTOR_BINDING_MISMATCH', 'executor HEAD/tree/candidate does not match authority');
  const policy = committedJson(root, authorityStateOid, '.agentops/governance/owner-command.json', runner);
  const action = policy.actions?.find((entry) => entry.id === ACTION);
  if (sha256(action) !== TRUSTED_POLICY_ACTION_HASH) throw new ExecutorError('AUTHORITY_INVALID', 'committed owner-command Project action is not the exact canonical policy');
  if (!action?.protected || action.one_use !== true || action.expires !== true || action.structured_only !== true || action.consumes_on_attempt !== true || stableStringify(action.authenticator_roles) !== stableStringify(['owner']) || !action.required_fields?.includes('project_schema_change')) throw new ExecutorError('AUTHORITY_INVALID', 'committed action is not owner-exclusive, expiring, structured, and consumed on attempt');
  const command = validateAuthorityChain(root, authorityStateOid, eventPath, event, eventSchema, runner);
  return { authority: { state_oid: authorityStateOid, event_path: eventPath, event_id: event.id, event_hash: eventHash, ...command }, event, binding, executor: { head, tree } };
}

function priorityContract(inventory) {
  const priority = inventory.fields.filter((field) => field.id === PRIORITY_FIELD_ID);
  if (priority.length !== 1) throw new ExecutorError('PRIORITY_CONTRACT_MISMATCH', 'exact Priority field ID is missing or duplicated');
  const field = priority[0];
  if (field.name !== 'Priority' || field.kind !== 'ProjectV2SingleSelectField' || field.data_type !== 'SINGLE_SELECT' || field.is_issue_field !== false || stableStringify(field.options) !== stableStringify(PRIORITY_OPTIONS)) throw new ExecutorError('PRIORITY_CONTRACT_MISMATCH', 'Priority field identity, type, or exact ordered options are wrong');
  return field;
}

function exactTargetPrefix(inventory) {
  let length = 0; let gap = false;
  for (const definition of FIELD_DEFINITIONS) {
    const matches = inventory.fields.filter((field) => field.name.toLowerCase() === definition.name.toLowerCase());
    if (matches.length > 1) throw new ExecutorError('TARGET_FIELD_DUPLICATE', `target field ${definition.name} is duplicated`);
    if (!matches.length) { gap = true; continue; }
    if (gap || !definitionMatchesField(definition, matches[0])) throw new ExecutorError('TARGET_FIELD_CONFLICT', `target field ${definition.name} is not an exact ordered-prefix definition`);
    length += 1;
  }
  return length;
}

export function validatePreflight(inventory, binding, { allowExactPrefix = false } = {}) {
  if (stableStringify({ owner: PROJECT.owner, owner_type: PROJECT.owner_type, number: inventory.project.number, id: inventory.project.id, title: inventory.project.title, closed: inventory.project.closed }) !== stableStringify(PROJECT)) throw new ExecutorError('PROJECT_IDENTITY_MISMATCH', 'live Project identity differs from authority');
  if (inventory.project.updated_at !== binding.project_updated_at) throw new ExecutorError('PREFLIGHT_DRIFT', 'live Project updatedAt differs from authority');
  priorityContract(inventory);
  if (stableStringify(inventory.preflight) !== stableStringify(binding.preflight)) throw new ExecutorError('PREFLIGHT_DRIFT', 'live Project roots/counts differ from authority');
  const prefixLength = exactTargetPrefix(inventory);
  if (prefixLength && !allowExactPrefix) throw new ExecutorError('TARGET_FIELD_PRESENT', `target fields already exist as an exact prefix of length ${prefixLength}`);
  if (prefixLength === FIELD_DEFINITIONS.length) throw new ExecutorError('TARGET_SCHEMA_ALREADY_COMPLETE', 'all target fields already exist; no create authority may be attempted');
  return prefixLength;
}

function attemptPaths(eventHash) {
  if (!HASH.test(eventHash)) throw new ExecutorError('AUTHORITY_INVALID', 'authority event hash is invalid');
  return { attempt: `${ATTEMPT_ROOT}/attempts/${eventHash}.json`, receipt: `${ATTEMPT_ROOT}/receipts/${eventHash}.json` };
}

function sealed(value, hashKey) { const copy = structuredClone(value); delete copy[hashKey]; return { ...copy, [hashKey]: sha256(copy) }; }

export function createAttempt(authorityResult, inventory, now = new Date().toISOString()) {
  const value = {
    schema: 'agentops/project-schema-attempt/v1', status: 'ATTEMPTED', authority: authorityResult.authority,
    executor: authorityResult.executor, project: { ...PROJECT, updated_at: inventory.project.updated_at },
    definitions_hash: DEFINITIONS_HASH, initial_preflight: inventory.preflight, attempted_at: now
  };
  return sealed(value, 'attempt_hash');
}

function committedPathExists(root, oid, relative, runner) {
  return runner('git', ['cat-file', '-e', `${oid}:${relative}`], { cwd: root, timeoutMs: 30_000 }).status === 0;
}

function buildRecordsCommit(root, parent, records, message, at, runner, code) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentops-project-schema-index-'));
  const index = path.join(temp, 'index');
  const env = { GIT_INDEX_FILE: index, GIT_AUTHOR_NAME: 'agentops-project-schema', GIT_AUTHOR_EMAIL: 'agentops-project-schema@users.noreply.github.com', GIT_COMMITTER_NAME: 'agentops-project-schema', GIT_COMMITTER_EMAIL: 'agentops-project-schema@users.noreply.github.com', GIT_AUTHOR_DATE: at, GIT_COMMITTER_DATE: at };
  try {
    git(root, ['read-tree', parent], runner, { env, code });
    const bodies = new Map();
    for (const { relative, body } of records) {
      const exact = body.endsWith('\n') ? body : `${body}\n`; bodies.set(relative, exact);
      const blob = git(root, ['hash-object', '-w', '--stdin'], runner, { env, input: exact, code });
      git(root, ['update-index', '--add', '--cacheinfo', '100644', blob, relative], runner, { env, code });
    }
    const tree = git(root, ['write-tree'], runner, { env, code });
    const commit = git(root, ['commit-tree', tree, '-p', parent, '-m', message], runner, { env, code });
    const parentReadback = git(root, ['rev-parse', `${commit}^`], runner, { code });
    const changed = git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', parent, commit], runner, { code }).split(/\r?\n/).filter(Boolean);
    const expected = records.map((record) => record.relative).sort();
    if (parentReadback !== parent || stableStringify(changed.sort()) !== stableStringify(expected)) throw new ExecutorError(code, 'record commit topology or path set is wrong');
    return { commit, tree, bodies };
  } finally {
    try { fs.rmSync(temp, { recursive: true, force: true }); } catch { /* exact temporary index only */ }
  }
}

function pushAuditSuccessor(root, parent, records, message, at, runner, code) {
  const observed = remoteRefOid(root, AUDIT_REF, runner, code);
  if (observed !== parent) {
    if (observed) ensureCommitObject(root, observed, runner);
    throw new ExecutorError(code, `${AUDIT_REF} changed before the compare-and-swap commit`);
  }
  const built = buildRecordsCommit(root, parent, records, message, at, runner, code);
  const pushed = runner('git', ['push', '--porcelain', 'origin', `${built.commit}:${AUDIT_REF}`], { cwd: root, timeoutMs: 30_000 });
  const actual = remoteRefOid(root, AUDIT_REF, runner, code);
  if (actual !== built.commit) throw new ExecutorError(code, 'ordinary non-force audit compare-and-swap push did not publish the exact target after one inspection', { status: pushed.status, stderr: pushed.stderr, actual_oid: actual });
  for (const [relative, body] of built.bodies) if (git(root, ['show', `${built.commit}:${relative}`], runner, { code }) !== body.trim()) throw new ExecutorError(code, 'committed audit record readback differs from exact document');
  return { commit_oid: built.commit, push_exit_code: pushed.status ?? null };
}

function writeFinalAuditResult(root, attemptReceipt, manifestDescriptor, actualOid, runner) {
  const target = path.join(root, ...AUDIT_RESULT_LOCAL.split('/'));
  const tree = git(root, ['show', '-s', '--format=%T', manifestDescriptor.commit_oid], runner, { code: 'AUDIT_RESULT_FAILED' });
  const value = { schema: 'agentops/project-schema-audit-result/v1', published_object: { oid: manifestDescriptor.commit_oid, tree }, publication: { ref: AUDIT_REF, push_mode: 'create-if-absent-then-linear-cas', initial_create_exit_code: attemptReceipt.initial_create_exit_code ?? null, manifest_cas_exit_code: manifestDescriptor.manifest_cas_exit_code ?? null }, manifest: { blob_oid: manifestDescriptor.blob_oid, sha256: manifestDescriptor.sha256 }, postinspection: { inspection_count: 1, retry_create_permitted: false, ref: AUDIT_REF, actual_oid: actualOid } };
  const requestSchema = committedJson(root, attemptReceipt.commit_oid, '.agentops/schemas/owner-command-request.schema.json', runner, 'AUDIT_RESULT_FAILED');
  const errors = validateSchema(value, requestSchema.definitions?.project_schema_audit_result_receipt, '$');
  if (errors.length) throw new ExecutorError('AUDIT_RESULT_FAILED', `audit result schema: ${errors.join('; ')}`);
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, `${stableStringify(value)}\n`);
}

function createAuditRef(root, parent, records, message, at, runner, code) {
  if (remoteRefOid(root, AUDIT_REF, runner, code) !== null) throw new ExecutorError('ATTEMPT_ALREADY_CONSUMED', `${AUDIT_REF} already exists; first-use authority is consumed or invalid`);
  const raw = buildRecordsCommit(root, parent, records, message, at, runner, code); const built = { ...raw, parent };
  const pushed = runner('git', ['push', '--porcelain', 'origin', `${built.commit}:${AUDIT_REF}`], { cwd: root, timeoutMs: 30_000 });
  const actual = remoteRefOid(root, AUDIT_REF, runner, code);
  if (actual !== built.commit) throw new ExecutorError(code, 'audit ref create-if-absent did not publish the exact initial commit after one inspection', { status: pushed.status, stderr: pushed.stderr, actual_oid: actual });
  return { commit_oid: built.commit, push_exit_code: pushed.status ?? null };
}

function journalEntry(value) {
  return sealed({ schema: 'agentops/project-schema-journal-entry/v1', ...value }, 'entry_hash');
}

function appendAuditJournal(root, parent, entry, at, runner) {
  let prior = '';
  if (committedPathExists(root, parent, AUDIT_JOURNAL, runner)) prior = git(root, ['show', `${parent}:${AUDIT_JOURNAL}`], runner, { code: 'JOURNAL_PERSIST_FAILED' });
  const body = `${prior ? `${prior.trimEnd()}\n` : ''}${stableStringify(entry)}\n`;
  const publication = pushAuditSuccessor(root, parent, [{ relative: AUDIT_JOURNAL, body }], `AgentOps Project schema ${entry.phase.toLowerCase()} ${entry.index + 1}`, at, runner, 'JOURNAL_PERSIST_FAILED');
  return { commit_oid: publication.commit_oid, entry };
}

export function persistAttempt(root, authorityResult, attempt, runner = defaultRunner) {
  assertDocument(root, attempt, 'project-schema-attempt');
  const unsealed = structuredClone(attempt); delete unsealed.attempt_hash;
  if (attempt.attempt_hash !== sha256(unsealed) || stableStringify(attempt.authority) !== stableStringify(authorityResult.authority) || stableStringify(attempt.executor) !== stableStringify(authorityResult.executor)) throw new ExecutorError('DOCUMENT_SCHEMA_INVALID', 'attempt hash or authority binding is invalid');
  const relative = attemptPaths(authorityResult.authority.event_hash).attempt;
  const publication = createAuditRef(root, authorityResult.authority.state_oid, [{ relative, body: stableStringify(attempt) }], `AgentOps consume Project schema authority ${authorityResult.authority.event_id}`, attempt.attempted_at, runner, 'CONSUMPTION_PERSIST_FAILED');
  return { path: relative, commit_oid: publication.commit_oid, attempt_hash: attempt.attempt_hash, initial_create_exit_code: publication.push_exit_code };
}

function fieldContractShape(field) {
  return { id: field.id, name: field.name, kind: field.kind, data_type: field.data_type, created_at: field.created_at, updated_at: field.updated_at, options: field.options.map((option) => ({ id: option.id, name: option.name, color: option.color, description: option.description })) };
}

function definitionMatchesField(definition, field) {
  const expectedKind = definition.dataType === 'TEXT' ? 'ProjectV2Field' : 'ProjectV2SingleSelectField';
  if (!field || field.name !== definition.name || field.kind !== expectedKind || field.data_type !== definition.dataType) return false;
  const expectedOptions = definition.singleSelectOptions ?? [];
  return stableStringify(field.options.map(({ name, color, description }) => ({ name, color, description }))) === stableStringify(expectedOptions);
}

function mutationFieldShape(field) {
  if (!field?.id || !field.name || !field.dataType || !field.__typename) return null;
  return { id: field.id, name: field.name, kind: field.__typename, data_type: field.dataType, created_at: field.createdAt, updated_at: field.updatedAt, options: (field.options ?? []).map((option) => ({ id: option.id, name: option.name, color: option.color, description: option.description })) };
}

function createMutationInput(definition, clientMutationId) {
  return {
    clientMutationId, projectId: PROJECT.id, dataType: definition.dataType, name: definition.name,
    ...(definition.dataType === 'SINGLE_SELECT' ? { singleSelectOptions: definition.singleSelectOptions } : {})
  };
}

function assertInventoryDelta(before, after, definition, returned) {
  if (after.preflight.item_count !== before.preflight.item_count || after.preflight.field_value_count !== before.preflight.field_value_count || after.preflight.item_state_root !== before.preflight.item_state_root) throw new ExecutorError('POST_MUTATION_DRIFT', 'Project items or field values changed during field creation');
  if (after.preflight.field_count !== before.preflight.field_count + 1) throw new ExecutorError('MUTATION_RESULT_MISMATCH', 'Project field count did not increase by exactly one');
  const beforeById = new Map(before.fields.map((field) => [field.id, field]));
  const afterById = new Map(after.fields.map((field) => [field.id, field]));
  for (const [id, oldField] of beforeById) if (!afterById.has(id) || stableStringify(afterById.get(id)) !== stableStringify(oldField)) throw new ExecutorError('POST_MUTATION_DRIFT', `existing Project field ${oldField.name} changed`);
  const added = after.fields.filter((field) => !beforeById.has(field.id));
  if (added.length !== 1 || !definitionMatchesField(definition, added[0])) throw new ExecutorError('MUTATION_RESULT_MISMATCH', `readback for ${definition.name} is not the exact requested field`);
  if (!returned || returned.id !== added[0].id || returned.name !== added[0].name || returned.kind !== added[0].kind || returned.data_type !== added[0].data_type || stableStringify(returned.options) !== stableStringify(added[0].options)) throw new ExecutorError('MUTATION_RESULT_MISMATCH', `mutation payload and readback disagree for ${definition.name}`);
  if (Date.parse(after.project.updated_at) < Date.parse(before.project.updated_at)) throw new ExecutorError('POST_MUTATION_DRIFT', 'Project updatedAt moved backward');
  return added[0];
}

function reconcileAmbiguousCreate(before, after, definition) {
  if (stableStringify(before.preflight) === stableStringify(after.preflight) && sameProjectIdentity(before.project, after.project)) return { outcome: 'AMBIGUOUS', created: null };
  const beforeById = new Map(before.fields.map((field) => [field.id, field]));
  const added = after.fields.filter((field) => !beforeById.has(field.id));
  if (added.length === 1) {
    const created = assertInventoryDelta(before, after, definition, added[0]);
    return { outcome: 'AMBIGUOUS_APPLIED', created };
  }
  throw new ExecutorError('MUTATION_AMBIGUOUS_DRIFT', `authoritative reread after ${definition.name} has no exact recoverable prefix`);
}

function completeProjectReadback(inventory) {
  const names = ['Scheduler Status', 'Priority', 'Owner Role', 'Affected Paths', 'Affected Resources', 'Dependencies', 'External Claims', 'Human Gate', 'Scope Complete'];
  const fields = names.map((name) => {
    const matches = inventory.fields.filter((field) => field.name === name);
    if (matches.length !== 1) throw new ExecutorError('FINAL_READBACK_FAILED', `final Project field ${name} is missing or duplicated`);
    return fieldContractShape(matches[0]);
  });
  for (const definition of FIELD_DEFINITIONS) {
    const field = inventory.fields.find((candidate) => candidate.name === definition.name);
    if (!definitionMatchesField(definition, field)) throw new ExecutorError('FINAL_READBACK_FAILED', `final Project field ${definition.name} differs from the exact definition`);
  }
  priorityContract(inventory);
  return { schema: 'agentops/project-field-readback/v1', project: PROJECT, fields };
}

function configPin(readback) {
  const fields = {};
  for (const field of readback.fields) fields[field.name] = { id: field.id, kind: field.kind, data_type: field.data_type, ...(field.kind === 'ProjectV2SingleSelectField' ? { options: field.options.map(({ id, name }) => ({ id, name })) } : {}) };
  return { schema: 'agentops/scheduler-project-contract-pin/v1', owner: PROJECT.owner, owner_type: PROJECT.owner_type, number: PROJECT.number, id: PROJECT.id, title: PROJECT.title, fields };
}

function preflightSummary(inventory) { return structuredClone(inventory?.preflight ?? null); }

function createReceipt({ status, failureCode, authorityResult, attemptReceipt, attempt, initial, current, mutationAttempts, createdFields, journal, completedAt }) {
  let readback = null; let readbackHash = null; let pin = null;
  if (status === 'COMPLETE') { readback = completeProjectReadback(current); readbackHash = sha256(readback); pin = configPin(readback); }
  const value = {
    schema: 'agentops/project-schema-change-receipt/v1', status, failure_code: failureCode ?? null,
    authority: authorityResult.authority, attempt: { path: attemptReceipt.path, commit_oid: attemptReceipt.commit_oid, attempt_hash: attemptReceipt.attempt_hash }, executor: authorityResult.executor,
    project: { ...PROJECT, initial_updated_at: initial.project.updated_at, final_updated_at: current?.project?.updated_at ?? null },
    definitions_hash: DEFINITIONS_HASH, initial_preflight: initial.preflight, mutation_attempts: mutationAttempts,
    created_fields: createdFields.map(fieldContractShape), final_preflight: preflightSummary(current),
    project_readback: readback, project_readback_hash: readbackHash, config_pin: pin,
    journal,
    mutation_counts: { created_field_count: createdFields.length, mutated_item_count: 0, updated_existing_field_count: 0, backfill_count: 0 },
    completed_at: completedAt
  };
  return sealed(value, 'receipt_hash');
}

function persistReceipt(root, auditParentOid, attemptReceipt, authorityResult, receipt, runner) {
  verifyReceipt(root, receipt);
  const relative = attemptPaths(authorityResult.authority.event_hash).receipt;
  const publication = pushAuditSuccessor(root, auditParentOid, [{ relative, body: stableStringify(receipt) }], `AgentOps record Project schema attempt ${authorityResult.authority.event_id}`, receipt.completed_at, runner, 'RECEIPT_PERSIST_FAILED');
  return { path: relative, commit_oid: publication.commit_oid, receipt_hash: receipt.receipt_hash };
}

function manifestPath(eventHash) { return `${ATTEMPT_ROOT}/manifests/${eventHash}.json`; }

function deriveProjectManifest(receipt) {
  if (receipt.status !== 'COMPLETE' || !receipt.project_readback || !receipt.project.final_updated_at) throw new ExecutorError('MANIFEST_INVALID', 'only a sealed COMPLETE receipt with stable final Project updatedAt can source the manifest');
  return { schema: 'agentops/project-field-manifest/v1', definitions_hash: receipt.definitions_hash, project: receipt.project_readback.project, observed_at: receipt.completed_at, project_updated_at: receipt.project.final_updated_at, fields: receipt.project_readback.fields, source_receipt_hash: receipt.receipt_hash };
}

function persistProjectManifest(root, parent, authorityResult, receipt, runner) {
  const manifest = deriveProjectManifest(receipt); const relative = manifestPath(authorityResult.authority.event_hash);
  const publication = pushAuditSuccessor(root, parent, [{ relative, body: stableStringify(manifest) }], `AgentOps publish Project field manifest ${authorityResult.authority.event_id}`, receipt.completed_at, runner, 'MANIFEST_PERSIST_FAILED');
  const blobOid = git(root, ['rev-parse', `${publication.commit_oid}:${relative}`], runner, { code: 'MANIFEST_PERSIST_FAILED' });
  return { manifest, descriptor: { path: relative, commit_oid: publication.commit_oid, parent_oid: parent, blob_oid: blobOid, sha256: sha256(manifest), source_receipt_hash: receipt.receipt_hash, manifest_cas_exit_code: publication.push_exit_code } };
}

function statusForFailure(error, createdCount) {
  if (error.code === 'MUTATION_AMBIGUOUS' || error.code === 'RECEIPT_PERSIST_FAILED') return 'AMBIGUOUS';
  if (createdCount > 0) return 'PARTIAL';
  return 'FAILED';
}

function assertDevStillConsumed(root, attemptReceipt, expectedAuditOid, runner) {
  if (remoteRefOid(root, AUDIT_REF, runner, 'CONSUMED_PREFLIGHT_DRIFT') !== expectedAuditOid) throw new ExecutorError('CONSUMED_PREFLIGHT_DRIFT', 'audit ref changed after authority consumption');
  const attempt = committedJson(root, attemptReceipt.commit_oid, attemptReceipt.path, runner, 'CONSUMED_PREFLIGHT_DRIFT');
  if (remoteDevOid(root, runner) !== attempt.authority.state_oid) throw new ExecutorError('CONSUMED_PREFLIGHT_DRIFT', 'origin/dev changed after authority issuance');
}

export function planProjectSchemaChange(root, authorityOptions, runner = defaultRunner, { now = new Date().toISOString() } = {}) {
  const authorityResult = validateAuthority(root, { ...authorityOptions, now }, runner);
  const inventory = fetchProjectInventory(root, runner);
  validatePreflight(inventory, authorityResult.binding);
  return { schema: 'agentops/project-schema-plan/v1', status: 'READY', authority: authorityResult.authority, executor: authorityResult.executor, project: inventory.project, definitions: DEFINITIONS_MANIFEST, definitions_hash: DEFINITIONS_HASH, preflight: inventory.preflight };
}

export function applyProjectSchemaChange(root, authorityOptions, runner = defaultRunner, { now = () => new Date().toISOString() } = {}) {
  const firstNow = now();
  const authorityResult = validateAuthority(root, { ...authorityOptions, now: firstNow }, runner);
  const initial = fetchProjectInventory(root, runner);
  validatePreflight(initial, authorityResult.binding);
  const attempt = createAttempt(authorityResult, initial, firstNow);
  const attemptReceipt = persistAttempt(root, authorityResult, attempt, runner);
  let current = initial; const mutationAttempts = []; const createdFields = [];
  let auditCursor = attemptReceipt.commit_oid; const journalEntries = [];
  let failure = null;
  try {
    assertDevStillConsumed(root, attemptReceipt, auditCursor, runner);
    current = fetchProjectInventory(root, runner);
    validatePreflight(current, authorityResult.binding);
    for (let index = 0; index < FIELD_DEFINITIONS.length; index += 1) {
      assertDevStillConsumed(root, attemptReceipt, auditCursor, runner);
      const before = fetchProjectInventory(root, runner);
      if (stableStringify(before.preflight) !== stableStringify(current.preflight) || !sameProjectIdentity(before.project, current.project)) throw new ExecutorError('CONSUMED_PREFLIGHT_DRIFT', `Project drifted before ${FIELD_DEFINITIONS[index].name}`);
      const definition = FIELD_DEFINITIONS[index];
      const clientMutationId = sha256({ authority_event_hash: authorityResult.authority.event_hash, definitions_hash: DEFINITIONS_HASH, ordinal: definition.ordinal });
      const input = createMutationInput(definition, clientMutationId);
      const startedAt = now();
      const intent = journalEntry({ attempt_id: authorityResult.authority.event_hash, sequence: journalEntries.length + 1, previous_entry_hash: journalEntries.at(-1)?.entry_hash ?? null, phase: 'INTENT', index, field_name: definition.name, client_mutation_id: clientMutationId, definition_hash: sha256(definition), before_project: before.project, before_preflight: before.preflight, before_fields: before.fields, at: startedAt });
      auditCursor = appendAuditJournal(root, auditCursor, intent, startedAt, runner).commit_oid; journalEntries.push(intent);
      assertDevStillConsumed(root, attemptReceipt, auditCursor, runner);
      let response;
      try { response = graphql(root, CREATE_FIELD_MUTATION, { input }, runner, { ambiguous: true }); }
      catch (error) {
        let outcome = error.code === 'MUTATION_REJECTED' ? 'REJECTED' : 'AMBIGUOUS'; let reconciled = null;
        if (outcome === 'AMBIGUOUS') {
          const reread = fetchProjectInventory(root, runner);
          const resolution = reconcileAmbiguousCreate(before, reread, definition); outcome = resolution.outcome; reconciled = resolution.created; current = reread;
          if (reconciled) createdFields.push(reconciled);
        }
        const finishedAt = now();
        const mutationRecord = { index, field_name: definition.name, client_mutation_id: clientMutationId, request_sha256: error.details?.request_sha256 ?? sha256(`${stableStringify({ query: CREATE_FIELD_MUTATION, variables: { input } })}\n`), response_sha256: error.details?.response_sha256 ?? null, outcome, returned_field: reconciled ? fieldContractShape(reconciled) : null, started_at: startedAt, finished_at: finishedAt };
        mutationAttempts.push(mutationRecord);
        const resultEntry = journalEntry({ attempt_id: authorityResult.authority.event_hash, sequence: journalEntries.length + 1, previous_entry_hash: journalEntries.at(-1).entry_hash, phase: 'RESULT', index, client_mutation_id: clientMutationId, outcome, mutation_record: mutationRecord, mutation_record_hash: sha256(mutationRecord), after_preflight: current.preflight, at: finishedAt });
        auditCursor = appendAuditJournal(root, auditCursor, resultEntry, finishedAt, runner).commit_oid; journalEntries.push(resultEntry);
        throw error.code === 'MUTATION_REJECTED' ? error : new ExecutorError('MUTATION_AMBIGUOUS', `mutation outcome for ${definition.name} required inspect-once reconciliation`);
      }
      const payload = response.data?.createProjectV2Field;
      const returned = mutationFieldShape(payload?.projectV2Field);
      if (payload?.clientMutationId !== clientMutationId || !returned || !definitionMatchesField(definition, returned)) {
        const reread = fetchProjectInventory(root, runner); const resolution = reconcileAmbiguousCreate(before, reread, definition); current = reread;
        if (resolution.created) createdFields.push(resolution.created);
        const finishedAt = now(); const mutationRecord = { index, field_name: definition.name, client_mutation_id: clientMutationId, request_sha256: response.request_sha256, response_sha256: response.response_sha256, outcome: resolution.created ? 'AMBIGUOUS_APPLIED' : 'MISMATCH', returned_field: resolution.created ? fieldContractShape(resolution.created) : returned, started_at: startedAt, finished_at: finishedAt };
        mutationAttempts.push(mutationRecord);
        const resultEntry = journalEntry({ attempt_id: authorityResult.authority.event_hash, sequence: journalEntries.length + 1, previous_entry_hash: journalEntries.at(-1).entry_hash, phase: 'RESULT', index, client_mutation_id: clientMutationId, outcome: mutationRecord.outcome, mutation_record: mutationRecord, mutation_record_hash: sha256(mutationRecord), after_preflight: current.preflight, at: finishedAt });
        auditCursor = appendAuditJournal(root, auditCursor, resultEntry, finishedAt, runner).commit_oid; journalEntries.push(resultEntry);
        throw new ExecutorError('MUTATION_AMBIGUOUS', `mutation result for ${definition.name} is incomplete or contradictory after authoritative reread`);
      }
      assertDevStillConsumed(root, attemptReceipt, auditCursor, runner);
      const after = fetchProjectInventory(root, runner);
      let created;
      try { created = assertInventoryDelta(before, after, definition, returned); }
      catch (error) {
        mutationAttempts.push({ index, field_name: definition.name, client_mutation_id: clientMutationId, request_sha256: response.request_sha256, response_sha256: response.response_sha256, outcome: error.code === 'POST_MUTATION_DRIFT' ? 'DRIFT' : 'MISMATCH', returned_field: returned, started_at: startedAt, finished_at: now() });
        current = after; throw error;
      }
      const finishedAt = now(); const mutationRecord = { index, field_name: definition.name, client_mutation_id: clientMutationId, request_sha256: response.request_sha256, response_sha256: response.response_sha256, outcome: 'CREATED', returned_field: fieldContractShape(created), started_at: startedAt, finished_at: finishedAt };
      mutationAttempts.push(mutationRecord);
      const resultEntry = journalEntry({ attempt_id: authorityResult.authority.event_hash, sequence: journalEntries.length + 1, previous_entry_hash: journalEntries.at(-1).entry_hash, phase: 'RESULT', index, client_mutation_id: clientMutationId, outcome: 'CREATED', mutation_record: mutationRecord, mutation_record_hash: sha256(mutationRecord), after_preflight: after.preflight, at: finishedAt });
      auditCursor = appendAuditJournal(root, auditCursor, resultEntry, finishedAt, runner).commit_oid; journalEntries.push(resultEntry);
      createdFields.push(created); current = after;
    }
    assertDevStillConsumed(root, attemptReceipt, auditCursor, runner);
    current = fetchProjectInventory(root, runner);
    if (current.preflight.item_count !== initial.preflight.item_count || current.preflight.field_value_count !== initial.preflight.field_value_count || current.preflight.item_state_root !== initial.preflight.item_state_root) throw new ExecutorError('FINAL_READBACK_FAILED', 'final Project item state differs from initial preflight');
    completeProjectReadback(current);
  } catch (error) { failure = error instanceof ExecutorError ? error : new ExecutorError('FINAL_READBACK_FAILED', error.message); }
  const journalBody = journalEntries.length ? git(root, ['show', `${auditCursor}:${AUDIT_JOURNAL}`], runner, { code: 'JOURNAL_PERSIST_FAILED' }) : '';
  const journal = { ref: AUDIT_REF, path: AUDIT_JOURNAL, entry_count: journalEntries.length, last_entry_hash: journalEntries.at(-1)?.entry_hash ?? null, journal_sha256: journalEntries.length ? sha256(`${journalBody}\n`) : null, head_oid: auditCursor };
  const receipt = createReceipt({ status: failure ? statusForFailure(failure, createdFields.length) : 'COMPLETE', failureCode: failure?.code ?? null, authorityResult, attemptReceipt, attempt, initial, current, mutationAttempts, createdFields, journal, completedAt: now() });
  const receiptCommit = persistReceipt(root, auditCursor, attemptReceipt, authorityResult, receipt, runner);
  if (failure) throw new ExecutorError(failure.code, failure.message, { receipt, receipt_commit: receiptCommit });
  const manifestPublication = persistProjectManifest(root, receiptCommit.commit_oid, authorityResult, receipt, runner);
  writeFinalAuditResult(root, attemptReceipt, manifestPublication.descriptor, manifestPublication.descriptor.commit_oid, runner);
  return { status: 'COMPLETE', receipt, receipt_commit: receiptCommit, project_manifest: manifestPublication.manifest, manifest_commit: manifestPublication.descriptor };
}

function readAuditJournal(root, oid, runner) {
  if (!committedPathExists(root, oid, AUDIT_JOURNAL, runner)) return [];
  return git(root, ['show', `${oid}:${AUDIT_JOURNAL}`], runner, { code: 'RECOVERY_INVALID' }).split(/\r?\n/).filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { throw new ExecutorError('RECOVERY_INVALID', 'audit journal contains non-JSON content'); }
  });
}

export function recoverProjectSchemaChange(root, authorityOptions, runner = defaultRunner, { now = () => new Date().toISOString() } = {}) {
  const authorityResult = validateAuthority(root, { ...authorityOptions, now: now() }, runner);
  let auditCursor = remoteRefOid(root, AUDIT_REF, runner, 'RECOVERY_INVALID');
  if (!auditCursor) throw new ExecutorError('RECOVERY_INVALID', 'audit ref is absent; recovery never creates it');
  const paths = attemptPaths(authorityResult.authority.event_hash);
  if (!committedPathExists(root, auditCursor, paths.attempt, runner)) throw new ExecutorError('RECOVERY_INVALID', 'committed attempt is absent from audit ref');
  if (committedPathExists(root, auditCursor, paths.receipt, runner)) {
    const receipt = committedJson(root, auditCursor, paths.receipt, runner, 'RECOVERY_INVALID'); verifyReceipt(root, receipt, runner);
    const relative = manifestPath(authorityResult.authority.event_hash);
    if (receipt.status === 'COMPLETE' && !committedPathExists(root, auditCursor, relative, runner)) {
      const publication = persistProjectManifest(root, auditCursor, authorityResult, receipt, runner);
      writeFinalAuditResult(root, { path: paths.attempt, commit_oid: git(root, ['log', '--format=%H', '--diff-filter=A', auditCursor, '--', paths.attempt], runner, { code: 'RECOVERY_INVALID' }).split(/\r?\n/).filter(Boolean)[0], attempt_hash: committedJson(root, auditCursor, paths.attempt, runner, 'RECOVERY_INVALID').attempt_hash }, publication.descriptor, publication.descriptor.commit_oid, runner);
      return { status: 'COMPLETE', receipt, project_manifest: publication.manifest, manifest_commit: publication.descriptor };
    }
    return { status: 'ALREADY_FINAL', receipt, project_manifest: committedPathExists(root, auditCursor, relative, runner) ? committedJson(root, auditCursor, relative, runner, 'RECOVERY_INVALID') : null };
  }
  const attempt = committedJson(root, auditCursor, paths.attempt, runner, 'RECOVERY_INVALID');
  const attemptReceipt = { path: paths.attempt, commit_oid: git(root, ['log', '--format=%H', '--diff-filter=A', auditCursor, '--', paths.attempt], runner, { code: 'RECOVERY_INVALID' }).split(/\r?\n/).filter(Boolean)[0], attempt_hash: attempt.attempt_hash };
  if (!OID.test(attemptReceipt.commit_oid ?? '')) throw new ExecutorError('RECOVERY_INVALID', 'attempt introduction commit is unavailable');
  const entries = readAuditJournal(root, auditCursor, runner); const results = entries.filter((entry) => entry.phase === 'RESULT');
  const mutationAttempts = results.map((entry) => entry.mutation_record); const createdFields = mutationAttempts.filter((record) => ['CREATED', 'AMBIGUOUS_APPLIED'].includes(record.outcome)).map((record) => record.returned_field);
  let current = fetchProjectInventory(root, runner); let failureCode = mutationAttempts.at(-1)?.outcome === 'REJECTED' ? 'MUTATION_REJECTED' : 'MUTATION_AMBIGUOUS';
  if (entries.at(-1)?.phase === 'INTENT') {
    const intent = entries.at(-1); const definition = FIELD_DEFINITIONS[intent.index];
    if (!definition || intent.client_mutation_id !== sha256({ authority_event_hash: authorityResult.authority.event_hash, definitions_hash: DEFINITIONS_HASH, ordinal: definition.ordinal })) throw new ExecutorError('RECOVERY_INVALID', 'unresolved intent identity is invalid');
    const before = { project: intent.before_project, preflight: intent.before_preflight, fields: intent.before_fields };
    const resolution = reconcileAmbiguousCreate(before, current, definition); const finishedAt = now();
    const input = createMutationInput(definition, intent.client_mutation_id);
    const mutationRecord = { index: intent.index, field_name: definition.name, client_mutation_id: intent.client_mutation_id, request_sha256: sha256(`${stableStringify({ query: CREATE_FIELD_MUTATION, variables: { input } })}\n`), response_sha256: null, outcome: resolution.outcome, returned_field: resolution.created ? fieldContractShape(resolution.created) : null, started_at: intent.at, finished_at: finishedAt };
    mutationAttempts.push(mutationRecord); if (resolution.created) createdFields.push(fieldContractShape(resolution.created));
    const resultEntry = journalEntry({ attempt_id: authorityResult.authority.event_hash, sequence: entries.length + 1, previous_entry_hash: intent.entry_hash, phase: 'RESULT', index: intent.index, client_mutation_id: intent.client_mutation_id, outcome: resolution.outcome, mutation_record: mutationRecord, mutation_record_hash: sha256(mutationRecord), after_preflight: current.preflight, at: finishedAt });
    auditCursor = appendAuditJournal(root, auditCursor, resultEntry, finishedAt, runner).commit_oid; entries.push(resultEntry);
    failureCode = 'MUTATION_AMBIGUOUS';
  }
  const initial = { project: { updated_at: attempt.project.updated_at }, preflight: attempt.initial_preflight };
  let status = 'AMBIGUOUS';
  if (mutationAttempts.length === 8 && mutationAttempts.every((record) => record.outcome === 'CREATED')) { completeProjectReadback(current); status = 'COMPLETE'; failureCode = null; }
  const journalRaw = entries.length ? git(root, ['show', `${auditCursor}:${AUDIT_JOURNAL}`], runner, { code: 'RECOVERY_INVALID' }) : '';
  const journal = { ref: AUDIT_REF, path: AUDIT_JOURNAL, entry_count: entries.length, last_entry_hash: entries.at(-1)?.entry_hash ?? null, journal_sha256: entries.length ? sha256(`${journalRaw}\n`) : null, head_oid: auditCursor };
  const receipt = createReceipt({ status, failureCode, authorityResult, attemptReceipt, attempt, initial, current, mutationAttempts, createdFields, journal, completedAt: now() });
  const receiptCommit = persistReceipt(root, auditCursor, attemptReceipt, authorityResult, receipt, runner);
  if (status === 'COMPLETE') {
    const publication = persistProjectManifest(root, receiptCommit.commit_oid, authorityResult, receipt, runner);
    writeFinalAuditResult(root, attemptReceipt, publication.descriptor, publication.descriptor.commit_oid, runner);
    return { status, receipt, receipt_commit: receiptCommit, project_manifest: publication.manifest, manifest_commit: publication.descriptor };
  }
  return { status, receipt, receipt_commit: receiptCommit };
}

export function verifyReceipt(root, receipt, runner = defaultRunner) {
  assertDocument(root, receipt, 'project-schema-receipt');
  const copy = structuredClone(receipt); delete copy.receipt_hash;
  if (receipt.receipt_hash !== sha256(copy)) throw new ExecutorError('RECEIPT_INVALID', 'receipt hash mismatch');
  exactKeys(receipt.authority, ['state_oid', 'event_path', 'event_id', 'event_hash', 'parent_oid', 'target_capsule_path', 'parent_capsule_hash', 'current_capsule_hash'], 'receipt.authority');
  exactKeys(receipt.attempt, ['path', 'commit_oid', 'attempt_hash'], 'receipt.attempt');
  exactKeys(receipt.executor, ['head', 'tree'], 'receipt.executor');
  exactKeys(receipt.project, ['owner', 'owner_type', 'number', 'id', 'title', 'closed', 'initial_updated_at', 'final_updated_at'], 'receipt.project');
  exactKeys(receipt.journal, ['ref', 'path', 'entry_count', 'last_entry_hash', 'journal_sha256', 'head_oid'], 'receipt.journal');
  exactKeys(receipt.initial_preflight, ['field_count', 'field_state_root', 'item_count', 'field_value_count', 'item_state_root', 'pagination_manifest_hash', 'priority_field_id', 'priority_contract_hash'], 'receipt.initial_preflight');
  if (receipt.final_preflight) exactKeys(receipt.final_preflight, ['field_count', 'field_state_root', 'item_count', 'field_value_count', 'item_state_root', 'pagination_manifest_hash', 'priority_field_id', 'priority_contract_hash'], 'receipt.final_preflight');
  if (receipt.definitions_hash !== DEFINITIONS_HASH || receipt.mutation_counts.mutated_item_count !== 0 || receipt.mutation_counts.updated_existing_field_count !== 0 || receipt.mutation_counts.backfill_count !== 0) throw new ExecutorError('RECEIPT_INVALID', 'receipt safety bindings are wrong');
  if (receipt.mutation_attempts.some((attempt, index) => attempt.index !== index || attempt.field_name !== FIELD_DEFINITIONS[index]?.name || attempt.client_mutation_id !== sha256({ authority_event_hash: receipt.authority.event_hash, definitions_hash: DEFINITIONS_HASH, ordinal: FIELD_DEFINITIONS[index]?.ordinal }))) throw new ExecutorError('RECEIPT_INVALID', 'receipt mutation sequence or idempotency identities are wrong');
  if (receipt.status === 'COMPLETE') {
    if (receipt.failure_code !== null || receipt.mutation_attempts.length !== 8 || receipt.created_fields.length !== 8 || receipt.mutation_counts.created_field_count !== 8 || receipt.mutation_attempts.some((attempt) => attempt.outcome !== 'CREATED') || receipt.project_readback?.schema !== 'agentops/project-field-readback/v1' || stableStringify(receipt.project_readback.project) !== stableStringify(PROJECT) || receipt.project_readback_hash !== sha256(receipt.project_readback) || stableStringify(receipt.config_pin) !== stableStringify(configPin(receipt.project_readback))) throw new ExecutorError('RECEIPT_INVALID', 'complete receipt is internally inconsistent');
    if (!receipt.final_preflight || receipt.final_preflight.field_count !== receipt.initial_preflight.field_count + 8 || receipt.final_preflight.item_count !== receipt.initial_preflight.item_count || receipt.final_preflight.field_value_count !== receipt.initial_preflight.field_value_count || receipt.final_preflight.item_state_root !== receipt.initial_preflight.item_state_root || receipt.final_preflight.field_state_root === receipt.initial_preflight.field_state_root) throw new ExecutorError('RECEIPT_INVALID', 'complete receipt roots and exact +8 field transition are inconsistent');
    const manifestNames = receipt.project_readback.fields?.map((field) => field.name);
    const expectedNames = ['Scheduler Status', 'Priority', 'Owner Role', 'Affected Paths', 'Affected Resources', 'Dependencies', 'External Claims', 'Human Gate', 'Scope Complete'];
    if (stableStringify(manifestNames) !== stableStringify(expectedNames)) throw new ExecutorError('RECEIPT_INVALID', 'Project manifest does not contain the exact ordered nine-field contract');
    const createdByName = new Map(receipt.created_fields.map((field) => [field.name, field]));
    if (createdByName.size !== 8) throw new ExecutorError('RECEIPT_INVALID', 'created field identities are duplicated');
    for (let index = 0; index < FIELD_DEFINITIONS.length; index += 1) {
      const definition = FIELD_DEFINITIONS[index]; const created = createdByName.get(definition.name); const mutation = receipt.mutation_attempts[index];
      if (!definitionMatchesField(definition, created) || stableStringify(mutation.returned_field) !== stableStringify(created) || stableStringify(receipt.project_readback.fields.find((field) => field.name === definition.name)) !== stableStringify(created)) throw new ExecutorError('RECEIPT_INVALID', `created/readback binding differs for ${definition.name}`);
    }
    const priority = receipt.project_readback.fields[1];
    if (priority.id !== PRIORITY_FIELD_ID || priority.kind !== 'ProjectV2SingleSelectField' || priority.data_type !== 'SINGLE_SELECT' || stableStringify(priority.options) !== stableStringify(PRIORITY_OPTIONS)) throw new ExecutorError('RECEIPT_INVALID', 'manifest Priority contract is not exact');
  } else if (!receipt.failure_code || receipt.mutation_attempts.length > 8 || receipt.created_fields.length > receipt.mutation_attempts.filter((attempt) => ['CREATED', 'AMBIGUOUS_APPLIED'].includes(attempt.outcome)).length || receipt.mutation_counts.created_field_count !== receipt.created_fields.length) {
    throw new ExecutorError('RECEIPT_INVALID', 'failed receipt is internally inconsistent');
  }
  ensureCommitObject(root, receipt.authority.state_oid, runner);
  const event = committedJson(root, receipt.authority.state_oid, receipt.authority.event_path, runner, 'RECEIPT_INVALID');
  if (event.id !== receipt.authority.event_id || sha256(event) !== receipt.authority.event_hash || event.decision?.candidate_oid !== receipt.executor.head || event.decision?.project_schema_change?.definitions_hash !== DEFINITIONS_HASH) throw new ExecutorError('RECEIPT_INVALID', 'receipt authority event binding is not committed and exact');
  ensureCommitObject(root, receipt.attempt.commit_oid, runner);
  const expectedAttemptPath = attemptPaths(receipt.authority.event_hash).attempt;
  if (receipt.attempt.path !== expectedAttemptPath) throw new ExecutorError('RECEIPT_INVALID', 'attempt path does not derive from authority event hash');
  const attempt = committedJson(root, receipt.attempt.commit_oid, receipt.attempt.path, runner, 'RECEIPT_INVALID');
  const attemptCopy = structuredClone(attempt); delete attemptCopy.attempt_hash;
  if (attempt.attempt_hash !== receipt.attempt.attempt_hash || attempt.attempt_hash !== sha256(attemptCopy) || stableStringify(attempt.authority) !== stableStringify(receipt.authority) || stableStringify(attempt.executor) !== stableStringify(receipt.executor) || attempt.definitions_hash !== DEFINITIONS_HASH || stableStringify(attempt.initial_preflight) !== stableStringify(receipt.initial_preflight) || stableStringify(attempt.project) !== stableStringify({ ...PROJECT, updated_at: receipt.project.initial_updated_at })) throw new ExecutorError('RECEIPT_INVALID', 'receipt does not cross-bind the exact committed attempt');
  if (git(root, ['show', '-s', '--format=%P', receipt.attempt.commit_oid], runner, { code: 'RECEIPT_INVALID' }) !== receipt.authority.state_oid || stableStringify(git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', receipt.authority.state_oid, receipt.attempt.commit_oid], runner, { code: 'RECEIPT_INVALID' }).split(/\r?\n/).filter(Boolean)) !== stableStringify([receipt.attempt.path])) throw new ExecutorError('RECEIPT_INVALID', 'attempt is not the exact initial audit child of owner authority A');
  if (receipt.journal.ref !== AUDIT_REF || receipt.journal.path !== AUDIT_JOURNAL || receipt.journal.entry_count !== receipt.mutation_attempts.length * 2 || receipt.journal.entry_count > 16) throw new ExecutorError('RECEIPT_INVALID', 'journal binding or intent/result cardinality is wrong');
  const journalRaw = receipt.journal.entry_count ? git(root, ['show', `${receipt.journal.head_oid}:${AUDIT_JOURNAL}`], runner, { code: 'RECEIPT_INVALID' }) : '';
  const entries = journalRaw ? journalRaw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : [];
  if (entries.length !== receipt.journal.entry_count || (entries.length ? sha256(`${journalRaw}\n`) : null) !== receipt.journal.journal_sha256 || (entries.at(-1)?.entry_hash ?? null) !== receipt.journal.last_entry_hash) throw new ExecutorError('RECEIPT_INVALID', 'journal count, bytes, or root hash differs');
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]; const copyEntry = structuredClone(entry); delete copyEntry.entry_hash;
    if (entry.entry_hash !== sha256(copyEntry) || entry.sequence !== index + 1 || entry.attempt_id !== receipt.authority.event_hash || entry.previous_entry_hash !== (entries[index - 1]?.entry_hash ?? null) || entry.index !== Math.floor(index / 2) || entry.phase !== (index % 2 === 0 ? 'INTENT' : 'RESULT')) throw new ExecutorError('RECEIPT_INVALID', 'journal entry chain, phase, or seal is invalid');
    if (entry.phase === 'RESULT' && (entry.mutation_record_hash !== sha256(receipt.mutation_attempts[entry.index]) || stableStringify(entry.mutation_record) !== stableStringify(receipt.mutation_attempts[entry.index]))) throw new ExecutorError('RECEIPT_INVALID', 'journal result does not bind the exact mutation record');
  }
  if (entries.length) {
    const commits = git(root, ['rev-list', '--first-parent', '--reverse', `${receipt.attempt.commit_oid}..${receipt.journal.head_oid}`], runner, { code: 'RECEIPT_INVALID' }).split(/\r?\n/).filter(Boolean);
    if (commits.length !== entries.length) throw new ExecutorError('RECEIPT_INVALID', 'journal commit chain length differs from entry count');
    let parent = receipt.attempt.commit_oid;
    for (const commit of commits) {
      if (git(root, ['show', '-s', '--format=%P', commit], runner, { code: 'RECEIPT_INVALID' }) !== parent || stableStringify(git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', parent, commit], runner, { code: 'RECEIPT_INVALID' }).split(/\r?\n/).filter(Boolean)) !== stableStringify([AUDIT_JOURNAL])) throw new ExecutorError('RECEIPT_INVALID', 'journal is not a linear sequence of journal-only direct successors');
      parent = commit;
    }
  } else if (receipt.journal.head_oid !== receipt.attempt.commit_oid) throw new ExecutorError('RECEIPT_INVALID', 'empty journal head must equal attempt commit');
  const actualTree = git(root, ['show', '-s', '--format=%T', receipt.executor.head], runner, { code: 'RECEIPT_INVALID' });
  if (actualTree !== receipt.executor.tree) throw new ExecutorError('RECEIPT_INVALID', 'receipt executor head/tree is not a real exact commit');
  return true;
}

function parseOptions(argv) {
  const command = argv[2]; const allowed = new Set(['--authority-state-oid', '--authority-event', '--file']); const values = {};
  for (let index = 3; index < argv.length; index += 2) {
    const flag = argv[index]; const value = argv[index + 1];
    if (!allowed.has(flag) || !value) throw new ExecutorError('USAGE_ERROR', `unknown or incomplete option ${flag ?? ''}`);
    if (values[flag]) throw new ExecutorError('USAGE_ERROR', `duplicate option ${flag}`);
    values[flag] = value;
  }
  return { command, authorityStateOid: values['--authority-state-oid'], eventPath: values['--authority-event'], file: values['--file'] };
}

function usage() {
  return [
    'project-schema-executor definitions',
    'project-schema-executor inventory',
    'project-schema-executor plan --authority-state-oid <oid> --authority-event <path>',
    'project-schema-executor apply --authority-state-oid <oid> --authority-event <path>',
    'project-schema-executor recover --authority-state-oid <oid> --authority-event <path>',
    'project-schema-executor verify-receipt --file <receipt>'
  ].join('\n');
}

export function main(argv = process.argv) {
  try {
    const options = parseOptions(argv);
    let result;
    if (options.command === 'definitions') result = { definitions: DEFINITIONS_MANIFEST, byte_length: Buffer.byteLength(stableStringify(DEFINITIONS_MANIFEST)), definitions_hash: DEFINITIONS_HASH };
    else if (options.command === 'inventory') {
      const inventory = fetchProjectInventory(ROOT); result = { schema: 'agentops/project-schema-inventory/v1', project: inventory.project, definitions_hash: DEFINITIONS_HASH, preflight: inventory.preflight };
    } else if (options.command === 'plan') result = planProjectSchemaChange(ROOT, options);
    else if (options.command === 'apply') result = applyProjectSchemaChange(ROOT, options);
    else if (options.command === 'recover') result = recoverProjectSchemaChange(ROOT, options);
    else if (options.command === 'verify-receipt') {
      if (!options.file) throw new ExecutorError('USAGE_ERROR', 'verify-receipt requires --file');
      const receipt = JSON.parse(fs.readFileSync(path.resolve(options.file), 'utf8')); result = { status: verifyReceipt(ROOT, receipt) ? 'VALID' : 'INVALID', receipt_hash: receipt.receipt_hash };
    } else throw new ExecutorError('USAGE_ERROR', usage());
    process.stdout.write(`${stableStringify(result)}\n`);
  } catch (error) {
    const code = error instanceof ExecutorError ? error.code : 'UNEXPECTED_ERROR';
    process.stderr.write(`${code}: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
