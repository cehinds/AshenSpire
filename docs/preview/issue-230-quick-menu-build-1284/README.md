# Issue #230 Quick Menu evidence

Exact-build evidence after integrating `dev@604ad63983772e6b6c88420216b1e0bf99991784` and the concurrent live-overlay dependency `3f0d10e59954d94b8a034b8df4370009bc3101ee`.

- Candidate BUILD: `0.4.0.1284` · source digest `0981648cae`
- Artifact SHA-256: `449085d0a1eda588daaa2a07691bd40034ff13b4350973ae4569c4be42a88158`
- Evidence: 38 PNG files
- Shapes: `390x844`, `844x344`, `1200x730`; text sizes M and XL
- States: Mirror map/combat/overlay, Music off, legacy Off, Switcher, and component catalog

The focused browser gate passed 284/284. Music ownership/parity passed 32/32. The complete Node suite passed 108/108 before the final live-overlay dependency; focused source/component gates passed after it, and exact-head CI is required before merge.

Boundary: no physical gamepad was attached. No release or deployment is asserted.

## SHA-256

| File | SHA-256 |
|---|---|
| `1200x730__component-catalog.png` | `228e4ff5b233ae105ce295b093d52cbd8810348ed34dacde9ecb7285de03dc4d` |
| `1200x730-text-m__mirror-combat.png` | `a26de285f3d8c90013e2201c68a14fd0d4973673d1e1748cd0ca6ef6dbb9049e` |
| `1200x730-text-m__mirror-map-music-off.png` | `3b9a97aa17a84bc3df0317648368d3d1e2b391d973a9fd9e344fdca76c4130dd` |
| `1200x730-text-m__mirror-map.png` | `1d1f98b418a6a5f3e2537676366c61d964c8c124f0248b2fc21057dd373ed69c` |
| `1200x730-text-m__mirror-overlay.png` | `89e6b3e401e522acf21010a35fd780d9090406fb5c8159ac6b48432547cd39b1` |
| `1200x730-text-m__off-map.png` | `2324bfdaa71144c9cb08dab1abe0b78486b761de02af0012893c7875a926265f` |
| `1200x730-text-m__switcher-overlay.png` | `b21ff6424f31ce74a060967692bd1f05e4b6b2024ed01e7031a1260294369d78` |
| `1200x730-text-xl__mirror-combat.png` | `2c416e3bceeb93e6ec5b1e1e6672e625e210085f196364e2b8b786b0097395b9` |
| `1200x730-text-xl__mirror-map-music-off.png` | `069e5fff09c4a434721d5d318b1d99d18dca3ce92bc419de82bb0f085c413707` |
| `1200x730-text-xl__mirror-map.png` | `f8393697fb719f88f5940d3d0edb99e919ce7890b2abf67d37e7d98b1aab11b6` |
| `1200x730-text-xl__mirror-overlay.png` | `14381ce83bfa3efb4d49e7b33caf09b136132132f446a4746cc211e4c7a3c1f7` |
| `1200x730-text-xl__off-map.png` | `1f2868da42e09701f25f5f0730e8746a6d956ddafda27245377dc86c6f41d2e0` |
| `1200x730-text-xl__switcher-overlay.png` | `7172ea3262699e808680241c296e90d7fea72cf489e443a2576b0a7f1946069b` |
| `390x844__component-catalog.png` | `6422a85e80ce2ea1e4f9bc97116fd52faf7a1a487faeb841d7d8867b558a811a` |
| `390x844-text-m__mirror-combat.png` | `97c07f45780e32a8e585f34f908cf8d3f97750eb2294fa7ab1dc2847f1fe3c93` |
| `390x844-text-m__mirror-map-music-off.png` | `86e74c166233ea48091a3b0a3961129109346cc3b808333c507c71881a729a5e` |
| `390x844-text-m__mirror-map.png` | `75f34424e7e8a2ac930d8970fd0b440f97b03cf7406db19fbe6a7e193872cea9` |
| `390x844-text-m__mirror-overlay.png` | `ed37a70a272d72d0e4d7b25880a03ea222074ad3d3e72d23bd99e990589f1af7` |
| `390x844-text-m__off-map.png` | `45d5a6adc79cf67ce34557310c90ac05caee1d4d58d9a248e3e35eaf44a6ae45` |
| `390x844-text-m__switcher-overlay.png` | `a38d76f47cb2a5c797d990865b00de6585c91864c301d6b5742c22c5b36eeac0` |
| `390x844-text-xl__mirror-combat.png` | `122c98f630c4342ab508b948b84c1b854e698afc29dbba67868d06ef213c0df6` |
| `390x844-text-xl__mirror-map-music-off.png` | `8a4acfa4e92053563c0c4684e1ff39ced189e2de6119168964afc28a54bc9b8a` |
| `390x844-text-xl__mirror-map.png` | `0b521728ea08a2f48b74ed93d843d63854ef6df9e5dfd8341b449df4ffdd86bd` |
| `390x844-text-xl__mirror-overlay.png` | `cf8ef5e946892ce736733c1576b8ac3da9e2287513ecacab1965b1727f771717` |
| `390x844-text-xl__off-map.png` | `9edc80f4db9f6dfaaf0fc9c57d9906c0b35dd5184a93399e04ae7e7544553637` |
| `390x844-text-xl__switcher-overlay.png` | `34d0d6cb6c3a87fbb750504ede9250b8c496c7df2c1a18c4be3436501de5e1ac` |
| `844x344-text-m__mirror-combat.png` | `9c463cabde71516bedcecf0889070ea7c663f394800815fb04f84fd42ef69b72` |
| `844x344-text-m__mirror-map-music-off.png` | `184eb0ea82bd9e82ce576cffc437ebcc2627ed0946b5d2205779c9b9222de3ab` |
| `844x344-text-m__mirror-map.png` | `d428a28e776143514b699c1f8d7b22c0dc9c1b8e7cf38b091c827096991c337c` |
| `844x344-text-m__mirror-overlay.png` | `0abd90f66d615d76b95248efd1bfa92c6f1b51447ba57736560b9027192080a2` |
| `844x344-text-m__off-map.png` | `dc7826013248d82ea1c562df9679500dc9579a1d83438bc468d5591f4aa4d4fa` |
| `844x344-text-m__switcher-overlay.png` | `ff9f453b910dd2fa2715441c207b017d76b23e1c6b58738e9d86de17fa04209f` |
| `844x344-text-xl__mirror-combat.png` | `58e7276eaa6d66ce3b90203dd19f779a207444048420970bd38cabfb53969332` |
| `844x344-text-xl__mirror-map-music-off.png` | `e1a39cc1cedcddde1de9765cb1213cc29b03fc16796cc56edb0a26276bd29f88` |
| `844x344-text-xl__mirror-map.png` | `ac2dc9bb3eaf58984bd427c81f57caacad0c85bc77abab0ff936824fab755e5c` |
| `844x344-text-xl__mirror-overlay.png` | `9ef0135d11e56db26c4b40b1ea96f53254f9498f3464699e3e7f6150e7cec968` |
| `844x344-text-xl__off-map.png` | `315094a1348aee074b848c8e41fdae1c840d3c8830622a2531ff0490fb221909` |
| `844x344-text-xl__switcher-overlay.png` | `49c5e3c1af44037c5aab5e410fb6a5be3cf3e81157718750b17dddc7540e91ac` |
