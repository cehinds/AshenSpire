/** Compare LF-canonical generated UTF-8 text with its checked-out form. */
export function normalizeLfText(text) {
  return text.replace(/\r\n/g, '\n');
}

export function sameLfCanonicalText(workingText, expectedText) {
  return normalizeLfText(workingText) === expectedText;
}
