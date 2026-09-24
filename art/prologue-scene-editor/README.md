# Opening scene editor preview

Run the local authoring preview with:

```sh
node tools/serve.mjs --port 8186 --no-open --no-lan --editor-write
```

Open `http://localhost:8186/art/prologue-scene-editor/preview.html`. The first-step scene can be staged on desktop and mobile with a drag box around the traveler, direct painting focus dragging, an optional grid, and configurable snapping. `Save first-step defaults` writes the changed first-step fields and editor grid preferences to `content/config/ui/screens/prologue.json`, then rebuilds `src/config/generated/ui.js`. Those defaults reach players in the next published build; the local authoring route does not run without `--editor-write` and only accepts same-origin requests from loopback.

Other scenes continue to use the repository's authored defaults. Editing them in this standalone preview is temporary; editing them in the game's settings saves a personal profile override. Caption height and title-banner container controls are under Readability for every scene.
