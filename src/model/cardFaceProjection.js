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
const shorten = html => html.replace(/At the end of your turn, if this is in your hand, lose (\d+ HP)/g, 'In hand: lose $1')
  // Triggers read as "On <event>: <effect>" so a whole trigger fits five words.
  .replace(/^(?:When|Whenever) you lose HP, (?:gain (\d+ )|(?=\w))/, (match, gain) => `On HP loss: ${gain ? '+' + gain : ''}`)
  .replace(/^(?:When|Whenever) you play an? (\w+), (?:gain (\d+ )|(?=\w))/, (match, type, gain) => `On ${type}: ${gain ? '+' + gain : ''}`)
  .replace(/^(?:When|Whenever) you gain Starstone Charge, (?:gain (\d+ )|(?=\w))/, (match, gain) => `On Charge: ${gain ? '+' + gain : ''}`)
  .replace(/^(?:When|Whenever) you heal, (?:gain (\d+ )|(?=\w))/, (match, gain) => `On heal: ${gain ? '+' + gain : ''}`)
  .replace(/^(?:When|Whenever) an enemy dies, /, 'On kill: ')
  .replace(/to ALL\b/g, 'to all')
  .replace(/At the start of your turn, /g, 'Turn start: ')
  .replace(/At the end of your turn, /g, 'Turn end: ')
  .replace(/Whenever /g, 'When ').replace(/to the selected enemy/g, 'to target')
  .replace(/to ALL enemies/g, 'to all').replace(/to all enemies/g, 'to all').replace(/to a random enemy/g, 'to random enemy')
  .replace(/\b(Retreat|Close) (<span[^>]*>\d+<\/span>|\d+) bands? (?:away from|toward) (?:target|attacker)/g, '$1 $2 band')
  .replace(/for every /g, 'per ')
  .replace(/In expanded combat, stops at (\d+) stacks each/g, 'Expanded: cap $1 stacks each')
  .replace(/(\d+) per (\d+) of \((.+?) stacks across all enemies plus (.+?) stacks across all enemies\) \(whole groups\)/g, '$1 per $2 total $3 + $4 on all enemies')
  .replace(/\bInflict (?=(?:<[^>]*>)*\d)/g, 'Deal ').replace(/\bInflict /g, 'Apply ')
  .replace(/\(leave at least 1 HP\)/g, '(leave 1)')
  // Face-only shortenings (the full wording stays in Information).
  .replace(/ \((?:<[^>]*>)*\d+(?:<\/span>)* total across \d+ hits\)/g, '')
  .replace(/Double the target(?:'|&#39;)s Blight \(Crimson and Necrotic\)/g, 'Double target Blight (Crimson, Necrotic)')
  // Two damage types of one hit read as one clause ("2 Blunt + 1 Force ×3"): the hit count and area qualify both.
  .replace(/^(?:Deal )?((?:<span[^>]*>)?\d+(?:<\/span>)?) ([A-Za-z]+), ((?:<span[^>]*>)?\d+(?:<\/span>)?) ([A-Za-z]+) damage/, '$1 $2 + $3 $4')
  .replace(/^Remove all (\w+(?:, all \w+)+)/, (match, list) => 'Remove ' + list.replace(/all /g, ''))
  .replace(/^Your attacks apply (\d+ \w+) per stack/, 'Attacks apply $1/stack').replace(/\(maximum (\d+)\)/g, '(max $1)').replace(/\.\s*$/, '').trim();
// A downside is never hidden or dropped for another line: it is listed first and kept (owner review, 2026-10-31).
const COST_RE = /\b(?:take \d+ damage|lose \d+ HP|exhaust|one play per combat|discard|ethereal|cannot|unplayable)\b/i;
const wordCount = html => plain(html).split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
// A line of five words or fewer is one clause. A longer list of complete
// phrases ("8 damage to all, 3 Poise to all") splits at its commas into one
// clause each; a longer conditional or sentence returns null and stays whole in
// Information rather than being cut mid-condition.
const CONDITIONAL_START = /^(?:When|If|Unless|While|After|Before|At|Once|Turn)\b/;
function clausesOf(line, { split = true } = {}) {
  if (wordCount(line.html) <= FACE_CLAUSE_WORDS) return [line];
  // A longer clause drops its leading verb ("Deal 5 Slashing damage to all" reads "5 Slashing damage to all").
  const bare = line.html.replace(/^(?:Deal|Apply|Inflict) /, '');
  if (bare !== line.html && wordCount(bare) <= FACE_CLAUSE_WORDS) return [{ ...line, html: bare }];
  // A turn trigger carrying a downside splits into two triggers, so the cost is never lost ("Turn start: take 1 damage").
  const trigger = /^(Turn (?:start|end)): (.+?)(?:,| and) ((?:take|lose) .+)$/.exec(line.html);
  if (trigger) {
    const both = [`${trigger[1]}: ${trigger[2].replace(/^gain (\d+) /, '+$1 ')}`, `${trigger[1]}: ${trigger[3]}`];
    if (both.every(part => wordCount(part) <= FACE_CLAUSE_WORDS)) return both.map(html => ({ ...line, html }));
    return null;
  }
  const text = plain(line.html);
  if (!split || /:/.test(text) || /\bthen\b/i.test(text)) return null;
  // Split only a list of complete effects: every piece carries its own amount and none opens a condition.
  const parts = [];
  for (const piece of line.html.split(/[,;]\s+/)) {
    if (parts.length && (parts[parts.length - 1].split('(').length !== parts[parts.length - 1].split(')').length)) parts[parts.length - 1] += ', ' + piece;
    else parts.push(piece);
  }
  for (let i = 0; i < parts.length; i++) if (wordCount(parts[i]) > FACE_CLAUSE_WORDS) parts[i] = parts[i].replace(/^(?:Deal|Apply|Inflict) /, '');
  // A piece is a complete effect only when it names what the amount is of (damage, Poise, Block ...) or ends in its
  // amount ("Weak 2"); a bare damage type ("Deal 2 Blunt") shares its noun and qualifiers with the next piece.
  const whole = part => (/\d/.test(plain(part)) && (/\d(?: \([^)]*\))?$/.test(plain(part).trim()) || /\b(?:damage|Poise|Ward|Block|HP|SP|Mana|Barrier|Evade|Draw|Strength|Dexterity)\b/i.test(plain(part)))) || COST_RE.test(plain(part));
  // A trailing qualifier (hit count, area) belongs to every piece or to none: a split would otherwise lose it.
  const qualifier = part => /( ×\d+| to all| to random enemy)$/.exec(plain(part).trim())?.[1] ?? '';
  if (parts.length > 1 && parts.some(part => qualifier(part) !== qualifier(parts[parts.length - 1]))) return null;
  if (parts.length < 2 || parts.some(part => wordCount(part) > FACE_CLAUSE_WORDS || CONDITIONAL_START.test(plain(part)) || !whole(part))) return null;
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
export function cardFaceProjection(def, { lines = null, authoredHtml = '', faceHtml = null, registries = null, effects = def.effects || [] } = {}) {
  const projection = computedFaceProjection(def, { lines, authoredHtml, registries, effects });
  // The Inspect cue is a last resort: a card that authors a `faceTemplate` says its main effect in place of it
  // (owner, 2026-11-01). Downsides the computed face reserved (Exhaust, a payment) stay ahead of the summary.
  if (faceHtml?.length && projection.clauses.some(clause => clause.kind === 'detail')) {
    const summaryText = [...faceHtml.map(plain), ...(def.keywords || []).filter(word => ['exhaust', 'ethereal'].includes(word))].join(' ').toLowerCase();
    const named = text => (text.match(/\b(?:take|lose|exhaust|discard|ethereal|unplayable|pay|offer|skip)\b|\bone play\b/gi) || [])
      .every(word => summaryText.includes(word.toLowerCase().split(' ')[0]));
    if (!(projection.hiddenDownsides || []).every(named)) return projection;
    const downsides = projection.clauses.filter(clause => clause.downside || clause.kind === 'cost');
    // A reserved clause may already carry part of the payoff ("Heal 8 HP, Exhaust, Retain"): a summary line it contains is dropped.
    const wordsOf = html => new Set((plain(html).toLowerCase().match(/[\p{L}\p{N}%+]+/gu) || []).filter(word => !/^cards?$/.test(word)));
    const covered = html => downsides.some(clause => { const have = wordsOf(clause.html); return [...wordsOf(html)].every(word => have.has(word)); });
    const summary = faceHtml.filter(html => !covered(html)).map(html => ({ kind: 'effect', html }));
    // A card's Exhaust / Ethereal keyword is a downside the summary never has to repeat.
    for (const [keyword, word] of [['exhaust', 'Exhaust'], ['ethereal', 'Ethereal']]) {
      if ((def.keywords || []).includes(keyword) && !downsides.some(clause => plain(clause.html).includes(word)))
        downsides.push({ kind: 'cost', html: word });
    }
    return { ...projection, clauses: [...downsides, ...summary].slice(0, FACE_EFFECT_CLAUSES), omitted: true };
  }
  return projection;
}

function computedFaceProjection(def, { lines, authoredHtml, registries, effects }) {
  let candidates = lines ? lines.map(line => ({ ...line, ...('faceHtml' in line ? { faceHtml: undefined } : {}),
    // Entry bonuses and the Defend restore are stance explanations, outside
    // the ordinary effect budget. Their complete reading stays in Information.
    html: ('faceHtml' in line ? line.faceHtml : line.html).replace(/^Restore .*?Poise\/Ward\.\s*/, '').replace(/(?:, |\. )?Entry:.*$/, '').trim(),
  })).filter(line => line.html && !/^(?:Entry:|Restore .*Poise\/Ward)/.test(plain(line.html))
    // `tag` lines (Smash, Prone, Entry riders) and `detail` lines are Information-only.
    && !['detail', 'tag'].includes(line.kind))
    : authoredClauses(authoredHtml);
  if (!candidates.length) candidates = authoredClauses(authoredHtml);
  // Upsides keywords (Retain, Innate) drop beside real effects; the downside keywords stay as costs.
  const keywordOnly = line => /^(?:Retain|Innate)(?:, (?:Retain|Innate))*$/.test(plain(line.html));
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
  const fitted = candidates.map(line => ({ line, parts: clausesOf(line, { split: !!lines || /^(?:One play|Exhaust|Ethereal)/.test(plain(line.html)) }) }));
  // Every downside (a payment, "take N damage", Exhaust, Ethereal, "cannot", ...) is reserved a place first and is never
  // dropped for another line. If the downsides alone cannot be said in three short clauses the face is the Inspect cue,
  // never a free-looking payoff.
  const reserved = fitted.filter(entry => payments.includes(entry.line) || COST_RE.test(plain(entry.line.html)));
  const reservedCount = reserved.every(entry => entry.parts) ? reserved.reduce((sum, entry) => sum + entry.parts.length, 0) : Infinity;
  const chosen = new Set();
  let count = 0, used = 0;
  const take = entry => {
    const size = plain(entry.line.html).length;
    if (!entry.parts || !size || used + size > FACE_EFFECT_CHARACTERS || count + entry.parts.length > FACE_EFFECT_CLAUSES) return;
    chosen.add(entry); count += entry.parts.length; used += size + 2;
  };
  if (reservedCount <= FACE_EFFECT_CLAUSES) { reserved.forEach(take); fitted.forEach(entry => { if (count < FACE_EFFECT_CLAUSES && !chosen.has(entry)) take(entry); }); }
  // `downside` marks what the face reserved as a payment or requirement; a summary that replaces the cue keeps it.
  const clauses = fitted.filter(entry => chosen.has(entry)).flatMap(entry => reserved.includes(entry) ? entry.parts.map(part => ({ ...part, downside: true })) : entry.parts);
  const shown = chosen.size;
  // The primary effect that cannot be said in five words is named by the cue, never silently dropped behind a minor line.
  const primary = fitted.find(entry => !reserved.includes(entry));
  if (primary && !primary.parts && clauses.length && clauses.length < FACE_EFFECT_CLAUSES && !clauses.some(clause => clause.kind === 'detail')) clauses.push({ kind: 'detail', html: esc(uiStrings.find(row => row.id === 'card.face.inspectEffect').short) });
  // A face of downsides alone would read as a card that only hurts: name the effect it could not say.
  if (clauses.length && clauses.length < FACE_EFFECT_CLAUSES && !clauses.some(clause => clause.kind === 'detail') && !fitted.some(entry => chosen.has(entry) && !reserved.includes(entry)) && fitted.some(entry => !reserved.includes(entry))) clauses.push({ kind: 'detail', html: esc(uiStrings.find(row => row.id === 'card.face.inspectEffect').short) });
  // An unfamiliar long rule is named, never shortened mid-condition. Current
  // authored cards are covered by whole clauses; this explicit door is a safe
  // forward-compatible reading for future mechanics rather than false prose.
  if (!clauses.length) clauses.push({ kind: 'detail', html: esc(uiStrings.find(row => row.id === 'card.face.inspectEffect').short) });
  // A required downside the face could not carry (a long payment, a mandatory discard): a summary may replace the cue
  // only when it names that downside itself.
  const hiddenDownsides = reserved.filter(entry => !chosen.has(entry)).map(entry => plain(entry.line.html));
  return { clauses, hiddenDownsides, maxLines: FACE_EFFECT_LINES,
    omitted: !lines || shown < lines.length || candidates.length > shown };
}
