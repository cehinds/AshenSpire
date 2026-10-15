# Game configuration

The default game.json inherits the full Ashen core bundle. presets/current.json selects the unchanged legacy adapter. Edit the one author JSON or referenced source packs. Omitted bundled features inherit; false explicitly disables; true restores bundle defaults; object values merge module defaults, bundle overrides, then author settings. Arrays replace. $comment metadata is ignored for gameplay hashes.

node tools/game-config.mjs validate --input games/ashenspire/game.json
node tools/game-config.mjs build
node tools/game-config.mjs export --input games/ashenspire/game.json --out build/game-config/ashenspire/core.json
node tools/game-config.mjs apply --input /path/to/candidate.json

Apply validates before atomically replacing game.json. Export is an explicitly host-dependent adapter snapshot and must not be described as portable gameplay; --portable rejects required legacy-adapter capabilities.
