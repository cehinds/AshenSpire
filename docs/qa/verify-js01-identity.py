"""Verify JS01 after the mechanics registry and birth-only starter ranks."""
import copy
import json
import re
import subprocess
import sys
from pathlib import Path

if len(sys.argv) != 4:
    raise SystemExit("Usage: verify-js01-identity.py BEFORE_SOURCE AFTER_SOURCE OUTPUT_DIR")
before_root, repo, output = (Path(value).resolve() for value in sys.argv[1:])
output.mkdir(parents=True)
ART = "weaponArt:greatsword:greatswordSunderingHew"
OLD_RUNTIME = "sha256:777939d6ee4065a02491fcd7ff21fc2d9f44271a0d7f10ec3b2435d1786a72cd"
NEW_RUNTIME = "sha256:5311c2f843c0f42ef94e4b8ab0f4050400fdbc383c4c2395ef14bb563453801d"
OLD_PROFILE = "sha256:375cef033da7ca8e95366698b991446d57c496e5ed4d36e6a3122719d9c79506"
NEW_PROFILE = "sha256:d2ff32d4e924c6782570b6de552a3589414f62aed93f1635afaacd76a09cab07"
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
