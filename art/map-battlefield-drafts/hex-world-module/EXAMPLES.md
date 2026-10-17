# JSON structures and examples

These excerpts show the relationships. Copy the complete [tile template](templates/tile.template.json) when adding a tile; partial excerpts are not standalone schema-valid tiles.

## 1. Tile identity and art choices

[Bridge B2](tiles/bridge.json) is a riverbank tile with a road crossing. `orientationSteps: 1` means 60° clockwise.

```json
{
  "id": "bridge",
  "position": {
    "column": 1,
    "row": 1,
    "label": "B2"
  },
  "biomeId": "riverbank",
  "tags": [
    "bridge",
    "road",
    "river"
  ],
  "orientationSteps": 1,
  "mapArt": {
    "terrainPoolId": null,
    "propsPoolId": "map-bridge",
    "rotateTerrainWithTile": true,
    "keepMapPropsUpright": true
  },
  "art": {
    "groundPoolId": "bridge-ground",
    "skyboxPoolId": "open-sky",
    "propsPoolId": "no-props",
    "filtersPoolId": "time-of-day-filter",
    "weatherPoolId": "clear-weather",
    "spriteRotationDegrees": 0,
    "rotateBattleSceneWithTile": false
  }
}
```

## 2. All six local sides

These side tags rotate with the topology. They are authored directions before the tile rotation, not fixed world labels. The full file also declares the missing-neighbor policy on every side.

```json
{
  "sides": {
    "E": {
      "edgeProfileId": "bank",
      "tags": [
        "bank"
      ],
      "connector": null
    },
    "SE": {
      "edgeProfileId": "river-water",
      "tags": [
        "water",
        "river"
      ],
      "connector": {
        "kind": "river",
        "flow": "out"
      }
    },
    "SW": {
      "edgeProfileId": "dirt-road",
      "tags": [
        "dirt",
        "road"
      ],
      "connector": {
        "kind": "road",
        "flow": null
      }
    },
    "W": {
      "edgeProfileId": "bank",
      "tags": [
        "bank"
      ],
      "connector": null
    },
    "NW": {
      "edgeProfileId": "river-water",
      "tags": [
        "water",
        "river"
      ],
      "connector": {
        "kind": "river",
        "flow": "in"
      }
    },
    "NE": {
      "edgeProfileId": "dirt-road",
      "tags": [
        "dirt",
        "road"
      ],
      "connector": {
        "kind": "road",
        "flow": null
      }
    }
  }
}
```

The resulting world connections are **road west/east**, **river entering northeast**, and **river exiting southwest**. Each must agree with its neighbor's opposite side.

## 3. A forest encounter pool

Enemy definitions live in [enemy-types.json](gameplay/enemy-types.json). A pool references those definitions and gives them weights. Here a wolf has four times a raider's selection weight; the tile's encounter probability remains a separate value.

```json
{
  "id": "forest-encounters",
  "selection": {
    "all": [],
    "any": [],
    "exclude": []
  },
  "enemyCount": {
    "min": 1,
    "max": 3
  },
  "replacement": true,
  "entries": [
    {
      "enemyTypeId": "wood-wolf",
      "weight": 4,
      "selection": {
        "all": [],
        "any": [],
        "exclude": []
      }
    },
    {
      "enemyTypeId": "road-raider",
      "weight": 1,
      "selection": {
        "all": [],
        "any": [],
        "exclude": []
      }
    }
  ]
}
```

The [forest tile](tiles/forest-road.json) links this pool through `gameplay.encounterPoolId`. Art selection does not implicitly spawn an enemy.

## 4. A map-fragment reveal

A reward references an effect; the effect references this rule. This example reveals **B2 → C2 → D3** without marking them visited or exposing entry-triggered discoveries.

```json
{
  "id": "connected-fragment-reveal",
  "mode": "connected-patch",
  "tileIds": [
    "bridge",
    "forest-road",
    "rest-camp"
  ],
  "visibilityResult": "revealed",
  "revealsFogOnly": true,
  "triggersOnEnterDiscoveries": false,
  "marksVisited": false
}
```

The separate road-map rule reveals **A2 → B2 → C2 → D3**, and validates that consecutive tiles share road connections.

## 5. Sparse discoveries and layered rest

```json
{
  "id": "sparse-road-discoveries",
  "seedScope": "runId + tileId + discoveryId",
  "rollOnce": true,
  "spawnChance": 0.2,
  "revealTrigger": "on-enter-tile",
  "fogExplorationIndependent": true,
  "entries": [
    {
      "kind": "trainer",
      "refId": "westwatch-trainer",
      "weight": 1
    },
    {
      "kind": "rest",
      "refId": "road-camp",
      "weight": 2
    },
    {
      "kind": "loot",
      "refId": "travel-supplies",
      "weight": 3
    }
  ],
  "spawnsEnemies": false
}
```

The sparse discovery example rolls once per run/tile/discovery with a 20% spawn chance. A failed roll remains a failed roll; re-entering should not reroll it. The authored module describes this behavior; a runtime must implement and save it.

The rest definition overrides battlefield art with a forest ground, forest background and separate tent prop. The named safe camp has zero encounter risk:

```json
{
  "id": "road-camp",
  "productionBinding": null,
  "healFraction": 0.35,
  "usesPerRun": 1,
  "encounterRisk": 0,
  "battleArtOverride": {
    "groundPoolId": "forest-ground",
    "skyboxPoolId": "forest-sky",
    "propsPoolId": "rest-camp-props",
    "filtersPoolId": "time-of-day-filter",
    "weatherPoolId": "clear-weather"
  },
  "artSelectionContextTags": [
    "rest",
    "forest"
  ]
}
```

Save visibility, collected loot, rest uses and encounter completion under `runtime/`, separate from the authored tile and shared catalogs. See [VISION.md](VISION.md) for the proposed editor and runtime workflow.

## 6. Reward and level choices

The tile references `gameplay.levelBandId`, while reward definitions keep their own drop eligibility, rarity label and repeat policy. See [the reward/level guide](REWARDS-AND-LEVELS.md) for the full tables.

```json
{
  "id": "proposed-legacy-relic",
  "productionBinding": null,
  "name": "Legacy relic",
  "category": "relic",
  "rarity": "epic",
  "dropLevelRange": [
    7,
    10
  ],
  "repeatPolicy": "once-per-run",
  "description": "Proposed signature dungeon reward; effects and unique identity remain unbound."
}
```

## 7. Map object mapping

The [map-component guide](MAP-COMPONENTS.md) shows how a tile references an object instance, the instance references a component, and the component selects icon variants plus gameplay defaults. All 39 map icons are covered by the generated [portable mapping](map-component-mapping.json).

## 8. Touching edge profiles

A `dirt-road` edge requires the complete `["dirt", "road"]` signature on its neighbor's opposite-facing edge. See [GENERATION.md](GENERATION.md) for transition examples, rotation filtering and a generated nine-hex layout.
