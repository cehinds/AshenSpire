# Legacy dungeons — narrative and route design

Proposed lore for review; not yet integrated into the game. Defeating the boss clears the dungeon. Exploration of unfinished locations remains possible afterward.

Each dungeon has 24 nodes and two entrance lanes, with side rooms and connecting roads. Coordinates and traced road bends are stored in dungeons.json. Node IDs remain stable during revisions.

## Escape rule (draft)

Chance = clamp(40 + 3 × (Dexterity − 10), 10, 85) percent. Roll 1–100; at or below chance succeeds. Dexterity 14 gives 52%. Success returns to the previous location without resolving the encounter; failure starts combat. Bosses allow withdrawal before commitment, but no escape roll once engaged.

## Dialogue behavior

Observations, shrines, and caches use the same dialogue panel as conversations. Read/listen reveals a second lore beat. Dialogue nodes resolve peacefully. Encounter nodes offer peaceful listening, an optional challenge, or escape. Fight nodes offer combat or escape. Prototype victories and defeats are explicitly simulated; no combat balance, loot, or healing values are implied.

## Briar Sanctum

Routes: Grave Road / Waterward Road. Boss: Thorn Matriarch. Fog: olive woodland mist with pollen tones.

### BS-01 — Gate of Unkept Names (entrance)

**You:** Every name on this gate has been scratched out from within.

**Further lore:** Beneath the cuts, one command survives: Remember us without waking us.

### BS-02 — Rootbound Fork (observation)

**You:** The paving divides around a root older than the wall. Both tracks carry fresh mud.

**Further lore:** The western road serves the graves. The eastern road follows the water toward the sanctum.

### BS-03 — Pilgrims' Hollow (encounter)

**Briar Hermit:** Do not pull the thorns from your cloak. They are how she counts who leaves.

**Further lore:** The hermit remembers a gardener who asked the roots to hold the dying until spring.

### BS-04 — Broken Processional (observation)

**You:** The stones are worn at the knees, not the feet.

**Further lore:** The faithful crawled this road carrying water in their hands.

### BS-05 — Moss Stair (fight)

**You:** Something beneath the moss breathes against the stair. A blight hound lifts its head.

**Further lore:** Its collar bears the same flower carved on the sanctuary door.

### BS-06 — Chapel of Small Mercies (shrine)

**You:** A gold cup stands beneath a roof that fell generations ago. It is still full.

**Further lore:** Rain gathers here even beneath clear skies. Someone kept one small promise.

### BS-07 — Widow's Recess (observation)

**You:** A child's wooden shoe rests beside an adult's stone effigy.

**Further lore:** The inscription leaves space for a second name that was never added.

### BS-08 — The Last Grave Tender (dialogue)

**Grave Tender:** I leave one grave open. If I fill it, I have to admit whom it was for.

**Further lore:** The tender says the Matriarch buried her own name before giving the roots her voice.

### BS-09 — Seed Reliquary (cache)

**You:** The reliquary holds seeds wrapped in burial cloth, each labeled with a season.

**Further lore:** None is marked spring. The sanctum has been waiting longer than its gardeners lived.

### BS-10 — Abandoned Watch Chapel (observation)

**You:** A narrow window faces away from the forest and toward the great tree.

**Further lore:** The watchers feared what their sanctuary might become, not what might enter it.

### BS-11 — Bridge of Bound Vows (encounter)

**Oathbound Watcher:** State whom you have come to mourn. A blade is not an answer.

**Further lore:** Those who cannot name their dead are made to carry the watcher's grief instead.

### BS-12 — Waterward Fork (observation)

**You:** A second road leaves the gate beside a channel cut into the rock.

**Further lore:** The channel once carried offerings downstream. Now the roots drink before the river can.

### BS-13 — Thorn Scribe (dialogue)

**Thorn Scribe:** I write the names she forgets. The bark heals faster each year.

**Further lore:** The scribe shows you a fresh name: their own. They do not remember writing it.

### BS-14 — Lower Stone Bridge (fight)

**You:** A blight hound waits where the bridge narrows, its muzzle tangled in prayer cords.

**Further lore:** The cords were tied to keep a beloved animal from straying. They held too well.

