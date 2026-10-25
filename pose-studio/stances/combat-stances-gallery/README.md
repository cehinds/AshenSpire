# Combat stance and animation gallery

[Open the responsive gallery](index.html) · [Capture manifest](capture-manifest.json)

**Current runtime policy:** card animations now use each character's default weapon
art regardless of equipped hands. This gallery remains a frozen capture of the
build below; alternate weapon-family clips are preserved here as archived
references and are no longer selected or preloaded during combat.

Build **0.7.1.1516**, digest **e8ab294493**, runtime source **2ca669b1c**. Captured at1440×1000, device scale1, using Playwright because the Browser plugin was unavailable.

All four classes,29 held views and77 registered clip groups are included. Full combat screenshots are explicitly staged poses. Neutral previews capture native in-engine layers through the mounted stage`s real seek/play/reactPose APIs; they are reference clips, not paid card outcomes. Phase review timing is separate from live Normal sampling. Five-slot Smash clips and Reaver Sweep retain five total slots. Guarded reaction D→V→G→H→C→D retains weights2,3,1,2,3,2.

The canonical fixture kit and depicted legacy equipment are labeled separately. Rogue`s legacy non-Smash held art shows paired daggers without the buckler; Herald`s legacy art is largely unarmed/book without the bone sceptre; some Starseer Magic art includes a book. Existing Counter/Sweep art varies in raster detail and style. These differences are captured as they exist. New class Smash depicts the current starter kits. Weapon-family references list compatible grip requirements, aliases and shared phase art.

Curated media uses high-quality animated WebP, JPEG full combat screens, WebP actor crops/contact sheets, and four inline GIF Smash overviews. Original native PNGs, full live traces and bulk manifest remain in scratch and are excluded from this directory. Per-clip metadata records phase order, weights and cadence. Defeated is a static still, with no authored animation sequence; it is listed as such and excluded from the animation clip count.

Reproduce with `tools/combat-stances-gallery.mjs`: provide QA_BUILD_URL, QA_EXPECT_ORDINAL, QA_EXPECT_DIGEST and QA_RUNTIME_SOURCE, capture to QA_OUTPUT outside the repository, then use --render-existing and --curate-existing with QA_CURATED_OUTPUT. Node/Playwright, repository Chromium launcher, Python/Pillow and ffmpeg are used. --inventory performs no browser work.

## Reaver

![Native in-engine held layers](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/held-contact-sheet.webp)

![Smash phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/smash/review.gif)

<details>
<summary>Reaver — in-game stance screenshots</summary>

These full combat UI screenshots are staged pose reviews, not paid card outcomes.

### Ready

![Reaver Ready — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/ready-combat.jpg)

### Offensive

![Reaver Offensive — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/offensive-combat.jpg)

### Defensive

![Reaver Defensive — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/defensive-combat.jpg)

### Casting

![Reaver Casting — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/casting-combat.jpg)

### Counter

Existing source art: lower raster detail / style variation

![Reaver Counter — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/counter-combat.jpg)

### Sweep

Existing source art: lower raster detail / style variation

![Reaver Sweep — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/sweep-combat.jpg)

### Smash

Current starter kit depicted

![Reaver Smash — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/smash-combat.jpg)

### Evade

![Reaver Evade — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/evade-combat.jpg)

</details>


## Rogue

![Native in-engine held layers](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/held-contact-sheet.webp)

![Smash phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/smash/review.gif)

<details>
<summary>Rogue — in-game stance screenshots</summary>

These full combat UI screenshots are staged pose reviews, not paid card outcomes.

### Ready

Legacy weapon depiction: paired daggers; buckler absent

![Rogue Ready — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/ready-combat.jpg)

### Offensive

Legacy weapon depiction: paired daggers; buckler absent

![Rogue Offensive — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/offensive-combat.jpg)

### Defensive

Legacy weapon depiction: paired daggers; buckler absent

![Rogue Defensive — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/defensive-combat.jpg)

### Casting

Legacy weapon depiction: paired daggers; buckler absent

![Rogue Casting — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/casting-combat.jpg)

### Counter

Legacy weapon depiction: paired daggers; buckler absent

![Rogue Counter — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/counter-combat.jpg)

### Sweep

Legacy weapon depiction: paired daggers; buckler absent

![Rogue Sweep — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/sweep-combat.jpg)

### Smash

Current starter kit depicted

![Rogue Smash — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/smash-combat.jpg)

</details>


## Starseer

![Native in-engine held layers](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/held-contact-sheet.webp)

![Smash phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/smash/review.gif)

<details>
<summary>Starseer — in-game stance screenshots</summary>

These full combat UI screenshots are staged pose reviews, not paid card outcomes.

### Ready

![Starseer Ready — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/ready-combat.jpg)

### Offensive

![Starseer Offensive — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/offensive-combat.jpg)

### Defensive

![Starseer Defensive — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/defensive-combat.jpg)

### Casting

Legacy weapon depiction: staff and book

![Starseer Casting — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/casting-combat.jpg)

### Counter

Existing source art: lower raster detail / style variation

![Starseer Counter — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/counter-combat.jpg)

### Sweep

Existing source art: lower raster detail / style variation

![Starseer Sweep — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/sweep-combat.jpg)

### Smash

Current starter kit depicted

![Starseer Smash — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/smash-combat.jpg)

</details>


## Herald

![Native in-engine held layers](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/held-contact-sheet.webp)

![Smash phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/smash/review.gif)

<details>
<summary>Herald — in-game stance screenshots</summary>

These full combat UI screenshots are staged pose reviews, not paid card outcomes.

### Ready

Legacy weapon depiction: unarmed/book; bone sceptre absent

![Herald Ready — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/ready-combat.jpg)

### Offensive

Legacy weapon depiction: unarmed/book; bone sceptre absent

![Herald Offensive — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/offensive-combat.jpg)

### Defensive

Legacy weapon depiction: unarmed/book; bone sceptre absent

![Herald Defensive — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/defensive-combat.jpg)

### Casting

Legacy weapon depiction: unarmed/book; bone sceptre absent

![Herald Casting — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/casting-combat.jpg)

### Counter

Legacy weapon depiction: unarmed/book; bone sceptre absent

![Herald Counter — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/counter-combat.jpg)

### Sweep

Legacy weapon depiction: unarmed/book; bone sceptre absent

![Herald Sweep — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/sweep-combat.jpg)

### Smash

Current starter kit depicted

![Herald Smash — staged in-game combat screenshot](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/smash-combat.jpg)

</details>


## All registered sequence previews

Phase previews below use slower inspection exposure. Normal links show separately captured real stage-clock playback. Shared phase art and aliases do not imply separate authored artwork.

<details>
<summary>Reaver — all 23 clip groups</summary>

Existing Counter/Sweep source art varies in raster detail and style.

### Attack

`attack` · Held start/return: offensive · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `attack`, `weapon:attack:greatsword`.

![Reaver Attack — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/attack/review.webp)

[Frame order, weights and cadence](reaver/clips/attack/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/attack/normal.webp)

### Smash

`smash` · Held start/return: smash · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `smash`.

![Reaver Smash — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/smash/review.webp)

[Frame order, weights and cadence](reaver/clips/smash/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/smash/normal.webp)

### Sweep

`sweep` · Held start/return: sweep · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `sweep`.

![Reaver Sweep — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/sweep/review.webp)

[Frame order, weights and cadence](reaver/clips/sweep/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/sweep/normal.webp)

### Counter

`counter` · Held start/return: counter · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `counter`.

![Reaver Counter — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/counter/review.webp)

[Frame order, weights and cadence](reaver/clips/counter/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/counter/normal.webp)

### Defend

`defend` · Held start/return: defensive · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `defend`.

![Reaver Defend — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/defend/review.webp)

[Frame order, weights and cadence](reaver/clips/defend/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/defend/normal.webp)

### Magic

`spell` · Held start/return: casting · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `spell`.

![Reaver Magic — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/spell/review.webp)

[Frame order, weights and cadence](reaver/clips/spell/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/spell/normal.webp)

### Ranged

`ranged` · Held start/return: offensive · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `ranged`.

![Reaver Ranged — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/ranged/review.webp)

[Frame order, weights and cadence](reaver/clips/ranged/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/ranged/normal.webp)

### Ranged Magic

`rangedMagic` · Held start/return: casting · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `rangedMagic`.

![Reaver Ranged Magic — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/rangedMagic/review.webp)

[Frame order, weights and cadence](reaver/clips/rangedMagic/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/rangedMagic/normal.webp)

### Counter Preparation

`counterPrepare` · Held start/return: counter · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `counterPrepare`.

![Reaver Counter Preparation — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/counterPrepare/review.webp)

[Frame order, weights and cadence](reaver/clips/counterPrepare/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/counterPrepare/normal.webp)

### Sword Shield Attack Reference

`weapon:attack:sword-shield` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: straightSword or katana + shield. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:sword-shield`, `weapon:spell:sword-shield`, `weapon:ranged:sword-shield`, `weapon:rangedMagic:sword-shield`.

