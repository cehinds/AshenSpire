#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

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

export function validateClaim(claim) {
  if (claim?.schema !== "agentops/seat-claim/v1" || !seatPattern.test(claim.seat_id || "")) throw new Error("invalid seat claim identity");
  if (!claim.ticket || !claim.lease_id || !claim.ref || !Array.isArray(claim.path_globs) || !claim.path_globs.length) throw new Error("incomplete seat claim");
  if (sealClaim(claim).current_hash !== claim.current_hash) throw new Error("seat claim seal mismatch");
  return claim;
}

function overlaps(left, right) {
  const norm = (value) => value.replace(/\*\*$/, "");
  return left.some((a) => right.some((b) => norm(a).startsWith(norm(b)) || norm(b).startsWith(norm(a))));
}

export function transferClaim({ claim, expectedHash, targetSeat, targetCapability, targetFingerprint, issuerRole, now, expiry, activeClaims = [], eventTail = null, kind = "claim-transferred" }) {
  validateClaim(claim);
  if (expectedHash !== claim.current_hash) throw new Error("stale or replayed claim CAS");
  if (issuerRole !== "it-manager-iii") throw new Error("claim transfer requires IT Manager III");
  if (!seatPattern.test(targetSeat || "")) throw new Error("invalid target seat");
  if (targetSeat === claim.seat_id) throw new Error("self-transfer is not a claim transfer");
  if (seatFingerprint(targetCapability) !== targetFingerprint) throw new Error("target seat proof failed");
  const nowMs = Date.parse(now), expiryMs = Date.parse(expiry);
  if (!Number.isFinite(nowMs) || !Number.isFinite(expiryMs) || expiryMs <= nowMs) throw new Error("invalid transfer window");
  for (const other of activeClaims) {
    if (other.ticket === claim.ticket) continue;
    if (other.ref === claim.ref || overlaps(other.path_globs, claim.path_globs)) throw new Error("duplicate writer path or ref collision");
  }
  const next = sealClaim({ ...claim, revision: claim.revision + 1, parent_hash: claim.current_hash, seat_id: targetSeat, issued: now, expiry, status: "active" });
  const eventBody = { schema: "agentops/seat-claim-event/v1", ticket: claim.ticket, kind, actor: issuerRole, seat_id: targetSeat, claim_hash: next.current_hash, previous_event_hash: eventTail, occurred_at: now };
  return { claim: next, event: { ...eventBody, event_hash: digest(eventBody) } };
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
