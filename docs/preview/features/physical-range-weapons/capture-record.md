# Physical Reach and Ranged weapons - enlarged spear and contrasting outline

These four images depict the production procedural resolver in a local source fixture. They do not depict a packaged or published game build. The fixture now loads the actual pinned v26 spear endpoint; no local substitute is used.

- Source base: ea237e41be15ee7e9fdb4f84472e8a36eb18dabe, box0.7.2.97 /5e93c235eb. This identifies the preexisting base box only, not a generated build identity for the edited source.
- Resolver SHA256: 9c5375f09dc57e792dfe6c7cf88ac78e88f815d8c872224114f3b4f41ac13671. Exact source patch retained in outputs/card-range-enlarged-ivory-source-evidence/source.patch outside the game repository.
- Adopted art release: https://github.com/cehinds/AI-Art/releases/tag/ashenspire-hd-assets-v26 at1412b8ed588a2b4549b43fb19757b5e79442b923. Accepted spear master SHA256 d616223ce0a03a6a4818e6636c6c80f5b68695ff48ae767d7d7d8818870dec7c; original provenance retained in AI-Art PR3. High/light archive hashes remain frozen.
- Spear scale: main548square (+26.9%), Counter459square (+35%). Measured1254px source alpha bounds x69..1223/y25..1217 keep the entire tip and handle within the512x640 stage. Bow remains432/340.
- Weapon outline: pale ivory rgba(255,246,220,0.98), existing0.9px thickness. Shields, books, feathers, shadows, backgrounds and effects retain their prior treatment.
- Capture URL: http://127.0.0.1:8322/build/card-range-preview.html . QA selected Reach attack, Ranged attack, Reach Counter and magical Fire Counter in a compact four-example grid.
- Capture script: work/capture-card-range-enlarged-ivory.mjs, using the existing QA browser runtime and official isolated launcher.
- Capture date:2026-10-31 America/Anchorage (UTC2026-11-01).

| File | Viewport | UTC capture |
| --- | --- | --- |
| desktop.jpg | 1280x720 | 2026-11-01T04:36:03.910Z |
| mobile.jpg | 390x844 | 2026-11-01T04:36:04.070Z |
| wide.jpg | 1920x1080 | 2026-11-01T04:36:04.274Z |
| tablet.jpg | 1024x768 | 2026-11-01T04:36:04.442Z |

All four captures verified fully decoded art, four examples and no horizontal page overflow. Desktop/mobile images were visually inspected. Focused runtime art tests pass66/66, including selected paths in the pinned manifest, cache separation, ranged precedence, enlarged-spear alpha containment, weapon-only outline and magical Counter geometry/cues. Screenshots do not establish those behaviors by themselves.

An exact packaged/published game preview remains pending feature delivery. The earlier source captures are preserved separately under outputs/card-range-source-evidence and must retain their original identity.

The captured resolver matches source implementation commit0004281fb3761bf867ec5dbbaeff5f602675bf06. Later dev integration does not change that resolver source. Root fresh CUA inspection passed the enlarged spear and ivory outline.
