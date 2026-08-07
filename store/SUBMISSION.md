# Store submission — what goes where, and what is still Constantine's

*Freja, 2026-08-07. The pixels are `tools/store-assets.mjs`'s job; this file is
the part that happens in a browser on partner.steamgames.com and therefore
cannot be a code comment. Regenerate everything with `node tools/store-assets.mjs`.*

**Sizes re-verified at the primary on 2026-08-07.** `partner.steamgames.com`
answered **403** through this environment on 2026-08-06 — the first cut of the
table was cross-checked against secondary sources and said so. It answers
**200** now, the docs read, and the re-read **moved three rows.** Those three are
the first section below, because a table that changed is the scary thing.

---

## What the re-read changed

| Was | Is | Source |
|---|---|---|
| `client-icon-32.png` — 32x32 PNG | **`shortcut-icon-512.png` — 512x512 PNG** | `/doc/store/assets/community`: "256px x 256px or 512px x 512px, ICO or PNG". **32x32 is not a Steam asset size at all** — it was a plausible number that no Valve page asks for. |
| `community-icon.png` — 184x184 **PNG, transparent** | **`app-icon-184.jpg` — 184x184 JPG, opaque ground** | Same page: App Icon is **"184px by 184px JPG"**. A JPEG has no alpha, and Valve says alpha "will be replaced with solid black" — a transparent authoring would have shipped a black square around the mark. |
| *(absent)* | **`page-background.png` — 1438x810**, optional | `/doc/store/assets/standard`. If we upload none, Steam generates one from the last screenshot. |

**And the `.ico` line was wrong.** The old comment said *".ico packaging happens
at submission."* It does not happen to us at all: **"We will generate the .ico
file if a png image is provided."** The packaging step that *is* ours is a
different file entirely — **macOS needs an `.icns`** in the "Mac Icon" field, and
without it the shortcut gets a default Steam logo. We do not produce an `.icns`
today (see *Open*, below).

---

## The upload map

Steamworks → *edit store* → **Graphical Assets**:

| Steamworks field | File | Size |
|---|---|---|
| Header capsule | `header-capsule.png` | 920x430 |
| Small capsule | `small-capsule.png` | 462x174 |
| Main capsule | `main-capsule.png` | 1232x706 |
| Vertical capsule | `vertical-capsule.png` | 748x896 |
| Page background *(optional)* | `page-background.png` | 1438x810 |
| Screenshots (**at least 5**) | `screenshot-*.png` | 1920x1080 |

Steamworks → **Library Assets**:

| Steamworks field | File | Size |
|---|---|---|
| Library capsule | `library-capsule.png` | 600x900 |
| Library header | `library-header.png` | 920x430 |
| Library hero | `library-hero.png` | 3840x1240 · safe area 860x380 centred · **no words** |
| Library logo | `library-logo.png` | 1280x720, transparent · position picked in Valve's preview tool |

Steamworks → **Community / client icons**:

| Steamworks field | File | Note |
|---|---|---|
| Shortcut icon | `shortcut-icon-512.png` | Valve generates the `.ico` from it |
| App icon | `app-icon-184.jpg` | JPG, opaque — shown small (library list, chat, Deck) |
| Mac icon | *(none yet)* | `.icns`; missing → default Steam logo on macOS shortcuts |

**Steps that only exist in the browser:**

1. Upload, then **publish the store page** — library assets do not display in
   the client until the page is published.
2. **Mark at least four screenshots "suitable for all ages"**, or the game can
   be dropped from front-page hover art it otherwise qualifies for.
3. Pick the library logo's anchor (left-bottom / centred top / middle / bottom)
   in Valve's preview tool — the PNG does not carry it.

---

## The four calls that are Constantine's — one edit each

All four live in **`store/templates/taste.js`**. Change one token, run
`node tools/store-assets.mjs`, and the whole set re-renders. Nothing below is
half-built: every alternative is authored and renders today.

| # | Sunna's flag | Token | Answers |
|---|---|---|---|
| 1 | The plume reads as a pale cloud-mass, never smoke-from-spire | `plume` | `'cloud'` *(shipping)* · `'smoke'` — an authored column anchored to the spire's apex · `'off'` — pure vector |
| 2 | The descriptor smudges below ~200px capsule width | `subtitle` | `'wide-only'` *(shipping)* · `'always'` · `'never'` — **read the rule note first** |
| 3 | Header capsule and library header are byte-identical | `libraryHeader` | `'same-as-store'` *(shipping — and Valve's own default)* · `'distinct'` — the branding-forward cut, already drawn |
| 4 | The wordmark ships in the serif fallback | `displayFont` | `'game'` *(shipping — the face is now reported by name every run)* · `'cinzel-required'` — the tool exits 1 unless Cinzel actually rendered |

**Flag 2 is not only taste.** Steam limits base capsule content to "game
artwork, the game name, and any official subtitle" and forbids "other
miscellaneous text" (`/doc/store/assets/rules`, in force since 2022-09-01).
*"A ROGUELIKE DECKBUILDER"* is a genre descriptor. If Constantine declares it
part of the title it is an official subtitle and may stay; if he does not, the
compliant answer is `'never'` — **on every capsule, not just the small one.**
The flag ships at its current value because changing the shipped look is his
call, not mine.

**Flag 4 has a gate consequence.** Sunna's composition verdicts survive a face
change; her **wordmark** verdict does not. A Cinzel re-render needs re-gating of
the wordmark itself, on the box that has the font.

## The palette — a decision, and why

A capsule is a flat image on someone else's shelf: no player, no settings
screen, no second state to switch into. The one palette it can carry is the one
first boot shows, and `highContrast` defaults **true** — so the shelf and the
first screen agree. `taste.js → palette` can be moved to `'atmospheric'` as a
legal experiment; it is the deliberately dimmer sibling (map structure measures
**3.77** against **4.15**), never a fix for anything. What #45 actually taught
rides here as a *constraint*, not a palette: **distinction carried by colour
alone fails at shelf size**, so the store motif says everything with geometry —
rings on roads, the climb — and spends colour only on seating it.

## Open, and named

- **No `.icns`.** macOS shortcuts get Valve's default icon until one exists.
- **The wordmark's face is this box's face.** Reported every run; unenforced
  until flag 4 says otherwise.
- **The screenshots are the real app**, five, gameplay only, seeded `SHOWCASE`.
  Whether five is the right five is a taste call nobody has made yet.
- **Whether the art reads at Steam's display scale** is Sunna's floor and
  Constantine's ceiling. The tool asserts pixels; it has never seen a shelf.