### BS-15 — Candleless Landing (observation)

**You:** Wax fills every crack in the landing, but no wick remains.

**Further lore:** The mourners stopped lighting candles when the roots began reaching toward the flame.

### BS-16 — East Chapel Steps (shrine)

**You:** A kneeling statue holds a bowl toward the waterfall.

**Further lore:** The bowl is dry. Its underside is engraved: Give without being seen.

### BS-17 — Keeper of the Empty Bowl (dialogue)

**Chapel Keeper:** She took our hunger first. We thanked her. Then she took what we hungered for.

**Further lore:** The keeper asks you to remember the taste of bread aloud. For a moment, they smile.

### BS-18 — Waterfall Oratory (cache)

**You:** A leather satchel hangs above the spray, protected by a curtain of thorns.

**Further lore:** Inside lies a farewell never delivered: I will wait at the lower bridge until dawn.

### BS-19 — The Listening Hedge (encounter)

**Rootbound Pilgrim:** Speak softly. The leaves repeat whatever they hear to Mother.

**Further lore:** The pilgrim will let a quiet traveler pass, but a drawn weapon makes every branch turn.

### BS-20 — Pilgrim's Turn (observation)

**You:** Footprints circle a single root before joining the upper path.

**Further lore:** Every pilgrim paused here. The root is polished like a handrail.

### BS-21 — Rear Watch Ruin (observation)

**You:** A fallen bell lies stuffed with moss, its clapper deliberately removed.

**Further lore:** The watch chose silence on the night the tree first answered a prayer.

### BS-22 — The Unnamed Gardener (dialogue)

**Unnamed Gardener:** She is not guarding the dead from you. She is guarding them from the morning.

**Further lore:** The gardener remembers the Matriarch's first wish: let no one under my care be lost.

### BS-23 — Sanctum Stair (gate)

**You:** Every root points inward. The stair rises into a silence that feels held shut.

**Further lore:** Beyond these steps, the Thorn Matriarch keeps the promise that ruined this place.

### BS-24 — Heart of Briar Sanctum (boss)

**Thorn Matriarch:** I kept them. Every one. Would you have me call that a sin?

**Further lore:** Defeat loosens the roots without erasing the graves. The dungeon is cleared; its memories remain.

## Hall of Mirrors

Routes: Winter Garden / Tarn Causeway. Boss: Glass Regent. Fog: cold indigo mist with pale frost tones.

### HM-01 — Gate of Second Faces (entrance)

**You:** Your reflection reaches the gate a moment before you do.

**Further lore:** Two roads circle the tarn: the garden path to the west and the high causeway to the east.

### HM-02 — Winter Garden Fork (observation)

**You:** The snow is broken by footsteps that never seem to leave.

**Further lore:** Most turn toward the glasshouse. One set walks backward toward the palace.

### HM-03 — The Unreflected Porter (encounter)

**Palace Porter:** Leave your reflection with me. Guests must not bring strangers into court.

**Further lore:** The porter carries receipts for shadows, smiles, and the right to be remembered.

### HM-04 — Fountain of Still Water (shrine)

**You:** The fountain is frozen around a falling drop.

**Further lore:** The plaque promises a moment without sorrow. It never says the moment will end.

### HM-05 — Gardener of Glass (dialogue)

**Winter Gardener:** The Regent wanted flowers that could not die. Glass was only the first attempt.

**Further lore:** The gardener kept one seed beneath their tongue through every winter of the court.

### HM-06 — Shattered Conservatory (cache)

**You:** The collapsed glasshouse shelters a box of ordinary earth.

**Further lore:** Its label reads: For when Her Grace tires of perfection.

### HM-07 — Glasshouse Crossing (observation)

**You:** Glass ribs make a cage around an empty planting bed.

**Further lore:** There are no roots. These flowers were installed, not grown.

### HM-08 — Statue Walk (fight)

**You:** A porcelain sentry turns its face to match yours.

**Further lore:** Its weapon is real, though its hands are only reflected in the snow.

### HM-09 — The White Landing (observation)

**You:** The same farewell is carved into every step in a different hand.

