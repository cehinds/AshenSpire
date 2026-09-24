// GENERATED from /CHANGELOG.md by tools/about-changelog.mjs --write.
// Do not edit: the focused check refuses any drift from the authoritative Markdown.

export const GENERATED_CHANGELOG = Object.freeze([
  {
    "id": "pr-1287",
    "date": "2026-09-24",
    "group": "2026-09-24",
    "summary": "Fights and rewards hit harder",
    "detail": "A boss now lays out three different boss relics and you keep one, as the rules always promised. Elites open a chest: choose one of three big rewards — a relic, an upgraded card, an armament or weapon art, or a purse of cinders and a Smithing Stone. Card rewards now remember bad luck: every common raises your next rare chance, and four offers in a row without a rare guarantee one. Every weapon fills an Art charge as its cards land hits; when the pips are full, its next Weapon Art is unleashed with an extra effect printed on the card. Weapons carry scaling grades (S to D), so points above 3 in the right attribute visibly raise that weapon's damage, and the Shrine's Level up shows exactly what each point changes before you assign it (\"Slashing Strike 8 → 10\"). Reaching a level after a fight now announces itself. Heavy hits and Staggers briefly freeze the fighters, killing an elite or boss slows into a short kill cam (its own setting; off under reduced motion), and damage numbers grow with the size of the hit. Co-op seats get all of it too: their own Art meters, their own elite chest, and the same freeze and kill cam.",
    "build": "0.7.1.477",
    "pullRequest": 1287,
    "url": "https://github.com/cehinds/AshenSpire/pull/1287"
  },
  {
    "id": "pr-1267",
    "date": "2026-09-24",
    "group": "2026-09-24",
    "summary": "Behind the scenes: the automated checks cost less and one of them runs again",
    "detail": "Nothing you see in the game changes. The repository's automated jobs now share one Node version and stop downloading the full game build on jobs that never open it, two orphan files are gone, and the architecture report that had crashed on every merge since the file list outgrew a buffer runs to its answer again.",
    "build": "0.7.1.449",
    "pullRequest": 1267,
    "url": "https://github.com/cehinds/AshenSpire/pull/1267"
  },
  {
    "id": "pr-1266",
    "date": "2026-09-24",
    "group": "2026-09-24",
    "summary": "Every character can dodge, and a fresh character is no longer Heavy",
    "detail": "Holding equipment used to cost you the Dodge Roll: a Reaver or Rogue who started with both hands armed had none, and a character who emptied both hands lost it too. Every deck now carries exactly one Dodge Roll whatever you hold — your bare hand owns it, or your body when both hands are full — and like every card your equipment brings it is dealt first, with Strikes and Defends filling what the starting deck has left. Item weights were also still on the old attribute scale, so every new character started Heavy (dodges cost 3 Stamina and 2 Actions); they are now a fifth of what they were, so class starts read Light or Medium again and the heaviest kits still reach Heavy. Behind the scenes, every test file in the project now runs on every pull request, in a fast suite and a separate self-test job, and eight suites that had quietly gone out of date were brought back to the rules as they stand.",
    "build": "0.7.1.446",
    "pullRequest": 1266,
    "url": "https://github.com/cehinds/AshenSpire/pull/1266"
  },
  {
    "id": "pr-1265",
    "date": "2026-09-24",
    "group": "2026-09-24",
    "summary": "A written plan for polish, feel and structure",
    "detail": "Nothing you see changes yet. Seven reviews of the game — its rules and balance, its world and writing, how it looks and feels in a fight, how its sprites and art are sized and lit, how it fits phones, tablets and large screens, how its code is laid out, and how fast it loads and runs — are now one checklist in the repository, docs/plan-polish-review-2026-09.md, ordered by what to fix first: a Starseer that won none of its simulated runs (a result to confirm once the simulator plays by the live rules) and the Stamina and Mana pools that may be starving it, the test suites that never run, a card play that takes more than a second to land, text that shrinks to six pixels on a tablet, names borrowed from other games, and a 253 MB page that is almost all inlined art. Each item carries its evidence and its size, and the design choices that are the owner's to make are marked as such.",
    "build": "0.7.1.444",
    "pullRequest": 1265,
    "url": "https://github.com/cehinds/AshenSpire/pull/1265"
  },
  {
    "id": "pr-1254",
    "date": "2026-09-24",
    "group": "2026-09-24",
    "summary": "New players start with the owner's chosen defaults",
    "detail": "Rewards are collected by hand rather than all at once, a Shrine stays open for Rest, Smith and Level until you leave, and flasks can be drunk from the map. The city title holds for 2 seconds, and the short-screen warning is off, so a sideways phone draws the board anyway. Settings you have already chosen keep their values.",
    "build": "0.7.1.443",
    "pullRequest": 1254,
    "url": "https://github.com/cehinds/AshenSpire/pull/1254"
  },
  {
    "id": "pr-1264",
    "date": "2026-09-23",
    "group": "2026-09-23",
    "summary": "Card lore is one line in inspection, and the whole of it opens in its own window — set in the type you choose",
    "detail": "Inspect any card and its lore is a single line: what the thing is and whose (Art of the sellswords of the Bastion.). Press it and the lore window opens over the card with the full description — a little history, told from one side, and a closing line set apart. Every card's lore has been rewritten this way. A new Advanced tab, Text & lore, sets how it reads: the typeface (eight faces now ship with the game, plus Georgia), size, letter and line spacing, and italic or upright, with the identity line and the lore window each adjustable. Interface text size and readable headings stay where they were, under Accessibility. No card's rules or numbers changed.",
    "build": "0.7.1.441",
    "pullRequest": 1264,
    "url": "https://github.com/cehinds/AshenSpire/pull/1264"
  },
  {
    "id": "pr-1261",
    "date": "2026-09-23",
    "group": "2026-09-23",
    "summary": "Towns keep a quest board, and taking or turning in a quest is a conversation",
    "detail": "Every town's inn now has a Quest board beside its rest: it lists the quests posted anywhere in town, whether each can be taken, is under way, is ready to hand in or is done, and a journal of the quests your run has started and finished — the Grave of the Nameless as well as the wardens' surveys. The warden's spot on the town map opens the same board. Taking a quest or turning one in is no longer a button press: the Road Warden speaks, and you answer — Accept the quest or Not now, and on your return, after the report of what you found, Collect 25 cinders. A quest pays its reward once, even across a reload, and shows as done on the board afterwards. Reading the board costs nothing; the inn's rest is still waiting when you close it.",
    "build": "0.7.1.439",
    "pullRequest": 1261,
    "url": "https://github.com/cehinds/AshenSpire/pull/1261"
  },
  {
    "id": "pr-1252",
    "date": "2026-09-23",
    "group": "2026-09-23",
    "summary": "Every stat has one topic in Settings, and each one shows its sum as you change it",
    "detail": "Actions, Draw, HP, Stamina, Mana, Poise and Ward were spread over Hand & Draw, Stats & Defence, Character & progression's stat formulas and the Poise, stagger and Mana rows under Combat. Advanced now has one Stats tab with a topic for each trait, and each topic holds all of it under short headings: its formula (a starting value, what each attribute point is worth, and what each level adds), its rating formula, its resistance and break rows, and for Poise and Draw the older rows used only when ratings are off or in co-op. Draw & hand keeps the opening hand, turn draws, hand capacity and discards together. Above the controls, a worked example shows the whole calculation and total for your current character, or outside a run for a new character of the class you pick, with starting relics included — for example HP at level 1: 30 base + 10 from Forsaken Medallion + CON 2 × 4 → 8 = 48. It updates as soon as you change a number, says how many more points of an attribute would raise the stat, and Overview shows the full stat block. Labels now name the trait and what the number buys (HP per Constitution point, Opening hand — Base cards).",
    "build": "0.7.1.437",
    "pullRequest": 1252,
    "url": "https://github.com/cehinds/AshenSpire/pull/1252"
  },
  {
    "id": "pr-1260",
    "date": "2026-09-23",
    "group": "2026-09-23",
    "summary": "A class or item's own value wins over the shared one, by a switch, and a setting that does nothing right now is greyed out",
    "detail": "Starseer and Herald's own reward rarity, Reaver and Starseer's own strike bias, and each item's own equipment requirement now each have a uses its own switch, directly above the numbers it governs. Turn one off and that class or item follows the shared value; the greyed-out number shows the value it is following, so the number you see is always the one in use, and the one you typed comes back when you turn the switch on again. Settings that do nothing in the current setup are greyed out too, with a line saying which switch turns them on: every combat rating while ratings are off, the older poise settings and the Poise pool while ratings are on, equipment drop numbers while drops are off, extra card mounts, the swap costs for rules you are not using, and formation movement's own settings while movement is off. A value stored in a greyed-out setting is set aside rather than applied, so it can no longer make the game throw out the rest of your configuration. No setting lost its value, and configuration files you exported before still import.",
    "build": "0.7.1.427",
    "pullRequest": 1260,
    "url": "https://github.com/cehinds/AshenSpire/pull/1260"
  },
  {
    "id": "pr-1253",
    "date": "2026-09-23",
    "group": "2026-09-23",
    "summary": "HP, Mana and every resource now read the way AR, DR and PR do — and all of them sit in one place in Settings",
    "detail": "Each stat is a starting value plus a number for each attribute that says what one point of it is worth: HP is 30 plus 4 per Constitution, Mana 1 plus 1 per Wisdom, Actions 3 plus one for every five Dexterity. Growth per level is a single decimal too, so HP now climbs by 1 every level instead of 5 every fifth level (the same rate, arriving a level at a time); Mana, Stamina and draw still grow on exactly the levels they did. Advanced → Progression now reads top to bottom as Assign points, Level-up, then Stats & resources, which holds every resource's base, per-attribute values and growth per level with the five rating formulas right beside them. The Stat points per tier setting is gone — every stat now says exactly what each point of each attribute is worth, which is what that dial approximated for all of them at once; a character already climbing keeps the numbers it started with, including one started under that dial.",
    "build": "0.7.1.407",
    "pullRequest": 1253,
    "url": "https://github.com/cehinds/AshenSpire/pull/1253"
  },
  {
    "id": "pr-1258",
    "date": "2026-09-23",
    "group": "2026-09-23",
    "summary": "Every card now carries its own piece of the world's history",
    "detail": "Open a card and unfold its Flavor panel: all 195 combat cards and the 17 basic weapon cards — the Strikes, Guards and Techniques your weapon gives you — now have a short description told by someone who was there. A Warden's field-book, a Fell Courtyard gate log, a Court surgeon's receipt, the Astronomer's chart margins, a Chapel rubric, a sermon of the Feral Ember, the Tollmouth fence, a hamlet council: each speaks for itself, signs its name, and is mostly right, partly partisan and partly silent. Read together they span the kingdom from the Cinderwrights to the Long Winter, and they disagree. The panel now keeps paragraph breaks. No card's rules or numbers changed.",
    "build": "0.7.1.405",
    "pullRequest": 1258,
    "url": "https://github.com/cehinds/AshenSpire/pull/1258"
  },
  {
    "id": "pr-1255",
    "date": "2026-09-23",
    "group": "2026-09-23",
    "summary": "You can go back to your points after Continue, and a saved fight keeps its own rules",
    "detail": "Once you had placed your points and pressed Continue there was no way back to them short of changing class, even when an item you wanted asked for more than you had given it; an Edit points button now reopens the editor with your numbers still on it, and Cancel puts them back. The equipment screen stops refusing a +1 weapon you can in fact hold. A fight saved before its rules were written into the save reopens under the rules your run was born with rather than today's table, and a run from before the attribute rebase keeps the Poise its Constitution gave it, and an Advanced preset that cannot wear its class's starting armour is refused in Settings, by name, instead of being accepted and then discarded at the next start.",
    "build": "0.7.1.403",
    "pullRequest": 1255,
    "url": "https://github.com/cehinds/AshenSpire/pull/1255"
  },
  {
    "id": "pr-1243",
    "date": "2026-09-23",
    "group": "2026-09-23",
    "summary": "Every setting in Advanced now says what it does, and the sentence sits beside its number",
    "detail": "The 792 balance rows under Advanced had readable names, but the line under each name was still the same five words, Applies to a new run, on nearly every one. That includes the 486 card-value rows — what each Action, Mana and Stamina a card costs is worth, the weight of each status it applies, and each card's own bonus — which now say which of a card's numbers they set: a physical attack's damage, a physical card's Block, a magic card's damage and Block, or an attack's impact. Now each row has its own sentence saying what the number does and what it means for a climb. Some examples: the merchant's buy-back is a fraction of the cheapest he would sell the same kind for, so below 1 selling always loses on the trade. Iron Footing is a tier-1 Reaver talent, and this row sets the Block it grants. A flask's drop chance falls after a drop and rises after a miss, and this row sets how far. The six legacy Poise and stagger rows say they only work while combat ratings are off, and name the rating row that takes over when they are on. The swap-cost numbers say which rule they price, and that choosing the rule is Weapon swap cost's job, not theirs. Two rows say plainly that nothing reads them, rather than promising to apply to a new run. The sentences are written beside their numbers in the balance table itself, so whoever changes a number reads what it does in the same place, and a test fails if a number is renamed and its sentence left behind. Names come from the game: renaming a relic renames its rows, and a new relic describes itself.",
    "build": "0.7.1.395",
    "pullRequest": 1243,
    "url": "https://github.com/cehinds/AshenSpire/pull/1243"
  },
  {
    "id": "pr-1259",
    "date": "2026-09-23",
    "group": "2026-09-23",
    "summary": "Two cards that share a name are told apart in settings",
    "detail": "Under Stats & Defence → Attack overrides, the Reaver's own Enter: Bulwark and the one the Guardian shield makes for any class had rows with the same name, and so did the Rogue's Hamstring attack and the Hamstring skill anyone can take — so there was no telling which card a change went to. Where two cards share a name the row now says whose each is: Enter: Bulwark (Reaver) beside Enter: Bulwark (All classes), Hamstring (Rogue) beside Hamstring (All classes). Every other card keeps its plain name, and no setting changed its value or key. With this, no two rows anywhere in Advanced read the same.",
    "build": "0.7.1.394",
    "pullRequest": 1259,
    "url": "https://github.com/cehinds/AshenSpire/pull/1259"
  },
  {
    "id": "pr-1256",
    "date": "2026-09-23",
    "group": "2026-09-23",
    "summary": "Advanced settings: every setting has one home, and rows that did nothing are gone",
    "detail": "Advanced had sixteen tabs, and several settings showed up in two places or quietly overrode each other. It now has thirteen. Rules, Gameplay and Tuning are gone, and each of their settings moved to the subject it changes. Skills, talents and experience are under Character & progression. Relic values join equipment in a new Equipment & relics tab. Rest, co-op, gauntlet and endless are in Run & world. Formation and movement have their own Battlefield tab. Card sizes and the settings window sit with the wireframe choices in Layout. Where two settings still touch the same number, they now sit together and each says which one wins. The older poise settings are next to the Stats & Defence rows that replace them while ratings are on. The fallback hand size is under Hand & Draw. Stat points per tier leads the per-stat tiers it overrides. The weapon swap-cost rule sits with its costs. Settings that changed nothing are off the screen: class Base HP (a new run's HP comes from the HP stat conversion), the level-up and tier-size limits, enemy level scaling, the per-turn swap allowance, and Seed in map header. Cinder / experience gain multiplier is now Cinder gain multiplier, because it never changed experience. No working setting changed its value or key, and a configuration file you exported before today still imports.",
    "build": "0.7.1.392",
    "pullRequest": 1256,
    "url": "https://github.com/cehinds/AshenSpire/pull/1256"
  },
  {
    "id": "pr-1247",
    "date": "2026-09-23",
    "group": "2026-09-23",
    "summary": "Every card now starts from what it costs, and every part of that calculation is yours to tune",
    "detail": "Attack damage, Block, Poise pressure and Ward pressure are now derived from a card's Actions, Mana and Stamina instead of being unrelated numbers: each has its own global multiplier, one multiplier for each resource, and a reduction for every distinct status the card applies. Physical attacks use AR, physical Block uses DR, magical damage and Block use PR, and a card's physical or magical impact uses Poise or Ward — except a physical hit a weapon lends, which still lands as heavy as the weapon, so a dagger and a warhammer do not stagger alike. A staff or sceptre makes its Strike, Defend and technique magical, and those follow PR and Ward too. Every shipped status has its own reduction multiplier, and every applicable card has a signed bonus after the shared calculation, all under five new groups in Advanced → Combat. The defaults reproduce every card's existing damage, Block and poise-damage numbers exactly, base and upgraded; moving a shared multiplier recalculates the whole matching card set deterministically. What an untouched game does change is impact: a card hit now lands its Poise or Ward value instead of a flat 1, so a cheap card or one that applies statuses can land none, while a weapon's hit keeps its weight and a card that deals its own poise damage keeps the old default beside it. X-cost cards still repeat once per Action spent, added statuses enter with a safe zero reduction, magic follows the same tags in calculation and combat, and a run or saved fight keeps the settings it started with.",
    "build": "0.7.1.390",
    "pullRequest": 1247,
    "url": "https://github.com/cehinds/AshenSpire/pull/1247"
  },
  {
    "id": "pr-1251",
    "date": "2026-09-23",
    "group": "2026-09-23",
    "summary": "Each class's starting armour is told apart from the set piece it shares a name with",
    "detail": "Under Ratings & Resistance → Armour ratings, every class listed its armour twice under one name: the Reaver starts in a plain Wayfarer Plate, and the Wayfarer Plate set (+2 Block, +4 max HP) is a different item any class can earn — but both rows read Wayfarer Plate (reaver), so there was no telling which one a change went to. The starting one now says so: Wayfarer Plate (Reaver, starting armour) beside Wayfarer Plate (Reaver), and the class is spelled the way the rest of the menu spells it. No setting changed its value or key.",
    "build": "0.7.1.386",
    "pullRequest": 1251,
    "url": "https://github.com/cehinds/AshenSpire/pull/1251"
  },
  {
    "id": "pr-1244",
    "date": "2026-09-23",
    "group": "2026-09-23",
    "summary": "The menu button in character creation opens a menu you can see, and closes it again",
    "detail": "The ☰ in the creation header looked dead. The menu did open every time, at the right size with every category live, but it was drawn off the edge of the screen — further off the larger your window and your UI size, and on a 1920x1080 display not one pixel of it was visible. It now hangs under the ☰, its right edge on the button's, the way the map's menu does. Pressing ☰ again now puts it away: before, a second press closed the menu and re-opened it in the same moment, so once it was open it stayed open. On a window too short for the four categories the menu still opens under the button and scrolls inside itself, rather than covering the button or putting Review out of reach. The menu is placed when it opens, so resizing the window while it is open leaves it where it was until you open it again.",
    "build": "0.7.1.384",
    "pullRequest": 1244,
    "url": "https://github.com/cehinds/AshenSpire/pull/1244"
  },
  {
    "id": "pr-1242",
    "date": "2026-09-23",
    "group": "2026-09-23",
    "summary": "Every weapon's and every set's ratings are yours to set, and the number you type is the number the card shows",
    "detail": "Advanced → Ratings & Resistance had a row for each item's AR, DR, PR, Poise and Ward, and every one of them was an extra stacked on top of whatever the item already had — so typing 3 into the straight sword's row made it fight at 5 while its card still said 2, and there was no way to make a weapon weaker than it was authored. Those rows are the item's own numbers now. Each opens on the value the item ships with, and whatever you leave there is that item's rating everywhere: on its card, in the Armoury comparison, and in the fight, with your attributes, relics and any status bonuses added on top of it exactly as before. Set the straight sword to 4 and it is a 4-Attack sword that your Strength still improves, on the card it prints and on every Strike it lends; a staff at 1 carried by a caster with +2 from Wisdom and Intelligence rates 3 on every card that reads it. A weapon's Attack Rating is read as AR when it swings and as PR when it casts, so a staff or sceptre is tuned on its PR row and a blade on its AR row — the row that has nowhere to print on the card says so itself. Numbers you had already tuned are kept: an old extra is read as the total it used to make, in your profile and in any configuration file you exported before today, which still imports — and where it cannot be kept exactly (a fraction, or armour Poise, which is also what a set weighs) the game says so. These rows only apply while ratings are switched on. A climb already in progress keeps the rules it was born under.",
    "build": "0.7.1.382",
    "pullRequest": 1242,
    "url": "https://github.com/cehinds/AshenSpire/pull/1242"
  },
  {
    "id": "pr-1250",
    "date": "2026-09-21",
    "group": "2026-09-21",
    "summary": "An enemy's move is spelled the same in settings as in the fight",
    "detail": "The last settings pass lowered the second word of every enemy move under Enemy attack types, so the Wyrm Aspirant's Halberd Sweep — which is what its move card, its intent and its history call it in combat — read Halberd sweep type in settings. A move is a name, so the settings row now spells it exactly as the fight does: Wyrm Aspirant — Halberd Sweep type. The field names beside it stay as phrases — Poise action loss, Recovery per turn — because those are descriptions, not names. No setting changed its value or key.",
    "build": "0.7.1.380",
    "pullRequest": 1250,
    "url": "https://github.com/cehinds/AshenSpire/pull/1250"
  },
  {
    "id": "pr-1249",
    "date": "2026-09-21",
    "group": "2026-09-21",
    "summary": "Settings rows the game names for itself now read like the ones written by hand",
    "detail": "Three tabs under Ratings & Resistance spoke in two voices at once. Break threshold multiplier sat two rows from Poise Action Loss and Recovery Per Turn; Magic impact sat beside Enemy Physical. The difference was not a decision anyone made — a row named by a person got a sentence, and a row the game named for itself got every word capitalised, and both kinds share these lists. Enemy attack types was the worst of it, because seventy of the enemy moves have no written-out name at all, so the internal spelling is the label: Halberd Sweep type next to Slash type, with nothing but how the move happened to be typed deciding which. Now the thing a row belongs to is still a name — Wyrm Aspirant — and the row itself is a phrase: Poise action loss, Recovery per turn, Enemy physical, Wyrm Aspirant — Halberd sweep type. Nothing else moved: an acronym stays an acronym, and no setting changed its value, its key or where it lives.",
    "build": "0.7.1.378",
    "pullRequest": 1249,
    "url": "https://github.com/cehinds/AshenSpire/pull/1249"
  },
  {
    "id": "pr-1248",
    "date": "2026-09-21",
    "group": "2026-09-21",
    "summary": "Every combat rating now shows its complete calculation",
    "detail": "AR, DR, PR, Poise and Ward used to stop at a total, leaving no way to tell which attribute, weapon, shield, armour or relic produced it. Open Show calculations on the character review or in the Armoury and each rating now names the attribute values it read, their weights, each contribution rounded down on its own, the global multiplier, the base, every named equipment or relic addition, and the final result. A Reaver's AR now reads Strength 3 × 0.5 → floor = 1, then 0 base + floor(1 global × 1) + 2 Straight Sword = 3; DR, PR, Poise and Ward follow the same receipt instead of asking the player to trust five unexplained numbers. A configuration with no weighted attributes says so plainly and calculates from zero instead of printing an empty formula.",
    "build": "0.7.1.376",
    "pullRequest": 1248,
    "url": "https://github.com/cehinds/AshenSpire/pull/1248"
  },
  {
    "id": "pr-1246",
    "date": "2026-09-21",
    "group": "2026-09-21",
    "summary": "Weapon cards now show and deal one direct calculation, with no hidden equipment tiers",
    "detail": "Slashing Strike, Shield Defend and weapon techniques now read exactly as card base + that weapon or shield's rating + rarity: a straight sword with 3 AR makes Slashing Strike 5 + 3 + 0 = 8, while a shield with 5 DR makes Shield Defend 3 + 5 + 0 = 8. The removed tier and points-per-tier layer can no longer inflate, suppress or obscure those numbers, and another equipped item cannot lend its rating to the wrong card. Weapon AR now lives in the intended 0–4 range, every technique explicitly names the rating it uses, and the same result is preserved in previews, live combat, co-op, capped profiles, customized profile snapshots and older saves.",
    "build": "0.7.1.374",
    "pullRequest": 1246,
    "url": "https://github.com/cehinds/AshenSpire/pull/1246"
  },
  {
    "id": "pr-1245",
    "date": "2026-09-21",
    "group": "2026-09-21",
    "summary": "The character summary is a real card hand, and every stat can be read",
    "detail": "The character card's lower numbers used to wrap as loose chips until the last line was cut through, while the armour, weapons and relic beside it had the card interaction the stat card was missing. Primary and derived stats now use the same aligned grid: HP, MP, SP and AP stay compact, six headline values fit on the face, and an ellipsis says when the full card has more. Every card in the summary now behaves alike: select it and the card moves down, leaving its information control on the layer above. The full character card keeps the normal card shape, spells out every acronym — Strength (STR), Health Points (HP), Attack Rating (AR) and the rest — and its inspection scrolls as one page instead of stretching the card or cutting the calculations off.",
    "build": "0.7.1.372",
    "pullRequest": 1245,
    "url": "https://github.com/cehinds/AshenSpire/pull/1245"
  },
  {
    "id": "pr-1241",
    "date": "2026-09-21",
    "group": "2026-09-21",
    "summary": "Advanced settings read as one menu again",
    "detail": "Half the rows in Advanced were named by a person — HP — base amount, Reaver — Strength — and the other half were named by the game, out of the setting's own internal spelling, so hand Max and levels · player Starting Level sat two rows under HP — base amount in the same list. Worse, twelve rows under Enemy scaling were all called Per Level, because only the last word of the name was ever used and the screen was patching the rest back in afterwards. Every row is now named once, in one place, and in the voice the hand-written ones always used: the thing a row belongs to is a heading — Levels · Enemy Scaling — and the row itself is a phrase — Hand max, Starting cinders, HP — Per level — which is how Resistance cap and Strength required have always read. A group no longer repeats its own name in every line beneath it, whether that name is one word or three: the Reaver tab simply lists Strength, Dexterity, Base HP, Equipment drops lists Enabled and Chance — Treasure, and Skill xp lists Base and Growth. Poise and Ward are spelled like the words they are instead of shouting POISE and WARD across seven hundred rows. Two rows have left the screen: energy and draw under Starting values, which looked like they set your actions and your opening hand and set nothing at all — the rows that really do are Actions and Draw under Stat conversions, a group away, which is why the two never agreed. Retiring them also takes them out of Reset this group, so a profile that already stored one keeps it, invisible and inert. A settings file that still names the old two loads exactly as before.",
    "build": "0.7.1.367",
    "pullRequest": 1241,
    "url": "https://github.com/cehinds/AshenSpire/pull/1241"
  },
  {
    "id": "pr-1240",
    "date": "2026-09-21",
    "group": "2026-09-21",
    "summary": "Every stat is one calculation now, and the numbers on the settings rows are the numbers you get",
    "detail": "Every formula in the game used to divide your attributes by a conversion scale before reading them, so the character being scored was never the character on the sheet — a Starseer showing 8 Intelligence was scored as though it held 23, and Ward read 32 where the settings row that set it promised 9. That divisor is gone from the game. One calculation now answers for all of it: a base, plus each attribute's contribution rounded down on its own, times a multiplier for that stat and one for all of them. A weight of 0.25 means four points buy 1 and gives nothing before the fourth; both multipliers start at 1 and change nothing until you move them. The bases are stated where you can see and move them: HP opens at 30, Actions and your hand at 3, Mana, Stamina, Poise and Ward at 1, AR and DR at nothing — a Reaver opens the climb on 48 HP, 2 Mana, 3 Stamina, 3 Actions and a hand of 3, and every one of those numbers is a row in Settings read against the attributes on its own sheet. Three rows went with the divisor: each rating's points per increase and gain, replaced by the multipliers, and Automatically scale stat conversions, which has nothing left to switch. A configuration file carrying any of them still imports, with a note naming what was skipped. A climb already in progress keeps the rules it was born under.",
    "build": "0.7.1.365",
    "pullRequest": 1240,
    "url": "https://github.com/cehinds/AshenSpire/pull/1240"
  },
  {
    "id": "pr-1239",
    "date": "2026-09-21",
    "group": "2026-09-21",
    "summary": "The opening's buttons stay at the bottom, and thirty more things about a scene are yours to set",
    "detail": "Continue and its neighbours used to live inside the caption, so choosing a wireframe that floats the words over the artwork floated the buttons into the middle of the picture with them. They now sit in a band along the bottom of the screen — wherever the words go — with the scene counter beside them, and you can set their alignment, their size, whether Pause and Skip opening appear at all, whether clicking the picture continues, or put them back under the text if you preferred that. Everything else is new range on what a scene looks like, and all of it can be set for the whole opening or for one scene on its own: the painting's brightness, contrast, colour and blur, mirrored or not, with a vignette, a backdrop colour and a letterbox bar colour; a transition length per scene instead of one for the whole opening, with easing for it and for the camera; the title, speaker and location shown or hidden, each with its own colour, with separate title and speaker sizes, line spacing, letter spacing, line length, a choice of typeface, and a pause before the words arrive at all; and for the container behind the text, padding, corner radius, border, and a blur that frosts the artwork behind the words instead of covering it. The scene counter can be numbers, dots or nothing. One fix found by photographing the opening for the first time: a scene reached while the game sat in a background tab was drawn as words over black, because its artwork was still waiting to fade in — it is drawn finished now.",
    "build": "0.7.1.361",
    "pullRequest": 1239,
    "url": "https://github.com/cehinds/AshenSpire/pull/1239"
  },
  {
    "id": "pr-1238",
    "date": "2026-09-21",
    "group": "2026-09-21",
    "summary": "Characters start small: one point in every stat, three to place, and Settings can move every part of it",
    "detail": "Creation used to open every attribute at 5 and hand you ten points, on a scale that ran 3 to 12 — wide enough that a single point rarely changed anything you could feel. A new character now opens at 1 in all five and has three points to assign, anywhere in 1 to 4. Your character is not weaker for it: a point of the new scale is worth a whole step of the old one, so assigning nothing leaves you with exactly the health, actions, cards, Mana and Stamina you opened with before — and each of the three points you do place is a real step, not a fraction of one. Equipment asks less to match: the straight sword wants 2 Strength where it wanted 5, the Ash Focus staff 3 Intelligence where it wanted 8, and every outfit and heavier weapon has come down the same way. Advanced → Progression → Assign points used to offer two numbers and now offers the six the scale is actually made of — the value every attribute starts at, the points available to assign, the total a character carries, the lowest a stat can be set to, the highest it can be raised to at creation, and whether points can be taken back off a stat. Type a starting value and the total follows it; leave it alone and the total drives, exactly as it used to, so a configuration you exported earlier still means what it meant. Beneath it a new Equipment requirements group holds one row for every armament and outfit minimum in the game plus a single multiplier for the whole table — they are the floor under everything above, since a class has to be able to hold the kit it starts in, and the Total row says so by name when it refuses a number. Every stat card, at creation and at a shrine, now reads the numbers your run is actually using instead of the authored table, so a Constitution card says what a point of your Constitution buys. Characters already climbing are untouched — a run keeps the rules it was born under.",
    "build": "0.7.1.359",
    "pullRequest": 1238,
    "url": "https://github.com/cehinds/AshenSpire/pull/1238"
  },
  {
    "id": "pr-1235",
    "date": "2026-09-21",
    "group": "2026-09-21",
    "summary": "Settings now lets you choose the wireframe modal windows, menus and scenes draw",
    "detail": "Several of the layouts the game is drawn from leave a decision open, and until now the game answered each one for you. Settings → Advanced → Wireframes hands those answers back, in three groups with a drop down each: Modals sets how wide a window opens (one step narrower or wider than it asks for) and how far the buttons along its bottom run; Menus sets whether a categorized menu draws its categories as a rail down the left or as one selector above the pane, instead of choosing by how much room there is, and how much of the screen a workspace takes; Scenes sets whether a fight or a conversation paints its backdrop at all, and whether that painting is cropped so its ground line meets the floor band or simply centred — a fight or conversation on screen changes with it too. Every one of them starts on As designed, which is the game exactly as it was, and changing a window or menu answer redraws the windows already open — including the Settings window you changed it in. Where the fighters stand is set by the formation and does not move either way.",
    "build": "0.7.1.356",
    "pullRequest": 1235,
    "url": "https://github.com/cehinds/AshenSpire/pull/1235"
  },
  {
    "id": "pr-1237",
    "date": "2026-09-21",
    "group": "2026-09-21",
    "summary": "The opening is staged scene by scene, and you can build one without leaving Settings",
    "detail": "Advanced → Opening now lists the opening as a list: drag a scene, or use its arrows, to change where it plays, switch one off, duplicate one, or add a new one — four empty scenes are kept for that, and a new scene starts as a text card with no painting until you give it one. Each scene can also stop following the opening's house style: turn on Use its own staging and that scene alone decides its frame, its artwork scale, fit and focus, its colour wash, and everything about its text. One scene can be letterboxed while the rest fill the screen. New for every scene: a camera that drifts in, out or across while the scene holds, with a distance you set; music that changes from that scene onward, or a sound it opens on; a hold that waits for Continue however the rest of the opening is paced; and narration that can arrive letter by letter or a line at a time, at a speed — always in full for a screen reader, and always whole when Reduced motion is on. Floating text takes an inset, so it can keep clear of a face in the painting without moving somewhere else. Three named slots park a whole opening in your profile, so you can keep two and switch between them with a button; slots travel in your configuration file like everything else. The last scene of the night keeps its darker wash, which used to be a rule in the code and is now simply that scene's own setting — so borrowing that painting for another scene no longer washes it out.",
    "build": "0.7.1.354",
    "pullRequest": 1237,
    "url": "https://github.com/cehinds/AshenSpire/pull/1237"
  },
  {
    "id": "pr-1236",
    "date": "2026-09-20",
    "group": "2026-09-20",
    "summary": "You can now stage the opening: what plays, in what order, over which painting, in which frame",
    "detail": "Advanced → Opening could change what a scene said; how it was presented was fixed. Each scene now has a switch that keeps it in or leaves it out, a position that decides when it plays, a painting chosen from every one the game ships — including the forest road, whose artwork has been sitting unused since that scene was cut — and an optional title banner across the art. The frame around it all is yours too: the caption under the art as before, or the words over the art, a letterboxed plate, or a panel beside it; the painting's scale, whether it crops or fits, and which part of it stays in frame; and for the text, where it sits, how it lines up, how large it is, whether it has a container behind it, whether that container can be seen, how solid it is, what colour it is, and whether every letter carries an outline — colours picked from the game's palette or from the colour wheel. Export scene configuration writes the opening to a file of its own, and Load scene configuration reads it back; the same settings also travel inside the whole game configuration, so a backup of one is a backup of both. An opening you had already tuned is untouched, and a run paused mid-opening resumes where it stood — on the next scene still in it, if the one it stopped on has been switched off.",
    "build": "0.7.1.350",
    "pullRequest": 1236,
    "url": "https://github.com/cehinds/AshenSpire/pull/1236"
  },
  {
    "id": "pr-1234",
    "date": "2026-09-20",
    "group": "2026-09-20",
    "summary": "Two downloads of every build: the full game, and a mobile edition under 50 MB",
    "detail": "The single self-contained file had grown to 253 MB, which on a phone is the whole cost of starting. Every build now ships twice. The full file is unchanged. The mobile file, AshenSpire-mobile.html, is the same build with every image shrunk to half size and recompressed, held under 50 MB by a gate that refuses to write or ship a larger one; it plays the same, looks softer, and Settings → About names it the mobile edition. The builds site offers Download full and Download mobile with their sizes on every card and in every table, serves the mobile file at /<branch>/<build>/mobile/, and says plainly when an older build predates the edition instead of faking a link. Saves carry between the two.",
    "build": "0.7.1.344",
    "pullRequest": 1234,
    "url": "https://github.com/cehinds/AshenSpire/pull/1234"
  },
  {
    "id": "pr-1232",
    "date": "2026-09-20",
    "group": "2026-09-20",
    "summary": "The victory screen shows what the fight did to your character",
    "detail": "Winning a fight has always raised your level and the skills you fought with — but the spoils door listed only the things you pick up, so none of it was visible. Above the claim list there is now a Progression panel: your character level with a bar toward the next one and the experience this fight paid, then the skills it moved — the ones it paid first, the ones you have taken furthest after, up to three, with the rest counted on a line of their own. The numbers are the ones already written when the fight ended, so leaving and coming back to an interrupted spoils door shows the same ones.",
    "build": "0.7.1.341",
    "pullRequest": 1232,
    "url": "https://github.com/cehinds/AshenSpire/pull/1232"
  },
  {
    "id": "pr-1229",
    "date": "2026-09-20",
    "group": "2026-09-20",
    "summary": "Picking a node on the map brings it to the middle of the screen",
    "detail": "Selecting a room used to open the tray and throw the act into the right half of the screen; the camera moved down to the node you picked and never across to it. It now centres the picked node on both axes, in the part of the map the open tray leaves visible, and glides back the same way when you close the tray. ⊙, the zoom buttons and a drag also take effect straight away while that camera move is still running, instead of being undone by it. The map's own panning, zoom and saved camera are otherwise unchanged.",
    "build": "0.7.1.339",
    "pullRequest": 1229,
    "url": "https://github.com/cehinds/AshenSpire/pull/1229"
  },
  {
    "id": "pr-1233",
    "date": "2026-09-20",
    "group": "2026-09-20",
    "summary": "The merchant shows four cards at once, and a card is no longer a small picture in a big empty box",
    "detail": "Every shelf at the merchant — cards, armaments, weapon arts, relics, flasks and what he will buy — now lays its stock out four across and wraps below, instead of one or two per row with the rest behind a scroll. An armament for sale is the card itself: the panel that used to stand around it, twice its width and mostly empty, now appears only under the pointer, under keyboard focus, or on the offer being described beside the shelf. The offers column takes the room a shelf of cards needs, and the description column keeps a readable minimum. On a phone the same shelves show two across at the card's full size. Every card on a shelf is the same width, including the last row. The deck list a smith shows when seating a card follows the same rule.",
    "build": "0.7.1.337",
    "pullRequest": 1233,
    "url": "https://github.com/cehinds/AshenSpire/pull/1233"
  },
  {
    "id": "pr-1228",
    "date": "2026-09-20",
    "group": "2026-09-20",
    "summary": "Your level and every skill you are training now have bars you can watch",
    "detail": "The Armoury's Character page named your level and showed nothing of the climb. A gold bar now sits under your class description with the XP you have toward the next level, and says so when a point is waiting to be assigned at a shrine. Below it, a new Skill progression section lists your class ladder and every track you have actually trained — a weapon group, an armour weight, dual-wielding — each with its level, the XP toward its next one, and a marker when a card draft is waiting for you at the next reward. Tracks you have never touched stay out of the way. The numbers are the same ones the shrine spends.",
    "build": "0.7.1.342",
    "pullRequest": 1228,
    "url": "https://github.com/cehinds/AshenSpire/pull/1228"
  },
  {
    "id": "pr-1225",
    "date": "2026-09-20",
    "group": "2026-09-20",
    "summary": "Starting stats are tuned in one place, and the opening is five scenes",
    "detail": "Advanced settings now gather the creation pool and every class's starting attributes, Health and flasks under Progression, so the numbers that decide a new character sit together instead of across two tabs. Assign points is about points: how many you have to place and how many the character carries in total, while stat points per tier moved to General with its own limits. Only the allocation a new run actually offers is presented, and settings saved under the retired ones still load. A value a character could not survive is refused on the row you typed it in, naming the class and the starting kit that set the floor, and the rest of your configuration stays applied instead of silently reverting with it. In the opening, The first step draws its own painting instead of the region map your climb begins on, Last night follows What the fire left, and the forest departure is cut. An opening you had already tuned is carried across: per-scene settings now follow the scene they were written for, and a configuration exported before the change still loads.",
    "build": "0.7.1.333",
    "pullRequest": 1225,
    "url": "https://github.com/cehinds/AshenSpire/pull/1225"
  },
  {
    "id": "pr-1226",
    "date": "2026-09-20",
    "group": "2026-09-20",
    "summary": "The in-run Settings panel gets its toolbar back, and a status weight you tuned stops calling itself invalid",
    "detail": "Opening Settings from the map or a fight showed two empty boxes where the search and options buttons belong, Download & saves stranded on a row of its own, and a second scrollbar down the shell — all of it styling the Settings door from the title screen had and this one did not. The two doors share one panel now: the buttons carry their icons, the download button and the toolbar ride one row, and the panel is the only thing that scrolls. Separately, tuning the Poise or Ward weight of any status outside the seven the defaults name left the other half of the pair unwritten, so Advanced reported \"Invalid status resistance weights\" from then on and quietly kept the authored numbers. The side you did not touch now keeps its authored weight, or none at all, and the warning clears the next time you open Settings. Values outside 0–1 are still refused.",
    "build": "0.7.1.332",
    "pullRequest": 1226,
    "url": "https://github.com/cehinds/AshenSpire/pull/1226"
  },
  {
    "id": "pr-1227",
    "date": "2026-09-20",
    "group": "2026-09-20",
    "summary": "Combat and combat animation have their own Settings section",
    "detail": "The General tab now offers Combat beside Display and Audio, in two groups: Animation & effects holds Character sprites, Combat pacing, Rendering quality, Screen shake and Show played card animation, and Armaments holds Combat Armaments and Phone Armaments location. Every one of those switches moved there — pacing, quality, shake and the card animation were filed beside the title screen's lit-city pause, Character sprites was behind Advanced, and the Armaments rows sat with the accent colour — so each now has one place to be found and none is drawn twice. Advanced → Combat & actors still holds the balance constants and now says where the feel settings went. Your existing choices are unchanged; only where you find them moved.",
    "build": "0.7.1.340",
    "pullRequest": 1227,
    "url": "https://github.com/cehinds/AshenSpire/pull/1227"
  },
  {
    "id": "pr-1217",
    "date": "2026-09-20",
    "group": "2026-09-20",
    "summary": "Your five stats are rebased, and every point you place is felt",
    "detail": "Creation now starts each stat at 5 and hands you ten points to place between 3 and 12, instead of starting at 10 and handing you three. The pools follow: your Mana is your Wisdom and your Stamina is your Constitution, point for point, rather than one per five, and Health is 20 plus four per point of Constitution. Weapons and armour ask for the new numbers too, and picking up something your stats cannot hold is refused where the change happens, with the shortfall named. Runs already under way keep the rules they were created with.",
    "build": "0.7.1.328",
    "pullRequest": 1217,
    "url": "https://github.com/cehinds/AshenSpire/pull/1217"
  },
  {
    "id": "pr-1223",
    "date": "2026-09-20",
    "group": "2026-09-20",
    "summary": "The Herald's memory now shows the veiled novice at the Observatory's summit hearth",
    "detail": "The Herald scene in the opening's \"What the fire left\" uses the approved final painting: hood and veil hide the face while the unfinished Burning cracks through the novice, collapsed against the monumental hearth and reaching for the Sovereign Ember. It replaces the darkened plates from #1224. Desktop and phone compositions are separate, and the masters, prompts and checksums are kept with the repository's art records. No other scene, timing or setting changes.",
    "build": "0.7.1.324",
    "pullRequest": 1223,
    "url": "https://github.com/cehinds/AshenSpire/pull/1223"
  },
  {
    "id": "pr-1224",
    "date": "2026-09-20",
    "group": "2026-09-20",
    "summary": "The Herald's memory burns darker",
    "detail": "The Herald class memory in the opening now sits in near darkness with drifting ash, sparks around the hearth and a furnace glow beneath the novice's robe, matching the Burning. Desktop and phone plates both; the scene's composition is unchanged.",
    "build": "0.7.1.323",
    "pullRequest": 1224,
    "url": "https://github.com/cehinds/AshenSpire/pull/1224"
  },
  {
    "id": "pr-1219",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Twin swords now keep every class and armour's appearance through one shared attack",
    "detail": "Straight Sword in the right hand and Katana in the left select 32 painted suites across all four classes and 35 armour entries. The nine-step attack shares its timing across every outfit, with separate defend, hurt, cast, buff, stance, portrait and conversation poses. Reversed hands retain their existing presentation. The workshop compares outfits and lets you edit pose order, timing and impact before saving a sequence.",
    "build": "0.7.1.320",
    "pullRequest": 1219,
    "url": "https://github.com/cehinds/AshenSpire/pull/1219"
  },
  {
    "id": "pr-1213",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Tune starting stats, card draws, Poise and Ward in Advanced settings",
    "detail": "Set the total starting stat pool, automatically scale conversions or tune them manually, and configure additive AR, DR and PR from attributes, equipment, relics and buffs. Poise resists physical attacks and Ward resists magic, with separate impact meters, break penalties and per-status resistance weights—including mixed Burn resistance. Enemy defences, weapon impact classes and individual attacks are configurable. New solo fights start with three configurable cards, retain unplayed cards and refill to capacity, with fixed-draw and optional-discard alternatives. Older runs and LAN retain their rules. The settings toolbar is compact and aligned.",
    "build": "0.7.1.317",
    "pullRequest": 1213,
    "url": "https://github.com/cehinds/AshenSpire/pull/1213"
  },
  {
    "id": "pr-1216",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "The opening moves at your pace and remembers your class",
    "detail": "Each scene now defaults to five seconds total, including its fade, and its duration remains editable in Advanced → Opening sequence. The original first painting slowly draws closer; the Burning comes second. Distinct class memories and a new forest departure have desktop and phone artwork, including the approved cinder soldier and hooded Astrologer. Captions wait for their matching artwork, and text, timing, motif and shadow controls remain exportable.",
    "build": "0.7.1.315",
    "pullRequest": 1216,
    "url": "https://github.com/cehinds/AshenSpire/pull/1216"
  },
  {
    "id": "pr-1215",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Choose and shape your battlefield formation visually",
    "detail": "Interface settings now open a live preview with illustrated straight, forward-slant, back-slant and V presets. Choose up to three columns and six rows per side, with uniform position labels, footprint width and depth, team spacing, tile outlines, tilt and skew. Character size, offsets and draw order sit in a collapsed submenu. Apply saves the layout for real battles, and Done and Save also keeps pending edits. The preview and battlefield share positions and movement boundaries; smaller grids retain enough positions for the encounter.",
    "build": "0.7.1.312",
    "pullRequest": 1215,
    "url": "https://github.com/cehinds/AshenSpire/pull/1215"
  },
  {
    "id": "pr-1212",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Sword and shield now share the approved motion across every class and armour",
    "detail": "All four classes and 35 armour entries select their own appearance from 32 painted suites when equipping a sword and shield. The eleven-step attack uses the aura-free buff pose, holds ATK05, then returns through defensive stance to Ready. Defend, hurt, cast, buff, stances, portrait and conversation remain separately configurable. The labeled gallery shows the same sequence. The complete offline build uses large-file storage to retain the approved artwork without reducing its quality.",
    "build": "0.7.1.310",
    "pullRequest": 1212,
    "url": "https://github.com/cehinds/AshenSpire/pull/1212"
  },
  {
    "id": "pr-1211",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Your journey now opens with six painted scenes you can rewrite",
    "detail": "After character creation, see the cold hearths, the unfinished burning at the hut, your class’s reason to leave and the road to your actual starting place. Set forth reveals the first playable map. Advanced → Opening sequence lets you edit every line, scene hold, transition, motif wash, character shadow strength and traveller placement, with separate class dialogue and a preview. Transitions default to five seconds; all changes travel with configuration exports, and earlier art-studio exports can be loaded there too. Portrait artwork keeps the story readable on phones. Each traveller and its ground shadow share one transparent layer, including character and scene WebP downloads. The new paintings and existing environment/animation plates are compressed while preserving dimensions and transparency, keeping the standalone game below the repository’s file limit.",
    "build": "0.7.1.308",
    "pullRequest": 1211,
    "url": "https://github.com/cehinds/AshenSpire/pull/1211"
  },
  {
    "id": "pr-1210",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Your Poise bar now fills as the blows land, and a party's receipts name who was hit",
    "detail": "The Poise meter went live last change, but during the enemy's turn the bar sat still and then reset, because the paced view had no case for an impact; it now follows each blow, including overflow and the larger threshold after a Stagger. Changing equipment or loading an older save preserves earned Poise growth. Equipment and creation popups also stay correctly positioned at different interface zoom levels. Dungeon artwork uses smaller WebP runtime copies while the original paintings are preserved, keeping the standalone build within the hosting limit. In co-op the impact receipts carry the seat that was struck, so a hook meant for the player who was hit no longer fires for their teammates.",
    "build": "0.7.1.304",
    "pullRequest": 1210,
    "url": "https://github.com/cehinds/AshenSpire/pull/1210"
  },
  {
    "id": "pr-1203",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Mana is never a card's only price, a focus decides what its break does, and you can be Staggered too",
    "detail": "Every card that costs Mana also costs an action and stamina — the signature arts now ask a point of stamina beside their Mana, and a few free upgraded powers drop their Mana line instead. Your staff, rod or branch now decides what breaking a foe's Arcane Exposure earns: the plain staves batter the broken foe's Poise, the Blight Rod and the Gorefire Brand build Exposure faster, the Goldbough Branch spreads half the break to every other foe. And your own Poise meter is live: enemy impact fills it, and when it fills you are Staggered — 2 Vulnerable, 2 Weak, and one fewer action next turn.",
    "build": "0.7.1.295",
    "pullRequest": 1203,
    "url": "https://github.com/cehinds/AshenSpire/pull/1203"
  },
  {
    "id": "pr-1207",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Only living enemies accept your aim",
    "detail": "A defeated enemy can no longer catch a click, tap, keyboard focus or potion aim. Its body and name cannot activate an attack or targeted potion, and old target highlights disappear when it falls.",
    "build": "0.7.1.290",
    "pullRequest": 1207,
    "url": "https://github.com/cehinds/AshenSpire/pull/1207"
  },
  {
    "id": "pr-1208",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "One tap readies a combat card for its target",
    "detail": "Clicking a card title now fully selects it on the first tap, so the next click on a valid target plays it immediately. The card no longer stops at an inspection highlight when its text redraws under the pointer. Press-and-hold and flick-to-play keep working, and cancelled or moved presses do not become selecting taps.",
    "build": "0.7.1.288",
    "pullRequest": 1208,
    "url": "https://github.com/cehinds/AshenSpire/pull/1208"
  },
  {
    "id": "pr-1206",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Four more relics have painted identities, and every relic has a lore-and-size preview",
    "detail": "Ivory Comb, Blessed Dew, Gravetender's Bell and Wyrm Heart now use their own artwork throughout the shared relic displays. The review gallery includes all 63 relics in four sizes, existing lore and source notes, search, artwork filters and working vertical scrolling. Effects, drop rules and saves are unchanged.",
    "build": "0.7.1.284",
    "pullRequest": 1206,
    "url": "https://github.com/cehinds/AshenSpire/pull/1206"
  },
  {
    "id": "pr-1205",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "The roads tell the stories of the places they cross",
    "detail": "The six existing surveys now have regional names, requests and reports when you return for your reward. The Second Cairn asks you to raise the fallen swords of the unwritten dead, and the Last Lantern names the hamlets waiting for its medicine. The Road Warden is distinct from the old marked Wardens. Quest choices, rewards and saved routes stay the same.",
    "build": "0.7.1.282",
    "pullRequest": 1205,
    "url": "https://github.com/cehinds/AshenSpire/pull/1205"
  },
  {
    "id": "pr-1204",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Every class and armour keeps its own look while using the approved greatsword motion",
    "detail": "Equipping a greatsword with the other hand empty now selects the nine-step attack and matching defend, hurt, cast, buff, stance and portrait art for all four classes and all 35 current armour entries. Thirty-two distinct appearances share one configurable motion profile, including separate paintings of each shared armour for each class. The original Reaver sequence stays intact. A synchronized gallery shows every outfit with labeled playback steps, source pose references and portraits. Other weapon combinations keep their existing presentation.",
    "build": "0.7.1.280",
    "pullRequest": 1204,
    "url": "https://github.com/cehinds/AshenSpire/pull/1204"
  },
  {
    "id": "pr-1173",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Holding a card now asks where it should go",
    "detail": "In combat, holding a card that needs a target selects it and shows its legal targets, and the effect lands once when you choose one — the same flow a tap opens, so no hold plays a targeted card on its own. A card with no target still plays from a hold, the hold's fill starts the moment you press instead of after a hidden delay, and tapping, dragging, keyboard and controller play are unchanged.",
    "build": "0.7.1.278",
    "pullRequest": 1173,
    "url": "https://github.com/cehinds/AshenSpire/pull/1173"
  },
  {
    "id": "pr-1198",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "A studio for the game's layout, with the phones and desktops it will be played on",
    "detail": "Nothing you see changes in play. A new local editor, beside the content editor and the pose studio, draws the combat, map, conversation and shop screens as the wireframes the layout file describes, at the real size of a desktop, an iPad, an iPhone or a Galaxy, and lets the numbers be dragged on a snapping grid rather than typed: how tall the top bar is, where the floor sits, how wide a portrait may be. Every size shows how the game itself will decide to lay out at that screen, the whole set can be compared side by side, and the real game can be opened at that size in the same window. A change is checked by the game's own build rule before it is written, and the file keeps its old bytes wherever it was not touched. Free wireframe sketches, with a different arrangement per screen size, save as their own files.",
    "build": "0.7.1.275",
    "pullRequest": 1198,
    "url": "https://github.com/cehinds/AshenSpire/pull/1198"
  },
  {
    "id": "pr-1195",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Resting is now something a place does, not something the Shrine does",
    "detail": "Every stop on the road — the Shrine, a rough camp off an Unknown node, a town's inn, its chapel — carries its own set of what it restores: the Shrine heals part of your HP, refills your flasks on arrival and offers the Smith and Level-up; a camp heals less and offers nothing; an inn heals you and your Mana to full. Every rest recovers Mana now, by default to half your maximum or to full if you already stand there. Ember Fragment reads \"Resting heals 15% more\" and works everywhere; the Wyrm Heart still forbids the Shrine's rest but lets you sleep at an inn. Seeded routes hold at most one town per act.",
    "build": "0.7.1.274",
    "pullRequest": 1195,
    "url": "https://github.com/cehinds/AshenSpire/pull/1195"
  },
  {
    "id": "pr-1202",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Eight relics now have painted artwork throughout the game",
    "detail": "Forsaken Medallion, Starstone Shard, Cutpurse's Coin, Gold Figurine, Golden Sprout, Cracked Lantern, Bloodstained Chalice and Crown of Stitches show their own art in cards, the HUD, character creation and smithing. Relic inspection shows the original lore. Other relics retain their glyphs; effects and drop rules are unchanged.",
    "build": "0.7.1.235",
    "pullRequest": 1202,
    "url": "https://github.com/cehinds/AshenSpire/pull/1202"
  },
  {
    "id": "pr-1200",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "The Reaver draws the approved greatsword poses when that weapon is equipped",
    "detail": "A greatsword with an empty off hand now uses the new ready stance, the chosen nine-step attack, defensive and buff poses, casting, hurt reactions and portrait. Each weapon combination can name its animation and view references in one settings file, selected by class, armour and the group held in each hand. Other combinations keep their existing art. The labeled four-class sprite review gallery and four new relic-icon candidates are saved for review; those additional candidates are not activated in play.",
    "build": "0.7.1.232",
    "pullRequest": 1200,
    "url": "https://github.com/cehinds/AshenSpire/pull/1200"
  },
  {
    "id": "pr-1199",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "The HUD keeps its contents together, and you choose what stays visible",
    "detail": "Health, Mana, Stamina and relics now fit inside a growing panel beside the menu controls. Display settings can hide resources, relics, Cinders, journey position or potion shortcuts and remember your choice. Combat potion minis now follow the map: hover or keyboard focus reveals them on desktop, while touch opens the full list from Potions. Reduced motion removes their slide.",
    "build": "0.7.1.230",
    "pullRequest": 1199,
    "url": "https://github.com/cehinds/AshenSpire/pull/1199"
  },
  {
    "id": "pr-1194",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Your character level is earned in the fight now, not bought at the shrine",
    "detail": "Every fight you win, and every enemy you fell, pays experience; each level you reach grants an attribute point, and the points wait at the shrine's Level up card until you assign them, as many at once as you like. Cinders no longer buy levels, so every cinder is yours for the merchant. Every fifth level past the first also raises your maximum HP, Mana and Stamina, and every tenth adds a card to your hand. Your level shows on the combat inspector, the armoury and the character sheet. A run saved before this change keeps the levels it bought, at the level those purchases reached, and never gains the new level bonuses it was not born with.",
    "build": "0.7.1.223",
    "pullRequest": 1194,
    "url": "https://github.com/cehinds/AshenSpire/pull/1194"
  },
  {
    "id": "pr-1193",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "A class can now be something you earn, and the Turncoat's Mirror lets a run change its class midway",
    "detail": "The unlock table can gate a class behind reaching a class level in any run or felling a boss while holding a certain kind of weapon; a gated class shows locked at character creation with a hint of how to earn it, and your profile now remembers your highest class level and which weapons each boss fell to. No class ships gated yet. A new event, the Turncoat's Mirror, offers to swap your class for another chosen at random: your deck, relics, weapons, attributes and weapon skills stay yours; you wear the new class's own armour, since armour belongs to a class; your class level starts over (the level you reached still counts toward unlocks) and any tree nodes the new class has no seat for are dropped; the new class's starting kit is not dealt. Turn away and nothing changes.",
    "build": "0.7.1.214",
    "pullRequest": 1193,
    "url": "https://github.com/cehinds/AshenSpire/pull/1193"
  },
  {
    "id": "pr-1192",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Your class now grows a tree of its own: every class level buys one node, and the top node names your subclass",
    "detail": "Winning a fight pays your class ten points, a boss thirty more, and each level opens a draft of three nodes from your class's tree: six per class in three tiers, the first leaning on your ability card, the second on your kit relic, the third the two subclasses, of which you may take only one. A node you pick rides your core card and mounts beside your favoured weapon in every fight; once you choose a subclass, your name plate, the map header and your save slot call you by it. The draft sits ahead of the skill draft on the reward screen and saves with your run; an older save simply has no picks yet.",
    "build": "0.7.1.206",
    "pullRequest": 1192,
    "url": "https://github.com/cehinds/AshenSpire/pull/1192"
  },
  {
    "id": "pr-1191",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Every class now begins with its own ability card and a second relic, and leans toward its favoured weapon",
    "detail": "The Reaver starts with Brace, a stance that turns aside a quarter of the damage you take and hands you Strength when you leave it, and carries the Ashen Grip, which gives back one Stamina for the first stance you enter each turn. The Starseer starts with Attune and the Lodestar Shard; the Herald with Warm Litany and the Waxen Seal; the Rogue with Prepare and the Whetstone Pouch. Your starting deck is eleven cards now, the ability card beside your signature. Each class favours one kind of weapon — blades for the Reaver and Rogue, a focus for the Starseer and Herald — and every skill point earned with that kind is worth a quarter more. Nothing you already carry changes.",
    "build": "0.7.1.199",
    "pullRequest": 1191,
    "url": "https://github.com/cehinds/AshenSpire/pull/1191"
  },
  {
    "id": "pr-1190",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Levelling a weapon now lets you draft a card of its own school",
    "detail": "Every rung a weapon skill climbs sets aside a draft, and the spoils door after a fight now offers it: pick one of three cards drawn from the schools the weapon you hold belongs to, in the seat the class-card offer used to take. Higher rungs open rarer cards, common first, then uncommon, then rare. When a skill reaches its fifth rung, every card of that school already in your deck is upgraded on the spot, and a card drafted from then on arrives upgraded. A draft you do not take waits for the next fight; a weapon with no cards of its school in your class's pool keeps its draft rather than offering nothing. Armour and class skills draft nothing yet.",
    "build": "0.7.1.195",
    "pullRequest": 1190,
    "url": "https://github.com/cehinds/AshenSpire/pull/1190"
  },
  {
    "id": "pr-1189",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "The game now keeps a ledger of how well you fight with each kind of weapon",
    "detail": "Nothing you see changes yet. Every hit or block a weapon's card lands, every fight you win with it in hand, every blow your armour turns aside, every spark of arcane buildup your focus deals: each is now counted toward a skill in that weapon's kind, in your armour's weight, in your focus, in fighting with two blades. The counts climb a ladder whose rungs get longer as you rise, and every rung climbed sets aside a reward that the next change will let you draw. A relic or an event can already ask what rung you stand on. The ledger rides your save, and an older save simply starts at the foot of every ladder.",
    "build": "0.7.1.192",
    "pullRequest": 1189,
    "url": "https://github.com/cehinds/AshenSpire/pull/1189"
  },
  {
    "id": "pr-1187",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "The Last Lantern opens a new quest, and the road offers new gear",
    "detail": "Help a stranded caravan with oil or effort, then meet it again for a reward that remembers your choice. Frost Spear, Cinder Axe and Dusk Chime bring three new weapon Arts; Bastion Harness, Rimeweave Robes and Waywatcher Coat trade protection, Frost and Stamina against their own drawbacks. Four new relics offer travel rewards, stronger Exposure, portable healing or cheaper Powers. Every weapon has smith upgrades and uses existing artwork throughout the Armoury, shops and compendium. Reward cards now have fixed resource costs distributed by rarity: about 30%, 50% and 70% of Common, Uncommon and Rare cards use Stamina, including 15%, 30% and 50% using both Mana and Stamina. Most weapon attacks still cost Actions only; caster rewards favor higher rarities once unlocked.",
    "build": "0.7.1.226",
    "pullRequest": 1187,
    "url": "https://github.com/cehinds/AshenSpire/pull/1187"
  },
  {
    "id": "pr-1186",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "Holding two blades is now something the game can see",
    "detail": "Nothing you see changes. When you play a card, the game now notes how your hands are held at that moment: one weapon, a two-handed one, or two of the same kind. That note lives on the moment the card is played, never on the card itself, so a knife in each hand can be asked about by a relic or an event without any card being rewritten. A weapon that needs both hands can no longer be put beside something in the other hand: the Armoury names both pieces and asks you to free the hand first. No weapon in the game needs both hands yet, so today the only grip you can feel is two blades.",
    "build": "0.7.1.191",
    "pullRequest": 1186,
    "url": "https://github.com/cehinds/AshenSpire/pull/1186"
  },
  {
    "id": "pr-1183",
    "date": "2026-09-19",
    "group": "2026-09-19",
    "summary": "The Armoury has places for your head, hands and feet, and your deck has a floor",
    "detail": "Three new equipment positions sit beside your armour and talisman in the Armoury. They are empty: nothing yet exists to wear there, and the picture of what you wear and hold that your save carries now reads those positions as real slots. The one thing that plays differently: you can no longer leave the Armoury holding fewer than eight cards. Taking off both weapons can drop a fresh deck to four, and the door now says so, with both numbers, and waits for you to put something back or equip a piece that carries cards. A deck that was already under eight when you walked in is still let out; the door refuses what you did in that room, never what happened before it.",
    "build": "0.7.1.186",
    "pullRequest": 1183,
    "url": "https://github.com/cehinds/AshenSpire/pull/1183"
  },
  {
    "id": "pr-1166",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "You can try card sizes out yourself, and hand me back the numbers you settled on",
    "detail": "Under Advanced there are now four sliders for how big an item card is drawn: the size it rests at while you browse, that same size on a phone, the size it grows to when you pick it up, and the size it opens to when you read it. Move one and every weapon, armour, relic and flask card on the screen follows immediately — nothing to rebuild and nothing to reload. The playing cards you fight with follow only the last of those four — the size a card opens to when you read it, since they share that same window. Their size everywhere else, in your hand and on the merchant's shelves, is still written into the stylesheets rather than read from the settings, and that is being fixed separately. A button copies the sizes you arrived at in the exact form the game's own settings file wants, so you can paste them back or send them on without anyone retyping a number. Nothing moves until you move it: the game ships at the sizes it always had, on a phone as well as a desktop. And a set of sizes that would make a card you opened to read smaller than one you were browsing past is refused outright, naming the one that is wrong, rather than being quietly corrected into something you did not ask for.",
    "build": "0.7.1.164",
    "pullRequest": 1166,
    "url": "https://github.com/cehinds/AshenSpire/pull/1166"
  },
  {
    "id": "pr-1165",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "The save now carries your character as a picture of what is worn, held and carried",
    "detail": "Nothing you see changes. Beside the fields the game has always kept — your class, your armament sets, your relics and your deck — a run now also writes a single picture of the same facts: what sits at your core, what is worn on the body and at the neck, what is in each hand, what passive things ride along, and every card you own. That picture is drawn from the fields that own the truth every time the run is saved, so the two can never disagree; an older save is given its picture the moment it loads, and a save whose picture was edited by hand has it redrawn and a line written in the load record saying so. It is the groundwork for the equipment and cards becoming one collection later, and it changes nothing about how a run plays.",
    "build": "0.7.1.115",
    "pullRequest": 1165,
    "url": "https://github.com/cehinds/AshenSpire/pull/1165"
  },
  {
    "id": "pr-1162",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "Cards you are browsing are browsing-sized again, and reading one on a phone reads down the page",
    "detail": "Every card you had not picked up was being drawn at the size meant for the one you are reading — the shop's shelves worst of all — so a screen of choices was a screen of oversized cards. They rest at browsing size now, grow when you pick one, and grow again when you open it to read. Opening a card on a phone no longer squeezes its description into a strip two words wide beside it: the card sits at the top at full size and the text runs underneath it, one scroll. On a desktop the two still sit side by side. The loadout summary at the end of character creation keeps the line under each card that the picker above it shows, so a slot and the chip you chose it from read the same.",
    "build": "0.7.1.114",
    "pullRequest": 1162,
    "url": "https://github.com/cehinds/AshenSpire/pull/1162"
  },
  {
    "id": "pr-1163",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "Every word the game tags things with lives in one tree, and no rule carries a number of its own",
    "detail": "Nothing you see changes. The game had three separate lists of the words it uses to say what a thing is — one for cards' kinds and costs, one for everything else, and one for the powers a relic or a sceptre grants — and they have been folded into a single tree, where each word has one place and one parent. Every one of the 435 things in the game now states what it is in that tree. And the numbers those powers use — how much Mana a sceptre gives back, how much Poise a medallion's first blow adds — no longer sit inside the power: each power names a variable, and the variable reads the game's one tuning table, which is where a number is meant to be changed. A relic's sentence now reads its numbers by the variable's name rather than by counting where they sat, and the game asks a card what it is by that same tree rather than by which list it came from. Every card, relic and weapon reads, plays and costs exactly as it did, and a test compares all of it against a record made before the change.",
    "build": "0.7.1.112",
    "pullRequest": 1163,
    "url": "https://github.com/cehinds/AshenSpire/pull/1163"
  },
  {
    "id": "pr-1161",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "Cards keep what was pinned to them, and a browsing card really is larger-typed",
    "detail": "In a fight, the first tap on a card no longer wipes the marks pinned to it — its key hint, the note saying why it cannot be played, the hold meter and the invisible strip that decides what your thumb landed on all survive being redrawn. A card that says less now gives the space back to the words it does show, instead of leaving an empty band at its foot. Flavour text written for playing cards had always existed and was shown to nobody; it now reads in the card's own information window, in the same place an item's does. In the developer catalogue, the three sample cards that exist to be compared no longer move together when you tap one.",
    "build": "0.7.1.104",
    "pullRequest": 1161,
    "url": "https://github.com/cehinds/AshenSpire/pull/1161"
  },
  {
    "id": "pr-1160",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "Your armour choices come back when you switch how they are listed",
    "detail": "Switching the starting-equipment picker between Grid and List used to empty it — the choices were still there, but nothing was open to hold them, so the step looked blank. The section you had open stays open now.",
    "build": "0.7.1.104",
    "pullRequest": 1160,
    "url": "https://github.com/cehinds/AshenSpire/pull/1160"
  },
  {
    "id": "pr-1154",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "And the change that wrote that mention now has one too",
    "detail": "Nothing you see changes in play. Writing a missing line in this list is itself a change, and it needs its own line or the gap simply moves along by one. This is that line, so the chain ends here rather than being handed on again.",
    "build": "0.7.1.96",
    "pullRequest": 1154,
    "url": "https://github.com/cehinds/AshenSpire/pull/1154"
  },
  {
    "id": "pr-1150",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "A check on the top bar now runs with the rest of them",
    "detail": "Nothing you see changes in play. The check that guards how the bar along the top folds on a phone had been written but was not in the list the project runs, so a green result said nothing about it; it runs with the others now. The design notes it is checked against were also tightened where they could be read to say the opposite of what the bar does, and one of the check's own tests was reading too little of the stylesheet to catch the fault it exists for.",
    "build": "0.7.1.95",
    "pullRequest": 1150,
    "url": "https://github.com/cehinds/AshenSpire/pull/1150"
  },
  {
    "id": "pr-1141",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "The answers fill the space under a conversation, and both speakers fill the scene",
    "detail": "When you answer, the buttons now grow to take the empty room that used to sit under the last one, so nothing is left blank and every answer is easier to hit. The two people talking are also drawn as large as the scene allows: whoever is too wide for their half now leans out towards the edge of the screen rather than shrinking, so you see them at full height, with their head and shoulders always in view, and they never overlap each other.",
    "build": "0.7.1.94",
    "pullRequest": 1141,
    "url": "https://github.com/cehinds/AshenSpire/pull/1141"
  },
  {
    "id": "pr-1149",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "A receipt points at the change it belongs to",
    "detail": "Nothing a player sees changes. One entry in this list named the wrong pull request; it now names its own.",
    "build": "0.7.1.87",
    "pullRequest": 1149,
    "url": "https://github.com/cehinds/AshenSpire/pull/1149"
  },
  {
    "id": "pr-1136",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "The map remembers where you left it, and not where you left a different window",
    "detail": "The map keeps the view you had, but a view saved on one window size was being restored onto another, which could leave the board sitting oddly. A saved view is now kept with the size it was solved for, and one that no longer fits is worked out afresh.",
    "build": "0.7.1.87",
    "pullRequest": 1136,
    "url": "https://github.com/cehinds/AshenSpire/pull/1136"
  },
  {
    "id": "pr-1134",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "The bar along the top reads the same on a phone in every screen",
    "detail": "Walking into an event or a conversation on a phone, the bar along the top printed its words on top of each other — your class over the act, the floor over both — and the health, mana and stamina bars were cut off by its bottom edge. On a phone that bar now carries four things and nothing else: your health, mana and stamina stacked one under the other, your cinders centred above them, and the two buttons for your armament and the menu. Your class, the act and the floor are still there on a wider screen, where they fit. The map, a fight, a shrine and a conversation all draw that same bar now, so it no longer changes shape as you walk through a door.",
    "build": "0.7.1.86",
    "pullRequest": 1134,
    "url": "https://github.com/cehinds/AshenSpire/pull/1134"
  },
  {
    "id": "pr-1147",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "The potion count on the map is a plain number",
    "detail": "Nothing a player sees changes; the written description now matches the game. The note describing the map's potion icons still said the count sat in a small pill, which it no longer does.",
    "build": "0.7.1.86",
    "pullRequest": 1147,
    "url": "https://github.com/cehinds/AshenSpire/pull/1147"
  },
  {
    "id": "pr-1137",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "The checks that prove this game’s other checks can still fail were themselves broken on Windows",
    "detail": "Nothing a player sees changes. Before any check on this game is trusted, it is first made to fail on purpose: a known fault is planted into the real files and the check must catch it. On Windows, where the invisible character that ends each line of a file differs from the one the build servers use, a planted fault that spanned more than one line was never really planted at all — and the tool then reported that the fault’s location had moved, rather than that it had failed to plant it. Twenty-three plants across eighteen checks were affected, so those checks read as broken on every Windows run while the build servers saw nothing wrong. A plant is now read the way the file it lands in is actually written, whichever machine it is on, and the planter itself has gained a check of its own that runs on every change.",
    "build": "0.7.1.85",
    "pullRequest": 1137,
    "url": "https://github.com/cehinds/AshenSpire/pull/1137"
  },
  {
    "id": "pr-1143",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "The map's potions come out when you reach for them",
    "detail": "On the map the small potion icons no longer sit out on the bar. The Potions button is larger, and resting on it slides the potions up out of it one after another, with the number you carry above each; move away and they fold back in.",
    "build": "0.7.1.85",
    "pullRequest": 1143,
    "url": "https://github.com/cehinds/AshenSpire/pull/1143"
  },
  {
    "id": "pr-1140",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "The rest of the game’s look-and-timing settings move out of the code",
    "detail": "Nothing you see changes in play, and as before that is checked rather than hoped. Fourteen more parts of the game kept presentation settings written into the program: where a weapon effect attaches to each painted figure, how long explanations wait before opening, the Reaver’s attack animation, the drifting ash on the title screen, where fighters plant their feet, the Armoury’s default proportions, and the timings of combat effects. All of it now lives as plain, organised settings files with the rest. Every one of those parts was recorded before the move and is held to exactly what it produced before, and a further check refuses to let a stray number creep back in beside its new home.",
    "build": "0.7.1.92",
    "pullRequest": 1140,
    "url": "https://github.com/cehinds/AshenSpire/pull/1140"
  },
  {
    "id": "pr-1133",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "Two more changes that landed without a mention now have one",
    "detail": "Nothing you see changes in play. Two changes had already landed without a line in this list, so the changelog you can read in the game did not mention them: a separate editing tool for the people who build the game, and a clear-out of twenty-one written notes nothing referred to any more. Each now has its line, with the build it shipped in.",
    "build": "0.7.1.81",
    "pullRequest": 1133,
    "url": "https://github.com/cehinds/AshenSpire/pull/1133"
  },
  {
    "id": "pr-1130",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "A check on the world map’s camera can run on a slower computer again",
    "detail": "Nothing you see changes. One of the checks that proves the world map remembers where its camera was gave up before it had looked at anything. It allowed seven seconds for the game to open, and on a slower computer opening the game from its loose files takes longer than that — mostly because the build stamp each page carries is worked out afresh from every file in the project, every time a page asks for it. The check now waits as long as that opening really takes, and only while it is waiting for a page to open; everywhere else it is as impatient as it was. The game itself is unchanged, and so is the way the stamp is worked out.",
    "build": "0.7.1.81",
    "pullRequest": 1130,
    "url": "https://github.com/cehinds/AshenSpire/pull/1130"
  },
  {
    "id": "pr-1132",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "A conversation reads properly on a phone",
    "detail": "On a phone the bar along the top was drawing its two lines of information on top of each other — your class over your cinders, the act over the floor — so none of it could be read. It now keeps two readable lines, and the bar is given the room it needs. The two speakers were also far too small, like figures seen at a distance: on a narrow screen you now see each of them whole and large, filling the scene above the text. They stand further apart, so neither crowds the other, and the quest's name is no longer clipped along its top edge.",
    "build": "0.7.1.80",
    "pullRequest": 1132,
    "url": "https://github.com/cehinds/AshenSpire/pull/1132"
  },
  {
    "id": "pr-1129",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "The dialogue design says how far apart the speakers stand, and that the quest's name is never clipped",
    "detail": "Nothing a player sees changes yet. The design notes for quest conversations now set a smallest gap in pixels between the two speakers, as well as a share of the screen, so a narrow screen keeps them apart; and they require the text band's top to clear the quest title's line, so no letter loses its top edge. The game itself follows in a later change.",
    "build": "0.7.1.77",
    "pullRequest": 1129,
    "url": "https://github.com/cehinds/AshenSpire/pull/1129"
  },
  {
    "id": "pr-1122",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "Twenty-one documents nothing pointed at are gone",
    "detail": "Nothing a player sees changes. Old planning and audit documents that no other document or tool referred to have been removed, so the ones that are kept are the ones that are read.",
    "build": "0.7.1.77",
    "pullRequest": 1122,
    "url": "https://github.com/cehinds/AshenSpire/pull/1122"
  },
  {
    "id": "pr-1119",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "A small editor for the game's content tables",
    "detail": "Nothing a player sees changes. Anyone working on the game can now edit its content tables — cards, enemies, items and the rest — through a local editor in the browser instead of hand-editing the files, and it refuses edits that would break a table's own rules.",
    "build": "0.7.1.77",
    "pullRequest": 1119,
    "url": "https://github.com/cehinds/AshenSpire/pull/1119"
  },
  {
    "id": "pr-1124",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "The last of the game’s look-and-layout settings move out of the code",
    "detail": "Nothing you see changes in play — that is the point, and it is checked rather than hoped. Ten parts of the game still kept their presentation settings written into the program itself: the map’s tile sizes and zoom limits, the stances a fighter can hold, which animation each kind of action plays, where the class medallion sits on each painted figure, the environment paintings and their scenes, the map node icons and their descriptions, the in-run menu, the gamepad button names, and the timings and artwork of the combat pose stage. All of it now lives as plain, organised settings files alongside the rest, so a value can be changed in one readable place instead of hunted through the code. Every one of those parts was recorded before the move and is held to exactly what it produced before — same values, in the same order — and a further check refuses to let a stray number creep back into the code beside its new home.",
    "build": "0.7.1.78",
    "pullRequest": 1124,
    "url": "https://github.com/cehinds/AshenSpire/pull/1124"
  },
  {
    "id": "pr-1126",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "You and the person you are speaking to are both fully in view, whatever you play on",
    "detail": "In a conversation, each of you keeps to your own half of the screen, so the two of you can no longer overlap and neither is hidden behind the other. On a narrow screen a figure too wide for its half is made smaller as a whole, and still stands on the top edge of the text rather than floating above it; on a wide screen nothing changes. The one listening is dimmed, but never so far that you cannot make them out. On a short or narrow screen the bar along the top now fits its own row, instead of spilling past it. The answer buttons carry only the answer: if you cannot afford a response, it reads as unavailable and says why when you hover or with a screen reader, and an answer you must hold down says so the same way, instead of a small word on the button.",
    "build": "0.7.1.77",
    "pullRequest": 1126,
    "url": "https://github.com/cehinds/AshenSpire/pull/1126"
  },
  {
    "id": "pr-1116",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "Events open again instead of crashing",
    "detail": "Walking into an event on the map threw an error and the screen never appeared. It opens normally again.",
    "build": "0.7.1.76",
    "pullRequest": 1116,
    "url": "https://github.com/cehinds/AshenSpire/pull/1116"
  },
  {
    "id": "pr-1111",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "Five fixes: free cards show their cost, a won fight can no longer be saved into a dead slot, and a co-op party can see where it is and what it is fighting",
    "detail": "Cards that cost nothing to play — Shiv, Quick Cut, Comet Fragment, Warcry — printed no action cost at all, so the one place you count what a turn can still afford simply said nothing about them. They now read ◆ 0, which is the point of a free card. When a fight ends there is a short beat before the spoils open, and during it the menu was still live: saving in that moment wrote a save that loaded back into a fight already won, with nothing left to kill and no way onward. The menu now closes the moment the fight resolves, the game refuses to save a finished fight at all, and a save already stuck that way now reopens at the fight instead of a dead end. In a co-op party, the heading over the fight and over the map said only “ACT II” where a solo run names the place — The Pale Marches, The Cinder Reach — because the host never sent it. It sends it now. And reading an enemy in co-op, the list of what it had already done always said the same thing whether it had acted or not; a co-op client can now see the moves an enemy has actually made, and an enemy that has done nothing yet says so. Behind all of this, the tool that grades the game’s difficulty had been calling every fight in the game a first-act fight since the regions were reworked, so its warnings about late-game fights were measured against a starting deck; it reads the real region now, and four late bosses turn out to be closer races than it had been reporting.",
    "build": "0.7.1.75",
    "pullRequest": 1111,
    "url": "https://github.com/cehinds/AshenSpire/pull/1111"
  },
  {
    "id": "pr-1120",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "A check on the game’s own content builder is whole again",
    "detail": "Nothing you see changes. The tool that packs the game’s content keeps a list of the eight parts a finished pack must contain, and tests itself by removing each one in turn to prove the right checker catches it. One of those eight — the events, the things that happen to you on the road — had stopped being caught the way the list says. Instead of one plain report that the events were missing, the content checker raised seventeen complaints about quests, speakers and a relic that all pointed at events which are in fact present, and never mentioned the one part that was gone. The checker now leaves that part to the tool that owns it and says so once, plainly. Nothing about the events themselves was wrong, and every check the content checker made before it still runs: a pack that ships an empty list of events is still refused, in all seventeen ways.",
    "build": "0.7.1.77",
    "pullRequest": 1120,
    "url": "https://github.com/cehinds/AshenSpire/pull/1120"
  },
  {
    "id": "pr-1113",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "A change that landed without a receipt now has one",
    "detail": "Nothing you see changes in play, apart from this list growing by one entry. One change merged without an entry here, so the changelog you can read in the game did not mention it either: the one that stores the instructions for working on this game in the repository. It is written up below, citing the build it actually landed in.",
    "build": "0.7.1.73",
    "pullRequest": 1113,
    "url": "https://github.com/cehinds/AshenSpire/pull/1113"
  },
  {
    "id": "pr-1115",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "The list of changes under Settings, About fills in seven gaps",
    "detail": "Nothing you see changes in play. Seven changes that had already landed were missing from this list, so the changelog you can read in the game did not mention them: one that puts your relics, potions and status effects in a single row of icons, and six that only touched the project's own writing and checking tools. Each now has its line, with the build it shipped in.",
    "build": "0.7.1.72",
    "pullRequest": 1115,
    "url": "https://github.com/cehinds/AshenSpire/pull/1115"
  },
  {
    "id": "pr-1114",
    "date": "2026-09-18",
    "group": "2026-09-18",
    "summary": "The owner's instructions for working on this game live in the repository",
    "detail": "Nothing you see changes in play. The instructions that say how this game is worked on — which assistant handles which kind of task, and the rules and boundaries they work under — used to exist only as files passed around in chat. They are now kept with the game's own documents, marked as advice: where they disagree with the specification or the contributing rules, those still decide.",
    "build": "0.7.1.71",
    "pullRequest": 1114,
    "url": "https://github.com/cehinds/AshenSpire/pull/1114"
  },
  {
    "id": "pr-1107",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "Every place a fighter can stand now has a name",
    "detail": "Nothing you see changes. The twelve spots on the battlefield are named by a row letter and a column number: rows A, B and C run from the top of the ground to the bottom, and columns 1 to 4 count across the field from your back line, through both front lines, to the enemy's back line. Your rear spot on the bottom row is C1; the enemy's rear spot on the top row is A4. Where everyone stands, how large they are and what you can target are exactly as before. The design notes for the battlefield use the same names, so a spot means one thing wherever it is written.",
    "build": "0.7.1.70",
    "pullRequest": 1107,
    "url": "https://github.com/cehinds/AshenSpire/pull/1107"
  },
  {
    "id": "pr-1108",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "Screen layout sizes now live in simple settings files",
    "detail": "Nothing you see changes. Every size, position, layer and timing that decides how the combat field, the map header, the hand, the footer, the shop, the Armoury, tooltips and dialogue are laid out used to be typed into the game's code. Now each one is written once, in a small file named for the screen or part it belongs to, and a shared value is written only once, so changing one number changes it everywhere it is used. The game is checked to draw exactly what it drew before, number for number. The face-to-face conversation scene reads its layout (bands, portraits, layers, type sizes, how many answers show and how they are laid out) from the same files.",
    "build": "0.7.1.68",
    "pullRequest": 1108,
    "url": "https://github.com/cehinds/AshenSpire/pull/1108"
  },
  {
    "id": "pr-1106",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "Quest conversations take place in the world, face to face",
    "detail": "A conversation used to open in a panel of its own, with small full-length figures above the text. Now it happens where you stand. You see the same sky and ground you fight on, with the HUD along the top as it is in a fight. You on the left and whoever is speaking on the right both appear close up, from the waist up, and the one talking is lit while the other is dimmed. The words sit in a band underneath, with just the quest's name above them, and when it is your turn to answer, up to four answers show at once without scrolling, side by side on a short screen. Back, Skip speech and Continue are three equal buttons along the bottom. As the scene opens, the two of you fade in first and then the words; the buttons only start working once the words have fully appeared. The Grave of the Nameless steps look like this, and your answers count exactly as before.",
    "build": "0.7.1.67",
    "pullRequest": 1106,
    "url": "https://github.com/cehinds/AshenSpire/pull/1106"
  },
  {
    "id": "pr-1112",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "The plan for quest conversations keeps both speakers on screen",
    "detail": "Nothing you see changes yet. The written plan for face-to-face quest conversations now says that you and the person you are speaking to are both visible at every screen size. Each of you keeps to one half of the screen and the two never overlap; a figure too wide for its half is drawn smaller as a whole and still stands on the line where the words begin, rather than floating above it. Wide screens look as they do today, and the person listening is dimmed only so far, so you can still see them.",
    "build": "0.7.1.67",
    "pullRequest": 1112,
    "url": "https://github.com/cehinds/AshenSpire/pull/1112"
  },
  {
    "id": "pr-997",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "A card you have picked is ringed, not labelled",
    "detail": "Picking a card told you so in three different ways depending on where you were: at the victory screen the card you chose was ringed in green, in character creation a full-width button under the card read “Selected”, and at the stables the picked card was outlined in gold. The victory ring is now the one signal everywhere — the card you have chosen wears a green edge, and the button that made the choice steps out of the way instead of turning into a word you cannot press. Gold still means where you are and what you are looking at. An armed card in combat is unchanged: aiming is not the same as choosing, and it keeps its gold lift.",
    "build": "0.7.1.65",
    "pullRequest": 997,
    "url": "https://github.com/cehinds/AshenSpire/pull/997"
  },
  {
    "id": "pr-1109",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "Your relics, potions and status effects sit in one row of icons",
    "detail": "The top band now holds your relics, your potion icons and your status effects in a single row, drawn at the same size and spacing as the status icons on a fighter's card and opening the same kind of explanation. Relics appear on the world map's band too, where they were missing before, and the icons sit together instead of spread far apart. When more icons exist than the row can hold, it ends with a count you can open to see the rest.",
    "build": "0.7.1.63",
    "pullRequest": 1109,
    "url": "https://github.com/cehinds/AshenSpire/pull/1109"
  },
  {
    "id": "pr-1105",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "Your relics keep their powers, held in the same place as every other worn power",
    "detail": "Nothing you see changes. Every relic that does something when a fight gives it its moment — 48 of the 55 — now holds that power in the game's one list of powers a worn thing can grant, the list added two changes ago, instead of carrying it privately. Each still reads exactly as it did, fires exactly when it did, and fires once where it fired once; a fight you saved before this change and reload still remembers which relics have already gone off. The seven relics that simply change a number while you own them are untouched, because the Smith upgrades those on your copy and a shared list has only one copy.",
    "build": "0.7.1.62",
    "pullRequest": 1105,
    "url": "https://github.com/cehinds/AshenSpire/pull/1105"
  },
  {
    "id": "pr-1110",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "The written plan for the gameplay screens is now a stack of layers",
    "detail": "Nothing you see changes. Combat, the world map and quest conversations are each described as a stack of layers — sky, ground, figures, the band of words, the controls — with each layer able to be switched off on its own and every overlap measured. The conversation screen is written down in that form too: the ground sits at sixty per cent of the view, the figures are drawn full height so their upper third rises above the words, and the scene, the people and the words arrive in that order.",
    "build": "0.7.1.62",
    "pullRequest": 1110,
    "url": "https://github.com/cehinds/AshenSpire/pull/1110"
  },
  {
    "id": "pr-1104",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "The world's written history quotes the owner's own telling of it",
    "detail": "Nothing you see changes. The documents that hold this world's history used to retell the owner's own account in their own words. They now carry his wording directly, and the three things that account leaves deliberately unexplained are written into the tables that track them, so they stay open questions on purpose rather than by omission.",
    "build": "0.7.1.59",
    "pullRequest": 1104,
    "url": "https://github.com/cehinds/AshenSpire/pull/1104"
  },
  {
    "id": "pr-994",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "The i that explains a card sits above it on every screen",
    "detail": "Pick a card anywhere in the game and the small gold i that opens its full text appears just above the card. That is where it has always been — except on the equipment you choose when making a character, where it sat inside the card's top-right corner instead, because that screen left no room above the cards and the badge would otherwise have crossed the STARTING ARMOUR heading. The room is there now, so that screen shows the i in the same place as every other one, whole and clear of the heading at every interface size, and the same control no longer appears in two places depending on where you are.",
    "build": "0.7.1.58",
    "pullRequest": 994,
    "url": "https://github.com/cehinds/AshenSpire/pull/994"
  },
  {
    "id": "pr-1003",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "Choosing a weapon at character creation no longer buries the Continue button, and inspecting a card in combat offers Play again",
    "detail": "On a phone, opening a hand to pick an armament put the button that moves you on nearly four screens down, under every combat card that armament gives you drawn at full size. The cards now sit behind a single line that says what they are (\"Adds 6 cards · 3 kinds\") — tap it to see them, three to a row and drawn small, so six faces take two rows instead of three. The Continue button at the end of each equipment step now stays pinned to the bottom of the view: before this it sat more than a screen and a half below the picker it closes, so choosing a weapon meant scrolling back past everything you had just read to leave. The Continue at the end of each creation step is pinned the same way. On a desktop or tablet screen that pinned button used to cover the equipment step's own Continue as you scrolled past it, so pressing Continue to Off Hand skipped straight to the seed instead of opening the next armament; the step's own button now sits in front. Separately, a recent change gave every screen its own words for what a card can do there — the spoils screen offers Choose this card, the merchant Buy it — and in doing so took combat's away: opening a card from your hand to read it showed the card and no button, on the one screen where that button had always worked. It is back. Playing a card from the hand itself was never affected; this is the window you open with the small i. And reading a card's information no longer follows you: the game kept a note of which card you had last read for as long as the page was open, so meeting that same card again on another screen could make your first tap act on it instead of selecting it. Each screen now starts with nothing selected. That clearing had one edge of its own, fixed here too: opening the Armoury in the middle of a fight with a card already aimed cleared the card's highlight but not the aim, so the enemies still answered to a tap and the next one you touched was struck by a card that no longer looked chosen. Opening the Armoury now puts the aim down — however you aimed, by tapping the card's information, by dragging it, or by its number key.",
    "build": "0.7.1.59",
    "pullRequest": 1003,
    "url": "https://github.com/cehinds/AshenSpire/pull/1003"
  },
  {
    "id": "pr-1101",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "Sceptres now give you mana back when you break an enemy's arcane guard",
    "detail": "The Bone Sceptre and the Emberlight Sceptre each carry a power called Siphon: when one of your own hits fills an enemy's Arcane Exposure and breaks it, you get 1 Mana back. The power belongs to the sceptre, not to you. Swap it for another weapon mid-fight and the refund stops; take the sceptre back up and it returns, once, never twice. A fight you saved and reload keeps it. The Herald starts with the Bone Sceptre, so a Herald feels this from the first fight. Every other weapon, armour and relic works exactly as before.",
    "build": "0.7.1.57",
    "pullRequest": 1101,
    "url": "https://github.com/cehinds/AshenSpire/pull/1101"
  },
  {
    "id": "pr-1057",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "A checking tool reads the combat screen the way it works today",
    "detail": "Nothing you see changes. The tool that walks the combat screen and checks what it says still expected the older screen: it looked for a fighter's name before the fighter is chosen, and for card costs and tags that had already moved. It failed before it reached most of its checks. It now selects a fighter first and reads the card the way the screen presents it, so the checks it was written for actually run.",
    "build": "0.7.1.57",
    "pullRequest": 1057,
    "url": "https://github.com/cehinds/AshenSpire/pull/1057"
  },
  {
    "id": "pr-1039",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "A saved-game check starts a climb the way you do",
    "detail": "Nothing you see changes. One of the checks that proves the world map remembers where its camera was never actually reached a new climb: it stopped at the question that asks you to confirm the slot, and character creation was never opened. It now presses Start at that question and makes the same choices you would — class, then the rest — so the case it was written to prove is the one it walks.",
    "build": "0.7.1.57",
    "pullRequest": 1039,
    "url": "https://github.com/cehinds/AshenSpire/pull/1039"
  },
  {
    "id": "pr-1022",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "The wording check counts each file once on Windows",
    "detail": "Nothing you see changes. The check that guards the game's written text against accidental loss compared each file against its record using the path style of the computer running it. On Windows the two never matched, so all sixty-two files with text in them were counted twice — once as shrunk, once as grown — and the check reported over a hundred differences that did not exist. It now uses one path style everywhere, so the count is the real one.",
    "build": "0.7.1.57",
    "pullRequest": 1022,
    "url": "https://github.com/cehinds/AshenSpire/pull/1022"
  },
  {
    "id": "pr-1098",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "Gear, relics and your class can now be given lasting powers of their own",
    "detail": "Nothing you see changes yet. The game now keeps one list of powers that a weapon, a piece of armour, a relic or a class can grant while you hold it, and each power has exactly one written rule. Cards can never hold these powers; a card only ever does what its own text says. The list starts empty. The first power arrives with the next change: a sceptre that gives you mana back when you break an enemy's arcane guard.",
    "build": "0.7.1.56",
    "pullRequest": 1098,
    "url": "https://github.com/cehinds/AshenSpire/pull/1098"
  },
  {
    "id": "pr-1099",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "Quests are spoken, and each one finishes exactly once",
    "detail": "Each step of the Grave of the Nameless now opens as a conversation: you stand on the left, whoever speaks stands on the right, and the story comes one line at a time. Back rereads a line, Skip speech jumps to the end, and Continue reads on. Your answers, the event's own choices, appear on the last line, and one that binds you still asks you to hold. Answering at the second cairn with anything but Leave now finishes the quest, and collecting a road quest's reward on the world map finishes that quest the same way, once per run, even if you reload. Events that belong to no quest look as before.",
    "build": "0.7.1.55",
    "pullRequest": 1099,
    "url": "https://github.com/cehinds/AshenSpire/pull/1099"
  },
  {
    "id": "pr-1095",
    "date": "2026-09-15",
    "group": "2026-09-15",
    "summary": "A check on the game's own builder is watched again",
    "detail": "Nothing you see changes. The tool that packs the whole game into one file has a set of deliberately broken builds it is tested against, to prove it refuses them rather than shipping a half-made game. Three of those tests had quietly stopped working — two described a rule the builder no longer follows, and one had been outgrown by the game itself, which is now far larger than the test assumed. All three are repaired, and the set is now run by the project's checks instead of by whoever remembers it exists.",
    "build": "0.7.1.54",
    "pullRequest": 1095,
    "url": "https://github.com/cehinds/AshenSpire/pull/1095"
  },
  {
    "id": "pr-1092",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "The game is checked against its own written world",
    "detail": "Nothing you see changes. The world's history — the three flames, what a cinder is, why a Forsaken can climb at all — is written down in one place, and until now nobody had read it against the game as it is actually built. That reading now exists: what the world says and the game already does, what the two disagree about, and what the world promises that the game has not built yet. Nothing was changed to make either side agree; the disagreements are simply written down where they can be fixed.",
    "build": "0.7.1.53",
    "pullRequest": 1092,
    "url": "https://github.com/cehinds/AshenSpire/pull/1092"
  },
  {
    "id": "pr-1094",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "The plan for how your character grows now includes quests you talk through",
    "detail": "Nothing you see changes yet. The written plan now gives quests two things. Each quest finishes exactly once, whether it's a chain of events like the Grave of the Nameless or a road quest taken on the world map, and that one finish is what future experience and rewards count. And every quest exchange is spoken: each step of a chain, and taking or turning in a quest at a town's quest board, opens a conversation with the person who gives it. You stand on the left, they stand on the right, and your answers are the quest's own choices. Text comes first; voice, when it arrives, can never answer for you.",
    "build": "0.7.1.52",
    "pullRequest": 1094,
    "url": "https://github.com/cehinds/AshenSpire/pull/1094"
  },
  {
    "id": "pr-1091",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "This record catches up with the second batch of rebuilt screens",
    "detail": "Nothing you see changes. Nine changes merged since the last catch-up had no line here, because they were merged in a way the project's receipts check cannot see. Each now has its line with the build it shipped in, so the changelog under Settings, About lists them too.",
    "build": "0.7.1.51",
    "pullRequest": 1091,
    "url": "https://github.com/cehinds/AshenSpire/pull/1091"
  },
  {
    "id": "pr-1089",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "The project's own checks measure today's screens again",
    "detail": "Nothing you see changes. Four of the project's checks had fallen behind the rebuilt screens: one looked for scrolling where the merchant no longer scrolls, one expected the combat buttons at the screen edges, one read an old version of the map's route strip, and one could not get past the title screen to reach Settings. Each now walks the game as it is.",
    "build": "0.7.1.50",
    "pullRequest": 1089,
    "url": "https://github.com/cehinds/AshenSpire/pull/1089"
  },
  {
    "id": "pr-1090",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "Equipment, relic and potion cards say what kind of thing they are",
    "detail": "A weapon's card now shows its hand or requirements, its attack, defense and weight, and the card it grants; armour shows its poise; a relic says whether it works on its own or when something happens, and how often; a potion says what it heals, restores or grants. Only facts the game already knows are shown. Relic and potion cards no longer cut off their last line of text, and a relic's first line now reads \"Active while owned\" instead of calling every relic passive.",
    "build": "0.7.1.50",
    "pullRequest": 1090,
    "url": "https://github.com/cehinds/AshenSpire/pull/1090"
  },
  {
    "id": "pr-1088",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "The Smith's three services open as one workspace",
    "detail": "Upgrading, extracting a card and installing a card now share one window: your items on a list at the left, or one selector on a phone, and the item you pick described beside it, step by step, with the Smithing Stone cost at the bottom. Back and the action share the bottom row. Every cost and confirmation is unchanged.",
    "build": "0.7.1.49",
    "pullRequest": 1088,
    "url": "https://github.com/cehinds/AshenSpire/pull/1088"
  },
  {
    "id": "pr-1087",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "Every list of categories behaves the same way on a phone",
    "detail": "The merchant, the Armoury, the discard pile, the compendium, your profile and Settings now all fold their categories into one button on a narrow screen, which opens the full list, instead of a row of buttons you had to scroll sideways. In Settings, Escape closes that open list rather than Settings itself, and every toggle and choice is a comfortable size to tap.",
    "build": "0.7.1.48",
    "pullRequest": 1087,
    "url": "https://github.com/cehinds/AshenSpire/pull/1087"
  },
  {
    "id": "pr-1084",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "The top band shows your relics the same way everywhere, and one Potions list",
    "detail": "Relics in combat and in the merchant, Shrine and event screens now look and open the same way. Your flasks and carried potions form one list with counts, so several of the same potion show as one entry, and \"1 charges\" now reads \"1 charge\". Using a potion asks exactly as before.",
    "build": "0.7.1.47",
    "pullRequest": 1084,
    "url": "https://github.com/cehinds/AshenSpire/pull/1084"
  },
  {
    "id": "pr-1086",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "Enemy intentions stay clear of the top band, and controls stay clear of a phone's notch",
    "detail": "On a phone held sideways the top of each enemy's intention, and the information button above it, sat under the top band; on a wide screen the information button did too once an enemy was selected. Both now sit fully below it. On phones with a notch, the buttons beside your hand keep clear of the screen's edges.",
    "build": "0.7.1.46",
    "pullRequest": 1086,
    "url": "https://github.com/cehinds/AshenSpire/pull/1086"
  },
  {
    "id": "pr-1079",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "Every battlefield stands on its painted ground",
    "detail": "Each place's painting is now fitted so its ground meets the fighters' feet, so no one floats above the floor in any scene. When a card needs a target, the enemies you can pick show one clear outline that stays readable on a phone and disappears once you have played the card.",
    "build": "0.7.1.45",
    "pullRequest": 1079,
    "url": "https://github.com/cehinds/AshenSpire/pull/1079"
  },
  {
    "id": "pr-1078",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "Explanations point at what they explain",
    "detail": "An explanation now has a small arrow toward the thing you are hovering, opens below it when there is no room above, and waits its full second even if you brush over the same thing twice.",
    "build": "0.7.1.44",
    "pullRequest": 1078,
    "url": "https://github.com/cehinds/AshenSpire/pull/1078"
  },
  {
    "id": "pr-1085",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "Confirmations name what they will do",
    "detail": "Buying, selling, burning a card, resting and quitting now ask a plain question, name the thing involved, and state exactly what it costs or loses, with Back on the left. Quitting names the run you are leaving, and burning a card is treated as the permanent choice it is.",
    "build": "0.7.1.43",
    "pullRequest": 1085,
    "url": "https://github.com/cehinds/AshenSpire/pull/1085"
  },
  {
    "id": "pr-1072",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "This record catches up with two days of rebuilt screens",
    "detail": "Nothing you see changes. Twenty-eight changes from the last two days landed without a line here, nine of them flagged by the project's own receipts check and nineteen merged in a way that check cannot see. Each now has its line, with the build it shipped in read from the project's history, so the changelog under Settings, About lists them too.",
    "build": "0.7.1.42",
    "pullRequest": 1072,
    "url": "https://github.com/cehinds/AshenSpire/pull/1072"
  },
  {
    "id": "pr-1071",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "One of the project's checks points at the new settings page",
    "detail": "Nothing you see changes. A check that deliberately breaks the settings page, to prove another check notices, was still aiming at a line the new settings layout no longer has, so it broke nothing and proved nothing. It aims at the current line again.",
    "build": "0.7.1.41",
    "pullRequest": 1071,
    "url": "https://github.com/cehinds/AshenSpire/pull/1071"
  },
  {
    "id": "pr-1070",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "The Armoury keeps its views on a side list, with the selected item beside the list",
    "detail": "The Armoury's views (Character, Equipment, Inventory, Cards) now sit on a list down the left of the window, or in a row above it on a phone, instead of tabs across the top. In Inventory, your items sit in one column and the one you pick is described in the other, including how it compares with what you have equipped and whether you can equip it. The button to equip or change it now sits at the bottom of the window and asks for the same hold it always did.",
    "build": "0.7.1.41",
    "pullRequest": 1070,
    "url": "https://github.com/cehinds/AshenSpire/pull/1070"
  },
  {
    "id": "pr-1069",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "The merchant's shelves become a list you can see all at once",
    "detail": "The merchant's folding bars are gone. Cards, Armaments, Weapon arts, Relics, Flasks, Services and Sell are now a list down the left of the window, or along the top on a phone. Each offer shows its price and, when you cannot take it, why not. Picking a relic, a flask or something to sell shows it beside the shelf, and the button at the bottom buys or sells it after the same confirmation as before. The shop remembers which shelf you were on after a purchase.",
    "build": "0.7.1.40",
    "pullRequest": 1069,
    "url": "https://github.com/cehinds/AshenSpire/pull/1069"
  },
  {
    "id": "pr-1068",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "The Shrine and events lay out their choices beside what they mean",
    "detail": "At a Shrine, the options now sit beside a column saying which are available, and the top of the window counts them. At an event, the story sits beside the responses, and the top of the window says whether you still have to choose, whether a price blocks a response, or whether it is resolved. Continue now waits at the bottom of the window until you have answered.",
    "build": "0.7.1.39",
    "pullRequest": 1068,
    "url": "https://github.com/cehinds/AshenSpire/pull/1068"
  },
  {
    "id": "pr-1066",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "The compendium and your profile use the same side list as everything else",
    "detail": "In the compendium, the kinds of armament sit on a list down the left, and the piece you tap is described beside the collection; pieces you have not found still hide their names. Your profile lists set-aside profiles and set-aside runs the same way. On a phone, both lists fold into one button that opens them.",
    "build": "0.7.1.38",
    "pullRequest": 1066,
    "url": "https://github.com/cehinds/AshenSpire/pull/1066"
  },
  {
    "id": "pr-1062",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "Settings has one heading and a side list of categories",
    "detail": "Settings no longer repeats its own name and category above every page. On a wide screen the categories sit on a list down the left; on a phone, one button above the settings names the current category and opens the list. The first category is now called Display. Seven settings whose name already says what they do no longer carry a line of explanation.",
    "build": "0.7.1.37",
    "pullRequest": 1062,
    "url": "https://github.com/cehinds/AshenSpire/pull/1062"
  },
  {
    "id": "pr-1059",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "The map no longer draws a second gold box beside the node you picked",
    "detail": "Tapping a map node showed its selection glow and, next to it, a gold square left by the explanation system. The square is gone; the glow and the keyboard cursor remain.",
    "build": "0.7.1.36",
    "pullRequest": 1059,
    "url": "https://github.com/cehinds/AshenSpire/pull/1059"
  },
  {
    "id": "pr-1040",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "An enemy's or your own window shows every pool you have",
    "detail": "Opening a fighter's information shows health, mana and poise meters under the picture again, only for the pools that fighter has. For a while it showed health alone, with empty space below.",
    "build": "0.7.1.35",
    "pullRequest": 1040,
    "url": "https://github.com/cehinds/AshenSpire/pull/1040"
  },
  {
    "id": "pr-1061",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "A potion's window says whether you can drink it, and lets you",
    "detail": "Opening a flask's information now shows its effect, its remaining charges, and, when it cannot be used here, the reason. Its one button is Use, which works exactly like Use in the flask's own menu. The extra Close button at the bottom is gone; the corner close remains.",
    "build": "0.7.1.34",
    "pullRequest": 1061,
    "url": "https://github.com/cehinds/AshenSpire/pull/1061"
  },
  {
    "id": "pr-1058",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "The discard pile has a side list, and reading a card no longer adds a Back button",
    "detail": "The Discard and Exhaust piles now sit on a list at the left of their window, and the card you tap is described beside the pile, so you can read a card without opening another window. A card you are only reading, with nothing to do, now opens with no buttons at the bottom; the corner close is the way out.",
    "build": "0.7.1.33",
    "pullRequest": 1058,
    "url": "https://github.com/cehinds/AshenSpire/pull/1058"
  },
  {
    "id": "pr-1052",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "The map's top band takes a tenth of the screen",
    "detail": "On the act map, your class, purse, health and route now share one slim band at the top instead of taking almost a fifth of the screen, so the map itself gets the room. On a short landscape phone the band keeps the height of one tappable row.",
    "build": "0.7.1.32",
    "pullRequest": 1052,
    "url": "https://github.com/cehinds/AshenSpire/pull/1052"
  },
  {
    "id": "pr-1043",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "Combat fits a phone held sideways",
    "detail": "On a landscape phone, End Turn, Actions, Potions and the draw and discard piles now stand to either side of your hand instead of in a row beneath it, which leaves room for the fighters and a readable hand. Every screen size that already fitted looks exactly as before.",
    "build": "0.7.1.31",
    "pullRequest": 1043,
    "url": "https://github.com/cehinds/AshenSpire/pull/1043"
  },
  {
    "id": "pr-1031",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "A fighter's guard sits beside it at the size you can read",
    "detail": "The block badge now sits just outside the fighter's picture, on your right-hand side for you and the left for enemies, at a size you can read on a phone. It had shrunk with the sprite and floated away from it. Enemy intentions keep a readable minimum size too.",
    "build": "0.7.1.30",
    "pullRequest": 1031,
    "url": "https://github.com/cehinds/AshenSpire/pull/1031"
  },
  {
    "id": "pr-1029",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "Fighters show their health bar, and the rest when you pick them",
    "detail": "Under each fighter, health always shows. Its name, mana, build-up meters and stance appear when you select that fighter, so a crowded field stays readable. Stance is now a strip the width of the health bar.",
    "build": "0.7.1.29",
    "pullRequest": 1029,
    "url": "https://github.com/cehinds/AshenSpire/pull/1029"
  },
  {
    "id": "pr-1044",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "Buttons at the bottom of a window share the width evenly",
    "detail": "Buttons along the bottom of a window now split its width equally, and a single button fills it. The two buttons at the end of a run share one width and wrap a long label instead of squeezing it.",
    "build": "0.7.1.28",
    "pullRequest": 1044,
    "url": "https://github.com/cehinds/AshenSpire/pull/1044"
  },
  {
    "id": "pr-1054",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "Every card and fighter has the same information button",
    "detail": "The small i that appears above whatever you have selected is now one size everywhere, a comfortable tap target with a clear letter, and it always hangs the same distance above its card or fighter.",
    "build": "0.7.1.27",
    "pullRequest": 1054,
    "url": "https://github.com/cehinds/AshenSpire/pull/1054"
  },
  {
    "id": "pr-1051",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "A selected card or fighter glows all over",
    "detail": "Picking a card or a fighter now wraps the whole thing, its information button included, in one soft gold glow. Before, a card could wear an outline, a shadow and a border at once, and a fighter's glow missed its intention and its information button.",
    "build": "0.7.1.26",
    "pullRequest": 1051,
    "url": "https://github.com/cehinds/AshenSpire/pull/1051"
  },
  {
    "id": "pr-1049",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "Equipment cards show their rarity and how many you own",
    "detail": "The bottom line of an armament, armour, relic or potion card now shows its rarity on the left and, in the Armoury and at the Smith, how many you own on the right. What it requires moved up beside its type.",
    "build": "0.7.1.25",
    "pullRequest": 1049,
    "url": "https://github.com/cehinds/AshenSpire/pull/1049"
  },
  {
    "id": "pr-1036",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "Cards on offer say how many copies you already have",
    "detail": "A card offered as a reward, at the merchant or in a custom draft now shows how many copies are already in your deck at the bottom right, beside its rarity.",
    "build": "0.7.1.24",
    "pullRequest": 1036,
    "url": "https://github.com/cehinds/AshenSpire/pull/1036"
  },
  {
    "id": "pr-1035",
    "date": "2026-09-14",
    "group": "2026-09-14",
    "summary": "Two tuning values are confirmed",
    "detail": "Nothing you see changes. The width kept for the Discard and Exhaust piles on narrow screens, and the short wait before a second tap on a map node enters it, were marked as trial values; the owner kept both.",
    "build": "0.7.1.23",
    "pullRequest": 1035,
    "url": "https://github.com/cehinds/AshenSpire/pull/1035"
  },
  {
    "id": "pr-1024",
    "date": "2026-09-13",
    "group": "2026-09-13",
    "summary": "The act map asks you to pick a place, then enter it",
    "detail": "Tapping a lit node on the act map now selects it and describes it in a band below the map, with its floor, kind and what it holds, instead of travelling at once. Enter, at the bottom right, or a second tap on the same node takes you there. A quick double tap no longer travels by accident.",
    "build": "0.7.1.22",
    "pullRequest": 1024,
    "url": "https://github.com/cehinds/AshenSpire/pull/1024"
  },
  {
    "id": "pr-1017",
    "date": "2026-09-13",
    "group": "2026-09-13",
    "summary": "A fighter's information opens as a two-column window",
    "detail": "Opening a fighter's information shows its picture, name and health on the left and its details on the right, in a set order: summary, current state, what it did before, known abilities, traits, and lore. Something unknown now says Unknown, and something absent says None.",
    "build": "0.7.1.21",
    "pullRequest": 1017,
    "url": "https://github.com/cehinds/AshenSpire/pull/1017"
  },
  {
    "id": "pr-1021",
    "date": "2026-09-13",
    "group": "2026-09-13",
    "summary": "The main menu shows the save you would continue",
    "detail": "When there is a run to continue, the title screen highlights Continue and shows that save beside the menu: its class, act, floor, health, slot and seed.",
    "build": "0.7.1.20",
    "pullRequest": 1021,
    "url": "https://github.com/cehinds/AshenSpire/pull/1021"
  },
  {
    "id": "pr-1019",
    "date": "2026-09-13",
    "group": "2026-09-13",
    "summary": "The spoils screen counts what you have claimed",
    "detail": "The rewards window now says how many rewards you have claimed and lists each one as taken, skipped, full or still available, with a reminder while a card choice is waiting.",
    "build": "0.7.1.18",
    "pullRequest": 1019,
    "url": "https://github.com/cehinds/AshenSpire/pull/1019"
  },
  {
    "id": "pr-1015",
    "date": "2026-09-13",
    "group": "2026-09-13",
    "summary": "The small meters under a fighter sort themselves",
    "detail": "Under each fighter, health comes first, then other pools, then build-up, then stance, then status icons, never more than five rows. Build-up that does not fit becomes a small ring among the icons, and a +N tile opens the full list.",
    "build": "0.7.1.17",
    "pullRequest": 1015,
    "url": "https://github.com/cehinds/AshenSpire/pull/1015"
  },
  {
    "id": "pr-1013",
    "date": "2026-09-13",
    "group": "2026-09-13",
    "summary": "Back and Close look alike, and turn red when you are about to press them",
    "detail": "Every way out of a window now wears the same brown and gold and turns red under your finger, cursor or controller, so it is never mistaken for the button that goes forward. End Turn stays plain until you have spent your actions.",
    "build": "0.7.1.16",
    "pullRequest": 1013,
    "url": "https://github.com/cehinds/AshenSpire/pull/1013"
  },
  {
    "id": "pr-1010",
    "date": "2026-09-13",
    "group": "2026-09-13",
    "summary": "The combat screen shares its height by one rule",
    "detail": "The top band, the battlefield, your hand and the controls now split the screen by fixed shares, and the hand and controls keep a readable minimum on small screens. The row at the bottom packs its buttons into the centre at one height.",
    "build": "0.7.1.15",
    "pullRequest": 1010,
    "url": "https://github.com/cehinds/AshenSpire/pull/1010"
  },
  {
    "id": "pr-1009",
    "date": "2026-09-13",
    "group": "2026-09-13",
    "summary": "Cards and the battlefield take their first rebuilt shape",
    "detail": "Every card now has the same proportions and layout, with its costs down its left edge, and your hand selects one card at a time without spending an action. Fighters stand in fixed rows on the battlefield, closer ones in front, and a selected fighter grows a little without moving the others.",
    "build": "0.7.1.13",
    "pullRequest": 1009,
    "url": "https://github.com/cehinds/AshenSpire/pull/1009"
  },
  {
    "id": "pr-1005",
    "date": "2026-09-13",
    "group": "2026-09-13",
    "summary": "The plans for the rebuilt screens are in the repository",
    "detail": "Nothing you see changes. The approved drawings and measurements for every screen and component the game is being rebuilt around are now documents in the project, with an interactive gallery of them.",
    "build": "0.7.1.11",
    "pullRequest": 1005,
    "url": "https://github.com/cehinds/AshenSpire/pull/1005"
  },
  {
    "id": "pr-1002",
    "date": "2026-09-12",
    "group": "2026-09-12",
    "summary": "Groundwork: the game now keeps one record of which card you have selected",
    "detail": "Nothing you see changes. Selecting a card used to be tracked in two places at once — a note the code kept to itself, and the highlight drawn on the card — which had to be kept in step by searching the whole screen for whatever was lit. Three changes in three days got the tap counting wrong because of it: the tap that should have acted on a card was spent, skipped, or swallowed depending on which screen you were on. There is now one record, with its own tests, including the two mistakes that kept recurring: reading a card's information no longer loses your next tap, and re-selecting the card you already picked no longer forgets that you picked it.",
    "build": "0.7.1.11",
    "pullRequest": 1002,
    "url": "https://github.com/cehinds/AshenSpire/pull/1002"
  },
  {
    "id": "pr-1001",
    "date": "2026-09-12",
    "group": "2026-09-12",
    "summary": "Groundwork: a card's facts now live apart from its picture",
    "detail": "Nothing you see changes. Until now, working out what a card is — its cost, its type colour, which subtypes it carries, which class it belongs to — happened inside the same step that drew it, so nothing else in the game could ask those questions without drawing a card first. Those answers now live on their own, and drawing reads them. Two small things it fixes on the way: the cost shown on a card's corner and the cost written in its full description were worked out separately and could in principle disagree, and now cannot; and a card's facts can be written out whole, which is what lets the same card be drawn more than one way later.",
    "build": "0.7.1.10",
    "pullRequest": 1001,
    "url": "https://github.com/cehinds/AshenSpire/pull/1001"
  },
  {
    "id": "pr-1000",
    "date": "2026-09-12",
    "group": "2026-09-12",
    "summary": "Inspecting a card now offers what that screen is for",
    "detail": "Opening a card to read it used to show a greyed-out Play card button with the words \"Play cards from your combat hand\" — on every screen except combat, including the spoils screen, where you had opened the card in order to take it. A card's buttons now come from the screen it is standing on: the spoils screen offers Choose this card, and choosing it there picks the same card in the row behind the window. A card you are only reading, such as one in the compendium, simply shows no button at all instead of a dead one.",
    "build": "0.7.1.9",
    "pullRequest": 1000,
    "url": "https://github.com/cehinds/AshenSpire/pull/1000"
  },
  {
    "id": "pr-998",
    "date": "2026-09-12",
    "group": "2026-09-12",
    "summary": "Every card answers the same two taps",
    "detail": "Tap a card once and it lights up, with the small i appearing beside it a moment later; tap it again — or press and hold it — and it does the thing you came for. That is now true of every card in the game. Two recent changes had pulled it apart: choosing an armament at the Smith and arming a card to burn at the merchant had started acting on the first tap, so you committed to a card before you had been shown it, and a card whose text was cut short opened its information straight from the small arrow in its corner, which no other card did. The arrow now selects the card like a tap anywhere else on it, and the i is the one way in to a card's full information everywhere. Reading a card and then tapping it no longer loses that tap. The merchant's burn shelf gains the green confirm button the loot screen and the Smith already had, so burning a card can be done with a second tap, a hold, or the button.",
    "build": "0.7.1.8",
    "pullRequest": 998,
    "url": "https://github.com/cehinds/AshenSpire/pull/998"
  },
  {
    "id": "pr-993",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "Levelling and the merchant catch up with the tripled cinders",
    "detail": "Cinder rewards were tripled a week ago and nothing else moved, so levels at the shrine had become far too cheap — a simulated climb bought 27 of them where the design asks for 10 to 20 — and every price at the merchant was effectively a third of what it was meant to be. A level now starts at 50 cinders and rises by 10 each time, which a 40-run simulation puts back at 15 levels a climb; armaments, weapon arts, cards, relics, flasks and card removal all cost three times what they did, which is exactly the number of fights per purchase they were tuned to before. Selling prices follow automatically, and nothing about how much you earn has changed.",
    "build": "0.7.1.7",
    "pullRequest": 993,
    "url": "https://github.com/cehinds/AshenSpire/pull/993"
  },
  {
    "id": "pr-991",
    "date": "2026-09-11",
    "group": "2026-09-11",
    "summary": "The words the game says now live in one table",
    "detail": "Nothing you see changes today. Until now every sentence in the interface was written inside the screen that showed it, so the same idea could be worded two ways on two screens and rewording anything meant editing code. The spoils screen and the merchant now read their words from a single spreadsheet, each entry holding three lengths — the short label, the full sentence, and the tooltip a small button gets — and a new check stops any screen from quietly going back to writing its own.",
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
