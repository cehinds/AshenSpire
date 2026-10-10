# Combat footer pointer behavior

Enemy footers retain the full name and HP presentation and the complete packed
104px footprint. The name remains an inspection button: its center opens the
full read when no card or flask is selected, and its existing keyboard behavior
is unchanged. The independent fighter-selection square is 44px and occupies the
left side of that same footer. With no card or flask selected, central name taps
inspect and taps in the left core select the fighter's contextual explanation.
During targeting, both retain their existing card/flask commit behavior. Name
events stop propagation, so one gesture never also invokes the frame handler.
Overhead Information controls retain priority over the core.

This revises the earlier centered-core implementation recorded in the combat
session continuation. That implementation intercepted the name button's center.
Moving only the transparent enemy core restores the name's native inspection
surface while retaining a separate frame-owned finger target. The painted plate,
actor placement, player target, hand, obstacle footprint, and game rules remain
unchanged. Native input helpers read the actual core geometry before choosing a
pointer destination. A valid rendered `::before` core takes precedence; the
painted `::after` geometry is used only if the cap is unrendered or invalid, not
because a valid cap is covered. The existing frame-grid candidates remain, and
every sampled point still rejects inspection controls and covering actors.

Source geometry and ownership checks do not establish compiled or device
acceptance. The unchanged screenreach and independent 24px five-point target
gates must verify the packaged cascade and actual native hit ownership.