**Further lore:** Each courtier thought they were the first to ask permission to leave.

### HM-10 — Bridge of Courtesy (encounter)

**Mirror Usher:** Bow to the image, never the guest. Images do not change their loyalties.

**Further lore:** The usher admits the Regent has not crossed this bridge since the first mirror cracked.

### HM-11 — The Thawing Witness (dialogue)

**Court Witness:** I saw the original die. Every morning since, another reflection has denied it.

**Further lore:** The witness cannot tell you which death they mean. Their testimony changes with the light.

### HM-12 — Causeway Fork (observation)

**You:** The other road crosses dark water on broad stone arches.

**Further lore:** The balustrade is warmer than the air, as if another season waits inside the stone.

### HM-13 — The Tarn Span (fight)

**You:** A glass-armored sentinel drags its spear along the bridge rail.

**Further lore:** Each scratch in the rail matches a scar visible beneath its transparent armor.

### HM-14 — Listening Balustrade (observation)

**You:** Voices rise through the arches, repeating a conversation you have not had.

**Further lore:** One voice sounds like yours. It says that you should have taken the garden road.

### HM-15 — The Ferry Without Oars (dialogue)

**Stranded Ferryman:** Before the ice, I carried people across. Now I ferry apologies. Neither ever returns.

**Further lore:** The ferryman points to a palace window where a lantern answers only at noon.

### HM-16 — Icebound Tollhouse (cache)

**You:** A brass box contains toll coins polished perfectly blank.

**Further lore:** The Regent would permit no other sovereign's face within sight of the palace.

### HM-17 — Rime Watch (encounter)

**Rime Warden:** Show me the face you wore when you entered. No substitutions.

**Further lore:** The warden remembers every visitor and no departure. A respectful answer can delay its suspicion.

### HM-18 — Eastern Stair (observation)

**You:** Frost has formed on the underside of the steps, against the wind.

**Further lore:** The cold comes from the hall, not from the mountains.

### HM-19 — The Unsilvered Niche (shrine)

**You:** One mirror has had its silver scraped away, leaving a view of bare stone.

**Further lore:** Someone chose the wall over the face the court demanded.

### HM-20 — The Seamstress of Faces (dialogue)

**Court Seamstress:** A face is easier to mend when its owner stops moving.

**Further lore:** She remembers sewing mourning veils until the Regent outlawed the suggestion of loss.

### HM-21 — Court of Repeated Steps (fight)

**You:** Two sentries move as one. Only one leaves tracks.

**Further lore:** The tracks stop before each mirror and begin again on the other side.

### HM-22 — Blackwater Basin (observation)

**You:** The basin reflects an intact palace under a summer sky.

**Further lore:** A figure at its window closes the curtain when you lean closer.

### HM-23 — Threshold of True Silver (gate)

**You:** Your reflection remains at the threshold after you step away.

**Further lore:** It mouths a warning: do not let her choose which of you leaves.

### HM-24 — Hall of Mirrors (boss)

**Glass Regent:** I have perfected this court. It is the world outside that refuses correction.

**Further lore:** Victory cracks the false summer in every mirror. The dungeon clears as the tarn begins to thaw.

## Furnace Chapel

Routes: Lower Works / Pilgrim Stair. Boss: Furnace Saint. Fog: charcoal volcanic haze with ember tones.

### FC-01 — Gate of Banked Coals (entrance)

**You:** The gate is warm enough to hurt through a glove. No fire burns nearby.

**Further lore:** A pilgrim stair climbs directly toward the chapel; a works road loops through the lower kilns.

### FC-02 — The Ashen Divide (observation)

**You:** Two sets of footprints separate: bare feet uphill, iron boots toward the works.

**Further lore:** Pilgrims and furnace workers shared a gate, but not a destination.

### FC-03 — The Coal Tally (encounter)

**Chain Scavenger:** Nothing enters empty-handed. What will you give the flame?

**Further lore:** The tally board counts workers by weight, beside the coal and the ore.

### FC-04 — Kiln Approach (observation)

**You:** Ash has settled into the shape of tools that were taken away long ago.

**Further lore:** Every tool faced the chapel when the workers laid it down.

### FC-05 — The Last Stoker (dialogue)

