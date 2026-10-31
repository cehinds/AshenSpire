// A face is a short reading of complete facts, never a clipped paragraph.
// cardFaceLines and the Information pane retain the full card. Selection does
// not promote this budget: every ordinary face owes the same three lines.
import { uiStrings } from '../content/generated/uiStrings.js';

export const FACE_EFFECT_LINES = 3;
// Owner, 2026-10-31: one to three lines, at most five words per line. A line
// that cannot be said in five words stays whole in Information.
export const FACE_EFFECT_CLAUSES = 3;
export const FACE_EFFECT_CHARACTERS = 90;
export const FACE_CLAUSE_WORDS = 5;

const plain = html => html.replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, 'x');
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const shorten = html => html.replace(/At the start of your turn, /g, 'Turn start: ')
  .replace(/At the end of your turn, /g, 'Turn end: ')
  .replace(/Whenever /g, 'When ').replace(/to the selected enemy/g, 'to target')
  .replace(/to ALL enemies/g, 'to all').replace(/to all enemies/g, 'to all').replace(/to a random enemy/g, 'to random enemy')
  .replace(/\b(Retreat|Close) (<span[^>]*>\d+<\/span>|\d+) bands? (?:away from|toward) (?:target|attacker)/g, '$1 $2 band')
  .replace(/for every /g, 'per ')
  .replace(/In expanded combat, stops at (\d+) stacks each/g, 'Expanded: cap $1 stacks each')
  .replace(/(\d+) per (\d+) of \((.+?) stacks across all enemies plus (.+?) stacks across all enemies\) \(whole groups\)/g, '$1 per $2 total $3 + $4 on all enemies')
  .replace(/\bInflict (?=(?:<[^>]*>)*\d)/g, 'Deal ').replace(/\bInflict /g, 'Apply ')
  .replace(/\(leave at least 1 HP\)/g, '(min 1)').replace(/\(maximum (\d+)\)/g, '(max $1)').replace(/\.\s*$/, '').trim();
const wordCount = html => plain(html).split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
// A line of five words or fewer is one clause. A longer list of complete
// phrases ("8 damage to all, 3 Poise to all") splits at its commas into one
// clause each; a longer conditional or sentence returns null and stays whole in
// Information rather than being cut mid-condition.
function clausesOf(line) {
  if (wordCount(line.html) <= FACE_CLAUSE_WORDS) return [line];
  if (/:/.test(plain(line.html))) return null;
  const parts = [];
  for (const piece of line.html.split(/,\s+/)) {
    if (parts.length && (parts[parts.length - 1].split('(').length !== parts[parts.length - 1].split(')').length)) parts[parts.length - 1] += ', ' + piece;
    else parts.push(piece);
  }
  if (parts.length < 2 || parts.some(part => wordCount(part) > FACE_CLAUSE_WORDS)) return null;
  return parts.map(html => ({ ...line, html }));
}

