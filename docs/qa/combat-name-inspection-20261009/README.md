# Enemy name inspection and independent fighter selection

Test run 37999117386 at `f826bac5283bd1bce3d1972164d99ec5bc3558df`
reported enemy name buttons covered by their own fighter frame in every ordinary
combat layout. The centered 44px frame cap intercepted the center of the full
name button. Raising the whole name over that cap would instead split the
independent frame target into strips.

The correction moves only the enemy cap into the left side of the unchanged
104px footer. With no card or flask selected, the name center opens inspection
and the side core selects the fighter's contextual explanation. Existing
card/flask targeting, keyboard inspection, and overhead Information behavior
remain. This explicitly revises the historical central-footer selection choice.
The player cap, painted footer, actor placement, and full packed obstacle
footprint are unchanged. No screenreach or strict target predicate changed.

The focused source checks pass **17/17, zero skips**. The source-only composed
native fixture loads the actual production plate rule and candidate layer CSS;
at zoom 0.65, 0.738, 1, and 1.5 it verifies trusted name click, independent core
click, Enter inspection, the original 24px five-point patch, and rejection of a
covering inspection control. Its viewport is 390×650 and raw browser health is
empty. The native input helper chooses valid `::before` geometry; `::after` is
used only when that core is unrendered or invalid, not after an obstructed core.
Every hit still requires ownership, and the original frame-grid candidates stay.

[Native report](native-fixture-report.json), [source screenshot at zoom 0.738](fixture-0.738.png),
and [provenance](provenance.json) are retained here. The screenshot was visually
reviewed and shows the complete name and HP footer. It is a composed CSS fixture,
without actors or gameplay, and establishes no packaged-game or device acceptance.
The parent must rebuild and run the unchanged complete layout/target gates.

Original diagnostic receipts remain byte-preserved under
`D:/repos/.codex/outputs/combat-card-stances/name-inspection-1203-fix-20261009`.
They include the first source test's floating-point equality failure, an initial
fixture missing the plate rule, and a fixture run before mobile viewport metadata
was corrected. These are instrumentation results, not masked product passes.
All three owned browser profiles and the shared native lock were removed after
their respective runs; no owned browser remains.
