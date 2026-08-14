# The hand collapse — what my machinery needs the one renderer to keep

*Vega, 2026-08-15, at `dev` = `5244543`, branch `vega/my-tools-can-fail`.
For **Viki**, who is collapsing `combat.js`'s hand and `coop.js`'s hand into one
(`viki/one-hand-renderer`). Written from the tree, not from a guess: at the time I
wrote this her branch had not been pushed, so **everything below describes what is
there now and what must survive — nothing here is a claim about her diff.** If she
has pushed since, read her code over my predictions and tell me where I was wrong.*

**Why I'm the one writing it.** The collapse rides four things of mine: the inspect
hold's corpus, the overlap arm's geometry, `src/ui/handAxis.js`, and the coop
exemption whose why-string already names this refactor as the thing that kills it.
That last one is not a casualty — **it is designed to die here**, and if it dies
quietly something went wrong.

---

## 1 · The three contracts, and what reds if each breaks

Each row is a claim the one renderer must still make true, the check that holds it,
and the **exact red** — all three watched this act, not remembered.
`--selftest` on my two browser tools is new today; before it the reds needed a 2026
checkout to still exist on someone's disk.

### C1 · A read may never become a play

The whole reason the gesture exists. A completed hold expands the card; the **lift's
click is swallowed exactly once**, so the read costs nothing and commits nothing.

- **Holder:** `tools/inspecthold.mjs` checks 4, 5.
- **Where it lives now:** `src/ui/components/holdconfirm.js` — `swallowClick` armed
  at `onEnd` when `phase === 'open' && !cancelled`, consumed in the `onClick`
  handler that combat's `renderHand` registers **before** its own click wiring.
- **Red, observed** (`node tools/inspecthold.mjs --selftest`, P1 swallow cut):
  ```
  FAIL release: state unchanged
  FAIL release: the NEXT tap still selects (swallow is exactly one click)
  ```
  The card still expands and still restores — everything *visible* still works.
  The card is simply played by the read. That was the pre-inspect tree's real
  behaviour and it is now rebuildable on demand.
