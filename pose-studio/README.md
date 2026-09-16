# Pose & Effects Studio

Run `node pose-studio/server.mjs`, then open http://127.0.0.1:4318/pose-studio/index.html. On Windows, double-click **Start Pose Studio.cmd** for a separate application window. Node 22+ is required; this is a locally served standalone application, not a native installer.

## Authoring

- Start in **Animate**: open **Start with a template**, choose an outfit and five, six or seven poses. PNG/WebP pose imports are supported. Templates replace the current sequence; Undo restores it.
- Drag any of 80 effects onto the stage, a pose frame or named cue. Click a library tile as a keyboard-friendly alternative.
- **Add effect** opens an inline library at narrow widths, leaving the timeline interactive. Tap an effect to insert at the playhead or use its **⠿ Drag** grip to drop it onto a pose, the preview or an exact time/layer. Done or Escape closes the tray and returns focus. New effects are immediately selected and shown.
- Select an effect on the canvas or its six-frame timeline strip. **Effect size**, **Remove**, **Hide/Show**, **Duplicate**, starting time, duration and layer are visible beside the preview. Drag a corner to resize, the strip body to move it, or its edges to change timing. Delete/Backspace removes the selection outside text inputs; Undo restores it. **More controls** opens attachment, opacity and target travel. **Timing & precise position** reveals offset, duration, coordinates and rotation. Changing the starting moment resets its offset. Move it on stage, nudge with arrow keys, or move it across timeline tracks.
- **Preview zoom** scales the whole scene for inspection. **Pan**, **Focus character** and **Reset view** help navigate it; **Target** shows/hides the reference partner. View changes do not affect saved effect size or exported projects. **Larger frames** switches the timeline to a detailed horizontal scrolling view.
- Drag an anchor handle to adjust attachments. Use separate clips for layered effects; aura and behind/front tracks remain independent.
- Scrub or play with looping/speed controls. Reduced motion holds an effect frame; Reduce flashes suppresses effects while retaining the character outline preview.
- Bind the sequence to a provider/object kind/ID, resolved event and all/any/excluded tags. Payment filters use actual paid resources. Exact object rules outrank general rules; equal-priority matches are blocked and explained.
- In **Connect**, choose a real card and select **Connect this card**. This updates the selected rule without replacing your animation. **Tag combinations & advanced rules** exposes custom providers and tag conditions. Payment inputs explain matches and enable **Preview matched animation** only for a matching rule. Preset replacement is a separate, clearly labeled action.
- **Connections** shows the same binding records, with links back to editing. Preview facing/aura are display aids; in-game auras continue to follow gameplay rules.
- Drafts autosave in this browser origin. Undo/redo covers project edits. **Download project** saves JSON with referenced sprite images; **Open project** validates it before replacing the draft.

## Game and editor integration

**Preview in game** stores an optional local presentation project on this origin and opens the rebuilt game. Matching card activations add authored effects and, when the actor matches, temporarily overlay the authored pose strip. Existing effects and auras remain. Target-attached visuals require recipients supplied by the confirmed-outcome caller. Clear the override with **Clear game preview**. The override is per browser profile/origin and does not change game content or other players' preferences.

The standalone editor is [Spire Studio](https://github.com/cehinds/spire-studio). Connect this checkout as a project there, open **Plugins → Import manifest**, and choose `pose-studio/plugin.json`; the registration is staged into `editor/workspace/plugins.json` and saved with a backup. Spire Studio's preview scanner also discovers `art/pose-studio/index.html` on its own, and the workspace then runs on the editor's isolated preview origin (it cannot reach the editor's file API). Spire Studio's own Animation workspace imports packages exported by the separate Pose Studio desktop application (`pose-studio.package/v1` ZIPs and `ashenspire.pose-sequence/v1` JSON) as animation documents; presentation projects authored here (`schemaVersion: 1` with `poses`, `clips`, and `bindings`) keep their own format and are not converted. No file in this checkout is rewritten by that integration.

For service packages or additional game event providers, `integration.mjs` exports `createPresentationAdapter(project, {catalog, render})`. Dispatch an event containing a unique confirmed `id`, `provider`, `kind`, `objectId`, `event`, `tags` and actual payment amounts. It produces frames through `render`, prevents duplicate receipt playback and exposes `stop`. Host adapters still own mechanics, recipient mapping and drawing. Cards are connected to the built-in game hook; other providers require this explicit adapter integration.

The project schema and resolver live in `src/model/presentationSequence.js`. Entity/tag strings reference existing IDs; the editor does not silently add gameplay properties or alter property inheritance. A package contains one reusable sequence with multiple bindings. Open another package or use presets to work on another sequence. Arbitrary scripting, a multi-sequence library database and native installer distribution are not included.

## Distribution and tests

`node pose-studio/package.mjs` assembles `build/pose-studio-app/`, including the application, shared modules, referenced libraries and current standalone game. Run its launcher without the repository. Package export from the UI saves an authoring project, while this command packages the application itself.

`node --test pose-studio/tests/model.test.mjs` checks schemas, cue timing, payments, conflicts, asset frames, undo and service-event deduplication. `node pose-studio/tests/direct-editing.mjs` checks mouse/touch sizing, removal, timeline dragging/trimming, zoom, undo and portable persistence. See [the tool comparison and interaction review](UX-REVIEW.md). `node pose-studio/tests/browser.mjs` exercises editing, package round trips, accessibility, desktop/phone rendering and game overrides. Set `POSE_STUDIO_PLAYWRIGHT` to a Playwright module if it is not on Node's module path, `CHROME_PATH` to the browser executable, and `POSE_STUDIO_EVIDENCE` to a screenshot output directory outside the repository.

The 24 additional six-frame WebP sets are original vector-derived artwork. Their readable recipes are `new-effects.mjs`; exported images live under `assets/pose-effects`. These subtle overlays complement the original painted library.
