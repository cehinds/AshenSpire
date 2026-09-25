# Painted armament catalogue

All 25 authored armaments have individual painted inventory illustrations: nine weapons, eight shields/off-hand tools and eight staves/sceptres. The PNG masters are preserved here. The 512px WebP copies at assets/equipment/icon_<id>.webp are consumed by the game's inventory, item detail and armory interfaces. Character-held weapon sprites remain a separate asset set.

The shortbow now has its own bow artwork rather than reusing the dagger icon. Its placeholder blurb was replaced with an appearance description; equipment stats and mechanics are unchanged.

Style: painted steel, weathered brass, dark leather and wood, restrained class accents, warm upper-left light, crisp distinct silhouettes, transparent backgrounds. Generated with the built-in image tool; prompts.json records the initial three illustrations and catalogue-prompts.json records the remaining 22.

Review /items-preview.html for searchable, filterable cards and details using production renderers and authored stats. tools/painted-items-check.mjs verifies all images, item selections, filters, shortbow routing and desktop/phone layout. Set NODE_PATH to your Playwright installation and PREVIEW_URL to your running preview server if different from http://127.0.0.1:4281.
