# Dev fast discovery partition

Dev fast discovery shard 4/6 reached the existing 15-minute subprocess limit in [run 45558401623](https://github.com/cehinds/AshenSpire/actions/runs/45558401623) and again in [run 45569064523](https://github.com/cehinds/AshenSpire/actions/runs/45569064523/job/139050941283). The second job reported 1,372 passing lines and no failed assertions before the cutoff. GitHub’s commit comparison showed the second run’s merged tree had the same bytes as the passing PR head `3839ba0d8ae`.

The Dev matrix replaces 4/6 with 4/12 and 10/12. Each contains 109 files from the old 218-file group. The other five assignments, slow-file exclusions, separate Test coverage, and time limits are unchanged.

The lane test failed against the old matrix and passed after the split. Its actual discovery census verifies each fast file runs exactly once. The 12-position modulo proof also covers future files. All 45 focused workflow-consumer tests passed with the pinned v30 art cache. Hosted timing is pending.
