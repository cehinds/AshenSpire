# Uniform mixed rewards and restored Core Victory XP

Core combat already paid its class and used weapon-group ledgers before rewards,
but its configured branch bypassed the existing `mountRewards` Victory modal
and discarded the display receipt. Core now persists a Victory receipt and
reuses that modal's production progress bars before opening its existing offers.
The receipt uses settled, rate-scaled award amounts; character XP remains zero.
Continuing only acknowledges the receipt. Save failures restore it for retry.

The shared reward face uses one width and aspect ratio for combat cards,
collectibles, and equipment. Collectible canvases fill that ratio while their
art retains `object-fit: contain`; selection buttons share their row's height
and wrap labels. No artwork or font-fitting rules changed.

Verification:

- `node --test tests/core-skill-progression.test.mjs tests/reward-review.test.mjs`
  checks real Core settlement and the actual main settlement/resume functions,
  scaled gains, unused weapons, no character XP, duplicate combat callbacks,
  save/load, failed receipt save/retry, and duplicate/reentrant continuation.
- `node tools/game-config.mjs check` passes without generated pin changes.
- `REWARD_VICTORY_OUT=<folder> node tools/reward-victory-qa.mjs` boots the
  configured reward route, then mounts production renderers with deterministic
  Evade/Sweep/Crimson Flask offers and an already-paid class/Blade XP fixture.
  These captures are staged renderer checks, not a completed browser fight.
  It checks equal face dimensions, matching collectible canvas height, equal
  button heights and fitted labels at 390×844, 1440×900, 1920×1080, and 768×1024.
  Continue remains registered as `rewardContinue` with the existing 600ms hold;
  a short press reviews, confirmation continues once, and repeated confirmation
  cannot continue again. The phone case also drives a deliberate hold.

The node DOM fixture's clicks omit browser `Event.detail`, directly exercising
shared holdconfirm's callback path; real browser interaction is verified by the
separate QA tool. Captures use DPR 1 and fullPage, with the canonical local light
art cache. Existing phone/tablet full-page extents are not layout certification.

Captured 2026-10-23 from runtime source commits `20f4d79f3` + `0504759d0`.
All 20 focused node tests and all four browser viewports pass. At desktop the
three faces measure 182.39×273.58px; at phone they measure 136.80×205.19px.
Their buttons measure 44px high. The painted collectible frame matches its face
height within 0.01px. The source checkout is served locally; no new standalone
build version is claimed. The integrating session owns publication of the
screenshots in `/workspace/scratch/reward-victory/` and its combined preview.
