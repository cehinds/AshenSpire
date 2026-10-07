import {PAINTED_OUTFITS} from '../content/paintedOutfits.js';
import {READINESS_POSE_ART} from '../content/readinessPoseArt.js';
export const PRESENTATION_POSES=Object.fromEntries(Object.entries(PAINTED_OUTFITS).map(([id,art])=>[id,{...art,frames:{...art.frames,...READINESS_POSE_ART[id]}}]));
