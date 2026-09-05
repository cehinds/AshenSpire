# Alternative-outfit painted poses

This evidence package holds the approved appearance boards and twelve 3×3
animation sheets generated with ChatGPT Codex under the project owner's
direction on 2026-09-05. They are first-party AI-generated art, not hand-painted
art and not Blender renders.

- `outfit-previews/` — one approved three-outfit appearance board per class.
- `outfit-pose-sheets/` — one transparent 3×3 source sheet per alternative
  outfit, retaining the class silhouette and that outfit's authored materials.

All figures face screen-right. The reading-order cells are:

1. standing/rest pose
2. guard
3. attack 1
4. attack 2 / overhead wind-up
5. attack 3 / rightward thrust
6. attack 4 / downward slash or class-equivalent finish
7. hit reaction
8. combat idle or brace
9. secondary idle/recovery

The Reaver ordering is deliberate: the rightward thrust is cell 5 and the
downward slash is cell 6. The overhead wind-up was regenerated after visual
review so the fighter, not merely the blade, faces screen-right.

The reproducible cut uses a shared `560x680` canvas and `--grounded`. Reaver and
Rogue sheets use
`stand,guard,attack1,attack2,attack3,attack4,hit,idle,idle2`; Starseer and Herald
use `idle,guard,attack1,attack2,attack3,attack4,hit,brace,idle2`. The alternative
Reaver sheets require only `--mirror idle`; the overhead pose is already
correctly oriented in the source painting.

Runtime identities join class and outfit IDs with a hyphen, for example
`reaver-vigil`, `starseer-eclipse`, `herald-ossuary`, and `rogue-nightveil`.
The default outfit continues to use the bare class ID.