![Reaver Sword Shield Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/weapon-attack-sword-shield/review.webp)

[Frame order, weights and cadence](reaver/clips/weapon-attack-sword-shield/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/weapon-attack-sword-shield/normal.webp)

### Bow Attack Reference

`weapon:attack:bow` · Held start/return: offensive · Normal cadence: 486.5 ms.

Compatible family grip: shortbow. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:bow`, `weapon:spell:bow`, `weapon:ranged:bow`, `weapon:rangedMagic:bow`.

![Reaver Bow Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/weapon-attack-bow/review.webp)

[Frame order, weights and cadence](reaver/clips/weapon-attack-bow/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/weapon-attack-bow/normal.webp)

### Staff Casting Attack Reference

`weapon:attack:staff-casting` · Held start/return: offensive · Normal cadence: 525.0 ms.

Compatible family grip: staff or sceptre. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:staff-casting`, `weapon:spell:staff-casting`, `weapon:ranged:staff-casting`, `weapon:rangedMagic:staff-casting`.

![Reaver Staff Casting Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/weapon-attack-staff-casting/review.webp)

[Frame order, weights and cadence](reaver/clips/weapon-attack-staff-casting/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/weapon-attack-staff-casting/normal.webp)

### Energy Blade Attack Reference

`weapon:attack:energy-blade` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: spell blade-tag choreography. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:energy-blade`, `weapon:spell:energy-blade`, `weapon:ranged:energy-blade`, `weapon:rangedMagic:energy-blade`.

![Reaver Energy Blade Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/weapon-attack-energy-blade/review.webp)

[Frame order, weights and cadence](reaver/clips/weapon-attack-energy-blade/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/weapon-attack-energy-blade/normal.webp)

### Dual Daggers Attack Reference

`weapon:attack:dual-daggers` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: dagger + parryDagger. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:dual-daggers`, `weapon:spell:dual-daggers`, `weapon:ranged:dual-daggers`, `weapon:rangedMagic:dual-daggers`.

