// Original engraved parchment pattern. No hidden routes or location data.
export function mapFogDefs(id) {
  let state = 741;
  const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  const grain = Array.from({length:360}, () => `<circle cx="${(random()*256).toFixed(1)}" cy="${(random()*256).toFixed(1)}" r="${(.2+random()*.65).toFixed(2)}" fill="${random()>.5?'#302d22':'#d6c7a1'}" opacity=".23"/>`).join('');
  return `<pattern id="${id}-paper" class="map-paper-pattern" patternUnits="userSpaceOnUse" width="256" height="256">
    <rect width="256" height="256" fill="#8b7d61"/>
    <path d="M0 42Q50 6 121 40T256 27V100Q193 142 114 91T0 120Z M0 214Q62 156 140 201T256 177V256H0Z" fill="#71664f" opacity=".16"/>
    <g fill="none" stroke="#524c3a" stroke-width=".65" opacity=".11"><path d="M-12 95Q30 40 95 65T212 71T272 33 M-12 104Q30 50 95 75T212 81T272 43 M-12 113Q30 59 95 84T212 90T272 52 M28 272Q3 228 44 198T130 190T213 145T274 166 M36 272Q12 233 51 207T137 199T220 154T274 175 M44 272Q21 238 58 216T144 208T227 163T274 184"/></g>
    ${grain}</pattern>`;
}
