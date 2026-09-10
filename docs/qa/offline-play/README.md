# Offline download and save-transfer verification

Build: **0.6.0.116**, rebased onto dev `bdc1374f` (including the armament kits).

- Final standalone browser checks: **8 passed**, using the generated file with
  networking disabled and a real run fixture. Import cancellation, successful
  import, recovery backup, reload, map resume, combat entry, and blocked-storage
  refusal were exercised. No browser exceptions were recorded.
- Build version: 8 checks passed. Shipped aliases: 6 checks passed. About/changelog:
  279 checks passed. Receipt and whitespace checks passed.
- Pages metadata selftest passed both deliberate breakages. Its release metadata
  comes from the exact artifact rather than manually maintained sizes or links.
- The final combined-tree Node suite passed **138/0** (exit 0), including the
  additional 704 armament class/loadout regression cases. The earlier pre-catch-up
  full suite also passed 138/0.

## Download-test limitation

The complete download/export/import browser journey passed on build 0.6.0.111,
including byte-for-byte comparison of the downloaded HTML. Later runs fetched the
game successfully, but Edge canceled the large file save with zero bytes written.
The system drive was full during these runs. The small JSON export still saved.
The final build uses an explicit Save game file click after preparation; its
large-file save has **not** passed the final browser check. The PR remains draft.

The release feed in the download test is a local fixture. No release or Pages
deployment was performed. Phone-width captures are browser emulation, not a
physical-phone installation test. The final offline-only check skips download
and uses the generated HTML directly.

## Screenshots

- [Desktop download and saves panel](desktop-download.png)
- [Phone download and saves panel](phone-download.png)
- [Imported run in offline combat](phone-offline-combat.png)
