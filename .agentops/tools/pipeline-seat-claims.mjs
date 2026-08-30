#!/usr/bin/env node
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { globCovers } from "./opsctl.mjs";

const seatPattern = /^seat:[a-z0-9-]+:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const digest = (value) => `sha256:${crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(canonical(value))).digest("hex")}`;

export function seatFingerprint(capability) {
  if (typeof capability !== "string" || capability.length < 32) throw new Error("seat capability must contain at least 32 characters");
  return digest(capability);
}

export function sealClaim(body) {
  const unsigned = { ...body };
  delete unsigned.current_hash;
  return { ...unsigned, current_hash: digest(unsigned) };
}

export function sealLease(body) {
  const unsigned = { ...body };
  delete unsigned.current_hash;
  return { ...unsigned, current_hash: digest(unsigned) };
}

export function validateClaim(claim) {
  if (claim?.schema !== "agentops/seat-claim/v1" || !seatPattern.test(claim.seat_id || "")) throw new Error("invalid seat claim identity");
  if (!claim.ticket || !claim.lease_id || !claim.ref || !Array.isArray(claim.path_globs) || !claim.path_globs.length || !Number.isInteger(claim.revision) || claim.revision < 1 || claim.status !== "active" || !Number.isFinite(Date.parse(claim.issued)) || !Number.isFinite(Date.parse(claim.expiry))) throw new Error("incomplete seat claim");
  if (sealClaim(claim).current_hash !== claim.current_hash) throw new Error("seat claim seal mismatch");
  return claim;
}

function overlaps(left, right) {
  return left.some((a) => right.some((b) => globCovers(a, b) || globCovers(b, a)));
}

export function validateLease(lease, claim, now, allowExpired = false) {
  if (lease?.schema !== "agentops/seat-lease/v1" || sealLease(lease).current_hash !== lease.current_hash) throw new Error("invalid or unsealed current lease");
  if (!Number.isInteger(lease.revision) || lease.revision < 1 || !lease.actor || lease.issuer !== "it-manager-iii" || !Number.isFinite(Date.parse(lease.issued)) || !Number.isFinite(Date.parse(lease.expiry))) throw new Error("lease identity and currentness are incomplete");
  if (lease.id !== claim.lease_id || lease.ticket !== claim.ticket || lease.seat_id !== claim.seat_id || lease.ref !== claim.ref || lease.expiry !== claim.expiry || lease.revoked || (!allowExpired && Date.parse(lease.expiry) <= Date.parse(now)) || JSON.stringify(lease.path_globs) !== JSON.stringify(claim.path_globs)) throw new Error("lease is stale, revoked, expired, or does not bind the claim");
  return lease;
}

export function transferClaim({ claim, lease, expectedHash, targetSeat, targetCapability, seatRegistry, issuerRole, now, expiry, activeClaims, eventTail = null, kind = "claim-transferred" }) {
  validateClaim(claim);
  validateLease(lease, claim, now, kind === "expired-claim-recovered");
  if (expectedHash !== claim.current_hash) throw new Error("stale or replayed claim CAS");
  if (issuerRole !== "it-manager-iii") throw new Error("claim transfer requires IT Manager III");
  if (!seatPattern.test(targetSeat || "")) throw new Error("invalid target seat");
  if (targetSeat === claim.seat_id) throw new Error("self-transfer is not a claim transfer");
  const registered = seatRegistry?.[targetSeat];
  if (!registered || registered.status !== "active" || registered.role !== lease.actor || seatFingerprint(targetCapability) !== registered.capability_fingerprint) throw new Error("target seat proof failed against trusted registry");
  const nowMs = Date.parse(now), expiryMs = Date.parse(expiry);
  if (!Number.isFinite(nowMs) || !Number.isFinite(expiryMs) || expiryMs <= nowMs) throw new Error("invalid transfer window");
  if (!Array.isArray(activeClaims)) throw new Error("authoritative active-claim denominator is required");
  for (const other of activeClaims) {
    validateClaim(other);
    if (other.ticket === claim.ticket) throw new Error("duplicate active claim for ticket");
    if (other.ref === claim.ref || overlaps(other.path_globs, claim.path_globs)) throw new Error("duplicate writer path or ref collision");
  }
  const next = sealClaim({ ...claim, revision: claim.revision + 1, parent_hash: claim.current_hash, seat_id: targetSeat, issued: now, expiry, status: "active" });
  const nextLease = sealLease({ ...lease, revision: lease.revision + 1, parent_hash: lease.current_hash, seat_id: targetSeat, issued: now, expiry });
  const eventBody = { schema: "agentops/seat-claim-event/v1", ticket: claim.ticket, kind, actor: issuerRole, seat_id: targetSeat, claim_hash: next.current_hash, previous_event_hash: eventTail, occurred_at: now };
  return { claim: next, lease: nextLease, event: { ...eventBody, lease_hash: nextLease.current_hash, event_hash: digest({ ...eventBody, lease_hash: nextLease.current_hash }) } };
}

