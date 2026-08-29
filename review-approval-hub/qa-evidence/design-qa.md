# Design QA — Review Hub Art decisions + Context Rotation

## Comparison targets

- Source visual truth — private clipboard reference, compact dark metric strip (`874 × 248`, 96 dpi); the local path is intentionally not published.
- Source visual truth — private clipboard reference, two-row folded blocker card (`761 × 201`, 96 dpi); the local path is intentionally not published. Its stale “output absent” copy is behavioral/layout context only; immutable packet `99814105…0A43` controls current text.
- Browser-rendered Context Rotation desktop: `design-qa-context-rotation-desktop.png` (`1425 × 891`, CSS viewport `1440 × 900`, device scale 1), SHA-256 `D6FF118CBC309EF7F91CC8DAFE7AE200ABCDAFD95534F52642979BB33BF07E1C`.
- Browser-rendered Context Rotation mobile: `design-qa-context-rotation-mobile.png` (`375 × 844`, requested CSS viewport `390 × 844`, browser content width `375`, device scale 1), SHA-256 `1D33B7773FFF6EF728907061784EFE128032B18BDA0C04C2887A3339ACD9A191`.
- Browser-rendered Art decision desktop: `design-qa-owner-decisions-desktop.png` (`1425 × 891`, CSS viewport `1440 × 900`, device scale 1), SHA-256 `40F17CC1F22216059A7EDFE56199DC9BE9ED660EDA96E7C481DDB318F6B219F6`.
- Browser-rendered Art decision mobile: `design-qa-owner-decisions-mobile.png` (`375 × 844`, requested CSS viewport `390 × 844`, browser content width `375`, device scale 1), SHA-256 `7C96F20CF854F0929B4F88490444231D70CC15E8CB1A2BFD851E094B7F08E5B3`.
- Normalization: browser screenshots use their native 1x capture. Source strips were width-normalized to `1425` only for the stacked comparison; no implementation density or crop change was used for direct browser inspection.

## Combined visual evidence

- `design-qa-context-rotation-comparison.png` — source metric strip above, browser implementation below; SHA-256 `C1000E257C6F00B01F063B0B53D26787AEFC574C3AEBDE0E1832859A700A829D`.
- `design-qa-owner-decisions-comparison.png` — source two-row card above, browser implementation below; SHA-256 `927368B90438B4D82AA20631127A1BB71399F6E33499C5FB77D07E88AC003977`.
- Focused region comparison was required and completed for the folded-card row. Desktop measured `label.y = heading.y` (`Δ 0`) and `detail.x = label.x` (`Δ 0`); the fixed Details/Hide control measured `108px` inside a `1160px` card. Mobile intentionally stacks label above heading, but label, heading, and detail all start at `x = 32`; no horizontal overflow was present.

## Findings

- No actionable P0/P1/P2 visual mismatch remains.
- Typography: existing Hub serif display and compact uppercase labels match the reference hierarchy; long branch names wrap without clipping at `390 × 844`.
- Spacing/layout: metric strips reuse the existing equal-column dark band and footer; desktop is dense, while mobile becomes a single-column responsive strip. Folded cards use row 1 `label | flexible heading | fixed control`, row 2 full-width status. Mobile stack is intentional and preserves the shared left edge.
- Colors/tokens: the existing dark charcoal, cream, green, and amber semantic tokens remain consistent. Owner decisions remain visibly awaiting approval; registration/addendum state does not masquerade as completion.
- Image quality: the new owner/currentness surfaces contain no new raster assets or placeholder art. Existing Hub imagery was not altered.
- Copy/content: the rendered D1 corrects the stale absent-output premise; four crops plus desktop/mobile proof are frozen. D2 is pointer-last reconciliation only. #053 registration, Event 0001, and the cold-start addendum are visually distinct from execution proof.

## Browser interactions and responsive checks

- Desktop `1440 × 900`: main Hub and both dedicated routes loaded; document `scrollWidth = clientWidth` (`1425`) on all checked states.
- Main Context Rotation fold opened; exact 13-team report count `13`; Event baseline tokens READY 0 / deferred 6 / repair 24 / no-session 22; remote branches `0/13`; rotation credit `0`.
- Dedicated Context Rotation report: 13/13 team folds present; first fold opened through the full summary hit area; successor state remained `NOT_BOUND` for every team.
- Decision debt: exact groups `2 / 2 / 1`; two Art cards present; both full summaries opened/closed; all A/B/C options and packet `99814105…0A43` present; no absent-output claim found.
- Mobile `390 × 844`: both routes had horizontal overflow `0`; one team report and one owner-decision card opened; long heading/branch wrapping stayed inside the content edge.
- Relevant browser console errors: `0`.

## Comparison history

