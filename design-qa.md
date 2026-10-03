# Reading Desk local implementation QA

final result: passed

This result covers the local Reading Desk adaptation and its primary actions.
It does not certify the complete game bundle or pixel-identical reproduction
of the concept's fictional deck. The full bundle remains blocked by the absent
pinned art pack; recovered assets still need the normal art-release path.

## Visual truth and evidence

- Source: `docs/design/deck-editor/reading-desk.png` (1488 x 1058) and
  `mobile-inspect.png`, `mobile-browse.png`, `mobile-folded-list.png`.
- Implementation: `http://127.0.0.1:4340/deck-reading-desk-preview.html`.
- Desktop: `docs/design/deck-editor/implemented-desktop.png`, 1488 x 1058 CSS
  viewport, density 1, Shield Defend selected from the collection.
- Phone: `implemented-mobile-browse.png`, `implemented-mobile-deck.png`,
  `implemented-mobile-inspect.png` in the same directory; 390 x 844 CSS,
  density 1. The 853 x 1844 source was compared at the same portrait aspect.
- Additional smaller-screen inspection: 360 x 640; Done remained inside the
  viewport and the document had no horizontal overflow.
- Source and implementation images were opened together for direct comparison.
  The phone inspection image is the focused card/action comparison. Names,
  rules and buttons are readable at the shown size, so no extra crop was needed.

## Fidelity surfaces

- Typography: Georgia serif names and rules, warm cream headings and restrained
  gold hierarchy. The reference supplies no exact font metadata. Native card
  type, tag and resource labels are preserved.
- Layout: library / large card / deck columns with independent scrolling.
  Main action and Cancel/Done stay outside those scroll areas. Phone views use
  explicit tabs instead of nesting another modal inside the editor.
- Colors: dark brown/black, gold selection and action states, blue cost badges,
  subdued existing city artwork. This screen scopes its gold primary color;
  other game controls retain their existing appearance.
- Imagery: recovered card paintings are attached to reviewed card IDs and
  equipment profiles. Outline artwork remains on unpainted cards. All five
  images present in the inspected desktop DOM loaded successfully.
- Copy: actual names, costs, rules, locks and ownership from the Reaver run.
  Its 11 cards and 3-Block Shield Defend intentionally differ from the mock's
  sample 10-card deck and 7 Block. Source glossary semantics come from the
  game's shared tooltip glossary.

## Comparison history

| Finding | Priority | Correction | Evidence |
| --- | --- | --- | --- |
| Deck metadata ran beside names | P2 | Explicit name and metadata grid cells | Final desktop and phone deck captures |
| Native card text too small | P2 | Scoped reading sizes and expanded illustration share | Final desktop and phone inspection |
| Kit color overrode gold actions | P2 | Scoped shared positive-control tokens | Final captures |
| Two rows appeared selected through stale controller focus | P2 | Keep native focus and controller focus synchronized | Final browser selection state |
| No persistent keyword explanation | P2 | Reuse shared glossary as visible reading content | Final Shield Defend inspection |

No actionable P0/P1/P2 findings remain for this first local adaptation.
Decorative filigree, exact raster textures and the mock's illustrated empty-drop
ornament are not reproduced; native card anatomy and explicit row controls are
intentional. The source mock is not used as a flattened clickable background.

## Interaction evidence

- Clicking a row changes inspection without changing the 11-card deck.
- Add changes 11 to 12; explicit removal returns 12 to 11.
- Search for Gorefire shows one collection row; clearing restores all rows.
- Equipment-owned Guard Counter is inspectable; removal stays disabled.
- Mouse drag from the library into Your Deck changes 11 to 12.
- Cancel after an edit restores the opening 11-card run on reopening.
- Collection, Inspect card and Your Deck phone navigation exercised.
- No errors or warnings in the final checked browser page.
- 73 focused tests passed, including 588 assertions inside the card-model suite.
  Content-generation check and whitespace check passed.

## Remaining acceptance

- Owner review of this first visual implementation.
- Physical phone touch and controller use. Pointer/held/reorder paths are covered
  by DOM tests; no physical-device acceptance is claimed.
- Full bundled game and remote CI after the art-pack prerequisite is supplied
  and recovered runtime images are published through the project's art pipeline.
