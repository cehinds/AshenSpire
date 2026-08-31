#!/usr/bin/env node
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquireClaimLock, sealClaim, sealLease, seatFingerprint, validateClaim, validateLease } from "./pipeline-seat-claims.mjs";
import { globCovers } from "./opsctl.mjs";

export const ABSENT_RUNTIME_HASH = "sha256:0c75dd129111d9ed532bb6314bb6b2a84d308faf85e36988935d7526f559f2a1";
const ZERO_OID = "0".repeat(40);
const OID = /^[0-9a-f]{40}$/;
const TICKET = /^#[1-9][0-9]*$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const digest = (value) => `sha256:${crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(canonical(value))).digest("hex")}`;
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function git(root, args, allowFailure = false) {
  try { return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", windowsHide: true }).trim(); }
  catch (error) { if (allowFailure) return null; throw new Error(`git ${args.join(" ")} failed: ${String(error.stderr || error.message).trim()}`); }
}

function inside(root, candidate) {
  const exact = path.resolve(root), resolved = path.resolve(candidate);
  return resolved === exact || resolved.startsWith(`${exact}${path.sep}`);
}

function samePath(left, right) {
  const resolvedLeft = path.resolve(left), resolvedRight = path.resolve(right);
  const a = fs.existsSync(resolvedLeft) ? fs.realpathSync.native(resolvedLeft) : resolvedLeft;
  const b = fs.existsSync(resolvedRight) ? fs.realpathSync.native(resolvedRight) : resolvedRight;
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function assertPhysicalRuntime(runtime) {
  fs.mkdirSync(runtime, { recursive: true });
  const real = fs.realpathSync.native(runtime);
  const symbolic = fs.lstatSync(runtime).isSymbolicLink();
  if (!samePath(real, runtime) || symbolic) throw new Error(`canonical Git-local bootstrap runtime is reparse-backed (runtime=${runtime}, real=${real}, symbolic=${symbolic})`);
}

export function resolveBootstrapRuntime(repoRoot) {
  const common = git(repoRoot, ["rev-parse", "--git-common-dir"]);
  const commonPath = path.isAbsolute(common) ? common : path.resolve(repoRoot, common);
  return path.join(commonPath, "agentops-pipeline", "runtime");
}

function authorityFiles(runtime) {
  const roots = ["registry.json", "seat-runtime.json", "claims", "leases", "events", "override-receipts"];
  const files = [];
  const visit = (absolute, relative) => {
    if (!fs.existsSync(absolute)) return;
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`runtime authority path is reparse-backed: ${relative}`);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) visit(path.join(absolute, entry.name), path.join(relative, entry.name));
    } else if (stat.isFile()) files.push(relative.replaceAll("\\", "/"));
  };
  for (const root of roots) visit(path.join(runtime, root), root);
  return files;
}

export function runtimeAuthorityHash(runtime) {
  const files = authorityFiles(runtime);
  if (!files.length) return ABSENT_RUNTIME_HASH;
  return digest(files.map((relative) => ({ relative, sha256: digest(fs.readFileSync(path.join(runtime, relative))) })));
}

function readJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { throw new Error(`${label} is unavailable or invalid: ${error.message}`); }
}

function overlaps(left, right) {
  return left.some((a) => right.some((b) => globCovers(a, b) || globCovers(b, a)));
}

