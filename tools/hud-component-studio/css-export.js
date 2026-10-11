/* AshenSpire HUD CSS token export. Pure data logic: no DOM, no dependencies.
 * Browser: loaded with a script tag before studio.js; exposes window.HudCssExport.
 * Node: require('./css-export.js') returns the same API (module.exports).
 * Maps scene nodes to contract tokens (css-bindings.json) and back. Contract:
 * docs/hud-layout-tokens.md. */
(function (global) {
  'use strict';

  const FORMAT = 'ashenspire-hud-layout/1';
  const BINDINGS_FORMAT = 'ashenspire-hud-css-bindings/1';
  const SOURCE = 'hud-component-studio';
  const FORM_FACTORS = ['mobile', 'tablet', 'desktop', 'widescreen'];
  const SCALE = 390 / 512;
  const TYPES = ['shadow', 'color', 'length', 'length-or-none', 'px', 'font', 'keyword'];
  const FORBIDDEN = /[;{}<]|url\(|expression\(/i;
  const NUM = '-?(?:\\d+|\\d*\\.\\d+)';
  const COLOR_PART = '(?:#[0-9a-fA-F]{3,8}|transparent|(?:rgba?|hsla?)\\([^()]*\\)|[a-zA-Z]+)';
  // The same value shapes the game's validator accepts (tools/hud-layout-tokens.mjs):
  // a length may be a unitless 0, and a shadow is a comma-separated list of layers.
  const LEN_RE = new RegExp('^(?:' + NUM + '(?:px|%|rem|em)|0)$');
  const SHADOW_LEN_RE = new RegExp('^(?:' + NUM + '(?:px|rem|em)|0)$');
  const PX_RE = new RegExp('^' + NUM + 'px$');
  const COLOR_RE = new RegExp('^' + COLOR_PART + '$');
  const FONT_RE = /^[A-Za-z0-9 ,'"\-]+$/;

  const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const round2 = v => Math.round(v * 100) / 100 + 0;
  const cssPx = v => round2(v) + 'px';
  const cssWhole = v => Math.round(v) + 0 + 'px';
  const numberOr = (v, fallback = 0) => (Number.isFinite(Number(v)) && v !== null && v !== undefined && v !== '' ? Number(v) : fallback);

  function findNode(scene, id) {
    return (scene.nodes || []).find(n => n.id === id);
  }

  // Effective value of a node for one state and one form factor: base, then state, then form factor.
  function resolveNode(node, state, formFactor) {
    const stateProps = (node.states && node.states[state]) || {};
    const ffProps = (node.formFactors && node.formFactors[formFactor]) || {};
    return { ...node, ...stateProps, ...ffProps };
  }

  // Reads a dotted path. A null ancestor (cleared object) reads as null; a missing one as undefined.
  function readPath(object, path) {
    let current = object;
    for (const key of path.split('.')) {
      if (current === null) return null;
      if (current === undefined) return undefined;
      current = current[key];
    }
    return current;
  }

  function checkFormFactor(formFactor) {
    if (!FORM_FACTORS.includes(formFactor)) throw new Error(`Unknown form factor "${formFactor}"`);
  }

  function defaultState(scene) {
    return scene.defaultState || (scene.states && scene.states[0] && scene.states[0].id);
  }

  // The view a binding reads: where its component is shown (css-bindings.json `state`).
  function bindingState(binding, scene, options = {}) {
    return binding.state || options.state || defaultState(scene);
  }

  // Splits on separator characters outside parentheses.
  function splitTop(text, isSep) {
    const parts = [];
    let depth = 0, current = '';
    for (const ch of text) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (depth === 0 && isSep(ch)) { parts.push(current); current = ''; continue; }
      current += ch;
    }
    parts.push(current);
    return parts.map(part => part.trim());
  }

  // One shadow layer: { inset, lengths: [css px number, or NaN for rem/em], color } or null when invalid.
  function parseShadowLayer(layer) {
    const words = splitTop(layer, ch => /\s/.test(ch)).filter(Boolean);
    const rest = words.filter(word => word !== 'inset');
    if (words.length - rest.length > 1) return null;
    const lengths = rest.filter(word => SHADOW_LEN_RE.test(word));
    const colors = rest.filter(word => !SHADOW_LEN_RE.test(word));
    if (lengths.length < 2 || lengths.length > 4 || colors.length > 1 || !colors.every(c => COLOR_RE.test(c))) return null;
    return { inset: rest.length !== words.length,
      lengths: lengths.map(word => (word === '0' ? 0 : /px$/.test(word) ? parseFloat(word) : NaN)), color: colors[0] };
  }

  function isShadow(value) {
    return value === 'none' || splitTop(value, ch => ch === ',').every(layer => parseShadowLayer(layer) !== null);
  }

  const shadowKeys = binding => (binding.order === 'box' ? ['x', 'y', 'blur', 'spread'] : ['x', 'y', 'blur']);

  // The studio's single-layer shadow object (design px) for the first layer of a CSS shadow list.
  function shadowObject(binding, value) {
    const first = parseShadowLayer(splitTop(value, ch => ch === ',')[0]);
    const parsed = {};
    shadowKeys(binding).forEach((key, i) => {
      const css = first.lengths[i];
      parsed[key] = round2(Number.isFinite(css) ? css / SCALE : 0);
    });
    parsed.color = first.color || '#000000';
    return { parsed, inset: first.inset };
  }

  // Returns a message when value does not satisfy the binding's contract type, otherwise null.
  function checkValue(binding, value) {
    if (typeof value !== 'string') return 'value must be a string';
    if (FORBIDDEN.test(value)) return 'value contains a forbidden character or function';
    switch (binding.type) {
      case 'shadow':
        return isShadow(value) ? null : 'not a valid shadow';
      case 'color':
        return COLOR_RE.test(value) ? null : 'not a valid color';
      case 'length':
        return LEN_RE.test(value) ? null : 'not a valid length';
      case 'length-or-none':
        return value === 'none' || LEN_RE.test(value) ? null : 'not a valid length or none';
      case 'px':
        return PX_RE.test(value) ? null : 'not a valid signed px value';
      case 'font':
        return FONT_RE.test(value) ? null : 'not a valid font-family list';
      case 'keyword':
        return (binding.values || []).includes(value) ? null : `not one of ${(binding.values || []).join(', ')}`;
      default:
        return `unknown contract type ${binding.type}`;
    }
  }

  // Structural check of css-bindings.json against the scene graph. Returns a list of problems.
  function checkBindings(bindings, scene) {
    const problems = [];
    if (!bindings || bindings.format !== BINDINGS_FORMAT || !isObject(bindings.tokens)) return ['Bindings must declare format ' + BINDINGS_FORMAT + ' and a tokens object'];
    const states = new Set((scene.states || []).map(s => s.id));
    for (const [token, b] of Object.entries(bindings.tokens)) {
      if (!/^--hud-[a-z-]+$/.test(token)) problems.push(`${token}: not a --hud- token name`);
      if (!TYPES.includes(b.type)) problems.push(`${token}: unknown type ${b.type}`);
      if (!findNode(scene, b.node)) problems.push(`${token}: node ${b.node} does not exist`);
      if (b.state !== undefined && !states.has(b.state)) problems.push(`${token}: view ${b.state} does not exist`);
      if (b.type === 'px') {
        if (b.axis !== 'x' && b.axis !== 'y') problems.push(`${token}: px tokens need axis x or y`);
      } else if (typeof b.path !== 'string' || !b.path) {
        problems.push(`${token}: missing property path`);
      } else {
        const top = b.path.split('.')[0];
        const known = findNode(scene, b.node);
        if (known && !(top in known) && !['textShadow', 'textBacking', 'shadow', 'minWidth', 'maxWidth', 'span'].includes(top)) {
          problems.push(`${token}: ${b.node} has no property ${top}`);
        }
      }
      if (b.type === 'shadow' && !['text', 'box'].includes(b.order)) problems.push(`${token}: shadow needs order text or box`);
      if (b.type === 'keyword' && !(Array.isArray(b.values) && b.values.length)) problems.push(`${token}: keyword needs values`);
    }
    return problems;
  }

  function formatStyle(token, binding, raw) {
    switch (binding.type) {
      case 'shadow': {
        if (raw === null) return 'none';
        if (!isObject(raw)) throw new Error(`${token}: source must be a shadow object`);
        const keys = shadowKeys(binding);
        const simple = [...keys.map(k => cssPx(numberOr(raw[k]) * SCALE)), raw.color || '#000000'].join(' ');
        // An imported shadow keeps its CSS text (`css`): extra layers, inset, rem/em lengths.
        // Untouched, it exports verbatim; once its first layer is edited, the edit
        // replaces that layer and the other layers are kept.
        if (typeof raw.css === 'string' && isShadow(raw.css) && raw.css !== 'none') {
          const { parsed, inset } = shadowObject(binding, raw.css);
          const same = keys.every(k => round2(numberOr(raw[k])) === parsed[k]) && (raw.color || '#000000') === parsed.color;
          if (same) return raw.css;
          return [(inset ? 'inset ' : '') + simple, ...splitTop(raw.css, ch => ch === ',').slice(1)].join(', ');
        }
        return simple;
      }
      case 'length':
        if (raw === null) return '0px';
        if (typeof raw === 'string' && LEN_RE.test(raw)) return raw;
        if (typeof raw !== 'number') throw new Error(`${token}: source must be a number`);
        return cssPx(raw * SCALE);
      case 'length-or-none':
        if (raw === null || raw === 'none') return 'none';
        // A CSS length the canvas cannot express in design px (48%, 20rem) is kept as text.
        if (typeof raw === 'string' && LEN_RE.test(raw)) return raw;
        if (typeof raw !== 'number') throw new Error(`${token}: source must be a number, a CSS length or none`);
        return cssPx(raw * SCALE);
      case 'color':
        if (raw === null || raw === 'none') return 'transparent';
        return String(raw);
      case 'font':
      case 'keyword':
        if (raw === null) return undefined;
        return String(raw);
      default:
        throw new Error(`${token}: unknown type ${binding.type}`);
    }
  }

  // The token's value in the scene and in the untouched seed (undefined when not set).
  function tokenValues(token, binding, scene, reference, formFactor, options) {
    const state = bindingState(binding, scene, options);
    const node = findNode(scene, binding.node);
    if (!node) throw new Error(`${token}: node ${binding.node} does not exist`);
    const seedNode = findNode(reference, binding.node);
    if (!seedNode) throw new Error(`${token}: node ${binding.node} does not exist in the seed`);
    if (binding.type === 'px') {
      const offset = resolveNode(node, state, formFactor)[binding.axis] - resolveNode(seedNode, state)[binding.axis];
      return { value: cssWhole(offset * SCALE), seedValue: '0px' };
    }
    const raw = readPath(resolveNode(node, state, formFactor), binding.path);
    const value = raw === undefined ? undefined : formatStyle(token, binding, raw);
    const seedRaw = readPath(resolveNode(seedNode, state), binding.path);
    const seedValue = seedRaw === undefined ? undefined : formatStyle(token, binding, seedRaw);
    return { value, seedValue };
  }

  // Tokens for one form factor. A token is written only when the scene's value differs from the
  // untouched seed (the seed's values in the binding's view, with no form factor overrides).
  // Export-settings values (minWidth, maxWidth, span) count as set when the scene sets them, so an
  // untouched seed exports {} for every form factor and the game keeps its tuned content values.
  // A token in the form factor's import baseline (scene.cssBaseline, set by importing a committed
  // file) whose value is back at the seed exports null: --merge then removes that override.
  // Without an import there is no baseline and null is never written.
  function exportTokens(scene, seed, bindings, formFactor, options = {}) {
    checkFormFactor(formFactor);
    const reference = seed || scene;
    const baseline = new Set((scene.cssBaseline && scene.cssBaseline[formFactor]) || []);
    const tokens = {};
    for (const [token, binding] of Object.entries(bindings.tokens)) {
      const { value, seedValue } = tokenValues(token, binding, scene, reference, formFactor, options);
      if (value === undefined || value === seedValue) {
        if (baseline.has(token)) tokens[token] = null;
        continue;
      }
      const problem = checkValue(binding, value);
      if (problem) throw new Error(`${token}: ${problem} (${value})`);
      tokens[token] = value;
    }
    return tokens;
  }

  function buildFile(formFactor, tokens) {
    checkFormFactor(formFactor);
    return { format: FORMAT, formFactor, source: SOURCE, tokens };
  }

  // Reads an exported file and returns the node property writes it implies for its form factor.
  // A null value (remove the override) writes the seed's value back.
  function importTokens(file, scene, seed, bindings, options = {}) {
    if (!isObject(file) || file.format !== FORMAT) throw new Error(`Expected format ${FORMAT}`);
    if (file.source !== SOURCE) throw new Error(`Expected source ${SOURCE}`);
    checkFormFactor(file.formFactor);
    if (!isObject(file.tokens)) throw new Error('tokens must be an object');
    const formFactor = file.formFactor;
    const patches = new Map();
    const setPatch = (nodeId, key, sub, value, current) => {
      const id = nodeId + '\u0000' + key;
      const entry = patches.get(id) || { node: nodeId, formFactor, key, value: undefined };
      if (sub === undefined) entry.value = value;
      else {
        const base = entry.value !== undefined ? entry.value : current;
        entry.value = { ...(isObject(base) ? base : {}), [sub]: value };
      }
      patches.set(id, entry);
    };
    for (const [token, value] of Object.entries(file.tokens)) {
      const binding = bindings.tokens[token];
      if (!binding) throw new Error(`Unknown token ${token}`);
      if (value !== null) {
        const problem = checkValue(binding, value);
        if (problem) throw new Error(`${token}: ${problem} (${value})`);
      }
      const state = bindingState(binding, scene, options);
      const node = findNode(scene, binding.node);
      const seedNode = findNode(seed || scene, binding.node);
      if (!node) throw new Error(`${token}: node ${binding.node} does not exist`);
      if (binding.type === 'px') {
        const design = value === null ? 0 : Math.round(parseFloat(value) / SCALE);
        setPatch(binding.node, binding.axis, undefined, resolveNode(seedNode, state)[binding.axis] + design);
        continue;
      }
      const [key, sub] = binding.path.split('.');
      let parsed;
      if (value === null) {
        parsed = readPath(resolveNode(seedNode, state), binding.path);
        if (parsed === undefined) parsed = null;
      } else if (binding.type === 'shadow') {
        if (value === 'none') parsed = null;
        else {
          parsed = shadowObject(binding, value).parsed;
          // Keep the CSS text when one design-px layer cannot say it exactly.
          if (formatStyle(token, binding, parsed) !== value) parsed.css = value;
        }
      } else if (binding.type === 'length' || (binding.type === 'length-or-none' && value !== 'none')) {
        if (value === '0') parsed = 0;
        else if (/px$/.test(value)) parsed = round2(parseFloat(value) / SCALE);
        else if (binding.type === 'length-or-none') parsed = value;
        else throw new Error(`${token}: import needs px units or 0 (${value})`);
      } else if (binding.type === 'length-or-none') {
        parsed = 'none';
      } else {
        parsed = value;
      }
      setPatch(binding.node, key, sub, parsed, sub === undefined ? undefined : readPath(resolveNode(node, state, formFactor), key));
    }
    return { formFactor, patches: [...patches.values()] };
  }

  // Applies an import plan the way the studio does: a Mobile value is the base value for every
  // view; a Tablet/Desktop/Widescreen value is that form factor's override.
  function applyImportPlan(scene, plan) {
    for (const p of plan.patches) {
      const n = findNode(scene, p.node);
      if (!n) continue;
      if (p.formFactor === 'mobile') {
        n[p.key] = p.value;
        for (const s of Object.values(n.states || {})) delete s[p.key];
      } else {
        n.formFactors = n.formFactors || {};
        n.formFactors[p.formFactor] = n.formFactors[p.formFactor] || {};
        n.formFactors[p.formFactor][p.key] = p.value;
      }
    }
  }

  // Imports a file into scene (mutating it) and records its tokens as the form factor's baseline:
  // a token the file sets to something other than the seed is a committed override, so resetting
  // it later exports null. Returns the plan.
  function importFile(file, scene, seed, bindings, options = {}) {
    const plan = importTokens(file, scene, seed, bindings, options);
    applyImportPlan(scene, plan);
    const ff = plan.formFactor;
    const prior = new Set((scene.cssBaseline && scene.cssBaseline[ff]) || []);
    const set = exportTokens({ ...scene, cssBaseline: undefined }, seed, bindings, ff, options);
    for (const token of Object.keys(file.tokens)) {
      if (set[token] !== undefined && set[token] !== null) prior.add(token);
      else prior.delete(token);
    }
    scene.cssBaseline = { ...(scene.cssBaseline || {}), [ff]: [...prior] };
    return plan;
  }

  // The Inspector note for a token-bound node edited on Mobile with Edit all views off in a view
  // other than the one its token is exported from. Returns null when the edit exports.
  function exportViewNote({ scene, bindings, nodeId, stateId, formFactor, allViews }) {
    if (formFactor !== 'mobile' || allViews || !bindings) return null;
    for (const binding of Object.values(bindings.tokens)) {
      if (binding.node !== nodeId) continue;
      const state = bindingState(binding, scene);
      if (state === stateId) continue;
      const view = (scene.states || []).find(s => s.id === state);
      return `Exports from ${view ? view.name : state}`;
    }
    return null;
  }

  const api = {
    FORMAT, BINDINGS_FORMAT, SOURCE, FORM_FACTORS, SCALE,
    resolveNode, readPath, checkValue, checkBindings, exportTokens, buildFile, importTokens,
    applyImportPlan, importFile, exportViewNote
  };

  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else global.HudCssExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
