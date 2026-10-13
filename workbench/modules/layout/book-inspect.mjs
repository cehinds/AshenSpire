// workbench/modules/layout/book-inspect.mjs — the Book recipes inspector's markup, as a pure function
// of the selected recipe and the game's catalog. No DOM, so the tests can render an incomplete
// recipe. A field the file lacks (or holds a value the game would refuse) still draws: its colour
// swatch is empty, a "missing" or "invalid" badge says so, and the banner lists the problems the
// game's own check gives (recipeProblems, the bookArtProblems wording). Nothing here fills a value in.
import * as K from './book-model.mjs';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Whether the file gives a field a value at all (an empty string is no value). */
export const isSet = (v) => v !== undefined && v !== null && v !== '';

/**
 * The state of one field of a recipe: 'missing' (the file has no value), 'invalid' (a value the
 * game would refuse, once the catalog is known) or 'ok'.
 */
export function fieldStateOf(recipe, field, catalog) {
  const v = recipe?.[field];
  if (!isSet(v)) return 'missing';
  return K.catalogReady(catalog) && K.fieldProblems(field, v, catalog).length ? 'invalid' : 'ok';
}

const badgeOf = (state) => (state === 'ok' ? '' : ` <em class="lay-hint is-error">${state}</em>`);

/** A colour swatch: the colour when it is a six-digit hex colour, otherwise an empty dashed one. */
export function swatchHtml(color) {
  if (typeof color === 'string' && HEX_RE.test(color)) return `<span class="bk-swatch" style="--swatch: ${color}" aria-hidden="true"></span>`;
  return '<span class="bk-swatch" style="background: none; border-style: dashed" aria-label="No colour set" title="No colour set"></span>';
}

/** The banner of problems for one recipe, or '' when it is valid. Waits for the catalog, so a choice is not blamed before the game's list is known. */
export function problemsHtml(recipe, catalog) {
  if (!recipe) return '';
  if (!K.catalogReady(catalog)) return '<p class="lay-note">The recipe is checked once the game server answers.</p>';
  const problems = K.recipeProblems(recipe, catalog);
  if (!problems.length) return '';
  return `<div class="lay-hint is-error bk-banner"><strong>${problems.length} ${problems.length === 1 ? 'problem' : 'problems'} in this recipe</strong><ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul><p class="lay-note">Set the missing values below. Only the values you set are written.</p></div>`;
}

/** The inspector's markup for one book. Each field shows its control, its state, and nothing it does not hold. */
export function inspectorHtml({ bookId, bookName, recipe, catalog, editable = false, error = null }) {
  if (!recipe) return error ? `<p class="lay-hint is-error">${esc(error)}</p>` : '<p class="lay-note">Pick a book to edit its recipe.</p>';
  const dis = editable ? '' : ' disabled';

  const choice = (field, options, label = (v) => v) => {
    const value = recipe[field];
    const unset = !options.includes(value);
    const head = unset ? `<option value="" selected disabled>${esc(isSet(value) ? `${value}: not a choice` : 'Choose one')}</option>` : '';
    const list = options.map((o) => `<option value="${esc(o)}"${o === value ? ' selected' : ''}>${esc(label(o))}</option>`).join('');
    return `<div class="lay-row"><code>${esc(field)}</code><span><select data-bk-field="${esc(field)}"${dis}>${head}${list}</select>${badgeOf(fieldStateOf(recipe, field, catalog))}</span></div>`;
  };

  const colour = (field) => {
    const value = recipe[field];
    const valid = typeof value === 'string' && HEX_RE.test(value);
    // The picker shows black only as a place to start; nothing is written until the user picks.
    return `<div class="lay-row"><code>${esc(field)}</code><span>${swatchHtml(valid ? value : null)} <input type="color" data-bk-colour="${esc(field)}" value="${valid ? value.toLowerCase() : '#000000'}" aria-label="${esc(field)} colour"${dis}> <input type="text" data-bk-field="${esc(field)}" value="${esc(isSet(value) ? value : '')}" placeholder="#rrggbb" size="8" maxlength="7"${dis}>${badgeOf(fieldStateOf(recipe, field, catalog))}</span></div>`;
  };

  return `<h3>${esc(bookName || bookId)}</h3>
      <p class="lay-note">${esc(bookId)} in ${esc(K.RECIPES_FILE)}</p>
      ${problemsHtml(recipe, catalog)}
      ${choice('cover', catalog.cover)}
      ${colour('color')}
      ${choice('symbol', catalog.symbol)}
      ${choice('treatment', catalog.treatment, (v) => `${v} (${K.TREATMENT_LABELS[v] || v})`)}
      ${colour('ink')}
      ${choice('trim', catalog.trim)}
      <p class="lay-note">${editable ? 'Only the values you change are written. Save with Review changes.' : 'Edits are off until the game server answers.'}</p>`;
}
