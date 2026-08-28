// src/model/resources.js — the engine half of the HUD resource bars.
//
// Constantine, 2026-08-08: "the stamina and mana bars should be under the
// health bar and the size of that bar should scale depending on the max total.
// much like elden ring's hud".
//
// THE SHAPE, and it is Law 0's: a resource bar is a ROW (src/content/resources.js)
// plus a READER (the closed set below). The renderer (ui/components/resbars.js)
// knows nothing about health, poise, stamina or mana — it draws whatever the
// rows say, in the order the rows say, at the length the max says. Adding a bar
// for a resource the model ALREADY exposes is one row and zero UI code; that is
// this feature's falsifier and tools/hudbars.mjs runs it.
//
// Stamina and Mana enter here only as readers of persisted derived pools. Their
// formulas remain in the versioned rules table; this module owns HUD projection,
// not gameplay authority. An unknown source is refused at boot rather than
// drawing a lying 0/0 trough.

/**
 * THE TRANSPOSE SCALE — one function, one edit.
 *
 * His word is "transpose scale" and it has not been ruled on. Every scale looks
 * identical at a single value and diverges everywhere else (Law 0 clause 5: the
 * plausible-but-wrong derivation is the invisible one), so this is drawn LINEAR
 * and flagged as linear rather than guessed at.
 *
 * If he answers "curved", EXACTLY ONE LINE CHANGES — the return below. The two
 * candidates, with what they do to the bars actually on screen today (track
 * 264 px at 390 wide, health domain 84):
 *
 *   linear   x            72 -> 226 px   78 -> 245 px   84 -> 264 px
 *   sqrt     Math.sqrt(x) 72 -> 244 px   78 -> 254 px   84 -> 264 px
 *   log      Math.log1p(x) 72 -> 258 px  78 -> 261 px   84 -> 264 px
 *
 * A curve COMPRESSES the low end upward: it makes a weak character's bar look
 * nearly as long as a strong one's, which is the opposite of what "the size
 * scales depending on the max" is for on a 14 %-spread domain. Over a WIDE
 * domain (enemy poise, 4..36) a curve is the better read: linear puts a 4-poise
 * mob at 11 % and a curve puts it at 33 %, above the floor instead of on it.
 * Both numbers are measured, not asserted — tools/hudbars.mjs --scales prints
 * this table from this function.
 */

export function resourceScale(v) {
  return v; // LINEAR. Swap for Math.sqrt(v) or Math.log1p(v) — nothing else moves.
}

/**
 * THE CLOSED SET OF SOURCES — the whole vocabulary a row may name.
 *
 * `read(view, entity)` returns { cur, max } or NULL. Null is the refusal and it
 * is load-bearing: an entity with no poiseMeter — a zero-threshold player
 * (createPlayerCombatEntity stamps NO meter at threshold 0), a legacy headless
 * fixture — reads null and the bar is ABSENT, not empty. The player carries a
 * REAL-BUT-EMPTY meter since 2026-08-14: max is the equipment stagger-threshold
 * receipt (stamped by engine/combat.js from statProjection's
 * playerPoiseThresholdReceipt — D10.4's skinny bar, D17 q5's "should also
 * effect player too"), value is 0 with NO writer until the player-poise
 * mechanics are dealt. tools/hudbars.mjs A11 asserts both halves: the vessel
 * present and empty at a real threshold, and ABSENT — not an empty trough —
 * at threshold 0.
 *
 * `domain(pop)` derives the largest max this resource reaches, over the
 * population the surface can display — DERIVED from content, never typed, so it
 * cannot drift when content is added (Law 0 clause 1). A row may override with
 * an explicit `domainMax` (Law 0 clause 3: an override is data).
 *
 * ADDING A SOURCE IS AN ENGINE CHANGE — one entry here, in one act with its
 * schema and validator (Law 0 clause 2). We say that plainly rather than
 * promising stamina is "just a row": it is one reader plus one row, and the
 * half that is genuinely free is the UI.
 */
export const RESOURCE_SOURCES = Object.freeze({
  hp: Object.freeze({
    read: (view, entity) => {
      const max = entity && entity.maxHp;
      if (!Number.isFinite(max) || max <= 0) return null;
      const cur = view && Number.isFinite(view.hp) ? view.hp : entity.hp;
      return { cur: Math.max(0, cur), max };
    },
    domain: (pop) => maxOf(pop.map((e) => e.maxHp)),
  }),
  mana: Object.freeze({
    read: (view, entity) => {
      const max = entity && entity.maxMana;
      if (!Number.isFinite(max) || max <= 0) return null;
      const cur = view && Number.isFinite(view.mana) ? view.mana : entity.mana;
      return { cur: Math.max(0, Math.min(max, cur)), max };
    },
    domain: (pop) => maxOf(pop.map((e) => e.maxMana)),
  }),
  stamina: Object.freeze({
    read: (view, entity) => {
      const max = entity && entity.maxStamina;
      if (!Number.isFinite(max) || max < 0) return null;
      const cur = view && Number.isFinite(view.stamina) ? view.stamina : entity.stamina;
      if (!Number.isFinite(cur)) return null;
      return { cur: Math.max(0, Math.min(max, cur)), max };
    },
    domain: (pop) => maxOf(pop.map((e) => e.maxStamina)),
  }),
  poise: Object.freeze({
    read: (view, entity) => {
      const pm = (view && view.poiseMeter) || (entity && entity.poiseMeter);
      if (!pm || !Number.isFinite(pm.max) || pm.max <= 0) return null;
      return { cur: Math.max(0, pm.value || 0), max: pm.max };
    },
    domain: (pop) => maxOf(pop.map((e) => e.poiseMax)),
  }),
});

