# Music folder

Drop your own tracks here to replace the built-in generated score. Everything is
optional — any context you leave empty keeps the procedural music, so you can
override just the battle music if you like.

## Setup

1. Put audio files (`.mp3` or `.ogg`) into the per-context subfolders below.
2. List them in [`manifest.json`](manifest.json) under the matching context.
3. In-game: **Settings → Audio → Music folder**, enter the path/URL to this
   folder (e.g. `music/` when the game is served from the project root, or a full
   `https://…` URL). Leave it blank to use the built-in generated score.

The game fetches `<folder>/manifest.json`, then for each screen plays a **random
track** from that context's list, picking a fresh one each time the track ends —
so a set of tracks rotates with variety. A missing manifest, missing file, or
playback error falls back to the generated score for that context.

## Folder structure

```
music/
  manifest.json
  title/     one or more menu themes
  map/       overworld / act-map ambience
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
