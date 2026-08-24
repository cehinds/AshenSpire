# Issue #230 Quick Menu evidence

Exact-build evidence for the promoted Mirror Quick Menu, preserved legacy modes, and shared Fullscreen/Music controls.

- Base: `dev@69fdbc99aea853ba85e1f08b3bacde134d648dbe`
- Candidate BUILD: `0.4.0.1271` · source digest `b2272fb6a3`
- Artifact SHA-256: `da906f288172f43d63ed7bdd7203a4787129281e995e46a4cf8bc5710d693035`
- Evidence: 38 PNG files committed beside this record
- Shapes: `390x844`, `844x344`, `1200x730`
- Text sizes: M and XL
- States: Mirror map, Music off, combat, overlay, legacy Off, Switcher, and component-catalog controls

The focused browser gate passed 284/284 checks across all six viewport/text combinations. Music ownership/parity passed 31/31 with 16/16 same-door plants. Fullscreen passed 9/9 with 3/3 same-door plants. Screen reach passed 11/11 at the focused `390x650` shape with 8/8 same-door plants. The complete Node suite passed 108/108. Visual review confirmed the Quick Menu remains readable and internally scrollable at phone and short-landscape sizes; Fullscreen and Music are the first controls; Save and Save & Quit remain the final actions.

Each PNG's exact provenance is its immutable Git blob in the commit carrying this directory. The image names encode viewport, text size, Quick Menu mode, and state so individual captures can be replaced without changing the catalog contract.

Boundary: no physical gamepad was attached; the browser gate drove the shared keyboard/controller navigation analogue. The broader release-shot run reaches this Quick Menu but remains RED on inherited `dev@69fdbc9` customize-stats and compendium-held fixtures. Release remains RED.

## SHA-256

