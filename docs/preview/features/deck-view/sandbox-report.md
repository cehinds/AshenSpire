# QA sandbox report

## Request

> when inspecting deck (editing deck in a location where I can't change cards) remove the gap at the top and halve the gap between cards and change it from edit deck to view deck. also remove the Pile pre title

**Result: PASS** (44 passed, 0 failed); before = `origin/dev`

## desktop / deck-view

| Group | Check | After (this tree) | Before (base) |
| --- | --- | --- | --- |
| success | Read-only deck is named View Deck | PASS text "View Deck" | FAIL text "Edit Deck" |
| success | The read-only deck modal is visible | PASS visible | FAIL not found |
| success | Pile pretitle is absent | PASS hidden or absent | PASS hidden or absent |
| success | Body has no extra top padding | PASS paddingTop = "0px" | FAIL check broken: .deck-view-modal .pile-body not found |
| success | Rows use half the former 64px gap | PASS rowGap = "32px" | FAIL check broken: .deck-view-modal .as-cardgrid not found |
| success | The deck contains visible card faces | PASS count 11 | FAIL count 0 |
| success | The header stays inside the modal | PASS inside | FAIL check broken: .deck-view-modal .modal-head not found |
| success | Header and card grid do not overlap | PASS apart | FAIL check broken: .deck-view-modal .modal-head not found |
| success | No console errors | PASS none | PASS none |
| failure | Read-only deck still claims to edit | PASS absent (text "View Deck") | FAIL FAILURE PRESENT: text "Edit Deck" |
| failure | Pile pretitle still appears | PASS absent (not found) | PASS absent (not found) |

Screenshots:

- after: `desktop-deck-view-after.png`
- before: `desktop-deck-view-before.png`

![after](desktop-deck-view-after.png)
![before](desktop-deck-view-before.png)

## phone / deck-view

| Group | Check | After (this tree) | Before (base) |
| --- | --- | --- | --- |
| success | Read-only deck is named View Deck | PASS text "View Deck" | FAIL text "Edit Deck" |
| success | The read-only deck modal is visible | PASS visible | FAIL not found |
| success | Pile pretitle is absent | PASS hidden or absent | PASS hidden or absent |
| success | Body has no extra top padding | PASS paddingTop = "0px" | FAIL check broken: .deck-view-modal .pile-body not found |
| success | Rows use half the former 64px gap | PASS rowGap = "32px" | FAIL check broken: .deck-view-modal .as-cardgrid not found |
| success | The deck contains visible card faces | PASS count 11 | FAIL count 0 |
| success | The header stays inside the modal | PASS inside | FAIL check broken: .deck-view-modal .modal-head not found |
| success | Header and card grid do not overlap | PASS apart | FAIL check broken: .deck-view-modal .modal-head not found |
| success | No console errors | PASS none | PASS none |
| failure | Read-only deck still claims to edit | PASS absent (text "View Deck") | FAIL FAILURE PRESENT: text "Edit Deck" |
| failure | Pile pretitle still appears | PASS absent (not found) | PASS absent (not found) |

Screenshots:

- after: `phone-deck-view-after.png`
- before: `phone-deck-view-before.png`

![after](phone-deck-view-after.png)
![before](phone-deck-view-before.png)

## wide / deck-view

| Group | Check | After (this tree) | Before (base) |
| --- | --- | --- | --- |
| success | Read-only deck is named View Deck | PASS text "View Deck" | FAIL text "Edit Deck" |
| success | The read-only deck modal is visible | PASS visible | FAIL not found |
| success | Pile pretitle is absent | PASS hidden or absent | PASS hidden or absent |
| success | Body has no extra top padding | PASS paddingTop = "0px" | FAIL check broken: .deck-view-modal .pile-body not found |
| success | Rows use half the former 64px gap | PASS rowGap = "32px" | FAIL check broken: .deck-view-modal .as-cardgrid not found |
| success | The deck contains visible card faces | PASS count 11 | FAIL count 0 |
| success | The header stays inside the modal | PASS inside | FAIL check broken: .deck-view-modal .modal-head not found |
| success | Header and card grid do not overlap | PASS apart | FAIL check broken: .deck-view-modal .modal-head not found |
| success | No console errors | PASS none | PASS none |
| failure | Read-only deck still claims to edit | PASS absent (text "View Deck") | FAIL FAILURE PRESENT: text "Edit Deck" |
| failure | Pile pretitle still appears | PASS absent (not found) | PASS absent (not found) |

Screenshots:

- after: `wide-deck-view-after.png`
- before: `wide-deck-view-before.png`

![after](wide-deck-view-after.png)
![before](wide-deck-view-before.png)

## tablet / deck-view

| Group | Check | After (this tree) | Before (base) |
| --- | --- | --- | --- |
| success | Read-only deck is named View Deck | PASS text "View Deck" | FAIL text "Edit Deck" |
| success | The read-only deck modal is visible | PASS visible | FAIL not found |
| success | Pile pretitle is absent | PASS hidden or absent | PASS hidden or absent |
| success | Body has no extra top padding | PASS paddingTop = "0px" | FAIL check broken: .deck-view-modal .pile-body not found |
| success | Rows use half the former 64px gap | PASS rowGap = "32px" | FAIL check broken: .deck-view-modal .as-cardgrid not found |
| success | The deck contains visible card faces | PASS count 11 | FAIL count 0 |
| success | The header stays inside the modal | PASS inside | FAIL check broken: .deck-view-modal .modal-head not found |
| success | Header and card grid do not overlap | PASS apart | FAIL check broken: .deck-view-modal .modal-head not found |
| success | No console errors | PASS none | PASS none |
| failure | Read-only deck still claims to edit | PASS absent (text "View Deck") | FAIL FAILURE PRESENT: text "Edit Deck" |
| failure | Pile pretitle still appears | PASS absent (not found) | PASS absent (not found) |

Screenshots:

- after: `tablet-deck-view-after.png`
- before: `tablet-deck-view-before.png`

![after](tablet-deck-view-after.png)
![before](tablet-deck-view-before.png)
