// W1w combatant inspector (CURRENT-SPECIFICATION, Inspector W1w). One ordered,
// DOM-free projection for the door and the edge tray: summary (HP, intent,
// defense), current state, previous actions newest first, known abilities,
// known traits, lore last. Every section says whether it is `known`, `none`
// (known to be empty) or `unknown` (not revealed); the two empty states never
// share wording. The preview carries the name and the pool meters (HP, MP,
// Poise) beside the sprite.

export const INSPECTOR_SECTION_ORDER = Object.freeze(['summary', 'state', 'history', 'abilities', 'traits', 'lore']);

// The side preview's meters, in stack order (owner follow-up: restore the
// HP/MP/Poise meters the tray lost). HP is shown whenever the subject has it;
// MP and Poise only when the combatant actually has that pool (max > 0).
export const INSPECTOR_PREVIEW_METERS = Object.freeze(['HP', 'MP', 'Poise']);

export function previewMeters(resources = []) {
  return INSPECTOR_PREVIEW_METERS
    .map((label) => resources.find((r) => r.label === label))
    .filter((r) => r && (r.label === 'HP' || Number(r.max) > 0))
    .map((r) => Object.freeze({ ...r }));
}

const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ value: '', detail: '', ...row })));
const disclose = (rows) => (rows == null
  ? { knowledge: 'unknown', rows: freezeRows([]) }
  : { knowledge: rows.length ? 'known' : 'none', rows: freezeRows(rows) });

// `text(id, tokens)` is the copy lookup (the caller passes strings.js `t`):
// every title and label is a uiStrings.csv row, and this model stays free of
// both the DOM and the table.
export function projectCombatantInspector(subject, text = (id) => id) {
  if (!subject?.name) throw new Error('combatant inspector requires a named subject');
  const resources = subject.resources || [];
  const hp = resources.find((r) => r.label === 'HP') || null;
  const block = resources.find((r) => r.label === 'Block');
  const summary = [
    hp && { label: text('inspector.summary.hp'), value: `${hp.value} / ${hp.max}` },
    subject.intent && { label: text('inspector.summary.intent'), value: subject.intent.name, detail: subject.intent.detail || '' },
    { label: text('inspector.summary.defense'), value: text('inspector.summary.block', { amount: block?.value ?? 0 }) },
  ].filter(Boolean);
  // Current state: active pools other than HP/Block, then active effects. A
  // subject that lists its effects as abilities shows them there instead.
  const state = [
    ...resources
      .filter((r) => r.label !== 'HP' && r.label !== 'Block' && (r.max == null ? r.value > 0 : r.max > 0))
      .map((r) => ({ label: r.label, value: r.max == null ? String(r.value) : `${r.value} / ${r.max}` })),
    ...(subject.abilities ? [] : (subject.statuses || []).map((s) => ({ label: s.name, detail: s.detail || '' }))),
  ];
  const abilityList = subject.abilities ?? subject.moveCards ?? subject.skills ?? null;
  const sections = {
    summary: { title: text('inspector.section.summary'), ...disclose(summary) },
    state: { title: text('inspector.section.state'), ...disclose(state) },
    // History arrives oldest first, as the engine records it.
    history: { title: text('inspector.section.history'), ...disclose(subject.history == null ? null
      : [...subject.history].reverse().map((h) => ({ label: h.name, detail: h.detail || '' }))) },
    abilities: { title: subject.skillLabel || text('inspector.section.abilities'), ...disclose(abilityList == null ? null : abilityList.map((a) => ({ label: a.name || '' }))) },
    traits: { title: text('inspector.section.traits'), ...disclose(subject.traits == null ? null : subject.traits.map((trait) => ({ label: trait.name, detail: trait.detail || '' }))) },
    lore: { title: text('inspector.section.lore'), ...disclose(subject.lore == null ? null : subject.lore.map((line) => ({ label: line }))) },
  };
  return Object.freeze({
    preview: Object.freeze({
      name: subject.name,
      hp: hp ? Object.freeze({ ...hp }) : null,
      meters: Object.freeze(previewMeters(resources)),
    }),
    sections: Object.freeze(INSPECTOR_SECTION_ORDER.map((id) => Object.freeze({ id, ...sections[id] }))),
  });
}
