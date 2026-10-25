# Console/Menu playback fix — source review snapshot

This snapshot exists to provide a stable feature-preview ref for canonical PR [#2311](https://github.com/cehinds/AshenSpire/pull/2311). It does not change the reviewed runtime or test code.

## Source identity

- Current #2311 head: `03362d63b45d4bd9ac7f358479d0712e26147b7c`
- Current #2311 code tree: `fff3101d5aa62b1aa3e4095d30688793e4e52c8e`
- Snapshot parent / current `dev`: `6451df1db5b272288a6e5a6ad818c806e0dd7603`
- Snapshot tree uses the five exact changed-file blobs from #2311's current tree and adds only this review record. Thus its code/changelog paths match that PR tree; the whole snapshot tree differs by this document.

| Path | Blob |
| --- | --- |
| `src/ui/components/hudmeta.js` | `9d32ab827b26dafe0f56ddbea1baf68e26b5d24d` |
| `src/ui/components/menuComponents.js` | `a7152db26d35703e1198cf14621e7277d3dfaa2b` |
| `tests/instant-read-only-skip.test.mjs` | `e34ba0797e790c94a6770d0aa139bdcdcdb5628d` |
| `CHANGELOG.md` | `dc8642f710192bb10b0e967c43a85438849a1208` |
| `src/content/changelog.generated.js` | `dba3476defa1a12f55a3396a65045acad89c6cdf` |

## Verification and limits

The focused `instant-read-only-skip.test.mjs` test passed 4/4 on these exact source/test blobs in the prior worker validation; `git diff --check` passed there as well. The test dispatches synthetic DOM pointerdown through the real animation-skip capture handler, including from a rendered Console label; it is not physical-device touch coverage.

The earlier feature-preview run 40165419565 passed for head `136328b88ceb0127cd724f1d7bb9fdf3e3468757`, which predates current Dev restamps. It is stale for current head `03362d63b45d4bd9ac7f358479d0712e26147b7c`. Four responsive captures and a preview for the current source remain pending.