export const RESOURCE_SOURCE_IDS = Object.freeze(Object.keys(RESOURCE_SOURCES));
export const RESOURCE_WEIGHTS = Object.freeze(['normal', 'skinny']);
export const HUD_SURFACES = Object.freeze(['main', 'model']);

function maxOf(values) {
  let best = 0;
  for (const v of values) {
    // Content writes hp as a number OR as a [lo, hi] roll range; both are the
    // population, and taking the hi is the honest ceiling.
    if (Array.isArray(v)) { for (const n of v) if (Number.isFinite(n) && n > best) best = n; }
    else if (Number.isFinite(v) && v > best) best = v;
  }
  return best;
}

/**
 * resourceDomains(registries) → { [surfaceId]: { [rowId]: number } }
 *
 * The population per surface, and it is the two-HUD split he drew:
 *   main  — the player, and only the player. So the health domain is what a
 *           PLAYER's max HP can be (classes + equipment maxHp mods), not what a
 *           boss's can be. 84 today, and see the boundary note in the report:
 *           the spread across all three classes is 14 %, because this game has
 *           no max-HP progression yet. His rule is right and has almost nothing
 *           to encode until D10's levelling lands.
 *   model  — the player AND every enemy, since both wear an under-model strip.
 *
 * Derived once per registries, not per frame.
 */
export function resourceDomains(registries) {
  const enemies = registries.enemies.all();
  const playerPop = [{
    maxHp: registries.statDomains.hp,
    maxMana: registries.statDomains.mana,
    maxStamina: registries.statDomains.stamina,
    // The player's poise ceiling: the largest stagger threshold the equipment
    // tables can grant (registries.js derives it beside the other domains).
    poiseMax: registries.statDomains.poise,
  }];
  const bothPop = [...playerPop, ...enemies.map((e) => ({ maxHp: e.hp, poiseMax: e.poiseMax }))];
  const pops = { main: playerPop, model: bothPop };
  const out = {};
  for (const surface of HUD_SURFACES) {
    out[surface] = {};
    for (const row of registries.resources.all()) {
      const src = RESOURCE_SOURCES[row.source];
      if (!src) continue; // unreachable: the validator refuses the row at boot
      out[surface][row.id] = Number.isFinite(row.domainMax) ? row.domainMax : src.domain(pops[surface]);
    }
  }
  return out;
}

/**
 * resourceBarPlan(registries, surface, view, entity, domains) → [bar]
 *
 * ONE function, both HUDs. A bar is:
 *   { id, name, glyph, tint, weight, band, cur, max, pct, lengthPct, floored }
 *
 *   pct        — the FILL inside the trough (cur/max). The old bars' only job.
 *   lengthPct  — the TROUGH's own length, as a fraction of the row track, and
 *                the whole of his ask: scale(max)/scale(domainMax). Nothing is
 *                typed; the track is derived by flexbox from the row minus the
 *                two buttons, so a bar cannot lie about a max.
 *
 *                THE DOMAIN IS PER RESOURCE, AND THAT IS RULED, NOT DEFAULTED.
 *                Constantine, 2026-08-13: "bar scaling per resource" (family
 *                repo, commons/decisions/directions.md D19 C6). Each row's
 *                length is measured against ITS OWN resource's derived
 *                ceiling — never against a shared cross-resource rate. The
 *                consequence is deliberate: length tells pool size at a
 *                glance WITHIN a resource across the run, not BETWEEN
 *                resources — two pools with different maxes legitimately
 *                render different px per point, and comparing bar lengths
 *                across resources reads nothing. The shared-rate alternative
 *                (Elden Ring's literal read) is dead by his word;
 *                tools/hudbars.mjs A2/A2X assert both halves, so
 *                reintroducing a shared rate goes red, not quiet. (His word
 *                closed the conflict my 2026-08-13 log carried as open — the
 *                shipped derivation was already per-resource, so his answer
 *                ratified the default: zero code moved here. — Freja)
 *   floored    — the minimum-width clause fired; see resbars.css. A floored bar
 *                is no longer to scale and says so in its own trough.
 *
 * A row whose reader returns null is ABSENT from the plan. Not zero-length,
 * not an empty trough: absent.
 */
export function resourceBarPlan(registries, surface, view, entity, domains) {
  const bars = [];
  const rows = registries.resources.all()
    .filter((r) => r.surfaces.includes(surface))
    .sort((a, b) => a.order - b.order);
  const scaleByMax = surfaceScalesByMax(registries, surface);
  for (const row of rows) {
    const src = RESOURCE_SOURCES[row.source];
    const val = src && src.read(view, entity);
    if (!val) continue; // the refusal
    const domain = (domains && domains[surface] && domains[surface][row.id]) || val.max;
    const raw = domain > 0 ? resourceScale(val.max) / resourceScale(domain) : 1;
    bars.push({
      id: row.id,
      name: row.name,
      glyph: row.glyph || '',
      tint: row.tint,
      weight: row.weight,
      band: row.band || null,
      cur: val.cur,
      max: val.max,
      pct: Math.max(0, Math.min(100, (val.cur / val.max) * 100)),
      lengthPct: scaleByMax ? Math.max(0, Math.min(100, raw * 100)) : 100,
      domain,
    });
  }
  return bars;
}

/** balance.ui.hudBars.<surface>.scaleByMax — his rule, per surface, as data. */
export function surfaceScalesByMax(registries, surface) {
  const cfg = ((registries.balance || {}).ui || {}).hudBars || {};
  return !!(cfg[surface] && cfg[surface].scaleByMax);
}
