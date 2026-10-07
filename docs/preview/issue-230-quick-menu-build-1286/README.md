# Issue #230 Quick Menu evidence

Exact-build evidence after integrating `dev@604ad63983772e6b6c88420216b1e0bf99991784`, the live-overlay dependency `3f0d10e59954d94b8a034b8df4370009bc3101ee`, and the title-Profile/build-ink gate repairs.

- Candidate BUILD: `0.4.0.1286` · source digest `0fc4db086c`
- Artifact SHA-256: `5ce51d6accd6c62db5e93e542f02e35261df513e613e6d44c4475c10235ea881`
- Evidence: 38 PNG files
- Shapes: `390x844`, `844x344`, `1200x730`; text sizes M and XL
- States: Mirror map/combat/overlay, Music off, legacy Off, Switcher, and component catalog

The focused browser gate passed 284/284. The complete Node suite passed 108/108. The restore driver passes through the title-screen Profile route and verifies both title-HUD and Settings Music state. Build ink remains visible on phone and desktop.

Boundary: no physical gamepad was attached. No release or deployment is asserted.

## SHA-256

| File | SHA-256 |
|---|---|
| `1200x730__component-catalog.png` | `228e4ff5b233ae105ce295b093d52cbd8810348ed34dacde9ecb7285de03dc4d` |
| `1200x730-text-m__mirror-combat.png` | `0d3cc994111a717f8a5365fd435bbc5e5d3690d8af1b9a627a46b37df57c546f` |
| `1200x730-text-m__mirror-map-music-off.png` | `d8df0028fbc1484a9ea542c5c80165e1e663d1ded6e4f366bc6729a3eadcd7ea` |
| `1200x730-text-m__mirror-map.png` | `b6e9c85f37e1a8a0068ce9e5b700195036aa8324c54cab1d2f0fa3cae5f44d16` |
| `1200x730-text-m__mirror-overlay.png` | `d51d0de3fdfdd864683630536a080310b72c735d1d68c462d76ba574ec659c61` |
| `1200x730-text-m__off-map.png` | `8c422fbb1227d862a6a95a95ac3b74bcc364810231745c8387d1b81504abbb9d` |
| `1200x730-text-m__switcher-overlay.png` | `ab6792494153e98a225538b49fbee595b53aad124311a6846a0cf1cabf88ea03` |
| `1200x730-text-xl__mirror-combat.png` | `1a298c2ddc937a406a3f553c88759e346c0c5a678b8e889c2abd518d84e6520c` |
| `1200x730-text-xl__mirror-map-music-off.png` | `5148d29066fc62ccefe92e3e5f03391ec8e7cb3555140783e97759bbe7246843` |
| `1200x730-text-xl__mirror-map.png` | `0dd3126e787af669cd0ac614856ffeea5e85b9a20863f45f1ac7d70518d6070c` |
| `1200x730-text-xl__mirror-overlay.png` | `ffc1c42ed5f3cb47f71e1f46b4013b61dbe45f5ef088d88e2824db82da24fb44` |
| `1200x730-text-xl__off-map.png` | `89d3d838b51be676773371e019ef3217c793291872e9e14d56be3d7b9d49aabf` |
| `1200x730-text-xl__switcher-overlay.png` | `154706a75f16714ddd43b2acf0f11848955c6404dda793e130583459a3e3aeef` |
| `390x844__component-catalog.png` | `6f2af619679fab5c1edfb36b05563774eb7f853e6927301a5e665a92b3d4e8c7` |
| `390x844-text-m__mirror-combat.png` | `61060254c51926659f973a56a354dd48cf8702f43b0eda7e6b70dda97710ebd5` |
| `390x844-text-m__mirror-map-music-off.png` | `af9aca6f8c73c435ef78e56d7f2f61d6ec75ce22a2d55c3e99238013065ebf04` |
| `390x844-text-m__mirror-map.png` | `258b89cb4d6f4e8422c3aa2dd2b04303aa22236ca755d70872e468bfcc00261f` |
| `390x844-text-m__mirror-overlay.png` | `4882738da246bf92bdb38aced83fc11b7a3c6fb1c2e3bc2cd57b1091e6177585` |
| `390x844-text-m__off-map.png` | `3b2b2437151d2140133155c5787105c1d6965e78e5d9177852790d4edb0e483f` |
| `390x844-text-m__switcher-overlay.png` | `f335d091cc341662c66d4dae88822f151bbf46011691369f0fa0d5071ab8bee5` |
| `390x844-text-xl__mirror-combat.png` | `6b6bfb5962cb9b95dafd3fdafeb623737770972e8117ca8121cc1758a17d1de8` |
| `390x844-text-xl__mirror-map-music-off.png` | `b86ff1c740dd0f3010b2e1eba932479b0b0ad542daec32f0543f5dd9e0c367a5` |
| `390x844-text-xl__mirror-map.png` | `11a7cada19ddcccf5cbb602d309a5814cf0a78ac29f870d1d327cb1358fa8de4` |
| `390x844-text-xl__mirror-overlay.png` | `b5997207b9e87032d24903ceb1cb28fde973276c1ac9ba829865f77e6c4eebda` |
| `390x844-text-xl__off-map.png` | `d35cbcae717c3dd56ab1fc31c833f8642e9b73045777b8c918c353be5cd7684d` |
| `390x844-text-xl__switcher-overlay.png` | `5b9e19607ee0e30fb6e59f6d26fca4970bafb63e27195f3ec5bf1c3994fc2be2` |
| `844x344-text-m__mirror-combat.png` | `f986e1749b2148998fc18baf9d7b8b429e84432966e3117626d51bd68632b065` |
| `844x344-text-m__mirror-map-music-off.png` | `3ba918e8e4f4acc288f08819cecd0671239a1cabfcab29fb41d92c102c8c1a9a` |
| `844x344-text-m__mirror-map.png` | `6e18fd63dbbcb2030d747cb11041f2a009adbf84f016f13d4bd82eebefa5208d` |
| `844x344-text-m__mirror-overlay.png` | `e336a40aeffe438cb4862b2ceade88b07269dd0650166ec9bad7e7eb9e2c305f` |
| `844x344-text-m__off-map.png` | `bc568faa6541be4b3249488f7d5a84a4f87177c17887d41d683c41ff2df87c4b` |
| `844x344-text-m__switcher-overlay.png` | `38e09953ccdfa5f300db517fffe0a36b034513b627ff0d818829076018f2ff78` |
| `844x344-text-xl__mirror-combat.png` | `25ba8f4a9f3e021fe5d69e6bac13a6031e90e3933b494e2c73869f284bc93549` |
| `844x344-text-xl__mirror-map-music-off.png` | `da1086520eeb8d7667257c4f03e3492108733cdd75b391ee1e287a2486718395` |
| `844x344-text-xl__mirror-map.png` | `d1f51bc0459f2acf248d7de5275dabbef37384ca7598d9c3bffbf1ca2d15bdef` |
| `844x344-text-xl__mirror-overlay.png` | `c593885d0e1363c5f5f8ab1c14d6a6506c57647acf11d063a9fd1b4b359c6744` |
| `844x344-text-xl__off-map.png` | `9dbf0b99a0d1f97c327172eaa5622255a829d2151f06517b228de17c9cc6778f` |
| `844x344-text-xl__switcher-overlay.png` | `aeff03417d75bfbc0ceef7e81c064bece34f345f225dc24b37f4e167bd7413fd` |
