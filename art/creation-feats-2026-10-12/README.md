# Original character-creation feat emblems

Reused first-party OpenAI-generated concept artwork from the approved Character Creation design. Original source: https://github.com/cehinds/AshenSpire/tree/7602ec929/tools/hud-component-studio/projects/character-creation/assets . No new generation or third-party artwork. No Creative Commons license is asserted for generated artwork.

The ten transparent PNG layers retain separate background, hollow gold trim, symbols and props. `layers.json` records exact original component geometry (105×117 design coordinates), z order and production asset IDs. Six WebP composites are rendered at four times the design size (420×468) for crisp tiles/details.

Rebuild from a game-layout root containing `assets/player-polish/ui/creation/`: `node art/creation-feats-2026-10-12/render.mjs <root>`. Set PLAYWRIGHT_MODULE/CHROME when needed. In the art repository, provide a root pointing at `hd/`.

These assets are staged for the established art intake/release route. No release pin or derived game manifest was changed. Preview the source using `node tools/serve.mjs --editor-write`; this server explicitly supports local authoring assets. Ordinary production builds retain registered-art fallback until a release is pinned.
