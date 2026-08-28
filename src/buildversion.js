// src/buildversion.js — THE ONE HOME OF THE BUILD VERSION.
//
// Constantine, 2026-08-15, unprompted and in full: "in the game be sure to have
// the build version is available on the main menu, and somewhere in the map and
// combat". That is the whole of the ask; nothing else was said.
//
// Constantine, 2026-08-16, and this one reopened the scheme: "I want builds to
// be simply numeric except for the last value. the one with the higher value or
// higher alpha at th ened shoudl be the newest build" — then, asked to choose
// between three costed options: "commit count / automate the checking / auto
// bump on build".
//
// ---------------------------------------------------------------------------
// WHAT HE READ BEFORE, AND WHY IT FAILED HIM — read this before the section
// below, because that section is still true and is no longer the whole answer.
// ---------------------------------------------------------------------------
//
// The stamp was `0.4.0+<digest>`. It could not answer his question, at BOTH
// halves, and the second half is the one nobody had named:
//
//   · A DIGEST DOES NOT ORDER. Measured on this branch: `6de9a8b63e` was
//     followed by `2d5a8cc240`, and the newer one sorts BELOW its predecessor.
//     Non-monotonicity is not a flaw in the hash, it is the entire point of one.
//   · THE ORDER-BEARING PART NEVER MOVED. `0.4.0` has been the release for the
//     whole recent life of the repo — 139 commits have changed the shipped
//     bundle and the release string has held TWO values ever. The half that
//     could sort was frozen and the half that moved could not sort.
//
// SO THE STRING IS NOW TWO FACTS WITH TWO JOBS, AND SAYING SO IS THE DESIGN:
//
//     BUILD 0.4.0.0618 · src 2d5a8cc240
//           └── ORDERS ─┘   └ IDENTIFIES ┘
//
// He constrained the ORDER-BEARING TAIL and nothing else, so provenance moves
// out of the tail rather than being deleted. The version is numeric with a
// numeric last component, which is his rule literally; the digest keeps doing
// the job it was good at, in a field of its own where its unsortability costs
// nothing.
//
// THE TAIL IS ZERO-PADDED, AND THAT IS NOT COSMETIC. Unpadded, `0.4.0.10` sorts
// BELOW `0.4.0.9` in every string sort there is; padded, eye-order and
// string-order agree. He did not ask for this and he did not rule against it —
// his own `v0.00.01` example is already padded, which is the same instinct
// arriving twice. THE CEILING IS STATED BECAUSE PADDING HAS ONE: at width 4 the
// sort stays correct through 99999 and inverts at 100000. `--check` row F
// refuses the ordinal before it can get there, rather than leaving a trap set
// for whoever is here in eighty thousand commits.
//
// AND THE ALPHA HE OFFERED IS A TRAP WE DECLINED, IN THE OPEN: `higher alpha`
// works for twenty-six steps, and then `z` is followed by `aa`, which sorts
// BELOW `b`. A letter tail is a fixed-width tail or it is a bug with a
// schedule. Numeric costs nothing and has no such cliff.
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
//   buildordinal.json      →  ORDINAL  (injected likewise; written by the build)
//   this file              →  BUILD_VERSION and BUILD_STAMP_TEXT, composed once
//
// AND THE ORDINAL IS NOT `contentBundle.version`, WHICH IS THE ONE PLACE IT
// WOULD OBVIOUSLY HAVE GONE. That field is also the SAVE-COMPATIBILITY KEY:
// `model/registries.js` copies it to `registries.contentVersion` and
// `engine/save.js` compares a stored run against it, archiving the run if any
// id no longer resolves. Make it move on every build and it starts announcing
// "the content changed under this run" when no content did — one string, two
// subjects, and the ordering requirement would corrupt the job nobody is
// watching. The tail needed its own home and that is why it has one.
//
// The three surfaces Constantine named read BUILD_STAMP_TEXT through one
// renderer (ui/components/buildstamp.js) — three placements, one string, one
// markup.
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

// ---------------------------------------------------------------------------
// THE BUILD ORDINAL — THE HALF THAT ORDERS. Also written by the build, never by
// a hand, and injected between its own markers exactly like SOURCE above.
//
// WHY IT IS COMMITTED TO buildordinal.json AND THE DIGEST IS NOT, WHICH LOOKS
// INCONSISTENT UNTIL YOU SEE WHAT EACH IS A FUNCTION OF. The digest is a
// function of THE TREE, and the tree is identical when the build runs and when
// rebuild-matches re-derives — so it can be computed on the spot, twice, and
// agree. The ordinal is a function of HISTORY, and history ADVANCES BY EXACTLY
// THE COMMIT THAT CARRIES THE BUNDLE: measured on this branch, `rev-list
// --count` reads 617 at HEAD~1 and 618 at HEAD, so a bundle committed IN a
// commit can only ever carry its parent's number, and re-deriving on the spot
// would produce a different one every time. Injection was never the problem;
// injection moves where a value is WRITTEN and cannot change what it is a
// FUNCTION OF.
//
// So the ordinal is computed ONCE, by the build, and COMMITTED — which turns it
// into a fact of the source tree, which is the only kind of fact this bundle is
// allowed to carry. The build rewrites it only when the digest has moved, so a
// rebuild of an unchanged tree touches nothing and reproduces byte-for-byte.
// Both arms were run before this was written; the injected arm goes red with a
// dirty tree and the committed arm goes green with a clean one.
//
// `UNBUMPED` is what you see when the tree in front of you is not the tree the
// ordinal was computed for — an edited working copy served by tools/serve.mjs,
// which reads this number and NEVER writes it. In that state BUILD_VERSION
// drops the tail entirely rather than showing a number that belongs to an older
// build: a missing component is honest, and a stale one that sorts is a lie
// with a sort order.
// ---------------------------------------------------------------------------
/* BUILD_ORDINAL_START */
export const ORDINAL = 'UNBUMPED';
/* BUILD_ORDINAL_END */

/** True when the ordinal in this page belongs to the tree that drew it. */
export const BUILD_IS_ORDERED = ORDINAL !== 'UNBUMPED';

/** The ORDERING half: numeric throughout, last component sorts. His rule. */
export const BUILD_VERSION = BUILD_IS_ORDERED ? `${RELEASE}.${ORDINAL}` : RELEASE;

/** True when a build or the dev server derived the digest for this page. */
export const BUILD_IS_STAMPED = SOURCE !== 'UNSTAMPED';

/**
 * What a player reads, and what a bug report should carry back to us. TWO
 * FIELDS ON PURPOSE — the version orders, the digest identifies, and neither
 * can do the other's job. ONE HOME for the shown text so the renderer and the
 * photograph gate cannot disagree about it.
 */
export const BUILD_STAMP_TEXT = `BUILD ${BUILD_VERSION} · src ${SOURCE}`;
