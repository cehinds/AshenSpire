# Rogue / twin daggers — continuation draft

Twelve base-armour poses: ready, five attack poses, hurt, recover, down, power preparation, spell channel and release. The five actions use the current 260 ms normal combat window; the atelier applies the shared game speed settings, existing effects, silhouette auras and red hurt tint.

Open the atelier and select **Rogue / Twin daggers**, or import `rogue-twinDaggers.rig.json` into Sprite Workshop. The three `.pose.json` projects also open in Pose Studio through the atelier's edit link. Their gameplay bindings are empty.

Regenerate with `python tools/alternative-rogue-animation-build.py`, then `python tools/alternative-animation-build.py` to refresh the family registry. Original sheets, prompts, hashes and reviewed crop coordinates are included. Outputs share a 512px canvas and floor anchor; the light tier is 256px.

Review remains open for sheath/draw transitions, contact/follow-through cloak edges and separate body/weapon layers. This local continuation is not included in the first Reaver PR and is not bound to gameplay.
