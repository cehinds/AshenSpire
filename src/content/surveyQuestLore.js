// Player-facing survey writing. Keep prose outside the atlas topology tables:
// their historical revision includes text, and changing it would reroute seeds
// and refuse existing journeys. IDs, objectives and rewards stay in the atlas.
export const surveyQuestLore = Object.freeze({
  'survey:crownfall': Object.freeze({
    title: 'The Empty Channel',
    description: 'Crownfall has more buckets than water. Survey the Old Aqueduct and return to the Road Warden; the cracked channel may still shelter a path.',
    report: 'The channel carries no water. Bootprints follow its bed. The Road Warden marks a path beside the empty buckets.',
  }),
  'survey:bellhaven': Object.freeze({
    title: 'A Road for the Uncounted',
    description: 'Bellhaven shelters families once turned away at dusk. Survey the Old Aqueduct for a road they can walk, then return to the Road Warden.',
    report: 'A broken toll gate lies across the channel. Footprints pass around it. The Road Warden crosses a fee out of the route-book.',
  }),
  'survey:lantern-haven': Object.freeze({
    title: 'A Spring That Will Not Turn',
    description: 'Lantern Haven needs a road through the growth. Survey the Drowned Hamlet and return to the Road Warden. The branches have flowered again; there is still no fruit.',
    report: 'Blossoms float through the drowned doorways. Beneath them lie last year\'s blossoms. The Road Warden leaves the harvest column blank.',
  }),
  'survey:frostgate': Object.freeze({
    title: 'Ice Without a Thaw',
    description: 'Frostgate\'s fishers need a path across the old winter road. Survey the Frozen Camp and return to the Road Warden. The thaw stakes have not moved in a generation.',
    report: 'Ice has swallowed the lashings on the camp\'s thaw stakes. The Road Warden draws the winter road again and puts away the spring map.',
  }),
  'survey:emberhold': Object.freeze({
    title: 'The Mountain Stirs',
    description: 'Emberhold\'s carriers found fresh cracks under their boots. Survey the Caldera Rim and return to the Road Warden before another cart takes that road.',
    report: 'A wheel-rut ends at a fresh split in the stone. Warm grit shakes from the rim. The Road Warden moves a route marker away from the edge.',
  }),
  'survey:saltwatch': Object.freeze({
    title: 'The High-Water Marks',
    description: 'Saltwatch\'s ship-breakers count safe roads by the tide. Survey the Drowned Orchard and return to the Road Warden. The old water marks are below your feet.',
    report: 'Salt has crusted the upper branches. A mooring ring hangs above a drowned doorway. The Road Warden turns the low-road marker face down.',
  }),
});