export function recoverExpiredClaim(args) {
  if (Date.parse(args.now) <= Date.parse(args.claim.expiry)) throw new Error("claim is not expired");
  return transferClaim({ ...args, kind: "expired-claim-recovered" });
}

export function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(temp, file);
}

export function processStartIdentity(pid) {
  if (!Number.isInteger(pid) || pid < 1) return null;
  try {
    if (process.platform === "win32") {
      const shell = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
      const script = `$p=Get-CimInstance Win32_Process -Filter \"ProcessId = ${pid}\" -ErrorAction Stop; if ($null -ne $p) { $p.CreationDate.ToUniversalTime().ToString(\"o\") }`;
      const value = execFileSync(shell, ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", windowsHide: true }).trim();
      return value ? `windows:${value}` : null;
    }
    if (process.platform === "linux") {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8"), close = stat.lastIndexOf(")"), fields = stat.slice(close + 2).trim().split(/\s+/);
      const boot = fs.readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
      return fields[19] && boot ? `linux:${boot}:${fields[19]}` : null;
    }
    const value = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8" }).trim();
    return value ? `${process.platform}:${value}` : null;
  } catch { return null; }
}

function lockOwner(identityLookup = processStartIdentity) {
  const identity = identityLookup(process.pid);
  if (!identity) throw new Error("claim transaction cannot establish current process identity");
  return { schema: "agentops/claim-lock/v1", pid: process.pid, process_identity: identity, process_started_at: new Date(Date.now() - process.uptime() * 1000).toISOString(), nonce: crypto.randomBytes(16).toString("hex"), acquired_at: new Date().toISOString() };
}

function validateLockOwner(owner) {
  if (owner?.schema !== "agentops/claim-lock/v1" || !Number.isInteger(owner.pid) || owner.pid < 1 || typeof owner.process_identity !== "string" || owner.process_identity.length < 8 || !Number.isFinite(Date.parse(owner.process_started_at)) || !/^[a-f0-9]{32}$/.test(owner.nonce || "") || !Number.isFinite(Date.parse(owner.acquired_at))) throw new Error("claim transaction lock owner is corrupt or foreign");
  return owner;
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) {
    if (error.code === "ESRCH") return false;
    if (error.code === "EPERM") return true;
    throw error;
  }
}

export function acquireClaimLock(lockFile, identityLookup = processStartIdentity) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const owner = lockOwner(identityLookup);
  let staleFile = null, staleOwner = null;
  try {
    fs.writeFileSync(lockFile, `${JSON.stringify(owner)}\n`, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    let stale;
    try { stale = validateLockOwner(JSON.parse(fs.readFileSync(lockFile, "utf8"))); } catch (invalid) { throw new Error(`claim transaction locked fail-closed: ${invalid.message}`); }
    if (pidAlive(stale.pid)) {
      const currentIdentity = identityLookup(stale.pid);
      if (!currentIdentity) throw new Error(`claim transaction lock identity for live pid ${stale.pid} is unverifiable`);
      if (currentIdentity === stale.process_identity) throw new Error(`claim transaction locked by live pid ${stale.pid}`);
    }
    staleOwner = stale;
    staleFile = `${lockFile}.stale-${stale.nonce}.json`;
    try { fs.renameSync(lockFile, staleFile); } catch (race) { throw new Error(`claim transaction stale-lock takeover lost: ${race.code}`); }
    try { fs.writeFileSync(lockFile, `${JSON.stringify(owner)}\n`, { flag: "wx" }); } catch (race) { throw new Error(`claim transaction takeover collision: ${race.code}`); }
    try { fs.unlinkSync(staleFile); } catch { /* stale owner metadata is harmless after the new lock is held */ }
  }
  return {
    owner, staleOwner,
    release() {
      if (!fs.existsSync(lockFile)) return;
      const current = validateLockOwner(JSON.parse(fs.readFileSync(lockFile, "utf8")));
      if (current.nonce !== owner.nonce || current.pid !== owner.pid) throw new Error("claim transaction lock ownership changed before release");
      fs.unlinkSync(lockFile);
    },
  };
}