**Old Stoker:** We thought the heat was a blessing. Then the saint stopped asking for fuel.

**Further lore:** The old stoker remembers the first night the furnace burned on a prayer alone.

### FC-06 — Cold Coal Shed (cache)

**You:** A sealed lunch tin sits between heaps of coal that never caught.

**Further lore:** Inside, a note asks its reader to be home before the evening bell.

### FC-07 — Quenching Yard (fight)

**You:** A cinder mantis unfolds from a slag heap, its legs ringing against the stone.

**Further lore:** It has nested in a quenching trough dry since the water was diverted to the chapel.

### FC-08 — Worker's Niche (shrine)

**You:** A small iron hand protects a candle from the furnace wind.

**Further lore:** Its inscription offers no miracle, only a safe return after work.

### FC-09 — The Soot Confessor (dialogue)

**Soot Confessor:** They confessed exhaustion. I called it doubt. I would like that written down.

**Further lore:** The confessor has kept every worker's name on strips of unburned cloth.

### FC-10 — The Red Stair (observation)

**You:** The stair is swept clean while the surrounding terraces lie deep in ash.

**Further lore:** Someone still prepares this approach for a congregation that cannot come.

### FC-11 — Brazier of Petition (observation)

**You:** The great brazier is cold. Its rim has melted inward.

**Further lore:** The offerings stopped here when the furnace learned to call the petitioners by name.

### FC-12 — Pilgrims' Stair (observation)

**You:** The direct stair climbs above a fissure glowing beneath the paving.

**Further lore:** The handrail bears thousands of fingerprints baked into old soot.

### FC-13 — Procession Landing (fight)

**You:** An ember-starved pilgrim blocks the stair, guarding a coal in cupped hands.

**Further lore:** The coal is cold. The pilgrim has not noticed.

### FC-14 — Bearer of the Last Coal (dialogue)

**Coal Bearer:** If it goes out, she said we all go out. Help me remember who she meant.

**Further lore:** The bearer remembers children warming their hands at the chapel before the doors were chained.

### FC-15 — Reliquary Steps (observation)

**You:** Empty reliquary sockets line the stair like missing teeth.

**Further lore:** Each held a saint's bone until the furnace demanded a warmer offering.

### FC-16 — Iron Viaduct (encounter)

**Bridge Warden:** The upper works are closed. The order is old; my oath is older.

**Further lore:** The warden will hear a worker's grievance. A threat turns its chain across the bridge.

### FC-17 — Eastern Abutment (observation)

**You:** The iron supports sing at a pitch too low to hear clearly.

**Further lore:** The bridge was tuned to the chapel's hymn so the workers could pray without stopping.

### FC-18 — The Weigh House (cache)

**You:** A balance hangs level with a prayer tablet on one pan and a tooth on the other.

**Further lore:** Its ledger assigns the same value to both: one more hour of heat.

### FC-19 — Foreman Without a Shift (dialogue)

**Ash Foreman:** No one dismissed us. Until someone does, the shift is not over.

**Further lore:** The foreman asks for the workers' names to be spoken outside the reach of the furnace.

### FC-20 — High Works Crossing (fight)

**You:** A cinder mantis has woven hot wire across the old service path.

**Further lore:** The wire was once part of the alarm system. No one answered its last ringing.

### FC-21 — The Joining Road (observation)

**You:** The works road and pilgrim stair meet before the chapel terrace.

**Further lore:** Here the ash erases the difference between bare feet and iron boots.

### FC-22 — Chapel Forecourt (shrine)

**You:** Gold trim blackens above a row of names struck from the list of saints.

**Further lore:** The scratched names belong to those who told the congregation to leave.

### FC-23 — Furnace Threshold (gate)

**You:** Heat presses against you like a held breath. The chains are fastened from within.

**Further lore:** The Furnace Saint has mistaken endurance for devotion. The door opens when you stop kneeling.

### FC-24 — Furnace Chapel (boss)

**Furnace Saint:** You call it suffering because you have not yet learned to burn clean.

**Further lore:** Victory banks the sacred furnace. Volcanic haze settles, the workers' shift ends, and the dungeon clears.