| File | SHA-256 |
|---|---|
| `1200x730__component-catalog.png` | `c4f0482baba20bde50c52efd45b479a182fafe500c2e77c1b878fadcad9e2f14` |
| `1200x730-text-m__mirror-combat.png` | `f4566e6d49b5af788f78d03c5f59975605e58c8b2911cfa94f18609295833a9e` |
| `1200x730-text-m__mirror-map-music-off.png` | `5f013d803cd4feee70c99d14510a96fb18e4c5e912e5b265f598576b7eca05fe` |
| `1200x730-text-m__mirror-map.png` | `26bc81785cf6af6387426c50d25a1b32ab5310d31d95ab312293f90c824b7fea` |
| `1200x730-text-m__mirror-overlay.png` | `1375819134c353cb52a2bd07240e78a2f4664e528688f0ff07f49b84d87c70cc` |
| `1200x730-text-m__off-map.png` | `115af1231af5ca5bd7a3c9220314d1d55cc7f0d08cba22e01d35c39eb9f16c57` |
| `1200x730-text-m__switcher-overlay.png` | `a6cd47e4eb15fd9038d709064a0b39cc5555b92eea391a58aa2a839898a86bac` |
| `1200x730-text-xl__mirror-combat.png` | `72ca95820f58b77ae8d54c94f42cf8110d0da99a5860d4037e886cc5af72dc63` |
| `1200x730-text-xl__mirror-map-music-off.png` | `fc512c3833133ff58e08974809ab662ae9c131f93f15476e9810203e61340a49` |
| `1200x730-text-xl__mirror-map.png` | `cc504b8b6d893a3f5a21a1822964bbe3c8ecda7eb9608ab275b5df49a43e37fa` |
| `1200x730-text-xl__mirror-overlay.png` | `23d732f24ec7cc162aa931564b5947eca7cd959e9aa3a6e554adec3fc5cdf21d` |
| `1200x730-text-xl__off-map.png` | `e844d3da8c4a6760da15b6eb99fb6b35d2e2cab5c74ec2d52c892efb14e39e1a` |
| `1200x730-text-xl__switcher-overlay.png` | `76b4114e32ddcffb75c19baf15458e63a0e4452926a99946bca477c4cb875010` |
| `390x844__component-catalog.png` | `c7f7453b2e744b2039155a40dd807124f400419cf128450def6933def79e9e2f` |
| `390x844-text-m__mirror-combat.png` | `ace992e676d41888c47eabcd53b12c0262aaa2b5cd382f8d15415044018700e9` |
| `390x844-text-m__mirror-map-music-off.png` | `d2f8c197f0cb824ffb4a69ccc27bbbe5389c5707da821c6eeffc348692f34269` |
| `390x844-text-m__mirror-map.png` | `26cbfe26d2e9fceb88a16594fde22767255d0ce08032e46e790adfb4ab84e79b` |
| `390x844-text-m__mirror-overlay.png` | `356bb9e515460828182937e1e998f5844cd31c9d0ea204bf8c1ac84d2a355c52` |
| `390x844-text-m__off-map.png` | `e0cae32d11cc93e6b623cc52e6012d6a84b3150bc41a4f5e388e08f446a86747` |
| `390x844-text-m__switcher-overlay.png` | `79042c5332da37fa2187f38758219d10235ff55717290b5951d7b79a348a7806` |
| `390x844-text-xl__mirror-combat.png` | `9e52fa7d1b2df759e5df0713fcd07efbeaacac4c9f20d5c433f7f338297c4248` |
| `390x844-text-xl__mirror-map-music-off.png` | `aeae949535aca646759b0978e5acd3aa8bd5c57bd054e5a232f9839ea9456ae9` |
| `390x844-text-xl__mirror-map.png` | `7b1ea5e6ecdb2700d9daaf472844a3c753bec56708082f2627e89180ecb42ccc` |
| `390x844-text-xl__mirror-overlay.png` | `013d022dc01ba37d8062b7eed10940f9d06c4790be0b55a0ace45714f76ec09c` |
| `390x844-text-xl__off-map.png` | `dd941408a7a232a5e29e9b352d52d6d7c180fd32b952acfc46c8e45d2fe93481` |
| `390x844-text-xl__switcher-overlay.png` | `e3b5acecbafb77c78b27e443b6b1b85931524decb892ad77cd3b04a65294d3f9` |
| `844x344-text-m__mirror-combat.png` | `0035d507ee4d3a3d030c848943def1610ac84ad41b6293556bb6a8dd036c2de2` |
| `844x344-text-m__mirror-map-music-off.png` | `2df0451b438ef09ca7c27f1ee48086ac11723bcfdaf77542659977710039170b` |
| `844x344-text-m__mirror-map.png` | `be4883db3f0b811116ba3b3093d660d93fa6ce200e443179b3da3d283eee23e5` |
| `844x344-text-m__mirror-overlay.png` | `b028ea7df16100e49d42ce4090b24031d5451e7d708662854b805ed376f2267e` |
| `844x344-text-m__off-map.png` | `2d7ca39ea0e67a8eb263b1ec6256f03bc1af416e3815ddd9f9f0b9584aca151a` |
| `844x344-text-m__switcher-overlay.png` | `2f9bf6304a5947710899b697d1eccc1bd7491601ebe41fe43abedade191790e7` |
| `844x344-text-xl__mirror-combat.png` | `75e719c189a7bb212f5b2287289c20d4f25a2b01071eec478947df3e8ce3e064` |
| `844x344-text-xl__mirror-map-music-off.png` | `bc532ee4631cdf6cfb46daa62feb06044aec57680db281d111836a0525330689` |
| `844x344-text-xl__mirror-map.png` | `4920e19758b3fcec5a8c57846e06e7ce9ae6780a1c45cc86e2a149699b2c77ac` |
| `844x344-text-xl__mirror-overlay.png` | `6eaf8f675c54d4b97d04c001be56b130ff4c105543831f35375ea428f35c7477` |
| `844x344-text-xl__off-map.png` | `d19895449f5c2259cac30c094537e9e1ab7e31db2614edeb7e7eaf158f62b150` |
| `844x344-text-xl__switcher-overlay.png` | `fb1cd37a03fc4f99c6d89bae30e06e4b23880c19f4d549c0a9c45780226830af` |
