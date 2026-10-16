# Footer fade B

Actual standalone combat captures, using Core, seed 3, five cards, turn 1 and reduced motion. No game state or DOM was modified for the captures.

The desktop backing now fades from transparent at reference y=700 to opaque at y=790 in a 900px-high viewport. The existing floor continues behind the cards; scene scaling and camera transforms were unchanged.

| Viewport | Final capture |
| --- | --- |
| 1440 × 900 | [Desktop](desktop.png) |
| 1920 × 1080 | [Wide](wide.png) |
| 1024 × 768 | [Tablet](tablet.png) |
| 390 × 844 | [Mobile](mobile.png) |

[Desktop before](desktop-before.png) · [Measured comparison](comparison.json)

## Verification

- Top 90 pixels match the baseline exactly at all four sizes, preserving the header fade.
- Tablet and mobile screenshots match the baseline entirely, pixel for pixel.
- Actor, mini-HUD, hand, piles, potions, End Turn, Grid, Combat log and Reaction bounds have zero pixel movement at all sizes.
- No horizontal overflow or browser page errors. Desktop and wide changes are confined to the lower backing region.
- Independent source comparison also confirmed unchanged scene-layer dimensions and transforms.

## Capture provenance

Final local standalone: source `e337fce1f`, runtime change `72d9b3fd6`, embedded runtime digest `8e8ec2aa5c`, version `0.7.1.1534`.

HTML SHA-256: `6017a89115ab507ae968e3d72a1576a2af64813dfdc05ad7158487b94fc4ee63`.

Baseline standalone: source `dd2e7eefd`, embedded runtime digest `d536bec1cf`, version `0.7.1.1534`; HTML SHA-256 `ae39e98e049da18e65927956fda399d897274a02fed2b7234ffe847e6a44288a`.

Captured from `http://localhost:4460/AshenSpire.html?shot=combat&gameProfile=core&shotSeed=3&shotHand=5` on 2026-10-16 UTC. These images document the local build; published build links are maintained in the main feature README.

Both Feature builds passed: [Core standalone](https://github.com/cehinds/AshenSpire/actions/runs/38956660452/artifacts/12071135711) at `e337fce1f` and [Current standalone](https://github.com/cehinds/AshenSpire/actions/runs/38956718201/artifacts/12071195797) at `80fb1a207`. Latest Pages publication remains unverified. No dev, test, or main promotion.
