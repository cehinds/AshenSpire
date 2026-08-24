# Issue #230 Quick Menu evidence

Exact-build evidence for the promoted Mirror Quick Menu and shared Fullscreen/Music controls.

- Base: `dev@69fdbc99aea853ba85e1f08b3bacde134d648dbe`
- Candidate BUILD: `0.4.0.1265` · source digest `e19fe5f9e5`
- Artifact SHA-256: `a4496109e731db4f9c059943175521e37bc1f3c30d691ea0b84185c74289c6ea`
- Shapes: `390x844`, `844x344`, `1200x730`
- Text sizes: M and XL
- States: Mirror map, Music off, combat, overlay, legacy Off, Switcher, and component-catalog control shots

The focused browser gate passed 284/284 checks across all six viewport/text combinations. Music ownership/parity passed 27/27 with 14/14 same-door plants. Fullscreen passed 9/9 with 3/3 plants. Screen reach passed 11/11 at the focused `390x650` shape with 8/8 same-door plants. The complete Node suite passed 108/108. Visual review confirmed the Quick Menu remains readable and internally scrollable at phone and short-landscape sizes; Fullscreen and Music are the first controls; Save and Save & Quit remain the final actions.

Boundary: no physical gamepad was attached; the browser gate drove the shared keyboard/controller navigation analogue. The broader release-shot run reaches this Quick Menu but remains RED on inherited `dev@69fdbc9` customize-stats and compendium-held fixtures. Release remains RED.

## SHA-256

