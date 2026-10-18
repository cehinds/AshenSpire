// Host-neutral mechanics runtime. Hosts inject compiled mechanics and the op catalog.
import { evaluate, evaluateRaw } from '../../src/model/formulas.js';
export const MAX_DEPTH = 32;
const PILES = ['draw', 'hand', 'discard', 'exhaust'];
const COMPARATORS = ['<', '<=', '==', '!=', '>=', '>'];
// Values in this language are JSON trees. Object key ordering is not semantic.
const isDeepStrictEqual = (a, b) => {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && isDeepStrictEqual(a[k], b[k]));
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** normalizeState(partial) -> a full state with defaults filled in (a copy). */
export function createState(partial = {}) {
  const state = structuredClone(partial);
  state.entities ||= {};
  for (const entity of Object.values(state.entities)) {
    for (const key of ['hp', 'maxHp', 'block', 'poise', 'sp', 'mp']) entity[key] ??= 0;
    entity.statuses ||= {};
    entity.tags ||= [];
  }
  state.piles ||= {};
  for (const pile of PILES) state.piles[pile] ||= [];
  state.mechanics ||= {};
  state.rng ||= {};
  // SPEC §1: a missing seed reads as 1; seeds are unsigned 32-bit.
  state.rng.seed = Number.isFinite(state.rng.seed) ? state.rng.seed >>> 0 : 1;
  return state;
}