![Reaver Dual Daggers Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/weapon-attack-dual-daggers/review.webp)

[Frame order, weights and cadence](reaver/clips/weapon-attack-dual-daggers/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/weapon-attack-dual-daggers/normal.webp)

### Single Dagger Attack Reference

`weapon:attack:single-dagger` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: dagger alone. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:single-dagger`, `weapon:spell:single-dagger`, `weapon:ranged:single-dagger`, `weapon:rangedMagic:single-dagger`.

![Reaver Single Dagger Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/weapon-attack-single-dagger/review.webp)

[Frame order, weights and cadence](reaver/clips/weapon-attack-single-dagger/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/weapon-attack-single-dagger/normal.webp)

### Single Sword Attack Reference

`weapon:attack:single-sword` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: straightSword or katana alone. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:single-sword`, `weapon:spell:single-sword`, `weapon:ranged:single-sword`, `weapon:rangedMagic:single-sword`.

![Reaver Single Sword Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/weapon-attack-single-sword/review.webp)

[Frame order, weights and cadence](reaver/clips/weapon-attack-single-sword/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/weapon-attack-single-sword/normal.webp)

### Guard Counter

`counter-guard` · Held start/return: counter · Normal cadence: 650.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `counter-guard`.

![Reaver Guard Counter — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/counter-guard/review.webp)

[Frame order, weights and cadence](reaver/clips/counter-guard/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/counter-guard/normal.webp)

### Evasion Counter

`counter-evade` · Held start/return: evade · Normal cadence: 292.5 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `counter-evade`.

