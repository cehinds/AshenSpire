# Combat Blight HUD verification

Regular-dev source preview, October 8, 2026. The screenshots use controlled
combat fixtures, not complete playthroughs or physical-phone acceptance.

`desktop.png` and `phone.png` show 35 Ashen Blight at 994×900 and 390×844.
`zero.png` shows that both the meter and former defense summary are absent at
zero. `qa.json` records solo checks at widths 1440, 994 and 390. The browser
checks cover 0 → 1 → 35 → 0, centered width, phone clearance, no horizontal
overflow, the Stand up control when prone and opening a pending Blight feat
chooser through a real pointer click. The controls paint above actor sprites.

`coop-qa.json` and `coop-phone.png` cover desktop and phone co-op using the
existing screenshot snapshot receiver. Both browser reports have no page errors.
The artwork and combat presentation remain regular dev's existing assets.