- P1 stale top-level owner state: the main Action fold said no decision was open while Decision debt contained two. Fixed the Action fold title, summary, status, and route to the two exact unapproved decisions. Post-fix browser readback contains the two-owner state and no stale “No owner decision is open” text.
- P1 missing dedicated #053 export: the route directory existed but had no page, so the first build produced no dedicated route. Added the 13-team page; post-fix static generation is `16/16`, with `/reviews/as-hd-20260826-053-context-rotation` present.
- P2 source-copy conflict: the visual reference described #040 output as absent. Bound the rendered decision to immutable Help Desk promotion packet `99814105…0A43`; the visual two-row behavior is preserved while the stale factual premise is not.

## Deterministic verification

- `npm run lint`: passed with 0 errors and 8 pre-existing `@next/next/no-img-element` warnings.
- `npm run refresh:local`: passed; Next compile/typecheck/static generation `16/16`; target-only files preserved; refresh sentinel written last.
- Current source identities before isolated delivery: `app/page.tsx` SHA-256 `D7FEE4566CAC943BA8892CC2A7C3933FE6AB57048D42C6170CE4AA7CFE6331DF`; `app/globals.css` `18B719132C83421A2C702341A3199B2DA24DAD6737007D279DAF7C7474C04F1C`; decision page `5E92B8B16F71F64565B6FD5502E67F95AD939B9DAE3D8CAF8DBCFC0EE0871CA4`; #053 page `C4E102AE8E0FA634541795CAFFAD0443FE54C96DC07AFD21B8F30085935848AB`.
- Build/evidence currentness is explicit: Event 0001 evidence as-of `2026-08-28T17:51:44.248155Z`; build stamp updates independently and grants no rotation credit.

## 28 Aug 2026 · 10:10 AKDT — final currentness addendum

- Extended the evidence cutoff to the registered cold-start addendum at `2026-08-28T17:53:56.5091716Z`; Event 0001 remains the seat-classification authority at `2026-08-28T17:51:44.248155Z`.
- Expanded all 13 report rows to full task, pointer, and node identities plus exact pointer observation time. Successors remain `NOT_BOUND` for #053; compression remains `NOT_MEASURED → NOT_MEASURED`.
- Final counts: teams/seats `13/52`; ready `0`; checkpointed `0`; cold-start validated `0`; rotated/wiped `0`; successor resumed `0`; repair required `24`; active-write deferred `6`; no current session `22`; evidence loss `0`; duplicate authority `0`; destructive mutation `0`.
- Refreshed delivery evidence: PR #357 merged at `a110ac9d6472faeb979f010949315e8374ddb01a`; PR #359, remote `dev`, and the built Pages commit equal `5af802e619ec5093a058c50511e14e97ea99bf12`. Release remains unclaimed.
- Reclassified #045/#046 local UI currentness as WITHHOLD because current tracked-clean HEAD `73c3a027ffa7794a1aff0c1c200a4315ff6049da`, tree `e2e2ba9029b21eef5273da7776eb8bfdd5114ca3`, report `07D77CDD09417D3106183D0D66D5A2BBE70E60875B120BF7AF9EFD2C874A950`, and 51 untracked files are not bound by the older terminal receipt.
- Final `npm run refresh:local`: PASS; `16/16` static routes. The delivery sync uses the later byte-identical-source refresh at `2026-08-28T18:12:59Z`: published `index.html` SHA-256 `BE0BE585170BA6FB608AA23C6509975E20F2415A8A5E125543C2F296E4CB9AAB`, 212,519 bytes; Context Rotation report SHA-256 `C3BEBAE1CA5B6ADC1D1E6064735131593063D7448D12701AEC0D57DBEEE0634A`, 94,256 bytes; sentinel SHA-256 `9361E20E3593711D5F7FDC81DA2432E29ECD24E97A7EEC321747DE845FB006C3`.
- In-app browser `1440×900`: PASS, 13 disclosures, exact Application tuple, page width `1425/1440`. Mobile `390×844`: initial full-hash expansion defect reproduced at 649px and fixed; final expanded page width `375/390`, with full pointer/node/task evidence still visible. Desktop and mobile screenshots were captured.
- Privacy boundary preserved: no prompts, full chat, secrets, personal data, or queue bodies are displayed.

final result: static PASS / rendered desktop + mobile PASS / Pages PR pending

## 28 Aug 2026 · 21:18 AKDT — Event 0002 follow-up

