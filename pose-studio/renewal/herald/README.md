# Herald sword and shield study

- Authoring continuation after the approved Reaver PR #1695; no gameplay binding.
- Twelve transparent poses: five-frame sword attack, hurt/recovery, held down pose, basic power and spell cast.
- Sword stays in the right hand and shield on the left arm. Casting sheaths the sword and frees the right hand.
- The wind-up, follow-through and hurt arm arrangements were corrected on October 7. `handedness-review.json` records the twelve-pose check; the rejected top-middle source cell is never exported.
- Uses current Normal/Fast timings, slight advance/return, silhouette aura and the shared fading red hit flash.
- Existing slash, ward and projectile effects remain separate from body frames.
- Portable Workshop project: `herald-swordShield.rig.json`. Pose Studio projects: `attack.pose.json`, `power.pose.json`, `spell.pose.json`.
- Original sources, generation prompts, hashes and normalization are included. Rebuild with `python tools/alternative-herald-animation-build.py`.
- Draft review remaining: final hand contacts, cloak silhouette consistency, sheath/draw transitions and separate body/weapon layers. Anatomy is not certified by the export tool.
