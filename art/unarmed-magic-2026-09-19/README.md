# Empty-hand magic animation suite

Open `index.html` for the synchronized class/armor gallery. The source pose order is shared by every appearance: Ready → ATK01 gather → ATK02 open channel → ATK03 channel peak → ATK04 extend → ATK05 release → ATK06 follow through → ATK07 recovery → Ready. Each step is 160ms; release begins at 800ms. The preview supports filters, individual poses, scrub, speed, order editing, and configuration download.

Every suite has 16 poses: Ready, ATK01–07, Defend, Hurt, Cast, Buff, aggressive and defensive stances, Portrait, and Conversation. Both hands are empty. Channeling and release use deliberate open palms; character poses contain no spell aura, projectiles, trails, or particles. Labels exist only in sheets and HTML. Solid costume ornaments are part of the appearance.

The exact reference choreography is the default Starseer atlas. Every other atlas is generated as an appearance replacement using that atlas and the approved outfit identity. These painted frames approximate consistent body geometry; they are not a skeletal rig. All appearances share pose IDs and playback timing. A single scale is applied to all full-body poses within each suite, with a common 512×512 canvas and foot anchor at (256,480); portraits have independent framing.

`outfits.json` retains the approved 35 catalog armor entries / 32 distinct appearances. Existing Bastion Harness, Rimeweave Robes and Waywatcher Coat aliases share their established corresponding appearances; shared armor gets a separate painting for each class. `manifest.json` records explicit alias coverage and any missing appearances. No missing entry is silently treated as another outfit.

Built-in OpenAI image generation produces the PNG masters in `sources/`. Prompts and original generated locations are retained in `prompts.json`. Actual source dimensions are recorded; the generator may return less than the requested 2048×2048. Original alpha remains intact. The connected-alpha extractor is reused from the approved sword/shield pipeline and preserves complete figures even where they cross nominal grid boundaries. Every WebP's decoded alpha is compared byte-for-byte with its normalized frame.

Run `python art/unarmed-magic-2026-09-19/catalog.py --require-complete` with Pillow and NumPy to export and verify complete coverage. Add `--refresh` after changing extraction rules. This creates the labeled sheets, WebP loops, manifest, preview data, and `runtime-fragment.json`; it does not rewrite shared runtime settings.

## Runtime integration contract

Physical-unarmed owns shared integration. Both suites use a single `${appearanceId}Unarmed` set and `unarmed` motion profile for ordered `empty + empty` hand groups. The fragment contributes `MAGIC-` frame IDs, `magic*` clip IDs, and only the `cast` and `buff` default action references. Casting plays the whole channel/release/recovery sequence; buff uses the self-directed Buff pose. Static clips for every magic pose remain available for configurable reference assignment.

Physical default attack, idle, defend, hurt, stances, portrait, menu and conversation remain physical references. The physical-unarmed integration routes explicitly resolved casting actions to the magic cast clip, including attack-kind cards whose authored action is casting. An attack without that casting intent remains physical; damage type alone never selects magic choreography. Powers use the buff reference. The suite does not infer presentation from class or damage type, grant spells, add equipment, or change legal pairings, damage, costs, cards or balance.

## Equipment inspection

`src/model/loadout.js` resolves both empty hands to null item IDs and grip `one`; the grip restriction rejects a two-handed piece beside an occupied hand. `src/model/equipmentAnimation.js` selects by class, armor, ordered hand groups and grip, and rejects duplicate selectors. Creating a second magic `empty + empty` selector would collide, so role composition is used instead. `src/model/combatAnimation.js` uses the resolved card kind: attacks take the strike family, powers and other casting actions take the cast family, and guard-tagged skills use defense. The shared integration refines empty-hand presentation using the existing resolved action casting intent; it does not introduce a combat rule.

Before integration is complete, verify both import orders preserve each suite's owned references and clips, and verify actual cast/buff playback through the shared runtime integration.
