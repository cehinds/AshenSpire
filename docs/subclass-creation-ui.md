# Starting subclass creation UI

The Class page chooses a base class and one of its two opening subclasses. It
keeps the existing category order: Class, Attributes, Keepsake, Equipment,
Feats, the conditional Spells page, and Review. Feats remains a progression
browser and grants no feat at creation.

The subclass selector uses the shipped soot material, gold trim, and registered
engraved icons. Both choices are native buttons. A choice takes one activation
and retains keyboard focus; the selected subclass's complete description stays
visible. Changing the base class replaces stale subclass choices with that
class's authored default. Changing the subclass rechecks hands and starting
abilities, rebuilds their controls, and refreshes the opening deck.

The deck preview renders the engine's `stampedSubclassDeckPreview` references, preserving
every copy and its `openingSource` and `openingRole`. The player can inspect each
of the eleven cards through the standard full card inspection door. Its four
source groups show five subclass cards, one class card, one weapon art, and four
basics. Chosen starting spells replace their recipe slots; they do not append
extra cards. Review shows the class, subclass, and the same deck receipt, and its
Class edit action returns to both selectors.

Draft previews accept zero picks or a partial starting-ability selection. They
use the current settings for eligibility and copy limits. Temporarily invalid
retained choices, such as those held while a point-buy dialog is open, preview
the authored recipe without mutating the choices that Cancel restores. Begin
and actual run creation still require the complete legal selection.

The lobby reuses the compact subclass selector for the connection owner and
each couch seat. The new UI sends an explicit choice in hello, pick, and local
seat messages, and a base-class change selects that class's authored default.
Roster seats from older clients that omit `subclassId` show their base class
without acquiring an opening subclass.

UI copy is authored in `content/source/uiStrings.csv` and compiled through
`node tools/content-build.mjs`. The run payload carries the explicit
`subclassId` through `beginPreparedRun` into `createRunState`; callers omitting
that field retain the core model's legacy behavior.

Production catalog links:

- `index.html?shot=components#folio-creation-subclass-selector`
- `index.html?shot=components#folio-creation-subclass-tile`
- `index.html?shot=components#folio-creation-starting-deck`
- `index.html?shot=components#folio-creation-starting-deck-group`
- `index.html?shot=components#folio-creation-starting-deck-card`
- `index.html?shot=components#folio-creation-starting-card-inspector`

Use `?shot=customize&shotClass=starseer&shotSubclass=frostMonarch` to pose a
specific choice. The production QA tool,
`node tools/character-creation-components-qa.mjs --out <directory>`, checks touch
taps at 390 × 844 and mouse clicks at 1440 × 900, subclass selection, all eleven
visible copies, card inspection, focus return, and independently linked parts.
It records results only after the actual browser interactions pass. A source
preview that cannot finish boot must be reported as unverified rather than
treated as successful visual or touch evidence.
