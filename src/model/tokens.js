// src/model/tokens.js — the template-token grammar, in ONE leaf module.
//
// `{block}`, `{bleed}`, `{damage.2}`. It lived in validate.js; it moved here so
// model/tree.js (which validate.js imports) can read it without importing
// validate.js back — that cycle left a framework door capturing an undefined
// export mid-evaluation. validate.js re-exports both names, so every existing
// importer is unchanged.
//
// A factory rather than a shared instance on purpose: a `g` regex carries
// `lastIndex`, so one exported object shared across modules is a cross-module
// mutable. Each caller gets its own.
export const TOKEN_PATTERN = '\\{([A-Za-z][\\w.]*)\\}';
export const tokenRe = () => new RegExp(TOKEN_PATTERN, 'g');
