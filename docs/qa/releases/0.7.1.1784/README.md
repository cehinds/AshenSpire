# Published Release 0.7.1.1784 captures

[Play the pinned Release](https://cehinds.github.io/AshenSpire/release/1784/). Captured 2026-10-24 UTC in Chromium 154.0.8037.57, DPR 1. Desktop views are 1440 × 1000; phone emulation is 390 × 844. All six images were inspected by the main session.

The browser executed a local reconstruction with exactly the HTML bytes served by the published Release, using the official shared assets. These are local captures, not direct public-host navigations. The public HTTP verification in [Pages run 40046449287](https://github.com/cehinds/AshenSpire/actions/runs/40046449287/job/120734353272) and every captured local navigation agree on HTML SHA-256 `c5090a3e7e26da4a87d7a2ea42fe4ab758b6920dfe67783494414e38c1dcd32f` (14,966,137 bytes).

Published commit: `2f6603ba019c583bd58c6dc28b30df2cfe33b8fc`. The available materialized commit `8eada408c0afb7e9d4cc3b3c1e83901b6b23ac72` has the identical complete Git tree `6f78a74956d1555ecc9159f23dd730dc6a5e9fe4`. The rendered build is `0.7.1.1784`, source `d71537edb1`, high edition, built 2026-10-23. This gallery does not advance Release or Main.

The title uses native Enter from a clean isolated profile. Other screens use the game’s native ephemeral showcase fixtures; they are posed states, not an earned playthrough. Creation shows two class choices with one locked. The map uses `shotWalk=5`. The shop shows actual configured offers, costs, inspection, buy and leave controls. No HTML, CSS, game-function or RNG override was used.

| Image | Native fixture | Capture UTC | SHA-256 |
| --- | --- | --- | --- |
| [title](title.png) | `normal title boot; native Enter` | 2026-10-24T01:53:34.749Z | `f8dcd5ce6ba3ae7fc8ac5cb8bb1b4e24dc25e08f4d39d1246114d098760b057c` |
| [creation](creation.png) | `?shot=customize` | 2026-10-24T01:53:44.216Z | `9504846c18ec5718defc5005be90afbc912b52b0568feba37b4bd7658a5f7efb` |
| [map](map.png) | `?shot=map&shotWalk=5` | 2026-10-24T01:53:49.757Z | `8d57ab2ca0cfbb21bccb51fdfdca82d3e89fdbf5b0e26150cb0eb7ea72cb2753` |
| [combat](combat.png) | `?shot=combat` | 2026-10-24T01:58:12.229Z | `2797898a7a3e66e715d52a51242dc5325444124b96970fc6eb82bb74423c64d4` |
| [shop](shop.png) | `?shot=shop` | 2026-10-24T02:06:01.976Z | `5dbda0812dca4ce0cc07dd22c6e29c1ab402603ac241a2bd27bc8e9e3bfd2c5f` |
| [combat-phone](combat-phone.png) | `?shot=combat` | 2026-10-24T02:06:09.286Z | `41a3c8a8401afadeba4b6c203020ea1b4eba908a272e0f1eea2b6db1de34c9d5` |

All six accepted navigations had zero Runtime errors/asserts/exceptions and zero required network failures. Raw evidence retains one optional missing LAN discovery request on title, two exact native Chromium vibration interventions, and 36 AudioContext autoplay warnings. There were no optional SFX 404s in these Release captures. Ten contexts were loaded across five attempts; four stopped before a retained screenshot. Earlier failed attempts and raw evidence remain preserved outside the repository.

Before/after source and asset hash/inode audits passed; all browser contexts, profiles, servers and writers closed. The six PNGs total 6,277,526 bytes. The previous 0.7.1.1517 gallery remains in its original directory.

## README link verification

Trusted assembly [run 40046449287, job 120729414692](https://github.com/cehinds/AshenSpire/actions/runs/40046449287/job/120729414692) passed the 90-check site gate. Its artifact listing contains all four primary channels’ `latest/build.svg`, `latest/download/AshenSpire.html` and history `index.html` routes; the generator copies each current game/download and renders each badge from that selected build. The history gate checks every offered build/download link. The trusted deployment verified actual HTTP metadata and game-page hashes for Dev 1804, Test 1802, Release 1784 and Main 810, plus 26 feature previews including the unavailable-card fix at source `31688946b06b3d361476d0418c845dc2785b2254`.

Badge/download/history route existence was checked against the assembled site; it is not an additional HTTP claim. Direct local HEAD checks were blocked by the configured network proxy (403). Workbench, installer and unrelated external links were not newly HTTP-verified by this session.

This is screenshot maintenance and source/byte identity evidence, not release acceptance, a phone-hardware performance test, or a claim that the newer Dev/Test changes are present in Release.
