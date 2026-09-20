# Great-axe outfit art and shared preview

Open `index.html` for grouped class/outfit previews, the shared attack timeline, individual source poses, portrait and conversation references, labeled sheets and animated WebPs. All skins use `attack-sequence.json`; the preview can edit its order and per-step durations and export proposed changes. Labels never appear in the individual WebP frames.

## Equipment mapping audit

Inspected `origin/dev` commit `72a44b0c52cedb564a0555149bc7272fb5601b74` before authoring. `content/config/ui/presentation/equipmentAnimations.json` defines `axe: [battleaxe, cinderAxe]`, with no separate great-axe group. `content/source/weapons.csv` places both in either hand. Neither entry in `content/source/weaponCardPackages.json` requires two hands. `src/model/loadout.js` derives grip `two` only from a package requiring two hands and rejects an occupied other hand for those packages. Existing axe items therefore do not supply the requested distinct legal two-handed great-axe selector.

This pack is **authored art/preview only**, with `runtimeBinding: null`. It does not add items, equipment groups, legality rules, balance changes, engine bindings or shared animation/performance settings. A future runtime mapping needs an explicitly designed equipment group and approved legal hand combinations. One visual family is authored around a single axe held with the right hand nearer its head and the left nearer its butt; this is not dual-wield artwork, a reversed-hand painting, or per-item animation duplication.

## Identity and motion

The default Reaver was generated first. Initial attempts varied the axe; the user rejected that drift. The isolated Ready weapon became the strict reference for v2, followed by v3 fixing elongated Cast/Buff/Conversation hafts and edge clearance. `sources/reaver.png` is the v3 family template. Every remaining generation uses that full atlas plus the corresponding approved sword/shield outfit's Ready frame as an appearance-only reference. Only costume and class identity change. Cast and Buff have no baked magical effects.

The shared sequence is Ready → ATK-01 → ATK-02 → ATK-03 → ATK-04 → ATK-05 → ATK-06 → ATK-07 → Ready, with slower anticipation and recovery around the short impact beat. It is a stylized heavy two-handed cleave, not a claim of historical reconstruction. Background motion research: [Arms & Armor on two-handed axe cutting](https://www.arms-n-armor.com/blogs/news/dane-axe-cutting-at-the-valley-of-the-sun-tournament) and [Arms & Armor on Dane-axe handling](https://www.arms-n-armor.com/blogs/news/thoughts-on-fighting-with-a-dane-axe). No third-party artwork or video was downloaded into the pack.

## Coverage and export

The inherited appearance catalog has 35 class/armor entries representing 32 appearances. Bastion Harness aliases Warden Mail, Rimeweave Robes aliases Starlit Silks, and Waywatcher Coat aliases Nightveil Coat. Shared Wayfarer Plate, Nightweave, Rite Vestments and Gutter Leathers retain distinct paintings for each class. All 32 appearances are supplied; the manifest records their coverage and aliases.

Run `python art/great-axe-reference-2026-09-19/export.py` with Pillow and NumPy, then `python art/great-axe-reference-2026-09-19/validate.py` for the complete-coverage gate. Complete figures are segmented by connected alpha, preserving weapons crossing grid lines. Each source contains 16 references: 15 full-body poses and one portrait. The exporter uses one normalized body scale across all skins and poses, retains the original alpha, normalizes foot anchors, preserves transparent margins, validates decoded WebP alpha byte-for-byte and records source/frame SHA-256 values and extraction bounds. Source PNGs and exact built-in image generation prompts remain alongside the exports. No API fallback was used.

Painted frames are approximations, not a skeletal rig. Pose order and timing are shared data; geometry/prop consistency also require visual review. `manifest.json` records the actual coverage and mapping status rather than declaring an unsupported runtime integration.
