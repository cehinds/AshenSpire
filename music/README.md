# Music folder

This folder ships the game's score. Every track is **written as code**: the
notes live in [`score/<id>.mjs`](score/) and `node tools/score/render.mjs`
renders them on the synthesizer in `tools/score/synth.mjs` into
`<context>/<id>.mp3` and rewrites [`manifest.json`](manifest.json). No samples,
soundfonts or licensed music are involved; the MP3s are build output, committed
so the game can stream them. The brief each score answers is in
[PROMPTS.md](PROMPTS.md).

Hosted and preview builds copy this folder beside the game, and with **Custom
music folder** blank a page served over http(s) plays it; a context without a
track keeps the procedural music. You can also drop your own tracks here, or
point the setting at another folder.

## Changing the score

1. Edit or add `score/<id>.mjs` (`export const context = '<manifest key>'`,
   `export default` a `Score` from `tools/score/compose.mjs`).
2. `FFMPEG=/path/to/ffmpeg node tools/score/render.mjs [<id> …]` (ffmpeg on
   PATH works too). Rendering is deterministic: the same score gives the same
   audio.
3. Commit the score, the MP3 and `manifest.json` together.

## Setup

1. Put audio files (`.mp3` or `.ogg`) into the per-context subfolders below.
2. List them in [`manifest.json`](manifest.json) under the matching context.
3. In-game: **Settings → Audio → Music folder**, enter the path/URL to this
   folder (e.g. `music/` when the game is served from the project root, or a full
   `https://…` URL). Leave it blank to use this folder beside the page (or the
   built-in generated score where it cannot be fetched, e.g. `file://`).

The game fetches `<folder>/manifest.json`, then for each screen plays a **random
track** from that context's list, picking a fresh one each time the track ends —
so a set of tracks rotates with variety. A missing manifest, missing file, or
playback error falls back to the generated score for that context.

## Folder structure

```
music/
  manifest.json
  title/     one or more menu themes
  map/       overworld ambience (fallback for every region)
             region keys map-hollow-weald, map-pale-marches, map-cinder-reach,
             map-drowned-coast, map-ashen-crown: the map's music where you stand;
             a region left empty plays the plain `map` list
  combat/    normal battle tracks
  elite/     elite battle tracks
  boss/      boss battle tracks
  shop/      merchant theme
  rest/      shrine of grace theme
  victory/   run-cleared theme
```

## Example `manifest.json`

```json
{
  "combat": ["combat/ashen_duel.mp3", "combat/erdtree_clash.mp3"],
  "boss":   ["boss/watchful_omen.mp3"],
  "shop":   ["shop/merchant_of_grace.ogg"],
  "rest":   ["rest/lost_grace.mp3"]
}
```

## Notes

- **Local files:** when the game runs from a web server, a folder like `music/`
  served alongside it works directly. When you open the standalone
  `build/EldenSpire.html` from `file://`, most browsers block loading audio from
  arbitrary local paths — host the folder (any local static server, or a URL)
  and point the setting at that.
- **Licensing:** only add tracks you have the right to use. The built-in score is
  fully generated in-code, so the game ships with no third-party audio.
- **Cross-origin:** remote URLs must send permissive CORS headers to play.