// mulberry32 on a 32-bit seed held in state.rng.seed. Advances the seed.
function nextRandom(state) {
  state.rng.seed = (state.rng.seed + 0x6D2B79F5) >>> 0;
  let t = state.rng.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Defaults declared by a model.schema.json: properties.<key>.default, recursing into object properties.
function schemaDefaults(schema) {
  const out = {};
  for (const [key, prop] of Object.entries(schema?.properties || {})) {
    if (prop && 'default' in prop) out[key] = structuredClone(prop.default);
    else if (prop && prop.properties) {
      const nested = schemaDefaults(prop);
      if (Object.keys(nested).length) out[key] = nested;
    }
  }
  return out;
}

const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// Deep merge: members of `over` win; plain objects merge key by key, anything else replaces.
function mergeDeep(base, over) {
  if (!isPlain(base) || !isPlain(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = k in base ? mergeDeep(base[k], v) : v;
  return out;
}

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

export function createRuntime({ mechanics, ops } = {}) {
  if (!(mechanics instanceof Map)) throw new Error('createRuntime needs mechanics as a Map of slug to mechanic');
  if (!ops?.ops) throw new Error('createRuntime needs the compiled op catalog');
  for (const [name, def] of Object.entries(ops.ops)) {
    if (def.reference === 'portable' && !OPS[name]) throw new Error(`ops.json marks '${name}' portable but the interpreter has no implementation`);
  }

  // ----- name resolution -----
  function splitName(full, what) {
    // Slugs may contain dots, so take the longest known slug prefix.
    for (let i = full.lastIndexOf('.'); i > 0; i = full.lastIndexOf('.', i - 1)) {
      const slug = full.slice(0, i);
      if (mechanics.has(slug)) return { slug, name: full.slice(i + 1) };
    }
    throw new Error(`Unknown ${what} '${full}'`);
  }

  // ----- scope lookup -----
  function lookup(rt, scope, ref) {
    const path = ref.slice(1).split('.');
    if (path[0] === 'state') {
      let cur = rt.state.mechanics[scope.slug];
      for (const key of path.slice(1)) cur = cur == null ? undefined : cur[key];
      if (cur === undefined) throw new Error(`Unresolved ${ref}`);
      return cur;
    }
    if (path[0] === 'model') {
      // The mechanic's own state over the defaults of its model.schema.json.
      const defaults = schemaDefaults(mechanics.get(scope.slug)?.model);
      let cur = mergeDeep(defaults, rt.state.mechanics[scope.slug] || {});
      for (const key of path.slice(1)) cur = cur == null ? undefined : cur[key];
      if (cur === undefined) throw new Error(`Unresolved ${ref}`);
      return cur;
    }
    if (!Object.hasOwn(scope.vars, path[0])) throw new Error(`Unresolved ${ref}`);
    let cur = scope.vars[path[0]];
    for (const key of path.slice(1)) {
      if (cur == null) throw new Error(`Unresolved ${ref}`);
      cur = typeof cur === 'string' && rt.state.entities[cur] ? rt.state.entities[cur][key] : cur[key];
    }
    if (cur === undefined) throw new Error(`Unresolved ${ref}`);
    return cur;
  }

  // Replace every $name string inside a plain structure (formula objects included).
  function substitute(rt, scope, node) {
    if (typeof node === 'string') return node.startsWith('$') ? lookup(rt, scope, node) : node;
    if (Array.isArray(node)) return node.map(n => substitute(rt, scope, n));
    if (node && typeof node === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = substitute(rt, scope, v);
      return out;
    }
    return node;
  }

  function formulaEntity(entity) {
    const statuses = {};
    for (const [id, stacks] of Object.entries(entity.statuses)) statuses[id] = { stacks };
    return { hp: entity.hp, maxHp: entity.maxHp, block: entity.block, mana: entity.mp, maxMana: entity.mpMax ?? entity.mp, statuses };
  }

  function formulaContext(rt, scope) {
    const entities = {};
    for (const [key, entity] of Object.entries(rt.state.entities)) entities[key] = formulaEntity(entity);
    // Names bound in scope that hold an entity ref act as aliases ('target' -> the param value).
    for (const [name, value] of Object.entries(scope.vars)) {
      if (typeof value === 'string' && rt.state.entities[value]) entities[name] = entities[value];
    }
    entities.allEnemies = Object.entries(rt.state.entities).filter(([, e]) => e.tags.includes('enemy')).map(([k]) => entities[k]);
    const ctx = { entities };
    for (const key of ['energySpent', 'cardsPlayedThisTurn']) if (typeof scope.vars[key] === 'number') ctx[key] = scope.vars[key];
    return ctx;
  }

  // ----- values and conditions -----
  function isCondition(node) {
    // SPEC §5 precedence: formulas (f) first; a condition is an object whose single key is a condition key.
    if (!node || typeof node !== 'object' || Array.isArray(node) || 'f' in node) return false;
    const keys = Object.keys(node);
    return keys.length === 1 && ['all', 'any', 'not', 'cmp', 'hasTag', 'hasStatus'].includes(keys[0]);
  }

  function value(rt, scope, node) {
    if (node === null || typeof node === 'number' || typeof node === 'boolean') return node;
    if (typeof node === 'string') return node.startsWith('$') ? lookup(rt, scope, node) : node;
    if (Array.isArray(node)) return node.map(n => value(rt, scope, n));
    if (typeof node === 'object') {
      if (typeof node.f === 'string') return (node.numeric === 'scalar' ? evaluateRaw : evaluate)(substitute(rt, scope, node), formulaContext(rt, scope));
      if (isCondition(node)) return condition(rt, scope, node);
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = value(rt, scope, v);
      return out;
    }
    throw new Error(`Cannot resolve value ${JSON.stringify(node)}`);
  }

  function numberValue(rt, scope, node, what) {
    const v = value(rt, scope, node);
    if (!Number.isFinite(v)) throw new Error(`${what} must be a number, got ${JSON.stringify(v)}`);
    return v;
  }

  function entityKey(rt, scope, ref) {
    const v = typeof ref === 'string' && ref.startsWith('$') ? lookup(rt, scope, ref) : ref;
    if (typeof v !== 'string' || !rt.state.entities[v]) throw new Error(`Unknown entity ref '${typeof ref === 'string' ? ref : JSON.stringify(ref)}'`);
    return v;
  }

  function entityKeys(rt, scope, ref) {
    const v = typeof ref === 'string' && ref.startsWith('$') ? lookup(rt, scope, ref) : ref;
    if (Array.isArray(v)) return v.flatMap(item => entityKeys(rt, scope, item));
    if (v === 'allEnemies' && !rt.state.entities.allEnemies) {
      return Object.entries(rt.state.entities).filter(([, e]) => e.tags.includes('enemy')).map(([k]) => k);
    }
    return [entityKey(rt, scope, v)];
  }

  function condition(rt, scope, c) {
    if ('all' in c) return c.all.every(x => condition(rt, scope, x));
    if ('any' in c) return c.any.some(x => condition(rt, scope, x));
    if ('not' in c) return !condition(rt, scope, c.not);
    if ('cmp' in c) {
      const [op, a, b] = c.cmp;
      if (!COMPARATORS.includes(op)) throw new Error(`Unknown comparator '${op}'`);
      const x = value(rt, scope, a);
      const y = value(rt, scope, b);
      if (!['==', '!='].includes(op) && !(Number.isFinite(x) && Number.isFinite(y))) throw new Error(`cmp ${op} needs two numbers, got ${JSON.stringify(x)} and ${JSON.stringify(y)}`);
      switch (op) {
        case '<': return x < y;
        case '<=': return x <= y;
        case '==': return isDeepStrictEqual(x, y);
        case '!=': return !isDeepStrictEqual(x, y);
        case '>=': return x >= y;
        default: return x > y;
      }
    }
    if ('hasTag' in c) {
      const [ref, tag] = c.hasTag;
      return rt.state.entities[entityKey(rt, scope, ref)].tags.includes(value(rt, scope, tag));
    }
    if ('hasStatus' in c) {
      const [ref, status] = c.hasStatus;
      return (rt.state.entities[entityKey(rt, scope, ref)].statuses[value(rt, scope, status)] || 0) > 0;
    }
    throw new Error(`Unknown condition ${JSON.stringify(c)}`);
  }

  // ----- events -----
  function dispatchEvent(rt, name, payload) {
    rt.events.push({ name, payload });
    for (const [slug, mechanic] of mechanics) {
      for (const handler of mechanic.service.handlers || []) {
        if (handler.on === `event.${name}`) runHandler(rt, slug, handler, { ...payload });
      }
    }
  }

  // ----- handlers and steps -----
  function runHandler(rt, slug, handler, params) {
    if (rt.depth >= MAX_DEPTH) throw new Error(`Recursion depth exceeds ${MAX_DEPTH}`);
    rt.depth++;
    try {
      const scope = { slug, vars: { ...params } };
      if (handler.when && !condition(rt, scope, handler.when)) return;
      runSteps(rt, scope, handler.do);
    } finally {
      rt.depth--;
    }
  }

  function runSteps(rt, scope, steps) {
    for (const step of steps || []) runStep(rt, scope, step);
  }

  function runStep(rt, scope, step) {
    if ('op' in step) return runOp(rt, scope, step);
    if ('if' in step) {
      return runSteps(rt, scope, condition(rt, scope, step.if) ? step.then : step.else);
    }
    if ('forEach' in step) {
      const raw = Array.isArray(step.forEach) ? step.forEach : [step.forEach];
      const items = raw.flatMap(item => {
        if (typeof item === 'string') {
          const v = item.startsWith('$') ? lookup(rt, scope, item) : item;
          // Arrays expand member by member: refs and allEnemies become entity keys, other values stay.
          const expand = x => Array.isArray(x) ? x.flatMap(expand) : (typeof x === 'string' && (x === 'allEnemies' || rt.state.entities[x]) ? entityKeys(rt, scope, x) : [x]);
          return expand(v);
        }
        return [value(rt, scope, item)];
      });
      for (const item of items) runSteps(rt, { slug: scope.slug, vars: { ...scope.vars, [step.as]: item } }, step.do);
      return undefined;
    }
    if ('emit' in step) {
      return dispatchEvent(rt, step.emit, structuredClone(value(rt, scope, step.with || {})));
    }
    if ('call' in step) {
      return invokeCommand(rt, step.call, structuredClone(value(rt, scope, step.with || {})));
    }
    if ('set' in step) {
      const path = String(step.set).split('.');
      let cur = (rt.state.mechanics[scope.slug] ||= {});
      // Replace any non-record prefix (SPEC §6), as the C# runtime does.
      for (const key of path.slice(0, -1)) { if (!cur[key] || typeof cur[key] !== 'object' || Array.isArray(cur[key])) cur[key] = {}; cur = cur[key]; }
      // Clone so a later set never writes through into the caller's params or an emitted payload (SPEC §1).
      cur[path[path.length - 1]] = structuredClone(value(rt, scope, step.value));
      return undefined;
    }
    throw new Error(`Unknown step ${JSON.stringify(step)}`);
  }

  function runOp(rt, scope, step) {
    const def = ops.ops[step.op];
    if (!def) throw new Error(`Unknown op '${step.op}'`);
    if (def.reference !== 'portable') throw new Error(`legacy op ${step.op} is not portable`);
    for (const [name, param] of Object.entries(def.params || {})) {
      if (param.required && step[name] === undefined) throw new Error(`op ${step.op} needs '${name}'`);
    }
    const api = {
      value: (node, vars) => (vars ? value(rt, { slug: scope.slug, vars: { ...scope.vars, ...vars } }, node) : value(rt, scope, node)),
      number: (node, fallback, vars, what = step.op) => (node === undefined ? fallback
        : numberValue(rt, vars ? { slug: scope.slug, vars: { ...scope.vars, ...vars } } : scope, node, `${step.op} ${what}`)),
      targets: () => entityKeys(rt, scope, step.target !== undefined ? step.target
        : (Object.hasOwn(scope.vars, 'target') ? '$target' : 'self')),
      emit: (name, payload) => dispatchEvent(rt, name, payload),
    };
    OPS[step.op](rt.state, step, api);
  }

  function invokeCommand(rt, full, params) {
    const { slug, name } = splitName(full, 'command');
    const handlers = (mechanics.get(slug).service.handlers || []).filter(h => h.on === `command.${name}`);
    if (!handlers.length) throw new Error(`Unknown command '${full}'`);
    for (const handler of handlers) runHandler(rt, slug, handler, { ...params });
  }

  function start(state) {
    return { state: createState(state), events: [], depth: 0 };
  }

  return {
    command(state, full, params = {}) {
      const rt = start(state);
      invokeCommand(rt, full, structuredClone(params)); // host values are snapshotted at the boundary
      return { state: rt.state, events: rt.events };
    },
    emit(state, full, payload = {}) {
      const rt = start(state);
      dispatchEvent(rt, full, structuredClone(payload));
      return { state: rt.state, events: rt.events };
    },
    query(state, full, params = {}) {
      const rt = start(state);
      const { slug, name } = splitName(full, 'query');
      const def = mechanics.get(slug).interface.queries?.[name];
      if (!def) throw new Error(`Unknown query '${full}'`);
      return value(rt, { slug, vars: structuredClone(params) }, def.value);
    },
  };
}

// ---------------------------------------------------------------------------
// Portable ops. Each mutates the working state it is handed (the runtime cloned it at entry).
// ---------------------------------------------------------------------------

const floorNonNegative = n => Math.max(0, Math.floor(n));

function perTarget(state, step, api, fn) {
  for (const key of api.targets()) fn(state.entities[key], key, { target: key });
}

function cardSource(state, pile) {
  if (!state.piles[pile]) throw new Error(`Unknown pile '${pile}'`);
  return state.piles[pile];
}

function moveFromHand(state, step, api, destination) {
  const hand = state.piles.hand;
  const amount = floorNonNegative(api.number(step.amount, 1));
  for (let i = 0; i < amount && hand.length; i++) {
    const index = step.random ? Math.floor(nextRandom(state) * hand.length) : 0;
    state.piles[destination].push(hand.splice(index, 1)[0]);
  }
}

const OPS = {
  damage(state, step, api) {
    perTarget(state, step, api, (e, key, vars) => {
      const hits = floorNonNegative(api.number(step.hits, 1, vars, 'hits'));
      for (let h = 0; h < hits; h++) {
        const amount = floorNonNegative(api.number(step.amount, 0, vars, 'amount'));
        const absorbed = Math.min(e.block, amount);
        e.block -= absorbed;
        e.hp = Math.max(0, e.hp - (amount - absorbed));
      }
    });
  },
  block(state, step, api) {
    perTarget(state, step, api, (e, key, vars) => { e.block += floorNonNegative(api.number(step.amount, 0, vars, 'amount')); });
  },
  loseHp(state, step, api) {
    perTarget(state, step, api, (e, key, vars) => {
      const amount = floorNonNegative(api.number(step.amount, 0, vars, 'amount'));
      if (step.nonlethal && amount >= e.hp) throw new Error('Not enough HP for a nonlethal loss');
      e.hp = Math.max(0, e.hp - amount);
    });
  },
  heal(state, step, api) {
    perTarget(state, step, api, (e, key, vars) => {
      e.hp = Math.min(e.maxHp, e.hp + floorNonNegative(api.number(step.amount, 0, vars, 'amount')));
    });
  },
  applyStatus(state, step, api) {
    perTarget(state, step, api, (e, key, vars) => {
      const id = api.value(step.status, vars);
      const next = (e.statuses[id] || 0) + Math.floor(api.number(step.stacks, 1, vars, 'stacks'));
      if (next > 0) e.statuses[id] = next; else delete e.statuses[id];
    });
  },
  removeStatus(state, step, api) {
    perTarget(state, step, api, (e, key, vars) => {
      const id = api.value(step.status, vars);
      if (step.amount === undefined) { delete e.statuses[id]; return; }
      const next = (e.statuses[id] || 0) - floorNonNegative(api.number(step.amount, 0, vars, 'amount'));
      if (next > 0) e.statuses[id] = next; else delete e.statuses[id];
    });
  },
  draw(state, step, api) {
    const amount = floorNonNegative(api.number(step.amount, 1));
    for (let i = 0; i < amount && state.piles.draw.length; i++) state.piles.hand.push(state.piles.draw.shift());
  },
  discard(state, step, api) { moveFromHand(state, step, api, 'discard'); },
  exhaust(state, step, api) { moveFromHand(state, step, api, 'exhaust'); },
  addCard(state, step, api) {
    const card = api.value(step.card);
    if (typeof card !== 'string') throw new Error('addCard needs a card id');
    const pile = cardSource(state, step.pile ? api.value(step.pile) : 'discard');
    const count = Math.max(1, Math.floor(api.number(step.count, 1)));
    const position = step.position ? api.value(step.position) : 'bottom';
    if (!['top', 'bottom', 'random'].includes(position)) throw new Error(`addCard position must be top, bottom or random, got '${position}'`);
    // random: the legacy engine's seeded insertion, an index in [0, length] (src/engine/actions.js).
    for (let i = 0; i < count; i++) {
      if (position === 'top') pile.unshift(card);
      else if (position === 'random') pile.splice(Math.floor(nextRandom(state) * (pile.length + 1)), 0, card);
      else pile.push(card);
    }
  },
  gainEnergy(state, step, api) {
    perTarget(state, step, api, (e, key, vars) => {
      const amount = floorNonNegative(api.number(step.amount, 1, vars, 'amount') - (step.funded === undefined ? 0 : api.number(step.funded, 0, vars, 'funded')));
      e.sp += amount;
      if (e.spMax !== undefined) e.sp = Math.min(e.spMax, e.sp);
    });
  },
  restoreStamina(state, step, api) {
    perTarget(state, step, api, (e, key, vars) => {
      e.sp = Math.max(0, e.sp + Math.floor(api.number(step.amount, 1, vars, 'amount')));
      if (e.spMax !== undefined) e.sp = Math.min(e.spMax, e.sp);
    });
  },
  restoreMana(state, step, api) {
    perTarget(state, step, api, (e, key, vars) => {
      if (step.toFloorPct !== undefined) {
        const cap = e.mpMax ?? e.mp;
        const floor = Math.min(cap, Math.floor((cap * floorNonNegative(api.number(step.toFloorPct, 0, vars, 'toFloorPct'))) / 100));
        e.mp = e.mp >= floor ? cap : floor;
        return;
      }
      e.mp += floorNonNegative(api.number(step.amount, 1, vars, 'amount') - (step.funded === undefined ? 0 : api.number(step.funded, 0, vars, 'funded')));
      if (e.mpMax !== undefined) e.mp = Math.min(e.mpMax, e.mp);
    });
  },
  poiseDamage(state, step, api) {
    perTarget(state, step, api, (e, key, vars) => {
      const before = e.poise;
      e.poise = Math.max(0, e.poise - floorNonNegative(api.number(step.amount, 0, vars, 'amount')));
      if (before > 0 && e.poise === 0) api.emit('runtime.poiseBroken', { target: key });
    });
  },
  gainPoise(state, step, api) {
    perTarget(state, step, api, (e, key, vars) => { e.poise += floorNonNegative(api.number(step.amount, 0, vars, 'amount')); });
  },
  restorePoise(state, step, api) {
    perTarget(state, step, api, (e, key, vars) => {
      e.poise += floorNonNegative(api.number(step.amount, 0, vars, 'amount'));
      if (e.poiseMax !== undefined) e.poise = Math.min(e.poiseMax, e.poise);
    });
  },
  stagger(state, step, api) {
    perTarget(state, step, api, (e, key) => { api.emit('runtime.staggered', { target: key }); });
  },
};

export const PORTABLE_OPS = Object.freeze(Object.keys(OPS));

