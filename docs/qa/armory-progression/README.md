# Armory and progression UI verification

The Armory header combines Character, Armory, and Edit Deck. Progression combines character levels, attribute allocation, read-only stats, skills, and class ladders. Feat cards show their authored effect, acquired/unlock status and tags; distinct acquired feats populate two columns on desktop and one column on phones. Repeated feats retain their stack count.

## Browser evidence

The local packaged build was driven at 1280 × 720 and 390 × 844. The default progression overview fits without scrolling. Expanded details scroll inside the modal, with Back visible. The points tooltip appears above its button on keyboard focus. The corrected close button has a 44 × 44 hit target and a 31.5 × 31.5 visible face, with no inherited text-button padding.

- [Character overview and corrected close button](character-desktop.png)
- [Feat effect, unlock status and tag](feat-desktop.png)
- [Phone feat layout](feat-mobile.png)

Skill buttons open associated cards, tags, bonuses and the existing reward tree. Critical Edge opens its authored description and Blade tag; closing restores focus. Character Sheet opens read-only resource and attribute cards. Allocation cancellation preserves points; Done updates stats. Valid deck edits persist when switching hub tabs; invalid edits refuse navigation.

The preview's `shotProgression=1` fixture grants attribute points only. It does not insert acquired feats. The pictured Critical Edge card is an authored future skill unlock. No new feat or progression mechanic is invented by this UI.

## Local checks

- Final focused renderer/model, button sizing and copy tests: 17 passed.
- Broader pre-receipt run: 2,487 passed, one skipped, one failed because the local build lacked its PR changelog receipt. The runner's other 148 gates passed. Receipt verification is rerun after adding the PR receipt.
- Packaged and single-file builds succeeded; literal assets resolved.
- Browser interactions produced no new runtime errors.

Physical touch/controller acceptance was not performed. CI and promotion results belong to the PR rather than this static browser evidence.
