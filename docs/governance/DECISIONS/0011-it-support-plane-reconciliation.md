# 0011 — `it-support` two-plane reconciliation

- **Decision status:** **Approved.** Constantine ruled **Option A** on
  2026-08-31. Policy-effective when this independently reviewed head is contained
  in fresh canonical `dev` (same containment rule as 0001–0009).
- **Prepared by:** it-manager-iii (technical scope / architecture reconciliation,
  per AUTHORITY.md authority matrix).
- **Decided by:** Constantine (ratifies whether a governance role exists and how
  a live seat is governed); it-manager-iii executes the docs-plane edits.
- **Ticket:** [#422](https://github.com/cehinds/AshenSpire/issues/422).
- **Format:** AUTHORITY.md § *Decision and exception packets*
  (`EVIDENCE / OPTIONS / REC / NEXT / AUTH`). Options and evidence are retained
  below as the record; the ruling is stated under **RULING**.

## RULING

**Option A — keep `it-support`; represent it in the docs plane as the delivery
seat it is.** The machine plane (`roles.json`, `hierarchy.json`) is unchanged and
live seat **AS-HD-057 keeps its `it-support` seat and lease**. The docs plane is
brought into agreement by (1) one authority-matrix row in `AUTHORITY.md`
mirroring how `maker` is represented, and (2) one disambiguating sentence in
`TEAM-CHARTERS.md` separating the standing `it-support` delivery seat from the
retired `IT Support2/3` task names. Option B (fold into `maker` + re-seat
AS-HD-057) was not chosen.

---

## EVIDENCE

Checked at `dev` = `HEAD` = `1f7ab2d889b8ce6bbf1d9a471f593c566829ea0f`
(#422 was written against `96c2c7f9`; the contradiction it describes still
holds at this head). `opsctl verify` = `VERIFY OK`. All planes at
`policy_version: 1.0.0`.

**`it-support` is a standing role in the machine plane.**

- `.agentops/governance/roles.json` — full mandate:
  - `mission`: "Restore the ability to work: repair local tooling, environment,
    routing and access blockers, and return exact evidence of the repair."
  - `may`: `repair-local-tooling-and-environment`, `restore-routing-and-access`,
    `return-exact-support-evidence`
  - `must_not`: `push-pr-merge-deploy-or-release`,
    `change-product-behaviour-to-clear-a-blocker`,
    `override-an-independent-qa-verdict`
  - `approval_ceiling`: "May restore capability only. Any repair that would
    change what the work produces, or that needs a protected transition, is
    escalated to it-manager-iii …"
- `.agentops/governance/hierarchy.json` — carried in two places:
  - a node (`actor_id: it-support`, `escalation_parent: it-manager-iii`,
    `owns_escalations: [tooling-failure, environment-or-access-blocker,
    routing-outage]`);
  - authority tier **p4 "Delivery seats"**, listed alongside `maker`, with
    `cannot: [claiming an overlapping path or ref; push, PR, merge, deploy or
    release; changing product behaviour to clear a blocker]`.

**The docs plane does not carry it as a standing role.**

- `docs/governance/AUTHORITY.md` § *Permanent control plane* names five entries
  — Help Desk, Project Management Lead, Data Architecture & Systems Lead,
  IT Manager III, Constantine. No `it-support` bullet; no `it-support` row in
  the authority matrix.
- `docs/governance/TEAM-CHARTERS.md` (line 40) mentions the token once, to deny
  it: "`App Team2`, `IT Support2`, and `IT Support3` are legacy task names, not
  standing organizations."

**The role is live.** `.agentops/work/AS-HD-057/CURRENT.json`:
`owner_actor: it-support`, `lifecycle_state: assigned`,
`affected_paths: ["tools/**"]`, `writer_lease: lease-AS-HD-057-it-support`,
`ref: recovery/as-hd-057`.

**Neither plane outranks the other.** `docs/governance/README.md` § *Typed truth*
assigns "Policy and contracts" to "Versioned repository documents"; both planes
are versioned repository documents at `1.0.0`. So precedence cannot resolve this
— it needs a decision.

### Framing correction to #422 (material)

#422 offers "add it to the `AUTHORITY.md` control plane" as one arm. That arm is
imprecise: `it-support` is a **p4 delivery seat**, and its peer `maker` is **also
absent** from the *Permanent control plane* bullets — `maker` is represented in
the docs plane only through **authority-matrix rows** ("Implement locally —
Named maker/pod lead"), not as a coordination-authority bullet. The *Permanent
control plane* section is for standing coordination/authority roles, which a
delivery seat is not. So the real drift is narrower than "it is missing from the
control plane": **`it-support` has no authority-matrix row at all, while its
tier-peer `maker` does.** Option A below is therefore scoped to the matrix +
charter, not to the control-plane bullet list.

---

## OPTIONS

### Option A — Keep `it-support`; represent it in the docs plane as the delivery seat it is

Machine plane unchanged. In the docs plane:

1. **Add one authority-matrix row** in `AUTHORITY.md`, mirroring how `maker` is
   represented, e.g.:
   `| Repair local tooling, environment, routing, or access without changing
   what the work produces | it-support delivery seat | Reproduced blocker,
   exact repair evidence; escalate to IT Manager III for any protected
   transition or product-behaviour change. |`
2. **Disambiguate the charter line** in `TEAM-CHARTERS.md` so the current
   `it-support` *delivery role* is not read as one of the retired *task names*
   ("IT Support2 / IT Support3"). One sentence: the standing `it-support`
   delivery seat is distinct from the legacy `IT Support2/3` task names.
3. Append this record as the approved decision; AS-HD-057 keeps its seat and
   lease unchanged.

- **Pros:** no re-seat, no lease churn, no capsule re-seal; AS-HD-057 keeps
  working; makes the human-facing ceiling explicit for a seat that currently has
  none. Smallest change to reach consistency.
- **Cons:** grows the standing role set (owner has elsewhere favoured folding
  roles into levels/pods rather than adding standing ones); leaves two delivery
  seats (`maker`, `it-support`) where one tier might do.

### Option B — Remove `it-support` from the machine plane; fold its mandate into `maker`; re-seat AS-HD-057

1. Remove the `it-support` block from `roles.json` and both its appearances in
   `hierarchy.json` (the node and the p4 tier entry), leaving `maker` as the sole
   p4 delivery seat. The `it-support` mandate (repair tooling/env/routing/access,
   return exact evidence, no protected transitions) is already inside `maker`'s
   tier `cannot` set, so folding it is a near-superset, not a widening of
   authority.
2. **Re-seat AS-HD-057** under a role present in both planes (`maker`), re-issuing
   `lease-AS-HD-057-*` and re-sealing the capsule through the tooling — never by
   editing `current_hash` by hand. `affected_paths: ["tools/**"]` and objective
   unchanged.
3. `TEAM-CHARTERS.md` needs no change: with the role gone, the "legacy task
   names" line is once again the only mention and is correct.
4. Append this record as the approved decision.

- **Pros:** shrinks the standing role set; removes the drift at its source; one
  delivery seat instead of two overlapping ones; aligns with a fold-not-add
  posture.
- **Cons:** touches a **live** seat — requires an authorised re-seat and capsule
  re-seal (bounded technical risk, recorded evidence); loses `it-support` as a
  distinct escalation owner (`tooling-failure` / `environment-or-access-blocker`
  / `routing-outage` would move to `maker` or ITM3).

---

## REC

**Option A**, with the framing correction applied (matrix row + charter
disambiguation, not a control-plane bullet).

Rationale: it removes the contradiction with the least blast radius, touches no
live seat and no capsule seal, and closes the actual gap — a delivery seat with a
machine-side ceiling but no human-facing matrix row. The role is already load-
bearing (AS-HD-057 is assigned against it), and Option A codifies what exists
rather than migrating a live seat. Option B is the right call only if the owner
wants the standing role set actively reduced and accepts the re-seat cost; if so,
Option B is clean because the mandate is already a subset of `maker`'s tier.

Not chosen: #422's literal "add to the permanent control plane" — a delivery seat
does not belong in the coordination-authority bullet list.

---

## NEXT (smallest action after the ruling)

- **If A:** ITM3 (docs lane) edits `AUTHORITY.md` (one matrix row) and
  `TEAM-CHARTERS.md` (one disambiguating sentence); set this record's status to
  Approved and add its index row; `opsctl render` → `verify` + `--selftest` +
  `drill`; integrate to `dev` via a reviewable draft PR. No machine-plane edit.
- **If B:** a maker seat removes the `roles.json` / `hierarchy.json` entries
  under an ITM3 lease; ITM3 re-seats AS-HD-057 onto `maker` and re-seals the
  capsule through the tooling; regenerate views; same verify/selftest/drill gate;
  integrate via draft PR.

Either path is ITM3-lane authoring plus (for B) a maker edit; **neither touches
`main`/`release`**, and both land through a reviewable draft PR to `dev` for the
owner to merge.

---

## AUTH

- **Preparing this packet:** no new authority (ITM3 technical-reconciliation
  scope, AUTHORITY.md matrix).
- **Ruling between A and B:** Constantine's ratification is requested, because
  the choice sets whether a governance role exists and re-homes authority over a
  live seat.
- **Executing the chosen option:** standing ITM3 authoring authority for the
  docs/machine edits, plus — for B only — an ITM3-issued writer lease for the
  maker edit and the AS-HD-057 re-seat. Integration is the normal
  `integrate-to-dev-via-pr` authority. **No** push/merge to `main`/`release`,
  tag, publish, Pages, or deploy authority is claimed or implied.
