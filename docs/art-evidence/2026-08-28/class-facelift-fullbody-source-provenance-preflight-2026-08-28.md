# AS-HD-20260826-040 — class-facelift full-body source/provenance preflight

TICKET | AS-HD-20260826-040/ART-FACELIFT  
STATUS | COMPLETE / READ-ONLY / SOURCE-PROVENANCE PREFLIGHT  
OUTCOME | Classes 4/4 examined. Preflight PASS 0; WITHHOLD 4. No source is authorized as a facelift master, attachment, reader mapping, or production asset.  
SOURCE BASE | `d163fd2c53e72705d12f78f8652bf93acd9fc0e8`  
SOURCE TREE | `f1ebf460e38d6c6669b91148d4bc63085aca94c5`  
SOURCE CHECKOUT | `C:\repos\AshenSpire-qa-legacy-resume-composed`, clean when read; no files changed.

## Method and evidence boundary

This census searched only documented local AshenSpire repository/projectless evidence: the pinned source checkout, its `CREDITS.md` and equipment Blender pipeline, and the documented class-concept package. Pixels were decoded and visually inspected; no file was generated, downloaded, masked, attached, copied, or derived.

The source checkout's `CREDITS.md` is SHA-256 `D01831E6CA84C2EB44699B2C4A7B9357557193DFDC359263ADC79D66123A772F`, Git blob `1bb7e348b7bd23cd478cb53d9df19d0dea72ea59`. Its equipment-art row declares the `assets/equipment/*.webp` family **AshenSpire**, **CC0**, procedurally modeled/rendered by `tools/equipment-blender.py`; the pipeline Git blob is `901b416ee2008aa9c04ece88c0050f660e07b962`.

This is a folder-level first-party CC0 declaration, not a per-file immutable production-provenance package. Therefore it supports a conditional source chain but cannot by itself satisfy a full final-asset provenance clause.

## Exact local candidates and class verdicts

| Class | Exact current body candidate | Decoded evidence | Author / license / reference chain | Independent full-body silhouette finding | Preflight verdict |
|---|---|---|---|---|---|
| Reaver | `C:\repos\AshenSpire-qa-legacy-resume-composed\assets\equipment\body_reaver_default.webp` — SHA-256 `A59D4483BF9EC50ADC35BE2DA842FA3FE35049F6389190B4DF30274F06FB7474`; 16,012 bytes; Git blob `0472edd1c9198d77ba3b7ce8bd0fe5b1f96942b7` | 450×570 WebP, RGBA; alpha 0–255; transparent 153,621, semi 4,317, opaque 98,562 pixels. Full-height armored/caped figure visible. | Data portrait census `D78A3A42CDFFA27832E1975D0A5DAC6880F172D9CFF73AD9A2B674B4699019B4` → `CREDITS.md` folder row → `equipment-blender.py` → exact body blob/path. Author AshenSpire; CC0. | Visual full-body evidence is present and class-distinct from Starseer/Herald. It is an existing equipment body, not an approved facelift reference/master. | WITHHOLD — per-file immutable provenance/package, facelift-input release, UI crop/state contract, and manifest/reader authority absent. |
| Starseer | `C:\repos\AshenSpire-qa-legacy-resume-composed\assets\equipment\body_starseer_default.webp` — SHA-256 `A4DE84A2F925BCE512F92AEA40D7FAF0671C3540B40D595F67E82EF3FD7EDE5E`; 11,884 bytes; Git blob `95fd6de78293e5debed610ebc0a2cab992493487` | 450×570 WebP, RGBA; alpha 0–255; transparent 162,069, semi 4,274, opaque 90,157 pixels. Full-height robed, wide-hatted figure visible. | Data portrait census → `CREDITS.md` folder row → `equipment-blender.py` → exact body blob/path. Author AshenSpire; CC0. | Visual full-body evidence is present and silhouette-distinct from Reaver/Herald. It remains a runtime equipment body, not an approved facelift reference/master. | WITHHOLD — per-file immutable provenance/package, facelift-input release, UI crop/state contract, and manifest/reader authority absent. |
| Rogue | `C:\repos\AshenSpire-qa-legacy-resume-composed\assets\equipment\body_rogue_default.webp` — SHA-256 `AAB107C67420459075D0F21EFBBCD9AEED217D49F87F696A7D5CAFE2B259201B`; 15,564 bytes; Git blob `f1a72c900d716c439ffa0c968ebac03966ac5ab8` | 450×570 WebP, RGBA; alpha 0–255; transparent 153,621, semi 4,317, opaque 98,562 pixels. Full-height body is visible. | Data portrait census → `CREDITS.md` folder row → `equipment-blender.py` → exact body blob/path. The generator maps `rogue` to `build_reaver` (pipeline lines 394–397); author AshenSpire; CC0. | **Fails independent-silhouette clause:** the current Rogue body reuses the Reaver rig/silhouette. A differing body-file hash does not establish a distinct silhouette. | WITHHOLD — independent silhouette fails; additionally lacks per-file immutable provenance/package, facelift-input release, UI crop/state contract, and manifest/reader authority. |
| Herald | `C:\repos\AshenSpire-qa-legacy-resume-composed\assets\equipment\body_herald_default.webp` — SHA-256 `CBDB46428BF642411C0B1CD3F195C8BFF5F4D25336BE195F64621C24EA7CF754`; 18,648 bytes; Git blob `6f2e4d1820942cad40488cd992c12f070acb6c64` | 450×570 WebP, RGBA; alpha 0–255; transparent 168,369, semi 5,743, opaque 82,388 pixels. Full-height hooded figure and halo visible. | Data portrait census → `CREDITS.md` folder row → `equipment-blender.py` → exact body blob/path. Author AshenSpire; CC0. | Visual full-body evidence is present and silhouette-distinct from Reaver/Starseer. It remains a runtime equipment body, not an approved facelift reference/master. | WITHHOLD — per-file immutable provenance/package, facelift-input release, UI crop/state contract, and manifest/reader authority absent. |