function writeExact(file, content, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    if (!Buffer.from(fs.readFileSync(file)).equals(Buffer.from(content))) throw new Error(`bootstrap recovery conflicts with durable file ${file}`);
    return;
  }
  const temp = `${file}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  fs.writeFileSync(temp, content, { flag: "wx", mode });
  fs.renameSync(temp, file);
}

function completeJournal(runtime, journal) {
  if (journal?.schema !== "agentops/seat-bootstrap-journal/v1" || !Array.isArray(journal.files) || !journal.params_hash) throw new Error("seat bootstrap journal is corrupt or foreign");
  for (const entry of journal.files) {
    if (!entry || typeof entry.relative !== "string" || typeof entry.content !== "string") throw new Error("seat bootstrap journal contains an invalid file entry");
    const target = path.resolve(runtime, entry.relative);
    if (!inside(runtime, target)) throw new Error("seat bootstrap journal escaped the canonical runtime");
    writeExact(target, entry.content, entry.secret ? 0o600 : 0o600);
  }
}

function verifyOverride(repoRoot, options) {
  const eventFile = path.resolve(repoRoot, options.overrideEventFile);
  if (!inside(path.join(repoRoot, ".agentops", "events"), eventFile)) throw new Error("owner override event must stay under .agentops/events");
  const bytes = fs.readFileSync(eventFile);
  if (digest(bytes) !== options.overrideEventHash) throw new Error("owner override event hash mismatch");
  const event = JSON.parse(bytes.toString("utf8"));
  if (event.kind !== "owner-decision" || event.actor !== "owner" || event.decision?.action !== "record-owner-override" || event.id !== options.overrideEventId) throw new Error("owner override event is not an authenticated record-owner-override decision");
  const required = [
    `epoch=${options.epoch}`,
    `expires=${options.overrideExpiry}`,
    `source_ref=${options.sourceRef}`,
    `source_oid=${options.sourceOid}`,
    `target_ref=${options.ref}`,
    `base_oid=${options.developmentBaseOid}`,
    "live watcher create-seat/create-claim prohibition remains unchanged",
  ];
  for (const token of required) if (!event.summary.includes(token)) throw new Error(`owner override event does not bind ${token}`);
  if (Date.parse(options.now) >= Date.parse(options.overrideExpiry)) throw new Error("owner override expired before bootstrap sealing");
  return event;
}

function verifyTrackedLegacyTransition(repoRoot) {
  const oldLease = readJson(path.join(repoRoot, ".agentops", "leases", "lease-AS-1001-maker.json"), "legacy tracked lease");
  const nextLease = readJson(path.join(repoRoot, ".agentops", "leases", "lease-AS-1001-maker-r2.json"), "replacement tracked lease");
  const capsule = readJson(path.join(repoRoot, ".agentops", "work", "AS-1001", "CURRENT.json"), "AS-1001 capsule");
  if (!oldLease.revoked || nextLease.revoked || capsule.writer_lease !== nextLease.id) throw new Error("legacy tracked lease overlap has not completed its forward transition");
  if (oldLease.path_globs.includes(".agentops/tools/**") !== true || nextLease.path_globs.some((glob) => globCovers(glob, ".agentops/tools/pipeline-seat-bootstrap.mjs"))) throw new Error("legacy tracked tooling overlap is not released");
  return { old_lease_id: oldLease.id, replacement_lease_id: nextLease.id, capsule_hash: capsule.current_hash };
}

function validateOptions(options) {
  if (!TICKET.test(options.ticket || "")) throw new Error("bootstrap ticket must be a canonical #number identity");
  if (!SLUG.test(options.role || "") || !SLUG.test(options.team || "")) throw new Error("bootstrap role and team must be provider-neutral slugs");
  if (options.role !== "it-manager-iii" || options.team !== "it-manager-iii") throw new Error("this one-time primitive is scoped only to the IT Manager III bootstrap seat");
  for (const [label, value] of [["source OID", options.sourceOid], ["target ref OID", options.expectedRefOid], ["development base OID", options.developmentBaseOid]]) if (!OID.test(value || "")) throw new Error(`${label} must be a full Git OID`);
  if (options.expectedNewRefOldOid !== ZERO_OID) throw new Error("initial bootstrap ref must be bound to the zero expected-old OID");
  if (!Number.isInteger(options.epoch) || options.epoch !== 1) throw new Error("initial bootstrap epoch must be 1");
  if (!Array.isArray(options.pathGlobs) || !options.pathGlobs.length || !Array.isArray(options.resources) || !options.resources.length) throw new Error("bootstrap requires exact paths and resources");
  if (!Number.isFinite(Date.parse(options.now)) || !Number.isFinite(Date.parse(options.expiry)) || Date.parse(options.expiry) <= Date.parse(options.now)) throw new Error("bootstrap claim window is invalid");
  if (Date.parse(options.expiry) > Date.parse(options.overrideExpiry)) throw new Error("bootstrap claim may not outlive the temporary override");
}

export function bootstrapSeatClaim(repoRoot, options) {
  repoRoot = path.resolve(repoRoot);
  validateOptions(options);
  if (git(repoRoot, ["rev-parse", options.ref]) !== options.expectedRefOid) throw new Error("target ref moved from its expected OID");
  if (git(repoRoot, ["rev-parse", options.sourceRef]) !== options.sourceOid) throw new Error("source scheduler ref moved from its expected OID");
  if (git(repoRoot, ["merge-base", "--is-ancestor", options.sourceOid, options.expectedRefOid], true) === null) throw new Error("bootstrap ref no longer descends from the exact scheduler candidate");
  if (git(repoRoot, ["merge-base", "--is-ancestor", options.developmentBaseOid, options.expectedRefOid], true) === null) throw new Error("development base is not an ancestor of the scheduler candidate");
  const override = verifyOverride(repoRoot, options);
  const legacy = verifyTrackedLegacyTransition(repoRoot);
  const runtime = path.resolve(options.runtimeRoot || resolveBootstrapRuntime(repoRoot));
  assertPhysicalRuntime(runtime);
  const lockFile = path.join(runtime, "bootstrap-transaction.lock");
  const journalFile = `${lockFile}.journal.json`;
  const paramsHash = digest({ ...options, runtimeRoot: runtime });
  const lock = acquireClaimLock(lockFile);
  try {
    if (fs.existsSync(journalFile)) {
      const pending = readJson(journalFile, "seat bootstrap journal");
      if (pending.params_hash !== paramsHash) throw new Error("seat bootstrap recovery parameters do not match the pending transaction");
      completeJournal(runtime, pending);
      fs.unlinkSync(journalFile);
      return { ...pending.result, status: "RECOVERED" };
    }
    const actualRuntimeHash = runtimeAuthorityHash(runtime);
    if (actualRuntimeHash !== options.expectedRuntimeHash) throw new Error(`stale bootstrap runtime CAS: expected ${options.expectedRuntimeHash}, found ${actualRuntimeHash}`);
    const claimDir = path.join(runtime, "claims");
    const activeClaims = fs.existsSync(claimDir) ? fs.readdirSync(claimDir).filter((name) => name.endsWith(".json")).map((name) => validateClaim(readJson(path.join(claimDir, name), "active claim"))) : [];
    for (const claim of activeClaims) {
      if (claim.ticket === options.ticket) throw new Error("duplicate active claim for bootstrap ticket");
      if (claim.ref === options.ref || overlaps(claim.path_globs, options.pathGlobs)) throw new Error("bootstrap path or ref collision");
    }

    const seatUuid = crypto.randomUUID();
    const seatId = `seat:${options.team}:${seatUuid}`;
    const capabilityFile = `secrets/${options.role}-${seatUuid}.cap`;
    const capability = crypto.randomBytes(48).toString("base64url");
    const capabilityFingerprint = seatFingerprint(capability);
    const leaseId = `lease-issue-${options.ticket.slice(1)}-scheduler-epoch-${options.epoch}`;
    const claim = sealClaim({
      schema: "agentops/seat-claim/v1", revision: 1, parent_hash: null,
      ticket: options.ticket, seat_id: seatId, lease_id: leaseId, ref: options.ref,
      base_oid: options.expectedRefOid, development_base_oid: options.developmentBaseOid,
      epoch: options.epoch, path_globs: options.pathGlobs, resources: options.resources,
      issued: options.now, expiry: options.expiry, status: "active",
      fencing: { expected_ref_oid: options.expectedRefOid, expected_runtime_hash: options.expectedRuntimeHash },
    });
    const lease = sealLease({
      schema: "agentops/seat-lease/v1", revision: 1, parent_hash: null,
      id: leaseId, actor: options.role, issuer: "it-manager-iii", ticket: options.ticket,
      seat_id: seatId, ref: options.ref, base_oid: options.expectedRefOid,
      development_base_oid: options.developmentBaseOid, epoch: options.epoch,
      path_globs: options.pathGlobs, resources: options.resources,
      actions: ["bootstrap-scheduler-control-plane-locally"], issued: options.now,
      expiry: options.expiry, revoked: false,
      fencing: { expected_ref_oid: options.expectedRefOid, expected_runtime_hash: options.expectedRuntimeHash },
    });
    validateClaim(claim);
    validateLease(lease, claim, options.now);
    if (claim.base_oid !== lease.base_oid || claim.epoch !== lease.epoch || JSON.stringify(claim.resources) !== JSON.stringify(lease.resources)) throw new Error("bootstrap claim and lease are incongruent");

    const eventBody = {
      schema: "agentops/seat-claim-event/v1", ticket: options.ticket,
      kind: "claim-bootstrapped", actor: "it-manager-iii", seat_id: seatId,
      claim_hash: claim.current_hash, lease_hash: lease.current_hash,
      previous_event_hash: null, occurred_at: options.now, epoch: options.epoch,
      override_event: options.overrideEventId,
    };
    const event = { ...eventBody, event_hash: digest(eventBody) };
    const registry = { schema: "agentops/seat-registry/v1", seats: { [seatId]: { role: options.role, status: "active", path_globs: options.pathGlobs, capability_fingerprint: capabilityFingerprint } } };
    const runtimeConfig = {
      schema: "agentops/seat-runtime/v1", issuer_role: "it-manager-iii",
      lease_seconds: Math.floor((Date.parse(options.expiry) - Date.parse(options.now)) / 1000),
      registry_file: "registry.json", claims_dir: "claims", leases_dir: "leases",
      events_dir: "events", lock_file: "claim-transaction.lock",
      seats: { [options.role]: { seat_id: seatId, capability_file: capabilityFile } },
    };
    const receiptUnsigned = {
      schema: "agentops/owner-override-bootstrap-receipt/v1",
      receipt_id: `OWNER_OVERRIDE-${options.overrideEventId}-epoch-${options.epoch}`,
      status: "consumed", action: "provision-initial-scheduler-seat-claim",
      override_event: options.overrideEventId, override_event_hash: options.overrideEventHash,
      override_expires: options.overrideExpiry, consumed_at: options.now, epoch: options.epoch,
      source_ref: options.sourceRef, source_oid: options.sourceOid,
      target_ref: options.ref, target_ref_oid: options.expectedRefOid,
      target_ref_expected_old_oid: options.expectedNewRefOldOid,
      development_base_oid: options.developmentBaseOid,
      runtime_expected_old_hash: options.expectedRuntimeHash,
      ticket: options.ticket, seat_id: seatId, claim_hash: claim.current_hash,
      lease_id: leaseId, lease_hash: lease.current_hash,
      paths: options.pathGlobs, resources: options.resources,
      legacy_transition: legacy,
      capability_fingerprint: capabilityFingerprint,
      prohibition_preserved: "live watcher may not create a claim or seat identity",
    };
    const receipt = { ...receiptUnsigned, receipt_hash: digest(receiptUnsigned) };
    const result = {
      status: "BOOTSTRAPPED", seat_id: seatId, ticket: options.ticket,
      claim_hash: claim.current_hash, lease_id: leaseId, lease_hash: lease.current_hash,
      ref: options.ref, base_oid: options.expectedRefOid, development_base_oid: options.developmentBaseOid,
      epoch: options.epoch, expiry: options.expiry, paths: options.pathGlobs,
      resources: options.resources, override_receipt: receipt.receipt_id,
      override_receipt_hash: receipt.receipt_hash,
    };
    const files = [
      { relative: capabilityFile, content: `${capability}\n`, secret: true },
      { relative: "registry.json", content: json(registry) },
      { relative: "seat-runtime.json", content: json(runtimeConfig) },
      { relative: `claims/${options.ticket}.json`, content: json(claim) },
      { relative: `leases/${leaseId}.json`, content: json(lease) },
      { relative: `events/${options.ticket}/000001.json`, content: json(event) },
      { relative: `override-receipts/${receipt.receipt_id}.json`, content: json(receipt) },
    ];
    const journal = { schema: "agentops/seat-bootstrap-journal/v1", params_hash: paramsHash, files, result };
    writeExact(journalFile, json(journal));
    if (options.failAfterJournal) throw new Error("simulated crash after bootstrap journal");
    completeJournal(runtime, journal);
    fs.unlinkSync(journalFile);
    return result;
  } finally { lock.release(); }
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`invalid argument near ${key || "<end>"}`);
    values[key.slice(2)] = value;
  }
  const split = (value) => value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return {
    ticket: values.ticket, role: values.role, team: values.team, ref: values.ref,
    sourceRef: values["source-ref"], sourceOid: values["source-oid"],
    expectedRefOid: values["expected-ref-oid"], expectedNewRefOldOid: values["expected-new-ref-old-oid"],
    developmentBaseOid: values["development-base-oid"], expectedRuntimeHash: values["expected-runtime-hash"],
    epoch: Number(values.epoch), now: values.now, expiry: values.expiry,
    overrideExpiry: values["override-expiry"], overrideEventId: values["override-event-id"],
    overrideEventFile: values["override-event-file"], overrideEventHash: values["override-event-hash"],
    pathGlobs: split(values.paths || ""), resources: split(values.resources || ""),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = bootstrapSeatClaim(process.cwd(), parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`BOOTSTRAP FAILED: ${error.message}\n`);
    process.exitCode = 1;
  }
}
