# Final dark filter pass

User refinement: “add a dark filter to it”. Applied to both desktop and mobile using built-in image_gen.

## Shared exact prompt

```text
Use case: lighting-weather
Primary request: Apply a dark cinematic filter to this finished AshenSpire painting. Darken overall exposure about half to two thirds of a stop, deepen charcoal shadows, reduce bright sky and wet-stone highlights, add a very subtle dark edge vignette and a muted smoky umber/charcoal color grade. The whole image should feel noticeably darker and more ominous. Preserve useful shadow detail rather than crushing it to solid black. Keep the small molten orange cracks, chest cinder and ember eye readable, with controlled glow; keep the face, silhouette and steel sword discernible.
Constraints: This is ONLY an overall lighting/color-grade edit. Preserve EXACTLY the character design, hunched pose, anatomy, face, sword, equipment, ruined Fell Courtyard gate, banner, castle, scenery, composition, textures, painterly detail, aspect ratio and dimensions. Do not redraw or add elements. No text, watermark, new flames, gore or UI. Output a single finished image of the same orientation and aspect ratio.
```

## Desktop call

Input: C:/Users/suprbludude/.codex/generated_images/01a0bc8d-64af-7e83-805d-78c7dfd720d0/exec-d6271b86-1042-46df-a55e-bc7f82dbef83.png

Appended prompt: Input image 1: desktop landscape edit target.

Final output: C:/Users/suprbludude/.codex/generated_images/01a0bc8d-64af-7e83-805d-78c7dfd720d0/exec-45773246-c669-47c2-9709-152406b8f899.png

## Mobile call

Input 1: C:/Users/suprbludude/.codex/generated_images/01a0bc8d-64af-7e83-805d-78c7dfd720d0/exec-45203c59-f1f4-4568-a00d-780b6c0b4cbe.png

Input 2: C:/Users/suprbludude/.codex/generated_images/01a0bc8d-64af-7e83-805d-78c7dfd720d0/exec-45773246-c669-47c2-9709-152406b8f899.png

Appended prompt: Input image 1: MOBILE PORTRAIT edit target. Image 2: darkened desktop color-grade reference only. Match its darkness and restrained ember intensity while retaining the exact portrait composition of Image 1. Return only one tall portrait image.

Final output: C:/Users/suprbludude/.codex/generated_images/01a0bc8d-64af-7e83-805d-78c7dfd720d0/exec-a5534b9c-5f9e-4226-8fe7-3d96c5787d2c.png

