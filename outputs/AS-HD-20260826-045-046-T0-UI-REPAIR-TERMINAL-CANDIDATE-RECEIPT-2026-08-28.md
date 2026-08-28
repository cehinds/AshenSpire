# AS-HD-20260826-045 + #046 — terminal local-candidate receipt

STATUS | ACCEPTED_LOCAL_CANDIDATE / CQM_PASS / INDEPENDENT_QA_PASS / REMOTE_DELIVERY0

## Identity

- Authoritative writer: IT Manager III task `01a02bc1-1611-7a22-9803-8c5e617ab711`.
- Worktree: `C:\repos\AshenSpire-ui-current-build-tooltip-hud-logo`.
- Branch: `codex/ui-current-build-tooltip-hud-logo`.
- Base: `a110ac9d6472faeb979f010949315e8374ddb01a`.
- Candidate commit: `22e448cad19c28c17966ca01c431b25929132c07`.
- Candidate tree: `e7e5335c680f32c4fa24e641f6073115089e737c`.
- Predecessor candidate: `2ae90a2e4467d17d96743c3ea7953611b4cc5915`.
- Superseded lane commit `387b39d5df9fd741a1a8a8e97aa5b7dfabd7bfe3` was not copied, cherry-picked, merged, adopted, or credited.

## Accepted behavior

- Combat tray/subordinate enemy and player tooltips are suppressed; the visible intent indicator remains.
- Exactly one contextual enemy tooltip contains only name, current/max HP, current/max poise, and active status-effect names.
- Hover, focus, click, touch, Enter, and Space selection use the configurable `500 ms` show delay; selection state is exposed immediately while the tooltip waits. Auto-fade defaults to `5,000 ms`.
- Real Arrow navigation reaches the enemy and Space activates the same delayed path. Selected ownership survives pointer leave and combat rerender.
- The tooltip is physically above the enemy and clears the intent indicator and top HUD on desktop and mobile; zoomed long content remains contained.
- Reduced-motion behavior honors both the in-app setting and `prefers-reduced-motion`.
- HUD reduction stays within 1–5vh: desktop expanded `1.37vh`, desktop compact `1.23vh`, mobile expanded `1.71vh`, mobile compact `1.42vh`.
- Title wordmark is within the 1px optical-center tolerance on desktop and mobile.

## Automated proof

- Independent exact-commit checkout: `C:\repos\AshenSpire-ui-qa-22e448ca`.
- Source browser report: `outputs\t0-ui-authoritative\current-build-ui-repair.json`, SHA256 `6F69456E5BDAE0BECF4B57BD34DFBA53DC1637EF6A236132FEE035861DAA26EA`, `45/45`.
- Standalone browser report: `outputs\t0-ui-authoritative-build\current-build-ui-repair.json`, SHA256 `6EF38913C640218A932039B28ACBECFF243FC2CB707BE3B3A8210CD9EC4384B2`, `45/45`.
- Full Node suite: `112/112`.
- UI components: `21/21`; self-test plants `21/21` red.
- Compact HUD static contract: `13/13`; rendered source `18/18`; rendered standalone `18/18`.
- Content generation current; shipped verification `6/6`.
- Build ordinal: `1396`; source digest: `bd6cbcc2c7`.
- `AshenSpire.html`, `build\AshenSpire.html`, and `dist\AshenSpire.html`: byte-identical, `4,157,701` bytes each, SHA256 `D45BC7735723A40743904FCBE1328C51A0C5082E94C4406DB2A6B62193D73942`.

## Independent verdicts

- CQM agent `/root/ui_code_audit`: PASS on the exact candidate; no actionable findings. It independently verified the production Arrow-to-Space path and exact-commit regression/build gates.
- QA agent `/root/qa_harness_audit`: PASS on the exact candidate from the isolated checkout; source `45/45`, standalone `45/45`, Node `112/112`, representative desktop/mobile visual inspection PASS.

## Screenshot identities

Source report screenshots under `C:\repos\AshenSpire-ui-qa-22e448ca\outputs\t0-ui-authoritative`:

- `desktop-title-centered.png` `E316BBBC386F0963BA828A5F3205BEBEEEB67B97B3380E3B770230A937922C96`
- `desktop-combat-hud.png` `442F64BDEA738C32B3B346D3D318DBD50255D3BE9DA5DA66425ACE09F410BF8A`
- `desktop-combat-hud-compact.png` `3BC717196D88DB96F1F307B7959D1DF5B3291DE8B5E21A4C7B9BF421F2FC2D20`
- `desktop-tooltip-before-delay.png` `85FFF5143A5CB346D180E8F9FD4B76AF644633CDCD75624657FC82007035C29E`
- `desktop-tooltip-visible.png` `8C9F7C95240FF0C3FAC35B1E44509F050E1F1EA588267B5BD1B612FDACDC7857`
- `desktop-tooltip-selected.png` `66F3EAE083FE888A721F2C803CD9D8AC1E5DC22EEF540A930297D80DE239B49A`
- `desktop-tooltip-faded.png` `CE502D898D8EA9B4597E3C39218F0CAC7C2CF63F2D8EE62D722681C9D371A50E`
- `mobile-title-centered.png` `F8819960A7509BEF21B95D6F3EDDE523E71EFB789B1126354297701B9ECE5006`
- `mobile-combat-hud.png` `5DF8BA3462A199964B84B18A33DBA70A1BB671417B82635F1026B6F9F93A3181`
- `mobile-combat-hud-compact.png` `D49F694AF9A23C43C7E09FBD24C825CC4ED6C8464E4EBE8955EC4668B9870F30`
- `mobile-tooltip-before-delay.png` `FA0D542CC605CD099FECAD91D6321C09608B9D21E7C6A801CA04F45587C34BF4`
- `mobile-tooltip-visible.png` `AFCC679602AB3CA5EC7014BB19BA641C220E72B57DF6AF626DC96B8F286C041A`
- `mobile-tooltip-selected.png` `C139E3A284627B3ABC24048437AE0DE7CDB6B3E2B0D304EE50D7C1810E220DD7`
- `mobile-tooltip-faded.png` `A97B7C9F88F6B9B40DDA9479328DB9EF068D93E76476C5C0049C17BDDEC8CA88`

Standalone screenshot hashes are linked by the standalone JSON report. The independently inspected title/tooltip/HUD screenshots passed; no separate screenshot set is promoted as source truth.

## Cleanup and residue

- Authoritative tracked and staged diffs: zero after commit.
- Harness ports `8563` and `8587`: no listeners at terminal census.
- Git lock files: none found.
- Untracked evidence directories, the earlier physical ACK, the stale `t0-run-node.log`, compact-HUD results, and launcher-stamped twins are preserved and uncredited; they were not deleted or committed.
- Complete process-command-line census was unavailable under host permissions; no claim is made beyond completed commands, closed harness ports, and absent Git locks.

## Boundary and next action

This is a local, committed, independently accepted candidate. Push, PR creation, merge, Project mutation, Pages publication, deployment, delivery, and release are all `0` and remain separately authorized. The next executable action is an explicit remote-delivery decision for commit `22e448cad19c28c17966ca01c431b25929132c07`; no earlier candidate or moving untracked report may substitute for it.
