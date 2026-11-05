import { WIREFRAME_CHOICE_GROUPS } from './WireframeChoiceModel.js';

// Presentation only: every setting keeps its existing key and value semantics.
//
// Core 2 shows the Opening, Interface, Text, Battlefield, Wireframes and Export
// sections plus Play in deck order under Deck (cleanup row 3e retired the
// Progression, Combat, Stats, Recovery, Rewards, Shops, Equipment and World
// tabs with the rows behind them). The model files each row (`advancedGroup`);
// the exceptions below are the presentation rows whose one model group,
// Interface, spans three tabs.
const BATTLEFIELD = /^gameConfig\.presentation\.(?!settings(Width|Height)Percent$)/;
export function advancedSection(row) {
  if (row.key === 'creationAutoAdvance') return 'Progression';
  if (/^gameConfig\.presentation\.settings(Width|Height)Percent$/.test(row.key) || row.key === 'uprightGate') return 'Wireframes';
  if (BATTLEFIELD.test(row.key)) return 'Battlefield';
  return row.advancedGroup || 'Interface';
}

function topic(row, section) {
  const key = row.key;
  // A row that names its own topic is filed under it. The Wireframes rows are
  // generated from one catalogue (models/WireframeChoiceModel.js) whose groups
  // ARE the topics — Modals, Menus, Scenes — so a fourth family files itself.
  // `wireframeTopic` is the group's stable id, never its rewordable label.
  if (row.wireframeTopic) return row.wireframeTopic;
  if (row.cardSizeTopic) return 'Card size';
  if (row.debugTopic) return 'Diagnostics';
  if (row.textTopic) return row.textTopic;
  if (row.prologueTopic) return row.prologueTopic;
  if (section === 'Battlefield') {
    if (/movement|Activation|selectionColor/.test(key)) return 'Movement';
    if (/row[A-F]|front|back|formation|groundTilt|groundSkew|gridShape|showFormationGrid/.test(key)) return 'Formation layout';
    if (/Spawn|SpriteScale/.test(key)) return 'Characters';
    return 'Formation grid';
  }
  if (section === 'Wireframes') return 'Window';
  if (section === 'Export') return 'Configuration file';
  if (section === 'Interface') {
    if (/map|walked/.test(key)) return 'Map & HUD';
    if (/holdConfirm|rewardCollect|controlHints/.test(key)) return 'Controls';
    return 'Appearance';
  }
  return 'General';
}

export function advancedSubgroups(rows, section) {
  const groups = new Map();
  const labels = new Map();
  for (const row of rows.filter(row => advancedSection(row) === section)) {
    const id = topic(row, section);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
    // A topic id is what a profile stores and what rows group by; a row whose
    // topic heading is rewordable copy carries that label separately, so a
    // reword never moves the id or merges two topics (Codex, #1489).
    if (!labels.has(id) && row.wireframeTopic && row.wireframeTopicLabel) labels.set(id, row.wireframeTopicLabel);
  }
  const result = [...groups].map(([id, rows]) => ({ id, label: labels.get(id) ?? id, rows }));
  // A topic not named in an order keeps its discovered order, after the named
  // ones.
  const byOrder = (order) => {
    const rank = (id) => (order.indexOf(id) < 0 ? order.length : order.indexOf(id));
    result.sort((a, b) => rank(a.id) - rank(b.id));
  };
  if (section === 'Battlefield') byOrder(['Formation layout', 'Formation grid', 'Characters', 'Movement']);
  // Modals, then Menus, then Scenes: outermost surface first, and the order the
  // catalogue itself is written in — discovered, not restated, so the two
  // cannot disagree about which family comes first. Cards and the settings
  // window follow.
  if (section === 'Wireframes') byOrder([...WIREFRAME_CHOICE_GROUPS.map((group) => group.id), 'Card size', 'Window']);
  if (section === 'Interface') byOrder(['Map & HUD', 'Appearance', 'Controls']);
  if (section === 'Text') byOrder(['Flavor text', 'Lore window']);
  if (section === 'Export') byOrder(['Configuration file', 'Diagnostics']);
  return result;
}
