// src/buildversion.js — THE ONE HOME OF THE BUILD VERSION.
//
// Constantine, 2026-08-15, unprompted and in full: "in the game be sure to have
// the build version is available on the main menu, and somewhere in the map and
// combat". That is the whole of the ask; nothing else was said.
//
// ---------------------------------------------------------------------------
// THE TENSION, AND WHY THE ANSWER IS A DIGEST OF THE SOURCE
// ---------------------------------------------------------------------------
//
// Two things had to be true at once and they pull against each other:
//
//   1. THE VERSION IS A FACT OF THE SOURCE TREE, NEVER OF THE REF. A string
//      derived from git — `HEAD`, `describe`, a commit count — CANNOT live in a
//      committed bundle. `tools/rebuild-matches.mjs` asks whether a build from
//      THIS source reproduces the committed artifact; a ref-carrying string
//      makes that RED FOREVER, because the bundle at commit N can only ever
//      have been built at N's parent. Off by one, permanently, for every
//      ref-derived scheme there is. And rebuild-matches is the only GENERATIVE
//      check in this tree — the one door onto a bundle imported from somewhere
//      else. Trading it for a version stamp would be trading the alarm for a
//      label on the door.
//
//   2. HIS NOUN IS "BUILD VERSION". A string that does not distinguish builds
//      is not one. The release line has not moved in weeks and will not move
//      tomorrow; a screenshot carrying only that tells us nothing we did not
//      already know, and the whole use of a version on a screen is that he can
//      photograph a wrong thing and we can say WHICH TREE drew it.
//
// THEY RESOLVE, and the resolution is the work: a CONTENT DIGEST of the source
// tree is a fact of the source tree (1) and moves whenever the source moves
// (2). No trade was needed and none is being hidden here. What it costs is
// stated below rather than sold.
//
//   · The digest is over BYTES ON DISK — index.html, styles/, src/, assets/ —
//     so a rebuild from the same tree produces the same string, and
//     rebuild-matches stays GREEN. Watched at both edges; see the log.
//   · There is no fixpoint problem and no second-order commit. The digest is
//     never written to disk: `SOURCE` below is committed as `UNSTAMPED` and
//     replaced IN MEMORY at build time (tools/bundle.mjs) and at serve time
//     (tools/serve.mjs), exactly the way ui/assetmap.js's ASSET_MAP already is.
//     So the file this digest covers never changes because of the digest.
//   · SAME STRING ⇒ SAME SOURCE. That is the direction that matters, and it is
//     the one this scheme guarantees. The converse is deliberately NOT claimed:
//     a source edit that cannot reach the bundle (a comment in an unimported
//     file, a README under assets/) moves the string without moving the game.
//     I would rather two names for one build than one name for two builds.
//   · IT DOES NOT NAME A COMMIT, and it must not — see (1). To go from a
//     digest on a screenshot to a commit, ask the artifact, not a table:
//         git log -S'<digest>' --oneline -- build/AshenSpire.html
//     The digest is a literal inside the committed bundle, so that command is
//     exact and there is no second copy of the mapping to rot.
//     `node tools/buildversion.mjs --which <digest>` runs precisely that.
//
// ---------------------------------------------------------------------------
// SOP 5, LITERALLY — one file, and every other reader DERIVES
// ---------------------------------------------------------------------------
//
// The release half is NOT typed here. `src/content/index.js` has been this
// repo's one home for the release number all along (ci.yml says so in its own
// header), and typing it a second time here — even agreeing — is the palworld
// defect with a third copy. Each of that project's three drifts began as
// agreement.
//
//   contentBundle.version  →  RELEASE  (imported, never re-typed)
//   the bundler / server   →  SOURCE   (injected between the markers below)
//   this file              →  BUILD_VERSION, composed once
//
// The three surfaces Constantine named read BUILD_VERSION through one renderer
// (ui/components/buildstamp.js) — three placements, one string, one markup.
//
// The check is `node tools/buildversion.mjs --check`, and its known-bad corpus
// is `--selftest`: a fixture that RE-TYPES the version must turn it red, or it
// proves nothing (development.md, *The instrument rule*).
//
// Headless-safe: data only, no document, no storage, no timers.
//
// REMOVAL CONDITION (SOP 1's corollary): this module is deleted the day nothing
// on a player's screen states which build drew it — one artifact, one reader,
// nothing to distinguish.

import { contentBundle } from './content/index.js';

/** The release line. ONE HOME, and it is not this file — src/content/index.js. */
export const RELEASE = contentBundle.version;

// ---------------------------------------------------------------------------
// THE SOURCE DIGEST — WRITTEN BY THE BUILD, NEVER BY A HAND.
//
// The markers are load-bearing: tools/bundle.mjs and tools/serve.mjs anchor on
// them, and tools/buildversion.mjs --check goes RED if the committed value is
// anything but the placeholder. A digest typed in here would be a version
// asserted rather than derived, which is the one thing SOP 5 forbids.
//
// `UNSTAMPED` is what you see when the page was opened with neither of those in
// the path — a raw `file://` open of index.html. It is honest rather than
// alarming: nothing derived the digest, so nothing is claimed.
// ---------------------------------------------------------------------------
/* BUILD_SOURCE_START */
export const SOURCE = 'UNSTAMPED';
/* BUILD_SOURCE_END */

/** What a player reads, and what a bug report should carry back to us. */
export const BUILD_VERSION = `${RELEASE}+${SOURCE}`;

/** True when a build or the dev server derived the digest for this page. */
export const BUILD_IS_STAMPED = SOURCE !== 'UNSTAMPED';
