# Ashen Spire — board fidelity correction kit

This package corrects the missing card designs, named ability art, menus and icons in the earlier component collection. The twelve original October 1 boards are the visual reference. Open `index.html` to compare each new painting with its source detail and download individual components.

The correction contains **36 raster artworks and 146 native SVGs**: 26 ability versions, four class portraits, six inventory weapons, 79 interface skins and 67 semantic icons. Twelve surface recipes and source comparison sheets document their assembly.

The paintings are high-resolution reconstructions of the board subjects, not pixel-perfect screenshot extractions. Each has its own original PNG, prompt, source rectangle and review note. Twenty-six distinct ability versions are represented: nine combat-hand paintings, eight deck paintings, three draft paintings, three rewards, Steel Resolve, Guide's Strike and Surging Strikes. Combat and deck versions of Gorefire Slash and Dodge Roll have separate IDs because the boards show different art. **Deck Iron Guard is a descriptor-guided candidate marked `needs-review`; reference-based generation did not succeed.** Do not count that candidate as visually approved.

Four class portraits and six inventory weapon cutouts replace visibly different substitutions from the prior collection. The four portraits preserve the board's shadowed human Reaver, visible-faced Rogue, pale-haired Starseer and closed-visor Herald. They are illustration cutouts, not animation-ready combat sprites.

## Use the pieces

- `assets/abilities/`: standalone paintings without names, numbers, costs, frames or rules.
- `assets/portraits/` and `assets/objects/`: transparent cutouts.
- `assets/components/` and `assets/icons/`: editable native SVG card skins, menu forms, states and semantic icons. `vector-manifest.json` records geometry, source regions, live fields and art apertures.
- `assets/mobile/`: compact raster exports fitting within 640 pixels. SVGs are resolution-independent; mobile menus also need the distinct composition recorded in the vector recipes.
- `masters/`: original generator PNGs, copied unchanged. Full-size opaque WebPs use quality 94; full-size alpha cutouts use lossless WebP. Mobile exports use quality 92 and preserve alpha.
- `provenance/`: exact prompts, source roles, original output locations and original PNG hashes. Absolute locations in these historical receipts are provenance only; the gallery and delivered components use relative paths.
- `references/`: unchanged original boards. Source crops in the review are evidence, not game-facing artwork.
- `review/`: static source-versus-reconstruction sheets and assembled component examples. These are review artifacts, not runtime atlases.

There are **five separate card families**. Combat hand cards use round black/gold costs and colored type strips. Deck tiles use blue hexagonal costs and a parchment bottom plaque. Draft cards use round blue costs and a dark middle title. Rewards put their parchment title at the top. Forge cards retain the title-above-art folio layout. Apply the appropriate skin; do not replace all five with one generic ornate card.

Keep card names, values, rules, statuses, price/affordability, settings and selection state as live game fields. The concept boards contain illustrative copy and values; they do not override the game's data contracts. Keep icons and controls individually addressable. A decorative SVG's dimensions are not its touch target. Use the game's font sizing, focus, reduced-motion and control-hit-area settings.

The full-size paintings preserve the generator canvas. Fit them into the declared art aperture, checking the subject at the actual displayed size. Card titles and rules must remain outside the art layer. Portrait and equipment cutouts use `contain`; they have no authored combat ground, action or weapon anchors. The kit is a design-source package and has not changed the live game or the external runtime art release.

## Rebuild and validate

The Node scripts require `sharp` (or an existing module path in `ASHENSPIRE_SHARP_MODULE`). Python packaging uses only the standard library. No network, browser or repository checkout is needed to regenerate WebPs and verify an already-delivered package.

```text
node build-package.cjs
node render-vector-review.cjs
node render-filled-comparisons.cjs
node render-menu-comparison.cjs
python package.py
python package.py --verify
python package.py --zip
```

The initial authoring import uses `node build-package.cjs --adopt <staging-directory>` in the repository checkout. It checks every master against its generation receipt before copying. Regenerating native vectors uses `build-vectors.cjs`, which reads the included reference boards. Do not run authoring imports against unrelated directories.

The package checks distinguish file integrity from visual fidelity. Hash, path, dimension and alpha checks establish delivery integrity. Static comparisons establish bounded visual review. Browser behavior, physical-device layout, runtime binding and owner acceptance remain separate. See `COVERAGE.md` for explicit remaining differences.