function validateJournal(pending, expected, previousEventHash, staleOwner = null) {
  if (pending?.schema !== "agentops/claim-transaction-journal/v1" || !pending.result?.claim || !pending.result?.lease || !pending.result?.event) throw new Error("claim transaction journal is corrupt or foreign");
  for (const key of ["claimFile", "leaseFile", "eventDir"]) if (path.resolve(pending[key] || "") !== path.resolve(expected[key])) throw new Error("claim transaction journal target mismatch");
  validateClaim(pending.result.claim);
  const canonicalEventFile = path.join(expected.eventDir, `${String(pending.result.claim.revision).padStart(6, "0")}.json`);
  if (pending.eventFile !== canonicalEventFile || path.resolve(pending.eventFile) !== path.resolve(canonicalEventFile)) throw new Error("claim transaction journal event target mismatch");
  validateLease(pending.result.lease, pending.result.claim, pending.result.lease.issued, true);
  const journalOwner = validateLockOwner(pending.lock_owner);
  if (staleOwner && (journalOwner.pid !== staleOwner.pid || journalOwner.nonce !== staleOwner.nonce || journalOwner.process_identity !== staleOwner.process_identity)) throw new Error("claim transaction journal does not bind the recovered stale owner");
  const { event_hash: eventHash, ...eventBody } = pending.result.event;
  if (eventBody.schema !== "agentops/seat-claim-event/v1" || !["claim-transferred", "expired-claim-recovered"].includes(eventBody.kind) || eventBody.actor !== "it-manager-iii" || eventBody.ticket !== pending.result.claim.ticket || eventBody.seat_id !== pending.result.claim.seat_id || eventBody.occurred_at !== pending.result.claim.issued || eventBody.occurred_at !== pending.result.lease.issued || !Number.isFinite(Date.parse(eventBody.occurred_at)) || digest(eventBody) !== eventHash || eventBody.previous_event_hash !== previousEventHash || eventBody.claim_hash !== pending.result.claim.current_hash || eventBody.lease_hash !== pending.result.lease.current_hash) throw new Error("claim transaction journal result is inconsistent");
  return pending;
}

export function commitClaimTransfer({ claimFile, leaseFile, eventDir, lockFile, expectedEventTail = null, failAfterJournal = false, failAfterEvent = false, hardExitAfterJournal = false, hardExitAfterEvent = false, ...args }) {
  const lock = acquireClaimLock(lockFile);
  const journal = `${lockFile}.journal.json`;
  try {
    if (fs.existsSync(journal)) {
      const rawPending = JSON.parse(fs.readFileSync(journal, "utf8"));
      const priorFiles = fs.existsSync(eventDir) ? fs.readdirSync(eventDir).filter((name) => name.endsWith(".json") && path.resolve(path.join(eventDir, name)) !== path.resolve(rawPending.eventFile || "")).sort() : [];
      const priorHash = priorFiles.length ? JSON.parse(fs.readFileSync(path.join(eventDir, priorFiles.at(-1)), "utf8")).event_hash : null;
      const pending = validateJournal(rawPending, { claimFile, leaseFile, eventDir }, priorHash, lock.staleOwner);
      fs.mkdirSync(pending.eventDir, { recursive: true });
      if (!fs.existsSync(pending.eventFile)) fs.writeFileSync(pending.eventFile, `${JSON.stringify(pending.result.event, null, 2)}\n`, { flag: "wx" });
      else if (JSON.stringify(JSON.parse(fs.readFileSync(pending.eventFile, "utf8"))) !== JSON.stringify(pending.result.event)) throw new Error("claim transaction journal event conflicts with durable event");
      atomicWriteJson(pending.leaseFile, pending.result.lease);
      atomicWriteJson(pending.claimFile, pending.result.claim);
      fs.unlinkSync(journal);
    }
    const claim = JSON.parse(fs.readFileSync(claimFile, "utf8"));
    const lease = JSON.parse(fs.readFileSync(leaseFile, "utf8"));
    const claimFiles = fs.readdirSync(path.dirname(claimFile), { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !entry.name.endsWith("journal.json")).map((entry) => path.join(path.dirname(claimFile), entry.name));
    const liveClaims = claimFiles.map((file) => validateClaim(JSON.parse(fs.readFileSync(file, "utf8"))));
    const matching = liveClaims.filter((candidate) => candidate.ticket === claim.ticket && candidate.current_hash === claim.current_hash);
    if (matching.length !== 1) throw new Error("authoritative claim store lacks exactly one current ticket/hash");
    const activeClaims = liveClaims.filter((candidate) => candidate.current_hash !== claim.current_hash);
    const eventFiles = fs.existsSync(eventDir) ? fs.readdirSync(eventDir).filter((name) => name.endsWith(".json")).sort() : [];
    const actualTail = eventFiles.length ? JSON.parse(fs.readFileSync(path.join(eventDir, eventFiles.at(-1)), "utf8")).event_hash : null;
    if (actualTail !== expectedEventTail) throw new Error("stale or forked event tail CAS");
    const result = transferClaim({ ...args, claim, lease, activeClaims, eventTail: actualTail });
    fs.mkdirSync(eventDir, { recursive: true });
    const eventFile = path.join(eventDir, `${String(result.claim.revision).padStart(6, "0")}.json`);
    atomicWriteJson(journal, { schema: "agentops/claim-transaction-journal/v1", lock_owner: lock.owner, claimFile, leaseFile, eventDir, eventFile, result });
    if (hardExitAfterJournal) process.exit(86);
    if (failAfterJournal) throw new Error("simulated crash after journal");
    fs.writeFileSync(eventFile, `${JSON.stringify(result.event, null, 2)}\n`, { flag: "wx" });
    if (hardExitAfterEvent) process.exit(87);
    if (failAfterEvent) throw new Error("simulated crash after event");
    atomicWriteJson(leaseFile, result.lease);
    atomicWriteJson(claimFile, result.claim);
    fs.unlinkSync(journal);
    return result;
  } finally { lock.release(); }
}
