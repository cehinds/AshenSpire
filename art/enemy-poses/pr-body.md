Replace the seven remaining legacy enemy sprites with painted idle art and add a character-specific attack frame for all 33 enemies. The other 26 painted idle images are preserved. Combat displays the attack frame during its existing attack state and returns to idle afterward.

Includes all source sheets, generation prompts, a comparison gallery, 66 exported frames, and rebuilt game files. These are individual attack keyframes.

Validation: asset coverage and transparency checks; all 33 renderer transitions; gallery image decoding and phone overflow; Node suite; build; verify-shipped; buildversion --check. Revalidated after rebasing onto current dev.

Closes #750.
