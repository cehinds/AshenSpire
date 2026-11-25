"""Verify JS01 after the mechanics registry and birth-only starter ranks."""
import copy
import json
import re
import subprocess
import sys
from pathlib import Path

if len(sys.argv) not in [4, 5] or (len(sys.argv) == 5 and sys.argv[4] != "--reward-fallback"):
    raise SystemExit("Usage: verify-js01-identity.py BEFORE_SOURCE AFTER_SOURCE OUTPUT_DIR [--reward-fallback]")
before_root, repo, output = (Path(value).resolve() for value in sys.argv[1:4])
output.mkdir(parents=True)
ART = "weaponArt:greatsword:greatswordSunderingHew"
OLD_RUNTIME = "sha256:777939d6ee4065a02491fcd7ff21fc2d9f44271a0d7f10ec3b2435d1786a72cd"
NEW_RUNTIME = "sha256:5311c2f843c0f42ef94e4b8ab0f4050400fdbc383c4c2395ef14bb563453801d"
OLD_PROFILE = "sha256:375cef033da7ca8e95366698b991446d57c496e5ed4d36e6a3122719d9c79506"
NEW_PROFILE = "sha256:d2ff32d4e924c6782570b6de552a3589414f62aed93f1635afaacd76a09cab07"
REWARD_PROFILE = "sha256:3e79711486dec8c428dc4934efb8b60060c67a59c11af2011846566276146bc0"
PHASES = ["start", "pending", "restored", "live", "afterRestore"]
ARTIFACT_HASHES = {
    "ashen.mechanics-runtime": (
        "sha256:23a3dfd8cf63e93cc18c91a84025d9e24a289e74f8869b9d6abc4205cb809849",
        "sha256:fde2316c7de8f8ba070a6ca4e1cd07b92018e069f0efcd53d8c688461406f25c",
    ),
    "games/ashenspire/packs/core/starterDeck.json": (
        "sha256:5fab92b9e74036a679475a1e2d0bc8d64704111c67aa35e21a8d3dc09825ea1e",
        "sha256:f537ff9fe3dc5f16363c556324c2ca01d4599ba61c57888cb94a0f8b365473b7",
    ),
}


def read(path):
    return json.loads(path.read_bytes())


def capture(root, label):
    # Test scenarios remain the single source of the replay actions. The
    # instrumentation saves raw state alongside the same digest calculations.
    test = root / "tests/core2-cleanup-baseline.test.mjs"
    source = test.read_text(encoding="utf-8")
    for path in ["../engine/kernel/gameConfig.js", "./fixtures/"]:
        url = (test.parent / path).resolve().as_uri()
        source = source.replace(path, url + ("/" if path.endswith("/") else ""))
    source = source.replace(
        "import { productionBundle } from './helpers/production-bundle.mjs';",
        "import { writeFileSync } from 'node:fs';",
    )
    source = source.replace("import(`../${id}`)", "import(`" + root.as_uri() + "/${id}`)")
    source = re.sub(r"const require = productionBundle[^\n]+\nconst bundled[^\n]+\n", "", source)
    source = source.replace(
        "function checkpoint(api, combat) {",
        "const checkpoints = [];\nfunction checkpoint(api, combat) {\n"
        "  checkpoints.push(plain({ snapshot: api.serializeCombatSnapshot(combat), events: combat.eventLog }));",
    )
    source = source.replace(
        "const storedJson = storage.getItem(api.runKey(1));",
        "const storedJson = storage.getItem(api.runKey(1));\n"
        "  capturedSaves[run.runId] = {stored: JSON.parse(storedJson)};",
    )
    source = source.replace(
        "assert.ok(loaded, manager.runStatus().reason);",
        "assert.ok(loaded, manager.runStatus().reason);\n"
        "  capturedSaves[run.runId].loaded = JSON.parse(api.serializeRun(loaded, { inline: true }));",
    )
    source = source.split("test('the original historical profile fixture", 1)[0]
    source += '''
const capturedSaves = {};
const result = Object.fromEntries(scenarios.map(([name, ...args]) => {
  checkpoints.length = 0;
  return [name, { digest: baseline(native, ...args), checkpoints: [...checkpoints] }];
}));
writeFileSync(new URL('./CAPTURE.json', import.meta.url), JSON.stringify({result, saveCaptures: capturedSaves}));
'''.replace("CAPTURE", label)
    runner = output / f"{label}.mjs"
    runner.write_text(source, encoding="utf-8")
    subprocess.run(["node", str(runner)], cwd=root, check=True)
    return read(output / f"{label}.json")


