// Which combat atlas scenes pair a background (far) layer and a floor (ground)
// layer from different themes. The atlas art is generated from reviewed masters
// (tools/alternative-art-build.py), so a pair cannot be re-cut here; instead the
// scene picker leaves a mismatched scene out whenever a matched one is available
// for the same terrain profile (src/model/locationPresentation.js).
//
// `background` / `floor` name the art set each layer belongs to. No dedicated
// floor art exists for the undercroft, starwatch, hollow night, grave ships or
// glass lake sets; the closest existing floor is the region's own ground.
export const MISMATCHED_ATLAS_SCENES = {
  'ashen-crown-4':  { background: 'undercroft', floor: 'ashen-crown', note: 'castle undercroft sky over the Ashen Crown ground' },
  'hollow-weald-2': { background: 'hollow-night', floor: 'hollow-weald', note: 'night sky over the Weald ground' },
  'hollow-weald-4': { background: 'hollow-night', floor: 'hollow-weald', note: 'night sky over the Weald ground' },
  'pale-marches-4': { background: 'pale-marches', floor: 'glass-lake', note: 'glass-lake ground under the Marches sky' },
  'drowned-coast-3': { background: 'starwatch', floor: 'drowned-coast', note: 'starwatch city sky over the coast ground' },
  'drowned-coast-4': { background: 'drowned-coast', floor: 'grave-ships', note: 'grave-ships ground under the coast sky' },
};