- Live delivery reconciliation: Constantine merged PR #361 at `54365d5436dfb778a3dc87de9424c408eb6c56c3`; Pages then built `090159d6b46f98bf4452fa45b6a55606530695ab`. Both resolve to deployed Hub tree `604700d17b478d5e17c3de9307caa4e89cfd5102`. Hosted HTTP readback passed and still omitted Event 0002 before this local candidate.
- Physical evidence advanced the #053 projection to Event 0002, SHA-256 `554673D98816090ABDA4927F7DC52DE174A65ACF533BFF47D30F6409C7E97572`. One sole publisher lease and first action entered are shown separately from the 52-seat denominator. Final corrected-manifest acceptance and explicit GO remain pending; remote refs `0/13`, pushes `0`, checkpointed `0`, cold-start validated `0`, rotated/wiped `0`, successor resumed `0`, evidence loss `0`, duplicate authority `0`, and destructive mutation `0`.
- Bounded pointer refresh changed only two displayed rows: CQM r13 / node `0884AA14069272B99374E9F35CD8B74E5650CD7ED948EC0D618E13F9F8F5F179` / pointer `D6BB1BDD63237DCA77671A22FD9F6DD89EEE22C18C251F69B09DF5444715F8E9`; Help Desk r11 / node `FE970D7478F08214A69F824E60A9DF6416FE8E1049F62F367B28EA102DD35105` / pointer `AF451B52FD722830DF7BBDC5E317D5169B0320E0AB51D5416A63BCDAEFB7AFC4`.
- Source identities: `app/page.tsx` SHA-256 `E968BE735CFD6E9E16BEAE00E98C42AC6051C2B120701B430B357BB3AB4A0B62`; dedicated #053 page SHA-256 `558E6253ECD949C8EFF71DEA9F6647BF9C8588671504E44AFB2CFBA3E90AE3FB`.
- `npm run lint`: PASS. `npm run refresh:local`: PASS, `16/16` static routes. Published `index.html` SHA-256 `D4AF7C28237948B7D50D4CDCAD43E3DB5B303934B9F4B403A136E955AD95EB41`, 214,867 bytes; dedicated #053 HTML SHA-256 `74F30DE4F50A29F4A5B7B224096A220D124E320C08FD9F38961A7989F0E8FFC0`, 100,047 bytes; refresh sentinel SHA-256 `1624E4B50EE944F2FCD443B884510C971F219EFD8B47DA35E834375E490E6B40`.
- In-app Browser desktop `1440×900`: PASS. Main Hub and dedicated #053 route had page identity, meaningful DOM, framework-overlay absence, console health, `13/13` team rows, and horizontal overflow `0`; the Context Rotation fold and Help Desk row opened successfully and exposed Event 0002 plus `/root/rotation_pointer_repair` with rotation credit 0.
- In-app Browser mobile `390×844`: PASS. Dedicated #053 route had page width `375/375`, console errors/warnings `0`, Help Desk row open/close behavior, full publisher state, and no clipping or horizontal overflow.
- Privacy boundary preserved: no prompts, full chat, secrets, personal data, or queue bodies are displayed.

final result: local candidate PASS / rendered desktop + mobile PASS / independent exact-head QA and review pending / not merged or deployed

## 28 Aug 2026 · 21:32 AKDT — Pages packaging verification

- Synced the Event 0002 build into isolated branch `docs/AS-HD-20260826-053-event0002` from exact `origin/dev` base `090159d6b46f98bf4452fa45b6a55606530695ab`; repository scope is only `review-approval-hub/`.
- Converted 7,327 generated copies of local-only evidence URLs across 210 text artifacts to `/AshenSpire/review-approval-hub/local-evidence-unavailable.html`; remaining local-file URI references are `0`. Exact hashes and bounded evidence labels remain displayed.
- Exact packaged identities after that Pages-only conversion: `index.html` SHA-256 `236F540512ABB95E891393E6E0FE008C917D28265F9E305F271381623EC5C0DA`, 203,965 bytes; dedicated #053 HTML SHA-256 `8B31A70D585E81E1EC0EE03DC7A6E4658EB3854735BBABB7C5B19F2F92B3F797`, 95,879 bytes; sentinel remains `1624E4B50EE944F2FCD443B884510C971F219EFD8B47DA35E834375E490E6B40`.
- The first broad URL-boundary pass failed exact-artifact browser QA with generated-script syntax errors. It was discarded before commit or push, restored from the clean build, and rerun with quote, backtick, backslash, angle-bracket, and whitespace boundaries. This is diagnostic history only; the defective artifact was not delivered.
- Final isolated Pages artifact browser QA: desktop `1440x900` and mobile `390x844` PASS; dedicated #053 title and meaningful DOM present, `13/13` team rows, Help Desk disclosure click exposed the publisher lease and rotation credit `0`, widths `1425/1425` and `375/375`, no framework overlay, and current-port console errors/warnings `0`. Main Hub Context Rotation disclosure opened, showed Event 0002 and 13 nested team rows, and had width `1425/1425` with console errors/warnings `0`.
- Repository gates: `node tests/run-node.mjs` PASS `114/114`; `node tools/linkcheck.mjs --selftest` PASS `5/5`; `node tools/linkcheck.mjs review-approval-hub` PASS `372/372` module graphs, `0` broken. This native link check is source-module evidence, not a browser or hosted-Pages claim.

final result: Pages candidate PASS / exact packaged desktop + mobile PASS / PR review pending / not merged or deployed
