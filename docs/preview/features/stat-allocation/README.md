# Stat allocation capture record

After images show exact compiled source `c9e25d8863a0c4a8905263713bd7594adaae7f11`, build **0.7.4.204**, source digest **d00f2f55a6**. The normal Title screen authenticated that full build stamp before navigation to the allocation modal. The generated Core profile catalog payload was verified byte-for-byte in the compiled artifact; Core profile `sha256:c3f1e334e50486a3b4825aced9d99785f11f0eb9d03d741f07b36e95cc96c46a` and compatibility runtime `sha256:de42dafc4ec394c607c7c52a5772bdd940728ff863ccfb21508e8a2a05f1d0bc` match the source.

Captured at **2026-11-19T08:54:52.000Z** UTC; local capture clock **2026-11-18 23:54:52 GMT−9** (America/Anchorage). These are posed captures: the existing `?shot=rest&shotRestPoints=1&shotClass=reaver` fixture earns one point through the real XP ledger, followed by actual Armoury > Character > Progression > allocation controls. They do not represent a campaign playthrough.

| Image | Viewport | State |
| --- | --- | --- |
| `desktop.png` | 1280 x 800 | Compiled after, compact |
| `phone.png` | 390 x 844 | Compiled after, compact |
| `wide.png` | 1920 x 1080 | Compiled after, compact |
| `tablet.png` | 1024 x 768 | Compiled after, compact |
| `phone-wisdom.png` | 390 x 844 | Compiled after, Wisdom expanded |
| `phone-intelligence.png` | 390 x 844 | Compiled after, Intelligence expanded |
| `before-desktop.png` | 1280 x 800 | Source baseline, compact |
| `before-phone.png` | 390 x 844 | Source baseline, compact |

The two before images come from the required `qa:sandbox --base origin/dev` run at **`a1d31db6b57bcd18201b226d455159740ee9c27c`**. That source baseline records **0.7.4.203**, digest **69e1693f0d**, in `buildordinal.json`. They are source-tree captures, not captures of a compiled 203 artifact; the old sandbox did not record Title-stamp DOM, so no rendered ordinal is inferred. See `baseline-record.json`.

Verification: curated compiled capture **31 PASS**; source sandbox **200 PASS / 0 FAIL**, baseline **159 PASS / 41 expected FAIL**; detailed browser flow **1120 PASS / 0 FAIL**. The curated viewports have no console/page errors or visible broken images. No tracked build metadata was retained: local `buildordinal.json` was restored to repository 203 after the exact-source build.

[Download the exact-source CI artifact](https://github.com/cehinds/AshenSpire/actions/runs/44490295512/artifacts/14513015463) (GitHub sign-in required). The artifact is associated with the reviewed c9 source; these PNGs were captured from its locally rebuilt compiled counterpart, authenticated as 204/d00.

[Pending hosted feature route](https://cehinds.github.io/AshenSpire/branches/fix/StatAllocationRules/latest/) - publication is pending and this is **not yet a verified Play link**. The root session owns publication verification.

Machine-readable source/build/viewport metadata: `capture-record.json`. Full sandbox and detailed reports remain in the external sibling `sandbox/` and `detailed/` directories.
