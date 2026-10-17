# Independent art review — batch 09

Decision: approved for draft art handoff. No blocking image-generation outliers found.

Reviewed against `brief.json`, the shared `style-system/style-guide.json`, and the batch prompt prefix. Visually inspected all 45 source assets on the complete desert/jungle/snowy/mountain contact boards, including the final revised jungle entrance and wet ground. Also inspected `preview-conditions.png`, `preview-architecture.png`, `preview-dungeons.png`, `preview-cameras.png`, `preview-mountains.png`, and all 39 panels in `preview-all-scenes.png`.

## Findings

- Painted family: weathered matte stone, timber, fabric and vegetation remain coherent across regions. Desert sandstone/linen, jungle vines/thatch/stilts and snowy slate/timber preserve useful regional distinctions.
- Camera: architecture reads from a low frontal or gentle three-quarter view. No elevated isometric outlier. Complete source silhouettes and reviewed compositions do not visibly crop solid subjects.
- Grounds: shallow planes retain usable quiet centers. Jungle roots and rubble stay principally peripheral; snowy rain reads as damp/slushy stone rather than mirror ice. No baked precipitation streaks found.
- Night: all three biomes have separately painted blue moonlit backdrops and grounds, plus town props with localized warm windows and lamps. City/castle/entrance previews use visibly darker neutral props with explicitly recorded ambient grades; these are correctly not presented as painted night prop relights.
- Mountains: all three near/distant pairs have complete isolated silhouettes. Distant paintings are lighter, softer, simpler and lower contrast. No opaque fog rectangle or cloud plate is visible against the split source-board backgrounds.
- Compositions: grounds meet prop bases plausibly; no conspicuous floating architecture or horizon seams at sheet scale. Dungeon interiors retain quiet floors and credible material continuity. Portrait, landscape and ultrawide jungle-night samples keep the complete subject inside the crop.
- Integration: independently ran `node art/map-battlefield-drafts/batch-09-biome-architecture/scenes.mjs --check`; passed with 39 scenes, 39 pools and 6 mountains. Source inspection confirms independent dungeon conditions, painted town night references and explicit neutral-prop night grades.

## Minor observations and scope

The desert skyline is compact and the snowy skyline is fortress-heavy; these remain useful regional silhouettes and do not justify regeneration. Some dungeon rooms show daylight openings or frost, consistent with ruined architecture. Their presets correctly exclude external weather layers.

Fine alpha edges, exact source margins and arbitrary future camera travel remain production cleanup/calibration tasks. Early direct transparent-image viewing showed a few brightly colored fringe pixels around desert props, but these were not conspicuous in the final contact boards or compositions; no final regeneration is requested. Approval covers the supplied draft sources and reviewed camera examples, not unrestricted camera movement or a production-resolution claim.

Reviewer: independent biome art QA agent. Reviewed 2026-10-17.
