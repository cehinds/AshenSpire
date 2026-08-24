# Issue #230 Quick Menu evidence

Exact-build evidence for the promoted Mirror Quick Menu, preserved legacy modes, and shared Fullscreen/Music controls after integration with the shared HUD and Settings/Controls-only overlay.

- Base: `dev@604ad63983772e6b6c88420216b1e0bf99991784`
- Candidate BUILD: `0.4.0.1276` · source digest `86f3949ad3`
- Artifact SHA-256: `13651f813e1ef0e617c4dca80070266fa235926c55264f4e0cf5cd771d3079b0`
- Evidence: 38 PNG files committed beside this record
- Shapes: `390x844`, `844x344`, `1200x730`
- Text sizes: M and XL
- States: Mirror map, Music off, combat, overlay, legacy Off, Switcher, and component-catalog controls

The focused browser gate passed 284/284 checks across all six viewport/text combinations. Music ownership/parity passed 31/31 with 16/16 same-door plants. The complete Node suite passed 108/108. Fullscreen behavior is capability-backed and shared state remains synchronized across Settings, Quick Menu, and the title/map/combat HUD.

Each PNG's exact provenance is its immutable Git blob in the commit carrying this directory. The image names encode viewport, text size, Quick Menu mode, and state so individual captures can be replaced without changing the catalog contract.

Boundary: no physical gamepad was attached; the browser gate drove the shared keyboard/controller navigation analogue. No release or deployment is asserted by this evidence.

## SHA-256

