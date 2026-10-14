# Approved combat option C

The owner approved **C · More breathing room** and the ten intent styles in
`approved-options.png` on October 8, 2026, then authorized implementation and
merge into both the primary and alternative dev/test channels.

The solo player is larger, shifted right and down, with cards overlapping at
the waist. Enemies are smaller and centered. The top HUD begins at the screen
edge and fades into the scene. Alternative combat omits the foreground framing
layer. Intent and selected-enemy plates use the HUD/footer leather texture,
matching widths, center lines, border colors, and outline styles.

Purple dashed: `?`. Gold dashed: `Attacking ?`, `Defending ?`, `Preparing ?`.
Solid red: `Attacking`, `Smashing`, `Countering`, `Casting`, `Buffing`, `Defending`.
Titles and icon/value rows are centered. The approved board uses example values;
runtime numbers come only from the observer's existing revealed projection.
Concealed moves never expose damage or Block. Counter damage labels the armed
base reaction, with its interpretation available through the intent tooltip.

Reproduce the live layout/input screenshots with
`node tools/combat-option-c-qa.mjs`. `COMBAT_QA_URL` selects the served build,
`COMBAT_QA_OUT` selects the evidence directory, `QA_WIDTH` narrows the viewport,
and `QA_SCENE` selects an authored scenery fixture. Screenshots are posed
combat fixtures, with actual focus, inspection, and Escape interactions.

Approved symbols: S1 Pointed shield and C2 Inner loop Counter. Card bottoms pair the shared action symbol with the authored card type name. HP counter damage uses crossed swords; Poise counter damage uses the hammer. Both values remain distinct when a reaction carries both. Schools and damage types remain available in Information and accessible card descriptions.
