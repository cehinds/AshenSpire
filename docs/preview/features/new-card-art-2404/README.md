# NewCardArt feature captures

[Play the verified feature build](https://cehinds.github.io/AshenSpire/branches/Feature/NewCardArt/latest/). Published build 0.7.2.32, source `1652b8f15d`, commit `87cd891e77e2891effcab037f7061fd4c1539709`. Verified in a real browser on 2026-10-31T08:17:15.514Z; native startup, menu, isolation and artwork checks passed. The iframe has no same-origin storage access.

Native card-gallery captures: October 31, 2026 UTC, source commit `4259592b4bec1339e644350d22a5ad69db643967`, executable source `1652b8f15d`, local build 0.7.2.32. The reviewed test-only follow-up has identical executable source. Actual default Core profile `a099ed9d8597ae42cfdc5b37455eb2d12a2295a7808938a823b4b848f4246989`, 578 cards, combat rules 2 and Fix Core 1. These are posed previews using real card definitions and the production renderer, not earned gameplay.

The current branch also includes dev's later reaction-frame pacing update (#2408). Its procedural art, card renderer, effect projection and status presentation match the verified preview; current-head CI covers the combined source.

Viewports: mobile 390×844; desktop 1440×1000; wide 1920×1080; tablet 820×1180, DPR 1. All four PNGs were visually inspected for loaded art, readable effects, cropping and controls.

The full default library passed 4,624 resting/selected states and 1,734 resize states; representative current-base coverage passed 336 states. Procedural art is determined by type, tags and rank, with independent weapon, element and status cutouts. Ranked aura intensity retains the weapon silhouette. Art, gameplay cards and saved rule identities remain preserved through Reviewed/Legacy and the unchanged versioned definitions.

| Capture | PNG SHA-256 |
| --- | --- |
| mobile.png | 46a1e3d59a614d0659977a0b6d3c15a54288535d9b0564808e3286dd2759a93c |
| desktop.png | 49f9545d4d1dcbe862c41bf46649463dd301176da643736e0390d213fe1dd8f8 |
| wide.png | 2bf654c9368192ec2e8108c1ca7b41f1c47e57578bfe8ce0d6b32d113d11f189 |
| tablet.png | 1642bef40c25af69687c0e98f091597b017ff8d69bfde7c8475039b0093f6c7a |

Raw QA logs remain task-local. This temporary feature evidence is removed from the Git index before the dev merge; physical local copies remain preserved. The Release screenshot gallery is separate and still identifies the published Release 0.7.1.1920.
