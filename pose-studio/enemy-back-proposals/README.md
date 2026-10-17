# Enemy rear-view proposal review

Open `/pose-studio/enemy-back-proposals/index.html` through the existing Pose Studio server or feature build. This gallery is a proposal review surface; it does not select runtime artwork or unlock playable actors.

The manifest is the integration point for audited canonical enemies and ten individually authored rear designs per actor. `scope` distinguishes `pending`, `ten-designs` and `ten-full-sets`; missing slots remain visible. A design may provide any of neutral, smash, attack, sweep, counter, defend, evade, spell and preparing. Each enemy has its own nullable `defaultStance`; stance coverage and design coverage are counted separately.

Each proposal has `id: "v01"` through `"v10"`, `perspective: "rear"`, `status`, `provenance`, and `stances`. Each stance has `frames`: asset path, positive durationMs, canvas [width,height], normalized anchors including feet. Provenance records sourceSha256, exact prompt, publicationStatus (`draft-unpublished` or `released`), and nullable artRelease. Released artwork must name its release. Original source and prompts remain reviewable; license/rights review is separate.

Feature-local draft art may live under `art/enemy-back-proposals/`; published asset IDs resolve through the existing asset loader. Existing front identity references belong in actor.reference.asset and are labelled separately. They never substitute for a rear proposal. The gallery provides two-design comparison, per-stance frame playback, floor anchors, and manifest download.

Enemy animation export uses Sprite Workshop rigs. Existing Pose Studio actor validation accepts player classes only, so this module does not fabricate compatible enemy pose projects or gameplay bindings. Preserve the source's geometry; do not mirror a front painting and call it rear art.

Run `node --test pose-studio/enemy-back-proposals/model.test.mjs`. Parent integration must provide actual proposal art, actual browser captures and preview evidence; the initial empty manifest is an integration handoff and not completed art.

Delivered `scope` stays `pending` until every audited actor satisfies the stated coverage; `targetScope` records the goal separately. A nullable `provisionalDefaultVersion` names an available draft design and never implies approved gameplay selection.

After normalization outputs and their provenance have landed on the feature, run `node pose-studio/enemy-back-proposals/integrate-normalized.mjs <actorId>`. It verifies master/output SHA-256 bytes, refuses clipped/error outputs, converts floor anchors, and imports ten neutral draft designs. v01 is labelled provisional, crop review stays explicit, and no neutral design is copied into action slots. Prompt summaries are identified as summaries.

Optional `proposal.animations[stance].frames` stores actual separately authored motion clips using the same timed frame and anchor schema. Held stance coverage and motion coverage are displayed separately; a one-frame stance does not count as an animation. `Play available motion` previews a clip only when present and otherwise shows the held pose.

Manual foot reviews are imported from optional `foot-anchors.json` only when source and per-image hashes match. `registration` preserves the bounds anchor separately and labels manual estimates versus a bounds/floor reference; tail tips do not become anatomical feet. Both exact source and camera references are retained when legacy provenance uses `source`/`cameraReference` fields.
