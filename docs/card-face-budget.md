# Ordinary card effect text

Every ordinary playing-card face, including selected and enlarged faces, uses
`cardFaceProjection` above the complete `cardFaceLines` facts. It selects at
most two complete short clauses, within three physical lines. The title,
stance identity, rank and resource flags have their existing separate places.
Stance entry and Defend restore explanations remain in Information.

The projection preserves the selected effect's conditions, probability,
payment floor and numeric preview marks. Secondary effects and longer
qualified clauses remain in Information. Complex cards use whole authored
sentences; a following cap or generated-card cost stays with its sentence.
It never takes a substring of a rule. `cardPlainText`, `cardFaceLines` and the
Information details retain the complete reading.

The renderer wraps clauses together rather than assigning one block per
semantic row. The fitter measures three physical lines and can omit a whole
secondary clause on a narrow face. It cannot expand this panel into artwork
or use a line clamp to cut a condition in half. A resize restores both clauses
before measuring again. The existing Information control opens all details.

`tests/card-face-projection.test.mjs` covers all authored cards at base,
upgraded, rank 1 and rank 5, live values, probabilities, payments and complex
fallbacks. `tests/card-face-wiring.test.mjs` covers all ordinary renderer
surfaces and the unchanged selected-card budget. Browser geometry checks must
also measure the actual wrapped text at desktop, phone and enlarged sizes.
