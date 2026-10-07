# Alternative art export verification

The current alternative library contains 59 custom sprites and five scenery layers. Exporting the approved masters through the shared policy reduces those runtime files from 24,886,184 to 1,044,432 bytes. Sprites fit within 480px; scenery fits within 1280×720. Original masters and their validation coordinates are preserved. Runtime crop bounds are scaled with each raster, keeping the normalized crop and display geometry identical.

- Nine focused tests pass, including every catalog hash, actual WebP dimensions, no enlargement, normalized crop registration and the shared policy bridge.
- The initial complete pack and portable builds pass nine build-identity checks and twelve shipped-file checks. The portable build measures 99,186,248 bytes before adding this change's receipt.
- All 6,215 shared light files match the published `hd-assets-v14` manifest.
- `results.json` records the route bar at desktop, phone and narrow-phone sizes, plus combat at desktop/phone sizes. Destination inspection leaves route history intact.
- The final combat captures wait for the SVG or layered scenery to decode. Hollow Weald captures exercise all four alternative scene layers; Pale Marches captures exercise the shared atlas. Successful runs have no page exceptions or failed HTTP responses.
- The independent `external-play` network gate passes all 82 checks across seven cold-boot/title/combat/map views: zero broken images, zero failed requests, decoded CSS backdrops, fonts, map tiles and score tracks. See `network-check.log`.
- A separate cold direct-combat fixture run fell back to unresolved asset URLs while concurrent builds were active. Repeating the isolated run and the full map-to-combat sweep passed. These captures establish the tested rendered states, not a general performance or cold-network guarantee.

The screenshots show build `0.7.1.1056` (`ce6742e0b4`), before receipt-only changes. The alternative's authored layout and character designs are preserved. Physical-device/controller acceptance and unrelated unmerged combat-art work are outside this evidence.

![Alternative map](desktop.png)
![Alternative map on phone](phone.png)
![Shared scenery and alternative characters](combat-desktop.png)
![Hollow Weald layers](hollow-weald/combat-desktop.png)
![Hollow Weald on phone](hollow-weald/combat-phone.png)
![Source and export comparison](comparison.png)

[Component catalog](../../component-catalog.html) · [Export policy](../../ART-EXPORT-POLICY.md)
