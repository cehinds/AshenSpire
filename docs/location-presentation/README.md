# Location presentation content

Edit `content/source/locationPresentation.json`, then run `node tools/content-build.mjs`. Stable IDs connect these tables to existing world nodes, regions and environment scenes. Tables can be imported/exported separately as CSV without encoding lists in cells.

- settings, times, weather: one row per vocabulary ID.
- profiles: profileId primary key; regionId and settingId foreign keys. A region/setting pair identifies one profile.
- nodeProfiles: nodeId primary/foreign key; profileId foreign key. No repeated region, setting, scene path or display name.
- scenes: sceneId primary/foreign key to the existing environment art catalog; timeId and weatherId foreign keys. Texture paths, crop rectangles and floor anchors remain in the existing catalog.
- sceneProfiles: composite key (profileId, sceneId); weight depends on that pair.
- music: musicId primary key; future audio asset metadata belongs here.
- musicProfiles: composite key (profileId, musicId); weight depends on that pair.

These relations use atomic values and store descriptive facts only with their owning key (3NF). Runtime save snapshots are resolved output, not additional authored sources of truth.

The resolver uses only compatible setting/biome pools. Time and weather are preferences, with explicit `timeFallback` in its result. Missing profiles return null for legacy runs; empty authored pools are invalid. Night is currently available only for paintings actually depicting night. Do not tag daytime art as night to silence coverage gaps.

Runs may set `presentationTimeId` and `presentationWeatherId`; defaults are day/any. World inspection and combat use the same node ID and presentation seed. World entry saves the selected scene; combat reuses compatible saved selections. Scene selection never consumes gameplay RNG or changes between turns. Traditional maps derive a profile from their biome and node type when an explicit atlas node mapping does not exist.

Music tables intentionally contain no invented tracks. `musicCandidates` exposes compatible IDs/weights for later playback and crossfades; it does not start audio.

## Adding content

1. Register the WebP scene and its genuine floor metadata in `environments.js`.
2. Add scene metadata, then one or more weighted sceneProfiles rows for settings it actually depicts.
3. Assign nodes using nodeProfiles. Renaming a node does not change its selection.
4. Run the content build and location-presentation tests. Preview each scene at desktop and phone widths.

Generate an exact day/night coverage report and spreadsheet exports:

```
node tools/location-presentation-report.mjs --out docs/location-presentation/coverage.md --csv-out outputs/location-presentation-csv
```

CSV exports are inspection/import aids. The JSON tables remain the authored source; copy edited rows back into their corresponding table and rebuild. There is no external database migration or new audio playback in this change.