![Reaver Evasion Counter — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/counter-evade/review.webp)

[Frame order, weights and cadence](reaver/clips/counter-evade/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/counter-evade/normal.webp)

### Evade Reaction

`reaction:evade` · Held start/return: evade · Normal cadence: 97.5 ms.

![Reaver Evade Reaction — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/reaction-evade/review.webp)

[Frame order, weights and cadence](reaver/clips/reaction-evade/metadata.json)

### Guard Break

`reaction:guard-break` · Held start/return: defensive · Normal cadence: 180.0 ms.

![Reaver Guard Break — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/reaction-guard-break/review.webp)

[Frame order, weights and cadence](reaver/clips/reaction-guard-break/metadata.json)

### Guarded Reaction D → V → G → H → C → D

`reaction:fully-defended` · Held start/return: defensive · Normal cadence: 422.5 ms.

![Reaver Guarded Reaction D → V → G → H → C → D — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/reaction-fully-defended/review.webp)

[Frame order, weights and cadence](reaver/clips/reaction-fully-defended/metadata.json)

### Defend Reaction

`reaction:defend` · Held start/return: defensive · Normal cadence: 180.0 ms.

![Reaver Defend Reaction — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/reaction-defend/review.webp)

[Frame order, weights and cadence](reaver/clips/reaction-defend/metadata.json)

### General Hurt / Recoil

`reaction:hurt` · Held start/return: offensive · Normal cadence: 280.0 ms.

Aliases: `hit`, `hurt`.

![Reaver General Hurt / Recoil — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/reaver/clips/reaction-hurt/review.webp)

[Frame order, weights and cadence](reaver/clips/reaction-hurt/metadata.json)

</details>

<details>
<summary>Rogue — all 18 clip groups</summary>

Legacy weapon depiction: non-Smash held views show paired daggers without a buckler. New Smash shows the current dagger + buckler kit. Existing Counter/Sweep art varies in raster detail and style.

### Attack

`attack` · Held start/return: offensive · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `attack`.

![Rogue Attack — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/attack/review.webp)

[Frame order, weights and cadence](rogue/clips/attack/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/attack/normal.webp)

### Smash

`smash` · Held start/return: smash · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `smash`.

![Rogue Smash — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/smash/review.webp)

[Frame order, weights and cadence](rogue/clips/smash/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/smash/normal.webp)

### Sweep

`sweep` · Held start/return: sweep · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `sweep`.

![Rogue Sweep — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/sweep/review.webp)

[Frame order, weights and cadence](rogue/clips/sweep/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/sweep/normal.webp)

### Counter

`counter` · Held start/return: counter · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `counter`.

![Rogue Counter — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/counter/review.webp)

[Frame order, weights and cadence](rogue/clips/counter/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/counter/normal.webp)

### Defend

`defend` · Held start/return: defensive · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `defend`.

![Rogue Defend — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/defend/review.webp)

[Frame order, weights and cadence](rogue/clips/defend/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/defend/normal.webp)

### Magic

`spell` · Held start/return: casting · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `spell`.

![Rogue Magic — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/spell/review.webp)

[Frame order, weights and cadence](rogue/clips/spell/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/spell/normal.webp)

### Ranged

`ranged` · Held start/return: offensive · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `ranged`.

![Rogue Ranged — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/ranged/review.webp)

[Frame order, weights and cadence](rogue/clips/ranged/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/ranged/normal.webp)

### Ranged Magic

`rangedMagic` · Held start/return: casting · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `rangedMagic`.

![Rogue Ranged Magic — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/rangedMagic/review.webp)

[Frame order, weights and cadence](rogue/clips/rangedMagic/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/rangedMagic/normal.webp)

### Counter Preparation

`counterPrepare` · Held start/return: counter · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `counterPrepare`.

![Rogue Counter Preparation — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/counterPrepare/review.webp)

[Frame order, weights and cadence](rogue/clips/counterPrepare/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/counterPrepare/normal.webp)

### Greatsword Attack Reference

`weapon:attack:greatsword` · Held start/return: offensive · Normal cadence: 465.0 ms.

