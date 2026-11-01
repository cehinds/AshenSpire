# Reading Desk automatic text fitting

These four images are source-fixture captures of the production Reading Desk renderer. They do not depict the packaged or published feature build.

- Source commit: c3f9e1a870d89c7ca967e2d8281a5eecf29a205a (a4d92028 base plus the three fitting/test/catalog changes).
- Capture date: 2026-10-31, America/Anchorage.
- Capture URL: http://127.0.0.1:4197/build/card-fit-preview.html (local read-only fixture mounting production modules).
- Scenario: automatically inspect Guard Counter in the Reading Desk; names and rules fit the preview after it becomes smaller.
- Source base box: 0.7.2.89, digest 8dcf596e7d. This identifies the preexisting base box only; the changed source fixture was not packaged and has no generated build identity of its own.
- Published candidate source: bfdfaa833ea18f6c7533ab0f93a2106fcef58c20, including latest dev integration and PR #2443 receipt.
- Build artifact: https://github.com/cehinds/AshenSpire/actions/runs/41266006740/artifacts/13067173627
- Candidate playable URL (verified splash and main menu at build 0.7.2.92, digest 26e23c090a): https://cehinds.github.io/AshenSpire/branches/Feature/NewCardArt/latest/

| File | Viewport | Capture time (America/Anchorage) |
| --- | --- | --- |
| desktop.jpg | 1280x720 | 18:35:32 |
| mobile.jpg | 390x844 | 18:36:20 |
| tablet.jpg | 1024x768 | 18:36:23 |
| wide.jpg | 1920x1080 | 18:36:28 |

Root inspected all four images. The shared fitter retains authored card bays, readable font floor, effect line budgets and full inspection text. Real Edge regression checks independently verify font shrink after a 300px-to-220px preview resize and restoration when space returns.

The published 0.7.2.92 candidate precedes the later dev integration. These four images retain their original c3f9e1a source-fixture identity and do not certify the published package.
