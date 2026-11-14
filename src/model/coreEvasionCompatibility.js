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
const PREVIOUS_RUNTIMES = new Set([
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
]);
const FIXED_EVASION_RUNTIME = 'sha256:22534c34792bcf9db9688514836cd66c77470c68a3c3b3703ac8164a706129ef';
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