Compatible family grip: greatsword alone. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:greatsword`, `weapon:spell:greatsword`, `weapon:ranged:greatsword`, `weapon:rangedMagic:greatsword`.

![Rogue Greatsword Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-greatsword/review.webp)

[Frame order, weights and cadence](rogue/clips/weapon-attack-greatsword/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-greatsword/normal.webp)

### Sword Shield Attack Reference

`weapon:attack:sword-shield` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: straightSword or katana + shield. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:sword-shield`, `weapon:spell:sword-shield`, `weapon:ranged:sword-shield`, `weapon:rangedMagic:sword-shield`.

![Rogue Sword Shield Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-sword-shield/review.webp)

[Frame order, weights and cadence](rogue/clips/weapon-attack-sword-shield/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-sword-shield/normal.webp)

### Bow Attack Reference

`weapon:attack:bow` · Held start/return: offensive · Normal cadence: 486.5 ms.

Compatible family grip: shortbow. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:bow`, `weapon:spell:bow`, `weapon:ranged:bow`, `weapon:rangedMagic:bow`.

![Rogue Bow Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-bow/review.webp)

[Frame order, weights and cadence](rogue/clips/weapon-attack-bow/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-bow/normal.webp)

### Staff Casting Attack Reference

`weapon:attack:staff-casting` · Held start/return: offensive · Normal cadence: 525.0 ms.

Compatible family grip: staff or sceptre. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:staff-casting`, `weapon:spell:staff-casting`, `weapon:ranged:staff-casting`, `weapon:rangedMagic:staff-casting`.

![Rogue Staff Casting Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-staff-casting/review.webp)

[Frame order, weights and cadence](rogue/clips/weapon-attack-staff-casting/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-staff-casting/normal.webp)

### Energy Blade Attack Reference

`weapon:attack:energy-blade` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: spell blade-tag choreography. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:energy-blade`, `weapon:spell:energy-blade`, `weapon:ranged:energy-blade`, `weapon:rangedMagic:energy-blade`.

![Rogue Energy Blade Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-energy-blade/review.webp)

[Frame order, weights and cadence](rogue/clips/weapon-attack-energy-blade/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-energy-blade/normal.webp)

### Dual Daggers Attack Reference

`weapon:attack:dual-daggers` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: dagger + parryDagger. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:dual-daggers`, `weapon:spell:dual-daggers`, `weapon:ranged:dual-daggers`, `weapon:rangedMagic:dual-daggers`.

![Rogue Dual Daggers Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-dual-daggers/review.webp)

[Frame order, weights and cadence](rogue/clips/weapon-attack-dual-daggers/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-dual-daggers/normal.webp)

### Single Dagger Attack Reference

`weapon:attack:single-dagger` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: dagger alone. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:single-dagger`, `weapon:spell:single-dagger`, `weapon:ranged:single-dagger`, `weapon:rangedMagic:single-dagger`.

![Rogue Single Dagger Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-single-dagger/review.webp)

[Frame order, weights and cadence](rogue/clips/weapon-attack-single-dagger/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-single-dagger/normal.webp)

### Single Sword Attack Reference

`weapon:attack:single-sword` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: straightSword or katana alone. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:single-sword`, `weapon:spell:single-sword`, `weapon:ranged:single-sword`, `weapon:rangedMagic:single-sword`.

![Rogue Single Sword Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-single-sword/review.webp)

[Frame order, weights and cadence](rogue/clips/weapon-attack-single-sword/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/weapon-attack-single-sword/normal.webp)

### General Hurt / Recoil

`reaction:hurt` · Held start/return: offensive · Normal cadence: 280.0 ms.

Aliases: `hit`, `hurt`.

![Rogue General Hurt / Recoil — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/rogue/clips/reaction-hurt/review.webp)

[Frame order, weights and cadence](rogue/clips/reaction-hurt/metadata.json)

</details>

<details>
<summary>Starseer — all 18 clip groups</summary>

Legacy weapon depiction: some Magic views include a book alongside the staff. Existing Counter/Sweep art varies in raster detail and style.

### Attack

`attack` · Held start/return: offensive · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `attack`.

![Starseer Attack — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/attack/review.webp)

[Frame order, weights and cadence](starseer/clips/attack/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/attack/normal.webp)

### Smash

`smash` · Held start/return: smash · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `smash`.

