# Existing lore associated with pack 03

The interactive [card gallery](cards.html) has been expanded to every catalog relic, including all twelve painted relics from packs 01–03. It presents exact live catalog flavor, notes gaps in authored lore, and adds sourced context for the earlier eight paintings as well as the four discussed below.

These notes preserve current canon. They do not invent a named owner, new item origin or boss drop.

## Ivory Comb

> Someone kept themselves tidy right up until the end.

The item establishes an unnamed person's care for themselves. No existing text found gives the comb an owner, faction or region. The gold repair is an artistic interpretation.

Source: [relic catalog](../../src/content/relics.js).

## Blessed Dew

> It gathers on the vial overnight, from nowhere, for no one.

The mysterious dew and vial are established. [World lore](../../docs/LORE.md) associates the Field Flame with healing and seasons; that is a thematic connection, not a confirmed explanation for this particular dew. Its source should remain unexplained.

Source: [relic catalog](../../src/content/relics.js).

## Gravetender's Bell

> One toll for each name laid down. The tending is in the counting.

Paying respects at the Grave unlocks the Keeper's thanks. The event explicitly awards a small cold iron bell. The Keeper asks for one toll per name. [The world lore](../../docs/LORE.md) identifies them as a Forsaken who fell without being written into memory. The bell is associated with this quest, not the Bell Keeper boss or his Bellfoundry bell.

Sources: [quest and choice conditions](../../src/content/events.js), [cast lore](../../docs/LORE-CAST.md), [relic catalog](../../src/content/relics.js).

## Wyrm Heart

> It still beats. It expects something of you.

[The cast lore](../../docs/LORE-CAST.md) connects the Ashheart Dragon to the Reach's deep heat and says it has no cinder in it. [The world lore](../../docs/LORE-WORLD.md) describes Wyrm Aspirants and the Sleep. These support the broader wyrm/heat association; they do not identify this relic as that dragon's heart. The painted fissure suggests heat, not a canonical implanted cinder.

Source: [relic catalog](../../src/content/relics.js).

## Card sizes

[cards.html](cards.html) uses the production collectible renderer with live relic effects and flavor, and reads widths from the game's card configuration: Compact 108 px (Glance variant), Glance 152 px, Focus 280 px, Inspect 320 px. These are the authored defaults, before player UI scaling or size overrides. Only Inspect includes the flavor row. The preview applies the new artwork locally without changing gameplay data.
