// src/ui/components/foldGlyph.js — THE MARKS THAT SAY WHAT A CONTROL DOES.
//
// Measured 2026-09-02 across 78 driven surfaces: the Armoury Character view
// alone drew THREE disclosure marks at once — `▾` on Combat Power (authored in
// CSS as a `::before`), `^` and `v` on the Inventory and Cards trays (ASCII
// letters), and `▸` on each card row — while the Shrine and the Smith modal
// both used `›`. Four marks, three families (small triangle, ASCII letter,
// angle quote) for ONE idea, and they were authored in three places: a CSS
// `content:`, a frozen table in trayComponents.js, and literals inline in four
// templates. A player cannot learn four marks for one idea; they learn none.
//
// So this is the home, and it is a JS constant rather than a CSS custom
// property because three of the four call sites were already writing the glyph
// into markup. The fourth (Combat Power) moved to markup to join them — one
// home beats one mechanism.
//
// THE AUTHORED GLYPH IS ALWAYS THE COLLAPSED ONE, and that is not a style note
// — it is why this table has two members and not four. Every fold in the tree
// already rotates its mark in CSS on `[open]`, so the markup states one glyph
// and the open state is drawn, never re-rendered. Three of the four rotated 90
// degrees and Custom Run rotated 180 from a down-pointing mark; that fourth is
// now 90 from `▸` like its siblings, so there is one rotation grammar as well
// as one family.
//
// `FOLD_GLYPH.expanded` exists for a fold that CANNOT rotate — a mark rendered
// into a canvas, or one whose host is already transformed. Nothing needs it
// today. It is here because a table with only the collapsed half invites the
// next hand to invent the other one.
//
// WHY TRAYS GET THEIR OWN ROW AND NOT THEIR OWN FILE. A tray is docked to an
// edge and travels when it opens, so its mark answers "which way does this
// move?" — a bottom tray opens UPWARD and a top tray opens DOWNWARD, and one
// glyph cannot be right for both. That is a real distinction, and it was
// already encoded (trayComponents.js, as `v`/`^`/`<`/`>`); what it lacked was a
// family. It borrows this one instead of minting a second.
//
// ONE FAMILY: the small triangles ▸ ▾ ▴ ◂. Not `▶`/`▼` — those are the heavy
// pair, they read as filled blocks at HUD sizes, and the tree already leaned
// small everywhere except the one place that leaned heavy.

/** A fold in place: collapsed points AT the content, expanded points ALONG it. */
export const FOLD_GLYPH = Object.freeze({ collapsed: '▸', expanded: '▾' });

/**
 * A docked tray's mark, by the edge it is docked to: the direction the panel
 * TRAVELS when the control is pressed.
 */
export const TRAY_FOLD_GLYPH = Object.freeze({
  top: Object.freeze({ closed: '▾', open: '▴' }),
  right: Object.freeze({ closed: '◂', open: '▸' }),
  bottom: Object.freeze({ closed: '▴', open: '▾' }),
  left: Object.freeze({ closed: '▸', open: '◂' }),
});
