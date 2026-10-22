# Authored game content

This folder holds source JSON and CSV tables for game content. The game reads
compiled modules under `src/content/`; edit the source table here and run
`node tools/content-build.mjs` to regenerate its projections. Do not hand-edit
generated content modules.

The [content authoring quick reference](../../CONTRIBUTING.md#adding-content-quick-reference)
lists the file for each kind of content. The longer walkthroughs and compiler
checks are in [DEVELOPER.md](../../DEVELOPER.md), and the directory's table
conventions are summarized in [`CONTENT-NOTES.md`](CONTENT-NOTES.md).

For Visual Studio tasks and one-file-at-a-time recipes, see the
[manual editing map](../../docs/MANUAL-EDITING.md). Use readable named icon IDs
from `src/content/uiIcons.js` in authored `icon` and `glyph` fields.
