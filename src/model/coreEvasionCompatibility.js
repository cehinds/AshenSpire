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
const PREVIOUS_RUNTIMES = new Set([
  'sha256:0bf0815362566977311de28e6a67c2826858afcb9bf92f3555a149110cc522e5',
  'sha256:8be512681975999205549239c452a0051c7a79aabda91308c7db562950357c4c',
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
  'sha256:0a9ca339e4e8b0c57969966057718b6eb946e30387099430d5b8868643c0aeb8',
  'sha256:11f0682ec2b9f37d14ec0ed489d95a54d2ce7167cc50f4cfbaa296280e0a9655',
  'sha256:8be512681975999205549239c452a0051c7a79aabda91308c7db562950357c4c',
  'sha256:f959055404a8638a465770e8f3a5572e04bdb2ba259e4e13441482a673b63b05',
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
const FIXED_EVASION_RUNTIME = 'sha256:404f187342bcbb67ba7095a6d573a998a931a67a75d22323461d60767ff52a3c';
export function coreEvasionCompatibleRuntime(profile, currentRuntime) {
  return currentRuntime === FIXED_EVASION_RUNTIME
    && PREVIOUS_RUNTIMES.has(profile?.lock?.runtimeHash)
    && profile.lock.runtimeABI === 'ashen.runtime@1'
    && profile.lock.numericPolicy === 'ashen.adapter-numbers@1'
    && profile.lock.core === 'ashen.core@2.0.0'
    && profile.foundation?.mode === 'configured'
    && profile.modules?.effects?.fixCoreVersion === 1
    ? profile.lock.runtimeHash : currentRuntime;
}
