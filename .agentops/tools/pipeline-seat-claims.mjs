#!/usr/bin/env node
import crypto from "node:crypto";
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

export function commitClaimTransfer({ claimFile, leaseFile, eventDir, lockFile, expectedEventTail = null, failAfterJournal = false, failAfterEvent = false, ...args }) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  let lock;
  try { lock = fs.openSync(lockFile, "wx"); } catch (error) { throw new Error(`claim transaction locked: ${error.code}`); }
  const journal = `${lockFile}.journal.json`;
  try {
    if (fs.existsSync(journal)) {
      const pending = JSON.parse(fs.readFileSync(journal, "utf8"));
      fs.mkdirSync(pending.eventDir, { recursive: true });
      if (!fs.existsSync(pending.eventFile)) fs.writeFileSync(pending.eventFile, `${JSON.stringify(pending.result.event, null, 2)}\n`, { flag: "wx" });
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
    atomicWriteJson(journal, { claimFile, leaseFile, eventDir, eventFile, result });
    if (failAfterJournal) throw new Error("simulated crash after journal");
    fs.writeFileSync(eventFile, `${JSON.stringify(result.event, null, 2)}\n`, { flag: "wx" });
    if (failAfterEvent) throw new Error("simulated crash after event");
    atomicWriteJson(leaseFile, result.lease);
    atomicWriteJson(claimFile, result.claim);
    fs.unlinkSync(journal);
    return result;
  } finally { fs.closeSync(lock); fs.unlinkSync(lockFile); }
}