![Starseer Smash — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/smash/review.webp)

[Frame order, weights and cadence](starseer/clips/smash/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/smash/normal.webp)

### Sweep

`sweep` · Held start/return: sweep · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `sweep`.

![Starseer Sweep — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/sweep/review.webp)

[Frame order, weights and cadence](starseer/clips/sweep/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/sweep/normal.webp)

### Counter

`counter` · Held start/return: counter · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `counter`.

![Starseer Counter — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/counter/review.webp)

[Frame order, weights and cadence](starseer/clips/counter/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/counter/normal.webp)

### Defend

`defend` · Held start/return: defensive · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `defend`.

![Starseer Defend — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/defend/review.webp)

[Frame order, weights and cadence](starseer/clips/defend/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/defend/normal.webp)

### Magic

`spell` · Held start/return: casting · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `spell`.

![Starseer Magic — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/spell/review.webp)

[Frame order, weights and cadence](starseer/clips/spell/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/spell/normal.webp)

### Ranged

`ranged` · Held start/return: offensive · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `ranged`.

Shared phase art with: `rangedMagic`.

![Starseer Ranged — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/ranged/review.webp)

[Frame order, weights and cadence](starseer/clips/ranged/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/ranged/normal.webp)

### Ranged Magic

`rangedMagic` · Held start/return: casting · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `rangedMagic`.

Shared phase art with: `ranged`.

![Starseer Ranged Magic — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/rangedMagic/review.webp)

[Frame order, weights and cadence](starseer/clips/rangedMagic/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/rangedMagic/normal.webp)

### Counter Preparation

`counterPrepare` · Held start/return: counter · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `counterPrepare`.

![Starseer Counter Preparation — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/counterPrepare/review.webp)

[Frame order, weights and cadence](starseer/clips/counterPrepare/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/counterPrepare/normal.webp)

### Greatsword Attack Reference

`weapon:attack:greatsword` · Held start/return: offensive · Normal cadence: 465.0 ms.

Compatible family grip: greatsword alone. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:greatsword`, `weapon:spell:greatsword`, `weapon:ranged:greatsword`, `weapon:rangedMagic:greatsword`.

![Starseer Greatsword Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-greatsword/review.webp)

[Frame order, weights and cadence](starseer/clips/weapon-attack-greatsword/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-greatsword/normal.webp)

### Sword Shield Attack Reference

`weapon:attack:sword-shield` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: straightSword or katana + shield. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:sword-shield`, `weapon:spell:sword-shield`, `weapon:ranged:sword-shield`, `weapon:rangedMagic:sword-shield`.

![Starseer Sword Shield Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-sword-shield/review.webp)

[Frame order, weights and cadence](starseer/clips/weapon-attack-sword-shield/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-sword-shield/normal.webp)

### Bow Attack Reference

`weapon:attack:bow` · Held start/return: offensive · Normal cadence: 486.5 ms.

Compatible family grip: shortbow. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:bow`, `weapon:spell:bow`, `weapon:ranged:bow`, `weapon:rangedMagic:bow`.

![Starseer Bow Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-bow/review.webp)

[Frame order, weights and cadence](starseer/clips/weapon-attack-bow/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-bow/normal.webp)

### Staff Casting Attack Reference

`weapon:attack:staff-casting` · Held start/return: offensive · Normal cadence: 525.0 ms.

Compatible family grip: staff or sceptre. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:staff-casting`, `weapon:spell:staff-casting`, `weapon:ranged:staff-casting`, `weapon:rangedMagic:staff-casting`.

![Starseer Staff Casting Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-staff-casting/review.webp)

[Frame order, weights and cadence](starseer/clips/weapon-attack-staff-casting/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-staff-casting/normal.webp)

### Energy Blade Attack Reference

`weapon:attack:energy-blade` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: spell blade-tag choreography. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:energy-blade`, `weapon:spell:energy-blade`, `weapon:ranged:energy-blade`, `weapon:rangedMagic:energy-blade`.

![Starseer Energy Blade Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-energy-blade/review.webp)

[Frame order, weights and cadence](starseer/clips/weapon-attack-energy-blade/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-energy-blade/normal.webp)

### Dual Daggers Attack Reference

`weapon:attack:dual-daggers` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: dagger + parryDagger. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:dual-daggers`, `weapon:spell:dual-daggers`, `weapon:ranged:dual-daggers`, `weapon:rangedMagic:dual-daggers`.

