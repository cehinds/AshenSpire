// One explicit compatibility edge for the fixed-Evasion correction. Keep the
// immutable original profile and digest; only its rules are normalized on read.
// The stance-bonus retune approves this same edge: saved Smash tuning stays intact.
// A later runtime must independently approve this edge instead of inheriting it.
// The 2026-10-25 combat retune (Block soaks magic, Evade 3, enemy stats -2, boss SP 3) approves it again and adds
// The 2026-10-26 pierce rule (pierce.blockBypassFraction in fixCoreMechanics.json) approves it again and adds the runtime before it (2d76f2...).
// The 2026-10-28 Core armament tiers (three Smith tiers, equipment.upgradeBonuses.tierBonusSteps) approve it again and add the runtime before it (325247...); a save from there keeps its own one-tier ladder.
// The 2026-10-28 Mending Touch ruling (deck-training excludeCards on the Magic Adept rule) approves it again and adds the runtime before it (7d9597...); a save from there keeps its own copy rule.
// The 2026-11-01 Ward and Barrier statuses approve it again and add the runtime before them (907508...); a save from there keeps its own snapshotted rules.
// The combined merge of #2476, #2477 and #2479 (Ward/Barrier, Lightning elements, elemental cantrips) approves it again and adds the runtime before it (85b9a5...).
// The 2026-11-01 retirement of the Evade stance (stances module include and sweep matchups lose 'evade') approves it again and adds the runtime before it (bc9c46...); a save from there keeps its own snapshotted rules, and a saved Evade stance row loads as Defend.
// The 2026-11-05 removal of Custom Climb and the glassCannon status (engine/mechanics/index.json: status.glassCannon loses its statuses module) approves it again and adds the runtime before it (83a0c5...); a save from there keeps its own snapshotted rules.
// The 2026-11-05 Reach cap (fixCoreMechanics.json range.maxRange "reach", owner ruling) approves it again and adds the runtime before it (2dcba5...); a save from there keeps its own policy with no cap and three bands.
// The 2026-11-07 combat-rounds removal (cleanup 3i-A) repoints four mechanic manifests (engine/mechanics/*/mechanic.json legacy.file, hashed into the mechanics-runtime artifact) away from deleted files, which moves the runtime hash; it approves this edge again and adds the runtime before it (0fe8ce...); the cost.stamina manifest repoint (resolvedCardPlayCosts) moved it once more and adds b3c6a6.... No rule changed: a save from there keeps its own snapshotted rules.
// The 2026-11-07 ratings-meter removal (cleanup 3i-B) marks the status.ward manifest authored, which moves the runtime hash once more and adds 965682.... No rule changed.
// The 2026-11-07 keepsake removal (keepsake tag and mechanic dropped from the content and tag tables) moves the runtime hash again; it approves this edge again and adds the runtime before it (05977e...). No rule changed: a save from there keeps its own snapshotted rules.
// The 2026-11-07 mechanics-kernel move (src/model/mechanicsKernel.js → engine/runtime/bindings.mjs, code review H2) moves the runtime hash again and adds 802e46.... No rule changed: a save from there keeps its own snapshotted rules.
// The 2026-11-08 stance move (src/engine/combatRounds/stance.js → src/model/stance.js, code review H1) repoints the maneuver_smash manifest, which moves the runtime hash again and adds a7efc3.... No rule changed: a save from there keeps its own snapshotted rules.
// Merge train 2026-11-08 (#2708 loadout split + #2725 validator split + #2680 model leaf moves) lands them together, so the shipped runtime is the combined f0e3f7..., not #2680's own 9a69b3... (never on dev). No rule changed.
// dev's runtime before that retune (73ef24...) and the earlier combined-merge runtime (df30b7...): a run saved there keeps its own snapshotted profile, rules and content.
// The 2026-11-08 runOpcode → OPCODE_HANDLERS map (pure refactor; five mechanic manifests now name the handler table) moves the runtime hash again; it approves this edge again. Merge train #2727 ships it on top of dev's f0e3f7... (the pre-merge 48ecb2... was never on dev); the final train runtime is fae7af.... No rule changed: a save from there keeps its own snapshotted rules.
// The 2026-11-08 enemy-level budget ships on dev's fae7af... runtime. Historical profiles retain their authored tier budgets, floors, offsets and content; only new profiles use the level-based budget.
// The 2026-11-14 one-pick rest (rest module accepts the `rest` service and a fractional recovery.hp; the Strategize-or-rest fallback in gameConfig.js) moves the runtime hash again. A save from 9808... keeps its own snapshotted rests block (arrival heal, every service once).
// The 2026-11-14 exact hits and intents (accuracy.hitRoll, accuracy.evadeStacksPerCard and perception.roll in fixCoreMechanics.json and the combat.accuracy / combat.perception manifests) move the runtime hash again; a save from 63e8d1... keeps its own snapshotted rules, which lack the keys and so keep rolling.
// The 2026-11-14 wording pass (Wave 2: one word for one thing: model wording literals, the status Precision tooltip, the AC badge gate) moves the runtime hash again; wording only, no rule.
// The 2026-11-14 Ward as a Poise effect (ward.poisePerStack in fixCoreMechanics.json) moves the runtime hash again; a fight saved without the key keeps no Ward Poise.
// The 2026-11-14 Poise break rule (Wave 3: `poise.breakRule: "broken"` in fixCoreMechanics.json and the Broken engine path) moves the runtime hash again; a save from 68d430... keeps its own snapshotted rules, which lack the key and so keep the Staggered stance.
// Batch 1 fix pass (preview skips an unmet conditional row; Reaction upgrade on any stance): the batch-1 hash 6c4dab... is kept for saves made on the merged tree.
// Batch 1 (Ward Poise + Poise break together) has its own hash 6c4dab...; each branch's hash (1551ec..., e4f237...) is kept for worker saves.
// The batch-1 CI fixes (Broken plan forecast, otherEnemy target, boost clearing, Ward refill guard) move the hash again; e6c9b9... joins the previous set.
// the batch-2 merge of w25-modals (blacksmith/option modals, item properties) moves the runtime hash; earlier batch-1 668f10... is kept.
// the batch-2 merge of w25-stances (stance natural benefits, stanceBenefits rules) moves the runtime hash; w25-stances' own 211930... and the earlier f2b79e... are kept.
// Sweep has no extra benefit (owner: sweeps are AoE for full damage): the sweep row leaves stanceBenefits and the hash moves; the batch-2 stances merge hash 28288b... is kept.
// the batch-2 merge of w25-elements (element identity: fixCoreMechanics.json elements, the shock/chill/freeze/brittle/necroticBuildup/knockback statuses, the receipt stages) moves the runtime hash; a save made before keeps its snapshotted rules, which lack elements, and plays as before. w25-elements' own 33931a... and cc8bab... and the earlier 093f55... are kept.
// the batch-2 merge of w25-stats (PR from max(INT, WIS): ratings.prAttributes; live attribute changes in a fight) moves the runtime hash; a fight saved without the key keeps INT-only PR. w25-stats' own 4d6cf7... and the earlier f47819... are kept.
// Batch 3 (Broken wording on cards, relics and the Prepared status; the rank-up bonus pick) moves the runtime hash; the batch-2 hash a4c872... is kept.
// W25-W (2026-11-15): Ward's Block-first routing (`ward.routing` in fixCoreMechanics.json) and the Barrier -> "Gain N Poise" wording move the runtime hash; batch 3's 753eed... is kept.
// Theme C of the 2026-11-17 playtest (tooltip wording on the Melee, Reach, Ranged, Reaction and Ethereal mechanic manifests), merged on theme B, moves the runtime hash again; wording only, no rule. Theme B's 73fdb0... and theme C's own cb5271... are kept.
// The Ethereal manifest's reader is the engine again (review of #2819: it pointed at the upgrade step); wording only, edad64... is kept.
// Owner ruling 2026-11-18 sections 20 and 21 (Force physical with a half-Poise share, no built-in push or Knockback; Ward decay and break; Pierce 1 Block per stack; break statuses) move the runtime hash again. They are data in the fight's rules (elements.force, ward, pierce, poise): a fight saved before them keeps its snapshotted rules, and an old `elements.force.poiseMultiplier` keeps the old Force (ForceRules); 8be512... and 0bf081... are in PREVIOUS_RUNTIMES.
// Prepared-only Focus wording and the shared Evade grant source reference move only the runtime artifact identity.
// The 2026-11-19 deferred Axe Strength grant repoints its generated mechanic reader to finishAbilityPlay; the preceding runtime keeps its own snapshotted rules.
const PREVIOUS_RUNTIMES = new Set([
  // Before catalog regeneration 7c32f9ef4bc: keep the exact recorded profile and its tradition tags.
  'sha256:c77d4f30494cb821fc66b9b9ef19b91fbb2c699633fe0137b72ab89d261ec831',
  // Dev c5c5ec4a before #3002: no enemyLevelScaling table or enemy level-card lists.
  'sha256:eff6f5c38dcdba3c78d012bf55c8baf6fe703f664bc3f3416244b15d1fa07216',
  'sha256:0c4e9eae226108858dcb937000b0992a33b778f650bb3e3e17a1c369ba51a0b3',
  'sha256:b49503d593056a588d5ae9a25ac214fc801c7b7eaea22093d601f76afe9d27f8',
  'sha256:d2993c77a6e8a5ff16dc1b5edf11d30cb924d790e7875af0452a4e8f0183ef63',
  'sha256:5311c2f843c0f42ef94e4b8ab0f4050400fdbc383c4c2395ef14bb563453801d',
  'sha256:777939d6ee4065a02491fcd7ff21fc2d9f44271a0d7f10ec3b2435d1786a72cd',
  'sha256:d243637be191cbe2c2580420f88bf2f5a672caa4a17e0c8c0eeca7685b75cf7d',
  'sha256:e316635810ab4101030e92e5d2169d0659ce1536caf82f1333f33b854ca4a6c3',
  'sha256:0805e9ad9ee6882390661bd96cc146d4645da893d78d3bec82c2563640b5323f',
  'sha256:a5c68d23829dca78e12749ab6d743b6e9c27e0915d952afe870f6355169e4474',
  'sha256:d5db9a0655276f175cdbeb8299a6e91853c22408b4410fb80ee3674db79a90fa',
  'sha256:fbf370e6b803b5dde87934ba7bb0e0789209ea33dc1ce45c2642f4eee9fd8f1d',
  'sha256:7d13f17231bc92b54d21befc738383d6df1824d2083cb9037c22790e7d2b6cf7',
  'sha256:e5b5d5b558969077b703152b30648fd7e49830b8caa2cb0b94d7ad788f820573',
  'sha256:edf0d924c49e924157a7c4250168a0e470ad3cf282f63d7439ab66eca9f8d8b0',
  'sha256:ac60781b09e46ca4816ac4148f4ff4269760f5d43872ad1db9a507a439274586',
  'sha256:7dd4e158c7af1a4af501cc4fa83f9647c2559a84b20a9c1c5ae881712bfcbc92',
  'sha256:045ee701108b82e397597cb08696c4400efd156c848b4cf2e4e18dae1db286c9',
  'sha256:04de9306278ad81f89b62fa2a2fbde640f6d7ba258fe74e63b9f46cb23d9b0b8',
  'sha256:de42dafc4ec394c607c7c52a5772bdd940728ff863ccfb21508e8a2a05f1d0bc',
  'sha256:72ec668dbba9685fd6fe6ab7f95b33c98410450e412336982b5a9dc005281649',
  'sha256:59cc12805591c6c2441d3b34360fd2562376fad622f136e591680a05d56af10a',
  'sha256:2a83899f7a10b415a18fb43d150034bcbf4e3ef92cc4ea4c19dfc9bd85fdecd3',
  'sha256:ca7639619f5a9ff7adceb0622043ea676fb18bace9ef14166ca4724fafb619f8',
  'sha256:50362dd44639557361f67ebe789bf6109bb8459242b0d48d48535a00aabf95e9',
  'sha256:8f1b1cf21f5758b4e1b1b916c9227df0747b56490217395410b94e6cffa259cc',
  'sha256:a00f7a769672150f37d74824575c7d6cfd35e32f939d292dab1d1ee609ed9f7c',
  'sha256:6ef2ef789d2e9ce07bf5c0ece58314d1500a242d79cbbcd4d23d825dd6a9fd16',
  'sha256:521250500d421c9742b8877b11e395c5718e0fc218c1add1c27c85d338253772',
  'sha256:58cd1d56ba6007b40be607b77077ca7df0ac3f29e14600f32aabd48c41cc4085',
  'sha256:404f187342bcbb67ba7095a6d573a998a931a67a75d22323461d60767ff52a3c',
  'sha256:0bf0815362566977311de28e6a67c2826858afcb9bf92f3555a149110cc522e5',
  'sha256:8be512681975999205549239c452a0051c7a79aabda91308c7db562950357c4c',
  'sha256:0a9ca339e4e8b0c57969966057718b6eb946e30387099430d5b8868643c0aeb8',
  'sha256:edad64eb5d0992e6eee07b451ea4b95fc51302018437017d6697c7cd1cecf6c5',
  'sha256:73fdb07daecf40ce03f3d066a795fb5519b3eb0048c21447511d23c33ee9ff53',
  'sha256:cb5271059640a11d4d4b87795a6e553464d721ca14c05e327b2fe0396f5497f9',
  'sha256:b9c05567d296fc4a2dcf8342d541e54cbc257f4dae6dc3d08533082b48342db7',
  'sha256:0ca590715034b7f075d9ca81ad54ce1734e2d6af951ffd39e202d2148f2c10e9',
  'sha256:73ef240835ff52f3dec38ad7b0a972d6f4886adf88fbbf1e3bf12a42d53161f2',
  'sha256:df30b7dac0b52f363d4875c083955c3efeaf9cebe235ef3e523a2e8d58c0f2e5',
  'sha256:2d76f2baf4fae3e676b06003c74c1fb30843067f48dec7fe021457dca05ccae6',
  'sha256:325247ed975d7b18ab5a977e3efb8483e5e8c654a0a9d11c9b7a53bedd87e603',
  'sha256:7d9597e6901b25772224028d996115d4b701a62f5833fea3c6b8a6d3ed790250',
  'sha256:90750818d2d5e94ed699a58f54765513a378302e22337b4d0ee6d1bdddd9a9c9',
  'sha256:85b9a51058593c1bae6f6e94e4caae773ffaa302a101b40c7c16ed36b4fde871',
  'sha256:bc9c46837da134c46cca9abf9f5edc65b5c8132ea88a02235b28e8eaabb85b02',
  'sha256:83a0c5760dc38cbe463b051e4cb1170e5127b3327d1b47f4750bda03b7993fa8',
  'sha256:2dcba5a61dd9744492242292686131de0ecf1c4ce2757f64c1abcf117297f954',
  'sha256:0fe8ce6f870456545f67f209af3b2f17230fc43b0cc1f99932e6e4185df6d4e5',
  'sha256:b3c6a61e232308597b39a6d77757c473dd6d33b69fe3db848eabba1bc58421f6',
  'sha256:965682a58b40bf7289b03d5ca54789f45b08c55bc1e8db5619e3894a742a80a7',
  'sha256:05977e492f74b543357e606b8e3cf7a0dd8984bc746a4dda123c976c851f660b',
  'sha256:802e46d530589fa030bd1a34ee07ec890ea678d4754c7320291a5d91b91cd1ff',
  'sha256:a7efc394eb86299cf97384c6e3d451a645a93a8249f5ddcf4e17fe86c0768193',
  'sha256:f0e3f7d50507dc85138f974f40b6981011e4174da69ded3c3d32dc150e87ea6b',
  'sha256:fae7af5e34880ba22e670dbf0af013f01a3f2167ad6cb6e0d4a8e45413068ae3',
  'sha256:9808461cfbc52808af58a51f46ab39f06911875fbc921bd416c9237a1b90b5b6',
  'sha256:63e8d1b1176bab9240c9d15ecca73574dcf14b1fa45870129fd7674a6209e034',
  'sha256:9c112f52442c1df4e59c63c648d7e3324a39c1f7c7981b57112929ac99bc3843',
  'sha256:22534c34792bcf9db9688514836cd66c77470c68a3c3b3703ac8164a706129ef',
  'sha256:68d430e0053091cec98f2819769a92bfbd7e944af9b8237bc315cd40f472fc87',
  'sha256:1551ec573f5dc9da9059c1bf6d55866e690f2a3bb2fae06eecdee43abba2c9c7',
  'sha256:e4f2378397bc3baef53d6c38b2609fe181c47096a64e38ebd2e84c61c8f3bf76',
  'sha256:6c4dab6e49b3a99427f623babb5529761cb178596bf3b919f2db7bdaf8910156',
  'sha256:e6c9b9af71d93d0662ca2e9c06266a59a059ec112c3f2e7fd75eb8fb4a27c0d4',
  'sha256:668f10ab6f6139504fbe7e63a661d203bc487eebaadfea604d4deab63ff7364e',
  'sha256:f2b79eabc865dd5e317c63a86bbff25afe81675a7fc2f2c491a4d4b5f24766b5',
  'sha256:211930bddff697aa6894291370d65bfa6ebc2a9e5c673a840ce68f37c4d4b891',
  'sha256:28288b331e757629f7240e110a45698817150d9c1001c8e43fcfe4a723f311c0',
  'sha256:093f5541161859e8ed91a74baa580c44f24058e377cd0b930d33c9da7aa6b372',
  'sha256:33931a536301d048ab52e76fb6a2df49e92b7ff5aac774da88167cab19b30701',
  'sha256:cc8babb17366b93494ea58ce367ed435052f603b593beeee598698a6251ab1cf',
  'sha256:f478198585239b6625dabf7f8541ce4a9e7e7cb4e6d93fdd4bbae847b0274c73',
  'sha256:4d6cf722bb83154aa34bd78b6aeb320fa05b98d557e25bc1155e9fd9297c9d63',
  'sha256:a4c872ecda5683fecafdd96805411896a32b11bceef517168221600647f189ce',
  'sha256:ad67bcf673204516f765000883738c8110f0701ceccbc94dbd4167489728ee1a',
  'sha256:a2854aeb6df487f9efe4bb1358b16df21d4a8d614e0090f63c23c6507d0f2613',
  'sha256:753eed5a7b51b22ba88dee172eebaaf122204189d2eb7576dc8b5cadda3ac763',
  'sha256:0ea717b957fdd4add2b4a16745f8dff8475a3ae08ee11377b47bfc41464a98f1',
  'sha256:9f334813aab14c772228bf6612058393550f453e4c1549d7d2b0dd496ff2b179',
  'sha256:1cb94094c521bfc9e0ad13066046d32142b6bb163db7d024e5c031aa2c019ba0',
  'sha256:8af5d70cc4e5608e15f4536e058782426af5c8de0b6c6c76713a5f730d6ceda2',
  'sha256:63e86f49078b08d5e66222e2fa7abb1fedda43f04fef27dcde5cfe1cec5d8434',
  'sha256:3e2a30822c5d5c72de68ce659efacfc124cc4418b04e611c21b48de177445e30',
  'sha256:5b4af5bc7a4392da72001450ac193e05875dd8df1ec0bccf9edcd91d7b2f78cf',
  'sha256:5db789257edff6ccecfbb277e81ab30e3aae881512d7420aa48b78e93989e32a',
  'sha256:fd966dab88e5d25f38037c91ae136d5bf8f7e6c97dd3800e05d449750d21c572',
  'sha256:eb76303d1d3613e52717a20d58633bbeefc5b5f38fe16ba64338d9e830833f8b',
  'sha256:6c2ff725ad1e7091e9bbe845b117677ea795c77bba0cc2927b6ab133f3570ebf',
  'sha256:1d8ae1110ad291fb2e6c06344e804837f3969b1a2156b35abf1b73d5d602b5cb',
  'sha256:8c57f365f79a7d77421f5d50188c8c96f993bd17f68e55cfadbb4bb2f35e25d8',
  'sha256:fa12ec96cbd300f3f77ac7a0ed1faffe4dc2a780d6f57d38fb74ee53c14a18bd',
  'sha256:c569dee21009eb36ba8a7cc8b2437f843aae9c2c784d5ae4fcab36ebcffeed4f',
  'sha256:a81550e92799eaf09bb092dc21b1c310d0e2a80e0a2dd1708547952693e1ad4f',
  'sha256:11f0682ec2b9f37d14ec0ed489d95a54d2ce7167cc50f4cfbaa296280e0a9655',
  'sha256:8be512681975999205549239c452a0051c7a79aabda91308c7db562950357c4c',
  'sha256:f959055404a8638a465770e8f3a5572e04bdb2ba259e4e13441482a673b63b05',
  'sha256:c7c295d2af270f815e8de01086a31718390a5eb3d3253474d90ab97cd95f15c7',
  'sha256:80a96c9211d1596d5c28a9d061184d5d0dbf0ab52623b6fd244a13f62cd61ae7',
  'sha256:0bf0815362566977311de28e6a67c2826858afcb9bf92f3555a149110cc522e5',
  'sha256:58cd1d56ba6007b40be607b77077ca7df0ac3f29e14600f32aabd48c41cc4085',
  'sha256:6ef5d30c3d03a486ab6dafa5756463219cd801324544beedfa76d170066865eb',
  'sha256:edb03b160d360fcbd7ac312134fc535bc1e2b90ad45d6bcbfcff780c6dc8ec06',
]);
// Moved by the rankUpCard row (batch 3), then the spellCosts/elementFlux rules (W25-F), Ward routing (W25-W), the cost.manaOnly tag and its spells (W25-MS);
// the statusCaps rule key (W25-NC); the Counter stack rule (batch 5); the bands rules (W25-BANDS) with the swapRows op, Upset the Ranks, formation Block and spell lanes (rules 6-9). Then W25-EvadeCards (Evade card data, card modes, the self Advance). Then the Evade card faces, the Quickstep Counter stack and the Evade-grant face phrase (src/model/fixCoreMechanics.js, playingCard.js). Pinned once at the batch-5 + bands + Evade cards merge; 8c57f3... is now in PREVIOUS_RUNTIMES.
// Theme B (2026-11-17: Counter decay keeps it armed, the Defend Poise floor, the enemy Counter badge, the Prepared/Idle stance weaknesses) moves it again; b9c055... is now in PREVIOUS_RUNTIMES.
// Theme A (2026-11-17: base damage halved, single-stat AR/DR/PR, SP and MP at 3 points, stat-point gear, act levels for elites and bosses,
// Blacksmith prices) moves it again; 73fdb0... is now in PREVIOUS_RUNTIMES.
// The #2820 review (tier HP scale in combat creation, reactive returns kept out of the base scale) moves it again; fa12ec... is now in PREVIOUS_RUNTIMES.
// The 2026-11-18 rulings (ratings removed, 0.7 cuts, hand, SP and MP per four points) move it again; 0a9ca3... is now in PREVIOUS_RUNTIMES.
// The physical cut (2026-11-18: physicalDamageMultiplier 0.7, blockGainMultiplier 0.49) moves it again; 11f068... is now in PREVIOUS_RUNTIMES.
// The Retreat status mechanic folder and the Magic Focus text (2026-11-18 green-discovered pass: engine/mechanics/status.retreat, item_magic-focus) move it again; 8be512... is now in PREVIOUS_RUNTIMES.
// The equipment.mainHand and offHand mechanic text (feature merge, 2026-11-18) moves it again; f95905... is now in PREVIOUS_RUNTIMES.
// Combining the drawback text and balance rules keeps both branches' exact runtime pins compatible.
// The route spread (2026-11-18: 11 depths, start rest, V spread, re-entry keys) moves it again; 0a9ca3... is now in PREVIOUS_RUNTIMES.
// Registry stance rows name their combat maneuver (stances.json, 2026-11-18, #2843) and the Prepared mechanic text follows; 0a9ca3... is now in PREVIOUS_RUNTIMES.
// Merging the route spread (#2847) with the stance-card fix (#2843): c7c295... and 80a96c... are now in PREVIOUS_RUNTIMES.
// Merging dev (route spread #2847, stance fix #2843) into the rules pass (#2835): 0bf081... and 6ef5d3... are now in PREVIOUS_RUNTIMES.
// The gear pass mechanics (2026-11-18/19: gear vocabulary, armour type bonuses, Poise bases) merged with dev's 58cd1d... moves it again; 58cd1d... and this branch's 0bf081... are now in PREVIOUS_RUNTIMES.
// Merging dev (#2835 and the route spread) into the Force, Ward and Pierce rules pass (chore/ForceWardRules): dev's 58cd1d... and this branch's 404f18... are now in PREVIOUS_RUNTIMES.
// Arcane/Divine (2026-11-18): prior profiles retain their absent version flag
// and their original Poise snapshot; no saved profile is re-authored.
// The Defend-only Smash override approves the existing edges again; old combats retain their absent override and shared tuning.
// Canonical Stone Skin and Fire Thorns mechanic manifests regenerated after Dev integration.
// Diamond Skin display rename keeps stoneskin and stoneHide identities stable.
// Combined Gear, stat traditions and Smash rules retain every parent runtime above.
// Card tradition labels move to uiStrings.csv (card.tradition.*, #2892 review): wording only, no rule; edf0d9... is now in PREVIOUS_RUNTIMES.
// Merging dev (card tradition labels, spell traditions) into the Retreat reach rules and drawbacks (chore/RetreatReachRules): dev's 7d13f1... and this branch's e5b5d5... are now in PREVIOUS_RUNTIMES.
// The Magic Adept zero Mana floor (2026-11-22, owner ruling: stance.playerMinimumCost in fixCoreMechanics.json and the combat.stance parameter schema) moves it again; fbf370... is now in PREVIOUS_RUNTIMES, and a fight saved without the key keeps floor 1.
// No card has a cost minimum (owner ruling 2026-11-22: stance.playerMinimumCost, the retired balance.mana floors, the upgrade cost steps) moves it once more; d5db9a... is now in PREVIOUS_RUNTIMES.
// The cost.manaOnly mechanic is data now (its cardCosts.js validator rule went with the cost minimums) and Exhaust/Ethereal are flat in scoring: the runtime artifact moves once more; a5c68d... is now in PREVIOUS_RUNTIMES.
// Ward health buffer (owner ruling 2026-11-24: ward.routing "hpBuffer", ward.hpPerStack 5 in fixCoreMechanics.json) moves the runtime artifact; e31663... joins PREVIOUS_RUNTIMES, and fights saved with blockFirst keep their snapshotted rules.
// Weapon poise damage & stance-gated Poise reduction (owner ruling: weaponPoiseEnabled in fixCoreMechanics.json) moves the runtime artifact; d24363... joins PREVIOUS_RUNTIMES, and prior saves keep their snapshotted rules.
// The canonical Wisdom, Intelligence and Recurring registry additions and four reader relocations
// move the registry fingerprint. A saved fight keeps its original envelope and rules (777939...).
const COMPATIBLE_HOST_RUNTIMES = new Set([
  'sha256:5311c2f843c0f42ef94e4b8ab0f4050400fdbc383c4c2395ef14bb563453801d',
  // The gear budget honors the pinned Poise floor when an archived profile omits its cost.
  'sha256:b49503d593056a588d5ae9a25ac214fc801c7b7eaea22093d601f76afe9d27f8',
  // The enemy Mana floor respects each saved profile's own enemy inputs.
  'sha256:0c4e9eae226108858dcb937000b0992a33b778f650bb3e3e17a1c369ba51a0b3',
  // Same rules compiled from the repository's canonical LF kernel bytes.
  'sha256:c77d4f30494cb821fc66b9b9ef19b91fbb2c699633fe0137b72ab89d261ec831',
  // Enemy level scaling (spCap in engine/kernel/gameConfig.js) moves the host runtime; prior saves keep their own rules.
  'sha256:659730689c3f0675a28b5ecbf6ef6c2bcbefa32b77c4794a5a5f9c14f0b8f07d',
]);
export function coreEvasionCompatibleRuntime(profile, currentRuntime) {
  return COMPATIBLE_HOST_RUNTIMES.has(currentRuntime)
    && PREVIOUS_RUNTIMES.has(profile?.lock?.runtimeHash)
    && profile.lock.runtimeABI === 'ashen.runtime@1'
    && profile.lock.numericPolicy === 'ashen.adapter-numbers@1'
    && profile.lock.core === 'ashen.core@2.0.0'
    && profile.foundation?.mode === 'configured'
    && profile.modules?.effects?.fixCoreVersion === 1
    ? profile.lock.runtimeHash : currentRuntime;
}