// Split only complete authored sentences. A following qualification belongs
// to the preceding sentence (caps, generated-card costs and pronoun riders).
function authoredClauses(html) {
  const sentences = html.split(/(?<=[.!?])\s+(?=[A-Z(])/), out = [];
  for (const sentence of sentences) {
    if (/^(?:\(|It |This |That |In expanded combat,|Once per turn\b|Once per combat\b)/.test(sentence) && out.length) out[out.length - 1] += ' ' + sentence;
    else out.push(sentence);
  }
  return out.map(html => ({ kind: 'effect', html: shorten(html) }));
}

/** At most two whole qualified clauses; omitted facts remain in Information. */
export function cardFaceProjection(def, { lines = null, authoredHtml = '', registries = null, effects = def.effects || [] } = {}) {
  let candidates = lines ? lines.map(line => ({ ...line,
    // Entry bonuses and the Defend restore are stance explanations, outside
    // the ordinary effect budget. Their complete reading stays in Information.
    html: line.html.replace(/^Restore .*?Poise\/Ward\.\s*/, '').replace(/(?:, |\. )?Entry:.*$/, '').trim(),
  })).filter(line => line.html && !/^(?:Entry:|Restore .*Poise\/Ward)/.test(plain(line.html))
    // `tag` lines (Smash, Prone, Entry riders) and `detail` lines are Information-only.
    && !['detail', 'tag'].includes(line.kind))
    : authoredClauses(authoredHtml);
  if (!candidates.length) candidates = authoredClauses(authoredHtml);
  const keywordOnly = line => /^(?:Exhaust|Retain|Ethereal|Innate|Unplayable)(?:, (?:Exhaust|Retain|Ethereal|Innate|Unplayable))*$/.test(plain(line.html));
  if (candidates.some(line => !keywordOnly(line))) candidates = candidates.filter(line => !keywordOnly(line));
  // Attach probability to its own status amount. A grouped row may mix a
  // guaranteed application with a chance-based buildup; a row-wide suffix
  // would falsely make both uncertain. Ambiguous repeated grants stay in
  // Information rather than borrowing another grant's probability.
  if (lines) candidates = candidates.map(line => {
    let html = shorten(line.html);
    const chanceIds = new Set(effects.filter(effect => ['buildup', 'applyStatus'].includes(effect.op)
      && effect.chance !== undefined && effect.chance < 100).map(effect => effect.status));
    for (const id of chanceIds) {
      const name = esc(registries?.statuses?.get?.(id)?.name || id);
      if (!html.includes(name)) continue;
      const sources = effects.filter(effect => ['buildup', 'applyStatus'].includes(effect.op) && effect.status === id);
      const chances = new Set(sources.map(effect => effect.chance ?? 100));
      if (chances.size !== 1) return null;
      const chance = [...chances][0];
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const amount = new RegExp(`${escapedName}\\s+(?:<span\\b[^>]*>)*\\d+(?:<\\/span>)*(?=[\\s,.(]|$)`, 'g');
      if (!amount.test(html)) return null;
      amount.lastIndex = 0;
      html = html.replace(amount, match => `${match} (${esc(chance)}% chance)`);
    }
    return { ...line, html };
  }).filter(Boolean);
  // A payment cannot disappear while its payoff remains. Include authored
  // Ashen Blight payments too: those costs are intentionally outside effects.
  const authored = authoredClauses(authoredHtml);
  const payments = candidates.filter(line => line.kind === 'cost' || /^(?:Pay|Offer) /.test(plain(line.html)));
  if (def.ashenBlightCost) for (const line of authored.filter(line => /^Pay .*Ashen Blight/.test(plain(line.html)))) {
    if (!payments.some(payment => payment.html === line.html)) payments.push({ ...line, kind: 'cost' });
  }
  candidates = [...payments, ...candidates.filter(line => !payments.some(payment => payment.html === line.html))];
  const clauses = [];
  let shown = 0;
  const fitted = candidates.map(line => ({ line, parts: clausesOf(line) }));
  const paymentParts = fitted.filter(entry => payments.includes(entry.line));
  const requiredPayments = paymentParts.every(entry => entry.parts) ? paymentParts.reduce((sum, entry) => sum + entry.parts.length, 0) : Infinity;
  for (const { line, parts } of fitted) {
    const used = clauses.reduce((sum, clause) => sum + plain(clause.html).length + 2, 0);
    if (requiredPayments > FACE_EFFECT_CLAUSES || !parts || !plain(line.html).length
      || used + plain(line.html).length > FACE_EFFECT_CHARACTERS || clauses.length + parts.length > FACE_EFFECT_CLAUSES) continue;
    clauses.push(...parts);
    shown++;
    if (clauses.length === FACE_EFFECT_CLAUSES) break;
  }
  // An unfamiliar long rule is named, never shortened mid-condition. Current
  // authored cards are covered by whole clauses; this explicit door is a safe
  // forward-compatible reading for future mechanics rather than false prose.
  if (!clauses.length) clauses.push({ kind: 'detail', html: esc(uiStrings.find(row => row.id === 'card.face.inspectEffect').short) });
  return { clauses, maxLines: FACE_EFFECT_LINES,
    omitted: !lines || shown < lines.length || candidates.length > shown };
}