| File | SHA-256 |
|---|---|
| `1200x730__component-catalog.png` | `228e4ff5b233ae105ce295b093d52cbd8810348ed34dacde9ecb7285de03dc4d` |
| `1200x730-text-m__mirror-combat.png` | `9e208871f3371d58fe586e310bdc3717f8734732a2512426da3e92bf44673a89` |
| `1200x730-text-m__mirror-map-music-off.png` | `aaca87d0affb77af4b133d0690cde7c4b68abe9a47015fb48ee8352dcab578b4` |
| `1200x730-text-m__mirror-map.png` | `dbf3cec9888b432fab1114f83f07f8d0aaf83a972768a25ecde54668b2a1a667` |
| `1200x730-text-m__mirror-overlay.png` | `e8499359dd7b1eee18d30eae6ff6a10657830795480ba895160d4cfad1b5695d` |
| `1200x730-text-m__off-map.png` | `f12a65b433912006b94190459c851d3445e652be0469af866d3eb1a8e49a1d4f` |
| `1200x730-text-m__switcher-overlay.png` | `ff499d9d49c989f0a69b2ce665dd5f4fc62c6b81bcd895a9d008d8b753327d05` |
| `1200x730-text-xl__mirror-combat.png` | `2b8e302686012bccfed20a60c1887e28aab87df6f9b272f7d173eba484225747` |
| `1200x730-text-xl__mirror-map-music-off.png` | `e2f3461be5c5513a0b29db678dd2851df34cac9fafd359f30b66f9b02ccecfee` |
| `1200x730-text-xl__mirror-map.png` | `889509daf6a6d2aab18a36364f7ddcfe7f28e275b1925923026232d6410a221e` |
| `1200x730-text-xl__mirror-overlay.png` | `f6b3a77f19ac7d5b5d3989bf6216070a43fb4b285a194bb937a262066ed026f3` |
| `1200x730-text-xl__off-map.png` | `9045a79b47c7d7cdda1df1e3c2b04f1aafd40929a779b7e7f3563d124403e1a4` |
| `1200x730-text-xl__switcher-overlay.png` | `d0b40180bd104e5aba85deb8e4799b9e42215949028becdbccd8d02fec855d01` |
| `390x844__component-catalog.png` | `6f2af619679fab5c1edfb36b05563774eb7f853e6927301a5e665a92b3d4e8c7` |
| `390x844-text-m__mirror-combat.png` | `c8251eb36269371219b186d9bcba37c3f3e04ea47784f3b03edf4fc632f3355b` |
| `390x844-text-m__mirror-map-music-off.png` | `32ba94a19d6770f1d64c856bb9adf49e9902e6b348b5acbf8f841ac0651448fc` |
| `390x844-text-m__mirror-map.png` | `2c7dce339ea8d470af622ef0310a6a1fdb9a2405e55339d38669bc5db19d17a3` |
| `390x844-text-m__mirror-overlay.png` | `32df416174ca26fe94665dc4be8626d2594dc6fa309ee7646cd1517862952fa7` |
| `390x844-text-m__off-map.png` | `45d5a6adc79cf67ce34557310c90ac05caee1d4d58d9a248e3e35eaf44a6ae45` |
| `390x844-text-m__switcher-overlay.png` | `8409a12558b897073889a62aafcc3906e4e62129ae128a7a39d413b64905905d` |
| `390x844-text-xl__mirror-combat.png` | `48418371f56fbad83ee6238592f70fb88a8f560e895a1e23d1ea9530e6cbf857` |
| `390x844-text-xl__mirror-map-music-off.png` | `8a4acfa4e92053563c0c4684e1ff39ced189e2de6119168964afc28a54bc9b8a` |
| `390x844-text-xl__mirror-map.png` | `607f11650c93e77d45b6b4326e4b5422c253496f7429dc4d4cd92306903ddd2e` |
| `390x844-text-xl__mirror-overlay.png` | `f3c5e4d380fd40e821aa93517a1256ede989c1651b79b6c19faf094742099d59` |
| `390x844-text-xl__off-map.png` | `9edc80f4db9f6dfaaf0fc9c57d9906c0b35dd5184a93399e04ae7e7544553637` |
| `390x844-text-xl__switcher-overlay.png` | `205eee83fbed16687a6ea83ac8bb1a5cd3c884485dba2435cda13e3e6647f31d` |
| `844x344-text-m__mirror-combat.png` | `743aef865032ec3eebd5fe665c69bc27f4bd5cf4c4bd16937f70615a81b7d180` |
| `844x344-text-m__mirror-map-music-off.png` | `c60e9b9c46075282fda389bd14185eb9001b65264e4f6c7f474cd0a008fdc0e2` |
| `844x344-text-m__mirror-map.png` | `d0c293c7b47ef80b937149a9cd8f5047a2dd302e3476d48cbd1ca74d252f218e` |
| `844x344-text-m__mirror-overlay.png` | `da02216c6556a4c6bd5a5d2e96d57faaee99ad4435f2e30830b9232640d27e18` |
| `844x344-text-m__off-map.png` | `470b66af974860c355f9c1cb90648f409105860f60bd1719e917cf7f804cd4ec` |
| `844x344-text-m__switcher-overlay.png` | `6d94726c3d279fd470cb6d1754c61586644b52e7f4e4f32d04775a3cebf216a4` |
| `844x344-text-xl__mirror-combat.png` | `1c4734466108c191cb23a426d6e8c1e798053e12044c8b1d3b94a35412b9ebdb` |
| `844x344-text-xl__mirror-map-music-off.png` | `b15c0f2d39f8f61a3084771bffc12be768ce8431600634e80c79fb5c4115203e` |
| `844x344-text-xl__mirror-map.png` | `5cdd1387d9bc1f57809a9bd0907a0b63e57acd9b8b4e47481bd69c489e189f62` |
| `844x344-text-xl__mirror-overlay.png` | `53f3f2c8a546ec01361e6798fcd397719e4b144b42474950d2aee687ca774953` |
| `844x344-text-xl__off-map.png` | `bef371e30986e2a7cc51e6f9a6d959f2c733750640623bbce1a425fcfafb6368` |
| `844x344-text-xl__switcher-overlay.png` | `ac5443e3608a481d2b62ef8d48571bdae44790c44d5b27c592379eda76710458` |