def compare_profile(old, current):
    assert old["hash"] == OLD_PROFILE and current["hash"] == NEW_PROFILE
    assert old["lock"]["runtimeHash"] == OLD_RUNTIME and current["lock"]["runtimeHash"] == NEW_RUNTIME
    assert "weaponArtRank" not in old["content"]["starterDeck"]
    assert current["content"]["starterDeck"].pop("weaponArtRank") == 1
    current["hash"] = OLD_PROFILE
    current["lock"]["runtimeHash"] = OLD_RUNTIME
    found = set()
    for artifact in current["lock"]["artifacts"]:
        key = artifact["id"] if artifact["id"] == "ashen.mechanics-runtime" else artifact["path"]
        if key not in ARTIFACT_HASHES:
            continue
        assert key not in found
        found.add(key)
        old_hash, new_hash = ARTIFACT_HASHES[key]
        assert artifact["hash"] == new_hash
        artifact["hash"] = old_hash
    assert found == ARTIFACT_HASHES.keys()
    assert current == old


def remove_art_rank(cards):
    [art] = [card for card in cards if card["instanceId"] == ART]
    assert art.pop("rank") == 1


def compare_snapshot(old, current):
    adjusted = copy.deepcopy(current)
    if "gameProfile" in old:
        compare_profile(old["gameProfile"], adjusted["gameProfile"])
    remove_art_rank(card for pile in adjusted["piles"].values() for card in pile)
    assert adjusted == old



def normalize_reward_profile(old, new):
    assert old["hash"] == NEW_PROFILE and new["hash"] == REWARD_PROFILE
    assert old["lock"]["runtimeHash"] == new["lock"]["runtimeHash"] == NEW_RUNTIME
    expected = copy.deepcopy(old)
    expected["hash"] = new["hash"]
    expected["modules"]["reward-ranks"]["lowerRankChance"] = 0.05
    expected["content"]["rewards"]["eligibility"]["combatCards"]["lowerRankChance"] = 0.05
    [defaults] = [row for row in expected["lock"]["artifacts"]
                  if row["path"] == "engine/modules/reward-ranks/defaults.json"]
    assert defaults["hash"] == "sha256:c7068514dba76f79213e670bc0dcecafaa0af4813b0c79431badc965eeed711d"
    defaults["hash"] = "sha256:0c47c365b82d002f43880b6150527a6b6d3df42d2bd2f94149f8a7442afb4e6c"
    assert old["modules"]["reward-ranks"]["lowerRankChance"] == 0.1
    assert old["content"]["rewards"]["eligibility"]["combatCards"]["lowerRankChance"] == 0.1
    assert new == expected


def compare_reward_payload(old, new):
    adjusted = copy.deepcopy(new)
    if "gameProfile" in old:
        normalize_reward_profile(old["gameProfile"], adjusted["gameProfile"])
        adjusted["gameProfile"] = old["gameProfile"]
    assert adjusted == old