| File | SHA-256 |
|---|---|
| `1200x730__component-catalog.png` | `c4f0482baba20bde50c52efd45b479a182fafe500c2e77c1b878fadcad9e2f14` |
| `1200x730-text-m__mirror-combat.png` | `4d7170c7ca69e502ae81e71852dd26d8fba3e7555907f8846e4c594726c9b257` |
| `1200x730-text-m__mirror-map-music-off.png` | `891eaf774cb5be6268decad9dc0f5481e570efe218266b2e70df748f0d74875b` |
| `1200x730-text-m__mirror-map.png` | `cf986dde46f420a9d499997bfbdf4b86996524673b0c87823520e706895942cf` |
| `1200x730-text-m__mirror-overlay.png` | `36cee56988dc246177ab5622abd7e343f83a82a25d2be7dced1e44a8d699af16` |
| `1200x730-text-m__off-map.png` | `b467b45c79aca79f8bec3da7c4d4d0762a51c35463f79eb088700cc85f2fd7bf` |
| `1200x730-text-m__switcher-overlay.png` | `67a46eb6c2809fa37f6e4dbe5a9e5bb5660d7127b40e1e7518a20dc38cbe62ae` |
| `1200x730-text-xl__mirror-combat.png` | `86a089ddbc317bf18e638a608990682d5289578913dbbdb10a39de826c3fcc24` |
| `1200x730-text-xl__mirror-map-music-off.png` | `14a552f46b5e2bae02f72d22b5142f5340639f1bb9fe5e4fb53462c564e9610f` |
| `1200x730-text-xl__mirror-map.png` | `7c197fb9533e7ee0b6fc96f52f2f7b072e6eee9f3ec8350d2663d04a64bf1be3` |
| `1200x730-text-xl__mirror-overlay.png` | `7b96bff4b0a06c86d5a4ebf7ef2acefb0e43e3c2af0a41056884268b09f5a1cc` |
| `1200x730-text-xl__off-map.png` | `f2d61e74d1d840b96af37cd5b96ecec67fcb024a3a680343edbce26f4d8118f0` |
| `1200x730-text-xl__switcher-overlay.png` | `d26e0f1ff23b18e964f17a9d9763b92be6c3f4a9c7465e8636307bb1e6dc845b` |
| `390x844__component-catalog.png` | `fc6c1c866e18d2f18e4a2fc9fdd28d79fd24152cd1f73d2f7f63aef17550f6d2` |
| `390x844-text-m__mirror-combat.png` | `5e35e2dcc4fcd347df96664f85448a6db21e1dba867ba79dd395ae6d1ece2ab5` |
| `390x844-text-m__mirror-map-music-off.png` | `538a4c285dbbbb1f78a87dd8d14cd7ba9a317dd89745bf62c0895582bd738b0c` |
| `390x844-text-m__mirror-map.png` | `74439323df7b1feab66ddb7df47436b3ed796f5ca0d69300ba9528d46a80e644` |
| `390x844-text-m__mirror-overlay.png` | `53aaa14c4a58def50aa5ddc73b3d9a4571cb6b07363257efe999be779eeaff51` |
| `390x844-text-m__off-map.png` | `b9107b4820d5baa68b1f532d9bb234ea0e3f4f6a31bdb25765ee2d2fcceb4479` |
| `390x844-text-m__switcher-overlay.png` | `cce99e76e794f3aa40f182f073c9fa47f624a4bd1e74079c84094b502236cea7` |
| `390x844-text-xl__mirror-combat.png` | `1fd3c95ac29a1a5692a52b6a5d8c8a9209b001bc5b3fa38cc1ba34fe558cc63e` |
| `390x844-text-xl__mirror-map-music-off.png` | `cb8705b308ea36896d4d141e5f18e9e3c866174bd24cc6d3c6eb02712d12cddf` |
| `390x844-text-xl__mirror-map.png` | `6012be7a2bcbb7b3dfd15b0fe35506e096c3094a6bdfce64888da5e62b621072` |
| `390x844-text-xl__mirror-overlay.png` | `d02222029f5575af732f895d72cbfea7ab971c2bd3a29d0a35d4f8f0b853c2ff` |
| `390x844-text-xl__off-map.png` | `8341d096619f3a270772e94af08680bc5540adb4cd66af39feeca815650ed86b` |
| `390x844-text-xl__switcher-overlay.png` | `8fdb7d4e98a136c2a08d2cbef610ad20ae7bcabf34bdfba83b975d0999c1717d` |
| `844x344-text-m__mirror-combat.png` | `0fdbaf2ccd9c780aea79e6ab526552a46bc25de847b2040af2365c6670ab4ea7` |
| `844x344-text-m__mirror-map-music-off.png` | `36907bd507510af4c2fc8463a8c9876de7e4c40e394012cacea8a4c041777d15` |
| `844x344-text-m__mirror-map.png` | `453999974e90124c4a1f2d92c4462a279a75923bc6a3a9bfe69bcae5a6f97bec` |
| `844x344-text-m__mirror-overlay.png` | `364aecc6cabdc250bc80a74c7992390a57adbfbfb24ac7b0a207bb18a5032659` |
| `844x344-text-m__off-map.png` | `9787c16e2bae73ff6259fdc968913a1695477589aceb1e54c3760a1c5e413308` |
| `844x344-text-m__switcher-overlay.png` | `82d5dcc834870707da155bf57cfdcd927b5d4b7fe8940df842530363e89cc328` |
| `844x344-text-xl__mirror-combat.png` | `4cfd28b8b30198494de953a36ce25f95338dea1971d3b5690e84909b1842d386` |
| `844x344-text-xl__mirror-map-music-off.png` | `07d46584e31c8631dee3320e11c67d75478ba1d08c1149bf3151581a90dee155` |
| `844x344-text-xl__mirror-map.png` | `66d8bc2f2f09c2b2a67dc6008519e004f4eba9f006c65d17e6b084f1bfa2e8ec` |
| `844x344-text-xl__mirror-overlay.png` | `fd6ad2ec77b136b7f266731a6f85147ae233c890de103d204c1d394f2a65ea7b` |
| `844x344-text-xl__off-map.png` | `62017e95a2d36e0cccd16da8a786fe1d80b6f8ccdb0cc80584845b5f376f6c3d` |
| `844x344-text-xl__switcher-overlay.png` | `356337e03ba7deb79915218ab651ebe13eb90f7d306ef55c91149b690f0fc3d9` |