Visual full-body evidence: 3/4 independently distinguishable (Reaver, Starseer, Herald); 1/4 fails (Rogue). Full source/provenance preflight: PASS 0 / WITHHOLD 4.

## Rejected local concept evidence — not source candidates

The only documented Class Facelift concept package is `C:\Users\const\Documents\Codex\2026-08-26\ashenspire-art-combatant-profile-portraits-v1\concepts\playable-classes`. `CONCEPT-LEDGER.md` calls every file a reversible non-production concept with no canonical asset/ID/reader-mapping/release status. `CONCEPT-DIRECTION-PACKET.md` states all four are 1254×1254 RGB with checkerboards baked into pixels and cannot satisfy the future 512-square RGBA-master contract.

| Class | Local concept | SHA-256 | Mode / issue | Reference chain | Disposition |
|---|---|---|---|---|---|
| Reaver | `reaver-concept-v1.png` | `13DE067B7DF2E7FE9BEB377FBAC9ED3A85F62C487ECAA33764E94E8C35DD0093` | 1254×1254 RGB; baked checkerboard; concept thumbnail. | Built-in ImageGen concept ledger; shared Veiled Rogue finish reference only, SHA `91E9E57BDB4CE9EDB29627C71A2D8DFF486AAB5AA39F2F07AA8E109A4B9A0078`, AshenSpire CC0-1.0. | WITHHOLD / direction evidence only. |
| Starseer | `starseer-concept-v1.png` | `42BD2664D8D23C23C7061CB6CCBAB84A86715BEF1845A37416C52AA31BD38099` | 1254×1254 RGB; baked checkerboard; concept thumbnail. | Same ledger/reference chain. | WITHHOLD / direction evidence only. |
| Rogue | `rogue-concept-v1.png` | `CA34C3CD3131CE7110B35C2778E543BB95ADB1226BBF3E7E9F72ADA6509D6E1D` | 1254×1254 RGB; baked checkerboard; concept thumbnail. | Same ledger/reference chain. | WITHHOLD / direction evidence only. |
| Herald | `herald-concept-v1.png` | `A02C051679F5460E4DDBC7F8034B082AEF5A181AD6B83355A3A421C371FCE280` | 1254×1254 RGB; baked checkerboard; concept thumbnail. | Same ledger/reference chain. | WITHHOLD / direction evidence only. |

The ledger also records a Reaver-only background-extraction retry as RGB/no alpha (`B79D1C9C4D63705DDD31533FD6FC55B1871670B6C0A78E38996B4EC536EEC5A1`); it remains rejected diagnostic evidence and is not a candidate.

## Block, wake, and currentness

BLOCK | No approved per-file provenance package for the four body sources; no explicit authorization to use an existing equipment body as a facelift input; no exact UI crop/size/state receipt; no authorized portrait manifest/reader; Rogue lacks a distinct full-body silhouette. RGB/checkerboard concepts and the failed Reaver alpha retry are ineligible.

WAKE | Main must name (1) an approved first-party per-file source/provenance package and a class-distinct Rogue full-body source, and (2) an exact UI crop/size/state contract plus manifest/reader steward. Re-run this census against those immutable pins before any generation or attachment.

CURRENTNESS | All examined repository candidates match the documented `d163fd2c`/`f1ebf460` source chain. This is not a claim about a newer checkout, adoption, deployment, or release.

AUTH | Projectless read-only source/provenance census only. No generation, edit, masking, download, attachment, derivation, adoption, integration, publication, delivery, or release mutation.