def check_reward_fallback(before, after):
    old = before["result"]
    new = after["result"]
    historical = "historical action policy"
    assert old[historical] == new[historical]
    assert old.keys() == new.keys()
    overlay = {"profile": {"hash": REWARD_PROFILE, "runtimeHash": NEW_RUNTIME}, "scenarios": {}}
    for name in (key for key in old if key != historical):
        before_case, after_case = old[name], new[name]
        old_digest, digest = before_case["digest"], after_case["digest"]
        assert old_digest["profile"]["hash"] == NEW_PROFILE
        assert digest["profile"]["runtimeHash"] == NEW_RUNTIME
        identity = {key: digest["profile"][key] for key in ["hash", "runtimeHash"]}
        assert identity == overlay["profile"]
        assert len(before_case["checkpoints"]) == len(after_case["checkpoints"])
        for prev, current in zip(before_case["checkpoints"], after_case["checkpoints"]):
            assert prev["events"] == current["events"]
            compare_reward_payload(prev["snapshot"], current["snapshot"])
        expected_digest = copy.deepcopy(old_digest)
        expected_digest["profile"].update(identity)
        snapshots = {phase: digest[phase]["snapshot"] for phase in PHASES}
        for phase, sha in snapshots.items():
            expected_digest[phase]["snapshot"] = sha
        expected_digest["save"] = digest["save"]
        assert digest == expected_digest
        overlay["scenarios"][name] = {"snapshots": snapshots, "save": digest["save"]}
    assert before["saveCaptures"].keys() == after["saveCaptures"].keys()
    for name, saves in before["saveCaptures"].items():
        for mode, snapshot in saves.items():
            old_save = copy.deepcopy(snapshot)
            new_save = copy.deepcopy(after["saveCaptures"][name][mode])
            for payload in [old_save, new_save]:
                payload.pop("savedAt", None)
            if name.startswith("js01-current-"):
                compare_reward_payload(old_save["combatEntered"]["snapshot"], new_save["combatEntered"]["snapshot"])
                new_save["combatEntered"]["snapshot"] = old_save["combatEntered"]["snapshot"]
                compare_reward_payload(old_save, new_save)
            else:
                assert old_save == new_save
    (output / "reward-fallback-identity.json").write_text(
        json.dumps(overlay, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    print("JS01 verified reward fallback profile delta, all raw checkpoints and save envelopes")


if len(sys.argv) == 5:
    check_reward_fallback(capture(before_root, "before-reward"), capture(repo, "after-reward"))
    raise SystemExit(0)


before = capture(before_root, "before")
prior = before["result"]
archived = read(repo / "tests/fixtures/core2-cleanup-current-7dff4b03.json")["scenarios"]
identity = read(repo / "tests/fixtures/core2-cleanup-current-5311c2f-identity.json")
latest = capture(repo, "after")
assert identity["profile"] == {"hash": NEW_PROFILE, "runtimeHash": NEW_RUNTIME}
assert identity["scenarios"].keys() == archived.keys()
assert prior["historical action policy"] == latest["result"]["historical action policy"]
checkpoints = 0
for name, original_digest in archived.items():
    previous = prior[name]
    candidate = latest["result"][name]
    assert previous["digest"] == original_digest
    expected = copy.deepcopy(original_digest)
    expected["profile"].update(identity["profile"])
    replacement = identity["scenarios"][name]
    assert list(replacement["snapshots"]) == PHASES
    for phase in PHASES:
        expected[phase]["snapshot"] = replacement["snapshots"][phase]
    expected["save"] = replacement["save"]
    assert candidate["digest"] == expected
    assert len(previous["checkpoints"]) == len(candidate["checkpoints"])
    for original, new in zip(previous["checkpoints"], candidate["checkpoints"]):
        assert original["events"] == new["events"]
        compare_snapshot(original["snapshot"], new["snapshot"])
        checkpoints += 1

prior_saves = before["saveCaptures"]
assert prior_saves.keys() == latest["saveCaptures"].keys()
for name, originals in prior_saves.items():
    for mode, snapshot in originals.items():
        old = copy.deepcopy(snapshot)
        candidate = copy.deepcopy(latest["saveCaptures"][name][mode])
        for payload in [old, candidate]:
            payload.pop("savedAt", None)
        assert old["contentVersion"] == candidate["contentVersion"]
        if name.startswith("js01-current-"):
            compare_profile(old["gameProfile"], candidate["gameProfile"])
            for zone in ["deck", "collection"]:
                remove_art_rank(candidate[zone])
            compare_snapshot(old["combatEntered"]["snapshot"], candidate["combatEntered"]["snapshot"])
            candidate["combatEntered"]["snapshot"] = old["combatEntered"]["snapshot"]
        assert candidate == old
print(f"JS01 verified {checkpoints} raw current checkpoints, eight exact save envelopes and unchanged historical replay")
