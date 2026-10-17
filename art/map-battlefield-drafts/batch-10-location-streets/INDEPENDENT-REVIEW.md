# Independent visual review

Verdict: approved as a draft source and composition library, with the integration limits below. No outstanding image-generation blocker found. Final-ready signal received after all 86 sources froze; reviewed the refreshed source boards and all 28 scene candidates, the 12 Crownfall intro candidates, camera variants, and the revised open-road and forge placements.

Scope: read brief.json, prompt-prefix.txt, GENERATION.md and the shared style guide. Visually examined all 86 new sources across the five final source boards; directly examined 12 initial street sources, three replacement street grounds, 12 forest/mountain/cave-approach sources, the three enclosed-interior grounds, and the special-room sources including throne, volcanic castle, cinder stair and astrologer furnishings. Source generation and byte/provenance validation remain the main agent's responsibility.

The retained ground images are floor-only. Earlier stale boards showed fences, fixtures and masonry in three urban ground layers; current direct PNGs and refreshed boards confirm those were replaced. Props have complete solid silhouettes in their source canvases. Small alpha margins and faint edge residue do not constitute source cropping. Viewport cropping of nearby side architecture is intentional and successfully communicates player-height proximity.

All 28 composites retain an open central combat corridor. City, desert, jungle, snow, village and painted-night streets read from inside their streets. Night material values and localized warm lamps are genuinely distinct from daylight. Cave, tunnel and dungeon scenes remain enclosed. Castle walls, fortress gates and great tree convey close monumental scale. Throne remains visible above the center ground line; the volcanic/cinder and astrologer rooms are clearly distinct locations. Portrait, landscape and ultrawide camera examples preserve usable central space. The revised open-road placement reveals the complete blank sign and recognizable fence; revised forge placement reveals the workstation rather than relying on a cropped building edge. Rain remains a separate overlay example.

Checked modules/intro-map.json independently against content/source/worldAtlas.json: all 12 Crownfall node IDs, display names and types match actual atlas locations. This includes the starting city, Blacksmith, Old Market, Wayfarer's Inn, Chapel of Embers, Royal Archive, Road Warden and five regional gates. Gates correctly remain Crownfall gate scenes rather than being moved into destination biomes. Shared gate imagery is explicit reuse. Mapping is candidly candidate-only; it does not claim production wiring.

Remaining draft limits:

- Hard, nearly straight ground/backdrop joins and mismatched floor/backdrop illumination remain visible, especially in dungeon corridor, tunnel and astrologer scenes. Some distant architecture therefore reads slightly sunken behind the foreground plane. This requires composition/anchor/light registration before polished production use; it does not require discarding otherwise complete sources.
- Fine material realism and some polished backdrop flooring are stronger than the style guide's broad matte painted ideal. The family is coherent, but this is not a claim of exact brushwork matching.
- Several isolated facades and rock silhouettes have much less than the requested generous source overscan. Faint low-alpha/color edge residue appears in raw transparent previews; it is not prominently visible at the reviewed composition-sheet scale. Production alpha cleanup and motion overscan remain per-asset work.
- Nearby side props intentionally extend beyond viewport edges. This is appropriate framing, not proof that every source will tolerate arbitrary future camera motion. Only the displayed camera variants were visually checked.
- Crownfall services and gates intentionally reuse multiple scene layers; the 12 candidates are a faithful location mapping, not 12 wholly unique paintings.

No edits were made outside this review file. No production runtime binding, commit or publication was performed by this reviewer.
