# Local implementation validation

Implemented on `codex/manual-shop-assets`, based on origin/dev
`6065710bbb81bd5fc33591951aa6c152aadd8eab`, in an isolated D: worktree.
The existing primary checkout was preserved. This is a local implementation;
no release, remote CI run, push, merge or deployment was performed.

Final local build: **0.7.1.813**, source digest `5b47a9d66e`.

## Checks

- Focused market addition, market review, shop wireframe and art-manifest tests:
  **55 passed**, zero failed or skipped.
- Configuration and content generation checks passed.
- Canonical mobile-art validation: **5,430 checks passed**, 5,429 twins;
  inline media 19,971,876 / 20,000,000 bytes.
- External pack verification: **195 checks passed**.
- Built artifact verification: **12 checks passed**.
- `git diff --check` passed.

## Rendered and interactive evidence

`qa/browser-results.json` records the production shop mounted with a disposable
visit: equal rows at 1200/593/390/320, correct column order, decoded artwork,
configured XP text, cancel, keyboard purchase, exact inventory/cinders/stock,
category retention, insufficient funds and all four book types. The preview
had no runtime or network errors.

`qa/built-browser-results.json` records the actual packed game: successful boot,
books and button loaded from content-addressed assets, equal rows without
overflow at 593/390/320, purchase removes stock, category persists, hold actions
commit once, and the sold-out state focuses Leave. Buy targets remain at least
44 CSS pixels tall after the game's mobile UI scaling. Desktop and mobile
screenshots are in `qa/`; `shop-detail.png` is the compact two-book preview.

The built game had no runtime or artwork-loading errors. It made two expected
404 probes for optional `holdTick_shopBuy.ogg` and `buy.ogg` samples; the existing
audio system uses its immediate synthesized fallback. These observed probes
are retained in the receipt rather than hidden in a blanket network claim.

Browser checks used headless Microsoft Edge. Actual phone hardware and the
full repository test suite were not tested.

## Asset release boundary

The four runtime WebPs and mobile twins are included in the source tree and
manifest. The local build used the documented automatic asset-tree fallback
to construct updated packs. The currently published external-art release does
not contain this new art. A future release/strict external-cache CI run must
publish the updated art packs and advance the corresponding release pin.

## Preview

Serve the worktree with `node tools/serve.mjs --port 8768 --no-open --no-lan`.
Open `/art/manual-shop-2026-10-02/preview.html` for the two-book preview, or
`/build/AshenSpire.html?shot=shop` for the built game. The dedicated preview uses
a disposable run and does not read or write user saves.

Run `node tools/skill-book-shop-browser.mjs` while that server is running.
`PLAYWRIGHT_MODULE` may select a shared Playwright installation and `CHROME`
may select the browser executable.
