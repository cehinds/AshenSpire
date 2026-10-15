# Full combat audit preview

These fresh screenshots show the integrated compiled game at source `368140ce27`, build `0.7.1.1530`, production commit `60e89f5ff8c4763552e62ebaf08830e26461b5b9`. Packed browser HTML SHA-256: `1d63824ea3d6df48d2909b31b595e48d63e46e2d4322f74e868371b92792c319`; art is pinned `hd-assets-v23`. The browser HTML uses matching linked art. The standalone download uses the same production source with media embedded and therefore has a different byte hash. Audit tools and reports added later do not change these production inputs.

The desktop menu and phone menu show primary **Quit** in the main list. Actual mouse and touch tests invoked it, handled a browser-blocked window close, then used **Return to title** successfully. Desktop also tested an allowed popup close. Both devices recorded zero browser errors. The Settings card sample is created only when its folded Preview is opened; card value projection uses a per-operation tag index and preserves independent pre-change value receipts.

| Screen | Evidence |
| --- | --- |
| Desktop primary menu | [Menu](menu-desktop.png) |
| Phone primary menu, Quit reachable | [Menu](menu-phone.png) |
| Reaver, paid Bashing Blow action | [Action](reaver-action.png) |
| Starseer, paid Bashing Blow action | [Action](starseer-action.png) |
| Rogue, paid Bashing Blow action on phone | [Action](rogue-action-phone.png) |
| Herald, selected Bashing Blow on phone | [Selection](herald-selected-phone.png) |

The four-class gallery uses ordinary class HP, resource pools and canonical default character art, not the large engine-audit capability pools. The full gallery verifies selection, a paid action and return to the supported held pose for all four classes on desktop and phone (8/8 cases). The selected Herald frame is selection evidence; the gallery's separate paid-action frame and receipt establish dispatch.

Current critical browser validation completes360 distinct cases, including264 all-enemy/class/device rows. The separately packaged standalone also passes the original Star Spark → Gilded Knight mouse/touch spell-target path, followed by end turn and a paid next-turn action. Its SHA-256 is `586c07905d157e2a77a2877c727c7c0751665c335c78f4c1ece4a9564dbc9f98`. No runtime errors or unexpected network failures were recorded.

[Coverage and reproduction](../../../tools/combat-audit/README.md) distinguish current production evidence from the earlier immutable baseline and name remaining state combinations. Bulk raw JSON and the remaining gallery frames remain in local scratch; the reproduction commands can generate them for artifact upload. The downloadable preview is published by the repository preview workflow; [PR1990](https://github.com/cehinds/AshenSpire/pull/1990) carries the verified artifact link when available. Local port4414 is a QA server, not a published preview.
