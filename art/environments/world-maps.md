# Connected world maps

Three complete world paintings contain all five biomes in continuous geography.
The Fractured Realm connects a ruined central kingdom to northern ice, western
forest, eastern volcanic terrain and a southern coast. The Shattered Gulf wraps
those biomes around a navigable-looking inland gulf. The Fivefold Frontier uses
branching river valleys around a central plateau.

The current renderer selects one world from the run seed. That choice remains
stable through floor and act changes, save/load, and map zoom. Solo discovery
still reveals circles around known nodes; the artwork contains no baked fog or
node markers. The earlier individual biome paintings remain available as source
art for future local views. Combat backgrounds keep their existing selection.

## Future junction design

Mountain passes, river bridges, viaducts and coastal causeways are visual places
where a later route graph can offer a choice of biome. Branches should be able to
rejoin and cross into neighboring biomes at more than one junction. A future
node's biome should determine its enemy pool and corresponding combat backdrop.

These are design intentions, not implemented navigation rules. Current generated
nodes are overlaid on the world art and do not yet follow painted roads or
biome boundaries. Before implementing junction travel, define node biome IDs,
allowed connections, encounter pools and cross-act persistence in SPEC.md through
the repository's separate mechanics-spec workflow. The paintings alone do not
change any encounter or unlock additional movement.

World PNG masters live in art/environments/worlds; the environment asset builder
encodes their WebP runtime textures. All artwork is original generated art.
