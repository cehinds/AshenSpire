# Automatic alternative development sync

Every push/merge to `dev` starts **alternative dev sync**. An hourly catch-up
also includes bot commits that cannot trigger another workflow, and the owner
can run it manually from `dev`. It fetches the latest `dev`, merges it into
`alternative/dev`, verifies the protected presentation, tests the result, creates
a downloadable source preview, then pushes normally. It never force-pushes.

`alternative/test` stays at its separately promoted revision. The pipeline does
not promote to `test`, `release`, or `main`.

## What stays from alternative/dev

The authoritative boundary is `.github/alternative-battlefield-policy.json`:

- Combat Studio code, desktop/phone defaults, layered composition and editor UI.
- Runtime presentation (`src/ui/`), styles, the page shell, authored UI config,
  its generated module and wireframe settings.
- The alternative build's run instructions.

Shared UI and CSS are deliberately held as well as combat-specific files:
the battlefield uses those shared HUD/card/footer components. Gameplay, content,
build tooling and other non-presentation changes still merge normally. A future
shared UI upgrade needs an intentional change on the alternative branch.

## Allowed artwork updates

- Background and sprite image files under the alternative masters/layers/library
  directories, their catalog metadata, library index, and package checksums.
- Normal upstream asset paths (for example `assets-mobile/`) and content art
  registries are outside the protected presentation boundary.
- The local background library is refreshed from the merged tracked backgrounds,
  environments and map assets. Existing custom sprite/scene files remain unless
  upstream actually edits those same files. It does not replace a custom Reaver
  design with an unrelated upstream sprite or reset any layout coordinates.

The pipeline compares Git blob IDs **and modes**, including protected additions
and deletions. New layout files cannot slip through. A rename across the boundary
or a conflict in gameplay/art/tooling fails the sync and leaves the remote
alternative branch unchanged. The failed Actions run identifies what needs review.

## Checks and output

- Git fixture tests exercise protected conflicts, additions/deletions, renames,
  ordinary changes, art updates, subsequent merges and fail-closed behavior.
- The generated UI config must still match its authored source.
- Combat Studio's geometry/layout model checks run on the proposed merged tree.
- The package and background index are rebuilt; a final protected-file check
  runs after generation, before committing or pushing.
- The run uploads a source preview archive plus a sync proof (source SHA,
  previous alternative SHA, and retained paths). Extract the preview and follow
  `docs/design/COMBAT-STUDIO-ALTERNATIVE.md` to run it locally.

This is a tested authoring/source preview artifact, not a production combat
deployment or a claim that the full game/browser suite ran. The existing optional
audio-pack limitation still applies to the lightweight local preview.

## Development checks

```sh
python -m unittest discover -s tests -p test_alternative_sync.py -v
```

Use a clean disposable checkout for a manual merge trial. The prepare command
leaves a staged merge for validation and review; it does not commit or push:

```sh
git fetch origin dev alternative/dev
python tools/alternative-sync.py --report /absolute/path/outside-checkout/proof.json
python tools/alternative-sync.py --verify --report /absolute/path/outside-checkout/proof.json
```
