// The Blacksmith's choice (W25 steps 4-5): two or three rolled options for one item upgrade, or the properties to
// keep when a weapon changes category. One dialog, one tile per option (the uniform card-option tiles), the price
// beside the title, Cancel changes nothing. `onChoose(optionId)` runs once, after the dialog closes.
// The design is the defensive-reaction prompt's (owner, 2026-11-14): option rows, a Cancel exit and one primary
// button that stays disabled until a row is selected; a tap selects, the primary commits.
import { openModal, button } from '../kit/index.js';
import { t } from '../strings.js';
import { optionRowList, markOptionRows } from './optionRowList.js';

/**
 * OpenSmithOptionsModal({ title, eyebrow, price, options, opener, onChoose, onClosed }) -> the modal shell.
 * `options` are { id, name, text, disabled? }; `price` is the line that says what the work costs.
 */
export function OpenSmithOptionsModal({ title, eyebrow = '', price = '', options, opener = document.activeElement, onChoose, onClosed = null }) {
  let chosen = null;
  let selected = null;
  let bodyHost = null;
  const cancel = button({ label: t('common.cancel'), role: 'exit', attrs: { 'data-focusable': 'true' } });
  const commit = button({ label: t('common.choose'), weight: 'primary', disabled: true, attrs: { 'data-focusable': 'true' } });
  const shell = openModal({
    size: 'md',
    className: 'option-choice smith-options',
    opener,
    eyebrow,
    title,
    closeLabel: t('common.cancel'),
    bodyClassName: 'as-pane card-choice-body',
    deferFocus: true,
    initialFocus: () => [...(bodyHost?.querySelectorAll('[data-smith-option]') || [])].find((row) => !row.disabled) || null,
    body: (host) => {
      bodyHost = host;
      if (price) host.append(Object.assign(document.createElement('p'), { className: 'smith-options-price', textContent: price }));
      const rows = options.map((option) => ({ id: option.id, className: 'smith-option', name: option.name, text: option.text || '', line: [], costs: [], disabled: !!option.disabled }));
      const list = optionRowList(rows, { idAttr: 'data-smith-option', onSelect: (id, row) => {
        selected = id;
        row?.focus?.({ preventScroll: true });
        markOptionRows(list, 'data-smith-option', [id]);
        commit.disabled = false;
      } });
      host.appendChild(list);
    },
    primary: commit,
    secondary: [cancel],
    footSize: 'short',
    onClose: () => { onClosed?.(); if (chosen != null) onChoose(chosen); },
  });
  commit.addEventListener('click', () => { if (selected == null) return; chosen = selected; shell.close(); });
  cancel.addEventListener('click', shell.close);
  return shell;
}

/**
 * OpenSmithKeepModal({ title, eyebrow, price, rows, limit, quoteFor, opener, onConfirm }) -> the modal shell.
 * `rows` are { key, text } (the old properties); the player toggles up to `limit` of them to keep. `quoteFor(keys)`
 * returns { ok, reason, newProperties: [{ text }] } and is shown live, so the new properties on screen are exactly
 * what Confirm will roll. Cancel changes nothing.
 */
export function OpenSmithKeepModal({ title, eyebrow = '', price = '', rows, limit, quoteFor, opener = document.activeElement, onConfirm }) {
  const keep = new Set(rows.length ? [rows[0].key] : []);
  let confirmed = null;
  const cancel = button({ label: t('common.cancel'), role: 'exit', attrs: { 'data-focusable': 'true' } });
  const confirm = button({ label: t('blacksmith.category.confirm'), weight: 'primary', attrs: { 'data-focusable': 'true' } });
  let bodyHost = null;
  const shell = openModal({
    size: 'md',
    className: 'option-choice smith-options smith-keep',
    opener,
    eyebrow,
    title,
    closeLabel: t('common.cancel'),
    bodyClassName: 'as-pane card-choice-body',
    deferFocus: true,
    initialFocus: () => bodyHost?.querySelector('[data-smith-keep]') || null,
    body: (host) => {
      bodyHost = host;
      const note = (text, cls) => Object.assign(document.createElement('p'), { className: cls, textContent: text });
      host.append(note(price, 'smith-options-price'));
      if (rows.length) host.append(note(t('blacksmith.category.keep', { limit }), 'smith-keep-note'));
      const result = note('', 'smith-keep-result');
      // One list, built once; a tap toggles the property and the marks and the quote repaint (no list rebuild, so focus stays).
      const list = optionRowList(rows.map((row) => ({ id: row.key, className: 'smith-option', name: row.text, text: '', line: [], costs: [] })),
        { idAttr: 'data-smith-keep', onSelect: (key) => { if (keep.has(key)) keep.delete(key); else if (keep.size < limit) keep.add(key); paint(); } });
      host.append(list, result);
      const paint = () => {
        const quote = quoteFor([...keep]);
        markOptionRows(list, 'data-smith-keep', [...keep]);
        const fresh = quote.newProperties.map((row) => row.text);
        result.textContent = quote.ok || quote.newProperties.length
          ? t('blacksmith.category.new', { list: fresh.join('; ') || '-' }) + (quote.ok ? '' : ` ${quote.reason}`)
          : quote.reason;
        confirm.disabled = !quote.ok;
      };
      paint();
    },
    primary: confirm,
    secondary: [cancel],
    footSize: 'short',
    onClose: () => { if (confirmed) onConfirm(confirmed); },
  });
  confirm.addEventListener('click', () => { if (confirm.disabled) return; confirmed = [...keep]; shell.close(); });
  cancel.addEventListener('click', shell.close);
  return shell;
}
