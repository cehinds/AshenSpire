// tools/og-image.mjs — the share image every build's og:image names.
//
// THE SHARE IMAGE IS A PAGES PATH, NOT A REPOSITORY PATH (docs/EXTERNAL-ASSETS-PLAN.md,
// step 6a). It used to name raw.githubusercontent.com/…/main/assets/…, which stops
// resolving once assets/ leaves main. tools/pages-site.mjs writes `sitePath` at the
// site root from `source` in main's tree, so index.html's og:image (`url`), the
// file the site serves and the art it is cut from are named in this one place;
// tests/web-meta.test.mjs holds index.html to `url`.
//
// A PAGES-ONLY MODULE ON PURPOSE. tools/head-meta.mjs is a build-identity input
// (BUILD_IDENTITY_FILES in tools/buildversion.mjs), so a constant kept there
// would move every build's source digest whenever the site's copy of the image
// changed. The tag the build carries is still read from index.html by
// head-meta's headMetaTags(); nothing here reaches the bundle.
// Zero dependencies (Node core only); safe to import in tests.
export const OG_IMAGE = Object.freeze({
  url: 'https://cehinds.github.io/AshenSpire/og-image.webp',
  sitePath: 'og-image.webp',
  source: 'assets/bg/title-city-tower.webp',
});