![Starseer Dual Daggers Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-dual-daggers/review.webp)

[Frame order, weights and cadence](starseer/clips/weapon-attack-dual-daggers/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-dual-daggers/normal.webp)

### Single Dagger Attack Reference

`weapon:attack:single-dagger` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: dagger alone. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:single-dagger`, `weapon:spell:single-dagger`, `weapon:ranged:single-dagger`, `weapon:rangedMagic:single-dagger`.

![Starseer Single Dagger Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-single-dagger/review.webp)

[Frame order, weights and cadence](starseer/clips/weapon-attack-single-dagger/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-single-dagger/normal.webp)

### Single Sword Attack Reference

`weapon:attack:single-sword` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: straightSword or katana alone. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:single-sword`, `weapon:spell:single-sword`, `weapon:ranged:single-sword`, `weapon:rangedMagic:single-sword`.

![Starseer Single Sword Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-single-sword/review.webp)

[Frame order, weights and cadence](starseer/clips/weapon-attack-single-sword/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/weapon-attack-single-sword/normal.webp)

### General Hurt / Recoil

`reaction:hurt` · Held start/return: offensive · Normal cadence: 280.0 ms.

Aliases: `hit`, `hurt`.

![Starseer General Hurt / Recoil — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/starseer/clips/reaction-hurt/review.webp)

[Frame order, weights and cadence](starseer/clips/reaction-hurt/metadata.json)

</details>

<details>
<summary>Herald — all 18 clip groups</summary>

Legacy weapon depiction: non-Smash held views are largely unarmed or show a book, omitting the bone sceptre. New Smash shows the current bone sceptre kit. Existing Counter/Sweep art varies in raster detail and style.

### Attack

`attack` · Held start/return: offensive · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `attack`.

![Herald Attack — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/attack/review.webp)

[Frame order, weights and cadence](herald/clips/attack/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/attack/normal.webp)

### Smash

`smash` · Held start/return: smash · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `smash`.

![Herald Smash — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/smash/review.webp)

[Frame order, weights and cadence](herald/clips/smash/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/smash/normal.webp)

### Sweep

`sweep` · Held start/return: sweep · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `sweep`.

![Herald Sweep — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/sweep/review.webp)

[Frame order, weights and cadence](herald/clips/sweep/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/sweep/normal.webp)

### Counter

`counter` · Held start/return: counter · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `counter`.

![Herald Counter — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/counter/review.webp)

[Frame order, weights and cadence](herald/clips/counter/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/counter/normal.webp)

### Defend

`defend` · Held start/return: defensive · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `defend`.

![Herald Defend — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/defend/review.webp)

[Frame order, weights and cadence](herald/clips/defend/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/defend/normal.webp)

### Magic

`spell` · Held start/return: casting · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `spell`.

![Herald Magic — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/spell/review.webp)

[Frame order, weights and cadence](herald/clips/spell/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/spell/normal.webp)

### Ranged

`ranged` · Held start/return: offensive · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `ranged`.

Shared phase art with: `rangedMagic`.

![Herald Ranged — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/ranged/review.webp)

[Frame order, weights and cadence](herald/clips/ranged/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/ranged/normal.webp)

### Ranged Magic

`rangedMagic` · Held start/return: casting · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `rangedMagic`.

Shared phase art with: `ranged`.

![Herald Ranged Magic — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/rangedMagic/review.webp)

[Frame order, weights and cadence](herald/clips/rangedMagic/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/rangedMagic/normal.webp)

### Counter Preparation

`counterPrepare` · Held start/return: counter · Normal cadence: 195.0 ms.

Compatible family grip: canonical starter fixture. Registered canonical starter stage reference

Aliases: `counterPrepare`.

![Herald Counter Preparation — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/counterPrepare/review.webp)

[Frame order, weights and cadence](herald/clips/counterPrepare/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/counterPrepare/normal.webp)

### Greatsword Attack Reference

`weapon:attack:greatsword` · Held start/return: offensive · Normal cadence: 465.0 ms.

