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
  const NUM = '-?\\d+(?:\\.\\d+)?';
  const PX_PART = NUM + 'px';
  const COLOR_PART = '(?:#[0-9a-fA-F]{3,8}|transparent|(?:rgba?|hsla?)\\([^()]*\\)|[a-zA-Z]+)';
  const LEN_RE = new RegExp('^' + NUM + '(?:px|%|rem|em)$');
  const PX_RE = new RegExp('^' + PX_PART + '$');
  const COLOR_RE = new RegExp('^' + COLOR_PART + '$');
  const SHADOW_TEXT_RE = new RegExp('^none$|^(' + PX_PART + ') (' + PX_PART + ') (' + PX_PART + ') (' + COLOR_PART + ')$');
  const SHADOW_BOX_RE = new RegExp('^none$|^(' + PX_PART + ') (' + PX_PART + ') (' + PX_PART + ') (' + PX_PART + ') (' + COLOR_PART + ')$');
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

  // Returns a message when value does not satisfy the binding's contract type, otherwise null.
  function checkValue(binding, value) {
    if (typeof value !== 'string') return 'value must be a string';
    if (FORBIDDEN.test(value)) return 'value contains a forbidden character or function';
    switch (binding.type) {
      case 'shadow':
        return (binding.order === 'box' ? SHADOW_BOX_RE : SHADOW_TEXT_RE).test(value) ? null : 'not a valid shadow';
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
    for (const [token, b] of Object.entries(bindings.tokens)) {
      if (!/^--hud-[a-z-]+$/.test(token)) problems.push(`${token}: not a --hud- token name`);
      if (!TYPES.includes(b.type)) problems.push(`${token}: unknown type ${b.type}`);
      if (!findNode(scene, b.node)) problems.push(`${token}: node ${b.node} does not exist`);
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
        const lengths = binding.order === 'box' ? [raw.x, raw.y, raw.blur, raw.spread] : [raw.x, raw.y, raw.blur];
        return [...lengths.map(v => cssPx(numberOr(v) * SCALE)), raw.color || '#000000'].join(' ');
      }
      case 'length':
        if (raw === null) return '0px';
        if (typeof raw !== 'number') throw new Error(`${token}: source must be a number`);
        return cssPx(raw * SCALE);
      case 'length-or-none':
        if (raw === null || raw === 'none') return 'none';
        if (typeof raw !== 'number') throw new Error(`${token}: source must be a number or none`);
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

  // Tokens for one form factor. Only tokens explicitly set in the scene data or changed from the seed are emitted.
  function exportTokens(scene, seed, bindings, formFactor, options = {}) {
    checkFormFactor(formFactor);
    const state = options.state || defaultState(scene);
    const tokens = {};
    for (const [token, binding] of Object.entries(bindings.tokens)) {
      const node = findNode(scene, binding.node);
      if (!node) throw new Error(`${token}: node ${binding.node} does not exist`);
      if (binding.type === 'px') {
        const seedNode = findNode(seed || scene, binding.node);
        const offset = resolveNode(node, state, formFactor)[binding.axis] - seedNode[binding.axis];
        const explicit = !!(node.formFactors && node.formFactors[formFactor] && node.formFactors[formFactor][binding.axis] !== undefined);
        if (offset === 0 && !explicit) continue;
        tokens[token] = cssWhole(offset * SCALE);
      } else {
        const raw = readPath(resolveNode(node, state, formFactor), binding.path);
        if (raw === undefined) continue;
        const value = formatStyle(token, binding, raw);
        if (value === undefined) continue;
        tokens[token] = value;
      }
      const problem = checkValue(binding, tokens[token]);
      if (problem) throw new Error(`${token}: ${problem} (${tokens[token]})`);
    }
    return tokens;
  }

  function buildFile(formFactor, tokens) {
    checkFormFactor(formFactor);
    return { format: FORMAT, formFactor, source: SOURCE, tokens };
  }

  // Reads an exported file and returns the node property writes it implies for its form factor.
  function importTokens(file, scene, seed, bindings, options = {}) {
    if (!isObject(file) || file.format !== FORMAT) throw new Error(`Expected format ${FORMAT}`);
    if (file.source !== SOURCE) throw new Error(`Expected source ${SOURCE}`);
    checkFormFactor(file.formFactor);
    if (!isObject(file.tokens)) throw new Error('tokens must be an object');
    const formFactor = file.formFactor;
    const state = options.state || defaultState(scene);
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
      const problem = checkValue(binding, value);
      if (problem) throw new Error(`${token}: ${problem} (${value})`);
      const node = findNode(scene, binding.node);
      const seedNode = findNode(seed || scene, binding.node);
      if (!node) throw new Error(`${token}: node ${binding.node} does not exist`);
      if (binding.type === 'px') {
        const design = Math.round(parseFloat(value) / SCALE);
        setPatch(binding.node, binding.axis, undefined, seedNode[binding.axis] + design);
        continue;
      }
      const [key, sub] = binding.path.split('.');
      const current = readPath(resolveNode(node, state, formFactor), key);
      let parsed;
      if (binding.type === 'shadow') {
        if (value === 'none') parsed = null;
        else {
          const re = binding.order === 'box' ? SHADOW_BOX_RE : SHADOW_TEXT_RE;
          const m = value.match(re);
          if (binding.order === 'box') parsed = { x: round2(parseFloat(m[1]) / SCALE), y: round2(parseFloat(m[2]) / SCALE), blur: round2(parseFloat(m[3]) / SCALE), spread: round2(parseFloat(m[4]) / SCALE), color: m[5] };
          else parsed = { x: round2(parseFloat(m[1]) / SCALE), y: round2(parseFloat(m[2]) / SCALE), blur: round2(parseFloat(m[3]) / SCALE), color: m[4] };
        }
      } else if (binding.type === 'length' || (binding.type === 'length-or-none' && value !== 'none')) {
        if (!/px$/.test(value)) throw new Error(`${token}: import needs px units`);
        parsed = round2(parseFloat(value) / SCALE);
      } else if (binding.type === 'length-or-none') {
        parsed = 'none';
      } else {
        parsed = value;
      }
      setPatch(binding.node, key, sub, parsed, sub === undefined ? undefined : readPath(resolveNode(node, state, formFactor), key));
    }
    return { formFactor, patches: [...patches.values()] };
  }

  const api = {
    FORMAT, BINDINGS_FORMAT, SOURCE, FORM_FACTORS, SCALE,
    resolveNode, readPath, checkValue, checkBindings, exportTokens, buildFile, importTokens
  };

  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else global.HudCssExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
