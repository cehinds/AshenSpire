// Scan shared implementations at their canonical engine entrypoints. These names
// are saved-runtime metadata: a code-only extraction must not rename a mechanic.
import { posix } from 'node:path';

export const CANONICAL_MECHANIC_DELEGATES = [
  { file: 'src/engine/gameProfileCombat.js', implementation: 'src/model/profileDamageOffense.js', namespace: 'Offense', symbols: {
    PhysicalDamageMultiplier: 'PhysicalDamageMultiplier', SideDamageMultiplier: 'SideDamageMultiplier', IsPacketHit: 'IsPacketHit',
    PacketMagicMultiplier: 'PacketMagicMultiplier', ProfileDamageOffense: 'profileDamageReceiptCore', DamageIncoming: 'profileDamageReceiptCore',
  } },
  { file: 'src/engine/elementIdentity.js', implementation: 'src/model/elementReceiptStages.js', namespace: 'ElementStages', symbols: {
    FireSpreads: 'fireSpreads', ElementReceiptStages: 'ElementReceiptStages',
  } },
  { file: 'src/engine/gearReceipt.js', implementation: 'src/model/gearDamageRead.js', namespace: 'GearRead', symbols: {
    GearGainBonus: 'GearGainBonus', GearProps: 'GearProps', GearState: 'GearState', GearReceiptAdd: 'GearReceiptAdd', GearMeleeHit: 'GearMeleeHit',
  } },
  { file: 'src/engine/stanceBenefits.js', implementation: 'src/model/stanceBenefitsRead.js', namespace: 'StanceRead', symbols: {
    StanceBenefitRules: 'StanceBenefitRules', HeldStance: 'HeldStance', AttackDamageMultiplier: 'AttackDamageMultiplier',
    HitRange: 'HitRange', StanceWeaknessMultiplier: 'StanceWeaknessMultiplier',
  } },
];

const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Preserve offsets/newlines while masking comments and literals. Template bodies
// are conservatively opaque: a delegate hidden in interpolation is not supported.
function codeMask(text) {
  const chars = text.split('');
  let previous = '', word = '';
  const controlParens = [];
  const hide = (start, end) => { for (let j = start; j < end; j++) if (chars[j] !== '\n') chars[j] = ' '; };
  function quotedEnd(start) {
    const quote = text[start];
    for (let i = start + 1; i < text.length; i++) {
      if (text[i] === '\\') { i++; continue; }
      if (text[i] === quote) return i + 1;
      if (quote === '`' && text[i] === '$' && text[i + 1] === '{') i = interpolationEnd(i + 2) - 1;
    }
    throw new Error('mechanic delegate: unterminated literal');
  }
  function interpolationEnd(start) {
    let depth = 1;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (c === '"' || c === "'" || c === '`') { i = quotedEnd(i) - 1; continue; }
      if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
      if (c === '/' && text[i + 1] === '*') {
        const end = text.indexOf('*/', i + 2);
        if (end < 0) throw new Error('mechanic delegate: unterminated comment');
        i = end + 1; continue;
      }
      // Interpolations with regex/division are outside this conservative mask's
      // supported bridge syntax. Refuse rather than guessing at their braces.
      if (c === '/') throw new Error('mechanic delegate: unsupported template interpolation');
      if (c === '{') depth++;
      if (c === '}' && --depth === 0) return i + 1;
    }
    throw new Error('mechanic delegate: unterminated template interpolation');
  }
  for (let i = 0; i < text.length;) {
    const start = i, c = text[i];
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      hide(start, i); continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 2;
      hide(start, i); continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      i = quotedEnd(i);
      hide(start, i); previous = 'v'; word = ''; continue;
    }
    if (c === '/' && (!previous || '(,=:[!&|?{};+-*%<>~^'.includes(previous) || /^(return|throw|case|typeof|void|yield|else|do|in|of|new|delete|await|instanceof)$/.test(word))) {
      i++;
      let inClass = false;
      while (i < text.length && text[i] !== '\n') {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === '[') inClass = true;
        if (text[i] === ']') inClass = false;
        if (text[i++] === '/' && !inClass) break;
      }
      while (/[a-z]/i.test(text[i] || '') && i < text.length) i++;
      hide(start, i); previous = 'v'; word = ''; continue;
    }
    if (c === '(') {
      controlParens.push(/^(if|while|for|with|switch|catch)$/.test(word));
      previous = '('; word = ''; i++; continue;
    }
    if (c === ')') {
      // A slash after a control-condition head starts a statement (and may
      // introduce a regex), whereas a slash after a normal call is division.
      previous = controlParens.pop() ? '(' : ')'; word = ''; i++; continue;
    }
    if (/[\w$]/.test(c)) {
      while (i < text.length && /[\w$]/.test(text[i])) i++;
      word = text.slice(start, i); previous = 'v'; continue;
    }
    if (!/\s/.test(c)) { previous = c; word = ''; }
    i++;
  }
  return chars.join('');
}

