#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { commitClaimTransfer, seatFingerprint, validateClaim, validateLease } from "./pipeline-seat-claims.mjs";
import { globCovers } from "./opsctl.mjs";

function readJson(file, label) {
  if (!file || !fs.existsSync(file)) throw new Error(`${label} is unavailable`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function resolveFrom(base, value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} path is required`);
  const resolved = path.resolve(base, value);
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) throw new Error(`${label} must stay inside the Git-local seat runtime`);
  return resolved;
}

function inside(root, candidate) {
  const exact = path.resolve(root);
  const resolved = path.resolve(candidate);
  return resolved === exact || resolved.startsWith(`${exact}${path.sep}`);
}

export function resolveCanonicalSeatRuntime(root) {
  const repoRoot = path.dirname(path.resolve(root));
  const common = execFileSync("git", ["-C", repoRoot, "rev-parse", "--git-common-dir"], { encoding: "utf8", windowsHide: true }).trim();
  if (!common) throw new Error("git returned an empty common directory for seat runtime");
  return path.join(path.resolve(repoRoot, common), "agentops-pipeline", "runtime");
}

export function validateSeatRuntime(config, configFile) {
  if (config?.schema !== "agentops/seat-runtime/v1") throw new Error("invalid seat runtime schema");
  if (config.issuer_role !== "it-manager-iii") throw new Error("seat runtime issuer must be IT Manager III");
  if (!Number.isInteger(config.lease_seconds) || config.lease_seconds < 60) throw new Error("seat runtime lease_seconds must be >= 60");
  if (!config.seats || typeof config.seats !== "object" || Array.isArray(config.seats)) throw new Error("seat runtime actor map is required");
  const base = path.dirname(path.resolve(configFile));
  return {
    ...config,
    registry_file: resolveFrom(base, config.registry_file, "registry"),
    claims_dir: resolveFrom(base, config.claims_dir, "claims"),
    leases_dir: resolveFrom(base, config.leases_dir, "leases"),
    events_dir: resolveFrom(base, config.events_dir, "events"),
    lock_file: resolveFrom(base, config.lock_file, "transaction lock"),
    seats: Object.fromEntries(Object.entries(config.seats).map(([actor, seat]) => [actor, {
      seat_id: seat?.seat_id,
      capability_file: resolveFrom(base, seat?.capability_file, `capability for ${actor}`),
    }])),
  };
}

function actualEventTail(eventDir) {
  if (!fs.existsSync(eventDir)) return null;
  const files = fs.readdirSync(eventDir).filter((name) => name.endsWith(".json")).sort();
  return files.length ? readJson(path.join(eventDir, files.at(-1)), "event tail").event_hash : null;
}

export function assignLiveClaim(root, { offer, now, runtimeConfigFile, canonicalRuntimeRoot = null }) {
  if (offer?.status !== "OFFERED" || !offer.selected?.ticket || !offer.released_actor) throw new Error("assignment requires one safe live offer");
  const canonicalRoot = path.resolve(canonicalRuntimeRoot || resolveCanonicalSeatRuntime(root));
  if (!inside(canonicalRoot, runtimeConfigFile)) throw new Error("seat runtime must be inside this repository's canonical Git-local runtime");
  const config = validateSeatRuntime(readJson(runtimeConfigFile, "seat runtime"), runtimeConfigFile);
  for (const candidate of [config.registry_file, config.claims_dir, config.leases_dir, config.events_dir, config.lock_file, ...Object.values(config.seats).map((seat) => seat.capability_file)]) {
    if (!inside(canonicalRoot, candidate)) throw new Error("seat runtime dependency escaped this repository's canonical Git-local runtime");
  }
  const seat = config.seats[offer.released_actor];
  if (!seat?.seat_id) throw new Error(`no unique seat registered for actor ${offer.released_actor}`);
  const registry = readJson(config.registry_file, "trusted seat registry");
  if (registry?.schema !== "agentops/seat-registry/v1" || !registry.seats || typeof registry.seats !== "object") throw new Error("invalid trusted seat registry");
  const capability = fs.readFileSync(seat.capability_file, "utf8").trim();
  const registered = registry.seats[seat.seat_id];
  if (!registered || registered.status !== "active" || registered.role !== offer.released_actor || seatFingerprint(capability) !== registered.capability_fingerprint) throw new Error("released seat proof failed against trusted registry");
  if (!Array.isArray(registered.path_globs) || offer.selected.path_globs.some((requested) => !registered.path_globs.some((granted) => globCovers(granted, requested)))) throw new Error("released seat lacks path eligibility for the offered claim");

  const claimFile = path.join(config.claims_dir, `${offer.selected.ticket}.json`);
  const claim = validateClaim(readJson(claimFile, "authoritative claim"));
  const leaseFile = path.join(config.leases_dir, `${claim.lease_id}.json`);
  const lease = readJson(leaseFile, "authoritative seat lease");
  validateLease(lease, claim, now, Date.parse(claim.expiry) <= Date.parse(now));
  if (claim.ticket !== offer.selected.ticket || claim.lease_id !== offer.selected.lease || claim.ref !== offer.selected.ref || JSON.stringify(claim.path_globs) !== JSON.stringify(offer.selected.path_globs)) throw new Error("offer does not bind the authoritative claim and lease");
  if (claim.seat_id === seat.seat_id) {
    return { status: "ALREADY_ASSIGNED", ticket: claim.ticket, seat_id: seat.seat_id, claim_hash: claim.current_hash, lease_hash: lease.current_hash, audit_event: null };
  }
  const eventDir = path.join(config.events_dir, claim.ticket);
  const expiry = new Date(Date.parse(now) + config.lease_seconds * 1000).toISOString();
  const result = commitClaimTransfer({
    claimFile,
    leaseFile,
    eventDir,
    lockFile: config.lock_file,
    expectedEventTail: actualEventTail(eventDir),
    expectedHash: claim.current_hash,
    targetSeat: seat.seat_id,
    targetCapability: capability,
    seatRegistry: registry.seats,
    issuerRole: config.issuer_role,
    now,
    expiry,
    kind: Date.parse(claim.expiry) <= Date.parse(now) ? "expired-claim-recovered" : "claim-transferred",
  });
  return { status: "ASSIGNED", ticket: result.claim.ticket, seat_id: result.claim.seat_id, claim_hash: result.claim.current_hash, lease_hash: result.lease.current_hash, audit_event: result.event.event_hash };
}
