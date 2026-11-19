// Only module-leading prose is eligible; the first code token ends the walk.
// Never inspect code: strings, regexes, templates and their comments stay exact.
export function stripModulePreamble(source) {
  let out = '', cursor = 0;
  while (cursor < source.length) {
    let end = cursor;
    while (end < source.length && /\s/.test(source[end])) end++;
    out += source.slice(cursor, end);
    cursor = end;
    if (source.startsWith('//', cursor)) {
      end = cursor + 2;
      while (end < source.length && !/[\r\n\u2028\u2029]/.test(source[end])) end++;
    } else if (source.startsWith('/*', cursor)) {
      const close = source.indexOf('*/', cursor + 2);
      if (close < 0) return out + source.slice(cursor); // the parse gate still refuses it
      end = close + 2;
    } else {
      return out + source.slice(cursor); // includes BOM-following code and shebangs
    }
    const comment = source.slice(cursor, end);
    // Keep the entire preamble when it contains a legal notice or annotation:
    // a notice may continue across several // comments without repeating its
    // identifying words. Conservative matches may also retain ordinary prose.
    const keep = comment.startsWith('/*!') || comment.startsWith('//!')
      || /^\/(?:\/|\*)\s*[@#]|@preserve\b|\blicens(?:e|ed|ing)\b|\bcopyright\b|\bSPDX\b|permission\s+is\s+hereby\s+granted|all\s+rights\s+reserved|\bsource(?:Mapping)?URL\s*=/i.test(comment);
    if (keep) return source;
    // Separate line-ending groups: removing text between a lone CR and LF must
    // not join them into one CRLF and change the parser's source line numbers.
    out += ' ' + (comment.match(/\r\n|[\r\n\u2028\u2029]/g) || []).join(' ');
    cursor = end;
  }
  return out;
}