function matchingEnd(code, start, open, close) {
  let depth = 0;
  for (let i = start; i < code.length; i++) {
    if (code[i] === open) depth++;
    if (code[i] === close && --depth === 0) return i + 1;
  }
  throw new Error('mechanic delegate: unterminated declaration');
}

function declaration(text, symbol) {
  const code = codeMask(text);
  const match = new RegExp(`^(export\\s+)?(?:async\\s+)?(function|const)\\s+${esc(symbol)}\\b`, 'm').exec(code);
  if (!match) throw new Error(`mechanic delegate: missing declaration ${symbol}`);
  const start = match.index;
  if (!atTopLevel(code.slice(0, start))) throw new Error(`mechanic delegate: ${symbol} must be top-level`);
  let body;
  if (match[2] === 'function') {
    const params = code.indexOf('(', start + match[0].length);
    body = matchingEnd(code, params, '(', ')');
    while (/\s/.test(code[body] || '') && body < code.length) body++;
    if (code[body] !== '{') throw new Error(`mechanic delegate: unsupported function ${symbol}`);
  } else {
    // The bridge table supports callable const arrows, never data constants.
    const arrow = code.indexOf('=>', start + match[0].length);
    if (arrow < 0 || code.slice(start, arrow).includes(';')) throw new Error(`mechanic delegate: unsupported arrow ${symbol}`);
    body = arrow + 2;
    while (/\s/.test(code[body] || '') && body < code.length) body++;
  }
  const end = code[body] === '{' ? matchingEnd(code, body, '{', '}') : code.indexOf(';', body) + 1;
  if (end <= body) throw new Error(`mechanic delegate: unsupported body ${symbol}`);
  return { start, end, exported: !!match[1], header: code.slice(start, body), code: code.slice(body, end), text: text.slice(start, end) };
}

function atTopLevel(code) {
  const depth = { '{': 0, '(': 0, '[': 0 };
  for (const c of code) {
    if (c in depth) depth[c]++;
    else if (c === '}') depth['{']--;
    else if (c === ')') depth['(']--;
    else if (c === ']') depth['[']--;
  }
  return Object.values(depth).every(value => value === 0);
}

function directlyCalls(wrapper, namespace, symbol) {
  const name = esc(namespace);
  // A matching spelling is not the imported binding when an argument or local
  // declaration shadows it. The supported bridges never shadow their imports.
  if (new RegExp(`\\b${name}\\b`).test(wrapper.header)
    || shadowsNamespace(wrapper.code, namespace)) return false;
  const call = `${name}\\s*\\.\\s*${esc(symbol)}\\s*\\(`;
  if (!wrapper.code.startsWith('{')) return new RegExp(`^${call}`).test(wrapper.code);
  const body = wrapper.code.slice(1, -1);
  const candidate = new RegExp(`(?:^|[;}])\\s*(?:return\\s+|(?:const|let|var)\\s+\\w+\\s*=\\s*)${call}`, 'g');
  for (const match of body.matchAll(candidate)) {
    const offset = match.index + match[0].search(/\b(?:return|const|let|var)\b/);
    if (atTopLevel(body.slice(0, offset))) return true;
  }
  return false;
}