Compatible family grip: greatsword alone. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:greatsword`, `weapon:spell:greatsword`, `weapon:ranged:greatsword`, `weapon:rangedMagic:greatsword`.

![Herald Greatsword Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-greatsword/review.webp)

[Frame order, weights and cadence](herald/clips/weapon-attack-greatsword/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-greatsword/normal.webp)

### Sword Shield Attack Reference

`weapon:attack:sword-shield` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: straightSword or katana + shield. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:sword-shield`, `weapon:spell:sword-shield`, `weapon:ranged:sword-shield`, `weapon:rangedMagic:sword-shield`.

![Herald Sword Shield Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-sword-shield/review.webp)

[Frame order, weights and cadence](herald/clips/weapon-attack-sword-shield/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-sword-shield/normal.webp)

### Bow Attack Reference

`weapon:attack:bow` · Held start/return: offensive · Normal cadence: 486.5 ms.

Compatible family grip: shortbow. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:bow`, `weapon:spell:bow`, `weapon:ranged:bow`, `weapon:rangedMagic:bow`.

![Herald Bow Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-bow/review.webp)

[Frame order, weights and cadence](herald/clips/weapon-attack-bow/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-bow/normal.webp)

### Staff Casting Attack Reference

`weapon:attack:staff-casting` · Held start/return: offensive · Normal cadence: 525.0 ms.

Compatible family grip: staff or sceptre. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:staff-casting`, `weapon:spell:staff-casting`, `weapon:ranged:staff-casting`, `weapon:rangedMagic:staff-casting`.

![Herald Staff Casting Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-staff-casting/review.webp)

[Frame order, weights and cadence](herald/clips/weapon-attack-staff-casting/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-staff-casting/normal.webp)

### Energy Blade Attack Reference

`weapon:attack:energy-blade` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: spell blade-tag choreography. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:energy-blade`, `weapon:spell:energy-blade`, `weapon:ranged:energy-blade`, `weapon:rangedMagic:energy-blade`.

![Herald Energy Blade Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-energy-blade/review.webp)

[Frame order, weights and cadence](herald/clips/weapon-attack-energy-blade/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-energy-blade/normal.webp)

### Dual Daggers Attack Reference

`weapon:attack:dual-daggers` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: dagger + parryDagger. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:dual-daggers`, `weapon:spell:dual-daggers`, `weapon:ranged:dual-daggers`, `weapon:rangedMagic:dual-daggers`.

![Herald Dual Daggers Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-dual-daggers/review.webp)

[Frame order, weights and cadence](herald/clips/weapon-attack-dual-daggers/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-dual-daggers/normal.webp)

### Single Dagger Attack Reference

`weapon:attack:single-dagger` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: dagger alone. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:single-dagger`, `weapon:spell:single-dagger`, `weapon:ranged:single-dagger`, `weapon:rangedMagic:single-dagger`.

![Herald Single Dagger Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-single-dagger/review.webp)

[Frame order, weights and cadence](herald/clips/weapon-attack-single-dagger/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-single-dagger/normal.webp)

### Single Sword Attack Reference

`weapon:attack:single-sword` · Held start/return: offensive · Normal cadence: 405.0 ms.

Compatible family grip: straightSword or katana alone. Registered weapon-family reference; canonical fixture unchanged; not equipment-compatible paid play

Aliases: `weapon:attack:single-sword`, `weapon:spell:single-sword`, `weapon:ranged:single-sword`, `weapon:rangedMagic:single-sword`.

![Herald Single Sword Attack Reference — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-single-sword/review.webp)

[Frame order, weights and cadence](herald/clips/weapon-attack-single-sword/metadata.json) · [Live Normal stage sampling](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/weapon-attack-single-sword/normal.webp)

### General Hurt / Recoil

`reaction:hurt` · Held start/return: offensive · Normal cadence: 280.0 ms.

Aliases: `hit`, `hurt`.

![Herald General Hurt / Recoil — native in-engine phase review](https://raw.githubusercontent.com/cehinds/AI-Art/59663d814b62ab96cb5309b4e0720cd871782ee1/pose-studio/stances/combat-stances-gallery/herald/clips/reaction-hurt/review.webp)

[Frame order, weights and cadence](herald/clips/reaction-hurt/metadata.json)

</details>
