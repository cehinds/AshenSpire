# Desktop combat polish capture record

Controlled showcase captures of the actual packed game, captured 2026-10-23 UTC. These images use the production combat screenshot route with its five-card hand; they are not an earned playthrough or a gameplay-performance benchmark.

- Source: `c4730eab7e1db7a9880dc094719dd82a91a00465`, tree `be246a042a02df15852927e03f034769ce1b93c9`.
- Full build: **0.7.1.1789**, source digest **279edd9a97**.
- Executed packed HTML: 14,985,168 bytes; SHA-256 `6c2f4066377b3710cf45ec4513e34f3f13db3d4ad87b230326840204a76e194a`.
- Feature preview: https://cehinds.github.io/AshenSpire/branches/fix/DesktopCombatPolish/latest/ — publication and public browser verification pending; not yet claimed working.
- The desktop views show smaller cards, a lower arena and reviewed scenery with more detail. Mobile and tablet retain their smaller scene sources. Explicit Light and constrained-Auto visual quality checks are pending separately.
- Baseline captures are copied byte-for-byte from the real browser QA run beginning `2026-10-23T07:12:48.462Z`. That run also exercised native card selection, Inspect, close and target hover without playing a card. This four-image table records the initial baseline states only.

| Image | Viewport | PNG SHA-256 |
| --- | --- | --- |
| `mobile.png` | 390 × 844 | `41a3c8a8401afadeba4b6c203020ea1b4eba908a272e0f1eea2b6db1de34c9d5` |
| `desktop.png` | 1440 × 900 | `88ca479c362b39127ef6a8cc80a17634d0d1801267dba3e3e38631ed2f079b6e` |
| `wide.png` | 1920 × 1080 | `584fe528864291d349edb5bd6a3ccbcfd3bcaa6850ad7907b5717c3fcb55daef` |
| `tablet.png` | 768 × 1024 | `28fca9a1d4808fe6f9857b79e94ff3278f133b5b2fceb1eab3520cfab2c7c7a8` |

The existing Release screenshot gallery is separate and byte-identical, retaining its labeled 0.7.1.1517 captures. Current hosted Release verification remains pending: the latest successful publisher [run 39902222991, assemble job 120248110316](https://github.com/cehinds/AshenSpire/actions/runs/39902222991/job/120248110316) reports Release head 1784 but also says its latest alias was not published because that head was not served; archived publication information includes 1517. Those records do not reliably establish the current hosted latest build. The public Pages host is blocked in this environment, so no live verification or installer-to-hosted inference is claimed. These feature captures do not update Release or Main.
