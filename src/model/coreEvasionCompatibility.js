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
// dev's runtime before that retune (73ef24...) and the earlier combined-merge runtime (df30b7...): a run saved there keeps its own snapshotted profile, rules and content.
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
]);
const FIXED_EVASION_RUNTIME = 'sha256:965682a58b40bf7289b03d5ca54789f45b08c55bc1e8db5619e3894a742a80a7';
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
