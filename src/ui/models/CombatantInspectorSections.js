// W1w combatant inspector (CURRENT-SPECIFICATION, Inspector W1w). One ordered,
// DOM-free projection for the door and the edge tray: summary (HP, intent,
// defense), current state, previous actions newest first, known abilities,
// known traits, lore last. Every section says whether it is `known`, `none`
// (known to be empty) or `unknown` (not revealed); the two empty states never
// share wording. The preview carries only name and HP beside the sprite.

export const INSPECTOR_SECTION_ORDER = Object.freeze(['summary', 'state', 'history', 'abilities', 'traits', 'lore']);

const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ value: '', detail: '', ...row })));
const disclose = (rows) => (rows == null
  ? { knowledge: 'unknown', rows: freezeRows([]) }
  : { knowledge: rows.length ? 'known' : 'none', rows: freezeRows(rows) });

export function projectCombatantInspector(subject) {
  if (!subject?.name) throw new Error('combatant inspector requires a named subject');
  const resources = subject.resources || [];
  const hp = resources.find((r) => r.label === 'HP') || null;
  const block = resources.find((r) => r.label === 'Block');
  const summary = [
    hp && { label: 'HP', value: `${hp.value} / ${hp.max}` },
    subject.intent && { label: 'Intent', value: subject.intent.name, detail: subject.intent.detail || '' },
    { label: 'Defense', value: `${block?.value ?? 0} Block` },
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
    summary: { title: 'Summary', ...disclose(summary) },
    state: { title: 'Current state', ...disclose(state) },
    // History arrives oldest first, as the engine records it.
    history: { title: 'Previous actions', ...disclose(subject.history == null ? null
      : [...subject.history].reverse().map((h) => ({ label: h.name, detail: h.detail || '' }))) },
    abilities: { title: subject.skillLabel || 'Known abilities', ...disclose(abilityList == null ? null : abilityList.map((a) => ({ label: a.name || '' }))) },
    traits: { title: 'Known traits', ...disclose(subject.traits == null ? null : subject.traits.map((t) => ({ label: t.name, detail: t.detail || '' }))) },
    lore: { title: 'Lore', ...disclose(subject.lore == null ? null : subject.lore.map((text) => ({ label: text }))) },
  };
  return Object.freeze({
    preview: Object.freeze({ name: subject.name, hp: hp ? Object.freeze({ ...hp }) : null }),
    sections: Object.freeze(INSPECTOR_SECTION_ORDER.map((id) => Object.freeze({ id, ...sections[id] }))),
  });
}
