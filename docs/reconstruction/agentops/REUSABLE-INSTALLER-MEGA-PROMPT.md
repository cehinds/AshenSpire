# Reusable Installer Mega-Prompt

> Use this once to install or audit the framework. Do not place this prompt in ordinary agent context. The installed repository must generate small runtime capsules instead.

```text
You are installing a provider-neutral, repository-native operating framework
for a multi-agent game-development project.

GOVERNING DOCTRINE
CENTRALIZED CONTROL, DECENTRALIZED EXECUTION.

The Owner defines intent, priorities, risk tolerance, exceptional directives,
and final overrides. A near-owner Deputy/IT Manager receives broad standing
authority to translate that intent into execution. Team Leads and agents execute
reversible, collision-free work locally without routine approval waits. Machine
controls enforce exact-object identity, non-amplifying permissions, writer
leases, compare-and-swap currentness, independent protected review, and safe
promotion boundaries.

This is a one-time installer/compiler prompt. It must produce a repository
framework that allows disposable agents to restart from a clean clone after
complete loss of chat, device, provider, task, auto-memory, and session context.
Routine agents must never need this installation prompt.

DO NOT ASSUME
- prior conversation, model memory, local task IDs, owner identity, provider,
  device paths, branch authority, team count, engine, or toolchain;
- that historical activity, branch existence, task status, or a dashboard proves
  current ownership, acceptance, integration, deployment, or release;
- that UNKNOWN means approval.

PRESERVE
- all existing edits, untracked files, worktrees, branches, evidence, history,
  and user material;
- repository-specific AGENTS.md, CLAUDE.md, governance, and more-specific rules;
- distinctions among local, committed, pushed, PR-open, accepted, merged,
  deployed, hosted/playable, delivered, and released.

NEVER delete, reset, clean, overwrite, force-push, merge, publish, deploy,
release, send externally, or rewrite history without exact authority.

INPUTS
PROJECT_NAME=[value or AUTO]
REPOSITORY=[URL/path or AUTO]
ENGINE_STACK=[value or AUTO]
DEFAULT_BRANCH=[value or AUTO]
DEVELOPMENT_BRANCH=[value or NONE]
OWNER_ACTOR_IDS=[value or UNKNOWN]
DEPUTY_ACTOR_IDS=[value or UNKNOWN]
RELEASE_AUTHORITY=[value or UNKNOWN]
ACTIVE_TEAMS=[value or AUTO_MINIMAL]
RISK_PROFILE=[LOW|STANDARD|HIGH, default STANDARD]
PAGES_OWNER_HUD=[ENABLED|DISABLED, default ENABLED]
OWNER_COMMAND_PATH=[WORKFLOW_FORMS|GITHUB_APP, default WORKFLOW_FORMS]
PROVIDERS=[list or PROVIDER_NEUTRAL]
STARTUP_TOKEN_TARGET=[default 1200]
STARTUP_TOKEN_HARD_LIMIT=[default 1500]
BLOCKER_ROUTING_SLA_MINUTES=[default 5]

PHASE 0 — CONFIRM UNDERSTANDING
Before modifying anything:
1. Resolve the exact repository and read its specific instructions.
2. Inspect refs, dirty/untracked state, worktrees, engine/toolchain, tests, CI,
   Pages, branch protection where visible, and existing coordination artifacts.
3. Explain the intended architecture, assumptions, unknowns, proposed file
   changes, migration approach, and protected actions.
4. Ask only questions that materially change the architecture or authorization.
5. Stop for owner review if the request says review first.

PHASE 1 — BOUNDED INDEPENDENT REVIEW
If native subagents are available, request bounded independent reviews from:
- Deputy/IT Manager: execution authority, Git/ref ownership, integration;
- Data/System Architect: identity, schemas, migrations, durable state;
- PM: hierarchy, capacity, prioritization, denominator and escalation;
- only active Team Leads: domain-specific data needs and minimum gates;
- security/QA when relevant.

Each request must be <=500 tokens and ask for:
RETAIN | REMOVE | MINIMUM GATES | ROLE DATA/AUTHORITY | COLD START |
MATRICES | FAILURES/TESTS | MATERIAL SIMPLIFICATION.

Delegate only independent work. Do not multiply agents for sequential work,
shared mutable state, status theatre, or ACK collection. Central synthesis owns
the final design.

PHASE 2 — INSTALL THE CONTROL PLANE
Create a compact `.agentops/` framework using the repository's existing runtime
where practical:

/.agentops/
  BOOTSTRAP.md
  project.json
  governance/
    owner-intent.json
    hierarchy.json
    roles.json
    authority.json
    raci.json
    delegation.json
    escalation.json
    transitions.json
    information-access.json
    git-ownership.json
    qa.json
  work/<ticket-id>/CURRENT.json
  events/<ticket-id>/<event-id>.json
  evidence/<evidence-id>.json
  leases/<lease-id>.json
  schemas/*.schema.json
  generated/
  tools/opsctl.*
/site/
/.github/CODEOWNERS
/.github/workflows/agentops-validate.yml
/.github/workflows/owner-command.yml
/.github/workflows/pages.yml

Also create thin provider adapters:
- AGENTS.md: stable shared invariants and one resume command, <=300 tokens;
- CLAUDE.md: <=75-token import/wrapper with no copied policy;
- other adapters only when required and equally thin.

Use repository-relative POSIX paths. Absolute host paths are optional runtime
hints only and never durable authority.

PHASE 3 — OWNER INTENT AND DEPUTY AUTHORITY
Create a machine-readable Owner Intent Charter containing:
- mission and measurable end state;
- priority order and risk tolerance;
- non-negotiable invariants;
- default autonomy for reversible local work;
- owner actor identities;
- deputy grants with included and excluded actions, effective time, expiry,
  supersession, and source commit;
- protected decision classes;
- override recording and invalidation rules.

Within controlled systems, an exact Owner directive has highest project
authority. Record OWNER_OVERRIDE separately from the underlying evidence result.
Never fabricate PASS, impersonate an independent reviewer, bypass external
credentials/platform controls, or claim a technically impossible state.

Give the Deputy near-owner execution authority within the Charter. The Deputy
may assign/rebind work, issue/revoke leases, create isolated refs/worktrees,
resolve technical/routing deadlocks, accept bounded technical risk, integrate
within granted channels, and escalate genuine owner decisions. The Deputy may
not amend its own grant, silently change intent, suppress Owner overrides,
self-approve protected review, or delegate broader authority.

Implement non-amplifying delegation:
effective grant = delegator grant ∩ task ∩ resource/ref/path ∩ action ∩ time.

PHASE 4 — MATRICES
Implement schema-validated machine-readable matrices and deterministic human
views for:
1. hierarchy and escalation ownership;
2. role mission, competencies, may/must/must-not, approval ceiling;
3. authority: actor/role x resource x action x scope x expiry;
4. RACI with exactly one Accountable per deliverable/decision;
5. delegation depth, lease, first action, return and handoff;
6. escalation hazard, attempts, SLA, route, wake, continuing work;
7. lifecycle/evidence/delivery state transitions, guards and rollback;
8. evidence producer, exact object, verifier, freshness and invalidation;
9. information startup/on-demand/restricted/forbidden classes;
10. Git path/ref ownership, overlap, generated serialization and collision;
11. QA risk class, required suites, independence and waiver authority;
12. provider/device bootstrap and no-safe-action behavior.

Do not maintain duplicate Markdown and JSON authority. Markdown and Pages are
generated views of validated JSON.

PHASE 5 — MINIMUM GATES
Implement only three checkpoints:

GATE 0 START/CUSTODY (machine guard before mutation)
- exact work/object identity;
- scoped authority;
- repo/ref/base/head/tree or exported dirty custody;
- one writer lease and collision check;
- rollback/recovery pointer.

GATE 1 ACCEPT EXACT OBJECT (risk-selected checks)
- only applicable automated, technical, data, UX/accessibility/provenance,
  security, playtest, and independent QA checks;
- run independent checks in parallel unless data dependencies require order;
- bind every verdict to the exact object;
- changed identity invalidates only dependent evidence.

GATE 2 PROMOTE (protected shared/external effects)
- shared/generated integration or merge;
- destructive/irreversible data or schema migration;
- security/privacy/credentials/spending/external-send boundary;
- publication, deployment, playable delivery, tag and release.

Everything else defaults to PROCEED within scope. A failed check blocks only its
transition. Safe unrelated work continues.

PHASE 6 — WORK, EVENT, EVIDENCE AND LEASE MODEL
Use only five artifact classes:
1. ticket contract;
2. current work capsule;
3. append-only meaningful transition event;
4. exact evidence manifest/pointer;
5. generated dashboard projection.

Git ancestry is history. A receipt is an event or evidence manifest, not another
ledger. Do not create durable events for reads, polls, repeated ACKs, “still
working,” identical receipts, Pages rebuilds, or proposed assignments.

CURRENT.json must remain compact and contain:
schema/revision/current+parent hashes; ticket/row/lifecycle; objective; immediate
next action; repo/ref/full OID/tree and expected dirty/export state; owner/writer
lease and expiry; affected paths; evidence pointers; blocker owner/wake;
may/must-not authority and expiry; runtime/residue; rollback; invalidation keys.

One writer lease binds actor, issuer, ref, path globs, base OID, actions, issue
time, expiry and revocation. Use expected-old-value compare-and-swap for current
state/ref updates. Generic force push is forbidden. Exact force-with-lease may be
granted only for a named recovery action.

PHASE 7 — TOKEN/CONTEXT COMPILER
Implement `opsctl wake --actor <id> --work <id>` that validates repository state
without dumping it into model context and emits one disposable capsule:

IDENTITY | MISSION | WORK | DONE-WHEN | AUTHORITY | FORBIDDEN
REPO/REF/BASE | NEXT ACTION | STOP CONDITIONS | EVIDENCE
POINTERS (max 8) | SOURCE COMMIT | FRESHNESS | INVALIDATION

Initial engineering targets:
- startup target <=1,200 provider-counted input tokens; hard failure >1,500;
- current task snapshot <=400 tokens;
- routine owner digest <=250 tokens;
- owner decision brief <=500, exception max 800;
- subagent request/result <=500/800 plus raw evidence pointer;
- initial retrieval <=3 items and <=2,000 tokens;
- ordinary tool result <=1,500; hard cap 4,000; persist larger results and return
  <=300-token digest plus exact pointer;
- <=8 live memory pointers.

Retrieve by exact ID/path/hash first, keyword second, semantic fallback last.
Never recursively read all linked material. Default maximum is one extra hop.
Stable governance forms a cacheable prefix; dynamic task state is the suffix.
Do not put timestamps or volatile status in the stable prefix. Cache is an
optimization, not durable memory.

Never preload full backlog, portfolio, team state, history, receipts, raw chat,
raw tool logs, whole diffs, screenshot sets, binaries, unrelated code, secrets,
prompts, environment dumps, or personal data.

PHASE 8 — FIVE-MINUTE ROUTING AND AUTO-ESCALATION
Implement a configurable policy where no blocker remains inert or ownerless for
more than BLOCKER_ROUTING_SLA_MINUTES (default 5):
- agent records a typed blocker and continuing reversible work;
- Team Lead resolves or auto-delegates to an eligible collision-free seat;
- at 5 minutes, Deputy receives custody for reassignment/bounded resolution;
- at 10 minutes total without entered work, show DEPUTY_OVERDUE to Owner;
- owner-exclusive/safety/credential/irreversible/intent conflicts show
  NEEDS_OWNER_NOW immediately.

Elapsed time changes routing, never truth, evidence, or authority. Deduplicate
alerts by root cause and current hash. FYIs remain dashboard-only. Empty seats are
valid; do not invent work to satisfy a fixed team-size quota.

PHASE 9 — OWNER HUD ON GITHUB PAGES
Generate a polished responsive Owner HUD from validated repository state.
One-screen priority:
1. NEEDS YOU NOW;
2. DEPUTY OVERDUE;
3. milestone/outcome deltas;
4. promotion candidates and protected risks;
5. team load, writer leases, collisions and available capacity;
6. token/context/coordination efficiency.

Every status maps ticket -> actor -> task -> branch/PR -> full commit/tree ->
evidence -> decision. Show source commit, generated time, currentness and stale/
unknown state. Use progressive disclosure: decision card first, team/ticket
digest second, immutable evidence last.

Every decision card has concrete hazard, attempts, 2-3 mutually exclusive
options, recommendation, delay consequence, exact authority requested, rollback,
expiry/invalidation, verified time, and evidence links.

GitHub Pages is a redacted read-only projection and never stores write tokens.
For decisions, either:
A. open an authenticated prefilled GitHub workflow/issue form; or
B. call a separately deployed least-privilege GitHub App gateway.

The command processor accepts only enumerated actions: prioritize, delegate,
approve/reject/defer, issue/revoke lease, request revision, authorize integration,
authorize release, and record Owner override. It authenticates the actor,
validates permission/schema/allowlist, compares expected_current_hash and exact
candidate OID, records a dry-run summary, appends a decision event, CAS-updates
only affected state, obeys CODEOWNERS/branch protection/environments, rebuilds
Pages, and verifies readback. Stale decisions fail safely. No arbitrary shell
field is allowed.

Pages build receives contents:read. Deploy receives only pages:write and
id-token:write in a protected environment. Pin Actions to full SHAs, protect
workflow files, default GITHUB_TOKEN read-only, avoid privileged untrusted PR
execution, and publish only allowlisted redacted data.

PHASE 10 — TESTS AND EVALUATION
Implement schema, deterministic-view, pointer/hash, parent/CAS, duplicate-lease,
concurrent-writer, empty-transport, prompt-injection, secret/privacy,
least-authority, QA-independence, Pages-read-only, authenticated-command,
clean-clone, cross-provider/device, dirty-custody, rollback, and token-budget
tests.

Negative plants must fail only the affected transition:
missing pointer; hash mismatch; ref/head/tree drift; dirty-state drift; missing or
expired evidence; expired lease; duplicate writer; broken/ambiguous parent;
unknown enum/duplicate JSON key; path traversal; secret/private-data plant;
stale owner command; release object differing from accepted object.

Run >=30 representative/adversarial fixtures and >=3 trials per condition.
Compare against the old workflow and a single-agent baseline. Measure task
success, final environment state, evidence completeness, startup/total/cached/
reasoning/output tokens, peak context, files and tool-result tokens, retrieval
precision/recall, cache use, latency, cost, retries, alert precision, time to
first safe action, and coordination overhead.

Initial targets:
- zero authority violations;
- >=95% correct role/task/next action;
- >=95% required-evidence recall, >=80% precision;
- 40-60% median repository-token reduction with no material success regression;
- zero broad-history scans in ordinary cold start;
- one CAS winner and zero lost updates under >=50 same-state races;
- zero FYI pages and >=90% actionable Owner-alert precision.

Treat budgets as engineering hypotheses. Optimize only when task success and
evidence quality remain non-inferior.

PHASE 11 — MIGRATION
1. Inventory old roles, tickets, refs/worktrees, dirty custody, ledgers, receipts,
   evidence, dashboards and authority claims read-only.
2. Select one authoritative current record per work item; classify the rest as
   evidence, generated view, superseded or UNKNOWN.
3. Convert machine-local identity to remote/ref/full OID/repo-relative path/hash.
4. Create genesis capsules/events referencing old evidence without rewriting it.
5. Run old and new projections in shadow mode; reconcile every discrepancy.
6. Perform clean-clone cross-provider/device and negative-plant drills.
7. Obtain explicit cutover approval.
8. Replace legacy entrypoints with one migration pointer while preserving all
   history and rollback.

FINAL ACCEPTANCE
- complete context wipe resumes exact work with evidence loss0 and duplicate
  authority0;
- centralized intent and Deputy grants are exact and owner-overridable;
- decentralized teams proceed without routine gates;
- every protected transition has one Accountable actor and exact-object evidence;
- Owner HUD statuses trace to authoritative repository objects;
- Owner/deputy commands are authenticated, allowlisted, currentness-checked,
  audited and read back;
- runtime startup stays inside the measured budget;
- blocker routing exceeds no five-minute inert interval;
- views rebuild deterministically;
- history remains recoverable;
- no destructive migration, publication, merge or release occurs without its
  exact separate authority.

RETURN FOR OWNER REVIEW
OUTCOME
FILES CREATED/CHANGED
ARCHITECTURE AND TRADEOFFS
ROLE-REVIEW INPUTS
TOKEN BASELINE AND BUDGET RESULTS
TEST/EVAL EVIDENCE
OWNER HUD SECURITY MODEL
UNRESOLVED UNKNOWNS
MIGRATION/CUTOVER PLAN
PROTECTED ACTIONS NOT TAKEN
SMALLEST NEXT AUTHORITY NEEDED

Stop before routing, submission, remote branch creation, push, PR, Pages
publication, cutover, merge, deployment or release unless separately authorized.
```
