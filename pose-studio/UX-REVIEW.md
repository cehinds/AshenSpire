# Direct effect editing review

The reported 550px workflow hid size and removal in a separate inspector. The
modal effect library also made the timeline inert. New-effect drops onto a
timeline layer used the old playhead and default layer instead of the drop.

## Comparison and implementation

| Reference | Relevant pattern | Applied in Pose Studio |
| --- | --- | --- |
| [Aseprite timeline](https://www.aseprite.org/docs/timeline/) | The timeline exposes the sprite's layers and frames. | Each effect has a named row, six sprite thumbnails, a removal button and a shared time ruler/playhead. Behind, front and aura remain separate layers. |
| [Godot animation panel](https://docs.godotengine.org/en/stable/tutorials/animation/introduction.html) | Track list, timeline and property controls work together; selecting a key exposes its editable values. | Canvas and strip selection share one visible size/timing toolbar. Direct handles have numeric and keyboard alternatives. Larger-frame mode provides a scrollable detailed timeline. |

The following interaction choices address the reported failures directly:

- Size is a live slider and pixel input beside the preview, with four on-canvas
  corner handles. One pointer gesture creates one undo step. Rotated and mirrored
  effects use the same inverse view transform for hit testing and movement.
- Remove, Hide/Show and Duplicate are visible beside the selected effect.
  Every effect also has a timeline removal button, including hidden clips.
  Delete/Backspace removes an effect only outside text inputs and modal dialogs.
- Dragging a strip preserves the pointer's position within it. Its edge handles
  change start/end timing. Arrow keys shift it 10ms; Shift+arrows change duration.
  The numeric start, duration and layer controls are the precision alternative.
- Library drops use the requested time and layer. The narrow-screen library is
  an inline tray, leaving the preview and timeline interactive. Its dedicated
  grip supports mouse and touch, while tapping a tile inserts at the playhead.
- Preview zoom (50–300%), Pan, Focus character and Reset view enlarge or move
  the complete scene independently of the saved effect sizes. Target toggles
  only the reference partner. These view aids do not change game auras or JSON.

## Verification

`tests/direct-editing.mjs` exercises actual pointer/touch gestures, undo,
mirrored/zoomed transforms, rotated resizing, timing handles, exact drop placement,
removal, keyboard alternatives and portable download/reload at 1440, 550 and
390px. `tests/browser.mjs` retains the real combat playback and aura regression
checks. `tests/usability.mjs` covers discovery, card connections and tool focus.

This is a documentation-based comparison and an interaction review using the
reported workflow; it is not a comparative user study. Effect strips retime the
existing six-frame animation. They do not create per-frame property keyframes.