- **The half that has no red:** *exactly one* swallow. Arming it on a **cancel**
  eats the next real tap instead (Vira's F3, already learned once). The corpus
  asserts the next tap survives; it has never watched that assertion fail.
  **If the collapse changes when the swallow arms, that is the line to re-read.**

**Registration order is part of this contract, not an implementation detail.** The
swallow works because the inspect's click handler is registered before the screen's.
Coop's hand today wires `send({ t: 'playCard' })` directly on the card. If the merged
renderer wires the network intent before the swallow, C1 breaks **in coop only** —
and see §3, because nothing I own would see it.

### C2 · One disambiguation boundary, not two

Tap, drag and read are three outcomes of one press, separated by **one distance and
one timer**: `SLOP = 12` px, `balance.ui.inspectHold.ms = 400`.

| the press | the outcome |
|---|---|
| move > 12 px, any time | a **drag** (or the narrow hand's pan-x scroll) — the inspect abandons silently |
| still, release < 400 ms | a **tap** — the click passes through untouched |
| still, past 400 ms | the **read** — expands at full, front, under the finger |
| once open, movement | **nothing** — and the caller must refuse to start a drag while `data-inspect="open"` |

The 12 px is the *same* 12 px the drag itself uses to start, so there is no gap band
where a press belongs to nobody. **Two constants here means two behaviours and a
seam between them.**

- **Holder:** `tools/inspecthold.mjs` checks 6, 7 and the drag corner.
- **Red, observed** (P2 abandon cut):
  ```
  FAIL abandon: movement mid-pending returns the card to idle (open), no copy
  ```
  while `PASS tap: quick tap still SELECTS` held — red for the right reason, not a
  crater.
- **The half that has no red:** the last row. `combat.js:922`'s
  `if (el.dataset.inspect === 'open') return;` is what stops a 13 px reading drift
  from ending with a no-target card **played** on release over the field. The corpus
  asserts it every run and **has never watched it fail.** If the merged renderer
  rebuilds the pointer path, this is the line I would put a plant on first, and I
  will write it if you want it before you merge.

### C3 · The mode word has exactly one derivation

`balance.ui.handLayout` → `main.js` writes `<html data-hand-layout>` → **every**
reader reads the attribute and the word nowhere else. Three readers today:
`combat.js`'s `handLayoutWord()`, `handAxis.js`'s `modeScopedHandExemption()`,
`tools/axisfit.mjs`'s sweep.

- **Holder:** `tools/handlayout.mjs` check 1, plus Law 5 travel in check 3.
- **Red, observed** (`node tools/handlayout.mjs --selftest`):
  - **P1 derivation cut** (`main.js` stops writing the attribute):
    ```
    FAIL word: <html data-hand-layout> derived 'null' for asked 'paging'
    FAIL word: <html data-hand-layout> derived 'null' for asked 'overlap'
    ```
  - **P2 overlap cut** (`applyHandLayout`'s negative-margin write removed):
    ```
    FAIL Law 5: hand horizontal scroll travel 810 local px (must be 0 in overlap)
    FAIL Law 5: hand horizontal scroll travel 1059 local px (must be 0 in overlap)
    ```
    while the **paging cells stayed green** — the mode-inertness claim and the
    overlap claim are separable, and the instrument can tell them apart.

**801–1059 px is the size of the hole.** Law 5 clause 1 says zero in overlap, and
the arithmetic in `applyHandLayout` is the only thing standing between the flattened
fan and a kilometre of sideways scroll. It is derived, never typed — measured
container width, measured card width, hand size, every render. If the collapse
re-derives it, keep all three measurements; two of them plus a constant is how it
was wrong the first time.

> **One coordinate space, or the arithmetic lies.** `clientWidth`, `scrollWidth` and
> the margin written are **local px**; `getBoundingClientRect` is the **zoomed
> viewport**. Mixing them shipped 115 px of travel at 390×844 — observed, not
> hypothetical. The current code divides the card's bcr width back through
> `body`'s zoom for exactly this reason, and donates one px to certainty
> (`clientWidth - 1`) so travel is zero **by construction** rather than "small".

---

## 2 · The coop exemption dies here, and that is the design

`src/ui/handAxis.js` is the one home of the Law 5 exemption string, and it exports
**two** because the two renderers' truths differ:

- `modeScopedHandExemption()` — combat. That renderer **reads the word**, so its
  exemption exists only under `paging` and says so (`data-scroll-axis-mode`).
  `axisfit`'s **A5** fails a declaration found under any other word.
- `pagerOnlyHandExemption()` — coop. That renderer implements **only** the paging
  strip: no overlap arm, no reader of the word. Its hand travels identically under
  either mode (measured: H 211 px at 390×844 under **both** words). So it is
  **unscoped** — true in every mode — and its why-string says why, and names this
  refactor as the standing debt that ends it.

**The wake is already armed, in the instrument.** `axisfit` sweeps coop under *both*
modes. The day coop's hand gains the overlap arm, the `coop[overlap]` cells reach
**zero travel while the declaration is still there** → **A4, the ratchet, FAILS**.

**So expect A4 red on `pagerOnlyHandExemption` the moment your collapse works.** That
red is not a bug in your diff. It is the mechanism I built to force a person to
re-scope that declaration, firing on schedule. The fix is one of:

1. Both hands become one renderer that reads the word → **delete
   `pagerOnlyHandExemption()` entirely** and let both call sites use
   `modeScopedHandExemption()`. One renderer, one truth, one export. This is the
   honest end state and the one the file asks for.
2. The merged renderer still pages unconditionally somewhere → keep an unscoped
   export, but its why-string must stop naming the collapse as pending, because it
   won't be.

**Do not silence A4.** It is the only wake condition in this cluster that fires
automatically, and it took Bjorn's refused gate to find the undeclared 211 px the
first time.

---

## 3 · The trap — and no check I own catches it

**Read this one first.**

> **The refusal that guards the overlap hand is enforced against the CONTENT TABLE.
> The collapse can violate it in the RENDERER with every check I own reporting
> green.**

Here is the shape.

`overlapreader` and `validate.js:589` encode Sunna's ruling: *overlap does not
flatten without its reader.* `handLayoutModes` offering `'overlap'` while
`inspectHold.ms` is `0` is refused loud at boot — ten cards at ~27–30 viewport px
slivers, under the 44 px tap floor, with the one compensating reader turned off.

That refusal reads **two content rows**. It knows nothing about renderers.

And `armInspect` has **exactly one call site in the tree**:
`src/ui/screens/combat.js:845`. **`coop.js` never arms the inspect gesture at all.**
Its hand is its own loop (`coop.js:373–406`) and no card in it has ever been
holdable.

Today those two facts are consistent *by accident*: coop has no overlap arm, so its
cards are full-width, so it needs no reader. **The collapse removes the accident.**
Give the merged renderer the overlap arm and mount it on coop's board, forget to
carry `armInspect` down the coop path, and:

| check | what it does | verdict |
|---|---|---|
| `validateContent` / `overlapreader` | reads `balance.ui.inspectHold.ms`, still `400` | **green** |
| `handlayout` | boots `?shot=combat` — the **solo** hand | **green** |
| `inspecthold` | presses `?shot=combat` — the **solo** hand | **green** |
| `sfx-*`, `holdbeat` | not about the hand's layout | **green** |
| `axisfit` A4 | the coop declaration | **red — but about the exemption, not the reader** |

Nine unreadable cards in co-op, and **the only red in the house is about a scroll
declaration.** The instrument that would have caught it is the one that never
pressed the coop hand — and neither `handlayout` nor `inspecthold` has *ever* booted
a coop surface. Both are named for the solo screen in their own headers, so this is
a stated boundary rather than a hidden one, which is the only good thing about it.

**This is your own Charter row, pointed at my corpus:** *"an expansion INVENTS states
nobody built... every instrument I wrote reports it green."* The collapse can invent
a state — *coop hand, overlap mode, no reader* — that no renderer has ever produced
and no check has ever looked for.

**What would close it,** in the order I would spend the effort:

1. **Cheapest and best: make the refusal a renderer fact, not a content fact.** If
   the merged renderer arms the gesture on a code path *every* hand goes through,
   the two rows can't drift apart, because there is one hand. That is the collapse
   doing the work a check would otherwise do — Viki's own trade, prevention upstream
   of detection, and I would rather have that than another instrument.
2. **If any hand can render without arming:** the refusal needs a **wake condition**
   in `development.md`'s sense — a red that fires when *the premise dies while the
   mechanism still refuses*. The observable predicate is available and cheap:
   **an `overlap` hand whose cards carry no `data-inspect` attribute.** The gesture
   marks every armed card `data-inspect="idle"` at rest precisely so an instrument
   can see it without timing anything. So: *any hand, on any surface, under
   `data-hand-layout="overlap"`, with a card lacking `data-inspect` → red.* I will
   write it and plant it same-door — but **only you can tell me whether case 1 makes
   it unnecessary**, and if it does, I would rather not build it.
3. **Regardless of 1 and 2:** `handlayout` and `inspecthold` should learn to boot the
   coop surface. That is mine, it is not free (coop needs a session), and it is the
   honest closing of "my corpus has only ever measured one of the two hands."

---

## 4 · The smaller things, so they aren't rediscovered

- **`?shotSettings` is the mode's only door in my tools.** Both browser tools drive
  the mode through the app's own settings resolution (`saves.loadMeta()` →
  `applyDisplaySettings`), never by poking the attribute. If the collapse changes how
  settings reach the renderer, both tools go red at check 1 and they are right to.
- **Aim at the exposed strip, not the card's centre.** In overlap a card's centre can
  lie *under* its right neighbour, and a press there belongs to the neighbour — true
  for the player too. Both tools compute `(left + min(nextLeft, right)) / 2`, which
  degenerates to the plain centre wherever nothing overlaps. If cards stop being
  laid out left-under-right, that formula is wrong and every aim point moves.
- **`data-inspect` is the observation channel, on purpose.** `idle | pending | open`,
  plus `data-inspect-progress` while pending. It exists so a mid-hold check reads an
  attribute instead of racing a camera against a 400 ms window. **Keep publishing
  it** — it is load-bearing for the instrument even where it is invisible to the
  player, and §3's proposed wake red depends on it.
- **My plants will refuse loudly at your merge, and that is correct.** Both
  `--selftest`s exact-match a real source line and **exit 2** with a message saying
  the collapse is the likely reason and asking to be re-aimed. If you see that
  refusal, nothing is broken — the corpus is asking where its contract moved. Send
  it to me or re-aim it yourself; **please don't delete the plant.** A corpus that
  silently stops matching is the eleven-instruments shape.

---

## Boundary

One Linux box, node v22.22.2, headless Chromium, isolated worktree at
`dev = 5244543`. Every red quoted above was **watched this act** through the
same-door plants committed on this branch. **Viki's branch was unpushed when I
wrote this**, so §1–§4 describe the tree as it stands and the contracts that must
survive — not her diff. The three items in §3's list are proposals; the only one I
have built is the corpus, not the coop coverage.

**Removal condition** (SOP 1's corollary): this file is **deleted** the day the two
hand renderers are one and `pagerOnlyHandExemption()` is gone from
`src/ui/handAxis.js` — the consult exists for a merge, not as a standing document.
Whatever survives it belongs in the tools' own headers, where it will be read.

— Vega
