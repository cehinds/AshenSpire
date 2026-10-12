Warning: truncated output (original token count: 154504)
Total output lines: 8965

// GENERATED from /CHANGELOG.md by tools/about-changelog.mjs --write.
// Do not edit: the focused check refuses any drift from the authoritative Markdown.

export const GENERATED_CHANGELOG = Object.freeze([
  {
    "id": "pr-1884",
    "date": "2026-10-12",
    "group": "2026-10-12",
    "summary": "Each fighter's readout sits above or below it, and the battlefield is narrower on wide screens",
    "detail": "A front-row enemy's health and intent now hang just below its feet instead of drifting off to one side, so every readout stays with its own fighter. On wide screens the fighters stand closer to the middle. Switching back to the Classic look mid-fight keeps you in a row Classic has.",
    "build": "0.7.1.1400",
    "pullRequest": 1884,
    "url": "https://github.com/cehinds/AshenSpire/pull/1884"
  },
  {
    "id": "pr-1875",
    "date": "2026-10-12",
    "group": "2026-10-12",
    "summary": "Widescreen combat uses the desktop layout",
    "detail": "On widescreen monitors the combat screen now uses the same band sizes as desktop: a taller hand with the larger desktop cards in a row under the Combat log and the compact 450px footer. Turning a tablet into a desktop-width window now redraws the battlefield for the new layout. Phone and tablet layouts are unchanged.",
    "build": "0.7.1.1393",
    "pullRequest": 1875,
    "url": "https://github.com/cehinds/AshenSpire/pull/1875"
  },
  {
    "id": "pr-1881",
    "date": "2026-10-12",
    "group": "2026-10-12",
    "summary": "Co-op is set aside for now",
    "detail": "The title menu no longer offers Forsaken Together while co-op is reworked. Nothing else changes, and solo play is untouched.",
    "build": "0.7.1.1389",
    "pullRequest": 1881,
    "url": "https://github.com/cehinds/AshenSpire/pull/1881"
  },
  {
    "id": "pr-1870",
    "date": "2026-10-12",
    "group": "2026-10-12",
    "summary": "Combatants stand on an even grid, and any part of an enemy's square targets it",
    "detail": "In the default view the battlefield is now one even grid of three lanes, leaning on a diagonal into the distance: enemies in a back row and a front row, your party in one row nearest you, with open ground between you and them. Each square has a shadow where its fighter's feet stand. Enemies fill the back row first (one in the middle, two on the outer lanes, three across), then the front row, up to six. You start in the left lane. Tapping anywhere in an occupied enemy square selects that enemy, or plays your readied card or flask on it. Moving now picks one of the three lanes in your row. The Classic look is unchanged.",
    "build": "0.7.1.1387",
    "pullRequest": 1870,
    "url": "https://github.com/cehinds/AshenSpire/pull/1870"
  },
  {
    "id": "pr-1878",
    "date": "2026-10-12",
    "group": "2026-10-12",
    "summary": "Desktop combat looks like the phone",
    "detail": "On desktop the hand is taller and its cards are much larger. They sit in a tight row just under the Combat log / Reaction row, and the footer is compact. Enemies stand together on one ground line, and the castle and trees of the horizon show along the top of the battlefield. The Combat log row, intent badges, stance mark and footer words are larger. Phone, tablet and widescreen layouts are unchanged.",
    "build": "0.7.1.1363",
    "pullRequest": 1878,
    "url": "https://github.com/cehinds/AshenSpire/pull/1878"
  },
  {
    "id": "pr-1879",
    "date": "2026-10-12",
    "group": "2026-10-12",
    "summary": "Rest sites: grounded art, a clearer order, and a way back in",
    "detail": "The traveler and campfire now sit on the shrine floor instead of floating, on desktop and phone. The choices read Rest, Level up, Upgrade, Flask, then the rest. After leaving a rest site, its node stays clickable on the map until you pick a new one, so you can go back for something you forgot; what you already took stays taken.",
    "build": "0.7.1.1361",
    "pullRequest": 1879,
    "url": "https://github.com/cehinds/AshenSpire/pull/1879"
  },
  {
    "id": "pr-1868",
    "date": "2026-10-12",
    "group": "2026-10-12",
    "summary": "Deck editor: (i) centred under the art, grey Basic/Cantrip badge, vertical grip",
    "detail": "The inspect (i) sits centred on the bottom edge of the card art, the rank badge sits higher and reads grey at rank 0 (Basic, Cantrip), and the phone grip is vertical again.",
    "build": "0.7.1.1359",
    "pullRequest": 1868,
    "url": "https://github.com/cehinds/AshenSpire/pull/1868"
  },
  {
    "id": "pr-1872",
    "date": "2026-10-12",
    "group": "2026-10-12",
    "summary": "Co-op: the blow that ends a fight reaches the combat log",
    "detail": "When your attack killed the last enemy in co-op, the combat log and the Full log missed that turn's card, damage and death entries before the reward screen closed them. They now appear.",
    "build": "0.7.1.1357",
    "pullRequest": 1872,
    "url": "https://github.com/cehinds/AshenSpire/pull/1872"
  },
  {
    "id": "pr-1849",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Attacks play in order, Inspect buttons only on the selected fighter, and the game says why a reaction wasn't offered",
    "detail": "STAGGERED, COUNTERED, EVADED, CRITICAL and GUARD BREAK now rise over the fighter they happen to, and a short note above the Reaction switch says why a Counter or Sweep wasn't offered. The combat log now opens at its middle size, and its Full log button shows every entry of the fight on one full-screen page. An attack now plays the swing and the return to stance first, then the target's reaction, then the damage number, and only then does the health bar change. A fighter's Inspect \"i\" now shows only while that fighter is selected, and it appears already in its place instead of jumping there; a card's Inspect appears once, above the card. Your stance and status icons stay visible when your hero isn't selected. When an enemy attacks and you hold a Counter or Sweep the game can't offer, the combat log says why (for example, a Counter can't answer a Sweep, or you're short on SP), and a Smash that breaks Guard is logged. In co-op, the same callouts and the \"no reaction\" note now show too. On a phone the note sits above your HP bar instead of covering it, and Full log is a small gold text link in the log's header. In co-op your own attacks now play in that same order too, and floating numbers no longer vanish when the board redraws. On phones the hand cards are bigger and sit right under the Combat log / Reaction row while staying readable, enemies stand further back on short screens, your stance shows above your hero while it isn't selected, and co-op's Ward/Barrier readout is a small label shown only on the selected hero. The Draw, Discard and Potions art in the footer keeps its shape instead of being squashed flat, a Smash that breaks Guard and kills its target still shows GUARD BREAK, and in co-op the blow that ends a fight now plays on the battlefield before the reward screen. On short phones the backdrop keeps its horizon in view, enemies stand a little higher, and the Combat log / Reaction row and cards sit a little lower. Fighters and their badges have a stronger dark outline, floor shadows are as wide as the health bar, your hero always shows a stance mark above the head, and your hero's selection outline is blue.",
    "build": "0.7.1.1355",
    "pullRequest": 1849,
    "url": "https://github.com/cehinds/AshenSpire/pull/1849"
  },
  {
    "id": "pr-1850",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Deck editor: one card list with − and ＋, and every card shows its stance",
    "detail": "Removing a card no longer jumps to the search box (on phones it opened the keyboard). Search is off for now and each list has one compact title row. Every row in the card library now has − count ＋ buttons, and the inspected card offers both Add to deck and Remove from deck. Phones drop the Library / Inspect / Deck tabs for one list; inspecting opens over it and Back returns to it, and a Draw order view appears only when Play in deck order is on. Each card names its stance (Attack, Defend, Counter, Smash, Sweep or Ranged; otherwise Spell, Power, Consumable or Skill) and its range (Melee, Reach or Ranged), with its rank as a badge on the art (Cantrip or Basic at rank 0) and a physical or magical mark beside its costs. A selected card shows an (i) on its art; the (i), or pressing the art again, opens Inspect.",
    "build": "0.7.1.1345",
    "pullRequest": 1850,
    "url": "https://github.com/cehinds/AshenSpire/pull/1850"
  },
  {
    "id": "pr-1861",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Every feature, chore and fix now waits for the owner's review before it reaches dev",
    "detail": "Development-process change only, nothing in the game changes. Sessions open the pull request with a preview and screenshots, then wait; they merge into dev and promote to test only when the owner names that pull request.",
    "build": "0.7.1.1315",
    "pullRequest": 1861,
    "url": "https://github.com/cehinds/AshenSpire/pull/1861"
  },
  {
    "id": "pr-1864",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Begin says so when a new run cannot start",
    "detail": "If the game cannot save your profile when you press Begin or Quick start, a \"This run could not start\" banner now explains why. Before, the press simply did nothing.",
    "build": "0.7.1.1313",
    "pullRequest": 1864,
    "url": "https://github.com/cehinds/AshenSpire/pull/1864"
  },
  {
    "id": "pr-1860",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Branch previews start a game again",
    "detail": "On a branch preview page, pressing Begin after creating a character (or Quick start) did nothing. The preview plays the game in a locked-down frame that refuses browser storage and the cross-tab save lock, and every new run failed on that lock. The game already keeps saves in memory there, and memory saves no longer ask for the lock, so the run starts and the opening plays. In a normal browser, saves work as before.",
    "build": "0.7.1.1308",
    "pullRequest": 1860,
    "url": "https://github.com/cehinds/AshenSpire/pull/1860"
  },
  {
    "id": "pr-1855",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "The Workbench tests pass on Windows and macOS too",
    "detail": "Development-process change only, nothing in the game changes. Four tests added with the Workbench compared file paths written with forward slashes, so they failed on Windows, where the tools correctly use backslashes; they now build the expected paths the same way the tools do. On macOS the Workbench's file watcher no longer treats folder events, or the watched folder reported under its own name, as changed files, so a Mac no longer triggers stray reloads. The test runner now flushes its report before exiting, so a failing macOS test is named in the CI log.",
    "build": "0.7.1.1306",
    "pullRequest": 1855,
    "url": "https://github.com/cehinds/AshenSpire/pull/1855"
  },
  {
    "id": "pr-1854",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Your discard pile reshuffles back in, and your hand size now grows",
    "detail": "Holding cards at the end of a turn no longer stops the discard pile from coming back: when your draw pile can't cover the next turn's draw, the whole discard is shuffled in with your unplayed cards. Hand size now starts at 7 and grows with Intelligence (one more for every five points above 4, up to 20) instead of a flat 15. When the cards you keep already fill your hand, the end-of-turn discard lets you throw away as many as you like before you draw.",
    "build": "0.7.1.1305",
    "pullRequest": 1854,
    "url": "https://github.com/cehinds/AshenSpire/pull/1854"
  },
  {
    "id": "pr-1857",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Generated game data is no longer rewritten when it hasn't changed",
    "detail": "Development-process change only, nothing in the game changes. Two data builders rewrote their output on every run, so a test reading that data at the same moment could fail at random in CI; they now write only what changed.",
    "build": "0.7.1.1303",
    "pullRequest": 1857,
    "url": "https://github.com/cehinds/AshenSpire/pull/1857"
  },
  {
    "id": "pr-1852",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Choosing equipment is a sortable table now",
    "detail": "When you press Replace or Choose on a slot, the Armoury lists every item that fits as a row: portrait, name and kind, an Equipped here / Not equipped / held-elsewhere status, and Inspect plus Equip, Move here or Unequip. Sort by Item or Status, show the items that don't fit along with the reason, and Inspect opens the full card in place. A single sceptre held in your main hand now says so and offers Move here for the off hand.",
    "build": "0.7.1.1302",
    "pullRequest": 1852,
    "url": "https://github.com/cehinds/AshenSpire/pull/1852"
  },
  {
    "id": "pr-1829",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "One Workbench for every authoring tool",
    "detail": "For people building the game rather than playing it: one window now opens the content, interface and pose editors and every preview page, with the game running beside them and reloading when a file is saved. Game data can also be exported as JSON tables for Unity or Unreal. Nothing in the game itself changes.",
    "build": "0.7.1.1299",
    "pullRequest": 1829,
    "url": "https://github.com/cehinds/AshenSpire/pull/1829"
  },
  {
    "id": "pr-1851",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Preview builds for every open branch now publish",
    "detail": "Development-process change only, nothing in the game changes. A branch whose name starts with a capital letter, such as Chore/…, now gets its playable preview page like any other open branch, instead of a broken link.",
    "build": "0.7.1.1298",
    "pullRequest": 1851,
    "url": "https://github.com/cehinds/AshenSpire/pull/1851"
  },
  {
    "id": "pr-1848",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Game rules updated for clearer combat feedback",
    "detail": "Rules document change only, nothing in the game changes yet. The rules now say an attack plays the swing and the return to stance before the target reacts, and before numbers and health bars update. They also say the game will report why a reaction wasn't offered and when a Smash breaks Guard.",
    "build": "0.7.1.1297",
    "pullRequest": 1848,
    "url": "https://github.com/cehinds/AshenSpire/pull/1848"
  },
  {
    "id": "pr-1846",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "A test now passes on Windows too",
    "detail": "Development-process change only, nothing in the game changes. One source check compared file paths with forward slashes and failed on the Windows test runners at Test; it now reads paths the same way on every system.",
    "build": "0.7.1.1296",
    "pullRequest": 1846,
    "url": "https://github.com/cehinds/AshenSpire/pull/1846"
  },
  {
    "id": "pr-1843",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Combat HUD reads better on every screen size, and its look is tunable from the HUD studio",
    "detail": "On desktop and widescreen the Combat log and Reaction switch now sit just above your cards instead of at the far screen edges, and the top health bar no longer stretches across the whole screen (it also stops at 60% on tablets). On every screen, health and intent numbers sit on dark plates with a soft shadow, and the selected hero's panel uses the game's serif lettering with gold Poise and Ward labels and a green frame. The game now tells phones, tablets, desktops and ultra-wide screens apart (a sideways phone counts as a tablet), and each gets its own look from a file the HUD Component Studio exports.",
    "build": "0.7.1.1295",
    "pullRequest": 1843,
    "url": "https://github.com/cehinds/AshenSpire/pull/1843"
  },
  {
    "id": "pr-1834",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Faster checks on every change; release builds the Windows installer",
    "detail": "Development-process change only, nothing in the game changes. Pull requests now run a quick smoke check of about five minutes, the full test suites run when a build is promoted to Test, and Release runs the final polish checks and builds the Windows installer, whose download now follows the Release channel. Each open feature branch gets its own playable build, the README refreshes itself, and new high-resolution art moves to the art repository automatically.",
    "build": "0.7.1.1293",
    "pullRequest": 1834,
    "url": "https://github.com/cehinds/AshenSpire/pull/1834"
  },
  {
    "id": "pr-1841",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Old QA screenshots cleared out of the project",
    "detail": "Development housekeeping only, nothing in the game changes. About 237 MB of dated QA screenshots and run reports leave the repository; new QA runs go to CI artifacts, and the card layer editor and card preview pages the QA tools use now live under tools/.",
    "build": "0.7.1.1292",
    "pullRequest": 1841,
    "url": "https://github.com/cehinds/AshenSpire/pull/1841"
  },
  {
    "id": "pr-1835",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Fights move faster at every pace",
    "detail": "The pause between actions and the wait after the last hit are about 40% shorter, and a turn banner now clears before the next action starts, and the stagger between hits, attack lunges and impacts are up to 25% shorter, so Normal fights no longer drag. Normal is the new baseline; Slow and Fast scale from it, and Instant is unchanged. Hit timing stays readable: the wind-up and impact frames never lose more than a quarter of their time.",
    "build": "0.7.1.1291",
    "pullRequest": 1835,
    "url": "https://github.com/cehinds/AshenSpire/pull/1835"
  },
  {
    "id": "pr-1830",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Menus and pop-ups no longer reset the screen, and map taps answer faster on phones",
    "detail": "Choosing a slot, going back or deleting a save in the title's New Game window updates only that window: the title no longer redraws or replays its opening. Importing saves no longer reloads the page, and Settings keeps your place when it redraws. On the map, a tapped node stays under your finger, pressing a selected node again travels to it, and selecting a node takes about half as long.",
    "build": "0.7.1.1289",
    "pullRequest": 1830,
    "url": "https://github.com/cehinds/AshenSpire/pull/1830"
  },
  {
    "id": "pr-1833",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Fighters visibly flinch when hit",
    "detail": "When your hero takes damage they now play a short seven-frame hurt pose, flashing red on frames 2, 4 and 6 while they are knocked back a step. This replaces the brief rainbow flicker. Enemies recoil further and their red flash starts at the moment of impact. With Reduce flashes on, the hurt pose plays without the red.",
    "build": "0.7.1.1287",
    "pullRequest": 1833,
    "url": "https://github.com/cehinds/AshenSpire/pull/1833"
  },
  {
    "id": "pr-1832",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "Worker branch rules documented; feature-branch playable builds announced",
    "detail": "Development-process change only, nothing in the game changes. The contributor guides describe how worker branches flow into a feature branch and when they are cleaned up. The README names where each open feature, fix or chore branch's playable build will live; publishing those builds is still pending, so the link does not work yet.",
    "build": "0.7.1.1283",
    "pullRequest": 1832,
    "url": "https://github.com/cehinds/AshenSpire/pull/1832"
  },
  {
    "id": "pr-1831",
    "date": "2026-10-11",
    "group": "2026-10-11",
    "summary": "AI sessions: work lands in small commits, reviewed as they land",
    "detail": "Development-process change only, nothing in the game changes. Every agent splits its task into very small steps and pushes one self-contained commit per step, and reviewers check each commit as it arrives instead of waiting for the whole task.",
    "build": "0.7.1.1281",
    "pullRequest": 1831,
    "url": "https://github.com/cehinds/AshenSpire/pull/1831"
  },
  {
    "id": "pr-1825",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Clicking a target no longer shuffles enemy labels",
    "detail": "Clicking an enemy's target button no longer selects that enemy after your card resolves, so the labels above the enemies stay put, including with reduced motion on. Clicking any target after keyboard navigation clears the old cursor first, while keyboard focus still moves the cursor to the target.",
    "build": "0.7.1.1280",
    "pullRequest": 1825,
    "url": "https://github.com/cehinds/AshenSpire/pull/1825"
  },
  {
    "id": "pr-1824",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Reduced motion keeps combat controls still",
    "detail": "When reduced motion is enabled in the game or operating system, the battlefield no longer rewrites the settled Inspect and fighter-detail positions every frame. Changing that preference during a fight settles the controls once or resumes normal tracking. Normal motion still tracks moving artwork, while reduced motion keeps the controls fixed.",
    "build": "0.7.1.1279",
    "pullRequest": 1824,
    "url": "https://github.com/cehinds/AshenSpire/pull/1824"
  },
  {
    "id": "pr-1823",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Discard and Draw counts fit again on mid-size and landscape phone footers",
    "detail": "On 601–680px screens and short landscape layouts, the Draw and Discard piles once more use the smaller icon and counts that fit their size, instead of an oversized icon that pushed the counts out.",
    "build": "0.7.1.1275",
    "pullRequest": 1823,
    "url": "https://github.com/cehinds/AshenSpire/pull/1823"
  },
  {
    "id": "pr-1818",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Every fighter's Inspect button is always shown and holds still; bigger footer piles on phones",
    "detail": "Every enemy and the player now show an Inspect \"i\" at all times, and it no longer bobs with the idle animation; when space is tight it moves beside the enemy's intent or onto the enemy's own art instead of hiding under the top bar. On phones the Draw, Discard and Potions controls are larger with bigger icons and counts, and an enemy's intent and health no longer sit over the player's head.",
    "build": "0.7.1.1273",
    "pullRequest": 1818,
    "url": "https://github.com/cehinds/AshenSpire/pull/1818"
  },
  {
    "id": "pr-1820",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Mobile reach check's intent-badge plant matches again",
    "detail": "Development-process change only. The mobile reach self-test again recognises its own planted fault when a neighbouring fighter's intent badge, rather than its artwork, covers another fighter's intent.",
    "build": "0.7.1.1267",
    "pullRequest": 1820,
    "url": "https://github.com/cehinds/AshenSpire/pull/1820"
  },
  {
    "id": "pr-1819",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Save-and-load browser check follows the restart rule",
    "detail": "Development-process change only. The browser check for loading a save now expects an unsaved fight to restart from its first turn, matching how the game has behaved since #1811.",
    "build": "0.7.1.1266",
    "pullRequest": 1819,
    "url": "https://github.com/cehinds/AshenSpire/pull/1819"
  },
  {
    "id": "pr-1815",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Targeting, co-op HUD and footer fixes",
    "detail": "Pressing Enter on a focused enemy now targets that enemy instead of a stale card. Formation target cells show their numbers again, never sit under cards or buttons, and an enemy whose cell cannot fit is targeted by its figure. Classic appearance keeps its own layout and target order. The player panel stays clear of the selected target. Co-op shows resource labels and each seat's level again. Footer art lines up with its buttons, and the compact End Turn shows its key.",
    "build": "0.7.1.1265",
    "pullRequest": 1815,
    "url": "https://github.com/cehinds/AshenSpire/pull/1815"
  },
  {
    "id": "pr-1816",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Project status docs match the build again",
    "detail": "Development-process change only. FINISH.md and SPEC's scope table now record the Blacksmith, the three shops, Poise, class mastery and the per-run feat budget as built, and offline play as partly done.",
    "build": "0.7.1.1263",
    "pullRequest": 1816,
    "url": "https://github.com/cehinds/AshenSpire/pull/1816"
  },
  {
    "id": "pr-1811",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Abandoned fights restart, and four engine fixes",
    "detail": "Closing the game mid-fight without saving restarts that fight from the start or your last save again, instead of resuming after your last card or reaction. Solo fights count a discard chosen after an ability card as a new action, the same as co-op. Swapping class cards no longer grants a second set of feats or attribute points: a run's six feat slots and four points are shared by every class you equip. With a per-fight level cap, XP banked by an earlier fight is no longer thrown away.",
    "build": "0.7.1.1262",
    "pullRequest": 1811,
    "url": "https://github.com/cehinds/AshenSpire/pull/1811"
  },
  {
    "id": "pr-1813",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Combat and Shrine fixes from the October review",
    "detail": "Leaving the Smith after an upgrade at a normal Shrine now ends the visit instead of also allowing a Rest. Upcasting an area card such as Contagion plays it at once at the chosen rank. Co-op fighters keep their fitted layout through the encounter. Enemy tap areas stay a full finger-width apart. Tapping an enemy's name opens its full read again. Counter hits of 6 HP or more hit-stop like attacks. A card's upcast offset resets after a resize or rotation.",
    "build": "0.7.1.1260",
    "pullRequest": 1813,
    "url": "https://github.com/cehinds/AshenSpire/pull/1813"
  },
  {
    "id": "pr-1812",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Bulk QA evidence stays out of the repository",
    "detail": "Development-process change only. Raw browser-run results, geometry dumps and health logs go to CI artifacts, about 39 MB of them leave the tree, and a test blocks any new evidence JSON over 256 KiB.",
    "build": "0.7.1.1258",
    "pullRequest": 1812,
    "url": "https://github.com/cehinds/AshenSpire/pull/1812"
  },
  {
    "id": "pr-1809",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "AI sessions: model names follow the newest release, and old worktrees are cleaned up",
    "detail": "Development-process change only, nothing in the game changes. Sessions remove finished worktrees to save disk space.",
    "build": "0.7.1.1257",
    "pullRequest": 1809,
    "url": "https://github.com/cehinds/AshenSpire/pull/1809"
  },
  {
    "id": "pr-1808",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "AI sessions: an Opus orchestrator directs Haiku workers",
    "detail": "Development-process change only, nothing in the game changes. The main session plans, verifies, reviews and lands work, and scoped implementation runs on Haiku worker agents.",
    "build": "0.7.1.1256",
    "pullRequest": 1808,
    "url": "https://github.com/cehinds/AshenSpire/pull/1808"
  },
  {
    "id": "pr-1806",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Bigger cards and footer on phones; enemies no longer hide each other",
    "detail": "Phone cards are about a fifth larger and the footer's action orb and End Turn button grow. In fights where two enemies share a formation column, a phone no longer draws one wholly behind the other; each stands under its own intent and health. The victory banner now plays above the fighters and the hand instead of behind the player.",
    "build": "0.7.1.1255",
    "pullRequest": 1806,
    "url": "https://github.com/cehinds/AshenSpire/pull/1806"
  },
  {
    "id": "pr-1804",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Newly painted enemies fall back and come back cleanly",
    "detail": "When their art cannot load, the new enemies show their name in place of the picture, and Retry paints them again; taps on them always reach the enemy, never an inner layer.",
    "build": "0.7.1.1251",
    "pullRequest": 1804,
    "url": "https://github.com/cehinds/AshenSpire/pull/1804"
  },
  {
    "id": "pr-1799",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Art retry verification requires a visible fallback",
    "detail": "The blocked-art browser check accepts a marked placeholder that retains its hidden failed image only when its fallback is visibly laid out, while still requiring visible art to return after Retry. Game behavior is unchanged.",
    "build": "0.7.1.1248",
    "pullRequest": 1799,
    "url": "https://github.com/cehinds/AshenSpire/pull/1799"
  },
  {
    "id": "pr-1797",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Pull requests into dev are checked in about five minutes",
    "detail": "The four full-simulation tests that held one shard at 8m19s now run on every push to test and release instead of on each pull request; no test was removed. Also, on short landscape phones, tapping an enemy's body no longer selects the enemy standing behind it: when two idle enemies' invisible tap squares would collide, only the squares move apart, while artwork and name plates stay put.",
    "build": "0.7.1.1247",
    "pullRequest": 1797,
    "url": "https://github.com/cehinds/AshenSpire/pull/1797"
  },
  {
    "id": "pr-1796",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Steadier names under reduced motion and reachable Info on phones",
    "detail": "With Reduced motion on, enemy names and health no longer twitch by fractions of a pixel as the board settles, and moving the pointer no longer drifts the backdrop. The player's Info and action buttons stay above the hand instead of slipping under it when the character stands low on narrow phones. Newly painted enemies bob while idle again, and a hit no longer knocks their bob out of step.",
    "build": "0.7.1.1245",
    "pullRequest": 1796,
    "url": "https://github.com/cehinds/AshenSpire/pull/1796"
  },
  {
    "id": "pr-1800",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Selected counters and sweeps carry their weapon effects",
    "detail": "Reaver, Starseer, Herald and Rogue use the eight selected stance-to-attack clips with steel slashes, staff trails, palm impacts and dagger effects. Four phases return to the original ready frame, and combat and card previews share the same timing. Confirmed counters and physical sweeps keep their chosen preparation stance between actions; original idle, attack, defend and casting artwork stays intact. Reduced motion and reduced flashes clear the separate effect layers.",
    "build": "0.7.1.1244",
    "pullRequest": 1800,
    "url": "https://github.com/cehinds/AshenSpire/pull/1800"
  },
  {
    "id": "pr-1795",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Enemy combat art gains painted action sets",
    "detail": "Integrate 33 enemy sets with melee, ranged, spell, guard and reaction frames through the shared art loader. Preserve existing action timing and reduced-motion behavior. The continuation handoff records remaining angle, clipping and halo review.",
    "build": "0.7.1.1236",
    "pullRequest": 1795,
    "url": "https://github.com/cehinds/AshenSpire/pull/1795"
  },
  {
    "id": "pr-1794",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Fallen enemies no longer crowd living targets",
    "detail": "A defeated enemy stays on the field for its defeat pose but no longer reserves an invisible tap target or shows its faded name and health plate, so living fighters' footers keep their places without a ghost plate over them and the HUD no longer shifts around it.",
    "build": "0.7.1.1234",
    "pullRequest": 1794,
    "url": "https://github.com/cehinds/AshenSpire/pull/1794"
  },
  {
    "id": "pr-1792",
    "date": "2026-10-10",
    "group": "2026-10-10",
    "summary": "Reserve combat HUD targets and keep self-cast proxies reachable",
    "detail": "The full render authors the hand, measures the zero-width-reserve toolbar, then fits once; shared fading and later HUD tracking retain full footer and independent Info reservations. The waist-overlap player's independent 44px proxy packs inside the visible field above hand/action obstacles while enemy footers retain their body-bottom floors. The component contract checker now requires this actual deferred lifecycle, with negative regressions for missing or duplicated fits.",
    "build": "0.7.1.1232",
    "pullRequest": 1792,
    "url": "https://github.com/cehinds/AshenSpire/pull/1792"
  },
  {
    "id": "pr-1789",
    "date": "2026-10-09",
    "group": "2026-10-09",
    "summary": "Weapon attacks use four painted phases",
    "detail": "Reaver, Starseer, Herald and Rogue use reviewed greatsword, sword and shield, bow, casting, energy blade, paired dagger, dagger and sword sequences. Supported attacks share their timing with card previews and co-op, preserve casting effects and return to the selected stance. Unsupported weapon combinations retain their existing class actions; provisional spear paintings remain excluded. Smaller 256 px sprites and backgrounds reduce the standalone download while keeping the same on-screen placement.",
    "build": "0.7.1.1229",
    "pullRequest": 1789,
    "url": "https://github.com/cehinds/AshenSpire/pull/1789"
  },
  {
    "id": "pr-1787",
    "date": "2026-10-09",
    "group": "2026-10-09",
    "summary": "Selected combatants come forward with a compact HUD",
    "detail": "Keep the existing cards and footer while showing compact intent icons and HP strips. Selecting a sprite, intent or HP reveals that character's details, outlines enemies red and players green, and brings the sprite forward at 105% scale. Deselect restores its exact size and layer. Small Information controls stay above the sprite, self-cast cards work through player HP, selected cards show their action icon, and header HP fills proportionally toward Armoury. On narrow phones, compact selected details and the log toolbar stay clear of target controls and cards.",
    "build": "0.7.1.1227",
    "pullRequest": 1787,
    "url": "https://github.com/cehinds/AshenSpire/pull/1787"
  },
  {
    "id": "pr-1776",
    "date": "2026-10-09",
    "group": "2026-10-09",
    "summary": "Compact combat targeting and touch controls",
    "detail": "Keep enemy labels below their sprites and player details beside the character, with a background only when selected and Inspect above the player. Make intent badges and the player health strip usable card targets. Fit smaller idle cards and compact footer controls on narrow phones. Place Log and Reaction at the right above the cards; tap the log to toggle or drag it to snap between three sizes without inner buttons. Keep card Inspect inside the selected face, clear of the toolbar.",
    "build": "0.7.1.1225",
    "pullRequest": 1776,
    "url": "https://github.com/cehinds/AshenSpire/pull/1776"
  },
  {
    "id": "pr-1785",
    "date": "2026-10-09",
    "group": "2026-10-09",
    "summary": "Enemy names remain inspectable beside fighter targets",
    "detail": "The full enemy name opens inspection beside an independent 44px fighter-selection core within the existing footer. Native input uses the actual side-core geometry while retaining keyboard inspection, conditional card/flask targeting, full obstacle footprints, artwork and hand positions.",
    "build": "0.7.1.1209",
    "pullRequest": 1785,
    "url": "https://github.com/cehinds/AshenSpire/pull/1785"
  },
  {
    "id": "pr-1784",
    "date": "2026-10-09",
    "group": "2026-10-09",
    "summary": "Crowded combat targets keep a clear HUD slot",
    "detail": "When the player panel blocks enemy footers on short phone screens, one bounded placement retry clears more targets while preserving full HUD and Info footprints, artwork, hand positions and honest obstruction reporting.",
    "build": "0.7.1.1207",
    "pullRequest": 1784,
    "url": "https://github.com/cehinds/AshenSpire/pull/1784"
  },
  {
    "id": "pr-1783",
    "date": "2026-10-09",
    "group": "2026-10-09",
    "summary": "The historical Alternative Test promotion is recorded",
    "detail": "Restore the missing receipt for the reviewed alternative combat promotion without changing its original build identity or the surrounding history.",
    "build": "0.7.1.1205",
    "pullRequest": 1783,
    "url": "https://github.com/cehinds/AshenSpire/pull/1783"
  },
  {
    "id": "pr-1781",
    "date": "2026-10-09",
    "group": "2026-10-09",
    "summary": "Alternative combat perspective becomes the default",
    "detail": "Regular Dev/Test inherit the approved alternative battlefield, artwork and animations together with readable card effects, primary bottom-band actions, stance counters, persistent Ward, status stacks, Upcast, hidden intents, enemy knowledge and Ashen Blight. Compact hand, Info and fighter targets stay reachable. The former root alternative branches are frozen; future updates use regular Dev/Test.",
    "build": "0.7.1.1203",
    "pullRequest": 1781,
    "url": "https://github.com/cehinds/AshenSpire/pull/1781"
  },
  {
    "id": "pr-1768",
    "date": "2026-10-09",
    "group": "2026-10-09",
    "summary": "Readable card effects and stable combat targets",
    "detail": "Damage effects show their damage types while action names stay at the bottom. Authored card faces resolve fixed formula values and explain supported state-dependent quantities. Fighters anchor to the hand viewport, and small-screen player and enemy tap areas remain reachable. Counters retain their visible preparation through first-render work, and phone Upcast controls clear the footer.",
    "build": "0.7.1.1198",
    "pullRequest": 1768,
    "url": "https://github.com/cehinds/AshenSpire/pull/1768"
  },
  {
    "id": "pr-1778",
    "date": "2026-10-09",
    "group": "2026-10-09",
    "summary": "The shared card design loads without repeated master data",
    "detail": "Keep the complete editable card structure while storing its shared components once in the game bundle. Browser checks follow optional reaction choices, current fighter motion and the combat layer order.",
    "build": "0.7.1.1195",
    "pullRequest": 1778,
    "url": "https://github.com/cehinds/AshenSpire/pull/1778"
  },
  {
    "id": "pr-1766",
    "date": "2026-10-09",
    "group": "2026-10-09",
    "summary": "Card actions and ranks stay readable over their artwork",
    "detail": "Cards separate their background, art, backdrops, trim, icons and text into explicit layers. Rank 1 and higher appear as Rank X centered above the effect panel; Rank 0 stays hidden. A dark title fade, solid action symbols and centered names keep the face readable. Smash uses a fist and Counter a shield crossed by a sword. Up to three primary symbols line the right edge; Information keeps every tag. Complete effects and their blue rank bar adapt together. The shared master JSON controls component images, symbols, typography, layer order and geometry. The card layer explorer saves grouped move/scale edits directly to that game template and previews actual combat cards.",
    "build": "0.7.1.1193",
    "pullRequest": 1766,
    "url": "https://github.com/cehinds/AshenSpire/pull/1766"
  },
  {
    "id": "pr-1740",
    "date": "2026-10-09",
    "group": "2026-10-09",
    "summary": "Alternative combat keeps its art with the complete tactical rules",
    "detail": "The alternative battlefield and class motions now use Martial and Spell tactics, enemy learning, full upcast prices and saved Blight outcomes. Counter preparation follows the played card, paid rank and character, and phone cards and Upcast controls stay reachable. Thinner resource glows let the authored Counter motion finish without changing its pace. Corrupted cards keep readable volcanic trim while both development histories and alternative artwork remain preserved.",
    "build": "0.7.1.1191",
    "pullRequest": 1740,
    "url": "https://github.com/cehinds/AshenSpire/pull/1740"
  },
  {
    "id": "pr-1775",
    "date": "2026-10-09",
    "group": "2026-10-09",
    "summary": "Compact combat details stay clear of cards",
    "detail": "Pack enemy name and health plates around the visible hand and player details on short screens with enlarged text. Keep the sprites fixed while moving only crowded plates. Verify attacks through the visible target buttons and saved turns through the normal defensive-reaction controls.",
    "build": "0.7.1.1189",
    "pullRequest": 1775,
    "url": "https://github.com/cehinds/AshenSpire/pull/1775"
  },
  {
    "id": "pr-1773",
    "date": "2026-10-09",
    "group": "2026-10-09",
    "summary": "Attached enemy targets and visible player details",
    "detail": "Keep compact enemy selection cells on their sprites, shrink them before moving away, and preserve neighboring target order. Show enemy name and health below their bodies and place the player's name, level, health and live combat details beside the character, clear of cards. Pack co-op details without collisions and keep landscape combat tools out of targeting space.",
    "build": "0.7.1.1184",
    "pullRequest": 1773,
    "url": "https://github.com/cehinds/AshenSpire/pull/1773"
  },
  {
    "id": "pr-1772",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Stable rear sprites and clear battlefield layers",
    "detail": "Keep character size and resting positions fixed as cards leave or return to the hand, including co-op updates and empty-hand resizing. Rear player artwork moves only for melee and returns to its anchor. Raise the player, move enemies back and right, and lower the footer fade behind characters while HUD, cards and selection controls retain their shared layer order.",
    "build": "0.7.1.1175",
    "pullRequest": 1772,
    "url": "https://github.com/cehinds/AshenSpire/pull/1772"
  },
  {
    "id": "pr-1767",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Ordered counters, defensive reactions and combat controls",
    "detail": "Pause incoming actions for owned affordable Counter and defensive Sweep choices, then resume after Back or the paid response. Reveal each actor's current intent at its turn start, pace counter return animations, preserve exact save and co-op ownership, and add the reaction switch and three-size round log. Keep the player mini HUD 10 screen pixels above visible sprite art, including expanded status bars.",
    "build": "0.7.1.1172",
    "pullRequest": 1767,
    "url": "https://github.com/cehinds/AshenSpire/pull/1767"
  },
  {
    "id": "pr-1770",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Behind the scenes: Test promotion keeps its full history",
    "detail": "The reviewed appearance and player-guide delivery retains the existing Test history so channel promotion can proceed. Fresh desktop, phone and co-op appearance checks are saved alongside the reproducible capture recipe.",
    "build": "0.7.1.1167",
    "pullRequest": 1770,
    "url": "https://github.com/cehinds/AshenSpire/pull/1770"
  },
  {
    "id": "pr-1757",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Choose your game appearance",
    "detail": "The alternative appearance is now the default. With the debug flag on, Classic appearance restores the previous character art, animation and battlefield layout without changing the run. Art libraries distinguish classic, alternative and shared assets. The shorter README puts every channel beside its full published build number, illustrates the current Release candidate, lists implemented features, and highlights AI authorship, third-party licences and unresolved asset records.",
    "build": "0.7.1.1166",
    "pullRequest": 1757,
    "url": "https://github.com/cehinds/AshenSpire/pull/1757"
  },
  {
    "id": "pr-1762",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Ashen Blight flows through volcanic rock",
    "detail": "The owner-selected Molten River material fills the centered meter with a glowing orange lava channel between black basalt banks. A taller track keeps it readable on phones; zero Blight stays hidden, and high-contrast mode uses the system highlight.",
    "build": "0.7.1.1154",
    "pullRequest": 1762,
    "url": "https://github.com/cehinds/AshenSpire/pull/1762"
  },
  {
    "id": "pr-1751",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Alternative combat opens up with option C",
    "detail": "The approved pointed shield and inner-loop Counter match the named card footers, with distinct HP and Poise damage symbols. Side-tree foreground layers are removed, the larger player overlaps the cards at the waist and enemies stand closer to the center. Textured intent plates and centered selection plates share their outline and color; the top HUD fades into the scene.",
    "build": "0.7.1.1152",
    "pullRequest": 1751,
    "url": "https://github.com/cehinds/AshenSpire/pull/1751"
  },
  {
    "id": "pr-1763",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Ashen Blight flows through volcanic rock",
    "detail": "The owner-selected Molten River material fills the centered meter with a glowing orange lava channel between black basalt banks. A taller track keeps it readable on phones; zero Blight stays hidden, and high-contrast mode uses the system highlight.",
    "build": "0.7.1.1152",
    "pullRequest": 1763,
    "url": "https://github.com/cehinds/AshenSpire/pull/1763"
  },
  {
    "id": "pr-1765",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Contract: reaction controls and round combat log",
    "detail": "Specify Back/Play skip behavior, an owned combat-scoped reaction switch, and the in-place public round log with three responsive sizes. This contract precedes runtime implementation.",
    "build": "0.7.1.1149",
    "pullRequest": 1765,
    "url": "https://github.com/cehinds/AshenSpire/pull/1765"
  },
  {
    "id": "pr-1742",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Counters prepare the right action and Upcast stays reachable",
    "detail": "Expanded Counter cards prepare defense or casting using the played card, its paid Upcast rank and its character in solo and co-op. The selected card's Upcast chooser stays within the phone screen. Corrupted cards keep their full volcanic trim across illustrated cards, rarities and card themes while effect text stays readable.",
    "build": "0.7.1.1148",
    "pullRequest": 1742,
    "url": "https://github.com/cehinds/AshenSpire/pull/1742"
  },
  {
    "id": "pr-1745",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Alternative heroes hold their selected combat poses",
    "detail": "Reaver, Rogue, Starseer and Herald use the twelve chosen Attack, Defend and Prepare poses after card actions. Books and defensive guards follow the selected artwork. Each co-op player keeps their own pose until their next turn; counters keep their existing presentation for a later selection pass. The separate Block, Barrier and Ward box is removed. Ashen Blight now appears as a wider centered header bar only above zero, with its own row on phones.",
    "build": "0.7.1.1146",
    "pullRequest": 1745,
    "url": "https://github.com/cehinds/AshenSpire/pull/1745"
  },
  {
    "id": "pr-1761",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Contract: defensive reactions and actor-turn presentation",
    "detail": "Specify optional in-hand Counter and defensive Sweep choices, a separate successful Counter return, acting-enemy intent revelation, exact paused continuation, and the player widget's fixed gap above the art. This contract precedes runtime implementation.",
    "build": "0.7.1.1145",
    "pullRequest": 1761,
    "url": "https://github.com/cehinds/AshenSpire/pull/1761"
  },
  {
    "id": "pr-1759",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Finished runs record their outcome and phone title controls stay reachable",
    "detail": "Successful run checkpoints allow completion to record the result and clear the finished slot. A refused checkpoint still preserves the run for retry. On small phone screens, the title menu scrolls below the wordmark so Continue and the remaining controls stay usable.",
    "build": "0.7.1.1144",
    "pullRequest": 1759,
    "url": "https://github.com/cehinds/AshenSpire/pull/1759"
  },
  {
    "id": "pr-1756",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Victory rewards stay clear and touch maps respond immediately",
    "detail": "Long reward titles wrap inside their column, keeping progression readable on desktop. Selecting a map destination on a touch screen immediately reveals its details and enabled controls; desktop keeps its camera and tray sequence.",
    "build": "0.7.1.1144",
    "pullRequest": 1756,
    "url": "https://github.com/cehinds/AshenSpire/pull/1756"
  },
  {
    "id": "pr-1746",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Alternative figures keep idle life and respect reduced motion",
    "detail": "Authored class figures share the battlefield's existing idle rhythm, pause when down and honor reduced motion. Browser checks inspect painted canvas pixels, the correct class art and a single clocked carrier, and reject blank art or continued canvas movement under reduced motion.",
    "build": "0.7.1.1143",
    "pullRequest": 1746,
    "url": "https://github.com/cehinds/AshenSpire/pull/1746"
  },
  {
    "id": "pr-1750",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Combat intents and targets share the approved option C layout",
    "detail": "Intent plates use centered icons, readable values and matching textured selection plates. Unknown actions are purple, partial clues gold and revealed actions red. The approved pointed shield and inner-loop Counter symbol match the named card footers; counters show HP and Poise with distinct damage symbols. The larger solo player overlaps the hand at the waist, enemies move toward the center and the HUD fades into the battlefield.",
    "build": "0.7.1.1142",
    "pullRequest": 1750,
    "url": "https://github.com/cehinds/AshenSpire/pull/1750"
  },
  {
    "id": "pr-1744",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Alternative combat sigils and checkpoints reached Test",
    "detail": "The reviewed alternative combat card sigils, complete effects, checkpoints and reachable tutorial controls were promoted to Alternative Test with the existing battlefield artwork and animations.",
    "build": "0.7.1.1140",
    "pullRequest": 1744,
    "url": "https://github.com/cehinds/AshenSpire/pull/1744"
  },
  {
    "id": "pr-1737",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Alternative tutorial controls stay reachable",
    "detail": "Next and Skip avoid cards, combat controls and fighter targets on small screens while instructions allow card plays. Current combat prices and save checkpoints join the distinct sigils and complete effects, preserving the alternative battlefield art and animations.",
    "build": "0.7.1.1140",
    "pullRequest": 1737,
    "url": "https://github.com/cehinds/AshenSpire/pull/1737"
  },
  {
    "id": "pr-1755",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Combat shows Blight only when it matters",
    "detail": "The separate Block, Barrier and Ward summary box is removed. Positive Ashen Blight occupies a wider centered header bar, with its own row on phones, and disappears at zero. Recovery and Blight feat buttons remain reachable above combat figures.",
    "build": "0.7.1.1138",
    "pullRequest": 1755,
    "url": "https://github.com/cehinds/AshenSpire/pull/1755"
  },
  {
    "id": "pr-1748",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Combat scenery reaches the top of the screen",
    "detail": "The skyline sits higher while fighters stay grounded. The Vitality header shares the cards' dark leather background, staying opaque behind the resources and fading away by the Player or Enemy Turn banner.",
    "build": "0.7.1.1136",
    "pullRequest": 1748,
    "url": "https://github.com/cehinds/AshenSpire/pull/1748"
  },
  {
    "id": "pr-1731",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Alternative cards show action and school sigils",
    "detail": "Alternative combat keeps its battlefield artwork and class weapon animations while gaining the distinct monochrome marks, written damage types and complete adaptive effects. Information explains the marks and retains detailed tags, with both development histories preserved.",
    "build": "0.7.1.1134",
    "pullRequest": 1731,
    "url": "https://github.com/cehinds/AshenSpire/pull/1731"
  },
  {
    "id": "pr-1747",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Behind the scenes: alternative sync keeps the full history efficiently",
    "detail": "Sync downloads current files while retaining every commit needed to compare both development histories. Historical artwork is fetched only when needed, allowing the existing checks to run within their time limit.",
    "build": "0.7.1.1133",
    "pullRequest": 1747,
    "url": "https://github.com/cehinds/AshenSpire/pull/1747"
  },
  {
    "id": "pr-1734",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Read enemy clues and learn their Bestiary",
    "detail": "Hidden intents show unknown, Attack, Magic or Preparing clues until read exactly. Correct predictions of wholly unknown actions and successful tactical responses train run-only Perception automatically. Real encounters and tactical bonuses unlock five persistent Bestiary stages without replay farming. Solo saves and private co-op reads keep accepted learning exact, and failed profile writes retain learning for retry.",
    "build": "0.7.1.1132",
    "pullRequest": 1734,
    "url": "https://github.com/cehinds/AshenSpire/pull/1734"
  },
  {
    "id": "pr-1736",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Saved fights load with their intended combat rules",
    "detail": "Load checks cover existing fights that restart from their entry and expanded fights that restore their encounter or explicit Save Game checkpoint after later unsaved actions. Full resources, piles, enemies and random streams match the checkpoint, and refused loads preserve the live fight and return focus.",
    "build": "0.7.1.1130",
    "pullRequest": 1736,
    "url": "https://github.com/cehinds/AshenSpire/pull/1736"
  },
  {
    "id": "pr-1739",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Behind the scenes: complete combat checks finish within their limits",
    "detail": "Nothing you play changes. The full discovered-test, self-test and mobile-layout sets now run in exhaustive parallel pieces, so every original check still runs while each automated job remains within its 20-minute limit.",
    "build": "0.7.1.1128",
    "pullRequest": 1739,
    "url": "https://github.com/cehinds/AshenSpire/pull/1739"
  },
  {
    "id": "pr-1733",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Combat prices and checkpoints stay consistent",
    "detail": "Upcast cards show their full SP and Mana price before payment; solo and co-op apply the same Mana discount. Ordinary actions preserve the latest encounter or explicit Save Game checkpoint. Blight payments, choices and terminal outcomes save before taking effect, including zero-cost corrupted plays; a failed required save rejects the whole action. Blight feats refresh live equipment and Poise consistently with loading, and co-op joins preserve the active character.",
    "build": "0.7.1.1127",
    "pullRequest": 1733,
    "url": "https://github.com/cehinds/AshenSpire/pull/1733"
  },
  {
    "id": "pr-1732",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Valid card content keeps building through strict checks",
    "detail": "The bundler keeps adjacent static imports separate and accepts legal empty statements between whitespace. Strict syntax and refusal checks stay active; card effects and appearance are unchanged.",
    "build": "0.7.1.1124",
    "pullRequest": 1732,
    "url": "https://github.com/cehinds/AshenSpire/pull/1732"
  },
  {
    "id": "pr-1728",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Combat controls respond promptly and upcasts keep legal targets",
    "detail": "Accepted plays immediately lock further actions while the hand and fighters stay in place for their animation. Escape cancels a selected Counter card before closing the tutorial. Co-op Upcast appears under a selected card and opens only its rank chooser. Solo and co-op show legal targets for the selected rank, ask for a new target when its destination changes, and spend nothing before the final play. Cards with a higher base rank keep that rank when no upcast is chosen.",
    "build": "0.7.1.1122",
    "pullRequest": 1728,
    "url": "https://github.com/cehinds/AshenSpire/pull/1728"
  },
  {
    "id": "pr-1729",
    "date": "2026-10-08",
    "group": "2026-10-08",
    "summary": "Actions and schools have distinct card sigils",
    "detail": "A large monochrome action mark leads a smaller school mark and written damage types. Information explains each mark and keeps the detailed tags. Complete effects adapt to the available card space while preserving costs, ranks, conditions and durations.",
    "build": "0.7.1.1118",
    "pullRequest": 1729,
    "url": "https://github.com/cehinds/AshenSpire/pull/1729"
  },
  {
    "id": "pr-1723",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Martial and Spell combat is playable",
    "detail": "New runs use persistent stances, whole-action counters and evasion, Ward, typed defenses, status buildup and recovery, optional upcasting, and run-long Ashen Blight. Cards show their action at the bottom with compact effects and inspected tags; Powers Exhaust while their buffs stay active for the fight. Solo and co-op share the rules and saved outcomes. Existing runs retain their original combat rules.",
    "build": "0.7.1.1111",
    "pullRequest": 1723,
    "url": "https://github.com/cehinds/AshenSpire/pull/1723"
  },
  {
    "id": "pr-1727",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Cards animate with each class's base weapons",
    "detail": "Alternative combat now plays attack, smash, sweep, counter, defend, spell and ranged motions from the card type. Reaver uses a two-handed greatsword and crossbow, Rogue twin daggers and bow, Starseer staff and open book, and Herald unarmed strikes and book casting. Attacks advance and return, hits flash red, and the atelier and deck preview share the new motions. Equipment-tag combinations and stance families remain separate work.",
    "build": "0.7.1.1106",
    "pullRequest": 1727,
    "url": "https://github.com/cehinds/AshenSpire/pull/1727"
  },
  {
    "id": "pr-1725",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Power and card-label rules clarified",
    "detail": "Defines expanded Power casts that Exhaust their paid card instance while its installed effect lasts for the combat. Preserves authored action labels, reusable Skills, and separate deck Status cards. Additional copies and Replicas remain separate paid casts. This contract prepares the combat implementation; gameplay does not change yet.",
    "build": "0.7.1.1103",
    "pullRequest": 1725,
    "url": "https://github.com/cehinds/AshenSpire/pull/1725"
  },
  {
    "id": "pr-1721",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Alternative previews document the current published release",
    "detail": "Alternative preview documentation includes the primary release screenshot gallery and its maintenance rule while retaining alternative gameplay, artwork and both changelog histories.",
    "build": "0.7.1.1102",
    "pullRequest": 1721,
    "url": "https://github.com/cehinds/AshenSpire/pull/1721"
  },
  {
    "id": "pr-1726",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Enemy knowledge rules defined",
    "detail": "Specifies unknown and broad enemy clues, run Perception from successful predictions, and five-stage persistent bestiary knowledge. Defines saved receipts, bounded counter bonuses and private co-op reads. This is the contract for a later gameplay update; the game does not change yet.",
    "build": "0.7.1.1102",
    "pullRequest": 1726,
    "url": "https://github.com/cehinds/AshenSpire/pull/1726"
  },
  {
    "id": "pr-1719",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Base class actions are ready to preview",
    "detail": "The alternative animation atelier offers a dashing strike, defense and power for each class in base armour. Equipped weapons share the class's default animation. Reaver wears a full cape, Herald keeps the shield left and sword right, and the preview includes a red hit flash. These are editable animation studies; live combat integration and weapon-tag combinations come later.",
    "build": "0.7.1.1101",
    "pullRequest": 1719,
    "url": "https://github.com/cehinds/AshenSpire/pull/1719"
  },
  {
    "id": "pr-1715",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Alternative updates retain combat plans and starting choices",
    "detail": "The alternative version accepts future combat plans and shared starting ability updates while retaining its custom artwork and both changelog histories. Required starting abilities are also included in automated adventure checks.",
    "build": "0.7.1.1100",
    "pullRequest": 1715,
    "url": "https://github.com/cehinds/AshenSpire/pull/1715"
  },
  {
    "id": "pr-1718",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Next combat rules accepted for implementation",
    "detail": "Defines the complete Martial and Spell expansion: whole-action counters and evasion, persistent Ward, control recovery, optional upcasting, and three run-lasting Blight feat stages. Old runs keep their saved rules. This contract update prepares the runtime implementation; gameplay does not change yet.",
    "build": "0.7.1.1100",
    "pullRequest": 1718,
    "url": "https://github.com/cehinds/AshenSpire/pull/1718"
  },
  {
    "id": "pr-1720",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "README shows the current published game",
    "detail": "The README illustrates character creation, exploration, card combat and shops with screenshots from the published release candidate, including a phone view. Future README updates verify and refresh the gallery for the latest published release.",
    "build": "0.7.1.1099",
    "pullRequest": 1720,
    "url": "https://github.com/cehinds/AshenSpire/pull/1720"
  },
  {
    "id": "pr-1716",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Full-run checks choose a starting ability",
    "detail": "The browser probe completes required combat-maneuver or spell choices through their normal controls before advancing to Review. It covers one-choice and two-choice classes without changing creation rules or weakening the checks.",
    "build": "0.7.1.1098",
    "pullRequest": 1716,
    "url": "https://github.com/cehinds/AshenSpire/pull/1716"
  },
  {
    "id": "pr-1714",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Starting abilities respect your deck copy limit",
    "detail": "Raising the class spell and Power copy limit now lets character creation offer an ability already granted by your starting equipment. The preview and the finished deck use the same setting.",
    "build": "0.7.1.1097",
    "pullRequest": 1714,
    "url": "https://github.com/cehinds/AshenSpire/pull/1714"
  },
  {
    "id": "pr-1712",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Alternative Counters retain readable clauses and charges",
    "detail": "Conditional Counter clauses keep their printed values while preparation arms only eligible effects. One-use damage charges remain visible after effects with no contacts. The alternative battlefield and animation studies are preserved.",
    "build": "0.7.1.1095",
    "pullRequest": 1712,
    "url": "https://github.com/cehinds/AshenSpire/pull/1712"
  },
  {
    "id": "pr-1713",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Plans: recover from control and build around Blight",
    "detail": "The next combat proposal gives Sleep, Paralysis and Dazed recovery cards with clear Stamina costs, caps Sleep healing and Ward restoration, and trades Prone's ranged protection for greater Contact damage. Three Blight milestones offer feats with two benefits and one drawback. Counter coverage, school interactions, tag combos and optional upcasting are documented for future implementation; gameplay does not change in this update.",
    "build": "0.7.1.1094",
    "pullRequest": 1713,
    "url": "https://github.com/cehinds/AshenSpire/pull/1713"
  },
  {
    "id": "pr-1711",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Counter cards show the reply they prepare",
    "detail": "Choosing an enemy for immediate support no longer changes the printed Counter damage. One-use damage charges stay in the preview when an earlier damage effect has no contacts. Solo and co-op show the same armed reply.",
    "build": "0.7.1.1093",
    "pullRequest": 1711,
    "url": "https://github.com/cehinds/AshenSpire/pull/1711"
  },
  {
    "id": "pr-1706",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Alternative combat gains tactical cards and readable stances",
    "detail": "Physical and spell cards, damage effects and guarded Counters now follow the shared combat rules. Hidden enemy moves keep their stances visible, and co-op reads stay private to each character. The alternative battlefield retains its figures, layered scenery, motion and update history.",
    "build": "0.7.1.1092",
    "pullRequest": 1706,
    "url": "https://github.com/cehinds/AshenSpire/pull/1706"
  },
  {
    "id": "pr-1705",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Combat cards and enemy moves share tactical rules",
    "detail": "All current cards and enemy moves carry physical or spell identities, damage riders and counterplay. Counters wait for guarded hits, Stagger cancels reactions, and Wisdom/Intelligence reveal hidden moves while stances stay visible. Co-op uses each character’s own read; saves retain combat tuning.",
    "build": "0.7.1.1089",
    "pullRequest": 1705,
    "url": "https://github.com/cehinds/AshenSpire/pull/1705"
  },
  {
    "id": "pr-1703",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Square targets and starting abilities",
    "detail": "Enemy selection buttons form a square grid near their foes and move apart when crowded. After armaments, Starseer and Herald choose two distinct Rank 1 spells; Reaver and Rogue choose one Rank 1 combat maneuver. Legal choices follow equipped weapons and the selected cards enter the saved starting deck.",
    "build": "0.7.1.1080",
    "pullRequest": 1703,
    "url": "https://github.com/cehinds/AshenSpire/pull/1703"
  },
  {
    "id": "pr-1702",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Clearer header with fewer controls",
    "detail": "Edit Deck stays in Armaments instead of appearing twice. Thin black edges make header text, health bars, relics and controls easier to see over artwork.",
    "build": "0.7.1.1074",
    "pullRequest": 1702,
    "url": "https://github.com/cehinds/AshenSpire/pull/1702"
  },
  {
    "id": "pr-1707",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "More class animations to preview",
    "detail": "The alternative animation atelier adds Rogue twin daggers, Starseer staff and Herald sword-and-shield studies. The Herald keeps the sword in the right hand and shield on the left arm through attacks and reactions. Current attack timing, forward movement and return, red hit flashes, down poses and casting are available in the preview. These are authoring studies; gameplay integration and the remaining base loadouts are still pending.",
    "build": "0.7.1.1068",
    "pullRequest": 1707,
    "url": "https://github.com/cehinds/AshenSpire/pull/1707"
  },
  {
    "id": "pr-1709",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Behind the scenes: alternative class studies reach Test",
    "detail": "The reviewed Rogue, Starseer and Herald animation studies join the Reaver atelier in Alternative Test. Gameplay bindings and the remaining base loadouts stay pending.",
    "build": "0.7.1.1068",
    "pullRequest": 1709,
    "url": "https://github.com/cehinds/AshenSpire/pull/1709"
  },
  {
    "id": "pr-1701",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Both game versions retain their updates",
    "detail": "Alternative updates preserve the reviewed artwork checks, skill Level Up repairs and both changelog histories while accepting the latest promoted primary build.",
    "build": "0.7.1.1067",
    "pullRequest": 1701,
    "url": "https://github.com/cehinds/AshenSpire/pull/1701"
  },
  {
    "id": "pr-1689",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Alternative figures recover and keep moving",
    "detail": "Retry restores missing combat and dialogue artwork in place. Each alternative figure shares one idle animation that stops when fallen or when Reduced motion is enabled. Crowded combat controls and the short-landscape merchant remain reachable, with alternative artwork and both update histories preserved.",
    "build": "0.7.1.1065",
    "pullRequest": 1689,
    "url": "https://github.com/cehinds/AshenSpire/pull/1689"
  },
  {
    "id": "pr-1691",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Skill Level Up works after victory",
    "detail": "Class, Spellcraft, weapon and Combat Maneuvers claims no longer crash in the alternative standalone build. Earned XP and queued choices are retained.",
    "build": "0.7.1.1065",
    "pullRequest": 1691,
    "url": "https://github.com/cehinds/AshenSpire/pull/1691"
  },
  {
    "id": "pr-1704",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Combat matchup rules defined",
    "detail": "Defines shared player and enemy combat tags, deferred Counters, stance reads, spell roles and combo suggestions. Runtime changes follow separately; Ashen Blight remains a proposal.",
    "build": "0.7.1.1064",
    "pullRequest": 1704,
    "url": "https://github.com/cehinds/AshenSpire/pull/1704"
  },
  {
    "id": "pr-1697",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Rear sprite studies archived for authoring",
    "detail": "The editor-ready archive contains 31 character appearances and 26,071 editable weapon combinations, with corrected facing and character layers above equipment. Game sprites and equipment bindings remain unchanged.",
    "build": "0.7.1.1061",
    "pullRequest": 1697,
    "url": "https://github.com/cehinds/AshenSpire/pull/1697"
  },
  {
    "id": "pr-1698",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Alternative updates keep progressing",
    "detail": "The alternative version can regenerate its artwork during automatic updates using the same pinned encoder as the reviewed exports.",
    "build": "0.7.1.1060",
    "pullRequest": 1698,
    "url": "https://github.com/cehinds/AshenSpire/pull/1698"
  },
  {
    "id": "pr-1695",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Preview the new alternative character animations",
    "detail": "The animation atelier has a five-pose Reaver sword attack, forward movement and return, a red hit flash, hurt and down poses, and separate power and spell casts at the current combat pace. Existing effects follow the new silhouette. Full and light artwork and editable Workshop projects are available for review; the coverage board identifies the remaining base weapon combinations. This is an authoring preview, with gameplay integration still pending.",
    "build": "0.7.1.1060",
    "pullRequest": 1695,
    "url": "https://github.com/cehinds/AshenSpire/pull/1695"
  },
  {
    "id": "pr-1699",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Behind the scenes: alternative atelier reaches Test",
    "detail": "The reviewed Reaver sword, hurt, down, power and spell studies are promoted to Alternative Test as an authoring preview. Their gameplay bindings remain empty.",
    "build": "0.7.1.1060",
    "pullRequest": 1699,
    "url": "https://github.com/cehinds/AshenSpire/pull/1699"
  },
  {
    "id": "pr-1692",
    "date": "2026-10-07",
    "group": "2026-10-07",
    "summary": "Skill Level Up works after victory",
    "detail": "Class, Spellcraft, weapon and Combat Maneuvers claims no longer crash in the standalone build. Earned XP and queued choices are retained.",
    "build": "0.7.1.1059",
    "pullRequest": 1692,
    "url": "https://github.com/cehinds/AshenSpire/pull/1692"
  },
  {
    "id": "pr-1694",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Lighter alternative characters, clearer scenery",
    "detail": "The alternative version uses the shared 480px sprite and 720p scenery export policy. Its custom figures keep their original crop alignment and display size while using smaller files. Original paintings remain available for future exports.",
    "build": "0.7.1.1059",
    "pullRequest": 1694,
    "url": "https://github.com/cehinds/AshenSpire/pull/1694"
  },
  {
    "id": "pr-1684",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Alternative battles use the completed art collection",
    "detail": "All 32 named combat settings have four independent layers with desktop and phone compositions. The collection has 59 canonical idle appearances, including the approved rear companions and speakers; dedicated armor appearances resolve before older aliases. Phone exports keep the artwork smaller while the current HUD, cards and footer stay in place. Sprite feet remain grounded when co-op battles resize between desktop and phone.",
    "build": "0.7.1.1057",
    "pullRequest": 1684,
    "url": "https://github.com/cehinds/AshenSpire/pull/1684"
  },
  {
    "id": "pr-1693",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Sharper maps and lighter sprites",
    "detail": "Maps and backgrounds keep up to 720px of image height, and combat scenes retain their native detail. Sprites use lighter compression within a 480px ceiling. The shared art release and documented export targets apply to regular and alternative builds, with original paintings preserved.",
    "build": "0.7.1.1057",
    "pullRequest": 1693,
    "url": "https://github.com/cehinds/AshenSpire/pull/1693"
  },
  {
    "id": "pr-1690",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Landscape targets clear the intent labels",
    "detail": "Enemy tap areas and health columns move below nearby intent controls when space is tight, while their figures keep the same ground positions. The overlap check keeps the player's fitted tap area above the hand, and all five desktop and phone layouts are checked independently.",
    "build": "0.7.1.1056",
    "pullRequest": 1690,
    "url": "https://github.com/cehinds/AshenSpire/pull/1690"
  },
  {
    "id": "pr-1688",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Short-screen controls keep their own space",
    "detail": "Crowded enemy feet and health columns stay separate without moving their artwork. Intent labels remain reachable in short landscape views, and the merchant header sits below the HUD. Browser checks follow the actual tap areas; portable build checks include authored alternative artwork.",
    "build": "0.7.1.1054",
    "pullRequest": 1688,
    "url": "https://github.com/cehinds/AshenSpire/pull/1688"
  },
  {
    "id": "pr-1686",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Alternative builds gain class progression and retraining",
    "detail": "Class milestones, independently registered card, feat and relic catalogs, free retraining and ordered XP claims now work with the alternative battlefield. Its own artwork, formation and saved layouts are retained, with both update histories preserved.",
    "build": "0.7.1.1054",
    "pullRequest": 1686,
    "url": "https://github.com/cehinds/AshenSpire/pull/1686"
  },
  {
    "id": "pr-1676",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Choose each class milestone and retrain your build",
    "detail": "Class rewards now follow a saved schedule for cards, feats, equipment, relics and attributes. Independent catalog modules add 40 card families with six ranks, 50 feats, 50 ability tags and 10 relics; available choices and level lists populate from their requirements. Spellcraft and Combat Maneuvers offer three cards with an Intelligence chance for a fourth higher-rank option. Actions and Stamina share one pool. Free class retraining previews earned choices without rerolling offers or restoring spent rewards. Solo and co-op XP fill Class, Character and gained skills in order before revealing blue Level Up buttons and a green Continue; remaining XP fills when you return.",
    "build": "0.7.1.1052",
    "pullRequest": 1676,
    "url": "https://github.com/cehinds/AshenSpire/pull/1676"
  },
  {
    "id": "pr-1651",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Crowded combat targets stay selectable",
    "detail": "Numbered enemy targets make overlapping foes easy to select. Cards reject targets on the wrong side before spending resources, and enemies remain at least as tall as the player without shrinking sprites.",
    "build": "0.7.1.1048",
    "pullRequest": 1651,
    "url": "https://github.com/cehinds/AshenSpire/pull/1651"
  },
  {
    "id": "pr-1623",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "The Windows installer link downloads the installer",
    "detail": "The README's Windows installer link now downloads the latest test installer directly instead of opening the build page, where you had to sign in and unzip an artifact. The release and main installers have their own direct links.",
    "build": "0.7.1.1046",
    "pullRequest": 1623,
    "url": "https://github.com/cehinds/AshenSpire/pull/1623"
  },
  {
    "id": "pr-1679",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Your route, one choice at a time",
    "detail": "The map keeps the act name, Entrance, evenly spaced encounter circles and Boss on one desktop line. Empty circles fill with the encounters you enter, your current position is ringed, and your route returns with a saved run. On phones the title sits above the complete bar.",
    "build": "0.7.1.1045",
    "pullRequest": 1679,
    "url": "https://github.com/cehinds/AshenSpire/pull/1679"
  },
  {
    "id": "pr-1683",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Alternative characters keep pace",
    "detail": "The alternative preview gains the ready-to-play character defaults, compact class cards, stat and relic detail dialogs, and continuous Smith upgrades. Its own battlefield and artwork stay intact, with both update histories preserved.",
    "build": "0.7.1.1045",
    "pullRequest": 1683,
    "url": "https://github.com/cehinds/AshenSpire/pull/1683"
  },
  {
    "id": "pr-1681",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Inspect your starting stats and relic",
    "detail": "Select a resource or relic in the class preview to read its details. Stat dialogs define the resource and show its current calculation at the bottom. Escape closes the dialog in one press and returns focus to the selected control.",
    "build": "0.7.1.1043",
    "pullRequest": 1681,
    "url": "https://github.com/cehinds/AshenSpire/pull/1681"
  },
  {
    "id": "pr-1674",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Ready to begin, easier to read",
    "detail": "Character creation starts with Reaver, Standard attributes, Old Cinder and basic equipment selected. Compact class previews keep the sprite beside the details; full attribute names and a single stat row make the choices easier to scan. Main attribute bonuses are now one point each, with existing saves keeping their prior rules. Character cards, close buttons and the game menu are aligned and corrected.",
    "build": "0.7.1.1041",
    "pullRequest": 1674,
    "url": "https://github.com/cehinds/AshenSpire/pull/1674"
  },
  {
    "id": "pr-1672",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Alternative updates keep their build numbers current",
    "detail": "Promotion syncs retain full merge history while avoiding downloads of old artwork. If primary and alternative build counters differ, the merged preview is regenerated from the newest counter in its release so it cannot fall behind promoted changes.",
    "build": "0.7.1.1039",
    "pullRequest": 1672,
    "url": "https://github.com/cehinds/AshenSpire/pull/1672"
  },
  {
    "id": "pr-1675",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Upgrade items in one continuous visit",
    "detail": "Open an item with one press and see every card upgrade expanded. After each upgrade, choose another item while Smithing Stones remain. The header shows the available stones beside a clear close button, and Back to Shrine fills the footer.",
    "build": "0.7.1.1038",
    "pullRequest": 1675,
    "url": "https://github.com/cehinds/AshenSpire/pull/1675"
  },
  {
    "id": "pr-1673",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Alternative artwork loads from the web packs",
    "detail": "The hosted alternative game loads its sprites and scenery through verified asset packs. Its portable download keeps the same artwork embedded for offline play.",
    "build": "0.7.1.1038",
    "pullRequest": 1673,
    "url": "https://github.com/cehinds/AshenSpire/pull/1673"
  },
  {
    "id": "pr-1671",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Your character, gear and deck share one Armory",
    "detail": "Switch between Character, Armory and Edit Deck at the top. Progression brings your level, attributes and character sheet together; available points open the familiar level-up choices. Skills open their cards, tags, bonuses and reward tree. Acquired feats fill a responsive grid with their effects and detail windows. The close button keeps its proper shape.",
    "build": "0.7.1.1036",
    "pullRequest": 1671,
    "url": "https://github.com/cehinds/AshenSpire/pull/1671"
  },
  {
    "id": "pr-1668",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Alternative combat keeps its own battlefield",
    "detail": "New dev changes flow into alternative/dev after a protected merge verifies that its battlefield, HUD, cards and footer stay unchanged. Background and sprite updates remain eligible; unrelated conflicts stop for review. The pipeline builds and publishes the updated alternative preview.",
    "build": "0.7.1.1034",
    "pullRequest": 1668,
    "url": "https://github.com/cehinds/AshenSpire/pull/1668"
  },
  {
    "id": "pr-1667",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Alternative previews stay current without losing their changes",
    "detail": "Promoted updates synchronize existing alternative development and test branches when their custom files remain intact; overlapping changes stop for review. Alternative previews use the same checks, have their own numbered build section and README badges, and keep Combat Studio authoring material in their preview downloads. The README now uses concise bullets while retaining every existing link.",
    "build": "0.7.1.1033",
    "pullRequest": 1667,
    "url": "https://github.com/cehinds/AshenSpire/pull/1667"
  },
  {
    "id": "pr-1670",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Alternative combat faces the battlefield",
    "detail": "The alternative build uses rear-view hero armor, detailed facing enemies, thin gold and red outlines, and a layered Hollow Weald scene. The existing cards, HUD and footer stay playable above a fading textured base, with separate phone and desktop combat placement.",
    "build": "0.7.1.1033",
    "pullRequest": 1670,
    "url": "https://github.com/cehinds/AshenSpire/pull/1670"
  },
  {
    "id": "pr-1666",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Plans: modular class rewards and retraining",
    "detail": "The progression contract now defines class reward milestones, six ability ranks, one shared Actions and Stamina resource, independent content modules, class retraining, and the ordered XP reveal. This entry specifies the implementation contract; gameplay follows in separate changes.",
    "build": "0.7.1.1032",
    "pullRequest": 1666,
    "url": "https://github.com/cehinds/AshenSpire/pull/1666"
  },
  {
    "id": "pr-1664",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Smaller text fits more card descriptions",
    "detail": "Card titles, rules, tags and cost numbers are two points smaller, including the automatic fitting range. More descriptions fit fully inside the existing card frame on desktop and phone.",
    "build": "0.7.1.1031",
    "pullRequest": 1664,
    "url": "https://github.com/cehinds/AshenSpire/pull/1664"
  },
  {
    "id": "pr-1662",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Drive class mastery in full browser gates",
    "detail": "The cold-boot walkthrough and map-camera persistence drive choose required class mastery nodes before entering the map, including when the walkthrough starts a second run. Both use real input and preserve the combat, storage and camera assertions; mastery door priority is covered by probe selftests.",
    "build": "0.7.1.1029",
    "pullRequest": 1662,
    "url": "https://github.com/cehinds/AshenSpire/pull/1662"
  },
  {
    "id": "pr-1658",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Class mastery follows the profile into every new run",
    "detail": "New solo runs and co-op seats open at profile mastery with core card pools, global item gates and a fresh tree pick per open tier. Solo claims bank cumulative XP immediately and add their unlocks to live rewards. Co-op reads profile mastery without banking earned progress. Books retain their named lessons, class swaps open at their own mastery, and legacy saves keep prior progression. Terminal save failures retain an idempotent receipt and offer Retry. Four hundred seeded runs finish without crashes or soft locks; browser reward, creation, tree-reset and quota-retry receipts live in docs/qa/class-mastery. Quick start still reaches its first played card in six inputs.",
    "build": "0.7.1.1027",
    "pullRequest": 1658,
    "url": "https://github.com/cehinds/AshenSpire/pull/1658"
  },
  {
    "id": "pr-1659",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "The downloaded game opens again",
    "detail": "The bundled game could stop before the title screen while checking class mastery and report that it could not create a loadout. The shared token helper now loads without that dependency loop. Card artwork, costs and gameplay rules are unchanged.",
    "build": "0.7.1.1024",
    "pullRequest": 1659,
    "url": "https://github.com/cehinds/AshenSpire/pull/1659"
  },
  {
    "id": "pr-1656",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Every card gets its own painting",
    "detail": "All 220 card identities and 17 equipment profiles now have portrait artwork in the existing card frame. Upgrades share their base painting, with names, costs and rules kept readable over the same card layout. The taller artwork leaves room to choose a crop in the card assembler, which also offers eight alternate paintings.",
    "build": "0.7.1.1022",
    "pullRequest": 1656,
    "url": "https://github.com/cehinds/AshenSpire/pull/1656"
  },
  {
    "id": "pr-1655",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Plans: class progress kept safely",
    "detail": "Class mastery now has durable profile storage. Separate runs add their earned XP through receipts that make retries safe, and settings saves retain newer class progress. Returning profiles keep every authored unlock at level zero; live runs adopt mastery in the following update.",
    "build": "0.7.1.1020",
    "pullRequest": 1655,
    "url": "https://github.com/cehinds/AshenSpire/pull/1655"
  },
  {
    "id": "pr-1654",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "Plans: class levels that last",
    "detail": "The class mastery plan now has its card bundles, equipment, relics and twenty class feats authored, with checks that keep every starting kit intact and every school deep enough to offer a choice. This supplies the data for lasting class levels; runs still use their earlier progression until the profile and run screens adopt it.",
    "build": "0.7.1.1018",
    "pullRequest": 1654,
    "url": "https://github.com/cehinds/AshenSpire/pull/1654"
  },
  {
    "id": "pr-1653",
    "date": "2026-10-06",
    "group": "2026-10-06",
    "summary": "One bar to break",
    "detail": "In a new run, physical and magical hits both fill Poise. Ward remains a defence against magic, shown in a fighter's details. A magical Stagger makes an enemy take more magic damage, and your Arcane properties work from that Stagger. Dodge Roll guards the shared bar. Runs saved before this change keep their earlier bars and rules.",
    "build": "0.7.1.1010",
    "pullRequest": 1653,
    "url": "https://github.com/cehinds/AshenSpire/pull/1653"
  },
  {
    "id": "pr-1652",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Herald: a cup of Mana",
    "detail": "Ember Communion joins the Herald's common cards. Spend 1 Stamina to restore 1 Mana and heal 2 HP. It Exhausts for the fight until you upgrade it, then returns to the discard pile like an ordinary skill.",
    "build": "0.7.1.1006",
    "pullRequest": 1652,
    "url": "https://github.com/cehinds/AshenSpire/pull/1652"
  },
  {
    "id": "pr-1648",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Every hit you feel",
    "detail": "Every hit that costs HP now shakes the screen a little, more the harder it lands, where before only hits of 15 or more shook. A hit of 6 or more also freezes the attacker and its target for a split second at the moment of impact. The damage number and sound still come at once. Screen shake and Reduced motion in Settings turn these off, and Instant speed has no freeze.",
    "build": "0.7.1.1003",
    "pullRequest": 1648,
    "url": "https://github.com/cehinds/AshenSpire/pull/1648"
  },
  {
    "id": "pr-1645",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Behind the scenes: two automatic checks look for their faults in the right place again",
    "detail": "Nothing you play changes. The faster map and fight entry (#1641) moved code that two browser checks use to plant deliberate faults. One check plants a black box over the Stamina number, and the plant broke the whole action row instead of covering the number. The other plants an idle bob on the fighters' pictures instead of on their layer, and since #1641 that fault shows a different symptom. Both plants now go in where the code lives now, and each check fails again for the fault it is aimed at.",
    "build": "0.7.1.998",
    "pullRequest": 1645,
    "url": "https://github.com/cehinds/AshenSpire/pull/1645"
  },
  {
    "id": "pr-1646",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Plans: one break bar, harder-hitting hits, class levels that last",
    "detail": "The design rules now say that each fighter will have a single break bar, Poise: Ward will stay as a defence, and Arcane Exposure's payoff will come from a Stagger caused by magic. Every hit will shake the screen by how hard it lands, with a brief freeze on big hits. And your class level will carry over between runs: each level unlocks one new thing: new cards on every other level, and between them armour, shields or foci, a relic, a feat option or a weapon in turn, and a class starts with about three-fifths of its cards. Nothing in the game changes yet; these land in later builds.",
    "build": "0.7.1.997",
    "pullRequest": 1646,
    "url": "https://github.com/cehinds/AshenSpire/pull/1646"
  },
  {
    "id": "pr-1644",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Cards hit as you click",
    "detail": "At Normal speed, an attack's damage now appears about a third of a second after you click, down from about 1.3 seconds. The pause before your swing is gone, and long attack animations play faster so the blow lands sooner, every frame still shown. Enemy attacks land sooner too, so enemy turns are shorter. Slow and Fast speeds keep their own, longer and shorter, timings.",
    "build": "0.7.1.990",
    "pullRequest": 1644,
    "url": "https://github.com/cehinds/AshenSpire/pull/1644"
  },
  {
    "id": "pr-1640",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Character sheet: every level and what it brings",
    "detail": "In the Armoury's Character view, the new Character sheet button lists every character level from 1 to 20 and every level of each skill and your class, with the XP each costs and what it grants: attribute points, feat and class-tree choices, more HP, Mana and Stamina, a bigger deck minimum, card drafts and their top rank, rank-ups, uncommon and rare cards unlocking, class-tree tiers opening, skill feats, linked attributes and +1 card power. It opens on the level you're at.",
    "build": "0.7.1.986",
    "pullRequest": 1640,
    "url": "https://github.com/cehinds/AshenSpire/pull/1640"
  },
  {
    "id": "pr-1641",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Map picks and entering a fight respond faster",
    "detail": "After you tap a map node, the map glides to it smoothly instead of stuttering, and entering the fight takes about a quarter less time before it appears, most noticeably on phones. Nothing about the map or the fight changes.",
    "build": "0.7.1.984",
    "pullRequest": 1641,
    "url": "https://github.com/cehinds/AshenSpire/pull/1641"
  },
  {
    "id": "pr-1639",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "The turn banner no longer covers fighters",
    "detail": "The Player Turn / Enemy Turn banner now sits at the top of the battlefield, just under the top bar, on every screen. On phones it used to sit a quarter of the way down and could hide an enemy's intent. Any fighter standing under the banner is now drawn below it, with its intent.",
    "build": "0.7.1.982",
    "pullRequest": 1639,
    "url": "https://github.com/cehinds/AshenSpire/pull/1639"
  },
  {
    "id": "pr-1638",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Dodge Roll is a sure defence: Block, Poise and Ward",
    "detail": "The Dodge Roll no longer rolls. It always gives you 3 Block, 3 Poise and 3 Ward, each plus your DR. Poise and Ward soak up impact before your Poise or Ward bar fills, and they fade at the start of your next turn, like Block. Its Stamina cost still depends on your equipment weight. Evasive Guard still rolls to evade, and the \"Dodge succeeded / failed\" result button, its pop-up and its floating text are gone: a successful roll shows as its Block and the dodge animation.",
    "build": "0.7.1.980",
    "pullRequest": 1638,
    "url": "https://github.com/cehinds/AshenSpire/pull/1638"
  },
  {
    "id": "pr-1635",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Braced Shield: +3 Block on every Shield card",
    "detail": "At Shield level 2 you can take the Braced Shield feat. Every Shield card you own, Defend included, then gains +3 on its Block, and the card shows the new number. Each card gains it once per play; a card whose Block only works in a stance gains nothing, and an upgraded card that gains a Block gets the +3 there.",
    "build": "0.7.1.973",
    "pullRequest": 1635,
    "url": "https://github.com/cehinds/AshenSpire/pull/1635"
  },
  {
    "id": "pr-1632",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Skill bonuses add up, and a respec takes back its attribute points",
    "detail": "A card that belongs to several of your skills now gets the every-fifth-level bonus from each of them, not just the best one: a Shield Bash with Blade 5, Shield 10 and Dual Wield 5 gains +4. Retraining a skill at a master now also removes the attribute points that skill's every-fourth-level choices gave you; points from other skills stay.",
    "build": "0.7.1.969",
    "pullRequest": 1632,
    "url": "https://github.com/cehinds/AshenSpire/pull/1632"
  },
  {
    "id": "pr-1631",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "XP bars read top to bottom in the order they fill",
    "detail": "After a fight, your class bar now sits directly under your character level, with skills below it, so the bars fill and offer Level up from top to bottom.",
    "build": "0.7.1.966",
    "pullRequest": 1631,
    "url": "https://github.com/cehinds/AshenSpire/pull/1631"
  },
  {
    "id": "pr-1603",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Sharper art on phones; test builds carry the full art",
    "detail": "The phone-sized art is redrawn from the full art at up to 480 px for fighters, poses and effects (animation frames were 160 px) and up to 720 px for backdrops, maps and cards (art release hd-assets-v12); the light single file grows to about 75 MB, under the new 100 MB cap. Test builds now link the high-resolution art pack, as release and main do; dev stays light-only.",
    "build": "0.7.1.964",
    "pullRequest": 1603,
    "url": "https://github.com/cehinds/AshenSpire/pull/1603"
  },
  {
    "id": "pr-1629",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Blade feats and critical hits",
    "detail": "Every second level of a skill that has its own feats lets you take one. Blade's first feat is Critical Edge, from level 2. It gives your Blade attacks a chance to land a critical hit for 1.5× damage: 5%, plus Dexterity × 0.1%, Wisdom × 0.2% and Intelligence × 0.1%, up to 50%. Other skills' feats come later.",
    "build": "0.7.1.963",
    "pullRequest": 1629,
    "url": "https://github.com/cehinds/AshenSpire/pull/1629"
  },
  {
    "id": "pr-1625",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Every fourth skill level raises an attribute",
    "detail": "At levels 4 and 8 of Blade, Shield or Magic, you choose one linked attribute to raise by 1. Blade offers Strength or Dexterity. Shield offers Strength, Dexterity, Constitution or Wisdom. Magic offers Dexterity, Constitution, Wisdom or Intelligence. The choice sits beside that level's card draft and shows each attribute's value now and after.",
    "build": "0.7.1.959",
    "pullRequest": 1625,
    "url": "https://github.com/cehinds/AshenSpire/pull/1625"
  },
  {
    "id": "pr-1618",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Reference components follow the original boards",
    "detail": "The design kit now separates the five card styles and their ability paintings, adds the missing menu forms and icons, and supplies matching class portraits and inventory weapons. Source comparisons show the differences, and Iron Guard remains a labelled candidate. This prepares reusable artwork; the live game presentation is unchanged.",
    "build": "0.7.1.955",
    "pullRequest": 1618,
    "url": "https://github.com/cehinds/AshenSpire/pull/1618"
  },
  {
    "id": "pr-1622",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Skill card bonus: fairer and shown everywhere",
    "detail": "A card now gets the every-fifth-level bonus from its best skill only, so a card that counts for two of your skills no longer gets both. Card offers show the bonus a card will have once you take it. In co-op, each player's skill levels now reach their cards, and the cards show their rank and bonus.",
    "build": "0.7.1.954",
    "pullRequest": 1622,
    "url": "https://github.com/cehinds/AshenSpire/pull/1622"
  },
  {
    "id": "pr-1620",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Every fifth skill level strengthens that skill's cards",
    "detail": "At levels 5 and 10 of a weapon, focus or dual-wield skill, every card of that skill gains +1 to its main number, its damage, Block, healing or the status it applies. The bonus shows on the card and adds to its rank. A card of two skills gets both bonuses. The level-up window tells you when it happens.",
    "build": "0.7.1.950",
    "pullRequest": 1620,
    "url": "https://github.com/cehinds/AshenSpire/pull/1620"
  },
  {
    "id": "pr-1617",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Level 5 no longer upgrades every card",
    "detail": "Reaching level 5 in a skill used to upgrade every card of that skill at once. Card ranks replace that: each level lets you raise one card of your choice, and new cards from drafts, master lessons and books arrive plain. Cards you already upgraded stay upgraded. The old setting for this is retired, and a settings file that still has it loads with a warning.",
    "build": "0.7.1.948",
    "pullRequest": 1617,
    "url": "https://github.com/cehinds/AshenSpire/pull/1617"
  },
  {
    "id": "pr-1615",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Level-ups raise a card",
    "detail": "From level 2, every weapon, focus or dual-wield skill level also lets you raise one of your own cards of that skill by one rank, beside that level's card draft. Open the reward to see your cards at the rank each would reach, then pick one. A card's rank never passes the skill's level, so if no card can rise yet, the reward waits.",
    "build": "0.7.1.946",
    "pullRequest": 1615,
    "url": "https://github.com/cehinds/AshenSpire/pull/1615"
  },
  {
    "id": "pr-1613",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Cards come in ranks",
    "detail": "A card from a skill draft can now arrive at a higher rank, up to that skill's level, and higher ranks are likelier as the skill grows. Each rank above 1 adds 1 to what the card is for: its damage, then Block, healing or the status it applies. A rank never raises a card's HP cost, draw or energy, and a multi-hit card shares the gain across its hits. A ranked card shows a small blue R badge with its rank in the top right of its picture.",
    "build": "0.7.1.942",
    "pullRequest": 1613,
    "url": "https://github.com/cehinds/AshenSpire/pull/1613"
  },
  {
    "id": "pr-1612",
    "date": "2026-10-05",
    "group": "2026-10-05",
    "summary": "Levelling slows down, with a ceiling on every track",
    "detail": "Every track now takes about 100,000 XP to reach its top level. Your character starts at 200 XP a level and stops at level 20; skills start at 100 XP and stop at level 10; classes start at 400 XP and stop at level 20. XP earned past a ceiling is kept, but claims no more levels.",
    "build": "0.7.1.936",
    "pullRequest": 1612,
    "url": "https://github.com/cehinds/AshenSpire/pull/1612"
  },
  {
    "id": "pr-1606",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Phone fighters no longer stack",
    "detail": "Enemies sharing a row keep their spacing when they grow on a narrow screen, so one enemy's intent no longer covers another's. A side standing in more than one row, or whose art is too wide to grow, keeps its previous size; it is never made smaller.",
    "build": "0.7.1.932",
    "pullRequest": 1606,
    "url": "https://github.com/cehinds/AshenSpire/pull/1606"
  },
  {
    "id": "pr-1609",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Level up waits for you, over the bar that filled",
    "detail": "When a bar reaches a level after a fight, it stops and a blue Level up button covers it. Nothing levels up until you press it. Pressing it opens a popup with that level's rewards in blue; choose one, or come back to it later. Continue fills the rest of the XP, and the next bar takes its turn: character first, then class, then skills. The guided level-up setting is gone, because every level now works this way.",
    "build": "0.7.1.930",
    "pullRequest": 1609,
    "url": "https://github.com/cehinds/AshenSpire/pull/1609"
  },
  {
    "id": "pr-1607",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Clear enemy intents on short phones",
    "detail": "Enemy intent labels and Inspect controls stay distinct when enlarged fighters move inward to fit the battlefield. Their full control boxes keep six pixels of space in the same row, with room for wider intent text and Inspect, while fighter size and targeting stay intact.",
    "build": "0.7.1.928",
    "pullRequest": 1607,
    "url": "https://github.com/cehinds/AshenSpire/pull/1607"
  },
  {
    "id": "pr-1602",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Level-up rewards planned",
    "detail": "The game's rules now describe the next level-up design. Each level will wait for you to press Level up over its bar, then show its rewards. Skill levels will grant a ranked card and a card upgrade every level, a feat every second level, an attribute every fourth and a bonus to that skill's cards every fifth. Levelling will also slow down: characters start at 200 XP a level, skills at 100 and classes at 400. Nothing in play changes yet.",
    "build": "0.7.1.924",
    "pullRequest": 1602,
    "url": "https://github.com/cehinds/AshenSpire/pull/1602"
  },
  {
    "id": "pr-1605",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Smoother map and animated fighters on phones",
    "detail": "Choosing a destination on the map no longer slows the game while its panel is open. On touch screens, fighters animate again (attack poses, enemy attack art and the idle sway) instead of standing frozen, and animated sprites and weapon effects no longer blink between frames. Attacks lean from the feet instead of rocking the whole figure side to side.",
    "build": "0.7.1.923",
    "pullRequest": 1605,
    "url": "https://github.com/cehinds/AshenSpire/pull/1605"
  },
  {
    "id": "pr-1599",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "More reusable scenes and foreground props",
    "detail": "The player artwork collection adds five lore-grounded locations in separate desktop and mobile compositions, plus six transparent props including both Second Cairn sword states. Its 316 components include unchanged PNG masters, WebP exports, exact prompts and responsive layer recipes for game integration. Live game artwork bindings are unchanged.",
    "build": "0.7.1.921",
    "pullRequest": 1599,
    "url": "https://github.com/cehinds/AshenSpire/pull/1599"
  },
  {
    "id": "pr-1600",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Bigger fighters on phones, more card text",
    "detail": "On a narrow screen combatants now grow to half the battlefield's height wherever there is headroom above them, keeping their relative sizes and staying on their own side of the field. Card body text in the hand is 2pt smaller so more of each effect shows.",
    "build": "0.7.1.919",
    "pullRequest": 1600,
    "url": "https://github.com/cehinds/AshenSpire/pull/1600"
  },
  {
    "id": "pr-1592",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Reset all sits last under Interface",
    "detail": "The Reset all settings button moves to the end of Display → Interface, so Fullscreen and the accent colour stay the first two controls there. It still asks before resetting.",
    "build": "0.7.1.915",
    "pullRequest": 1592,
    "url": "https://github.com/cehinds/AshenSpire/pull/1592"
  },
  {
    "id": "pr-1594",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Keep settings ordering checks working after Reset all",
    "detail": "The fullscreen ordering regression fixture now follows the reset row's current source location. Its intentional bad ordering and detection assertions remain unchanged.",
    "build": "0.7.1.913",
    "pullRequest": 1594,
    "url": "https://github.com/cehinds/AshenSpire/pull/1594"
  },
  {
    "id": "pr-1590",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Victory stops flashing; level rewards wait for you",
    "detail": "The victory window no longer fades out and back in as XP fills and levels are claimed: it opens once, and only the bars move. Claiming a level, by hand or with guided level-up, no longer forces its reward choice open. A line under the bars records each level, and the reward that level unlocked appears in the list raised and blue, rising into place once, to open whenever you choose.",
    "build": "0.7.1.912",
    "pullRequest": 1590,
    "url": "https://github.com/cehinds/AshenSpire/pull/1590"
  },
  {
    "id": "pr-1588",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Reusable artwork for every player screen",
    "detail": "A portable art collection covers 24 player views in desktop and mobile layouts: new scene perspectives, enemy bodies and portraits, transparent props, and scalable boxes, menus and controls. PNG masters, WebP exports, an offline catalog and layer recipes are included for game integration. The live game presentation is unchanged.",
    "build": "0.7.1.909",
    "pullRequest": 1588,
    "url": "https://github.com/cehinds/AshenSpire/pull/1588"
  },
  {
    "id": "pr-1589",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Recover from brief Windows art-cache locks",
    "detail": "When an art cache needs replacing, briefly locked Windows files get a bounded retry before the game tooling reports a failure. A permanently refused rename still reports an error and leaves the existing files intact.",
    "build": "0.7.1.908",
    "pullRequest": 1589,
    "url": "https://github.com/cehinds/AshenSpire/pull/1589"
  },
  {
    "id": "pr-1587",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Choose defaults or keep local settings",
    "detail": "After an update, a device with changed preferences asks whether to keep its local settings or use the current defaults. Settings also has a visible Reset to defaults button, with confirmation and Undo. Saves and progress stay intact. If saving fails, previous settings remain in use and the choice shows a retry.",
    "build": "0.7.1.906",
    "pullRequest": 1587,
    "url": "https://github.com/cehinds/AshenSpire/pull/1587"
  },
  {
    "id": "pr-1585",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Reset every setting from one button",
    "detail": "Settings → Display → Interface has a Reset all button. It asks first, then returns every setting to its default, with Undo for a few seconds. Reset all in the options menu now asks first too. Saves and progress are untouched.",
    "build": "0.7.1.904",
    "pullRequest": 1585,
    "url": "https://github.com/cehinds/AshenSpire/pull/1585"
  },
  {
    "id": "pr-1582",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Painted signature starter cards for three more classes",
    "detail": "Starstone Pebble, Urgent Heal, and Ambush now carry original paintings of the Observatory's starstone, the Furnace Chapel healing rite, and the frozen docks. The approved second Starstone pass and compact mobile artwork ship together in art release v11.",
    "build": "0.7.1.900",
    "pullRequest": 1582,
    "url": "https://github.com/cehinds/AshenSpire/pull/1582"
  },
  {
    "id": "pr-1581",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Keep armament checks accurate after merging",
    "detail": "The checks retain the new armament text after promotion and exercise explicit equipment actions, read-only card holds, inline comparisons and fitted inspection cards. The compact armament and level-reward behavior is unchanged.",
    "build": "0.7.1.898",
    "pullRequest": 1581,
    "url": "https://github.com/cehinds/AshenSpire/pull/1581"
  },
  {
    "id": "pr-1578",
    "date": "2026-10-04",
    "group": "2026-10-04",
    "summary": "Compact armaments and level rewards you can finish later",
    "detail": "Equipped positions show the item card beside its slot, name and status, with Inspect, Replace and Unequip actions. Inspect opens the full card, and equipping a reserve keeps the active position unchanged. Victory XP can pause at each level for its reward chooser, with a larger Level up button, Back and an Accessibility toggle. Leave whenever you want: unfinished levels and the original reward choices return on later victories and Character, including after saving. Class rewards wait for their original class.",
    "build": "0.7.1.897",
    "pullRequest": 1578,
    "url": "https://github.com/cehinds/AshenSpire/pull/1578"
  },
  {
    "id": "pr-1575",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "See four merchant offers at once",
    "detail": "Compact artwork, details and Buy controls fit above a fixed bottom category dock. Inspect opens the complete item or book, and the selected footer action follows mouse and keyboard selection. Warm brown panels and gold highlights match the approved shop preview.",
    "build": "0.7.1.895",
    "pullRequest": 1575,
    "url": "https://github.com/cehinds/AshenSpire/pull/1575"
  },
  {
    "id": "pr-1540",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Installer game versions and Stamina browser checks",
    "detail": "The installer adds separate game branch and exact build-version selectors linking to completed installer downloads, alongside the art selectors and AI disclosure. Browser checks follow the shared Stamina renderer, verify the Stamina number and Mana diamonds, and measure the co-op HUD with Mana ring both on and off. The SVG paint checks retain their backgrounds while measuring the visible number and label; two new known-bad cases cover hidden text and a later SVG cover. The checks retain their overlap, clipping, accessibility and known-bad coverage. Later integration retains the current shared-orb, resource-identity and built-tree probes. The illustrated desktop End Turn plate keeps its 48-pixel primary target after zoom.",
    "build": "0.7.1.893",
    "pullRequest": 1540,
    "url": "https://github.com/cehinds/AshenSpire/pull/1540"
  },
  {
    "id": "pr-1573",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "A clearer resource orb and more skyline",
    "detail": "The stamina number sits centered above its SP label with clear separation, and the battlefield ground recedes to show more of the skyline while keeping combatants grounded.",
    "build": "0.7.1.892",
    "pullRequest": 1573,
    "url": "https://github.com/cehinds/AshenSpire/pull/1573"
  },
  {
    "id": "pr-1570",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Grounded combat with a compact footer",
    "detail": "Combatants stand on the painted floor, and the smaller bottom controls leave the illustrated hand lower on screen. The artwork stays proportional and adjacent atlas scenes cannot bleed into the backdrop.",
    "build": "0.7.1.890",
    "pullRequest": 1570,
    "url": "https://github.com/cehinds/AshenSpire/pull/1570"
  },
  {
    "id": "pr-1569",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Learn cards from books instead of buying loose cards",
    "detail": "The merchant no longer offers Cards or Weapon Arts for direct purchase. Books, equipment, relics, supplies and services remain, including on saved visits.",
    "build": "0.7.1.889",
    "pullRequest": 1569,
    "url": "https://github.com/cehinds/AshenSpire/pull/1569"
  },
  {
    "id": "pr-1567",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Illustrated combat keeps its breathing room",
    "detail": "The transparent HP/relic HUD keeps combatants clear, card corners stay above the current footer, and potion minis and painted controls remain within their bounds. Embedded menu icons and build-failure diagnostics now work in every build mode.",
    "build": "0.7.1.886",
    "pullRequest": 1567,
    "url": "https://github.com/cehinds/AshenSpire/pull/1567"
  },
  {
    "id": "pr-1565",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Illustrated cards and scenery join the main game",
    "detail": "Cards use editable layered artwork, live centered text and stamina/mana banners, with individual card objects included in builds. Painted scenery and an enlarged transparent HP/relic HUD retain the current footer, Shield/Ward rules, merchant rows and turn confirmation controls.",
    "build": "0.7.1.883",
    "pullRequest": 1565,
    "url": "https://github.com/cehinds/AshenSpire/pull/1565"
  },
  {
    "id": "pr-1563",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Browse every merchant shelf in clear, matching rows",
    "detail": "Cards, equipment, relics, supplies, services and goods for sale now place their artwork, complete details and action together, following the book shelf layout. On phones, actions sit below the details. Card inspection, purchase reviews, holds and the selected footer action remain available.",
    "build": "0.7.1.876",
    "pullRequest": 1563,
    "url": "https://github.com/cehinds/AshenSpire/pull/1563"
  },
  {
    "id": "pr-1558",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Remove the combat Positioning button",
    "detail": "The Positioning toggle and its floating panel no longer appear over the battlefield, and the formation workbench that only that panel opened is gone. Formation positioning remains in Settings.",
    "build": "0.7.1.874",
    "pullRequest": 1558,
    "url": "https://github.com/cehinds/AshenSpire/pull/1558"
  },
  {
    "id": "pr-1534",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Painted, editable combat footer",
    "detail": "The stamina orb, draw cradle, End Turn plate, discarded cards and potion tray now assemble from separate painted components. Footer Atelier can move, resize and snap them together, and edit live text bindings, fonts and positions independently of the images. Solo and co-op keep their existing actions, with readable compact controls on phones and short landscape screens. The five new light images total about 9 KB.",
    "build": "0.7.1.872",
    "pullRequest": 1534,
    "url": "https://github.com/cehinds/AshenSpire/pull/1534"
  },
  {
    "id": "pr-1557",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Exercise the small-player foot target on every platform",
    "detail": "Separate the browser fixture's player stack from the grid-cell center and keep its sprite inside the measured small bounds, so text and artwork cannot bypass the minimum touch-target check. Gameplay is unchanged.",
    "build": "0.7.1.871",
    "pullRequest": 1557,
    "url": "https://github.com/cehinds/AshenSpire/pull/1557"
  },
  {
    "id": "pr-1555",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Keep small-player touch checks reliable without artwork",
    "detail": "Browser checks exercise a deliberately small player in their controlled overlap scene, preserving the foot anchor and verifying that removing its touch target is caught even in copied trees without artwork. Gameplay is unchanged.",
    "build": "0.7.1.870",
    "pullRequest": 1555,
    "url": "https://github.com/cehinds/AshenSpire/pull/1555"
  },
  {
    "id": "pr-1552",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Keep positioning controls clear of combatants",
    "detail": "Place the Positioning toggle on the player side in portrait and between the teams on short landscape screens. Keep the browser overlap check reliable across authored formation sizes, and make Quick Start's browser check target fighters without pressing their intent buttons.",
    "build": "0.7.1.869",
    "pullRequest": 1552,
    "url": "https://github.com/cehinds/AshenSpire/pull/1552"
  },
  {
    "id": "pr-1550",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Small combatants stay reachable",
    "detail": "The player keeps a 44 px touch target when scaled down. Motion and save checks choose an unobstructed target point outside nested intent controls, preserving normal card play and their existing assertions.",
    "build": "0.7.1.862",
    "pullRequest": 1550,
    "url": "https://github.com/cehinds/AshenSpire/pull/1550"
  },
  {
    "id": "pr-1548",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Combat browser checks keep pace with the game",
    "detail": "Checks recognize the shared Stamina artwork and catch invisible or covered SVG text. A controlled sprite-overlap case keeps intent buttons reachable, and the full-run driver plays affordable attacks and defensive cards through the normal controls. Gameplay is unchanged.",
    "build": "0.7.1.860",
    "pullRequest": 1548,
    "url": "https://github.com/cehinds/AshenSpire/pull/1548"
  },
  {
    "id": "pr-1543",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Place and size your combat formations with a live workbench",
    "detail": "Move whole rows, columns, teams or custom groups, snap to a 50 px grid, resize characters, test mixed classes and enemies in 1×1, 2×2 or 2×3 layouts, and export the positioning as JSON. The supplied 1×1 and 2×2 layouts retain their own offsets. Spawns fill from opposite bottom corners. Combat now rolls a card at 10% and a separate feat at 5%; skill levels guarantee a card draft, while class levels keep their tree upgrade and add a guaranteed feat plus an independent 25% technique-card chance.",
    "build": "0.7.1.859",
    "pullRequest": 1543,
    "url": "https://github.com/cehinds/AshenSpire/pull/1543"
  },
  {
    "id": "pr-1544",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Specify formation positioning and reward defaults",
    "detail": "Record the approved mirrored spawn order, authored layout profiles and separate combat, skill and class reward rolls before implementation.",
    "build": "0.7.1.857",
    "pullRequest": 1544,
    "url": "https://github.com/cehinds/AshenSpire/pull/1544"
  },
  {
    "id": "pr-1541",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Shield and Arcane Ward sit beside your health",
    "detail": "Ordinary Block has a blue shield and turns health blue until it breaks. Magical Block has a purple Arcane Ward badge to its left and adds a gold health outline. Both can appear together; when either disappears, health takes back its space. The two numbers share the existing Block total. Solo and co-op keep the same behavior, including saved fights. Narrow bars show current HP with the full value available in the tooltip.",
    "build": "0.7.1.853",
    "pullRequest": 1541,
    "url": "https://github.com/cehinds/AshenSpire/pull/1541"
  },
  {
    "id": "pr-1535",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Build your deck at the Reading Desk",
    "detail": "The illustrated deck editor has compact rows, two-line descriptions, inline Inspect, and proportionate card art. Sapphire Mana and green Stamina symbols show centered costs, with configurable resource grouping and order. Desktop inspection includes a looping skill animation with Pause. Any deck card can return to the library; adding equipment skills requires compatible equipped gear, and removed equipment cards stay removed after saving. A separate visual row editor lets you move, resize and snap components, then export the layout as JSON.",
    "build": "0.7.1.852",
    "pullRequest": 1535,
    "url": "https://github.com/cehinds/AshenSpire/pull/1535"
  },
  {
    "id": "pr-1536",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Keep prepared spells and draw a fresh hand each turn",
    "detail": "Opening and turn draws start at four with Intelligence scaling. Unplayed cards shuffle back into the draw pile unless they have Retain; thirty-one Herald and Starseer spells now keep that keyword when upgraded. Retained cards add to the next full draw, up to a separate default hand limit of fifteen. Solo and co-op share the rule, played cards still leave the hand normally, and existing saved fights preserve their rules. The defaults remain configurable.",
    "build": "0.7.1.851",
    "pullRequest": 1536,
    "url": "https://github.com/cehinds/AshenSpire/pull/1536"
  },
  {
    "id": "pr-1542",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Keepsake pictures return after an art retry",
    "detail": "If a keepsake picture fails to load, its icon stands in; retrying the art or changing quality can restore the picture. The compact-art checks now run correctly in CI.",
    "build": "0.7.1.845",
    "pullRequest": 1542,
    "url": "https://github.com/cehinds/AshenSpire/pull/1542"
  },
  {
    "id": "pr-1538",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "More of the climb has its finished artwork",
    "detail": "The game includes compact card, relic, flask, event, and character art, including the Road Warden. Cards without a painted scene use a simple matching motif. High-resolution pictures remain in the art repository; the game uses its smaller local versions by default.",
    "build": "0.7.1.845",
    "pullRequest": 1538,
    "url": "https://github.com/cehinds/AshenSpire/pull/1538"
  },
  {
    "id": "pr-1533",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "The Windows installer lets you browse and download art versions",
    "detail": "A high-quality artwork button opens art-repository branch and published-version choices, shows installed, required and latest art versions, and lets you install the game's matching pack or save another verified release separately. The installer discloses ChatGPT-generated artwork. README links and action buttons each have their own row, while its opening description stays a plain sentence.",
    "build": "0.7.1.843",
    "pullRequest": 1533,
    "url": "https://github.com/cehinds/AshenSpire/pull/1533"
  },
  {
    "id": "pr-1530",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "One turn budget, with an emerald stamina orb",
    "detail": "Every class starts with 3 base SP, growing with Dexterity, Constitution, Wisdom, Intelligence and level. Cards and combat actions spend Stamina once, and it refills each turn. The approved emerald orb and weathered harness replace the action counter in solo and co-op, with independently positioned number and SP label. Sapphire diamonds show available mana around the rim; turn Mana ring off in Combat settings to use the top MP bar. Cards use green stamina diamonds. The component artwork is published in the separate art repository and the layout editor remains available.",
    "build": "0.7.1.842",
    "pullRequest": 1530,
    "url": "https://github.com/cehinds/AshenSpire/pull/1530"
  },
  {
    "id": "pr-1532",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Full draws and selective Retain are the approved hand rules",
    "detail": "The contract starts opening and turn draws at four with Intelligence scaling, keeps Retain cards, shuffles other unplayed cards into the draw pile, and sets a separate default hand limit of fifteen. Retained cards add to the next draw until that limit. This documents the next implementation; gameplay is unchanged in this build.",
    "build": "0.7.1.839",
    "pullRequest": 1532,
    "url": "https://github.com/cehinds/AshenSpire/pull/1532"
  },
  {
    "id": "pr-1529",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "The README explains the current game and where to get each edition",
    "detail": "The guide now covers retained hands, Actions, Stamina and Mana, combat ratings, equipment cards, the sideboard, progression, books and shop services. It links the installer, art repository, Unity adaptation and each browser channel's play and download paths, with verified GitHub build alternatives while hosted paths are unavailable. Gameplay is unchanged.",
    "build": "0.7.1.838",
    "pullRequest": 1529,
    "url": "https://github.com/cehinds/AshenSpire/pull/1529"
  },
  {
    "id": "pr-1527",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Painted books and class-book bonuses",
    "detail": "Books have separate painted covers and emblems, including a feat emblem, with color across the whole leather binding. Class books grant XP on every read, learn the class on the first read, and independently roll a matching combat card (25%) and feat (5%). Both chances are configurable in Advanced → Shops. The result shows what you received; excess card copies go to the sideboard.",
    "build": "0.7.1.837",
    "pullRequest": 1527,
    "url": "https://github.com/cehinds/AshenSpire/pull/1527"
  },
  {
    "id": "pr-1526",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Class-book reward rules are documented",
    "detail": "The approved contract keeps class learning and XP, makes class books repeatable, and specifies independent configurable combat-card and feat chances of 25% and 5%. This documents the next implementation; gameplay is unchanged in this build.",
    "build": "0.7.1.835",
    "pullRequest": 1526,
    "url": "https://github.com/cehinds/AshenSpire/pull/1526"
  },
  {
    "id": "pr-1517",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Your phone can buzz on card play, damage taken and turn start",
    "detail": "On a device that can vibrate, playing a card, losing HP (from a hit, or from a card, curse or status that costs HP) and the start of your turn each give a short buzz of its own; in co-op, your own plays, wounds and turns buzz your device, not a teammate's. Changing equipment does not buzz. A new switch, Settings → Audio → Haptics, is on by default and turns them all off. Desktop browsers and iPhones, which cannot vibrate a web page, stay as they were.",
    "build": "0.7.1.834",
    "pullRequest": 1517,
    "url": "https://github.com/cehinds/AshenSpire/pull/1517"
  },
  {
    "id": "pr-1520",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Behind the scenes: a whole run is now played in a real browser",
    "detail": "Nothing you play changes. A new automatic check starts the game from the title, creates a character on a fixed seed, plays a fight, walks the map to the act boss, dies to it, returns to the title and starts a new run, and fails if anything goes wrong on the way or an error is logged.",
    "build": "0.7.1.830",
    "pullRequest": 1520,
    "url": "https://github.com/cehinds/AshenSpire/pull/1520"
  },
  {
    "id": "pr-1524",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Behind the scenes: every full browser check now has to download the art first",
    "detail": "Nothing you play changes. After the art moved out of this repository, three heavy browser checks ran without downloading it and failed on pictures that never loaded. A test now fails if any check in the full run starts a tool before the art is downloaded, including a tool started from a multi-line step.",
    "build": "0.7.1.829",
    "pullRequest": 1524,
    "url": "https://github.com/cehinds/AshenSpire/pull/1524"
  },
  {
    "id": "pr-1519",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Behind the scenes: the build-number check no longer passes when the previous build's record is missing or unreadable",
    "detail": "Nothing you play changes. The automatic check that each new build's number is higher than the last one treated a previous build record it could not open (a damaged copy of the history), or one too garbled to read, as if there had been no record at all, and passed. It now stops and says it could not tell. A shallow copy that holds no previous build at all still passes, as before.",
    "build": "0.7.1.828",
    "pullRequest": 1519,
    "url": "https://github.com/cehinds/AshenSpire/pull/1519"
  },
  {
    "id": "pr-1518",
    "date": "2026-10-03",
    "group": "2026-10-03",
    "summary": "Quick start: from the title to your first card in six presses",
    "detail": "The title has a new Quick start. It begins a climb at once with the recommended character (the Reaver, no keepsake, Standard stats, the class's own starting gear), a fresh seed and the first empty save slot, and skips the opening. The opening still plays on your next ordinary climb. If every slot is full it asks before replacing slot 1, as Begin does. A new player now reaches their first card play in 6 inputs, down from 24 through New and character creation. New still lets you choose everything.",
    "build": "0.7.1.826",
    "pullRequest": 1518,
    "url": "https://github.com/cehinds/AshenSpire/pull/1518"
  },
  {
    "id": "pr-1523",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: browser checks follow the art and wording updates",
    "detail": "The hand-placement, animation and flask-menu checks use the verified art packs. The Fullscreen test follows the shared wording table, and flask checks report their result in the format CI reads.",
    "build": "0.7.1.825",
    "pullRequest": 1523,
    "url": "https://github.com/cehinds/AshenSpire/pull/1523"
  },
  {
    "id": "pr-1521",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Read a book, learn a card, keep your class progress",
    "detail": "Manuals grant their XP and an immediate matching card choice, including cross-class skills. Spellbooks teach spells, Universal Tomes let you choose a track and lesson, and class books unlock reusable class cards that can be equipped or removed to leave an empty slot. The shop's book rows have matching sizes and separate book, details and Buy columns. Ten customizable book recipes combine three painted cover styles, thirty independent symbol variants, colors and trim; Book Atelier exports artwork recipes for future updates. Art comes from the verified hd-assets-v4 pack, including its existing uniform light-sprite policy.",
    "build": "0.7.1.824",
    "pullRequest": 1521,
    "url": "https://github.com/cehinds/AshenSpire/pull/1521"
  },
  {
    "id": "pr-1516",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the art now lives only in its own repository",
    "detail": "Nothing you play changes. The pictures, fonts, music and map tiles were stored twice, here and in the art repository; the copies here are gone, so a fresh download of the source is about 1.9 GB lighter. Every build now takes its art from the pinned art release, checked file by file, exactly as it already did.",
    "build": "0.7.1.822",
    "pullRequest": 1516,
    "url": "https://github.com/cehinds/AshenSpire/pull/1516"
  },
  {
    "id": "pr-1489",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the game's wording lives in one table again",
    "detail": "Nothing you see changes. About 230 labels and sentences that had crept back into the code since mid-September (most of the Settings rows, the combat action bar, level-up and Victory, the lore fonts, layout and HUD options) now come from the game's one wording table, and an automatic check stops new ones creeping in.",
    "build": "0.7.1.821",
    "pullRequest": 1489,
    "url": "https://github.com/cehinds/AshenSpire/pull/1489"
  },
  {
    "id": "pr-1499",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the map legend's Escape test now opens the node panel first",
    "detail": "Nothing you play changes. The automatic test for closing the map legend with Escape or pad B never selected a map node, so the node's panel was never open and the test could not see it close by mistake. It now selects a node, checks the panel stays open when the legend closes, and checks the next press closes the panel.",
    "build": "0.7.1.819",
    "pullRequest": 1499,
    "url": "https://github.com/cehinds/AshenSpire/pull/1499"
  },
  {
    "id": "pr-1475",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Fighters breathe while they wait",
    "detail": "Your fighter and every enemy now bob gently in place between actions, each at its own rhythm; before, the idle motion was meant to play but reached no one. This covers the Animated, Rendered and Classic figure styles; the Glyph style shows a sigil, not a figure, and stays still, and a fallen fighter, including a downed co-op ally, stops moving. With Reduced motion on, in the game's settings or your device's, they stand still, and a new check plays a whole turn that way to prove nothing on the board moves.",
    "build": "0.7.1.818",
    "pullRequest": 1475,
    "url": "https://github.com/cehinds/AshenSpire/pull/1475"
  },
  {
    "id": "pr-1474",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Turning on \"Use flasks outside combat\" now works straight away on the map",
    "detail": "Turning the setting on from the map's menu used to leave the Potions control refusing Drink until you left the map. Now the map updates as soon as you change it, and a drink taken there is saved. Behind the scenes, new browser checks open every flask menu (in combat, on the map and in the room rail) and confirm each one offers the same actions and does exactly what you pick.",
    "build": "0.7.1.816",
    "pullRequest": 1474,
    "url": "https://github.com/cehinds/AshenSpire/pull/1474"
  },
  {
    "id": "pr-1487",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the balance report's checks are stricter",
    "detail": "Nothing you play changes. The run simulator now refuses to print per-act difficulty for an endless climb, where later loops would have been counted as the first three acts, and the balance notes' check now catches a boss listed for a region that cannot meet it, or the same row recorded twice.",
    "build": "0.7.1.814",
    "pullRequest": 1487,
    "url": "https://github.com/cehinds/AshenSpire/pull/1487"
  },
  {
    "id": "pr-1490",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "The tutorial bubble moves off your cards when the hand rearranges itself",
    "detail": "After a window resize, your hand can spread itself out again a moment after the tutorial has found a spot for its speech bubble. If that put a card under the bubble, the bubble stayed there and you couldn't click that card. The bubble now moves whenever your cards move, not only when the thing it points at moves.",
    "build": "0.7.1.813",
    "pullRequest": 1490,
    "url": "https://github.com/cehinds/AshenSpire/pull/1490"
  },
  {
    "id": "pr-1493",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: every owner decision has its own number",
    "detail": "Nothing you play changes. Two decisions in the project's finish list were both numbered D38, so a note citing D38 could mean either; the hit sound tiers decision is now D48, and a test fails if two decisions ever share a number again.",
    "build": "0.7.1.812",
    "pullRequest": 1493,
    "url": "https://github.com/cehinds/AshenSpire/pull/1493"
  },
  {
    "id": "pr-1508",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the slowest automated checks no longer wait on a 20-minute download",
    "detail": "Nothing you play changes. Three checks ran out of time before they started, while still downloading the project; the heavy checks now skip the source paintings and old file history they never open, cutting each one's download from about 2.3 GB to about 0.7 GB. Every check still runs; whether all of them now finish inside 20 minutes is confirmed only by the next full run.",
    "build": "0.7.1.811",
    "pullRequest": 1508,
    "url": "https://github.com/cehinds/AshenSpire/pull/1508"
  },
  {
    "id": "pr-1511",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Cards keep just their Information button for full text",
    "detail": "Clipped descriptions no longer add a separate arrow box above a combat card or push its title aside. Select the card and use its existing (i) button to read the complete details.",
    "build": "0.7.1.810",
    "pullRequest": 1511,
    "url": "https://github.com/cehinds/AshenSpire/pull/1511"
  },
  {
    "id": "pr-1501",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "A Windows installer, with the high-resolution art as a choice on the install screen",
    "detail": "Nothing in the game itself changes. AshenSpire-Setup.exe installs the game for you (no administrator prompt) with Start menu and desktop shortcuts; tick High-resolution art and it downloads the full-resolution art during the install and checks every file, or leave it unticked to play with the standard art and add it later by running the installer again. Uninstalling asks before it deletes your saves.",
    "build": "0.7.1.808",
    "pullRequest": 1501,
    "url": "https://github.com/cehinds/AshenSpire/pull/1501"
  },
  {
    "id": "pr-1512",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "A master's lesson track with nothing to teach no longer offers Ask",
    "detail": "When a track had no cards it could teach you (a Herald's shield track, for example), the Ask button still worked and spent the visit's lesson on an empty result. It is now greyed out. Under Chaos Rewards, which can give that track cards, it stays available.",
    "build": "0.7.1.807",
    "pullRequest": 1512,
    "url": "https://github.com/cehinds/AshenSpire/pull/1512"
  },
  {
    "id": "pr-1506",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "One game file and one download: the separate mobile and full-art files are retired",
    "detail": "Every build is now one game page of about 10 MB that loads its art, fonts, music and map tiles from files beside it and picks phone-sized art on a phone by itself, plus one self-contained light-art file (about 31 MB) to download and play by double-click. The old mobile link sends you to the main game.",
    "build": "0.7.1.806",
    "pullRequest": 1506,
    "url": "https://github.com/cehinds/AshenSpire/pull/1506"
  },
  {
    "id": "pr-1497",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "The Smith counts every card an upgrade improves",
    "detail": "Upgrading a weapon or shield at the Smith already improved the Strike and Guard it lends you, but the preview and the receipt left those two cards out, so it said fewer cards improved than really did and showed a lent Guard as unused. Both now list every card the upgrade changes. Behind the scenes, four checking tools that had fallen behind the game's rules pass again.",
    "build": "0.7.1.805",
    "pullRequest": 1497,
    "url": "https://github.com/cehinds/AshenSpire/pull/1497"
  },
  {
    "id": "pr-1500",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: builds and checks read the game's light art, fonts, music and map tiles from the art release",
    "detail": "Nothing you play changes. Every build, test and preview page now takes the light art, the lore fonts, the shipped score and the map detail tiles from the verified art release instead of the copies still kept in this repository, so those copies can be removed in a later step.",
    "build": "0.7.1.804",
    "pullRequest": 1500,
    "url": "https://github.com/cehinds/AshenSpire/pull/1500"
  },
  {
    "id": "pr-1505",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the startup-gate checks run again",
    "detail": "Nothing you play changes. The checks that plant known bugs in a scratch copy of the game did not copy the two files that name the pinned art release. So the copy could not stamp a build, and the checks failed before testing anything.",
    "build": "0.7.1.803",
    "pullRequest": 1505,
    "url": "https://github.com/cehinds/AshenSpire/pull/1505"
  },
  {
    "id": "pr-1509",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the co-op layout check runs when a build goes to testing",
    "detail": "Nothing you play changes. The automatic check that the co-op screen's top bar fits on phones and desktops now runs each time a build is promoted to testing, instead of on every proposed change, where it kept stalling and holding other changes up.",
    "build": "0.7.1.802",
    "pullRequest": 1509,
    "url": "https://github.com/cehinds/AshenSpire/pull/1509"
  },
  {
    "id": "pr-1492",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the class balance checker plays the same climbs as the run simulator",
    "detail": "Nothing you play changes. The tool that counts each class's wins used its own older copy of what happens between fights (levels, drafts, rewards, events). Over 500 climbs it reached different fights and got a different result. It now uses the simulator's own steps between fights, agrees with it fight for fight, and its own self-check runs to the end again instead of crashing.",
    "build": "0.7.1.801",
    "pullRequest": 1492,
    "url": "https://github.com/cehinds/AshenSpire/pull/1492"
  },
  {
    "id": "pr-1495",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Sealed and Draft climbs can no longer extract cards at the smith",
    "detail": "A Sealed or Draft deck is never given the cards your equipment lends, but extracting one at the Blacksmith, the Shrine or a merchant's smith used to hand you a free copy anyway. In those climbs Extract now shows as unavailable, saying why, and cannot be done; reloading the climb does not bring it back. Seating a card you already own in an item works as before, and Standard climbs are unchanged.",
    "build": "0.7.1.799",
    "pullRequest": 1495,
    "url": "https://github.com/cehinds/AshenSpire/pull/1495"
  },
  {
    "id": "pr-1498",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "The game's starting settings follow the owner's latest configuration",
    "detail": "Character-level XP growth starts at 1.5, reward card choices at zero and the normal-fight card reward chance at 24%. Enemy sprites start at 1.5 scale, the player starts in column 1, row B uses double scale, and the opening's first-step traveller uses the supplied desktop placement. All 38 supplied settings become defaults; settings you already chose keep their values.",
    "build": "0.7.1.798",
    "pullRequest": 1498,
    "url": "https://github.com/cehinds/AshenSpire/pull/1498"
  },
  {
    "id": "pr-1440",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the spec wording for loading assets as separate files is approved",
    "detail": "This is a docs-only change, and nothing you play changes. The spec now says the game will load its art, fonts and music as separate files, keep one light-art single file you can download and open by double-click, and retire the 254 MB file.",
    "build": "0.7.1.796",
    "pullRequest": 1440,
    "url": "https://github.com/cehinds/AshenSpire/pull/1440"
  },
  {
    "id": "pr-1496",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: reusable desktop and mobile polish artwork is saved with the project",
    "detail": "The illustrated design direction now has individual paintings, portraits, icons, frames and controls, with recipes for 24 player feature views and copies of the existing game art and fonts they need. Credits, provenance and portable preview helpers are included for the next visual polish pass. These are design assets; the playable screens and game rules stay as they are.",
    "build": "0.7.1.795",
    "pullRequest": 1496,
    "url": "https://github.com/cehinds/AshenSpire/pull/1496"
  },
  {
    "id": "pr-1450",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: every change now checks the game's art against the art repository's release",
    "detail": "Nothing you play changes. The game pins one release of its art, light art, fonts, music and map tiles in a separate repository; each check downloads the parts it needs, verifies every file against its fingerprint, and proves the release and the copies still kept here are identical, byte for byte.",
    "build": "0.7.1.794",
    "pullRequest": 1450,
    "url": "https://github.com/cehinds/AshenSpire/pull/1450"
  },
  {
    "id": "pr-1488",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Escape and pad B close the map legend before the map",
    "detail": "With a map node selected and the legend open, one press used to close the node's panel and leave the legend up; it now closes the legend only, and the next press closes the panel. In character creation's Equipment step, Escape went back nowhere while a card's info button was showing, and pad B hid the button instead; both now go back one step, as the Back button does.",
    "build": "0.7.1.793",
    "pullRequest": 1488,
    "url": "https://github.com/cehinds/AshenSpire/pull/1488"
  },
  {
    "id": "pr-1491",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the architecture check passes again",
    "detail": "Nothing you play changes. The offline folder download named a browser feature inside the game's core rules code, which the automatic architecture check forbids, so the check had failed on every change since. That name now lives with the game's other content settings.",
    "build": "0.7.1.792",
    "pullRequest": 1491,
    "url": "https://github.com/cehinds/AshenSpire/pull/1491"
  },
  {
    "id": "pr-1471",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "The web edition shows its art loading on the start screen, and can retry",
    "detail": "Behind the scenes, in the web edition only: the start screen now appears at once while the art loads, with one line saying how far it has got, and if the art cannot be loaded the title screen says so and offers Retry (also in Settings → Art quality), which loads it again without reloading the page; the downloaded single file is unchanged, and nothing you play changes.",
    "build": "0.7.1.791",
    "pullRequest": 1471,
    "url": "https://github.com/cehinds/AshenSpire/pull/1471"
  },
  {
    "id": "pr-1485",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Fight sounds land at the right moment",
    "detail": "A boss fight's first draw and turn sting now play when its name card lifts, not hidden behind it. In LAN co-op your turn stings once per round however many players are in the fight, and joining or reloading a fight after someone has already acted no longer replays that action's sounds.",
    "build": "0.7.1.790",
    "pullRequest": 1485,
    "url": "https://github.com/cehinds/AshenSpire/pull/1485"
  },
  {
    "id": "pr-1486",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the Sealed and Draft reload test checks what this build saves",
    "detail": "Nothing you play changes. The test that loads a save from an older build kept treating every later save as that older build's, so it never checked that a climb saved again after the fix is saved the new way. It now does.",
    "build": "0.7.1.789",
    "pullRequest": 1486,
    "url": "https://github.com/cehinds/AshenSpire/pull/1486"
  },
  {
    "id": "pr-1468",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "The first-fight tutorial no longer sits on your cards",
    "detail": "The coach marks' speech bubble used to land on the first card in your hand, so you couldn't play that card while the tutorial was showing. The bubble now finds a spot clear of your hand. After a window resize, the spotlight now follows its target until the board stops moving, even on a busy machine that draws the board in fits and starts. Pressing Escape on an armed attack card now also drops the card's highlight, not just its targeting. Behind the scenes, the check that every tutorial button can be reached runs at eight screen sizes on every change, and it confirms that the tutorial stays dismissed after a reload.",
    "build": "0.7.1.788",
    "pullRequest": 1468,
    "url": "https://github.com/cehinds/AshenSpire/pull/1468"
  },
  {
    "id": "pr-1473",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the balance report now measures Mana and each act's difficulty",
    "detail": "Nothing you play changes. The run simulator can now compare whole climbs with and without Mana limits, and report how often each act's boss falls in each region. Both results are written into the balance notes for the owner to tune from later.",
    "build": "0.7.1.787",
    "pullRequest": 1473,
    "url": "https://github.com/cehinds/AshenSpire/pull/1473"
  },
  {
    "id": "pr-1459",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "A greyed-out Next now says why",
    "detail": "When a Next, Continue, Confirm, Begin or Enter button is greyed out because you still have something to do, a short line under it now tells you what, for example \"Choose a class.\", \"Choose a response first.\" or \"No saved climb yet.\" Before, the reason only showed in a tooltip, which you never see on a phone. This covers character creation, events, conversations, card rewards, the title screen and save slots, the discard choice, the atlas, the Smith, and the rewards screen while a level is waiting to be claimed.",
    "build": "0.7.1.786",
    "pullRequest": 1459,
    "url": "https://github.com/cehinds/AshenSpire/pull/1459"
  },
  {
    "id": "pr-1484",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the folder copy refuses a font file it could not fetch",
    "detail": "Nothing you play changes. The zip download and the site's publishing step now refuse a build whose font file is named in a way the site never publishes, instead of failing partway through the download.",
    "build": "0.7.1.785",
    "pullRequest": 1484,
    "url": "https://github.com/cehinds/AshenSpire/pull/1484"
  },
  {
    "id": "pr-1479",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Sealed and Draft climbs can be continued after a reload",
    "detail": "A Custom Climb with a Sealed or Draft starting deck could not be loaded again: Continue set the save aside as broken, and the climb also stopped working at the end of its first fight. Both now carry on. A save made before this change loads too, with the fix noted in its load report. An older build of the game won't open a save made by this one; it leaves the save untouched rather than adding cards to your deck. Your dealt deck stays the deck you were dealt. Reloading, a mid-fight save, the end of a fight, changing weapons in the Armoury and swapping weapons mid-fight no longer add your equipment's own cards (its Strike and Defend, weapon arts or Dodge Roll) to it. Your first fight now plays your cards with the same weapon bonuses a reloaded climb gives them.",
    "build": "0.7.1.784",
    "pullRequest": 1479,
    "url": "https://github.com/cehinds/AshenSpire/pull/1479"
  },
  {
    "id": "pr-1472",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Hits sound bigger the harder they land",
    "detail": "A small hit, a solid hit and a heavy hit now each have their own sound, chosen by the damage it does. Being hit yourself has a sound of its own, your turn starts with a short two-note sting, and drawing, shuffling and discarding cards each make a quiet sound. The first turn of a fight has them too, and so does LAN co-op. Your sound volume and mute settings apply to all of them.",
    "build": "0.7.1.771",
    "pullRequest": 1472,
    "url": "https://github.com/cehinds/AshenSpire/pull/1472"
  },
  {
    "id": "pr-1458",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: no CI job runs longer than 20 minutes",
    "detail": "Nothing you play changes. The slowest automated checks now run in parallel pieces, so every check still runs but no single job takes more than 20 minutes.",
    "build": "0.7.1.770",
    "pullRequest": 1458,
    "url": "https://github.com/cehinds/AshenSpire/pull/1458"
  },
  {
    "id": "pr-1470",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: a test keeps the Windows file-serving fix from coming back",
    "detail": "Nothing you play changes. The fix itself landed in #1476; this adds a test that imitates Windows' short folder names on any computer and fails if the local test server ever again turns away files in its own folder.",
    "build": "0.7.1.769",
    "pullRequest": 1470,
    "url": "https://github.com/cehinds/AshenSpire/pull/1470"
  },
  {
    "id": "pr-1480",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Save the game as a folder you can unzip",
    "detail": "Download & saves now offers a folder copy of a newer build as one zip, beside the single-file download: unzip it, keep the folder together and double-click the game file inside to play offline with the light art. The game checks every file against the published build as it adds it, and saves nothing if one does not match.",
    "build": "0.7.1.768",
    "pullRequest": 1480,
    "url": "https://github.com/cehinds/AshenSpire/pull/1480"
  },
  {
    "id": "pr-1463",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Escape and the controller's B button take you back",
    "detail": "Run history, the Compendium, Custom Climb, character creation, the LAN lobby, a conversation, a reward's detail view, the quest board and the \"safe to close\" screen now go back when you press Escape or B, the same as pressing their Back button. On a controller, B now also closes Settings, About, Profile and the Armoury, as Escape already did. On the map, Escape or B puts away the selected room's tray. Each press goes back one step: an open tooltip closes first, then a menu or the dialog on top, and only then the screen. Where going back would give something up, Escape and B do nothing, so you have to choose to leave: a shop, the Shrine, your rewards, a fight (they never end your turn), the map, or a finished run.",
    "build": "0.7.1.767",
    "pullRequest": 1463,
    "url": "https://github.com/cehinds/AshenSpire/pull/1463"
  },
  {
    "id": "pr-1481",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: desktop and mobile polish inspiration is saved with the project",
    "detail": "Twelve illustrated boards explore the player-facing screens, from character creation and combat to towns, equipment, rewards, co-op and settings. The searchable gallery opens each board at full size; exact prompts, art credits and notes distinguish the generated examples from the game's real rules. These are design references, not changes to gameplay.",
    "build": "0.7.1.765",
    "pullRequest": 1481,
    "url": "https://github.com/cehinds/AshenSpire/pull/1481"
  },
  {
    "id": "pr-1478",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Your character level gets dearer with every level too",
    "detail": "Your first character level still needs 100 XP, but each level after now costs 1.75 times the one before (100, 180, 310, 540, 940) instead of 130 more, the same growth skills and your class already use. Like any XP setting, this reaches a run you already started the next time you load it.",
    "build": "0.7.1.764",
    "pullRequest": 1478,
    "url": "https://github.com/cehinds/AshenSpire/pull/1478"
  },
  {
    "id": "pr-1476",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: two browser-tool checks pass on Mac and Windows again",
    "detail": "Nothing you play changes. On Windows, the helper that serves the art-pack build to the test tools refused every file it should have served, because it spelled its own folder one way and each file another; it now spells both the same way. On Mac, the check that a browser which dies on start fails at once looked for a program where Macs do not keep it; it now uses one every computer has, and runs on Windows too instead of being skipped.",
    "build": "0.7.1.760",
    "pullRequest": 1476,
    "url": "https://github.com/cehinds/AshenSpire/pull/1476"
  },
  {
    "id": "pr-1448",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: co-op enemy effects on your cards are tested for every player",
    "detail": "Nothing you play changes. New tests check that an enemy move which makes players draw, discard, exhaust, or shuffle their discard pile back into their deck does it to every living player in a co-op fight, and not to a player who is down or disconnected.",
    "build": "0.7.1.759",
    "pullRequest": 1448,
    "url": "https://github.com/cehinds/AshenSpire/pull/1448"
  },
  {
    "id": "pr-1445",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "The opening's words sit in the middle of the caption band",
    "detail": "The narration is now centred top to bottom in the fixed caption band, not pinned to its top. On a phone turned on its side, where the words sit in a panel beside the painting, the panel now fills its whole column instead of a thin strip at the top.",
    "build": "0.7.1.758",
    "pullRequest": 1445,
    "url": "https://github.com/cehinds/AshenSpire/pull/1445"
  },
  {
    "id": "pr-1461",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "The web edition opens by double-click",
    "detail": "Behind the scenes: the web edition's game file, kept together with its folder of art, now plays when opened straight from disk, with its art, fonts and map close-ups, and the music played by the game's own synthesizer; nothing you play changes.",
    "build": "0.7.1.757",
    "pullRequest": 1461,
    "url": "https://github.com/cehinds/AshenSpire/pull/1461"
  },
  {
    "id": "pr-1449",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Warrior's Vow lets you choose your stance",
    "detail": "Playing Warrior's Vow used to put you in Gorefire Stance every time, though the card promised a stance of your choice. Now it asks: you pick Gorefire, Bulwark or Brace, each with what it does, and that is the stance you enter. Cancel keeps the card in your hand. It works the same in co-op, and on a shared couch screen the chooser keeps the keyboard while it is open: Tab moves between the stances instead of switching player, and the card and End Turn keys wait until you choose.",
    "build": "0.7.1.756",
    "pullRequest": 1449,
    "url": "https://github.com/cehinds/AshenSpire/pull/1449"
  },
  {
    "id": "pr-1465",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the build checker's self-test catches up with the art-pack change",
    "detail": "Nothing you play changes. One of the build tool's self-tests plants a deliberate fault in a line the asset loading work rewrote, so it could no longer find that line and the test build's checks went red. It now plants the fault in the line as it reads today.",
    "build": "0.7.1.754",
    "pullRequest": 1465,
    "url": "https://github.com/cehinds/AshenSpire/pull/1465"
  },
  {
    "id": "pr-1447",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: a flask check that had stopped working runs again",
    "detail": "Nothing you play changes. A check makes sure flasks on the map offer the same choices as flasks in a fight. It had stopped looking at the Potions button you use on the map, and nothing ran it, so it failed without anyone noticing. It now follows that Potions button to the choices each flask offers, and the test suite runs it on every change.",
    "build": "0.7.1.753",
    "pullRequest": 1447,
    "url": "https://github.com/cehinds/AshenSpire/pull/1447"
  },
  {
    "id": "pr-1386",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Skills and your class get dearer with every level",
    "detail": "Every weapon, armour, focus, dual-wield and class skill still needs 100 XP for its first level, but each level after now costs 1.75 times the one before (100, 175, 305, 535, 940) instead of 130 more. Like any XP setting, this reaches a run you already started the next time you load it. Your character level is unchanged.",
    "build": "0.7.1.752",
    "pullRequest": 1386,
    "url": "https://github.com/cehinds/AshenSpire/pull/1386"
  },
  {
    "id": "pr-1444",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "The opening is restaged",
    "detail": "The first scene shifts its view slightly right. The Burning's camera now rises slowly up the burning towers. The last two scenes pull the camera back, and the final step eases in. The caption band holds one fixed height on every scene, slightly lower than before, and the words take one size across the whole opening: the largest at which the longest line still fits your screen, so nothing spills or needs scrolling. On a phone held sideways the words stop shrinking before they become too small to read, and the longest caption may scroll there.",
    "build": "0.7.1.750",
    "pullRequest": 1444,
    "url": "https://github.com/cehinds/AshenSpire/pull/1444"
  },
  {
    "id": "pr-1454",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "The web edition's music and map detail follow its art packs",
    "detail": "Behind the scenes: the served web edition now finds its recorded score and the sharp map close-ups through the same checked list as its art, instead of from folders copied beside it. When that list does not load, the game plays its built-in generated score and shows the softer map, as it does for any missing file. The downloadable single file is unchanged. Nothing you play changes.",
    "build": "0.7.1.748",
    "pullRequest": 1454,
    "url": "https://github.com/cehinds/AshenSpire/pull/1454"
  },
  {
    "id": "pr-1457",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Turning Developer tools off no longer changes how the game plays",
    "detail": "On development and test builds, switching Settings → Advanced → Developer tools off and reloading used to drop the developer's chosen starting values for the hidden tuning settings, and switching it back on brought them back. Those values now follow the kind of build you are playing, so the switch only decides which settings sections you see. A downloaded build the game cannot place no longer takes those developer-only values even with the tools switched on; every setting it shows keeps its usual starting value.",
    "build": "0.7.1.747",
    "pullRequest": 1457,
    "url": "https://github.com/cehinds/AshenSpire/pull/1457"
  },
  {
    "id": "pr-1456",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Play the hosted game offline, and download it whole",
    "detail": "On the build site, newer builds now play as the web edition, loading their art from one shared store, and each build's Download saves the light-art single file, one self-contained HTML that plays by double-click. In the game, Download & saves → Make available offline keeps the build and its art in your browser, so the same address opens without internet (the map uses simpler artwork and the music is synthesized offline); Remove this build's offline copy undoes it.",
    "build": "0.7.1.745",
    "pullRequest": 1456,
    "url": "https://github.com/cehinds/AshenSpire/pull/1456"
  },
  {
    "id": "pr-1455",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Legendary sigils: attune one in the Armoury and it works in every fight",
    "detail": "Three legendary sigils join the game: the Sigil of the Last Vigil raises a guard when you start a fight wounded, the Pyre Sigil raises a guard whenever a card is exhausted, and the Gravelight Sigil heals you when a foe falls while you are wounded. A new Sigils panel in the Armoury's Inventory view lets you attune and unattune them out of a fight, one at a time by default; an attuned sigil needs no slot and no weapon, and a refusal is shown in the panel. No shop sells one. A won fight, a boss before the last, or a treasure room can drop one you do not own, but every drop chance starts at 0, so none drops until you raise it in Settings. A treasure room's spoils now survive a reload before you take them. Older saves load with nothing attuned.",
    "build": "0.7.1.744",
    "pullRequest": 1455,
    "url": "https://github.com/cehinds/AshenSpire/pull/1455"
  },
  {
    "id": "pr-1452",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Art quality: Auto, Light or High",
    "detail": "In the web edition, Settings → Display → Art quality now offers Auto, Light, High and Local high-res. Auto loads lighter art on a narrow or phone-sized screen, with Data Saver on or on a device with little memory, and the best art the game carries otherwise; Light and High pick one, and the change takes effect at once and is remembered on this device. A single-file copy carries its art inside it, so there Light and High are greyed out and the setting says why.",
    "build": "0.7.1.742",
    "pullRequest": 1452,
    "url": "https://github.com/cehinds/AshenSpire/pull/1452"
  },
  {
    "id": "pr-1453",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: test tools open the art-pack build the way it plays",
    "detail": "Nothing you play changes. The browser tools that check a built game now ask one helper for its address: a single self-contained file still opens straight from disk, and a build that loads its art from packs is served to them from its own folder on this computer, with the same debug settings the file has.",
    "build": "0.7.1.741",
    "pullRequest": 1453,
    "url": "https://github.com/cehinds/AshenSpire/pull/1453"
  },
  {
    "id": "pr-1439",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the rules for legendary sigils are written down",
    "detail": "This is a docs-only change, and nothing you play changes yet. The design document now says how a legendary sigil works. You attune it in the Armoury, out of a fight, up to a set number at a time, and it works in every fight while attuned, with no slot or weapon needed. Only a fight or a treasure room can drop one, never a shop, and none drops until you raise its chance in Settings. A save from before keeps its sigils and starts with none attuned.",
    "build": "0.7.1.740",
    "pullRequest": 1439,
    "url": "https://github.com/cehinds/AshenSpire/pull/1439"
  },
  {
    "id": "pr-1446",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the browser checks wait longer for a slow browser to start",
    "detail": "Nothing you play changes. The automated checks that open the game in a real browser sometimes failed because the browser took longer than 12 seconds to start on the build servers. They now wait up to 30 seconds for it, and this limit can be changed without editing any check. A browser that crashes on start still fails the check at once.",
    "build": "0.7.1.739",
    "pullRequest": 1446,
    "url": "https://github.com/cehinds/AshenSpire/pull/1446"
  },
  {
    "id": "pr-1451",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "The web edition's fonts and backdrops follow its art packs",
    "detail": "Behind the scenes: the served web edition now loads its lore fonts and backdrop pictures through the same checked list as the rest of its art. When the high-resolution list is missing it now shows the light backdrops, the same as the rest of its art, instead of asking for high-resolution pictures the list no longer vouches for; when no list loads it keeps its plain background and system fonts. The door masks stay inside the game file. Nothing you play changes.",
    "build": "0.7.1.738",
    "pullRequest": 1451,
    "url": "https://github.com/cehinds/AshenSpire/pull/1451"
  },
  {
    "id": "pr-1441",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: the action-bar layout check runs again",
    "detail": "Nothing you play changes. When co-op got the solo action bar, the bar's markup moved into a shared component, and the tool that checks the bar never lands on your cards, the top bar or the battlefield was still looking for it in the old place. It stopped before it measured anything. It now reads the shared component and checks all 44 cells again.",
    "build": "0.7.1.737",
    "pullRequest": 1441,
    "url": "https://github.com/cehinds/AshenSpire/pull/1441"
  },
  {
    "id": "pr-1442",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "The Pages site no longer copies the art review folder",
    "detail": "Behind the scenes: the project site stops carrying the art review pages and old build-file copies from main, the stable links get their map tiles beside every copy, and link previews use a picture the site itself serves; nothing you play changes.",
    "build": "0.7.1.736",
    "pullRequest": 1442,
    "url": "https://github.com/cehinds/AshenSpire/pull/1442"
  },
  {
    "id": "pr-1443",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "The web edition loads its art from hash-pinned packs",
    "detail": "Behind the scenes: the served web edition now keeps its art as files named by their contents, checks the list of them against a fingerprint inside the game file before using it, and falls back from high to light art (or to placeholders) when a list is missing; the single-file download is unchanged and nothing you play changes.",
    "build": "0.7.1.735",
    "pullRequest": 1443,
    "url": "https://github.com/cehinds/AshenSpire/pull/1443"
  },
  {
    "id": "pr-1437",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: every class now plays five whole runs on every change",
    "detail": "Nothing you play changes. The test suite now plays five full runs for each class without a screen, on fixed seeds. Each run goes from the map through fights, rewards and events to a win or a death. The suite fails if a run crashes or gets stuck, whether in a fight that never ends or on a map path that never reaches the boss.",
    "build": "0.7.1.734",
    "pullRequest": 1437,
    "url": "https://github.com/cehinds/AshenSpire/pull/1437"
  },
  {
    "id": "pr-1435",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Behind the scenes: combat screenshots no longer leave out your character",
    "detail": "Nothing you play changes: your character was always drawn in the game itself. The tool that takes the preview pictures sometimes took the combat picture before your character was painted, which left only a shadow where they stand. It now waits until every fighter's artwork has loaded and the picture holds still, and if that never happens it reports the problem instead of saving the picture. The larger enemies in recent pictures are intended, from the recent changes that made enemies larger on the battlefield.",
    "build": "0.7.1.733",
    "pullRequest": 1435,
    "url": "https://github.com/cehinds/AshenSpire/pull/1435"
  },
  {
    "id": "pr-1436",
    "date": "2026-10-02",
    "group": "2026-10-02",
    "summary": "Co-op combat has the same bottom bar as solo",
    "detail": "In a co-op fight the bottom of the screen showed an Actions circle, a stretched End Turn bar and a second row of flask buttons, and it had no Draw, Discard or Potions. Now it is the solo bar: Actions, Draw, End Turn, Discard/Exhaust and Potions, in one tidy row, laid out exactly as solo lays them out on a phone, a sideways phone and a desktop. Your flasks are behind Potions, as they are in solo, and the flask keys open that list. With two players on one screen, the Potions list belongs to whoever opened it: switching seats with Tab closes it, so you can never drink the other player's flask by mistake. A player who is down or disconnected can still open Potions to see what they carry. Each potion's details now say where it goes in co-op: at the selected enemy, or at a player you pick. Pressing a flask key twice no longer stacks a second Potions list over the board, and screen readers hear the Actions count as it changes. If the fight ends while the Potions list is open, it closes, and a Use confirmed after the host has moved your potions spends nothing.",
    "build": "0.7.1.732",
    "pullRequest": 1436,
    "url": "https://github.com/cehinds/AshenSpire/pull/1436"
  },
  {
    "id": "pr-1438",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "A wise master can now train, respec and teach your weapon skills",
    "detail": "A master teaches three or four skills and sells books, weapon arts and armaments for them. Training buys XP for one of his skills, up to a few sessions per visit. A lesson draws a skill draft of cards for one of his skills, and you buy one for your deck; a reload keeps the same cards. A respec sends a skill at level 2 or higher back to level 1 and pays part of its XP into a training pool, which you can spend on any skill. Appraisal shows each of his skills for free, and you can sell skill books and revive tokens to him. No map place has a master yet; a merchant can be one if you raise its weight in Settings. A save made while visiting a blacksmith in town no longer fails to load, and a custom run's shop price changes now apply to weapon arts too.",
    "build": "0.7.1.727",
    "pullRequest": 1438,
    "url": "https://github.com/cehinds/AshenSpire/pull/1438"
  },
  {
    "id": "pr-1433",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "Behind the scenes: the format for loading art, fonts, music and map tiles as separate files is written and checked",
    "detail": "Nothing you play changes. A new tool packs the art, fonts, music and map tiles into files named by their contents, with an index for each art tier, and the art list now records the fonts, the font licence, the music and the map tiles as one shared set; the game does not load them this way yet.",
    "build": "0.7.1.726",
    "pullRequest": 1433,
    "url": "https://github.com/cehinds/AshenSpire/pull/1433"
  },
  {
    "id": "pr-1431",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "Behind the scenes: the rules for the wise master are written down",
    "detail": "This is a docs-only change, and nothing you play changes yet. The design document now says what a master visit keeps on its shelves: books, weapon arts and armaments for the skills that master teaches. A reload leaves them as they were. Training, a lesson and a respec each go through once and refuse an offer that changed. A lesson's three cards are drawn when you first ask for it and stay the same after a reload. Each skill can take one lesson per visit, and the card joins your deck. A respec pays its refund into a training pool, which you can spend on any skill. A master's services stay on offer for the whole visit and become usable once you have something for them. The document also sets the least each of the master's numbers may be set to. No map place has a master yet.",
    "build": "0.7.1.725",
    "pullRequest": 1431,
    "url": "https://github.com/cehinds/AshenSpire/pull/1431"
  },
  {
    "id": "pr-1432",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "In co-op, Dazed now reaches every living player",
    "detail": "The Grave Wisp, Mirror Scribe, Eclipse Cantor and Hollow Astronomer used to shuffle their Dazed into the first player's deck only. Now every living player gets one, like the Husk Brute's Slimed and the Court Surgeon's Wound already did. Downed players get none, and solo play is unchanged.",
    "build": "0.7.1.724",
    "pullRequest": 1432,
    "url": "https://github.com/cehinds/AshenSpire/pull/1432"
  },
  {
    "id": "pr-1390",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "The blacksmith offers equipment, upgrades, sigils, extraction and copy stacking. Trades commit the displayed quote and honor configured deck copy limits",
    "detail": "Custom shop prices apply to weapons too. XP refill callbacks cannot reopen a replaced reward screen, and saved skill curves keep their exact thresholds.",
    "build": "0.7.1.723",
    "pullRequest": 1390,
    "url": "https://github.com/cehinds/AshenSpire/pull/1390"
  },
  {
    "id": "pr-1388",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "Five class cards can now be drafted, and two enemies leave status cards behind",
    "detail": "Rondel Parry and Sunderplate (Reaver), Astral Insight (Starseer), and Blightward Lash and Last Mercy (Herald) now show up in card rewards and shops for their class; Astral Insight now also costs 1 Stamina and 1 Mana. The Court Surgeon's scalpel now leaves a Wound in your discard pile, and the Husk Brute's bellow leaves a Slimed.",
    "build": "0.7.1.723",
    "pullRequest": 1388,
    "url": "https://github.com/cehinds/AshenSpire/pull/1388"
  },
  {
    "id": "pr-1382",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "Behind the scenes: the co-op fight's top bar is checked in a real browser",
    "detail": "Nothing you play changes. On a short landscape screen the co-op top bar keeps your health, mana and stamina bars and the Leave button on one line, so the battlefield keeps its height. A new check opens the co-op fight on a phone held upright, a phone held sideways and a laptop screen, and fails if anything in that bar overlaps, gets cut off, goes missing or pushes the page sideways.",
    "build": "0.7.1.723",
    "pullRequest": 1382,
    "url": "https://github.com/cehinds/AshenSpire/pull/1382"
  },
  {
    "id": "pr-1383",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "More health to start a climb, and a fourth Action at Dexterity 4",
    "detail": "Every new character opens with 21 more HP: a Reaver on 70, a Starseer on 69, a Rogue or Herald on 59, sized so the first three fights of a climb rarely take the whole pool. Dexterity now buys an extra Action from 4 points instead of 5, so you can start with four Actions by putting all three creation points into Dexterity, or reach it within three level-ups. Runs already under way keep the numbers they started with.",
    "build": "0.7.1.723",
    "pullRequest": 1383,
    "url": "https://github.com/cehinds/AshenSpire/pull/1383"
  },
  {
    "id": "pr-1381",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "You draw more cards each turn",
    "detail": "A new character now draws 3 cards at the start of each turn instead of 2, and still keeps the cards it did not play, up to its hand size. Cards and relics that draw more matter again because the hand is no longer full every turn. Advanced → Stats → Draw & hand still lets you fill the hand to its size each turn or discard unplayed cards at the end of the turn. Runs already under way keep the draw they started with.",
    "build": "0.7.1.723",
    "pullRequest": 1381,
    "url": "https://github.com/cehinds/AshenSpire/pull/1381"
  },
  {
    "id": "pr-1346",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "The Fullscreen switch stays on screen in Settings, and three release checks pass again",
    "detail": "The Preview sample at the top of Settings › General › Display and Accessibility now starts folded; open, it pushed the Fullscreen switch below the bottom of a phone screen at the largest text size when Settings was opened mid-fight. Tap Preview to open it, and it stays open next time. Behind the scenes, two automated checks that failed on the release build are fixed: one reported a clean browser run as a failure because of how it worded its result, and the build ran out of memory on macOS.",
    "build": "0.7.1.723",
    "pullRequest": 1346,
    "url": "https://github.com/cehinds/AshenSpire/pull/1346"
  },
  {
    "id": "pr-1392",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "Behind the scenes: record the agreed external-art and offline-download plan",
    "detail": "Merged as pull request #1392 in development build 0.7.1.723.",
    "build": "0.7.1.723",
    "pullRequest": 1392,
    "url": "https://github.com/cehinds/AshenSpire/pull/1392"
  },
  {
    "id": "pr-1333",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "Behind the scenes: builds come from CI instead of repository copies",
    "detail": "Merged as pull request #1333 in development build 0.7.1.723.",
    "build": "0.7.1.723",
    "pullRequest": 1333,
    "url": "https://github.com/cehinds/AshenSpire/pull/1333"
  },
  {
    "id": "pr-1428",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "Victory XP adds up before your eyes, and leftover XP refills after each level",
    "detail": "Victory counts the combat-power bonus and each defeated enemy in a compact scrolling receipt, with a running equation and total. Each manual Level press shows remaining XP refill the character or skill bar before its reward opens. New progression steps start at 100 XP and add 130 XP per level by default; base, scaler, receipt timing and refill timing remain configurable.",
    "build": "0.7.1.721",
    "pullRequest": 1428,
    "url": "https://github.com/cehinds/AshenSpire/pull/1428"
  },
  {
    "id": "pr-1425",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "Progression rules for the next XP update",
    "detail": "The specification records a first step of 100 XP, a configurable linear scaler of 1.3, and a visible refill from remaining XP after each manual level claim. Runtime implementation follows separately.",
    "build": "0.7.1.719",
    "pullRequest": 1425,
    "url": "https://github.com/cehinds/AshenSpire/pull/1425"
  },
  {
    "id": "pr-1378",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "Behind the scenes: the rules for the blacksmith are written down",
    "detail": "Docs only; nothing you play changes yet. The design document now says what a blacksmith visit keeps on its shelves and how a reload leaves them and their prices as they were; that each purchase or service at the blacksmith goes through once and refuses an offer that changed; that an upgrade can be paid wholly in Smithing Stones or wholly in refined stones, never a mix, at the cost the item's own upgrade table sets; how many sigil slots a weapon has and how many more the blacksmith will cut; that a sigil set into a weapon works only while that weapon is equipped, even after a swap mid-fight; what upgrading a loose weapon art and stacking a copy of a card cost; the least each of the blacksmith's numbers may be set to; that a blacksmith service stays on offer for the whole visit and becomes usable as soon as you have something for it; and that the blacksmith sells no sigils of its own.",
    "build": "0.7.1.718",
    "pullRequest": 1378,
    "url": "https://github.com/cehinds/AshenSpire/pull/1378"
  },
  {
    "id": "pr-1426",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "Behind the scenes: combat size checks report browser failures",
    "detail": "Combat sizing checks now fail on console errors and failed requests. The overhead check and component reference describe the fixed 14 pixel action gap and larger hand cards.",
    "build": "0.7.1.717",
    "pullRequest": 1426,
    "url": "https://github.com/cehinds/AshenSpire/pull/1426"
  },
  {
    "id": "pr-1422",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "Enemies regain their stature and actions stay with their cards",
    "detail": "Light artwork now uses the same proportions as full artwork, fixing tiny enemies. Action badges sit 14 pixels above each combatant card, with transparent image padding excluded. Hand cards grow larger when space permits.",
    "build": "0.7.1.716",
    "pullRequest": 1422,
    "url": "https://github.com/cehinds/AshenSpire/pull/1422"
  },
  {
    "id": "pr-1423",
    "date": "2026-10-01",
    "group": "2026-10-01",
    "summary": "Opening scenes keep the traveller in your hands, and XP edits preserve your save's rules",
    "detail": "Each opening scene can show or hide the traveller, turn it, and place it before or behind the colour wash. Desktop and phone poses remain separate, and rotated figures retain accurate size and drag handles. Editing XP settings on an older save keeps that save's combat rating rules and other configuration metadata.",
    "build": "0.7.1.714",
    "pullRequest": 1423,
    "url": "https://github.com/cehinds/AshenSpire/pull/1423"
  },
  {
    "id": "pr-1420",
    "date": "2026-09-29",
    "group": "2026-09-29",
    "summary": "Behind the scenes: the Armoury browser check reports its result to CI",
    "detail": "The checker already passed all 42 tab and figure checks at three screen widths; it now gives the CI wrapper a counted success line so that green result is accepted.",
    "build": "0.7.1.709",
    "pullRequest": 1420,
    "url": "https://github.com/cehinds/AshenSpire/pull/1420"
  },
  {
    "id": "pr-1418",
    "date": "2026-09-29",
    "group": "2026-09-29",
    "summary": "Behind the scenes: the card hand layout check catches misplaced controls again",
    "detail": "Five deliberate layout defects now use the current fitted hand and footer, so the browser check can catch cards covering controls, a clipped End Turn label, and a hidden action row.",
    "build": "0.7.1.708",
    "pullRequest": 1418,
    "url": "https://github.com/cehinds/AshenSpire/pull/1418"
  },
  {
    "id": "pr-1412",
    "date": "2026-09-29",
    "group": "2026-09-29",
    "summary": "Behind the scenes: phone layout checks retain the covered map probe",
    "detail": "The closed map tray test now recreates both its old height and hit interception, so the browser check proves it catches map controls covered by that defect. The fitted card hand now stops reporting an unused fan lift, and its layout check tests whether cards escape their hand box.",
    "build": "0.7.1.707",
    "pullRequest": 1412,
    "url": "https://github.com/cehinds/AshenSpire/pull/1412"
  },
  {
    "id": "pr-1414",
    "date": "2026-09-29",
    "group": "2026-09-29",
    "summary": "XP settings now shape rewards, and levels wait for your choice",
    "detail": "A fight pays character XP from defeated enemies' level, combat power and equipment, using the values in Advanced settings; the levelling preview follows those values too. After Victory, the XP bars fill in sequence, and a blue Level button appears on each full character or skill bar. Pressing it advances one level, keeps any excess XP, and opens that level's reward. Character levels offer passive feats by default, with separate settings for class upgrades, bonus cards and stat points. You can also let levels advance automatically.",
    "build": "0.7.1.706",
    "pullRequest": 1414,
    "url": "https://github.com/cehinds/AshenSpire/pull/1414"
  },
  {
    "id": "pr-1411",
    "date": "2026-09-29",
    "group": "2026-09-29",
    "summary": "Behind the scenes: phone reachability checks stay effective",
    "detail": "The browser check again proves it catches an intent badge trapped beneath neighboring art, including with extra-large text. Its obsolete closed-map-tray test is removed because that tray no longer has visible controls to measure.",
    "build": "0.7.1.704",
    "pullRequest": 1411,
    "url": "https://github.com/cehinds/AshenSpire/pull/1411"
  },
  {
    "id": "pr-1408",
    "date": "2026-09-29",
    "group": "2026-09-29",
    "summary": "Overlapping enemy sprites keep a clear tap area",
    "detail": "Enemy intent badges sit a little higher above their artwork while respecting the HUD boundary. This leaves room to select a Grave Wisp on a short phone in extra-large text without covering its resource bars.",
    "build": "0.7.1.701",
    "pullRequest": 1408,
    "url": "https://github.com/cehinds/AshenSpire/pull/1408"
  },
  {
    "id": "pr-1407",
    "date": "2026-09-29",
    "group": "2026-09-29",
    "summary": "Bow attacks draw and release, and cards choose the matching weapon motion",
    "detail": "A Bow Attack now plays a seven-step draw and shot in every armor appearance. Blade attacks use greatsword, sword-and-shield, or twin-sword movement according to what is held. Spell attacks cast; shield attacks share one bash, and guarding with a shield keeps the shield guard movement.",
    "build": "0.7.1.700",
    "pullRequest": 1407,
    "url": "https://github.com/cehinds/AshenSpire/pull/1407"
  },
  {
    "id": "pr-1405",
    "date": "2026-09-29",
    "group": "2026-09-29",
    "summary": "Enemy taps stay reachable in source and packaged play",
    "detail": "The transparent 44 px target now sits on each enemy's clickable frame, above neighboring artwork. This keeps even an overlapping Grave Wisp selectable on a short phone with extra-large text, regardless of how its art loads.",
    "build": "0.7.1.697",
    "pullRequest": 1405,
    "url": "https://github.com/cehinds/AshenSpire/pull/1405"
  },
  {
    "id": "pr-1403",
    "date": "2026-09-29",
    "group": "2026-09-29",
    "summary": "Enemy intent badges stay in front of the fighters",
    "detail": "On a short phone screen, a neighboring enemy's sprite could cover the entire intent button. The artwork keeps its depth order while intent buttons, names and resource bars remain above it. Tiny enemies gain a larger tap area without changing their artwork size.",
    "build": "0.7.1.696",
    "pullRequest": 1403,
    "url": "https://github.com/cehinds/AshenSpire/pull/1403"
  },
  {
    "id": "pr-1401",
    "date": "2026-09-29",
    "group": "2026-09-29",
    "summary": "Behind the scenes: the long checks finish within an hour",
    "detail": "The Windows build check divides its known-bad cases among four jobs, and the browser checks run in smaller jobs. All cases still run; each job has a one-hour limit. The phone reachability check now accepts an enemy intent badge when it has a full finger-sized exposed area, while catching badges that cannot be pressed anywhere.",
    "build": "0.7.1.695",
    "pullRequest": 1401,
    "url": "https://github.com/cehinds/AshenSpire/pull/1401"
  },
  {
    "id": "pr-1399",
    "date": "2026-09-28",
    "group": "2026-09-28",
    "summary": "Card details stay tappable in a crowded phone fight",
    "detail": "The More button on a truncated card now sits above the overlapping hand, where the next card cannot cover it. The phone reachability check also recognizes closed map trays and checks the part of each fighter that can actually be tapped.",
    "build": "0.7.1.694",
    "pullRequest": 1399,
    "url": "https://github.com/cehinds/AshenSpire/pull/1399"
  },
  {
    "id": "pr-1397",
    "date": "2026-09-28",
    "group": "2026-09-28",
    "summary": "Browser checks for Fullscreen and saved-game loading run to completion",
    "detail": "One of the Fullscreen check's deliberate defects no longer matched the current Settings source after an art quality setting was added. It now swaps the current Fullscreen and Accent rows and checks that the wrong order is caught. The saved-game loading check now reports its successful deliberate-defect checks in the format the test runner expects.",
    "build": "0.7.1.685",
    "pullRequest": 1397,
    "url": "https://github.com/cehinds/AshenSpire/pull/1397"
  },
  {
    "id": "pr-1395",
    "date": "2026-09-28",
    "group": "2026-09-28",
    "summary": "Fullscreen stays visible at the top of Display on a phone",
    "detail": "With XL text, the open display preview could push the Fullscreen switch below the visible settings pane during a fight. Fullscreen now comes first, followed by the same live preview and the other Display controls. The browser check for loading a saved fight now reports its completed checks correctly.",
    "build": "0.7.1.683",
    "pullRequest": 1395,
    "url": "https://github.com/cehinds/AshenSpire/pull/1395"
  },
  {
    "id": "pr-1393",
    "date": "2026-09-28",
    "group": "2026-09-28",
    "summary": "Developer tools can be switched off in development and test builds",
    "detail": "Settings → Advanced now has a Developer tools switch in development and test builds. It starts on there, but you can turn it off; your choice is remembered on this device. An unrecognised downloaded file starts with the tools off and lets you turn them on. Release and main builds keep the tools off and no longer show the Developer tools row.",
    "build": "0.7.1.681",
    "pullRequest": 1393,
    "url": "https://github.com/cehinds/AshenSpire/pull/1393"
  },
  {
    "id": "pr-1389",
    "date": "2026-09-27",
    "group": "2026-09-27",
    "summary": "Levelling a weapon offers real choices, and each class has more abilities",
    "detail": "Every starting weapon, shield and staff now offers at least four different cards at each rarity when it levels up. The Reaver's sword and shield used to offer commons only, and the Starseer's Ash Focus offered nothing; 24 new cards fill the gaps, among them twelve Starseer ash rites for the Ash Focus, new bow and parrying cards for the Rogue, and new sword and shield cards for the Reaver. Each class's ability tree grows from six to ten choices: two more at each of its first two tiers. The subclass choice is unchanged.",
    "build": "0.7.1.679",
    "pullRequest": 1389,
    "url": "https://github.com/cehinds/AshenSpire/pull/1389"
  },
  {
    "id": "pr-1385",
    "date": "2026-09-27",
    "group": "2026-09-2…54504 tokens truncated…thing meant editing code. The spoils screen and the merchant now read their words from a single spreadsheet, each entry holding three lengths — the short label, the full sentence, and the tooltip a small button gets — and a new check stops any screen from quietly going back to writing its own.",
    "build": "0.7.1.6",
    "pullRequest": 991,
    "url": "https://github.com/cehinds/AshenSpire/pull/991"
  },
  {
    "id": "pr-989",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "The three regions can now be climbed in any order, and each run picks its own",
    "detail": "The Hollow Weald, the Pale Marches and the Cinder Reach are now seats: each carries its own enemies, bosses and scenery, and the seed decides which one a new climb opens in. Fighting a seat out of its old order scales its enemies' health to the act you meet it in, so the second and third acts stay the second and third acts wherever you are. The map title and the top band read the act and the seat together. Custom Climb gains a First seat control to open where you choose; a party in Forsaken Together climbs one shared order. The final act still offers the Blighted Valkyrie beside the seat's own bosses, and her fight paints the causeway. Saves from before this change load exactly as they were, climbing the same order they always did, and every existing seed's maps and fights are unchanged. This is the first build of the 0.7 line.",
    "build": "0.7.1.2",
    "pullRequest": 989,
    "url": "https://github.com/cehinds/AshenSpire/pull/989"
  },
  {
    "id": "pr-990",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "Doors and explanations arrive with a small motion",
    "detail": "Every window that opens over the game — settings, the Armoury, a confirmation, the loot screen — now fades in and settles into place over a fraction of a second instead of appearing all at once, and explanations fade in the same way. When an explanation grows because you moved to something with more to say, the extra part is revealed rather than snapped open. The Reduced motion setting, or the same preference in your operating system, turns all of this off.",
    "build": "0.6.0.165",
    "pullRequest": 990,
    "url": "https://github.com/cehinds/AshenSpire/pull/990"
  },
  {
    "id": "pr-988",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "Every control shows the same gold ring when you land on it",
    "detail": "Moving through the game with a keyboard or a controller now draws one ring — a thin gold line — around whatever you are on, everywhere: buttons, cards, the map, the Armoury, settings. Before, different screens drew different rings in different colours and thicknesses, and some drew a soft halo instead. The controller's cursor uses the same ring.",
    "build": "0.6.0.162",
    "pullRequest": 988,
    "url": "https://github.com/cehinds/AshenSpire/pull/988"
  },
  {
    "id": "pr-985",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "A written plan for how your character will grow",
    "detail": "Nothing a player sees changes. The owner's design for the next ruleset is now a document in the repository rather than a conversation: weapons, armour, relics and your class all become cards you wear; using a weapon levels a skill that offers you cards; your character levels from experience and grants one attribute point each time; mana stays a fixed pool that only potions, rests and named effects refill; every rest restores some mana; and every number in it is a settings row. It ends with the order the work will land in, and a second document breaks that order into the pull requests, files and tests each step needs.",
    "build": "0.6.0.161",
    "pullRequest": 985,
    "url": "https://github.com/cehinds/AshenSpire/pull/985"
  },
  {
    "id": "pr-987",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "A card whose text is cut short can be opened with one tap",
    "detail": "When a card's text does not fit its face, the small › in its corner is now a button: tap it on a phone and the card's full information opens, the same window the i button shows. Before, the › was only a hint, and the i only appeared after you had already selected the card.",
    "build": "0.6.0.160",
    "pullRequest": 987,
    "url": "https://github.com/cehinds/AshenSpire/pull/987"
  },
  {
    "id": "pr-986",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "A breath between the last blow and the loot",
    "detail": "When the last enemy falls, the fight's title — Victory, Elite vanquished, or the boss's name falling — now stands over the battlefield for a moment before the reward screen opens, instead of the loot appearing the instant the fight ends. The Reduced motion setting skips the pause.",
    "build": "0.6.0.159",
    "pullRequest": 986,
    "url": "https://github.com/cehinds/AshenSpire/pull/986"
  },
  {
    "id": "pr-982",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "Deleting a save asks the way every other decision does",
    "detail": "The ✕ on a save slot now opens a door that names the slot, shows the climb that would go — class, act, floor, health, seed — and offers a red Delete or Back, instead of a bare hold with no picture of what it erases. A deliberate hold on the ✕ still deletes directly if you keep that setting on. On the way, a red button on a danger door (Overwrite, Delete) had been painted green by the rule that turns a ready button green; it keeps its red now.",
    "build": "0.6.0.158",
    "pullRequest": 982,
    "url": "https://github.com/cehinds/AshenSpire/pull/982"
  },
  {
    "id": "pr-980",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "One tap picks an item at the Smith and one tap arms a burn at the merchant",
    "detail": "On a phone, choosing an armament for the Smith to upgrade took three taps, and so did arming a card to burn out of your deck at the merchant: the first tap selected the card, the second was taken as a request for its explanation, and only the third did what you meant. Both cards now answer the first tap, the same way a card in your hand does. Upgrading and burning still ask you to confirm.",
    "build": "0.6.0.157",
    "pullRequest": 980,
    "url": "https://github.com/cehinds/AshenSpire/pull/980"
  },
  {
    "id": "pr-979",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "The project's own checks read the screens as they are now",
    "detail": "Nothing a player sees changes. Five of the checks the project runs against the real game had fallen behind the screens they measure — the merchant's seven shelves, the potions that moved into a menu in combat, the Smith's level-up dialog, a purchase that asks before it takes your cinders, a kit choice that is two taps — and were reporting the game broken where it was not. Each one now walks the game the way a player does. Two things they found on the way are recorded for the owner rather than papered over: choosing a Smith candidate by touch takes three taps, and the Smith's extract and install services cannot be reached from a fresh run's Shrine.",
    "build": "0.6.0.156",
    "pullRequest": 979,
    "url": "https://github.com/cehinds/AshenSpire/pull/979"
  },
  {
    "id": "pr-977",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "Every room shows your purse, and the small screens stopped fighting you",
    "detail": "The merchant, the Shrine and an event now carry the same top band the map and combat do — cinders, health, mana, stamina, act and floor, with the Armoury and Menu a tap away — so you no longer buy blind at the merchant (its own cinders line had been rendering at zero height). An event's choices wrap on a phone instead of cutting off the part that says what happens. In combat on a phone, End Turn is a readable two-line button beside smaller Actions and Potions dials, the E keycap is gone where there is no keyboard, and the cards in your hand stop shrinking to thumbnails on a short screen; a back-row enemy's empty status tray no longer swallows the tap meant for the enemy in front of it. With Reduced motion on, the act map opens on your door instead of bare parchment above it. Character creation on a phone lists the classes before the preview; \"Auto-advance on valid choice\" moved to Settings (Advanced → Gameplay); the card's Info button sits inside the card. The Armoury's four tabs fit one row on a phone. At a Shrine, Rest at full health reads as what it is.",
    "build": "0.6.0.153",
    "pullRequest": 977,
    "url": "https://github.com/cehinds/AshenSpire/pull/977"
  },
  {
    "id": "pr-965",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "Character creation walks you through it, one green Continue at a time",
    "detail": "Every step now starts unchosen, and its Continue stays muted — saying why on hover or tap — until the step is complete, then turns green and opens the next one. Pick a class and Continue to character opens Primary Stats on the Standard / Assign points question; Standard shows the stats with a Continue, Assign points' Continue goes green at zero points (a weapon your stats cannot wield is now explained at the Main Hand step and at Begin, not while you assign); the Keepsake unfolds when the stats settle; Continue to equipment opens Starting Armour with nothing chosen; each equipment Continue folds its section and opens the next, and Begin is the button that goes green at the end, naming whatever is still missing. Open equipment sections now fit a desktop screen instead of running off it, Back stays left and Begin right, and the Equipment summary shows your character, armour, main hand, off hand and relic as cards with the calculations folded beneath.",
    "build": "0.6.0.151",
    "pullRequest": 965,
    "url": "https://github.com/cehinds/AshenSpire/pull/965"
  },
  {
    "id": "pr-974",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "The record now names the two entries that wrote the record",
    "detail": "Nothing a player sees changes. This project keeps a rule that every change landed has a line here naming it, and a change whose only content was writing two of those lines had not written one for itself. Both are written now, this one included, so the count of unnamed changes falls instead of moving sideways.",
    "build": "0.6.0.149",
    "pullRequest": 974,
    "url": "https://github.com/cehinds/AshenSpire/pull/974"
  },
  {
    "id": "pr-973",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "A missing line about the download split",
    "detail": "Nothing a player sees changes. The entry explaining that the double-clickable game can now be downloaded on its own had been left out when that change landed, because it altered no part of the game itself. The rule asks for a line whether or not the game moved, and it has one.",
    "build": "0.6.0.148",
    "pullRequest": 973,
    "url": "https://github.com/cehinds/AshenSpire/pull/973"
  },
  {
    "id": "pr-967",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "The double-clickable game can be downloaded on its own",
    "detail": "Nothing in the game changes. Each development build produces the game two ways: a folder you serve, whose art arrives a screen at a time, and one large file you double-click that needs no server at all. They were bundled into a single download of about 191 MB, with the double-clickable file buried inside the folder, so there was no way to ask for just the one you wanted. They are now two separate downloads — about 152 MB for the folder and about 39 MB for the single file — from the same build, and the folder's read-me says which one it is and where the other lives.",
    "build": "0.6.0.148",
    "pullRequest": 967,
    "url": "https://github.com/cehinds/AshenSpire/pull/967"
  },
  {
    "id": "pr-966",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "A red warning stopped appearing over screens that were fine",
    "detail": "The game has one way of telling you a button just died: a red block that says something stopped working. It was also showing that block for a message the browser sends when it simply ran out of time mid-frame and finished the job on the next one — nothing broke, nothing was lost, and the thing you pressed had worked. It turned up on the character-creation screen, and it named no file or line because there was nothing to name. That notice now goes quietly into the Command log, where it is still there to read if a screen ever does feel sluggish, and the red block is kept for what it was for. A real fault still raises it, including one that merely mentions the same browser feature by name.",
    "build": "0.6.0.147",
    "pullRequest": 966,
    "url": "https://github.com/cehinds/AshenSpire/pull/966"
  },
  {
    "id": "pr-970",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "A check that had been crashing instead of checking now runs",
    "detail": "Nothing a player sees changes. One of the project's own quality checks — the one that proves the Music setting and the Quick Menu agree about what is on — was not failing and not passing: it was dying on startup, before it looked at anything. A small piece of card-drawing code runs two lines when it finds itself inside a browser, and it tested for only half of what those two lines actually use, so a checking harness that supplies the other half and not that half walked straight into a crash. The test now asks for both things it needs. The check reports thirty-two passes where it used to report nothing at all.",
    "build": "0.6.0.145",
    "pullRequest": 970,
    "url": "https://github.com/cehinds/AshenSpire/pull/970"
  },
  {
    "id": "pr-961",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "Two more entries the record was missing",
    "detail": "Nothing a player sees changes. Two changes had landed without a line here. Their build numbers are read from the project's own history at the moment each one landed rather than from what its author wrote down, which is the habit that caught an earlier entry naming a build one short of the real one.",
    "build": "0.6.0.142",
    "pullRequest": 961,
    "url": "https://github.com/cehinds/AshenSpire/pull/961"
  },
  {
    "id": "pr-968",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "Explanations wait for you to ask",
    "detail": "A tooltip now opens after a second of hovering instead of half a second; the delay setting still offers faster. Tapping or clicking a detail highlights it, and a second tap or click explains it — so a stray touch never opens one. Cards no longer explain themselves on hover: select a card and use its Information button. Keyboard focus still explains after half a second.",
    "build": "0.6.0.140",
    "pullRequest": 968,
    "url": "https://github.com/cehinds/AshenSpire/pull/968"
  },
  {
    "id": "pr-964",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "The combat board fills a desktop screen",
    "detail": "On a wide window the fighters and the hand grew with the stage instead of staying phone-sized; Draw and Discard stopped stretching across a third of the screen each, and Actions, End Turn and Potions stand as tall as their row allows. Phones keep the layout they had. The small fold button above the turn banner that snapped the top bar compact is gone, and with it the compact top bar.",
    "build": "0.6.0.136",
    "pullRequest": 964,
    "url": "https://github.com/cehinds/AshenSpire/pull/964"
  },
  {
    "id": "pr-963",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "The boot check waits for the tower's entrance",
    "detail": "#949 lights the city, holds, and fades before the title appears; the startup check still judged the reveal a fraction of a second after the press and called it missing. It now waits for the title the way it already did for a mouse or a tap, and its \"gate still standing\" claims no longer count a reveal that has begun. Nothing in the game changed.",
    "build": "0.6.0.134",
    "pullRequest": 963,
    "url": "https://github.com/cehinds/AshenSpire/pull/963"
  },
  {
    "id": "pr-928",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "A place you inspect and the fight you walk into now look like the same place",
    "detail": "Looking at a location on the world map and then travelling there could show you two different scenes. Both now resolve the same spot to the same setting and draw from the same pool of paintings, and the choice is remembered once you enter, so it holds from turn to turn. Where a time-of-day or weather variant does not exist, it falls back within the same setting rather than to something unrelated. Travel is green and sits bottom-right, and the local map controls follow the direction they move you.",
    "build": "0.6.0.122",
    "pullRequest": 928,
    "url": "https://github.com/cehinds/AshenSpire/pull/928"
  },
  {
    "id": "pr-952",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "The pose editor's companion application is named",
    "detail": "Nothing a player sees changes. The Pose and Effects Studio notes said the outside editor that opens this project was unknown; it is Spire Studio, and the note now records how to connect it and which file formats it leaves alone.",
    "build": "0.6.0.122",
    "pullRequest": 952,
    "url": "https://github.com/cehinds/AshenSpire/pull/952"
  },
  {
    "id": "pr-954",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "The record of what shipped caught up with what shipped",
    "detail": "Nothing a player sees changes. Three changes had landed without an entry here, and the number stamped on the downloadable game belonged to an older version of the source — it had been merged without being rebuilt, so the box and its contents disagreed. The three entries are written, and the build is made again so its stamp is honest. One detail worth keeping: each entry's build number was read out of the project's own history at the moment that change landed, not copied from what its author wrote down, and the two disagreed once out of three.",
    "build": "0.6.0.133",
    "pullRequest": 954,
    "url": "https://github.com/cehinds/AshenSpire/pull/954"
  },
  {
    "id": "pr-921",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "City maps and pop-up panels stay readable when there is a lot to show",
    "detail": "All eleven local maps use a tall layout that protects the map area, lets the benefit details scroll on their own, and pins Return and the service buttons where you can always reach them. A short, wide screen puts the map and its details side by side instead. Shared dialogs keep their usual widths but grow taller when the content needs it, with headers and footers staying put while the middle scrolls.",
    "build": "0.6.0.108",
    "pullRequest": 921,
    "url": "https://github.com/cehinds/AshenSpire/pull/921"
  },
  {
    "id": "pr-956",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "The combat screen draws again",
    "detail": "#939 landed reading a name #945 had renamed, so the board mounted with no enemies and no hand. Two words, corrected.",
    "build": "0.6.0.132",
    "pullRequest": 956,
    "url": "https://github.com/cehinds/AshenSpire/pull/956"
  },
  {
    "id": "pr-949",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "The tower reveals its menu from River Citadel",
    "detail": "The title now opens outside an unlit River Citadel: the first activation lights the city, holds for a configurable pause, and fades into the entrance hall before the menu appears; Continue still resumes the saved game. The hall keeps its dark city behind the foreground doorway, a translucent backing keeps the wordmark readable, and the doorway breathes between full and 92% opacity on an eleven-second cycle. Reduced motion disables the idle effect and skips the entrance hold; Ambient Off disables the idle effect too. A Replay entrance control previews the sequence. Physical mobile Safari is untested.",
    "build": "0.6.0.130",
    "pullRequest": 949,
    "url": "https://github.com/cehinds/AshenSpire/pull/949"
  },
  {
    "id": "pr-953",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "The test branch comes back when GitHub deletes it",
    "detail": "The test → release promotion uses test as its pull request head, so the repository's \"Automatically delete head branches\" setting removed test on every promotion merge. A workflow now listens for that deletion and recreates test at release's tip (falling back to dev); nothing in the game changed.",
    "build": "0.6.0.127",
    "pullRequest": 953,
    "url": "https://github.com/cehinds/AshenSpire/pull/953"
  },
  {
    "id": "pr-936",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "Compare equipment in the combat test",
    "detail": "Choose armor, weapon grip, and a Blood Rune before a test route. The preview shows armor, weight, Dodge stamina, grip requirements, weapon impact, and rune-inclusive value. The chosen equipment supplies the real fight's defense and attack properties; incompatible grips and runes explain why they cannot be used. This remains an isolated equipment experiment with fixed resource caps, not production loot or inventory migration.",
    "build": "0.6.0.127",
    "pullRequest": 936,
    "url": "https://github.com/cehinds/AshenSpire/pull/936"
  },
  {
    "id": "pr-938",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "Combatants share clear overhead controls",
    "detail": "Solo and co-op combatants gain Information and larger intent controls with delayed tooltips and aligned sprite framing.",
    "build": "0.6.0.116",
    "pullRequest": 938,
    "url": "https://github.com/cehinds/AshenSpire/pull/938"
  },
  {
    "id": "pr-945",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "Information follows combatant selection",
    "detail": "Combatant Information matches card styling and appears on selection while preserving sprite size, foot positions, and health bars.",
    "build": "0.6.0.119",
    "pullRequest": 945,
    "url": "https://github.com/cehinds/AshenSpire/pull/945"
  },
  {
    "id": "pr-940",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "Ready actions stand out",
    "detail": "End Turn turns green when no affordable playable cards remain. Actions and Potions have larger controls beside compact Draw and Discard buttons. Green confirmations fade in smoothly over 480ms, rise slightly and grow subtly, with reduced-motion support. Hold feedback remains visible without interrupting the color fade. Ready modal confirmations fill their footer while Back and Cancel remain available.",
    "build": "0.6.0.125",
    "pullRequest": 940,
    "url": "https://github.com/cehinds/AshenSpire/pull/940"
  },
  {
    "id": "pr-943",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "Combat draws less, and doors behave the same on every screen",
    "detail": "Fights used to re-request every frame of your outfit's artwork on every beat of every animation — over two hundred picture requests per turn — and kept a document-wide watcher running for tooltips that were not even open. Both are gone, along with a few smaller drains: the hand is redrawn only when a card actually moves, the world atlas no longer hashes itself before the title can paint, fallen enemies stop bobbing, and the shrine lane's glow pulses without repainting the whole map each frame. Modals now share one way out: a tap that opens a door can no longer close it on release, Escape reaches the Load door wherever focus sits, and every door's height is measured against the same safe margins a notched phone needs. On a phone, a tooltip that has nothing to tap inside it no longer swallows the tap beneath it — the starting-equipment row in character creation could not be opened because the seed hint sat on top of it — and the smaller controls (card info buttons, sliders, toggles, the potion Use button, atlas tools) now honour your Minimum tap size. Event choices show their whole consequence instead of trailing off, and the Potions button's word fits its circle.",
    "build": "0.6.0.121",
    "pullRequest": 943,
    "url": "https://github.com/cehinds/AshenSpire/pull/943"
  },
  {
    "id": "pr-939",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "Combat renders lighter on phones, and the standalone ships smaller",
    "detail": "Mobile combat used to recreate its frames, sprites and hand cards on every routine update; unchanged combatant frames, card nodes and their input bindings are now reused, card measurements are batched, and pose preloads share one bounded cache. Auto rendering picks Lite on a coarse pointer: no costly filters or cloned target silhouettes, a coloured target ring instead, enemy state art loaded on demand and faster pacing by default — Full rendering and explicit pacing stay available. The launcher builds the portable standalone and the external-art web edition, and unused equipment-component authoring assets no longer ship, so the standalone is 7.47 MB smaller. This is a DOM-churn measurement, not a physical-device frame rate.",
    "build": "0.6.0.128",
    "pullRequest": 939,
    "url": "https://github.com/cehinds/AshenSpire/pull/939"
  },
  {
    "id": "pr-904",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "Every armament brings a complete combat kit",
    "detail": "Weapons, shields, and staves each lend a Strike, Guard, and signature Art. Shields can attack beside a weapon; Guardian creates an Exhausting Bulwark skill, Bastion trades offense for Block, and Spiked Reprisal combines defence with Bleed. Equipment previews show the actual contributions, and solo/co-op fights retain their ownership and upgrade data.",
    "build": "0.6.0.115",
    "pullRequest": 904,
    "url": "https://github.com/cehinds/AshenSpire/pull/904"
  },
  {
    "id": "pr-931",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "A city spire welcomes each journey",
    "detail": "Replace the startup and main-menu backdrop with a painted medieval city and central tower in muted gold and charcoal. Keep the title centered and readable on phones and larger screens; ship the artwork as compact WebP.",
    "build": "0.6.0.113",
    "pullRequest": 931,
    "url": "https://github.com/cehinds/AshenSpire/pull/931"
  },
  {
    "id": "pr-924",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "Relics open as cards before you take them",
    "detail": "Relic rewards show their card and full effects with Back and Take controls. Owned relics also open a card inspection from the map and combat HUD. Inspected playing cards show complete effect text, with card and details stacked on phones. Valid confirmation buttons turn green; reward Continue turns green after every reward is collected or explicitly skipped.",
    "build": "0.6.0.112",
    "pullRequest": 924,
    "url": "https://github.com/cehinds/AshenSpire/pull/924"
  },
  {
    "id": "pr-929",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "Download the game and move your saves",
    "detail": "Open Download & saves from Title or Settings to choose a release, test, dev, or main HTML build, track download progress, and choose a save location in supported browsers. Export your profile and save slots together, preview imports, and retain a recovery backup before replacing local saves.",
    "build": "0.6.0.119",
    "pullRequest": 929,
    "url": "https://github.com/cehinds/AshenSpire/pull/929"
  },
  {
    "id": "pr-919",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "The game can now be handed over in a light form",
    "detail": "The build has always been one enormous file with every picture packed inside it, which meant a phone downloaded fifty-eight megabytes before it could show anything — and downloaded all of it again on the next visit, because a picture buried in a page cannot be kept by the browser on its own. There is now a second form of the same build that leaves the pictures outside: under five megabytes to start, with art arriving as each screen needs it and staying cached afterwards. The old single file is unchanged and still the one to double-click with no internet; the new one needs to be served, so neither replaces the other. Both are built from one pass over the same artwork, so they cannot come to hold different pictures, and two new checks confirm the light form has every image it will ask for and that it really loads — one of them caught two faults that looked perfectly fine until a browser opened the page.",
    "build": "0.6.0.107",
    "pullRequest": 919,
    "url": "https://github.com/cehinds/AshenSpire/pull/919"
  },
  {
    "id": "pr-891",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "Configurable help across the combat screen",
    "detail": "Hover HUD labels, meters, Block, enemy intent, card costs, and inspector headings for explanations. Accessibility settings control hover visibility and opening/closing delays, with a half-second default. Shared data supplies the choices, timing, and help text; keyboard and explicit inspection remain available with hover off.",
    "build": "0.6.0.102",
    "pullRequest": 891,
    "url": "https://github.com/cehinds/AshenSpire/pull/891"
  },
  {
    "id": "pr-916",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "A phone-shape check stops failing for want of a few seconds",
    "detail": "Nothing a player sees changes. One of the automated checks that opens a browser and confirms the game reaches every control on a phone-sized screen was the first to start that browser, and so paid for waking it up, while being given the least time to do it. On a slow machine it ran out of time and reported that it could not run at all — which is not the same as finding a fault, but stops work merging just as firmly. It now gets the time the later checks already had. It cannot pass anything it would have failed: a check that starts and then finds a fault still reports one.",
    "build": "0.6.0.94",
    "pullRequest": 916,
    "url": "https://github.com/cehinds/AshenSpire/pull/916"
  },
  {
    "id": "pr-905",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "Inspect selected rewards and item choices",
    "detail": "Selected reward cards keep their Information button visible, including after Back restores the choice. Keyboard focus and scrollable card rows retain room for inspection. Smith extraction and installation items, mounts, and deck cards can be inspected without confirming the service, with usable selection panes on phones.",
    "build": "0.6.0.92",
    "pullRequest": 905,
    "url": "https://github.com/cehinds/AshenSpire/pull/905"
  },
  {
    "id": "pr-915",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "Screens build with less stalling on a phone",
    "detail": "Every image in the game now tells the browser it may decode off the main thread. Sixteen places drew pictures without saying so, which meant each one was unpacked in the same instant its screen was being assembled — free on a desktop, and the reason a phone hitched when an armoury or a hand of cards appeared, because a build carries its art inside itself and unpacking is all the work that is left. Two lists that can run longer than a screen — the inventory grid and the smith's stock — also hold their pictures back until they are scrolled near. That second habit is deliberately not applied to combat effects or to map landmarks under fog, where a picture that waits to be looked at may never arrive at all. Three artwork frames that already hid anything spilling past their edges now say so, so a sprite changing frames inside one card no longer makes the gallery around it redraw. Everything here reads from one setting rather than sixteen scattered ones, and can be turned off in a single edit.",
    "build": "0.6.0.89",
    "pullRequest": 915,
    "url": "https://github.com/cehinds/AshenSpire/pull/915"
  },
  {
    "id": "pr-914",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "The receipt chain closes on itself, again",
    "detail": "Nothing a player sees changes. The pull request before this one wrote the receipt that was owed and then owed one itself, which is the seventh time that loop has been walked here — 714, 717, 718, 721, 726, 728 and now 913. What makes this one worth recording rather than merely fixing is that its own description promised to name itself and then did not: the intent was stated, the other receipt was written, and the self-reference was forgotten in the same breath. Knowing the escape is not the same as taking it. This entry and the one below it are written in a single commit, which is the only shape that ends the chain.",
    "build": "0.6.0.86",
    "pullRequest": 914,
    "url": "https://github.com/cehinds/AshenSpire/pull/914"
  },
  {
    "id": "pr-913",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "The receipt #913 owed",
    "detail": "Nothing a player sees changes. It wrote up the receipts pass that preceded it and, being a pull request itself, owed one in turn; this is that one.",
    "build": "0.6.0.86",
    "pullRequest": 913,
    "url": "https://github.com/cehinds/AshenSpire/pull/913"
  },
  {
    "id": "pr-912",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "The receipts pass that names itself",
    "detail": "Nothing a player sees changes. Three merges had landed with no entry here, and the gate that catches exactly that reported all clear — because it measures the span between the test branch and the development branch, and the promotion that followed those merges closed the span before anything looked. A gate that the next legitimate action can silence is not a gate for that window, so this writes the three by hand and records why they were missed. It also adds the game's download weight to the readme, which described every other property of a build except the one a slow connection feels first.",
    "build": "0.6.0.85",
    "pullRequest": 912,
    "url": "https://github.com/cehinds/AshenSpire/pull/912"
  },
  {
    "id": "pr-908",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "The game a phone downloads is a third smaller",
    "detail": "Nothing a player sees changes; how much they wait for it does. The three hundred and twenty-five PNG sprites are re-encoded as WebP, and the single shipped file falls from ninety-three megabytes to fifty-eight. The format was chosen by measurement rather than habit: lossless WebP saved thirty-nine per cent and quality ninety saved seventy-five, and these are painted sprites rather than pixel art, so the second is the honest trade. Every file keeps its name and its pixels; only the container changed. The gate that renders equipment art through the real browser and measures where each piece lands passed fifty of fifty afterwards, which is the check that mattered.",
    "build": "0.6.0.84",
    "pullRequest": 908,
    "url": "https://github.com/cehinds/AshenSpire/pull/908"
  },
  {
    "id": "pr-907",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "A press is not a hold until it has stayed put",
    "detail": "Anything you can drag — a card in your hand, a piece in the Armoury — used to flash the hold ring the instant you touched it, then snatch it away when the drag began. The gesture was right and the feedback was a lie. A press now has to stay still before the ring appears at all, so a drag simply drags and a hold still holds. The wait and the distance are both authored numbers rather than constants in a stylesheet, and a control with nothing to drag under it is untouched: a safety prompt that waits before it looks alive reads as a broken button.",
    "build": "0.6.0.83",
    "pullRequest": 907,
    "url": "https://github.com/cehinds/AshenSpire/pull/907"
  },
  {
    "id": "pr-910",
    "date": "2026-09-10",
    "group": "2026-09-10",
    "summary": "The wordmark was corrected twice, so it ended up off-centre",
    "detail": "The title on the startup screen sat a few pixels right of centre, and the browser gate that measures it had been red for a day. The cause was a correction for a problem the browser had already solved: letter-spacing leaves a gap after the final letter, something was nudging the title right to compensate, and Chromium had already accounted for it. Removing the nudge puts the ink dead centre at every width tested. The alternative fix was measured too, and was no better — which is what proves there was nothing to compensate for.",
    "build": "0.6.0.82",
    "pullRequest": 910,
    "url": "https://github.com/cehinds/AshenSpire/pull/910"
  },
  {
    "id": "pr-900",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Bosses and elites keep their imposing size",
    "detail": "Fit enemy and player sprites together so bosses and elites remain larger across phone, landscape, desktop, and co-op combat layouts.",
    "build": "0.6.0.79",
    "pullRequest": 900,
    "url": "https://github.com/cehinds/AshenSpire/pull/900"
  },
  {
    "id": "pr-897",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Complete armament kits are specified",
    "detail": "Define Strike, Guard, and signature Art for each equipped armament, including shields, with rules for deck ownership, older saves, smithing, and Guardian. This specification does not change the live combat rules yet.",
    "build": "0.6.0.78",
    "pullRequest": 897,
    "url": "https://github.com/cehinds/AshenSpire/pull/897"
  },
  {
    "id": "pr-903",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "The title stays centered on phones",
    "detail": "Keep the divider diamond centered beneath the title at narrow widths, and align the visible wordmark and continue prompt with the subtitle. Portrait, landscape, and desktop layouts share the same center.",
    "build": "0.6.0.81",
    "pullRequest": 903,
    "url": "https://github.com/cehinds/AshenSpire/pull/903"
  },
  {
    "id": "pr-878",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Clearer maps and interactive local locations",
    "detail": "Use consistent large nodes in every run mode, load native detail tiles only for the visible area, retain a small offline fallback, and add an extra manual zoom step. Trace routes with bright outlined ink over engraved unexplored parchment; preserve discovery and travel rules. Pan and zoom local maps with mouse, touch, or keyboard; center selected sites and read actual service benefits before acting.",
    "build": "0.6.0.78",
    "pullRequest": 878,
    "url": "https://github.com/cehinds/AshenSpire/pull/878"
  },
  {
    "id": "pr-893",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Close combat inspections from their footer",
    "detail": "The Close button now dismisses player and enemy inspections with mouse, touch, or keyboard and restores focus through the shared modal behavior.",
    "build": "0.6.0.74",
    "pullRequest": 893,
    "url": "https://github.com/cehinds/AshenSpire/pull/893"
  },
  {
    "id": "pr-885",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Choose a hand and see its starting cards",
    "detail": "Offer Empty Hand in both slots, preview each hand's starting combat cards in a compact grid, and continue explicitly to the next setup section. Focused equipment lifts gently and reveals its action, with reduced-motion support. Larger equipment choices sit in two columns beside their details, with Continue at bottom-right; titles fit vertically, and clipped flavor uses an ellipsis while remaining readable in inspection.",
    "build": "0.6.0.73",
    "pullRequest": 885,
    "url": "https://github.com/cehinds/AshenSpire/pull/885"
  },
  {
    "id": "pr-888",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Inspect every active combat ability",
    "detail": "Click or tap stance and Evade badges to read their effects alongside all active statuses. Evade follows the shared hover timing and explains its charges and expiry. Expand individual explanations with mouse, touch, or keyboard while keeping selected cards safe from accidental play.",
    "build": "0.6.0.69",
    "pullRequest": 888,
    "url": "https://github.com/cehinds/AshenSpire/pull/888"
  },
  {
    "id": "pr-876",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Combat workshop cards inherit tags from their weapon or focus",
    "detail": "Show categorized attack tags and explain which equipment grants them. Weapon techniques use their selected weapon; spells use their own focus. Swaps refresh previews, and each played attack keeps its source through all hits. The new combat rules remain experimental and opt-in.",
    "build": "0.6.0.67",
    "pullRequest": 876,
    "url": "https://github.com/cehinds/AshenSpire/pull/876"
  },
  {
    "id": "pr-882",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Combat effects follow the caster",
    "detail": "Wrap softer weapon and shield effects behind and in front of each pose, and release projectiles from the hand or staff. Keep resource auras and target impacts. Add a saved, default-off played-card animation option and an outfit/layer preview.",
    "build": "0.6.0.66",
    "pullRequest": 882,
    "url": "https://github.com/cehinds/AshenSpire/pull/882"
  },
  {
    "id": "pr-880",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Clearer card inspection and predictable tooltips",
    "detail": "Keep gameplay effects visible once, move supporting classifications beneath cards as tags, and explain keywords on demand. Hover explanations open, switch and close after half a second across cards, equipment, combatants and status effects; touch and keyboard inspection remain available.",
    "build": "0.6.0.65",
    "pullRequest": 880,
    "url": "https://github.com/cehinds/AshenSpire/pull/880"
  },
  {
    "id": "pr-874",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Combat vitality stays steady and mobile maps load less artwork",
    "detail": "Prevent stretched health bars at turn changes, reserve an inspectable status row beneath vitality, shrink map textures, reuse traditional node symbols in World Journey and Long Expedition, and show selected reward cards in green. Connected return travel and reward save recovery remain available.",
    "build": "0.6.0.61",
    "pullRequest": 874,
    "url": "https://github.com/cehinds/AshenSpire/pull/874"
  },
  {
    "id": "pr-872",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Sharper card effect art",
    "detail": "Refresh six-frame blade slashes, physical shield impacts, Starstone bolts and blood slashes in combat and Pose Studio. Keep existing card tags, resource variants and auras, and add an interactive before/after gallery.",
    "build": "0.6.0.60",
    "pullRequest": 872,
    "url": "https://github.com/cehinds/AshenSpire/pull/872"
  },
  {
    "id": "pr-870",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Card flicks choose targets across pointer devices",
    "detail": "Flick upward with touch, mouse, trackpad dragging or pen to play on the nearest legal target without reaching it. Card flick settings and practice now describe the same behavior; saved distance preferences, selection and Information remain available.",
    "build": "0.6.0.58",
    "pullRequest": 870,
    "url": "https://github.com/cehinds/AshenSpire/pull/870"
  },
  {
    "id": "pr-869",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Card flick input parity has an explicit specification",
    "detail": "Specify shared pointer behavior and preserve existing distance, speed and cancellation rules.",
    "build": "0.6.0.57",
    "pullRequest": 869,
    "url": "https://github.com/cehinds/AshenSpire/pull/869"
  },
  {
    "id": "pr-823",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Equipment Information is reachable after one press",
    "detail": "Reveal Information after the first touch selection, reserve room for its button in Inventory and Smith, and prioritize readable mechanics while retaining the approved artwork split. Inspection remains separate from equip, buy, upgrade and play actions.",
    "build": "0.6.0.57",
    "pullRequest": 823,
    "url": "https://github.com/cehinds/AshenSpire/pull/823"
  },
  {
    "id": "pr-826",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Narrow menus stay readable and dialogs support keyboard navigation",
    "detail": "Bound text scaling, wrap descriptions, keep settings categories reachable, and support arrow-key tabs with contained and restored dialog focus.",
    "build": "0.6.0.55",
    "pullRequest": 826,
    "url": "https://github.com/cehinds/AshenSpire/pull/826"
  },
  {
    "id": "pr-836",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Reward cards select once and save safely",
    "detail": "One press selects a card, Confirm collects it, and Back keeps the selection. Failed card saves restore the deck and allow retry without duplicates. Current combat flick controls are preserved.",
    "build": "0.6.0.54",
    "pullRequest": 836,
    "url": "https://github.com/cehinds/AshenSpire/pull/836"
  },
  {
    "id": "pr-867",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Combat controls stay in one row and maps show a cleaner HUD",
    "detail": "Center Actions, Draw, End Turn, Discard/Exhaust and Potions together, with flexible pile widths. Hide the potion and relic strip on maps in both HUD modes while retaining combat inventory controls.",
    "build": "0.6.0.51",
    "pullRequest": 867,
    "url": "https://github.com/cehinds/AshenSpire/pull/867"
  },
  {
    "id": "pr-862",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Combat card text fits beneath clear cost badges",
    "detail": "Scale card text consistently with the face, allow titles to wrap to two lines, and group action, mana and stamina costs above the title. Selection, Information, targeting and touch flicks keep their existing behavior.",
    "build": "0.6.0.48",
    "pullRequest": 862,
    "url": "https://github.com/cehinds/AshenSpire/pull/862"
  },
  {
    "id": "pr-864",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Pose Studio supports direct effect and timeline editing",
    "detail": "Resize effects with visible handles, edit timeline cues directly and use accessible alternatives in the studio.",
    "build": "0.6.0.47",
    "pullRequest": 864,
    "url": "https://github.com/cehinds/AshenSpire/pull/864"
  },
  {
    "id": "pr-832",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Explore World Journey with grounded, stable combat formations",
    "detail": "Explore a seeded atlas with local locations and regional paintings. Combat keeps fixed formations and proportional card fans across turns, with player and enemy turn banners and inactive cards remaining visible during enemy playback.",
    "build": "0.6.0.47",
    "pullRequest": 832,
    "url": "https://github.com/cehinds/AshenSpire/pull/832"
  },
  {
    "id": "pr-820",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "The README and the changelog stop burying what a reader came for",
    "detail": "Nothing a player sees in the game changes; the two files a reader meets first do. The README lost the three separate restatements of the publication rules, the duplicated build-stamp explanation and the second branch table, and is half its length with all sixty-four of its links intact. This file's preamble folds its renumbering, start-date and uncoverable-landing notes into one collapsed block, and the receipts for the last three days are cut to what they say rather than how long they say it. Every one of the 223 receipts, its pull request and its build stamp is unchanged, which is the part that had to be true: the shorter prose is a rewrite of the words, never of the record.",
    "build": "0.6.0.52",
    "pullRequest": 820,
    "url": "https://github.com/cehinds/AshenSpire/pull/820"
  },
  {
    "id": "pr-850",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Combat foundations have a playable test workshop",
    "detail": "Play the real game battlefield or the standalone workshop with heavy physical, fast Bleed and rare-mana builds with configurable damage, armor, weapon impact and retained deterministic Dodge. The workshop is experimental; existing runs keep their current rules.",
    "build": "0.6.0.38",
    "pullRequest": 850,
    "url": "https://github.com/cehinds/AshenSpire/pull/850"
  },
  {
    "id": "pr-859",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Recent deliveries appear in About",
    "detail": "Add the card removal, touch flick, Pose Studio usability and combat specification entries to the in-game changelog before promoting the build to test.",
    "build": "0.6.0.37",
    "pullRequest": 859,
    "url": "https://github.com/cehinds/AshenSpire/pull/859"
  },
  {
    "id": "pr-810",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "The screenreach step leaves the dev preview job",
    "detail": "Nothing a player sees changes, and no gate loses coverage: tools/screenreach.mjs still runs in ci.yml exactly as before. What is withdrawn is the step added to dev-preview hours earlier by the same pass, which had been red on every push to dev and every pull request into it while the rest of that job was green. The measurement behind the withdrawal is that the tool calls a control covered when its geometric centre is hit-tested to something else, and the combat hand is a fan whose cards overlap on purpose — about a third of each card stayed reachable — while the creation view toggle is a header straddling a scroll clip that scrollIntoView reaches. Teaching the gate to judge a usable region rather than one pixel is left as its own change.",
    "build": "0.6.0.37",
    "pullRequest": 810,
    "url": "https://github.com/cehinds/AshenSpire/pull/810"
  },
  {
    "id": "pr-857",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Pose Studio makes authoring controls easier to find",
    "detail": "Start from visible templates, animate before connecting a card, and open editing panels without long scrolling on phones. Preserve field focus, select overlapping effect tracks, and distinguish project downloads from local combat previews.",
    "build": "0.6.0.35",
    "pullRequest": 857,
    "url": "https://github.com/cehinds/AshenSpire/pull/857"
  },
  {
    "id": "pr-856",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Remove basic Strikes and flick cards toward a target",
    "detail": "Basic attack cards appear in removal choices and stay removed through equipment changes and saved fights. Touch flicks choose the nearest valid target while preserving card selection, Information and target highlights. Adjust flick distance in Accessibility and try the practice area.",
    "build": "0.6.0.35",
    "pullRequest": 856,
    "url": "https://github.com/cehinds/AshenSpire/pull/856"
  },
  {
    "id": "pr-844",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Combat foundations have an explicit specification",
    "detail": "Document equipment-based attacks, typed damage, defenses, impact, Evade, trigger ownership and prototype acceptance examples. This specification does not change gameplay or balance.",
    "build": "0.6.0.35",
    "pullRequest": 844,
    "url": "https://github.com/cehinds/AshenSpire/pull/844"
  },
  {
    "id": "pr-839",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "The World Journey atlas is specified",
    "detail": "Nothing a player sees changes yet. A selectable run mode beside the Classic Climb is written down in the spec: one authored square world across five biomes, where the geography and the landmarks are content and a seed picks a connected route through them. Every journey pins a starting city, a major city and a final legacy dungeon; everything else varies, generation is deterministic by seed, profile and content revision, and a saved journey keeps the node and edge IDs it chose rather than regenerating on resume. Undiscovered ground stays indistinct parchment, inspecting a node never travels, and a completed encounter cannot be farmed by walking back to it.",
    "build": "0.6.0.35",
    "pullRequest": 839,
    "url": "https://github.com/cehinds/AshenSpire/pull/839"
  },
  {
    "id": "pr-855",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Record basic-card removal and touch flick rules",
    "detail": "Specify permanent removal of individual basic attack slots, configurable touch flick distance, and nearest-valid-target selection with cancellation safeguards.",
    "build": "0.6.0.33",
    "pullRequest": 855,
    "url": "https://github.com/cehinds/AshenSpire/pull/855"
  },
  {
    "id": "pr-847",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Compose poses and effects in a visual studio",
    "detail": "Drag effects onto pose cues, adjust anchors and layered tracks, test card/tag/payment bindings, and save portable projects. Preview optional authored sequences in combat while preserving existing effects and auras. Add 24 six-frame sets for movement, contact, casting, defense and status feedback.",
    "build": "0.6.0.33",
    "pullRequest": 847,
    "url": "https://github.com/cehinds/AshenSpire/pull/847"
  },
  {
    "id": "pr-852",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Readiness poses ease in and out",
    "detail": "Prepared, Starstone Charge and Herald Blood Rite use softer breathing glows and authored intermediate sprites for all twelve outfits. Entry, exit and action return crossfade smoothly; combat redraws preserve their timing, while reduced-motion and still-sprite modes resolve immediately.",
    "build": "0.6.0.28",
    "pullRequest": 852,
    "url": "https://github.com/cehinds/AshenSpire/pull/852"
  },
  {
    "id": "pr-849",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Readiness pose delivery appears in About",
    "detail": "Record the original readiness-pose delivery and refresh the in-game changelog.",
    "build": "0.6.0.26",
    "pullRequest": 849,
    "url": "https://github.com/cehinds/AshenSpire/pull/849"
  },
  {
    "id": "pr-846",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Readiness poses show when the next move is primed",
    "detail": "Prepared, Starstone Charge and Herald Blood Rite have authored poses across twelve outfits, persistent glows, and correct return behavior after actions. Solo and co-op preserve status ownership and keep extended figures within narrow combat screens.",
    "build": "0.6.0.24",
    "pullRequest": 846,
    "url": "https://github.com/cehinds/AshenSpire/pull/846"
  },
  {
    "id": "pr-841",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Combat animation changes appear in the in-game changelog",
    "detail": "Record the combat effects and enemy animation deliveries at their original build numbers and refresh the changelog shown in About.",
    "build": "0.6.0.21",
    "pullRequest": 841,
    "url": "https://github.com/cehinds/AshenSpire/pull/841"
  },
  {
    "id": "pr-835",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Combat effects follow the card and its payment",
    "detail": "Play 56 six-frame effect sets for attacks, projectiles, guards, wards, barriers, stances and status reactions in solo and co-op. Low-action moves use subtle mundane effects; larger action payments use stronger mundane effects, while mana or stamina spending enables fantastical variants. Preserve character auras and honor Reduce flashes.",
    "build": "0.6.0.20",
    "pullRequest": 835,
    "url": "https://github.com/cehinds/AshenSpire/pull/835"
  },
  {
    "id": "pr-833",
    "date": "2026-09-09",
    "group": "2026-09-09",
    "summary": "Combatants show hurt, guard and defeat",
    "detail": "Painted enemies show hurt, guarded and buff poses, including co-op actions and guarded impacts. Direct damage and status bursts show hurt feedback, and defeated player artwork stays within narrow combat screens.",
    "build": "0.6.0.15",
    "pullRequest": 833,
    "url": "https://github.com/cehinds/AshenSpire/pull/833"
  },
  {
    "id": "pr-830",
    "date": "2026-09-08",
    "group": "2026-09-08",
    "summary": "Card holds visibly fill before playing",
    "detail": "Show a gold striped progress bar above the card face using the existing hold timer; clear it immediately on release or cancellation. Preserve the selection and targeting behavior already shipped by #822.",
    "build": "0.6.0.14",
    "pullRequest": 830,
    "url": "https://github.com/cehinds/AshenSpire/pull/830"
  },
  {
    "id": "pr-822",
    "date": "2026-09-08",
    "group": "2026-09-08",
    "summary": "Smaller combatants on mobile",
    "detail": "Combatant artwork is 10% smaller on mobile, with slight enemy artwork overlap allowed. Selected cards reveal a circular information button above the face. The cleaner inspection modal offers Play card when available and explains disabled actions. Holding a combat card fills it to use instead of zooming in; releasing early cancels. Selecting a card immediately lights its valid living targets with an artwork-shaped glow.",
    "build": "0.6.0.13",
    "pullRequest": 822,
    "url": "https://github.com/cehinds/AshenSpire/pull/822"
  },
  {
    "id": "pr-819",
    "date": "2026-09-08",
    "group": "2026-09-08",
    "summary": "Mobile cards select before playing, and detail names stay readable",
    "detail": "Keep the selected card in its fan position; confirm with the shared hold, a double-tap after selection, or a valid target tap/drop. Preserve the drag grip and cancel invalid drops. Show item-specific creation details and full modal titles, center title ornaments, track the visible viewport, and recover interrupted audio without restarting music on volume changes.",
    "build": "0.6.0.9",
    "pullRequest": 819,
    "url": "https://github.com/cehinds/AshenSpire/pull/819"
  },
  {
    "id": "pr-815",
    "date": "2026-09-08",
    "group": "2026-09-08",
    "summary": "Development builds move to the 0.6 series",
    "detail": "Nothing a player sees changes. The candidate the CI and Pages builds carry advances from 0.5.5 to 0.6.0, so the build ordinal restarts at zero the way the versioning rule says it does — a dev badge reading 2 beside a main badge reading in the thousands is that restart, not a regression. A new gate refuses any current build whose stamp is not 0.6.x.<ordinal> and whose committed metadata disagrees with the source, and it is kept out of the Pages builds workflow, which rebuilds archived branches that legitimately still carry their own older series.",
    "build": "0.6.0.1",
    "pullRequest": 815,
    "url": "https://github.com/cehinds/AshenSpire/pull/815"
  },
  {
    "id": "pr-809",
    "date": "2026-09-08",
    "group": "2026-09-08",
    "summary": "Card-driven information and starting equipment selection",
    "detail": "Weapon faces keep their 5:7 shape with a 60:40 art-to-text split, so smaller cards still carry complete readable details. Reading a card stays separate from buying, equipping, upgrading and playing; Starting Equipment previews first and commits only through Choose.",
    "build": "0.5.5.137",
    "pullRequest": 809,
    "url": "https://github.com/cehinds/AshenSpire/pull/809"
  },
  {
    "id": "pr-811",
    "date": "2026-09-08",
    "group": "2026-09-08",
    "summary": "Compact encounters without horizontal scrollbars",
    "detail": "Up to three enemies fit beside the player in tighter columns, and hands of up to seven cards overlap to fit the viewport while keeping 150–180px faces and hold-to-inspect.",
    "build": "0.5.5.134",
    "pullRequest": 811,
    "url": "https://github.com/cehinds/AshenSpire/pull/811"
  },
  {
    "id": "pr-808",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Readable cards and larger combatants",
    "detail": "Cards stay 150–180 viewport pixels wide with readable body text; sprites grow into the free battlefield space while preserving HUD and intent clearance. Crowded phone battlefields scroll sideways, short screens scroll vertically, and holding a card still inspects without playing it.",
    "build": "0.5.5.131",
    "pullRequest": 808,
    "url": "https://github.com/cehinds/AshenSpire/pull/808"
  },
  {
    "id": "pr-806",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Playing cards share the item-card motif",
    "detail": "Combat, reward and deck cards gain the warm brown backing, inset gold frame, framed art and type bands. Costs, live card text, hand layout and play interactions are unchanged.",
    "build": "0.5.5.129",
    "pullRequest": 806,
    "url": "https://github.com/cehinds/AshenSpire/pull/806"
  },
  {
    "id": "pr-801",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Every weapon gets a card preview",
    "detail": "A searchable gallery shows every weapon, shield and staff on the same painted poker cards the game uses, and reward, merchant and buy/sell inspection now share them — prices, smithing tiers and mounted-card details intact. Cards are 20% smaller in uniform grids, hold progress stays visible over artwork, and potion and relic cards share the frame.",
    "build": "0.5.5.128",
    "pullRequest": 801,
    "url": "https://github.com/cehinds/AshenSpire/pull/801"
  },
  {
    "id": "pr-790",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Tooltips prefer above without covering controls in short windows",
    "detail": "Shared tooltips try above first, stay sideways when a landscape window lacks vertical room, and fall below when needed. Authored top and side placement bands still apply.",
    "build": "0.5.5.127",
    "pullRequest": 790,
    "url": "https://github.com/cehinds/AshenSpire/pull/790"
  },
  {
    "id": "pr-793",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Painted techniques, and a glow that follows the figure",
    "detail": "Combat techniques get their own painted art, and a fighter's aura is drawn to the shape of the figure rather than a box around it, so the light follows the silhouette.",
    "build": "0.5.5.125",
    "pullRequest": 793,
    "url": "https://github.com/cehinds/AshenSpire/pull/793"
  },
  {
    "id": "pr-791",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "What the combat animations and auras are supposed to do, written down",
    "detail": "Nothing a player sees changes. The approved behaviour for the combat animation path and its auras is recorded, so the next change has something to be measured against.",
    "build": "0.5.5.118",
    "pullRequest": 791,
    "url": "https://github.com/cehinds/AshenSpire/pull/791"
  },
  {
    "id": "pr-792",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "The receipts catch up on three merges",
    "detail": "Nothing a player sees changes. The painted armaments (#778), the Star Seer's standing idle (#780) and the Armoury heading fix (#768) had landed with no entry here, so the in-game changelog missed them too; each is written up at the ordinal standing at its own merge. The gate added in #652 named the three, not a person reading the merge log.",
    "build": "0.5.5.124",
    "pullRequest": 792,
    "url": "https://github.com/cehinds/AshenSpire/pull/792"
  },
  {
    "id": "pr-768",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "The Armoury's card headings stay inside their own borders",
    "detail": "On a narrow screen the Equipment cards summary could spill below its bordered heading — the shared read-only row style let the text wrap while the heading kept a fixed height. Headings now put the label above the summary and grow to hold both, with a 15px text floor. The narrow Hybrid equipment pane has a separate clipping problem this does not touch.",
    "build": "0.5.5.118",
    "pullRequest": 768,
    "url": "https://github.com/cehinds/AshenSpire/pull/768"
  },
  {
    "id": "pr-780",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "The Star Seer stands with the staff",
    "detail": "The Star Seer's resting combat pose is the standing staff figure, across the base class and all three armour sets.",
    "build": "0.5.5.117",
    "pullRequest": 780,
    "url": "https://github.com/cehinds/AshenSpire/pull/780"
  },
  {
    "id": "pr-778",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "All twenty-five armaments are painted",
    "detail": "Every weapon and shield has its own painted item art, and the Armoury cards were refreshed so the silhouette reads against the well it sits in. Reference sheets are kept beside the art; the single-file download grows, because these inline like every other asset.",
    "build": "0.5.5.116",
    "pullRequest": 778,
    "url": "https://github.com/cehinds/AshenSpire/pull/778"
  },
  {
    "id": "pr-779",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Armoury navigation is simpler and menu cancellation is reliable",
    "detail": "Character, Equipment, Inventory and Cards get dedicated tabs instead of supporting trays; Stats stay with Character and the deck uses large separate faces that stay readable on phones. Change shows compatible inventory with a clear way back to all items, resizing no longer closes what you are reading, and Smith cancellation closes only the topmost dialog.",
    "build": "0.5.5.120",
    "pullRequest": 779,
    "url": "https://github.com/cehinds/AshenSpire/pull/779"
  },
  {
    "id": "pr-787",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Equipment as painted poker cards",
    "detail": "Inventory and equipment inspection use the gold-bordered 5:7 design with canonical facts and painted artwork. Hover or focus a field for its explanation, or read all details on touch; equip, compare and combat behaviour are preserved.",
    "build": "0.5.5.125",
    "pullRequest": 787,
    "url": "https://github.com/cehinds/AshenSpire/pull/787"
  },
  {
    "id": "pr-771",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Two receipts, named in the same pass that writes them",
    "detail": "Nothing a player sees changes. The classic-figure sigil fix (#769) and the enemy-sprite background note (#767) had merged with no receipt, so the in-game changelog missed them and the promotion gate was red. Both are written up below, and this receipt names its own pull request in the same commit — the habit that stops a receipts pass owing a receipt of its own.",
    "build": "0.5.5.112",
    "pullRequest": 771,
    "url": "https://github.com/cehinds/AshenSpire/pull/771"
  },
  {
    "id": "pr-769",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "The sigil comes off the classic figure too",
    "detail": "#764 removed the sigil overlay but missed the other route: the Classic sprite style, and any figure falling back to the inline drawing, still painted the sigil onto the chest as part of the silhouette. It now draws the plain accent it wore before sigils existed. The guard could not have caught it — it looked only for the overlay — and now reads both ways a sigil can arrive.",
    "build": "0.5.5.111",
    "pullRequest": 769,
    "url": "https://github.com/cehinds/AshenSpire/pull/769"
  },
  {
    "id": "pr-767",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "The enemy sprite background exception is written down",
    "detail": "Nothing a player sees changes. The source backgrounds behind enemy sprites follow a rule the tooling never stated, so the exception is recorded where the next person cutting a sprite will find it.",
    "build": "0.5.5.110",
    "pullRequest": 767,
    "url": "https://github.com/cehinds/AshenSpire/pull/767"
  },
  {
    "id": "pr-764",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Sigils stay beside class information",
    "detail": "Painted character figures no longer carry the sigil overlay added in the earlier build. The sigil remains in the class picker.",
    "build": "0.5.5.109",
    "pullRequest": 764,
    "url": "https://github.com/cehinds/AshenSpire/pull/764"
  },
  {
    "id": "pr-758",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Enemy attacks face the target and have more impact",
    "detail": "The Stitched King looks toward the player during his attack, and enemy attack frames are five percent larger than idle frames while keeping their shared foot line fixed.",
    "build": "0.5.5.110",
    "pullRequest": 758,
    "url": "https://github.com/cehinds/AshenSpire/pull/758"
  },
  {
    "id": "pr-755",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Damaging spells show the enemy attack frame",
    "detail": "Enemy spells keep their casting motion while showing their attack artwork, then return to idle when the animation finishes or is cancelled.",
    "build": "0.5.5.108",
    "pullRequest": 755,
    "url": "https://github.com/cehinds/AshenSpire/pull/755"
  },
  {
    "id": "pr-752",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Chosen sigils appear on painted figures",
    "detail": "The chosen sigil is visible during character creation and combat. Character-creation checks follow the current folded sections, incomplete allocations use a valid preview, and the sprite-cutting guard refuses incompatible metadata before overwriting art.",
    "build": "0.5.5.107",
    "pullRequest": 752,
    "url": "https://github.com/cehinds/AshenSpire/pull/752"
  },
  {
    "id": "pr-761",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Upgrade and armor choices use standard card sizes",
    "detail": "Armor artwork fits inside the cards without cropping, and Shrine actions share a consistent height with flask allocation expanding below its header.",
    "build": "0.5.5.106",
    "pullRequest": 761,
    "url": "https://github.com/cehinds/AshenSpire/pull/761"
  },
  {
    "id": "pr-751",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Assign Points stays responsive on the final point",
    "detail": "The character preview reads the current allocation instead of a stale cached draft, so spending or refunding points keeps updating the controls even when a weapon requirement is unmet.",
    "build": "0.5.5.105",
    "pullRequest": 751,
    "url": "https://github.com/cehinds/AshenSpire/pull/751"
  },
  {
    "id": "pr-757",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Your figure holds the weapon and shield you gave it again",
    "detail": "In the Armoury the figure had stopped showing its armament: the function that stacks held pieces over the body returned a single standing frame before building any of them. Found by the release promotion's browser gate — all twenty-five armaments, both hands, measured at the identical position, because fifty readings that agree to the pixel are not a weapon on the wrong side but no weapon at all. The short-circuit was also unreachable in the case it was written for, and in the case it did reach it only overruled the sprite style you chose. The painted preview is untouched.",
    "build": "0.5.5.103",
    "pullRequest": 757,
    "url": "https://github.com/cehinds/AshenSpire/pull/757"
  },
  {
    "id": "pr-749",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Three receipts, and the pass names itself this time",
    "detail": "Nothing a player sees changes. The Shrine level-up modal (#746) and the point-pool bound (#732) had landed with no receipt, so the in-game changelog missed them and the promotion gate was red. Both are written up below, and this receipt names its own pull request in the same commit — one pull request, three receipts, no chain.",
    "build": "0.5.5.101",
    "pullRequest": 749,
    "url": "https://github.com/cehinds/AshenSpire/pull/749"
  },
  {
    "id": "pr-746",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Levelling at a Shrine uses the same points panel as everywhere else",
    "detail": "Level up at a Shrine opens the shared stat-allocation panel instead of unfolding stats in place, so it reads the same as spending points at creation. A pending purchase shows its cinder cost and your remaining balance before you commit; Cancel and Escape discard it, Confirm applies it. Keyboard and pad focus survive each adjustment.",
    "build": "0.5.5.94",
    "pullRequest": 746,
    "url": "https://github.com/cehinds/AshenSpire/pull/746"
  },
  {
    "id": "pr-732",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "The point pool cannot be pushed below zero, and its gate runs again",
    "detail": "Assign Points refused to complete when a stat had been raised past the points you held, saying \"1 stat point over the pool\" and leaving you to find it. The bound is now enforced where the change happens, so a stat cannot cross the mode's floor or ceiling or spend a point the pool does not hold. The character-creation gate had been dying at its first step since #692 moved the sprite and sigil group, so none of its assertions had run in weeks; its selectors follow the move. Two findings are recorded rather than quietly fixed: once the pool has been at zero and a point is freed, the + controls report themselves enabled and spend nothing; and two card-structure failures from the #690 era were unreachable while the gate was dead.",
    "build": "0.5.5.93",
    "pullRequest": 732,
    "url": "https://github.com/cehinds/AshenSpire/pull/732"
  },
  {
    "id": "pr-743",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Character artwork uses the right pose on each screen",
    "detail": "Class selection uses bottom-aligned close-up portraits with the colored class icons restored; customization uses detail poses; armor choices, armoury figures, smithing and mounting use the full-body menu pose for every outfit.",
    "build": "0.5.5.92",
    "pullRequest": 743,
    "url": "https://github.com/cehinds/AshenSpire/pull/743"
  },
  {
    "id": "pr-740",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Painted outfits now appear throughout the game",
    "detail": "All sixteen outfits have matching selection portraits, menu figures, armoury previews and compact combat animations, with Reaver using the reviewed sword-rest stance, advance, overhead windup, cleave and recovery. Classic and Sigil remain available; painted weapons are part of the artwork, while icons and stats still describe the actual loadout.",
    "build": "0.5.5.87",
    "pullRequest": 740,
    "url": "https://github.com/cehinds/AshenSpire/pull/740"
  },
  {
    "id": "pr-735",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Reaver artwork follows the selected poses",
    "detail": "All four Reaver outfits share the approved sword-rest menu and idle stance, the three selected attack poses and matching chest-up portraits. This records the artwork revision; game integration follows in #740.",
    "build": "0.5.5.78",
    "pullRequest": 735,
    "url": "https://github.com/cehinds/AshenSpire/pull/735"
  },
  {
    "id": "pr-741",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Cards and figures keep their proportions",
    "detail": "Combat cards hold a 5:7 profile at any width, preview cards a 3:4 silhouette, and Armoury sprites fit both dimensions without stretching. Pile viewers use larger cards with readable text and spaced rows on phones. Read-only modal and tooltip labels grow from 10% to 30% before truncating, and descriptions wrap instead of being cut off; intent symbols, combatant tooltips and HUD text keep readable minimums on narrow screens.",
    "build": "0.5.5.100",
    "pullRequest": 741,
    "url": "https://github.com/cehinds/AshenSpire/pull/741"
  },
  {
    "id": "pr-720",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "A readable combat fan and compact inspection",
    "detail": "Narrower, shorter cards keep their text size; five to seven fan above the five-slot HUD with costs exposed along their left edges. Inspect lives only in the hover panel as a compact full-width action, panels stay open while entered, and closing restores focus. Potion rows show artwork and unfold inline in the Armoury detail-card style, and selecting a potion never consumes it. Character creation uses attached foldout cards with readable text and folded equipment summaries; Actions and Potions are equal circles matching the End Turn height.",
    "build": "0.5.5.82",
    "pullRequest": 720,
    "url": "https://github.com/cehinds/AshenSpire/pull/720"
  },
  {
    "id": "pr-733",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Cracked Tear makes your flasks stronger on the map too",
    "detail": "The relic promises every flask is half again as strong, and in a fight it was — but a flask drunk on the map restored its plain amount, so the Azure gave one Mana where it owed two and the Crimson healed fifteen where it owed twenty-three. The map now scales the same way combat did, rounded up; a run without the relic is unchanged. Found by automated review of the promotion, not by playing: the amounts were plausible on their own and only wrong next to the promise.",
    "build": "0.5.5.76",
    "pullRequest": 733,
    "url": "https://github.com/cehinds/AshenSpire/pull/733"
  },
  {
    "id": "pr-728",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Every class gets one page showing all of its painted outfits",
    "detail": "Each class gets a single review page carrying its four outfits, menu and detail poses, close-up portraits, compact combat poses and the earlier source sheets. The Reaver and the Duelist were facing the wrong way when inspected; both are corrected. This is an artwork and preview package — it does not replace runtime assets or reach character creation and the Armoury.",
    "build": "0.5.5.73",
    "pullRequest": 728,
    "url": "https://github.com/cehinds/AshenSpire/pull/728"
  },
  {
    "id": "pr-726",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "The branch histories are rejoined",
    "detail": "Nothing a player sees changes. test had stopped being only a promotion target — seven pull requests landed on it directly — so it diverged from dev and a promotion could not merge at all. This rejoins them, keeping both receipts 711 and 712 for what is one change on two branches. It also pays two debts left by the action-row fix: its own receipt, and a standalone build left stale because the launch script does not write build/ — the bundler does, and only the bundler.",
    "build": "0.5.5.73",
    "pullRequest": 726,
    "url": "https://github.com/cehinds/AshenSpire/pull/726"
  },
  {
    "id": "pr-730",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "A receipts pass that names itself",
    "detail": "Nothing a player sees changes. The entry above was owed by a pull request that, being one itself, owed one in turn; this is that one, and it names its own number so the debt does not pass to a third. The escape is always the same: open the pull request first, because a receipt cannot name a number that does not yet exist.",
    "build": "0.5.5.73",
    "pullRequest": 730,
    "url": "https://github.com/cehinds/AshenSpire/pull/730"
  },
  {
    "id": "pr-721",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Hand cards no longer come to rest on Draw and End Turn",
    "detail": "On a desktop-shaped window the lowest cards overlapped the buttons beneath them at every text size — the defect #713's repaired gate found. The cause was one number: the band reserved under the hand is measured for the row's tallest cell, and #679 grew that row from four controls to six with a 44px minimum tap height without re-measuring. It is re-measured with room to spare. Two of the gate's plants were pinned to the old number and are re-pointed or re-anchored so a future re-measure cannot disarm them.",
    "build": "0.5.5.71",
    "pullRequest": 721,
    "url": "https://github.com/cehinds/AshenSpire/pull/721"
  },
  {
    "id": "pr-722",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Three checks that had stopped checking anything check again",
    "detail": "Nothing a player sees changes. Two component contracts and the changelog projector had gone red on dev, none for a real fault: each was pinned to the exact wording of a line a later deliberate change had moved. They now check what the lines have to mean rather than how they are spelled — the same repair #645 made in August. The projector also refused one receipt with a link buried in its prose; flattening it revealed the link was standing in for a missing receipt, so that one is written up properly too.",
    "build": "0.5.5.70",
    "pullRequest": 722,
    "url": "https://github.com/cehinds/AshenSpire/pull/722"
  },
  {
    "id": "pr-717",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "The receipt #714 was owed",
    "detail": "Nothing a player sees changes. #714 wrote up eight merges that had no entry here and, being a pull request itself, owed one in turn; this is that one, written separately because until now it was only ever named inside another receipt's prose.",
    "build": "0.5.5.66",
    "pullRequest": 717,
    "url": "https://github.com/cehinds/AshenSpire/pull/717"
  },
  {
    "id": "pr-718",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "The receipt chain closes on itself",
    "detail": "Nothing a player sees changes. Splitting the backfill across two pull requests bought a regress: #714 wrote the eight that were owed and then owed one itself, #717 wrote #714's and then owed one itself. This receipt names its own pull request and records #717 in the same line, which is the only way the loop ends. The lesson is written down rather than repeated: a receipts pass names itself in the same commit that writes the others.",
    "build": "0.5.5.67",
    "pullRequest": 718,
    "url": "https://github.com/cehinds/AshenSpire/pull/718"
  },
  {
    "id": "pr-714",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Eight merges get the receipts they owed",
    "detail": "Nothing a player sees changes. Eight pull requests — #686, #690, #692, #694, #697, #698, #706 and #713 — had landed on dev with no receipt, so the in-game changelog carried none of them and the promotion gate was red. All eight are written up below at the build standing at their own merge. Two say something a summary would round off: #698's records that none of its own code was applied, and #713's records the defect its repaired gate found — hand cards overlapping Draw and End Turn at 1200x730 — which is still open.",
    "build": "0.5.5.66",
    "pullRequest": 714,
    "url": "https://github.com/cehinds/AshenSpire/pull/714"
  },
  {
    "id": "pr-698",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "The armour you wear keeps its own painted figure in a fight",
    "detail": "Nothing a player sees changes, and that is the point. This set out to stop an alternative armour set being erased from the animated combat figure, but the game had already closed that gap by better means: each set draws its own authored pose sheet, one of the twelve shipped as 561 painted frames. The change offered instead was a CSS animation over the layered composite with no art behind it, so none of it was applied. What the shipped path still gives up is stated in the code rather than hidden: the armour-set palette and the held weapon do not ride on the fighter.",
    "build": "0.5.5.64",
    "pullRequest": 698,
    "url": "https://github.com/cehinds/AshenSpire/pull/698"
  },
  {
    "id": "pr-694",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Assign Points refunds to a baseline, and its rows keep one even inset",
    "detail": "Opening Assign Points returns every stat to the mode's baseline and hands the whole pool back, instead of resuming the allocation you left. The save-slot chooser is rebuilt on the shared kit, and a setting row carries the same padding on all four sides rather than shaving the horizontal edge.",
    "build": "0.5.5.63",
    "pullRequest": 694,
    "url": "https://github.com/cehinds/AshenSpire/pull/694"
  },
  {
    "id": "pr-713",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "The bottom row's six controls are checked by what they are, not by name",
    "detail": "Nothing a player sees changes here, but something a player can see is now known to be wrong. #679 merged the two spent piles and added Arts and Potions; the gate still listed the old names, so the two new controls were invisible to it. Controls are now identified by what they are rather than by a whitelist. The working gate immediately found a real defect: hand cards overlap Draw and End Turn at 1200x730 at every text size. Recorded, not fixed here.",
    "build": "0.5.5.63",
    "pullRequest": 713,
    "url": "https://github.com/cehinds/AshenSpire/pull/713"
  },
  {
    "id": "pr-697",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Assign Points starts from the baseline, and setting rows share one inset",
    "detail": "Reopening Assign Points seats every attribute at the mode's baseline rather than resuming a half-spent allocation, and the shared setting row keeps one equal inset on all four sides.",
    "build": "0.5.5.61",
    "pullRequest": 697,
    "url": "https://github.com/cehinds/AshenSpire/pull/697"
  },
  {
    "id": "pr-706",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "A disabled potion slot is disabled, not merely labelled so",
    "detail": "Nothing a player sees changes. An empty potion control is now natively disabled instead of only carrying aria-disabled, which announced unavailability while still letting the cursor, the keyboard and a programmatic click select it.",
    "build": "0.5.5.59",
    "pullRequest": 706,
    "url": "https://github.com/cehinds/AshenSpire/pull/706"
  },
  {
    "id": "pr-692",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Character creation opens on a neutral allocation",
    "detail": "Point-buy creation seats every attribute at the mode's baseline, and the preview is built from the last complete allocation until all ten points are spent — so a half-finished draft never reaches the validator only a finished one can pass.",
    "build": "0.5.5.58",
    "pullRequest": 692,
    "url": "https://github.com/cehinds/AshenSpire/pull/692"
  },
  {
    "id": "pr-690",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Every primary stat is its own card, and it keeps its own explanation",
    "detail": "The five primary stats are self-contained cards whose summary and detail are one piece, matching the Armoury's card grammar, so a stat's explanation opens under that stat and only one is open at a time. The Intelligence row inside Assign Points no longer wraps to a second line and stands 1.44px taller than the other four, which had kept that gate red since #647.",
    "build": "0.5.5.57",
    "pullRequest": 690,
    "url": "https://github.com/cehinds/AshenSpire/pull/690"
  },
  {
    "id": "pr-686",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Crimson and Azure can be drunk outside a fight, if you ask for it",
    "detail": "A Settings switch, off by default, lets the healing and mana flasks be used on the map; with it off they say so rather than silently refusing. Both now sit in the potion belt beside the carried flasks, leaving Armoury and Menu the only two Quick Access controls and letting them take the full height of the meter stack.",
    "build": "0.5.5.56",
    "pullRequest": 686,
    "url": "https://github.com/cehinds/AshenSpire/pull/686"
  },
  {
    "id": "pr-711",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Saved boss destinations follow current content safely",
    "detail": "Loading validates the original boss behind legacy maps and refuses missing or invalid encounters before play. Named destinations refresh when enemies are renamed or encounter composition changes, preserving paths, selected encounters and RNG state in solo and LAN saves.",
    "build": "0.5.5.60",
    "pullRequest": 711,
    "url": "https://github.com/cehinds/AshenSpire/pull/711"
  },
  {
    "id": "pr-712",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Saved boss destinations follow current content safely",
    "detail": "The same fix as #711, applied on the other branch.",
    "build": "0.5.5.57",
    "pullRequest": 712,
    "url": "https://github.com/cehinds/AshenSpire/pull/712"
  },
  {
    "id": "pr-704",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "More enemies, named boss routes and readable combat actions",
    "detail": "Seven new regular enemies and seven new bosses bring the roster to twenty regular enemies, three elites and ten bosses, with fourteen transparent painted portraits for the new moves and phases. Boss routes name their locations, enemy inspectors share move cards, and card actions gain actor- and tag-based motion plus draw/play/pile feedback. Reduced motion and skipped animations keep readable outcomes.",
    "build": "0.5.5.55",
    "pullRequest": 704,
    "url": "https://github.com/cehinds/AshenSpire/pull/704"
  },
  {
    "id": "pr-689",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Maps preserve distinct boss destinations",
    "detail": "Acts with multiple boss encounters assign named terminal choices beyond their guaranteed rest, and each destination keeps its encounter through saves, LAN play and simulations. Compact placement keeps the choices visible on phones; invalid saved references are rejected at load, and older maps retain their original boss without rerolling.",
    "build": "0.5.5.52",
    "pullRequest": 689,
    "url": "https://github.com/cehinds/AshenSpire/pull/689"
  },
  {
    "id": "pr-703",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "The changelog keeps itself honest",
    "detail": "Nothing a player sees changes. #700's receipt is written up below and the in-game changelog was regenerated to match. This is the second merge running that the repository asked for its own receipt instead of waiting for someone to read the merge log.",
    "build": "0.5.5.50",
    "pullRequest": 703,
    "url": "https://github.com/cehinds/AshenSpire/pull/703"
  },
  {
    "id": "pr-700",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Animated is the figure you get, everywhere a figure is made",
    "detail": "Animated pose sheets are the default sprite style everywhere a character is created, not just at character creation — a locally added co-op seat, a LAN lobby with no remembered choice, and the fallback any surface reaches when a profile carries no style. A save that recorded Rendered, Classic or Sigil keeps it, and a class with no shipped frames falls through to its painting.",
    "build": "0.5.5.48",
    "pullRequest": 700,
    "url": "https://github.com/cehinds/AshenSpire/pull/700"
  },
  {
    "id": "pr-701",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "The receipts catch up, and the gate that asks for them did the asking",
    "detail": "Nothing a player sees changes. #695 landed without an entry here, and for the first time nobody had to notice: the check added in #652 went red on dev the moment it merged, naming the pull request it wanted.",
    "build": "0.5.5.49",
    "pullRequest": 701,
    "url": "https://github.com/cehinds/AshenSpire/pull/701"
  },
  {
    "id": "pr-695",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "The five stat rows in Assign Points line up again",
    "detail": "On a phone the Intelligence row stood a hair taller than the other four: its hint — the longest of the five — ran onto a second line in an overlay narrower than the column it was written for. The five read as one block again, the long hint trailing off with an ellipsis as the same rows already do in the Armoury. Character Creation is untouched and still shows the sentence in full.",
    "build": "0.5.5.48",
    "pullRequest": 695,
    "url": "https://github.com/cehinds/AshenSpire/pull/695"
  },
  {
    "id": "pr-683",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Twelve enemies gain their painted Unity-fork sprites",
    "detail": "Combat reuses the existing transparent artwork with consistent foot alignment and left-facing figures. Other enemies keep their current art, and a failed painted-image load falls back to the original sprite.",
    "build": "0.5.5.47",
    "pullRequest": 683,
    "url": "https://github.com/cehinds/AshenSpire/pull/683"
  },
  {
    "id": "pr-672",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Dodge explains its outcome",
    "detail": "Dodge resolves correctly in the standalone build after removing a circular engine import that interrupted the action after payment. A resolved Dodge leaves a result button beside the player: open it for the roll, check, difficulty and base guard. Failed rolls are visible, and the explanation survives skipped or reduced animations.",
    "build": "0.5.5.44",
    "pullRequest": 672,
    "url": "https://github.com/cehinds/AshenSpire/pull/672"
  },
  {
    "id": "pr-676",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Traders buy and sell armaments and stock weapon arts",
    "detail": "Inspect equipment before buying, sell unequipped items from storage, and buy Draw Cut or Sundering Hew for the existing mounting system. Equipped items explain their sale restriction, cancelled or stale quotes spend nothing, and upgrades, mount history and discoveries survive a sale and reacquisition.",
    "build": "0.5.5.45",
    "pullRequest": 676,
    "url": "https://github.com/cehinds/AshenSpire/pull/676"
  },
  {
    "id": "pr-679",
    "date": "2026-09-07",
    "group": "2026-09-07",
    "summary": "Combat groups potions, piles and weapon arts into shared menus",
    "detail": "Potions stays at the far right with quantities and explicit Use actions. Discard and Exhaust share an entry but keep separate tabs and counts, Arts shows equipped cards and selects only cards in hand, and map Quick Access controls use full-size targets.",
    "build": "0.5.5.46",
    "pullRequest": 679,
    "url": "https://github.com/cehinds/AshenSpire/pull/679"
  },
  {
    "id": "pr-664",
    "date": "2026-09-06",
    "group": "2026-09-06",
    "summary": "Assign Points starts with ten points to spend, and text keeps its inset",
    "detail": "Opening or reopening Assign Points refunds every attribute to 10 and puts all 10 points back in the pool, rather than reopening on the class's already-spent suggestion. The five stat cards and shared setting rows use balanced padding on every side, including narrow phone layouts, so labels no longer run against their component or modal edges.",
    "build": "0.5.5.40",
    "pullRequest": 664,
    "url": "https://github.com/cehinds/AshenSpire/pull/664"
  },
  {
    "id": "pr-657",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "A section opens under the row you tapped, not at the bottom of the screen",
    "detail": "In character creation, tapping CLASS opened the class chooser at the foot of the page — below CHARACTER, STARTING EQUIP and SEED — as though the last row had been tapped, and the same for the character and equipment rows and for the pickers nested inside them. Each panel now opens directly beneath its own row. Two things were wrong, and only one of them was in the code that places the panel. The panel is placed between the rows, so it can only land under the row you tapped if the rows are on separate lines — and the component-kit sweep of 2026-09-04 left a stylesheet rule that put all four creation rows on a single line, which leaves exactly one place to put it: after all of them. The second is that the pickers inside CHARACTER and STARTING EQUIPMENT are built while their section is hidden, where every measurement a browser can give reads zero, so they placed themselves blind and stayed where they landed; they now re-measure the moment their section is back on the glass. Driven with real clicks in a browser at 1200x730 and 390x844: every fold — the four sections, the character rows, the sprite rows nested inside those, and the equipment rows across a class change — opens immediately under its own row, one of the container's own row-gaps below it. The merchant's bars and the custom climb's shape fold, which the same renderer draws, read the same, and the Armoury's cards are untouched. Stated rather than buried: the instrument written to catch exactly this defect no longer runs at all. tools/creationbrief.mjs asks, as its seventh question, whether the panel opens under the face that was tapped; it waits on a part of the creation screen that has since been renamed, times out before asserting anything, and is not wired into CI — so nothing went red while this shipped. Repairing it is its own piece of work and is not attempted here.",
    "build": "0.5.5.32",
    "pullRequest": 657,
    "url": "https://github.com/cehinds/AshenSpire/pull/657"
  },
  {
    "id": "pr-652",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "A missing receipt is now a red build, not a thing someone has to notice",
    "detail": "Nothing a player sees changes. Eleven pull requests had landed on dev with no entry in this file, and because the changelog inside the game is built from this one, each was missing for a player too. None of them broke anything, which is exactly why it kept happening: an unreceipted merge is green, ships, and reads as finished. Three separate passes — #633, #641 and #653 — existed only to go back for them. A gate now refuses a promotion whose merges are not all named here, and it runs on every push to dev. It checks coverage, not prose: whether an entry exists for each merge, never whether what it says is true. It also guards itself — if this file's receipt syntax ever moves out from under it, it reports that it could not run rather than declaring every merge unreceipted. The cheap pull-request lane also gains the import check that walks every module in the tree.",
    "build": "0.5.5.30",
    "pullRequest": 652,
    "url": "https://github.com/cehinds/AshenSpire/pull/652"
  },
  {
    "id": "pr-653",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "Six receipts, written before the promotion rather than after it",
    "detail": "Nothing a player sees changes. Six merges had landed on dev with no receipt in this file — the music-parity gate (#645), the animated outfit figures (#648), the Quick Access alignment (#649), the build-version corpus (#650), the hand-side instrument and the defect it found (#651), and the uniform stat foldouts (#647) — so the changelog you can read inside the game carried none of them either. All six are written up below, each at the build standing at its own merge, and the projection was regenerated from this file so both now say the same thing. Two of those receipts state something a green summary would have hidden: #647's own new gate reports 33 of 34, not the 34 its description claimed, and #651's repair exposed a rendering defect that is still on dev. The README's feature list also now says that the armour you equip changes the animated figure you fight as, which #648 made true and no player-facing page had mentioned. This receipt names its own pull request, which is only possible because the pull request was opened before the receipt was written.",
    "build": "0.5.5.29",
    "pullRequest": 653,
    "url": "https://github.com/cehinds/AshenSpire/pull/653"
  },
  {
    "id": "pr-647",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "Every stat row is the same row, and only one of them is open",
    "detail": "Character creation, the shrine's Assign Points fold and the Armoury's Attributes card now draw the five primary stats — STR, DEX, CON, WIS, INT — as one compact family instead of three treatments that had drifted apart. Opening one stat's reveal closes whichever was open, across rows the game renders separately, so the column no longer grows a stack of open explanations you have to close by hand. The Armoury's Character information cards behave the same way and arrive with Attributes already open. A narrow Armoury attribute row keeps its rows level and still shows the whole number rather than clipping it. Stated rather than buried: the gate this change adds does not fully pass. tools/uniform-stat-foldouts.mjs reports 33 of 34, and the one that fails is the mobile Assign Points row — INT sits 1.44px taller than the other four, because it carries the longest summary and that surface is the narrowest of the three. It reproduces on the head before this branch merged dev, so it is not merge damage, and the tool is not wired into CI, so nothing goes red for it. Whether that is a layout defect or an assertion that wants a tolerance is the owner's call, and widening the tolerance to make the number read 34 would have hidden the question.",
    "build": "0.5.5.28",
    "pullRequest": 647,
    "url": "https://github.com/cehinds/AshenSpire/pull/647"
  },
  {
    "id": "pr-651",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "The hand-side instrument reads the right column, and immediately finds a real defect",
    "detail": "Nothing a player sees changes here, but something a player can see is now known to be wrong. The gate that checks which side of the figure a weapon is drawn on read content/source/weapons.csv by position, and the third-normal-form pass moved artKey from column 17 to 16; the tool read a number where the art key should be, found no art for any weapon at all, and died before measuring anything. CI had been reporting that death for as long as the drift had stood. The column is corrected, and the contract is now asserted against the file's own header row rather than assumed, so the next move announces itself. The working instrument then reported that the Armoury's figure and combat's figure disagree by 184px on the same weapon — every individual placement is right, the pairing is not — and bisecting with only the column fix applied puts the cause in #618, which is precisely the change about which way a sprite faces. The rendering defect is deliberately not fixed here, because it needs its own diagnosis in a real browser and folding it into an instrument repair would bury both. The job stays red, now for a true reason rather than a broken one.",
    "build": "0.5.5.27",
    "pullRequest": 651,
    "url": "https://github.com/cehinds/AshenSpire/pull/651"
  },
  {
    "id": "pr-650",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "The build-version self-test stops naming a row that was deleted",
    "detail": "Nothing a player sees changes. With the music-parity gate fixed, CI's tests job reached the next failure it had been skipping past: three of the build-version checker's thirty-five known-bads pointed at a row that #620 removed when it took the build stamp out of the run band, so each one walked straight through the check it was supposed to trip. One was worse than merely dead — it asserted the presence of something the current rule wants gone, so satisfying it made the tree more correct and it could never go red. The three are replaced with one plant per way the row that actually exists can break, including a guard against the #620 regression itself. Thirty-five of thirty-five known-bads now come back red.",
    "build": "0.5.5.27",
    "pullRequest": 650,
    "url": "https://github.com/cehinds/AshenSpire/pull/650"
  },
  {
    "id": "pr-649",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "Quick Access squares up with the stamina bar",
    "detail": "The compact Quick Access cluster in the run HUD is a tighter two-by-two square whose bottom edge now finishes level with the bottom of the SP row, instead of hanging below it. Nothing else in the HUD moves — the vitals keep their geometry, and the detached relic and potion trays are untouched. The visible tile faces are smaller; the invisible tap target is not, so it is the same size to hit. A rendered check now holds the two edges within three quarters of a pixel across desktop, phone and iPhone SE, so the alignment cannot quietly drift again.",
    "build": "0.5.5.27",
    "pullRequest": 649,
    "url": "https://github.com/cehinds/AshenSpire/pull/649"
  },
  {
    "id": "pr-648",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "The armour you wear is the figure you fight as",
    "detail": "Equipping one of the twelve alternative armour sets now changes the animated figure in combat and in the Armoury to that outfit's own painted figure, rather than always showing the class default — and a set with no sheet of its own still falls back to the class figure, so nothing can end up with no figure at all. The attack gains a fourth frame: the forward thrust now lands before the downward slash instead of the swing starting mid-air. Twelve new painted pose sheets back this, cut into 720 frames and shipped as 560; the single-file download grows accordingly. The sheets were generated with ChatGPT Codex under the owner's direction — CREDITS says so, the source sheets and the approved outfit boards are kept in docs/art-evidence/2026-09-05/, and the game's AI disclosure covers them like every other painted figure.",
    "build": "0.5.5.26",
    "pullRequest": 648,
    "url": "https://github.com/cehinds/AshenSpire/pull/648"
  },
  {
    "id": "pr-645",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "The music-only switch is checked again, after a year of a gate proving nothing",
    "detail": "Nothing a player sees changes. Dispatching CI against test before the promotion turned up a failure on all three runners: the check that the music-only switch reflects its own state was matching the exact source text of the old imperative call, and the component-kit rewrite (#605) had moved that row onto the kit's declarative form. The behaviour never broke; the sentence the gate was reading did. Worse, the plant that proves the gate can fail searched for the same vanished string, so the gate was red and proving nothing — the two failure modes that are supposed to be distinguishable, at once. Both halves now assert what the value derives from rather than how it is spelled, and the freed drift slot is recorded in the plantsites baseline so the counts still match. Pre-existing rather than introduced: it reproduces on release and on the earlier test.",
    "build": "0.5.5.26",
    "pullRequest": 645,
    "url": "https://github.com/cehinds/AshenSpire/pull/645"
  },
  {
    "id": "pr-644",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "Two receipts, and the changelog inside the game catches up to them",
    "detail": "Nothing a player sees changes. The Assign Points contract (#640) had landed on dev with no receipt here, so the changelog you can read inside the game did not carry it either; it is written up below, and the projection was regenerated from this file so both now say the same thing. This receipt names its own pull request, which is only possible because the pull request was opened before the receipt was written.",
    "build": "0.5.5.25",
    "pullRequest": 644,
    "url": "https://github.com/cehinds/AshenSpire/pull/644"
  },
  {
    "id": "pr-640",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "The rule for reopening Assign Points is written down before it is built",
    "detail": "Nothing a player sees changes yet. SPEC.md now states that opening or reopening Assign Points is a refund boundary: every authored attribute returns to the mode baseline and the whole bonus pool is available again, instead of resuming the allocation you left behind. The game currently does the opposite — customize.js refills the attributes only when there are none — so this is the contract the runtime fix in #636 has to meet, landed first on purpose so that fix has something to be measured against rather than a description written after the fact. The same change records that shared setting rows keep one equal positive inset on all four sides, which a surface does not get to remove one side of.",
    "build": "0.5.5.24",
    "pullRequest": 640,
    "url": "https://github.com/cehinds/AshenSpire/pull/640"
  },
  {
    "id": "pr-641",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "Three receipts, written before the promotion rather than after it",
    "detail": "Nothing a player sees changes. The pose-animation fixes (#637), the publication-cancelling fix (#635) and the provenance row for the painted equipment sheets (#631) had all landed on dev without a receipt here, so the in-game changelog did not carry them either. All three are written up above, each citing the build it actually landed in. This receipt names its own pull request, which is only possible because the pull request was opened first — the trap that left #629 unrecorded until #633 came back for it.",
    "build": "0.5.5.24",
    "pullRequest": 641,
    "url": "https://github.com/cehinds/AshenSpire/pull/641"
  },
  {
    "id": "pr-637",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "Seven fixes in the pose animation path",
    "detail": "No new art, and no shipped frame moves. Asking for a pose this build does not ship used to freeze the figure in whatever it was showing — a lunge, mid-swing — for the rest of the fight; the frame is checked before the hold already running is cancelled. Reduced motion now honours the setting made in your operating system and not only the one inside the game, which in co-op was the only gate a pose swap passed through. Two co-op seats of the same class and tint now rotate through their attack frames independently instead of stealing each other's place. The remaining four are in the art tools: the gap check is per class and pose rather than pooled across all of them, a failed encode no longer leaves the shipped set half-deleted, --grounded anchors a figure by its feet rather than by its lowest ink, and a crop with nothing above the floor line names the frame instead of throwing a bare RangeError.",
    "build": "0.5.5.22",
    "pullRequest": 637,
    "url": "https://github.com/cehinds/AshenSpire/pull/637"
  },
  {
    "id": "pr-633",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "The README stops contradicting itself about what dev publishes",
    "detail": "Nothing a player sees changes. #629 was the one merged pull request this file had no receipt for, because it was the pass that wrote the others and a receipt cannot name a number that does not exist until the pull request is opened; it has one now. #632 then made a push to dev, test or release publish the builds site — but a paragraph further down the README still said dev is not published and that a change merged to it is not yet visible at the preview URL. The two statements sat six lines apart. The later one now says what actually happens, and keeps the distinction that matters: a push to dev moves its own address, and the stable Play link still moves only on the owner's own dispatch.",
    "build": "0.5.5.19",
    "pullRequest": 633,
    "url": "https://github.com/cehinds/AshenSpire/pull/633"
  },
  {
    "id": "pr-632",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "The builds site keeps itself current, except for the stable link",
    "detail": "Nothing in the game changes. A push to dev, test or release now publishes the builds site as well as assembling it, so the per-branch play links follow the branches instead of waiting for someone to publish them by hand — they had sat three days behind the game, across fifty-two runs that each assembled the site successfully and then published nothing. The stable Play link is deliberately not automated: a push to main publishes nothing, and that link moves only on the owner's own dispatch. The trade is stated rather than hidden — publishing on a push is a standing permission for every future push to those three branches, and because the site is one site assembled on top of main, a main change does reach it on the next publication from one of them.",
    "build": "0.5.5.17",
    "pullRequest": 632,
    "url": "https://github.com/cehinds/AshenSpire/pull/632"
  },
  {
    "id": "pr-635",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "A run that will not publish cannot cancel one that will",
    "detail": "Nothing a player sees changes. Once #632 let dev, test and release publish on a push, the workflow's single cancel-in-progress group became a way to lose a publication in silence: a push to main — which deliberately publishes nothing — could cancel a development publication mid-deploy, and a cancelled run is not a failed one, so nothing would have said so. A run may now cancel its predecessor only if it is itself going to publish. The one group is kept on purpose, because two deploys to the same Pages environment must not race.",
    "build": "0.5.5.17",
    "pullRequest": 635,
    "url": "https://github.com/cehinds/AshenSpire/pull/635"
  },
  {
    "id": "pr-631",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "The painted equipment sheets get their provenance row",
    "detail": "Nothing a player sees changes. The eight painted equipment sheets #623 added to the builds site shipped without the CREDITS row this repository requires of any asset a change adds. The row states what the owner states — that they are AI-generated, CC0 — in the same form already used for the class sprites and the pose sheets, and records that they are reference only: nothing loads them at runtime.",
    "build": "0.5.5.17",
    "pullRequest": 631,
    "url": "https://github.com/cehinds/AshenSpire/pull/631"
  },
  {
    "id": "pr-629",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "The receipts catch up, and the README says you can re-arm mid-fight",
    "detail": "Nothing a player sees changes. Three merged pull requests had landed without a receipt in this file — the equipment turnaround sheets (#626), the build-address and badge corrections (#628), and the in-game changelog catch-up (#627) — and all three are written up above. The README had also never mentioned that #625 let you change equipment during a fight, which is a thing a player does rather than an internal change; the feature list says so now, with the Energy it costs and the fact that a change you cannot afford is refused without spending anything. The changelog inside the game was regenerated from this file so it carries the same receipts. This receipt is the one that pass could not write for itself: a receipt names its own pull request, and the number does not exist until the pull request is opened.",
    "build": "0.5.5.14",
    "pullRequest": 629,
    "url": "https://github.com/cehinds/AshenSpire/pull/629"
  },
  {
    "id": "pr-626",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "Turnaround sheets for what each class wears and carries",
    "detail": "Nothing a player sees changes, and nothing in the game draws these yet. Thirty-nine equipment, clothing and weapon pieces across the four classes each gain a strip of five 256×256 views — top, right, bottom, left and back — as reference for inventory and modelling work later. They were reconstructed with AI assistance from the owner's own class paintings and from nothing else; CREDITS says so, and the manifest records how confident each piece is, from high down to the Herald's under-trousers, which the paintings barely show. The single-file download grows, because the strips are inlined into it like every other asset.",
    "build": "0.5.5.13",
    "pullRequest": 626,
    "url": "https://github.com/cehinds/AshenSpire/pull/626"
  },
  {
    "id": "pr-628",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "The README's build addresses are correct, and the badges explain themselves",
    "detail": "Nothing a player sees changes. The example build address in the README pointed at a build that no longer exists, and the four build badges invited a comparison they do not support: the ordinal counts builds within the current candidate and restarts when the candidate advances, so main's four-digit number is not \"ahead\" of dev's two-digit one. The README now says to read each badge down its own column and compare whole stamps instead.",
    "build": "0.5.5.12",
    "pullRequest": 628,
    "url": "https://github.com/cehinds/AshenSpire/pull/628"
  },
  {
    "id": "pr-627",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "The in-game changelog catches up",
    "detail": "The changelog you can read inside the game gains the receipts for the battlefield tooltips (#622) and the painted-fighters reference page (#623), which the file had but the projection had not yet been rebuilt to carry. The README also now says that every status effect and both fighters on the battlefield answer on hover, on the focus cursor and on a tap.",
    "build": "0.5.5.12",
    "pullRequest": 627,
    "url": "https://github.com/cehinds/AshenSpire/pull/627"
  },
  {
    "id": "pr-634",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "The fighter you build is the animated one, and the Armoury sorts its empty slots",
    "detail": "Four finishing passes over the work #625 landed. Animated is now the sprite style you get by default — at character creation, in a LAN lobby, for a local seat, and for a restored member that never recorded a choice; a save that did record Rendered, Classic or Sigil keeps it, because only a missing value defaults. In the Armoury, empty positions you can still fill sort below the occupied and locked ones and draw full width, so the row you can act on is not buried between two you cannot. The HP, MP and SP rows gain half again as much vertical separation, without the bars themselves changing. And a modal's close control paints at three-quarters of its box while keeping the full 44×44 target for pointer, touch, keyboard and controller — a smaller mark, not a smaller thing to hit.",
    "build": "0.5.5.21",
    "pullRequest": 634,
    "url": "https://github.com/cehinds/AshenSpire/pull/634"
  },
  {
    "id": "pr-625",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "You can change equipment during a fight",
    "detail": "The combat Armoury now lets you equip, move, or remove carried weapons and armour on your turn instead of limiting you to the sets prepared before the fight. Re-arming a position costs the same Energy as switching a prepared weapon set. The change takes effect immediately: equipment cards, HP/MP/SP limits, Poise, and the item shown in each position all update inside the current fight, and the new loadout stays with you when the fight ends. A change you cannot afford is refused without spending Energy or moving anything.",
    "build": "0.5.5.11",
    "pullRequest": 625,
    "url": "https://github.com/cehinds/AshenSpire/pull/625"
  },
  {
    "id": "pr-624",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "The fifth 0.5.0 candidate",
    "detail": "The in-game stamp reads 0.5.5.<build> from this build on: the candidate QA receives after 0.5.4, which was promoted to test and on to release on 2026-09-04. Nothing else a player sees changes with the stamp itself. What the candidate carries over 0.5.4 is in the entries below, and the three a player will feel are the component kit every screen is now drawn from (#605), the smith who lifts a card out of an item or seats one back (#602), and the painted class figure you both build and fight as (#590, #619). Riders in this receipt itself: the README names those three, thirty receipts covering 0.5.4.2 through 0.5.4.75 are written up from the merge log, and the component catalog gains the sixteen kit pieces it had not yet described.",
    "build": "0.5.5.2",
    "pullRequest": 624,
    "url": "https://github.com/cehinds/AshenSpire/pull/624"
  },
  {
    "id": "pr-623",
    "date": "2026-09-05",
    "group": "2026-09-05",
    "summary": "A reference page for the painted fighters and their kit",
    "detail": "Nothing a player sees changes. The builds site gains a page, Low-Poly Fighters — Painted Poses, that shows each class's painted pose sheet beside two orthographic sheets of what it wears and carries — the garments on one, the kit on the other, five views each. The pose sheets are shown from where they already live, so there is one copy of each; the eight equipment sheets sit beside the page. Reference only: the game keeps loading its sprites from where it did.",
    "build": "0.5.4.76",
    "pullRequest": 623,
    "url": "https://github.com/cehinds/AshenSpire/pull/623"
  },
  {
    "id": "pr-622",
    "date": "2026-09-04",
    "group": "2026-09-04",
    "summary": "Status effects explain themselves, and your own fighter answers too",
    "detail": "Hover a status effect on either fighter, land the focus cursor on it, or tap it, and it tells you what it does — with its build-up or the turns it has left. The build-up bars under an enemy answer the same way. Before this a status effect was a glyph with a count and nothing behind it, and a tap on one opened the enemy's own summary over the top of the question you had asked; a tap on an effect still plays your card when one is armed. Your own fighter now has the same glance the enemies have had — HP, Poise, effects, and I for the full read — on hover, on the focus cursor, and on a tap; it used to answer nothing at all. The enemy's intent and its HP and Poise bars stay silent on purpose, since the glance already says what they would. And on a phone the Cinders count sits centred in the run band rather than pushed to the right.",
    "build": "0.5.4.76",
    "pullRequest": 622,
    "url": "https://github.com/cehinds/AshenSpire/pull/622"
  },
  {
    "id": "pr-620",
    "date": "2026-09-04",
    "group": "2026-09-04",
    "summary": "The band drops the build stamp, and a fighter faces its opponent",
    "detail": "The build stamp leaves the run band at the top of the screen — it lives on the title screen, where you go to read it — and a combat figure now turns to face whoever it is fighting instead of always facing the same way.",
    "build": "0.5.4.75",
    "pullRequest": 620,
    "url": "https://github.com/cehinds/AshenSpire/pull/620"
  },
  {
    "id": "pr-619",
    "date": "2026-09-04",
    "group": "2026-09-04",
    "summary": "The combat figure is painted art, cut from the pose sheets",
    "detail": "The figure you fight as is now cut from the owner's four painted pose sheets — 180 sprites — in place of the modelled set the Blender pipeline rendered. The source sheets are kept in the repository beside the cut, so the sprites can be re-cut from the painting rather than from an earlier cut of it.",
    "build": "0.5.4.74",
    "pullRequest": 619,
    "url": "https://github.com/cehinds/AshenSpire/pull/619"
  },
  {
    "id": "pr-618",
    "date": "2026-09-04",
    "group": "2026-09-04",
    "summary": "Sprite facing gets its own layer, and the run HUD gets its width back",
    "detail": "Which way a sprite faces is decided in one place instead of being baked into each image, the run HUD is back to its full width, and the utility rail returns.",
    "build": "0.5.4.73",
    "pullRequest": 618,
    "url": "https://github.com/cehinds/AshenSpire/pull/618"
  },
  {
    "id": "pr-617",
    "date": "2026-09-04",
    "group": "2026-09-04",
    "summary": "The pose cutter counts poses, not just classes",
    "detail": "Nothing a player sees changes. The guard that protects published pose art compared class names alone, so a run that carried every class but only some of their poses passed it — and the clear then took the poses it had not carried. It is keyed by class and pose now, so the same silent loss one level down cannot happen.",
    "build": "0.5.4.68",
    "pullRequest": 617,
    "url": "https://github.com/cehinds/AshenSpire/pull/617"
  },
  {
    "id": "pr-616",
    "date": "2026-09-04",
    "group": "2026-09-04",
    "summary": "The combat figure animates its attacks",
    "detail": "A service plays pose frames when you attack. It never blocks your input, Reduced Motion holds the idle frame instead of playing anything, and the animation-speed setting scales how long a frame is held rather than adding time on top.",
    "build": "0.5.4.68",
    "pullRequest": 616,
    "url": "https://github.com/cehinds/AshenSpire/pull/616"
  },
  {
    "id": "pr-615",
    "date": "2026-09-04",
    "group": "2026-09-04",
    "summary": "One missing branch costs its own line, not every run",
    "detail": "Nothing a player sees changes. The builds site fetched all four published branches in one command, which aborts entirely if any one of them is absent — so when test was deleted, publishing broke for dev, release and main too, none of which had lost anything. Each branch is fetched on its own now, and a branch that is genuinely gone is named in the output and skipped rather than crashing the run or vanishing from it silently. main staying fatal is deliberate: the site is assembled on top of it.",
    "build": "0.5.4.67",
    "pullRequest": 615,
    "url": "https://github.com/cehinds/AshenSpire/pull/615"
  },
  {
    "id": "pr-614",
    "date": "2026-09-04",
    "group": "2026-09-04",
    "summary": "Four play-test bleeds, one HUD height, and the fighter becomes a whole person",
    "detail": "Four places where text or art escaped its box are closed, the run HUD settles on one height, which way a figure faces follows one rule, and the combat figure is drawn as a whole person rather than a cropped one.",
    "build": "0.5.4.67",
    "pullRequest": 614,
    "url": "https://github.com/cehinds/AshenSpire/pull/614"
  },
  {
    "id": "pr-613",
    "date": "2026-09-04",
    "group": "2026-09-04",
    "summary": "Class figures rebuilt at a higher resolution, and a cutter for painted sheets",
    "detail": "Nothing a player sees changes yet: the 160 regenerated sprites are inert, because nothing in the game references them. The figures are measured against the paintings and built larger, and a tool arrives that cuts sprites out of a painted pose sheet — the pipeline #619 then used.",
    "build": "0.5.4.62",
    "pullRequest": 613,
    "url": "https://github.com/cehinds/AshenSpire/pull/613"
  },
  {
    "id": "pr-612",
    "date": "2026-09-04",
    "group": "2026-09-04",
    "summary": "Co-op: a fallen seat is not offered a Continue that cannot work",
    "detail": "When an event's result is showing, a player the event felled was drawn a Continue button that could never do anything: the host refuses that seat's continue, and the party never waits for it, so the button sat there answering nothing. A fallen seat now reads the result and a line saying the party goes on without it. The party was never blocked by this — it was offered something false, not trapped. Every other control in co-op already asked whether you were alive before offering itself; this one did not.",
    "build": "0.5.4.62",
    "pullRequest": 612,
    "url": "https://github.com/cehinds/AshenSpire/pull/612"
  },
  {
    "id": "pr-610",
    "date": "2026-09-04",
    "group": "2026-09-04",
    "summary": "The Pages check reads its own verdict again",
    "detail": "Nothing a player sees changes. The builds site's self-check passed all four of its own tests and was then refused by the door that decides whether a tool checked anything at all, because two earlier edits had each added a true fact to its summary line and pushed it out of the grammar that door reads. The facts moved to their own line; the verdict line carries the counts and stops. The publish job had been failing on every push for two days.",
    "build": "0.5.4.61",
    "pullRequest": 610,
    "url": "https://github.com/cehinds/AshenSpire/pull/610"
  },
  {
    "id": "pr-605",
    "date": "2026-09-04",
    "group": "2026-09-04",
    "summary": "The component kit replaces the game's chrome, on every screen",
    "detail": "Every screen is now drawn from one kit of shared pieces rather than each screen carrying its own: one meter, one swatch, one page door, one home for each control. The stylesheet that had grown to 5,354 lines is 801, combat's 1,867 is 767, and the kit that replaces them is 2,063 — one place to change how the game looks instead of many. It carries a batch of play-test fixes with it: combatant boxes are one uniform size (a tall enemy and a low one used to be drawn at different scales side by side), a fight's bottom row explains itself with tooltips on Actions, the piles and End Turn, the character screen shows what an attribute actually gives you instead of flavour text, the fullscreen and music controls sit anchored in the same corner on every screen, the co-op board no longer prints \"undefined\" over every enemy's intent, and the title lockup is centred.",
    "build": "0.5.4.61",
    "pullRequest": 605,
    "url": "https://github.com/cehinds/AshenSpire/pull/605"
  },
  {
    "id": "pr-607",
    "date": "2026-09-03",
    "group": "2026-09-03",
    "summary": "Low-poly class figures for the combat poses",
    "detail": "The combat pose set is built and posed in Blender, one figure per class.",
    "build": "0.5.4.24",
    "pullRequest": 607,
    "url": "https://github.com/cehinds/AshenSpire/pull/607"
  },
  {
    "id": "pr-602",
    "date": "2026-09-03",
    "group": "2026-09-03",
    "summary": "A smith lifts a card out of an item, or seats one back",
    "detail": "The owner's ruling, implemented. A blacksmith can now take a card out of the item that lends it, and the card is yours from then on; the mount it leaves is never dead, showing a fallback — the Dodge Roll for a weapon-art mount — until you seat another card in it. The Shrine gains Extract a Card and Seat a Card beside Upgrade, each the same reversible transaction the upgrade is: choose the item, then the mount, then (when seating) the card, with Back and Escape leaving the run untouched and Confirm the only thing that commits. A merchant rolls a 25% chance to have a smith with them, on its own die, so the roll does not disturb any other reward in a seed you have played. What is extractable is a tag on the card, the price and who offers the service are tables, and extra mounts sit behind a flag for a later rune feature. No shipped weapon authors a card package yet, so until content does, both options will tell you there is nothing to work on — the seam is live and the data is empty, as the bound table was before it.",
    "build": "0.5.4.24",
    "pullRequest": 602,
    "url": "https://github.com/cehinds/AshenSpire/pull/602"
  },
  {
    "id": "pr-590",
    "date": "2026-09-03",
    "group": "2026-09-03",
    "summary": "The four classes wear their concept art",
    "detail": "The class figure shown when you build a character, pick a style, or sit in the LAN lobby is now the painted concept design for that class, in place of the low-poly figure the Blender pipeline rendered. The Rogue changes most: its art was byte-for-byte the Reaver's, so the two classes looked identical and now do not. Your tint now colours the outfit, not just the outline. The garment takes the hue of the tint you chose while keeping the painting's own light and shadow, so the cloth changes colour without going flat; steel, bone and the dark inside a hood keep their own colour, because a dye does not touch those. The accent rim on the silhouette stays, so the figure that glows is still yours. Settings and the LAN lobby call this style Rendered, as before; its description now says \"The painted class figure\". In a fight you are now drawn as that same painted figure. Combat used to composite a low-poly Blender body in your armour set's colours, so the character builder showed one figure and the fight drew another in a different style — and the Rogue fought as the Reaver's shape repainted. The armour-set palette and the held-weapon overlay no longer show on the fighter; your weapons still show on your cards and in the Armoury. Enemy figures and act backdrops are unchanged too. These four figures were made with an AI image-generation model (ChatGPT Codex) — the game's AI disclosure and CREDITS say so, and the disclosure was rewritten and re-approved because the previous text said no image model had been used.",
    "build": "0.5.4.23",
    "pullRequest": 590,
    "url": "https://github.com/cehinds/AshenSpire/pull/590"
  },
  {
    "id": "pr-595",
    "date": "2026-09-03",
    "group": "2026-09-03",
    "summary": "One door-opener, two ladders, one inset — and a gate that measures bleed on a real page",
    "detail": "Every modal now opens through one shared shell: the same head, the same ✕ in the same corner, the same footer order, and one implementation of Escape, the backdrop click and where focus returns. That closed a real trap — the pile viewer had no exit a keyboard or a pad could reach at all. Modal widths come off four named sizes rather than a number typed per door, buttons in a row take one width from a four-step ladder, and a new gate measures whether anything bleeds out of its box on a real rendered page.",
    "build": "0.5.4.14",
    "pullRequest": 595,
    "url": "https://github.com/cehinds/AshenSpire/pull/595"
  },
  {
    "id": "pr-597",
    "date": "2026-09-03",
    "group": "2026-09-03",
    "summary": "The shipped artifact is checked on the post-merge tree, not only on branches",
    "detail": "Nothing a player sees changes. dev shipped a game file that was not built from its own source three times in one day, each time from a pull request that was green on its own branch against a base that had since moved. The check now also runs on the tree the merge actually produces.",
    "build": "0.5.4.14",
    "pullRequest": 597,
    "url": "https://github.com/cehinds/AshenSpire/pull/597"
  },
  {
    "id": "pr-598",
    "date": "2026-09-03",
    "group": "2026-09-03",
    "summary": "Every corpus counts itself",
    "detail": "Nothing a player sees changes: four checks that had their totals spelled beside them now derive those totals from the thing being counted, so a corpus that grows cannot leave its own denominator behind.",
    "build": "0.5.4.14",
    "pullRequest": 598,
    "url": "https://github.com/cehinds/AshenSpire/pull/598"
  },
  {
    "id": "pr-600",
    "date": "2026-09-03",
    "group": "2026-09-03",
    "summary": "The art lease is reissued and the owner's art decision recorded",
    "detail": "Records only.",
    "build": "0.5.4.14",
    "pullRequest": 600,
    "url": "https://github.com/cehinds/AshenSpire/pull/600"
  },
  {
    "id": "pr-603",
    "date": "2026-09-03",
    "group": "2026-09-03",
    "summary": "The governance layer is removed",
    "detail": "Nothing a player sees changes. At the owner's direction, the multi-agent coordination layer — 645 files of dashboards, rule checkers and scheduled agent routines — is deleted and replaced by the one-page rules in AGENTS.md. The tree as it stood before the removal is preserved in history.",
    "build": "0.5.4.14",
    "pullRequest": 603,
    "url": "https://github.com/cehinds/AshenSpire/pull/603"
  },
  {
    "id": "pr-604",
    "date": "2026-09-03",
    "group": "2026-09-03",
    "summary": "The owner owns the project's own records",
    "detail": "Records only: a file may now say that the project's records belong to the owner.",
    "build": "0.5.4.14",
    "pullRequest": 604,
    "url": "https://github.com/cehinds/AshenSpire/pull/604"
  },
  {
    "id": "pr-579",
    "date": "2026-09-03",
    "group": "2026-09-03",
    "summary": "Ordering two builds has one home",
    "detail": "Nothing a player sees changes. The rule for \"which build is newer\" had two implementations that had drifted far enough to give opposite answers about the same pair of stamps; one of them would pass a candidate moving backwards, which is the one thing that check exists to refuse. There is one implementation now, and every caller reads it.",
    "build": "0.5.4.13",
    "pullRequest": 579,
    "url": "https://github.com/cehinds/AshenSpire/pull/579"
  },
  {
    "id": "pr-594",
    "date": "2026-09-03",
    "group": "2026-09-03",
    "summary": "The starting-deck cap is a creation rule",
    "detail": "The owner's ruling, implemented. The deck-size cap governs the basic strikes and defends you are dealt at character creation, and nothing else. The cards your equipment brings are dealt first and are never capped, dropped or refused, and after creation the cap does not apply at all — your deck floats with your gear, by design. The other half of the same ruling: a card an item lends leaves with that item. Take a weapon or a piece of armour off and its cards go; put it back and they return — mid-fight and across a save, not just on the Armoury screen.",
    "build": "0.5.4.13",
    "pullRequest": 594,
    "url": "https://github.com/cehinds/AshenSpire/pull/594"
  },
  {
    "id": "pr-596",
    "date": "2026-09-03",
    "group": "2026-09-03",
    "summary": "Every owner page on the one shell",
    "detail": "Nothing a player sees changes: the project's own status pages, the HUD included, are drawn from one shell.",
    "build": "0.5.4.13",
    "pullRequest": 596,
    "url": "https://github.com/cehinds/AshenSpire/pull/596"
  },
  {
    "id": "pr-593",
    "date": "2026-09-03",
    "group": "2026-09-03",
    "summary": "Unused screenshots and QA output removed",
    "detail": "Nothing a player sees changes: about 200 MB of generated screenshots and QA output that nothing referenced is deleted from the repository.",
    "build": "0.5.4.7",
    "pullRequest": 593,
    "url": "https://github.com/cehinds/AshenSpire/pull/593"
  },
  {
    "id": "pr-592",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "Three P0 screen defects, each measured before and after",
    "detail": "Three screen faults rated most severe are fixed, each one measured on a real page before the change and after it rather than judged by eye.",
    "build": "0.5.4.7",
    "pullRequest": 592,
    "url": "https://github.com/cehinds/AshenSpire/pull/592"
  },
  {
    "id": "pr-591",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "A flask says what it is before you ask",
    "detail": "A flask now tells you what it does without being opened, and card tooltips stop printing their own internal tokens at you.",
    "build": "0.5.4.7",
    "pullRequest": 591,
    "url": "https://github.com/cehinds/AshenSpire/pull/591"
  },
  {
    "id": "pr-589",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The starting deck is composed from tags, and the tag schema is normalised",
    "detail": "What goes into your opening deck is now decided by tags on the content rather than by names written into the code, so a spreadsheet line changes it. Underneath, the tag tables are normalised to third normal form: five tables, a tag written in exactly one place, and no cell holding a list — which removes the second home a tag used to be able to live in, where only a rule kept the two copies agreeing.",
    "build": "0.5.4.7",
    "pullRequest": 589,
    "url": "https://github.com/cehinds/AshenSpire/pull/589"
  },
  {
    "id": "pr-588",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The Hub title stops being double-escaped",
    "detail": "A regression fixed: the project Hub's title was escaped twice, so it printed its own escape codes.",
    "build": "0.5.4.7",
    "pullRequest": 588,
    "url": "https://github.com/cehinds/AshenSpire/pull/588"
  },
  {
    "id": "pr-586",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The Pages self-check had the generator for an oracle",
    "detail": "Nothing a player sees changes: the builds-site self-check was verifying the generator's output against the generator, which cannot fail, and dev was red on two artifact-identity rows at the same time. Both closed.",
    "build": "0.5.4.5",
    "pullRequest": 586,
    "url": "https://github.com/cehinds/AshenSpire/pull/586"
  },
  {
    "id": "pr-585",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "One modal chrome, one corner scale, one disclosure mark",
    "detail": "The groundwork for the shared modal shell: one chrome, one corner radius scale, and one mark for a disclosure, in place of each surface carrying its own.",
    "build": "0.5.4.4",
    "pullRequest": 585,
    "url": "https://github.com/cehinds/AshenSpire/pull/585"
  },
  {
    "id": "pr-583",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The post-removal HP check proves authority, not just absence",
    "detail": "Nothing a player sees changes: a governance check that confirmed something was absent now also proves it was removed by someone entitled to remove it.",
    "build": "0.5.4.4",
    "pullRequest": 583,
    "url": "https://github.com/cehinds/AshenSpire/pull/583"
  },
  {
    "id": "pr-582",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The independent QA seat is spent so scheduler merges stop stalling",
    "detail": "Process only.",
    "build": "0.5.4.4",
    "pullRequest": 582,
    "url": "https://github.com/cehinds/AshenSpire/pull/582"
  },
  {
    "id": "pr-581",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "A governance question is opened for the owner",
    "detail": "Records only: may the builds site republish itself? Proposed, awaiting the owner's ruling.",
    "build": "0.5.4.4",
    "pullRequest": 581,
    "url": "https://github.com/cehinds/AshenSpire/pull/581"
  },
  {
    "id": "pr-580",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The Rogue gets a builder, and the other three are matched to its look",
    "detail": "Art pipeline: the Rogue figure gains its own builder and the other three classes are brought to the same look.",
    "build": "0.5.4.4",
    "pullRequest": 580,
    "url": "https://github.com/cehinds/AshenSpire/pull/580"
  },
  {
    "id": "pr-578",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The shipped artifact is red on dev, and the evidence names its exact commit",
    "detail": "Nothing a player sees changes: the game file dev was shipping did not match its source, the gate evidence now names the exact commit it was taken at, and only a built site counts as a published one.",
    "build": "0.5.4.3",
    "pullRequest": 578,
    "url": "https://github.com/cehinds/AshenSpire/pull/578"
  },
  {
    "id": "pr-577",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The project's time zone is pinned",
    "detail": "Tooling only.",
    "build": "0.5.4.2",
    "pullRequest": 577,
    "url": "https://github.com/cehinds/AshenSpire/pull/577"
  },
  {
    "id": "pr-576",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The builds site says when it is behind",
    "detail": "Nothing a player sees changes: the site reports when what it is serving is older than the branch it names.",
    "build": "0.5.4.2",
    "pullRequest": 576,
    "url": "https://github.com/cehinds/AshenSpire/pull/576"
  },
  {
    "id": "pr-575",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The owner's look ruling: only the Rogue is approved",
    "detail": "Records the owner's decision on the class art, closes the crop, size and state receipt, and drafts what follows.",
    "build": "0.5.4.2",
    "pullRequest": 575,
    "url": "https://github.com/cehinds/AshenSpire/pull/575"
  },
  {
    "id": "pr-574",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The candidate is the third component, and the tail counts builds within it",
    "detail": "The version stamp on the title screen changes shape. It reads <major>.<minor>.<candidate>.<build>, where the fourth number counts builds within the current candidate and restarts at 0 each time the candidate advances — so 0.5.4.2 is the third build of the fourth 0.5 candidate. Before this, the last number was a single count that never reset, which is why a build number can appear to go down across this change while the version itself goes up. The receipts for the closed candidates below are restated in the new notation so the column compares like with like.",
    "build": "0.5.4.2",
    "pullRequest": 574,
    "url": "https://github.com/cehinds/AshenSpire/pull/574"
  },
  {
    "id": "pr-567",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The rest below the elites is not taken out of another promise",
    "detail": "#562 guaranteed a Shrine on some floor below every elite. Meeting that guarantee must not consume a rest the map had already promised somewhere else, and now it does not.",
    "build": "0.5.0-rc.4.1958",
    "pullRequest": 567,
    "url": "https://github.com/cehinds/AshenSpire/pull/567"
  },
  {
    "id": "pr-563",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The fourth 0.5.0 candidate",
    "detail": "The in-game stamp reads 0.5.0-rc.4.<build> from this build on: the candidate QA receives after rc.3, which was promoted to test at build 0.5.3.1. Nothing else a player sees changes with the stamp itself. What the candidate carries over rc.3 is in the entries below, and the one a player will feel is the rest before the elites — a map that holds an elite now holds a Shrine on some floor beneath it, where most maps did not. The one rider is docs: the migration checklist's account of the owner's asks and the open issues, corrected where it had overstated what was shipped.",
    "build": "0.5.0-rc.4.1956",
    "pullRequest": 563,
    "url": "https://github.com/cehinds/AshenSpire/pull/563"
  },
  {
    "id": "pr-562",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "A rest before the elites",
    "detail": "You asked for a rest site before the elites, maybe a shop, and definitely before a boss. Before a boss was always kept — the floor below every boss is a Shrine. Before the elites was not: on most maps an elite stood with no Shrine anywhere below it, because one rule opened rests and elites on the same floor and so a rest could never sit under the first elite. Rests now open earlier than elites do, and a map that holds an elite holds a Shrine on some floor beneath it — measured across the generated maps, from 124 of 180 breaking that to none. The floor elites begin from has not moved, but the maps have: rolling a rest earlier changes what every node above it rolls, so a seed you have played before now draws a different map, elites included. What a run gains is about one more Shrine on the map, and the levels you buy at them are unchanged, because cinders were always the limit rather than the number of Shrines. The route is still yours: a path can climb past a rest and meet the elite anyway. Debug riders on the Custom Climb screen: the shortest act the slider offers is now 7 floors rather than 4, because a shorter act has no floor free to hold the promised rest.",
    "build": "0.5.3.2",
    "pullRequest": 562,
    "url": "https://github.com/cehinds/AshenSpire/pull/562"
  },
  {
    "id": "pr-558",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "Co-op: the party's defeat takes the queue with it",
    "detail": "A seat waiting out its catch-up queue when the last fighter fell was felled with the party, but its client kept drawing the reward or event it was holding — over the end of the run — until a choice was tried and refused. The queue is now forfeited with the seat, so the defeat is what you see. The rc.3 receipt below also names the right rollback build: test carries build 0.5.2.2, not 1935.",
    "build": "0.5.3.1",
    "pullRequest": 558,
    "url": "https://github.com/cehinds/AshenSpire/pull/558"
  },
  {
    "id": "pr-556",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The third 0.5.0 candidate",
    "detail": "The in-game stamp reads 0.5.0-rc.3.<build> from this build on: the candidate QA receives after rc.2, which was promoted to test at build 0.5.2.2 (0.5.2.0 is where the rc.2 stamp began; #541 promoted a later dev). Nothing else a player sees changes with the stamp itself. What the candidate carries over rc.2 is in the entries below — the Dodge Roll that rides on one empty hand (#554), the co-op catch-up queue a returning seat drains (#547, #548, #549, #552), and the README pass with the receipts owed since the second candidate (#555). Tooling rider: the layout gate judges a control covered by what its own text paints, and its known-bad corpus is 24 plants, 24 caught.",
    "build": "0.5.3.0",
    "pullRequest": 556,
    "url": "https://github.com/cehinds/AshenSpire/pull/556"
  },
  {
    "id": "pr-555",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The README names what the game now does",
    "detail": "Nothing a player sees changes: the feature list had stopped at the M4 polish pass, and now names the four things that shipped after it — equip load and the Weight Class it lands you in, Stamina recovery with the class-priced Dodge Roll and the empty hand that brings it, the first quest chain on event-level history, and Forsaken Together, the LAN co-op the launcher serves. The one-line description no longer calls the game single-player only. The in-game changelog is this file's projection, so the build moves with the receipt.",
    "build": "0.5.2.4",
    "pullRequest": 555,
    "url": "https://github.com/cehinds/AshenSpire/pull/555"
  },
  {
    "id": "pr-554",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The Dodge Roll rides as long as one hand is empty",
    "detail": "A hand with nothing in it fights. With one hand armed and the other empty, the empty hand brings the Dodge Roll to your deck while the armed hand keeps the technique its armament installs; fill that hand and the dodge goes, empty it and it comes back. A shield counts as a full hand, and a two-handed armament fills both. Both hands empty is unchanged: Evasive Guard in every guard slot and Dodge Roll in every technique slot, as #523 shipped it. Tooling rider: the layout gate now judges a control covered by what its own TEXT paints, so a label that is part of the control is no longer read as something hiding it, and its known-bad corpus is 24 plants, 24 caught.",
    "build": "0.5.2.3",
    "pullRequest": 554,
    "url": "https://github.com/cehinds/AshenSpire/pull/554"
  },
  {
    "id": "pr-548",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "Co-op: drop out of a run and you come back to the events you missed",
    "detail": "An event the party met while your seat was away is now queued for you and answered on your return: the choices are the ones your history had earned at the time, a choice you could not have afforded then is refused now, the random reward is the one the room would have given you, and you read each result before the next entry opens. A seat that returns mid-fight waits out its queue and then joins the fight already in progress; a replay that fells you fells you, and the live reward offer you were holding is withdrawn. A resumed party reconnects together before the room settles, and a fight the party loses with nobody left standing ends the run for every seat, including one held outside it. Landed over #547, #549 and #552.",
    "build": "0.5.2.2",
    "pullRequest": 548,
    "url": "https://github.com/cehinds/AshenSpire/pull/548"
  },
  {
    "id": "pr-543",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "Review riders on the second candidate",
    "detail": "Nothing new a player asks for: a fight an event starts pays from that encounter's own reward pool and survives the disconnect of the seat that chose it, the result of an event is read before the fight it opens, the Pages deploy runs only on an explicit dispatch, and the layout gate reads a control's text where it used to read its box. Landed over #544, #545, #546 and #550; the migration checklist's account of what the 0.5.0 candidates asked and what was done landed in #551.",
    "build": "0.5.2.1",
    "pullRequest": 543,
    "url": "https://github.com/cehinds/AshenSpire/pull/543"
  },
  {
    "id": "pr-539",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The second 0.5.0 candidate",
    "detail": "The in-game stamp reads 0.5.0-rc.2.<build> from this build on: the candidate QA receives after rc.1 (promoted to test at build 0.5.1.10), carrying the review fixes below. Nothing else a player sees changes. Tooling and docs riders since rc.1: the layout gate re-aimed at the combat action row (#532, #538), the owner asks ledger (#530), every branch's build published on Pages with the README naming them (#525).",
    "build": "0.5.2.0",
    "pullRequest": 539,
    "url": "https://github.com/cehinds/AshenSpire/pull/539"
  },
  {
    "id": "pr-536",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "Co-op: an event choice is a quest step, and the party's map follows its history",
    "detail": "Choosing at an event in co-op now does what the choice says: its effects run on your seat, it is written into your history so the quest chain reaches you, a choice your history has not earned is not offered, a priced choice you cannot afford is shown disabled, an event that starts a fight opens it for the party, and a choice that leaves you at 0 HP fells your seat. A seat's upgraded Poise threshold now reaches the shared fight too.",
    "build": "0.5.1.11",
    "pullRequest": 536,
    "url": "https://github.com/cehinds/AshenSpire/pull/536"
  },
  {
    "id": "pr-525",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "Every branch's builds are playable at their own address",
    "detail": "The site gains a build index across dev, test, release and main: each build sits under its own branch and ordinal, each branch keeps a latest alias, and every listed build is checked byte-for-byte against the file committed at that merge before it is served. The README shows each branch's current build number. As this shipped, a push to any of those four branches assembled and deployed the site; deploying was narrowed afterwards, by #543, to the repository owner's explicit dispatch alone.",
    "build": "0.5.1.11",
    "pullRequest": 525,
    "url": "https://github.com/cehinds/AshenSpire/pull/525"
  },
  {
    "id": "pr-537",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "Every armed option control marks its beat; small title and modal fixes",
    "detail": "The title screen's slot Delete no longer shows a hold hint it does not honour, a drag that ends on a confirmation's backdrop no longer cancels it (only a press that began there does), and every hold-or-tap option control now declares the action it is wired to, so the hold-harness census reads 139 checks with no findings.",
    "build": "0.5.1.10",
    "pullRequest": 537,
    "url": "https://github.com/cehinds/AshenSpire/pull/537"
  },
  {
    "id": "pr-535",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The Shrine smiths the armaments you carry, not only the ones in hand",
    "detail": "An upgradeable armament left in storage is now offered at the Shrine with its authored cards previewed, and a random upgrade never lands on an armament with no live cards.",
    "build": "0.5.1.9",
    "pullRequest": 535,
    "url": "https://github.com/cehinds/AshenSpire/pull/535"
  },
  {
    "id": "pr-534",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "Co-op clients price an upgraded relic the way the host does",
    "detail": "Each seat's upgrade tiers travel with the live combat snapshot, so an upgraded Ancestral Horn reduces a Power's cost on the client's screen exactly as it does on the host's.",
    "build": "0.5.1.8",
    "pullRequest": 534,
    "url": "https://github.com/cehinds/AshenSpire/pull/534"
  },
  {
    "id": "pr-533",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "A blocked confirmation keeps the keyboard on Back",
    "detail": "When Confirm is hidden because the option cannot be taken (an unaffordable upgrade, say), Tab and Shift+Tab stay on the visible Back button instead of landing on the hidden Confirm.",
    "build": "0.5.1.8",
    "pullRequest": 533,
    "url": "https://github.com/cehinds/AshenSpire/pull/533"
  },
  {
    "id": "pr-531",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "A press you walk away from does nothing",
    "detail": "Moving your finger or pointer off a hold-or-tap control before releasing now cancels the whole press: the hold timer stops, no review opens on release, and nothing commits. Before, a press that slid off could commit at full hold or open the review on release.",
    "build": "0.5.1.7",
    "pullRequest": 531,
    "url": "https://github.com/cehinds/AshenSpire/pull/531"
  },
  {
    "id": "pr-526",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "The first quest chain: Grave of the Nameless → the Keeper → the Nameless at Rest",
    "detail": "What you did at the grave follows you: dig for cinders and the keeper comes to collect (repay, or fight); pay your respects and the keeper thanks you with the Gravetender's Bell, a relic no shop or drop will ever hand over. A second cairn opens only after the keeper, answers the branch you took, and neither step comes twice. Under the hood, an Unknown node can now roll an event only once your run's history has earned it, so more chains are content on the same door.",
    "build": "0.5.1.6",
    "pullRequest": 526,
    "url": "https://github.com/cehinds/AshenSpire/pull/526"
  },
  {
    "id": "pr-523",
    "date": "2026-09-02",
    "group": "2026-09-02",
    "summary": "Empty hands fight with the Dodge Roll, Stamina recovers, and your Weight Class prices the dodge",
    "detail": "A run with both hands empty now composes Evasive Guard in every guard slot and Dodge Roll in every technique slot instead of the placeholder Defend and Footwork. The Dodge Roll checks Dexterity against a d20 and, on success, lands a temporary guard as Block; the pure dodge costs what your Weight Class says — Light 1 Stamina, Medium 2 Stamina and 1 action, Heavy 3 Stamina and 2 actions — and the card face, the tooltip and the engine quote the same price. A turn in which you spend no Stamina recovers some at its end. Armed play is unchanged. Co-op seats are priced from their own Dexterity and equipment.",
    "build": "0.5.1.5",
    "pullRequest": 523,
    "url": "https://github.com/cehinds/AshenSpire/pull/523"
  },
  {
    "id": "pr-520",
    "date": "2026-09-01",
    "group": "2026-09-01",
    "summary": "Your equipment now has a weight, and the Armoury says what it costs you",
    "detail": "Beside the Poise threshold, the Armoury's equipment receipts show your Equip load: what your hands and armour weigh against a capacity set by Constitution and Strength, the percent, and the Weight Class it lands you in — Light, Medium or Heavy. Armour weighs its Poise threshold, every item card shows the same Weight number the total counts, smithed or not, and comparing a piece shows the load and Weight Class the swap would leave you at. This is a readout for now; the dodge roll that spends it lands separately. The capacity base is tuned so that every class can reach every class of load; no starting kit the creator allows begins Heavy.",
    "build": "0.5.1.4",
    "pullRequest": 520,
    "url": "https://github.com/cehinds/AshenSpire/pull/520"
  },
  {
    "id": "pr-519",
    "date": "2026-09-01",
    "group": "2026-09-01",
    "summary": "Framework cutover checklist and importer validation",
    "detail": "Nothing a player sees changes: the migration checklist and cutover report now read the live counts (393 entities, 196 cards) and name each dormant row's missing piece; the importer refuses an armament or outfit whose weight, ratings or poise threshold are malformed, with a malformed-row test.",
    "build": "0.5.1.3",
    "pullRequest": 519,
    "url": "https://github.com/cehinds/AshenSpire/pull/519"
  },
  {
    "id": "pr-522",
    "date": "2026-09-01",
    "group": "2026-09-01",
    "summary": "Shrines level you at a measured pace, and can be multi-use",
    "detail": "Balance change: a level at the Shrine now costs 20 cinders, rising 4 per level (was 800 + 200), calibrated so a full climb buys 10–20 level-ups. Settings → Advanced → Gameplay → Multi-use Shrines (off by default) lets you Rest, Smith and Level at one Shrine and leave when you choose; every Shrine sentence tells the truth about staying or leaving.",
    "build": "0.5.1.2",
    "pullRequest": 522,
    "url": "https://github.com/cehinds/AshenSpire/pull/522"
  },
  {
    "id": "pr-517",
    "date": "2026-09-01",
    "group": "2026-09-01",
    "summary": "Release-candidate versioning",
    "detail": "The in-game stamp reads 0.5.0-rc.1.<build> from this build on — the first candidate of the 0.5.0 line QA tests — and the version gate clears the one named contract column that legitimately ends in \"version\". Receipts for #510–#516 landed here.",
    "build": "0.5.1.1",
    "pullRequest": 517,
    "url": "https://github.com/cehinds/AshenSpire/pull/517"
  },
  {
    "id": "pr-521",
    "date": "2026-09-01",
    "group": "2026-09-01",
    "summary": "Dragging a card lights the one legal target, self or ally",
    "detail": "When a card's legal targets on the board come to exactly one and it is you, the drag lights you — for self cards as before, and now for self-or-ally cards when no ally is present. The set is taken once at drag start, so nothing pops in mid-drag, and the highlight never lights a drop the release would refuse. Co-op keeps its own aiming.",
    "build": "0.5.1.0",
    "pullRequest": 521,
    "url": "https://github.com/cehinds/AshenSpire/pull/521"
  },
  {
    "id": "pr-516",
    "date": "2026-09-01",
    "group": "2026-09-01",
    "summary": "Status-effect rules and the cost badges on card faces now come from the framework",
    "detail": "Behavior-preserving: the ninth port tranche moves status semantics (stacks, meters, decay, procs, resists) behind a framework door and reads the card-face cost, mana and stamina badges from the framework cost profile. Every card's badges are proven identical. Release remains RED.",
    "build": "0.4.0.1903",
    "pullRequest": 516,
    "url": "https://github.com/cehinds/AshenSpire/pull/516"
  },
  {
    "id": "pr-514",
    "date": "2026-09-01",
    "group": "2026-09-01",
    "summary": "Every status and stance word, and the whole hold-to-confirm surface, route through the framework",
    "detail": "Behavior-preserving: the eighth port tranche resolves the remaining status/stance names and tooltips (combat rows, proc bars, stance chips, stagger tooltips, co-op board, arcane exposure) through the framework term registry, verbatim, and moves the tap/hold/inspect interaction surface behind the framework door for all ten screens that use it.",
    "build": "0.4.0.1902",
    "pullRequest": 514,
    "url": "https://github.com/cehinds/AshenSpire/pull/514"
  },
  {
    "id": "pr-513",
    "date": "2026-09-01",
    "group": "2026-09-01",
    "summary": "Armaments can grant cards and install default weapon arts, dormant until authored",
    "detail": "Nothing a player sees changes: no shipped armament authors a grant or a weapon art yet. The mechanism composes them with save-stable ids at creation and on equip, reconciles them across the combat piles on a mid-fight swap and on loading a fight, dedupes a shared weapon art across two hands, and keeps them out of per-copy upgrade and removal offers — all proven by fixture. Status and stance words on card faces now resolve through the framework term registry.",
    "build": "0.4.0.1901",
    "pullRequest": 513,
    "url": "https://github.com/cehinds/AshenSpire/pull/513"
  },
  {
    "id": "pr-512",
    "date": "2026-09-01",
    "group": "2026-09-01",
    "summary": "Deck composition and confirmation rules adopted as the framework's own",
    "detail": "Behavior-preserving: the shipped weapon-deck composer and the fail-closed confirmation derivation become the framework's implementations behind framework doors; the smith upgrade modal routes through the option-decision door. Rides along: the about-changelog instrument's selftest census and verdict lines (#498).",
    "build": "0.4.0.1896",
    "pullRequest": 512,
    "url": "https://github.com/cehinds/AshenSpire/pull/512"
  },
  {
    "id": "pr-511",
    "date": "2026-09-01",
    "group": "2026-09-01",
    "summary": "Two owner rulings recorded and executed for the framework port",
    "detail": "Behavior-preserving: the owner adopted the legacy deck composition and the fail-closed confirmation derivation as the framework's rules; status and stance tooltips on card faces resolve through framework terms.",
    "build": "0.4.0.1893",
    "pullRequest": 511,
    "url": "https://github.com/cehinds/AshenSpire/pull/511"
  },
  {
    "id": "pr-510",
    "date": "2026-09-01",
    "group": "2026-09-01",
    "summary": "Card costs and load/quit confirmation severity decided by the framework",
    "detail": "Behavior-preserving: the second port tranche compiles every card's cost profile (action, mana, stamina, X, Power reduction) through the framework and reads the load/quit dialog tone from the confirmation registry; every card's costs are proven identical, base and upgraded.",
    "build": "0.4.0.1893",
    "pullRequest": 510,
    "url": "https://github.com/cehinds/AshenSpire/pull/510"
  },
  {
    "id": "pr-508",
    "date": "2026-09-01",
    "group": "2026-09-01",
    "summary": "The data-driven property framework lands as a complete, validated replacement candidate",
    "detail": "Nothing a player sees changes: the framework — canonical registries, a deterministic property compiler, gameplay services, shared presentation rules, an importer carrying all 392 existing entities with their exact identities, and a cutover gate that refuses to switch until every check passes — ships alongside the running game without touching it. Evidence and groundwork only; it rebuilds nothing, so it shares the current ordinal. Release remains RED.",
    "build": "0.4.0.1888",
    "pullRequest": 508,
    "url": "https://github.com/cehinds/AshenSpire/pull/508"
  },
  {
    "id": "pr-507",
    "date": "2026-09-01",
    "group": "2026-09-01",
    "summary": "The Smith reaches your armour and your relics, not just your armaments",
    "detail": "What the Smith will work on is now the equipment you own — the armour you are wearing and the relics you carry — where before it was armaments alone. Their upgrades are authored as data rather than written into code: armour raises its poise threshold, and a relic improves the passive it already grants.",
    "build": "0.4.0.1888",
    "pullRequest": 507,
    "url": "https://github.com/cehinds/AshenSpire/pull/507"
  },
  {
    "id": "pr-491",
    "date": "2026-08-31",
    "group": "2026-08-31",
    "summary": "Earlier event choices influence later events",
    "detail": "What you chose at an event is remembered, and can change what a later event offers you.",
    "build": "0.4.0.1855",
    "pullRequest": 491,
    "url": "https://github.com/cehinds/AshenSpire/pull/491"
  },
  {
    "id": "pr-495",
    "date": "2026-08-31",
    "group": "2026-08-31",
    "summary": "Equipment cards show their receipts",
    "detail": "What an equipment card does to your numbers is surfaced on the card instead of being left to infer.",
    "build": "0.4.0.1855",
    "pullRequest": 495,
    "url": "https://github.com/cehinds/AshenSpire/pull/495"
  },
  {
    "id": "pr-502",
    "date": "2026-08-31",
    "group": "2026-08-31",
    "summary": "Smithing upgrades an armament and every basic card it owns",
    "detail": "Elite and boss victories award Smithing Stones; the Shrine spends one Stone to improve an owned armament for the run, with exact before-and-after card values shown before confirmation. The upgrade follows the armament through swaps, saves, active combats, legacy runs, rewards, and co-op host restoration. The picker uses the owned weapon or shield art, inventory quantity, WEAPON label, and equipment tags instead of borrowing one combat card's identity.",
    "build": "0.4.0.1854",
    "pullRequest": 502,
    "url": "https://github.com/cehinds/AshenSpire/pull/502"
  },
  {
    "id": "pr-477",
    "date": "2026-08-31",
    "group": "2026-08-31",
    "summary": "Enemies are authored in level bands, and scale within them",
    "detail": "Enemy levels come from authored bands with scaling rather than a fixed level per encounter.",
    "build": "0.4.0.1760",
    "pullRequest": 477,
    "url": "https://github.com/cehinds/AshenSpire/pull/477"
  },
  {
    "id": "pr-462",
    "date": "2026-08-31",
    "group": "2026-08-31",
    "summary": "The parry dagger is held in the shield hand",
    "detail": "The dagger routes through the shield socket, so it is worn and drawn where a parrying off-hand belongs.",
    "build": "0.4.0.1760",
    "pullRequest": 462,
    "url": "https://github.com/cehinds/AshenSpire/pull/462"
  },
  {
    "id": "pr-463",
    "date": "2026-08-31",
    "group": "2026-08-31",
    "summary": "Combat controls stay inside the iPhone safe areas",
    "detail": "The controls no longer sit under the notch or the home indicator.",
    "build": "0.4.0.1719",
    "pullRequest": 463,
    "url": "https://github.com/cehinds/AshenSpire/pull/463"
  },
  {
    "id": "pr-458",
    "date": "2026-08-31",
    "group": "2026-08-31",
    "summary": "Confirming a self-target on a controller keeps its focus",
    "detail": "Choosing yourself as the target of a card no longer loses the controller's place in the confirmation.",
    "build": "0.4.0.1708",
    "pullRequest": 458,
    "url": "https://github.com/cehinds/AshenSpire/pull/458"
  },
  {
    "id": "pr-456",
    "date": "2026-08-30",
    "group": "2026-08-30",
    "summary": "Escape closes what is actually on top of Settings",
    "detail": "Escape now dismisses the frontmost dialog rather than the screen behind it, and focus returns to the control that opened it.",
    "build": "0.4.0.1708",
    "pullRequest": 456,
    "url": "https://github.com/cehinds/AshenSpire/pull/456"
  },
  {
    "id": "pr-459",
    "date": "2026-08-30",
    "group": "2026-08-30",
    "summary": "The combat command bar's layout is refined",
    "detail": "The bar is positioned by the stylesheet instead of by the combat screen's own code, which loses about 175 lines of it.",
    "build": "0.4.0.1704",
    "pullRequest": 459,
    "url": "https://github.com/cehinds/AshenSpire/pull/459"
  },
  {
    "id": "pr-447",
    "date": "2026-08-30",
    "group": "2026-08-30",
    "summary": "Armaments get a command rail and radial shortcuts in combat",
    "detail": "The armaments you carry are reachable from a rail on the combat screen, with radial shortcuts to them.",
    "build": "0.4.0.1701",
    "pullRequest": 447,
    "url": "https://github.com/cehinds/AshenSpire/pull/447"
  },
  {
    "id": "pr-449",
    "date": "2026-08-30",
    "group": "2026-08-30",
    "summary": "Levels gain canonical hidden semantics",
    "detail": "Nothing a player sees changes at this build: the rules for a hidden player level and for enemy level profiles are authored and validated, and deliberately wired to nothing — no UI, save, encounter, combat or co-op reads them yet. The enemy bands that stand on them arrive in #477.",
    "build": "0.4.0.1688",
    "pullRequest": 449,
    "url": "https://github.com/cehinds/AshenSpire/pull/449"
  },
  {
    "id": "pr-437",
    "date": "2026-08-30",
    "group": "2026-08-30",
    "summary": "Save and Quit writes the camera state with the save",
    "detail": "Resuming puts the view back where you left it instead of at a default framing.",
    "build": "0.4.0.1688",
    "pullRequest": 437,
    "url": "https://github.com/cehinds/AshenSpire/pull/437"
  },
  {
    "id": "pr-371",
    "date": "2026-08-28",
    "group": "2026-08-28",
    "summary": "The title collapses when a run exits and when you cancel",
    "detail": "Leaving a run, or cancelling out of the opening menus, returns the title to its folded state instead of leaving it open.",
    "build": "0.4.0.1454",
    "pullRequest": 371,
    "url": "https://github.com/cehinds/AshenSpire/pull/371"
  },
  {
    "id": "pr-361",
    "date": "2026-08-28",
    "group": "2026-08-28",
    "summary": "The Review & Approval Hub refreshes its owner decisions and adds Context Rotation",
    "detail": "The owner-facing hub promotes the two bounded Art decisions into cards that need Constantine without approving either, adds the #053 Context Rotation dashboard and its 13-team / 52-seat report, and separates registration and cold-start acceptance from execution, rotation, and successor-resume proof. Local-only evidence URLs now resolve to the explicit unavailable page instead of leaking author-local file paths. Evidence and hub only; it rebuilds nothing, so it shares the current ordinal. Release remains RED.",
    "build": "0.4.0.1454",
    "pullRequest": 361,
    "url": "https://github.com/cehinds/AshenSpire/pull/361"
  },
  {
    "id": "pr-367",
    "date": "2026-08-28",
    "group": "2026-08-28",
    "summary": "Startup components anchor to the viewport centre",
    "detail": "The startup screen's parts are positioned against the centre of the viewport rather than drifting with the layout around them.",
    "build": "0.4.0.1453",
    "pullRequest": 367,
    "url": "https://github.com/cehinds/AshenSpire/pull/367"
  },
  {
    "id": "pr-366",
    "date": "2026-08-28",
    "group": "2026-08-28",
    "summary": "The startup gate is centred, and its background card is gone",
    "detail": "Merged as pull request #366 in development build 0.4.0.1448.",
    "build": "0.4.0.1448",
    "pullRequest": 366,
    "url": "https://github.com/cehinds/AshenSpire/pull/366"
  },
  {
    "id": "pr-365",
    "date": "2026-08-28",
    "group": "2026-08-28",
    "summary": "Enemy tooltips read in context, the HUD compacts, and the title is centred",
    "detail": "An enemy's tooltip is written for the situation it appears in, the HUD takes less room, and the title's alignment is corrected.",
    "build": "0.4.0.1432",
    "pullRequest": 365,
    "url": "https://github.com/cehinds/AshenSpire/pull/365"
  },
  {
    "id": "pr-356",
    "date": "2026-08-26",
    "group": "2026-08-26",
    "summary": "Escape cancels an armed rebind without leaving Controls",
    "detail": "Pressing Escape while a key rebind is waiting for a press cancels the capture and keeps the Controls menu open, instead of closing it out from under you.",
    "build": "0.4.0.1378",
    "pullRequest": 356,
    "url": "https://github.com/cehinds/AshenSpire/pull/356"
  },
  {
    "id": "pr-355",
    "date": "2026-08-26",
    "group": "2026-08-26",
    "summary": "Load and Quit ask in the game's own words",
    "detail": "The browser prompts standing in for Load and Quit are replaced with the game's own confirmations, so a misread click no longer drops the run you are in.",
    "build": "0.4.0.1376",
    "pullRequest": 355,
    "url": "https://github.com/cehinds/AshenSpire/pull/355"
  },
  {
    "id": "pr-354",
    "date": "2026-08-26",
    "group": "2026-08-26",
    "summary": "A fight saved mid-combat resumes exactly",
    "detail": "Loading a save made during a fight restores that fight as it stood.",
    "build": "0.4.0.1371",
    "pullRequest": 354,
    "url": "https://github.com/cehinds/AshenSpire/pull/354"
  },
  {
    "id": "pr-353",
    "date": "2026-08-26",
    "group": "2026-08-26",
    "summary": "New Game save-slot selection has one owner",
    "detail": "The slot you choose is the slot the new run is written to.",
    "build": "0.4.0.1368",
    "pullRequest": 353,
    "url": "https://github.com/cehinds/AshenSpire/pull/353"
  },
  {
    "id": "pr-352",
    "date": "2026-08-26",
    "group": "2026-08-26",
    "summary": "Load slots activate where you press them",
    "detail": "Slot activation is deterministic and the tap targets match what is drawn.",
    "build": "0.4.0.1366",
    "pullRequest": 352,
    "url": "https://github.com/cehinds/AshenSpire/pull/352"
  },
  {
    "id": "pr-350",
    "date": "2026-08-26",
    "group": "2026-08-26",
    "summary": "Smith now lets you choose, review, and confirm one permanent card upgrade",
    "detail": "Back and Escape return to the Shrine without changing the deck; Confirm upgrades exactly the selected card and clearly says that it leaves the Shrine. The same delivery also makes attribute explanations span their allocator rows, gives folded Shrine choices one footprint, gives Armoury trays useful session-scoped opening sizes and snap stops, adds touch-readable combatant inspection with center-seeking tooltips, and codifies the repeatable gameplay QA process and component-catalog receipts.",
    "build": "0.4.0.1362",
    "pullRequest": 350,
    "url": "https://github.com/cehinds/AshenSpire/pull/350"
  },
  {
    "id": "pr-347",
    "date": "2026-08-25",
    "group": "2026-08-25",
    "summary": "The title now unfolds from the Ashen Spire threshold into one centered menu",
    "detail": "The folded startup mark keeps its logo, subtitle, divider, and input-family invitation centered while its phone background is fully transparent. The revealed title presents Continue, Load, New, Collection, Settings, and Quit as one vertical list; Fullscreen and Music stay anchored at the top right. Load and New share one responsive save-slot dialog with selected, empty, focused, disabled, and occupied states plus Back and Continue controls.",
    "build": "0.4.0.1352",
    "pullRequest": 347,
    "url": "https://github.com/cehinds/AshenSpire/pull/347"
  },
  {
    "id": "pr-348",
    "date": "2026-08-25",
    "group": "2026-08-25",
    "summary": "Combatants now stay centered inside a safe battlefield corridor",
    "detail": "Intent remains full size while the combatant card alone scales between the shared HUD and action hand, preserving explicit breathing room above and below on desktop and phone.",
    "build": "0.4.0.1354",
    "pullRequest": 348,
    "url": "https://github.com/cehinds/AshenSpire/pull/348"
  },
  {
    "id": "pr-346",
    "date": "2026-08-24",
    "group": "2026-08-24",
    "summary": "Cold boot now opens on the Ashen Spire threshold",
    "detail": "The title menu now waits behind a sparse Ashen Spire wordmark, ash, and exact BUILD/source receipt until the first click, tap, Enter, Space, A/Cross, or Start/Menu press is completed. That first press is consumed instead of falling through into a save slot; interrupted presses are cancelled on blur or controller disconnect, and controller buttons already held when polling begins are seeded rather than invented as fresh presses. The title then gives focus to its first available slot. The invitation follows the last active input family, including analog-stick activity, exposes one named startup action without exposing title controls, and keeps pointer/touch focus free of the persistent gamepad cursor. Profile recovery still takes priority, reduced motion keeps a short deterministic exit, and returning to the title during the same boot does not show the threshold again.",
    "build": "dev artifact; exact BUILD in PR evidence",
    "pullRequest": 346,
    "url": "https://github.com/cehinds/AshenSpire/pull/346"
  },
  {
    "id": "pr-344",
    "date": "2026-08-24",
    "group": "2026-08-24",
    "summary": "Fullscreen, music, Settings, and Profile now have one clear home each",
    "detail": "Fullscreen and Music sit beneath the top-right HUD on the title, map, and combat screens, including LAN co-op. The Music control now reflects master Audio mute instead of claiming muted music is on, and turning it on releases both mute layers. Browser refusals are explained beside the control instead of disappearing into Settings, and iPhone users see the Add to Home Screen alternative without needing a hover tooltip. The in-run menu now contains only Settings and Controls, with Save Game and Save & Quit to Title in its footer; Profile lives on the title screen; Changelog lives under Advanced; and the old Deck and Stats shortcuts now open the Armoury that owns them without losing the active run’s combat totals. Restoring a profile also rebinds the title HUD immediately. The Profile drawer traps keyboard focus and states its real save-retention limits.",
    "build": "0.4.0.1271",
    "pullRequest": 344,
    "url": "https://github.com/cehinds/AshenSpire/pull/344"
  },
  {
    "id": "pr-335",
    "date": "2026-08-24",
    "group": "2026-08-24",
    "summary": "Development coordination now has one canonical home",
    "detail": "The repository now points owners and reviewers to one workflow for routine evidence, status receipts, cross-family handoffs, and the boundary between development approval and Constantine-only release authority. Docs only; release remains RED.",
    "build": "0.4.0.1191",
    "pullRequest": 335,
    "url": "https://github.com/cehinds/AshenSpire/pull/335"
  },
  {
    "id": "pr-334",
    "date": "2026-08-23",
    "group": "2026-08-23",
    "summary": "The Armoury is now one configurable equipment workspace",
    "detail": "Character, Inventory, and Hybrid views share one loadout and one Inventory; procedural equipment positions support List/Grid presentation, dragging, socket-correct moves, responsive panes, and one Folding Tray grammar with independently sized supporting trays where enabled. Inventory equipment cards now own their complete folded and expanded action surface: the configured hold gesture fills the whole card, early release aborts, and comparison receipts use a wide data-configured hover/focus tooltip or inline presentation.",
    "build": "0.4.0.1191",
    "pullRequest": 334,
    "url": "https://github.com/cehinds/AshenSpire/pull/334"
  },
  {
    "id": "pr-329",
    "date": "2026-08-23",
    "group": "2026-08-23",
    "summary": "Character creation now owns one shared Inventory and validates every starting hand",
    "detail": "Creation preserves customized saves, keeps armour and armament ownership consistent, refuses invalid hand assignments, and introduces the Rogue alongside data-driven starting attributes and kits.",
    "build": "0.4.0.1126",
    "pullRequest": 329,
    "url": "https://github.com/cehinds/AshenSpire/pull/329"
  },
  {
    "id": "pr-328",
    "date": "2026-08-23",
    "group": "2026-08-23",
    "summary": "Swapped armaments now remain attached to their actual hand sockets",
    "detail": "The Armoury maps left- and right-hand equipment through the same socket ownership used by the run model, so swapping and unequipping no longer makes a weapon appear to belong to the opposite hand.",
    "build": "0.4.0.1114",
    "pullRequest": 328,
    "url": "https://github.com/cehinds/AshenSpire/pull/328"
  },
  {
    "id": "pr-327",
    "date": "2026-08-23",
    "group": "2026-08-23",
    "summary": "Map and combat now share the same three-row HUD",
    "detail": "Run information stays across the top with Cinders centered; HP, MP, and SP remain stacked at the left with Relics beneath; and Armoury, Menu, Health, and Mana form one aligned two-by-two control block at the right. The map keeps its zoom and legend controls together below the playfield.",
    "build": "0.4.0.1091",
    "pullRequest": 327,
    "url": "https://github.com/cehinds/AshenSpire/pull/327"
  },
  {
    "id": "pr-323",
    "date": "2026-08-22",
    "group": "2026-08-22",
    "summary": "Map and combat share one compact player HUD",
    "detail": "HP, MP, and SP now keep the same vertical order and percentage scale on both screens; the top HUD leaves Poise to the combat character card, caps its resource area at 40% of the viewport, and centers Floor with Cinders without letting visible resource cards paint through that receipt.",
    "build": "0.4.0.1078",
    "pullRequest": 323,
    "url": "https://github.com/cehinds/AshenSpire/pull/323"
  },
  {
    "id": "pr-317",
    "date": "2026-08-21",
    "group": "2026-08-21",
    "summary": "The reward menu is written down, in the README and the changelog",
    "detail": "Docs only.",
    "build": "0.4.0.1000",
    "pullRequest": 317,
    "url": "https://github.com/cehinds/AshenSpire/pull/317"
  },
  {
    "id": "pr-316",
    "date": "2026-08-21",
    "group": "2026-08-21",
    "summary": "The Armoury opens on your figure, and CARDS is one click away",
    "detail": "The card strip now arrives folded by default, on every shape, so the character you dressed is whole the moment the panel opens instead of being squeezed into a scrolling sliver by the cards beneath it. One click on CARDS opens the strip, another folds it again, and outside a fight whatever you leave it on is what the Armoury gives you next time — it arrives the way you left it. The Armoury you open mid-fight keeps no such memory: it starts folded every time, whatever you did to it last. On a phone nothing changes: that view never showed the figure and already opened folded.",
    "build": "0.4.0.0983",
    "pullRequest": 316,
    "url": "https://github.com/cehinds/AshenSpire/pull/316"
  },
  {
    "id": "pr-305",
    "date": "2026-08-21",
    "group": "2026-08-21",
    "summary": "Your weapons are in the hands you gave them",
    "detail": "The character model faces you, so the armament in its right hand belongs on your left — the way it does when you face another person. It was drawn the other way round in the Armoury, in character creation, and in combat. Sword and shield now sit on the hands you equipped them to. One off-hand piece, the Parrying Dagger, is still on the wrong side and is tracked separately.",
    "build": "0.4.0.0947",
    "pullRequest": 305,
    "url": "https://github.com/cehinds/AshenSpire/pull/305"
  },
  {
    "id": "pr-292",
    "date": "2026-08-21",
    "group": "2026-08-21",
    "summary": "Stat points and a starting-armour choice at creation",
    "detail": "Two more rows on the creation screen, and both stay open where the six pickers fold. STARTING ARMOUR offers your class's own set plus every set you have earned — a new profile sees one, and each prize won becomes another way to begin. STAT POINTS hands you ten to place across the five stats: they arrive laid along your class's grain, dropping a stat gives its points back, and nothing goes below 8 or above 15 at creation. BEGIN THE CLIMB waits while points are unspent, and if an allocation starves your starting kit it says which stat and how much it needs.",
    "build": "0.4.0.0946",
    "pullRequest": 292,
    "url": "https://github.com/cehinds/AshenSpire/pull/292"
  },
  {
    "id": "pr-296",
    "date": "2026-08-21",
    "group": "2026-08-21",
    "summary": "Your own music obeys the game's mix",
    "detail": "Point the game at a folder of your own tracks and a shrine now plays quieter than a boss, the way the built-in score always did — each context's level is one number, read in one place, for played-in files and the internal score alike.",
    "build": "0.4.0.0930",
    "pullRequest": 296,
    "url": "https://github.com/cehinds/AshenSpire/pull/296"
  },
  {
    "id": "pr-290",
    "date": "2026-08-21",
    "group": "2026-08-21",
    "summary": "Rewards are a menu you open, not a handful you're handed",
    "detail": "Cinders, cards, flasks, armaments and relics arrive as rows, and nothing is applied until you take it — so you can look before you collect, and Back leaves the menu exactly as you found it. A reward with nowhere to go — a full flask belt, a full armament bag — says so on its own row before you tap it, and it is the only kind of row that offers Skip. Continue is always pressable and says what it will do; Settings → Advanced → Reward collection decides which: Auto (the default) takes everything you did not skip, picking a card for you, while Manual means done — only what you chose comes along. Continue is a press-and-hold on mouse, touch, keyboard, and pad.",
    "build": "0.4.0.0929",
    "pullRequest": 290,
    "url": "https://github.com/cehinds/AshenSpire/pull/290"
  },
  {
    "id": "pr-288",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "Character creation is one panel at a time",
    "detail": "Six sections — CLASS, STARTING KIT, KEEPSAKE, SIGIL, TINT, SPRITE — each a card that opens at its turn. CLASS is open on arrival; picking an option collapses the section and opens the next; any face re-opens out of order. After the flow, the column reads back your six choices in words. Keyboard and pad included: the cursor rides the advance, so Confirm-Confirm walks the whole flow accepting defaults.",
    "build": "0.4.0.0911",
    "pullRequest": 288,
    "url": "https://github.com/cehinds/AshenSpire/pull/288"
  },
  {
    "id": "pr-291",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "The merchant is five collapsing bars — and Sell is one of them",
    "detail": "CARDS · RELICS · FLASKS · REMOVE A CARD · SELL, one open at a time, cards open on arrival. Buying keeps the bar you're looking at open. The merchant buys back what he sells — relics and flasks, at half the low end of the item's own price band — and the whole Sell bar can be switched off in Settings (then it's absent, not greyed).",
    "build": "0.4.0.0912",
    "pullRequest": 291,
    "url": "https://github.com/cehinds/AshenSpire/pull/291"
  },
  {
    "id": "pr-289",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "The short-screen warning reads whole at the largest text size",
    "detail": "At Text XL on a very short screen, the last-resort refusal message no longer loses its sentence to its own glyph.",
    "build": "0.4.0.0901",
    "pullRequest": 289,
    "url": "https://github.com/cehinds/AshenSpire/pull/289"
  },
  {
    "id": "pr-286",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "Flask display verified healthy everywhere",
    "detail": "Evidence-only: fourteen photographs of every reachable flask surface, both shapes — no source change; closed #277.",
    "build": "0.4.0.0900",
    "pullRequest": 286,
    "url": "https://github.com/cehinds/AshenSpire/pull/286"
  },
  {
    "id": "pr-287",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "Fullscreen is the first option under Display",
    "detail": "One toggle at the head of Settings → Display, reflecting the real fullscreen state.",
    "build": "0.4.0.0900",
    "pullRequest": 287,
    "url": "https://github.com/cehinds/AshenSpire/pull/287"
  },
  {
    "id": "pr-244",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "Title screen no longer crashes on a detached map board",
    "detail": "The map's scroll-commit debounce could fire after leaving the map and take the title screen down.",
    "build": "0.4.0.0893",
    "pullRequest": 244,
    "url": "https://github.com/cehinds/AshenSpire/pull/244"
  },
  {
    "id": "pr-226",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "Status & Daily Briefs linked from the README",
    "detail": "Docs only.",
    "build": "0.4.0.0885",
    "pullRequest": 226,
    "url": "https://github.com/cehinds/AshenSpire/pull/226"
  },
  {
    "id": "pr-224",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "Combat action row no longer overlaps or mis-scales",
    "detail": "Merged as pull request #224 in development build 0.4.0.0885.",
    "build": "0.4.0.0885",
    "pullRequest": 224,
    "url": "https://github.com/cehinds/AshenSpire/pull/224"
  },
  {
    "id": "pr-225",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "Hint-strip selftest runs on Windows",
    "detail": "Tooling only.",
    "build": "0.4.0.0878",
    "pullRequest": 225,
    "url": "https://github.com/cehinds/AshenSpire/pull/225"
  },
  {
    "id": "pr-221",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "buildversion selftest cleanup is deterministic on macOS",
    "detail": "Tooling only.",
    "build": "0.4.0.0878",
    "pullRequest": 221,
    "url": "https://github.com/cehinds/AshenSpire/pull/221"
  },
  {
    "id": "pr-223",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "Build-stamp browser fixture inputs repaired",
    "detail": "Tooling only.",
    "build": "0.4.0.0878",
    "pullRequest": 223,
    "url": "https://github.com/cehinds/AshenSpire/pull/223"
  },
  {
    "id": "pr-220",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "Friendly card targets are visibly distinct, on every input",
    "detail": "Cards that target you or an ally say so with the same clarity for mouse, keyboard, and pad.",
    "build": "0.4.0.0878",
    "pullRequest": 220,
    "url": "https://github.com/cehinds/AshenSpire/pull/220"
  },
  {
    "id": "pr-219",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "Combat fits short landscape screens",
    "detail": "Merged as pull request #219 in development build 0.4.0.0869.",
    "build": "0.4.0.0869",
    "pullRequest": 219,
    "url": "https://github.com/cehinds/AshenSpire/pull/219"
  },
  {
    "id": "pr-218",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "Guard absorption and residual damage show as separate floats",
    "detail": "What your block ate and what got through are two numbers, not one.",
    "build": "0.4.0.0867",
    "pullRequest": 218,
    "url": "https://github.com/cehinds/AshenSpire/pull/218"
  },
  {
    "id": "pr-217",
    "date": "2026-08-20",
    "group": "2026-08-20 — fifteen merges · 0.4.0.0850 → 0.4.0.0912",
    "summary": "Audio cues with optional samples stay immediate",
    "detail": "No late hit-sounds while an optional sample resolves.",
    "build": "0.4.0.0850",
    "pullRequest": 217,
    "url": "https://github.com/cehinds/AshenSpire/pull/217"
  },
  {
    "id": "pr-212",
    "date": "2026-08-19",
    "group": "2026-08-19",
    "summary": "The current dev Pages preview is surfaced in the README",
    "detail": "Docs only.",
    "build": "0.4.0.0841",
    "pullRequest": 212,
    "url": "https://github.com/cehinds/AshenSpire/pull/212"
  },
  {
    "id": "pr-210",
    "date": "2026-08-18",
    "group": "2026-08-18",
    "summary": "Hybrid combat input parity completed",
    "detail": "Mixing mouse, keyboard, and pad mid-combat keeps one coherent cursor and one set of affordances.",
    "build": "0.4.0.0841",
    "pullRequest": 210,
    "url": "https://github.com/cehinds/AshenSpire/pull/210"
  },
  {
    "id": "pr-206",
    "date": "2026-08-18",
    "group": "2026-08-18",
    "summary": "Text size scales text, and only text",
    "detail": "The accessibility text setting stops resizing non-text UI; UI size remains the whole-game control.",
    "build": "0.4.0.0835",
    "pullRequest": 206,
    "url": "https://github.com/cehinds/AshenSpire/pull/206"
  },
  {
    "id": "pr-203",
    "date": "2026-08-18",
    "group": "2026-08-18",
    "summary": "Native map pan belongs to the map again",
    "detail": "Merged as pull request #203 in development build 0.4.0.0828.",
    "build": "0.4.0.0828",
    "pullRequest": 203,
    "url": "https://github.com/cehinds/AshenSpire/pull/203"
  },
  {
    "id": "pr-201",
    "date": "2026-08-18",
    "group": "2026-08-18",
    "summary": "Escape during the tutorial cancels the right thing",
    "detail": "Merged as pull request #201 in development build 0.4.0.0822.",
    "build": "0.4.0.0822",
    "pullRequest": 201,
    "url": "https://github.com/cehinds/AshenSpire/pull/201"
  },
  {
    "id": "pr-202",
    "date": "2026-08-18",
    "group": "2026-08-18",
    "summary": "Map structure contrast is measurable — and raised",
    "detail": "Paths and nodes hold a checked contrast floor.",
    "build": "0.4.0.0807",
    "pullRequest": 202,
    "url": "https://github.com/cehinds/AshenSpire/pull/202"
  },
  {
    "id": "pr-199",
    "date": "2026-08-17",
    "group": "2026-08-17",
    "summary": "Combat HUD pages long strips and shows drag targets",
    "detail": "Merged as pull request #199 in development build 0.4.0.0807.",
    "build": "0.4.0.0807",
    "pullRequest": 199,
    "url": "https://github.com/cehinds/AshenSpire/pull/199"
  },
  {
    "id": "pr-200",
    "date": "2026-08-17",
    "group": "2026-08-17",
    "summary": "Map zoom and camera persist correctly",
    "detail": "Returning to the map returns to your zoom and place.",
    "build": "0.4.0.0799",
    "pullRequest": 200,
    "url": "https://github.com/cehinds/AshenSpire/pull/200"
  },
  {
    "id": "pr-186",
    "date": "2026-08-17",
    "group": "2026-08-17",
    "summary": "The verified current build lives at the repository root",
    "detail": "AshenSpire.html at the root is the same bytes as dist/, checked by tools/verify-shipped.mjs.",
    "build": "0.4.0.0788",
    "pullRequest": 186,
    "url": "https://github.com/cehinds/AshenSpire/pull/186"
  },
  {
    "id": "pr-180",
    "date": "2026-08-17",
    "group": "2026-08-17",
    "summary": "A reversible architecture map",
    "detail": "Docs only.",
    "build": "0.4.0.0777",
    "pullRequest": 180,
    "url": "https://github.com/cehinds/AshenSpire/pull/180"
  }
]);
