// tools/asset-css.mjs — the web edition's CSS assets, moved out of the inlined
// <style> into the ASSET_CSS template (docs/EXTERNAL-ASSETS-PLAN.md §3.7,
// step 3b).
//
// THE PROBLEM. The stylesheets name 29 asset url()s: 15 "AS Lore" @font-face
// faces, 10 backdrop uses (9 ids) and 4 mask uses (2 SVGs). The single file
// inlines each as a data: URI. In the pack shape (step 3a) the bundler pointed
// each straight at the DEFAULT tier's object, which bypassed the loader: a
// high-default build whose high index failed still asked for high objects, and
// a failed load still asked for objects that may not be there.
//
// THE SHAPE, used only by tools/bundle.mjs --external-art:
//   · each @font-face block that names a url() leaves the stylesheet whole and
//     becomes one template rule, its url() a `{{id}}` slot;
//   · every other url() stays WHERE IT IS in the cascade but names a custom
//     property, `var(--as-css-<id>, none)`, and one template rule per id
//     defines it: `:root{--as-css-<id>:url("{{id}}")}`. Moving the backdrop
//     rules into a later <style> would change which rule wins (`.startup-gate`
//     is restated with `background: #100e0b` further down kit.css); a variable
//     leaves every selector and its order exactly as authored. Unset, the
//     variable falls back to `none`, which is what a backdrop that never loaded
//     shows anyway;
//   · an SVG url() (the two masks) is inlined as a data: URI from the object,
//     as the single file does. A mask loads in CORS mode, which Chromium refuses
//     for file: URLs, and a failed mask is transparent (§3.7), so the masks
//     never depend on the load.
// src/ui/assetPacks.js fills the slots from the index the loader actually used
// (the light one when high failed) and injects the rules as one <style>; a
// failed load injects nothing and the CSS stays on its fallbacks (no backdrop,
// the system faces the font-family stacks already name). A rule whose id the
// loaded index lacks is left out on its own.

/** A url() in CSS: quote, then the reference (the same pattern bundle.mjs inlines with). */
export const CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
/** A `{{id}}` slot in an ASSET_CSS rule. */
export const SLOT = /\{\{([^{}]+)\}\}/g;
/** The custom-property prefix the backdrop url()s are replaced with. */
export const VAR_PREFIX = '--as-css-';
/** The properties a url() may be turned into `var(…, none)` in: `none` is a valid layer there. */
const VAR_PROPERTIES = new Set(['background', 'background-image']);

/** The custom property an id's url() is read through: --as-css-bg-bg_act1-webp. */
export function cssVarName(id) {
  return VAR_PREFIX + String(id).replace(/^assets\//, '').replace(/[^A-Za-z0-9_-]/g, '-');
}

// THE RULE FOR A url() THAT NAMES NO FILE, shared with verify-external D: an
// authored data: URI, a remote url and a fragment are left exactly as written
// (nothing to load through the index); verify-external B still refuses a large
// non-SVG base64 payload, wherever it sits.
const external = (ref) => /^(data:|https?:|\/\/|#)/i.test(ref);

// What can hide a `{`, `}` or `;` that does not end a declaration: a comment,
// a quoted string, and a url() (an unquoted `data:…;base64` has a `;` in it).
const OPAQUE = /\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|url\([^)]*\)/g;

/**
 * The CSS property a declaration at `offset` belongs to, or '' when it cannot
 * be read. Comments, strings and url()s before it are blanked first (same
 * length, so the offset holds), so their `;` or `{` is not taken for the
 * declaration's start.
 */
export function propertyAt(css, offset) {
  const before = css.slice(0, offset).replace(OPAQUE, (m) => ' '.repeat(m.length));
  const start = Math.max(before.lastIndexOf('{'), before.lastIndexOf(';'), before.lastIndexOf('}')) + 1;
  const m = /^\s*([-a-zA-Z]+)\s*:/.exec(before.slice(start));
  return m ? m[1].toLowerCase() : '';
}

/**
 * newTemplate() → the accumulator externalizeCss() fills, shared by every
 * stylesheet of one build so an id named twice gets one variable.
 */
export function newTemplate() {
  return { rules: [], vars: new Map(), names: new Map(), urls: 0, inlined: 0 };
}

/**
 * externalizeCss(css, { idFor, inlineData, template }) → the stylesheet to
 * inline, with its asset url()s moved into `template`.
 *   idFor(ref)       → the `assets/…` id a url() names (throws when it names none)
 *   inlineData(id)   → the data: URI for an SVG id (the masks)
 * Throws when a url() sits where a `var(…, none)` would change its meaning.
 */
export function externalizeCss(css, { idFor, inlineData, template }) {
  const slot = (block) => block.replace(CSS_URL, (whole, _q, ref) => {
    if (external(ref)) return whole;
    template.urls += 1;
    return `url("{{${idFor(ref)}}}")`;
  });
  // 1. Every @font-face that names a file leaves the sheet whole. Its order
  //    among the others does not matter: no two name the same face.
  const withoutFaces = css.replace(/@font-face\s*\{[^{}]*\}/g, (block) => {
    if (![...block.matchAll(CSS_URL)].some((m) => !external(m[2]))) return block;
    template.rules.push(slot(block).replace(/\s*\n\s*/g, ' '));
    return '';
  });
  // 2. Every other url() stays in place: a mask is inlined, a backdrop reads a variable.
  return withoutFaces.replace(CSS_URL, (whole, _q, ref, offset, all) => {
    if (external(ref)) return whole;
    const id = idFor(ref);
    template.urls += 1;
    if (/\.svg$/i.test(id)) {
      template.inlined += 1;
      return `url("${inlineData(id)}")`;
    }
    const prop = propertyAt(all, offset);
    if (!prop) {
      throw new Error(`the CSS property that names ${id} could not be read; only ${[...VAR_PROPERTIES].join(' and ')} may name a raster asset in the web edition, and this one cannot be shown to be either`);
    }
    if (!VAR_PROPERTIES.has(prop)) {
      throw new Error(`a CSS url() for ${id} sits in "${prop}", where var(…, none) is not a safe stand-in; only ${[...VAR_PROPERTIES].join(' and ')} may name a raster asset in the web edition`);
    }
    const name = cssVarName(id);
    const owner = template.names.get(name);
    if (owner && owner !== id) throw new Error(`${id} and ${owner} would share the CSS variable ${name}`);
    if (!owner) {
      template.names.set(name, id);
      template.vars.set(id, name);
      template.rules.push(`:root{${name}:url("{{${id}}}")}`);
    }
    return `var(${name}, none)`;
  });
}

/** The ASSET_CSS value the bundler stamps: null when no stylesheet named an asset. */
export function templateValue(template) {
  return template.rules.length ? { schema: 1, rules: [...template.rules] } : null;
}

/** Every id the template's slots name, in order of first use. */
export function slotIds(value) {
  const ids = new Set();
  for (const rule of (value && Array.isArray(value.rules) ? value.rules : [])) {
    for (const m of String(rule).matchAll(SLOT)) ids.add(m[1]);
  }
  return [...ids];
}