function shadowsNamespace(code, namespace) {
  const named = new RegExp(`\\b${esc(namespace)}\\b`);
  if (new RegExp(`\\b(?:function|class|catch)\\b[^;={\\n]*\\b${esc(namespace)}\\b`).test(code)) return true;
  for (const match of code.matchAll(/\b(?:const|let|var)\s+/g)) {
    let i = match.index + match[0].length;
    for (;;) {
      while (/\s/.test(code[i] || '') && i < code.length) i++;
      const start = i;
      if (code[i] === '{') i = matchingEnd(code, i, '{', '}');
      else if (code[i] === '[') i = matchingEnd(code, i, '[', ']');
      else while (/[\w$]/.test(code[i] || '') && i < code.length) i++;
      if (named.test(code.slice(start, i))) return true;
      if (i === start) break;
      // Find the next declarator, respecting defaults inside destructuring and
      // commas nested in initializer calls, objects, arrays or arrow functions.
      const depth = { '{': 0, '(': 0, '[': 0 };
      for (; i < code.length; i++) {
        const c = code[i];
        if (c in depth) depth[c]++;
        else if (c === '}') depth['{']--;
        else if (c === ')') depth['(']--;
        else if (c === ']') depth['[']--;
        if ((c === ',' || c === ';') && Object.values(depth).every(value => value === 0)) break;
      }
      if (code[i++] !== ',') break;
    }
  }
  return false;
}

const symbolAt = line => (line.match(/^(?:export\s+)?(?:async\s+)?function\s+\*?\s*(\w+)/)
  || line.match(/^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/)
  || line.match(/^(?:export\s+)?const\s+(\w+)\s*=\s*Object\.freeze\(\{\s*$/))?.[1];
const isComment = line => /^\s*(\/\/|\*|\/\*)/.test(line);

// A bridge is accepted only when the implementation exports the function and the
// named owner actually calls it through a namespace imported from that exact leaf.
// Every ordinary source remains in the scan, including the shared leaf itself.
export function createMechanicReader(sources, delegates = []) {
  const texts = new Map(sources.map(({ file, lines }) => [file, lines.join('\n')]));
  const insertions = new Map();
  for (const { file, implementation, namespace, symbols } of delegates) {
    const ownerText = texts.get(file), leafText = texts.get(implementation);
    if (ownerText === undefined || leafText === undefined) throw new Error(`mechanic delegate: missing source ${file} or ${implementation}`);
    const imports = [...ownerText.matchAll(/^import\s+\*\s+as\s+(\w+)\s+from\s+(['"])([^'"\n]+)\2\s*;/gm)];
    const imported = imports.some(match => match[1] === namespace
      && codeMask(ownerText).slice(match.index, match.index + 6) === 'import'
      && posix.normalize(posix.join(posix.dirname(file), match[3])) === implementation);
    if (!imported) throw new Error(`mechanic delegate: ${file} must import ${implementation} as ${namespace}`);
    for (const [symbol, owner] of Object.entries(symbols)) {
      const leaf = declaration(leafText, symbol), wrapper = declaration(ownerText, owner);
      if (!leaf.exported) throw new Error(`mechanic delegate: ${implementation} must export ${symbol}`);
      if (!directlyCalls(wrapper, namespace, symbol)) {
        throw new Error(`mechanic delegate: ${file}#${owner} must call ${namespace}.${symbol}`);
      }
      const line = ownerText.slice(0, wrapper.start).split('\n').length - 1;
      const key = `${file}:${line}`;
      const rows = insertions.get(key) || [];
      rows.push(...leaf.text.split('\n').map(text => ({ file, symbol: owner, text })));
      insertions.set(key, rows);
    }
  }
  const rows = [];
  for (const { file, lines } of sources) {
    let symbol;
    for (const [line, text] of lines.entries()) {
      rows.push(...(insertions.get(`${file}:${line}`) || []));
      symbol = symbolAt(text) || symbol;
      rows.push({ file, symbol, text });
    }
  }
  return patterns => {
    for (const { file, symbol, text } of rows) {
      if (isComment(text) || !patterns.some(pattern => pattern.test(text))) continue;
      return { file, ...(symbol ? { symbol } : {}) };
    }
    return null;
  };
}
