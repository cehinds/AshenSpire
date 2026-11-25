# Character level reward validation

The production character sheet showed the new Core milestones on desktop (1280×800) and phone (390×844). The Level progression ladder listed the class primary reward at 2, 6, 10, 14 and 18, the assignable point at 4, 12 and 20, and a rank-up credit and separate level-card offer at every earned level.

## Results

- The literal [sandbox acceptance](acceptance.character-level-rewards.json) passed all 26 checks. Its comparison against dev `7dff4b03a17` failed the five changed milestone checks at each viewport as expected. The before capture used the fallback light art pack. The comparison concerns reward text and behavior.
- A separate headless replay opened Armoury, Character and Progression through the game. It supplied the exact XP needed for each level to the production XP ledger in an ephemeral run. At Level 4, Cancel left the point available, and Done assigned it to Wisdom once. At Level 6, the save manager restored both the new schedule and all five unspent rank-up credits. Effective Reaver Strength increased from 7 at Level 2 to 8 at Level 6 while the allocated Strength stayed unchanged. The replay recorded zero script errors or failed responses.
- The compatibility repair `fa947d7d0a3` was independently reviewed. The 71 focused checks passed, including character ladder rendering after both the older odd-level and the absent-marker save shapes reload. Follow-ups preserve the two profile opt-outs for free points and show custom rank credit counts.

## Local source captures

- [Desktop, Level 2 class milestone](https://github.com/cehinds/AshenSpire/blob/f8539e3c9fbf278779d048a7fd3d7c106524a9e4/docs/preview/features/character-level-rewards/desktop-class-milestone-level-2.png)
- [Phone, Level 4 free allocation](https://github.com/cehinds/AshenSpire/blob/f8539e3c9fbf278779d048a7fd3d7c106524a9e4/docs/preview/features/character-level-rewards/phone-free-milestone-level-4.png)
- [Phone, Level 6 after save restoration](https://github.com/cehinds/AshenSpire/blob/f8539e3c9fbf278779d048a7fd3d7c106524a9e4/docs/preview/features/character-level-rewards/phone-class-milestone-level-6-restored.png)

