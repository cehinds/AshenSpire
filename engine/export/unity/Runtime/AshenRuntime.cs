// REFERENCE CODE - not yet compiled in CI. Skeleton interpreter for the mechanics language in
// engine/runtime/SPEC.md (reference implementation: engine/runtime/interpreter.mjs). Plain C#, no Unity API.
// A port is correct when every mechanics[slug].cases entry passes (SPEC section 10).
// Section numbers below are SPEC sections. Open items are marked TODO.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace Ashen.Runtime
{
    // ---- 1. State -----------------------------------------------------------------------------------------

    public sealed class Entity
    {
        public int Hp, MaxHp, Block, Poise, Sp, Mp;
        public int? PoiseMax, SpMax, MpMax;               // null means "no cap"
        public Dictionary<string, int> Statuses = new();  // stacks > 0 only; a status at 0 or below is deleted
        public List<string> Tags = new();

        public Entity Clone() => new()
        {
            Hp = Hp, MaxHp = MaxHp, Block = Block, Poise = Poise, Sp = Sp, Mp = Mp,
            PoiseMax = PoiseMax, SpMax = SpMax, MpMax = MpMax,
            Statuses = new Dictionary<string, int>(Statuses), Tags = new List<string>(Tags),
        };
    }

    public sealed class GameState
    {
        public static readonly string[] PileNames = { "draw", "hand", "discard", "exhaust" };

        /// <summary>Insertion order matters (allEnemies, iteration). Add entities once, never remove during a call.</summary>
        public Dictionary<string, Entity> Entities = new();
        public Dictionary<string, List<string>> Piles = PileNames.ToDictionary(p => p, _ => new List<string>());
        /// <summary>mechanics.slug -> that mechanic's own state. Values: double, bool, string, List, Dictionary.</summary>
        public Dictionary<string, Dictionary<string, object>> Mechanics = new();
        public uint RngSeed = 1;

        /// <summary>Every call works on a copy; the caller's state is never changed.</summary>
        public GameState Clone()
        {
            var copy = new GameState { RngSeed = RngSeed };
            foreach (var (k, e) in Entities) copy.Entities[k] = e.Clone();
            foreach (var (k, p) in Piles) copy.Piles[k] = new List<string>(p);
            foreach (var (k, m) in Mechanics) copy.Mechanics[k] = (Dictionary<string, object>)DeepCopy(m);
            return copy;
        }

        public static object DeepCopy(object v) => v switch
        {
            Dictionary<string, object> d => d.ToDictionary(kv => kv.Key, kv => DeepCopy(kv.Value)),
            List<object> l => l.Select(DeepCopy).ToList(),
            string => v,
            // Typed host collections are normalized to JSON shapes so later caller mutation cannot leak in.
            System.Collections.IDictionary td => td.Keys.Cast<object>().ToDictionary(k => k.ToString(), k => DeepCopy(td[k])),
            System.Collections.IEnumerable e => e.Cast<object>().Select(DeepCopy).ToList(),
            _ => v,
        };
    }

    public sealed class RuntimeEvent
    {
        public string Name;
        public Dictionary<string, object> Payload;
    }

    public sealed class CallResult
    {
        public GameState State;
        public List<RuntimeEvent> Events = new();
    }

    // ---- 9. Determinism: the only random source -------------------------------------------------------------

    public static class Mulberry32
    {
        /// <summary>Advances state.RngSeed and returns r in [0, 1).</summary>
        public static double Next(GameState state)
        {
            unchecked
            {
                state.RngSeed += 0x6D2B79F5u;
                uint t = state.RngSeed;
                t = Imul(t ^ (t >> 15), t | 1u);
                t ^= t + Imul(t ^ (t >> 7), t | 61u);
                return (t ^ (t >> 14)) / 4294967296.0;
            }
        }
        static uint Imul(uint a, uint b) => unchecked(a * b);
    }

    // ---- 7. Formulas: delegated ----------------------------------------------------------------------------

    public sealed class FormulaEntity
    {
        public double Hp, MaxHp, Block, Mana, MaxMana;
        public Dictionary<string, int> Statuses = new();   // id -> stacks
    }

    public sealed class FormulaContext
    {
        public Dictionary<string, FormulaEntity> Entities = new();
        public List<FormulaEntity> AllEnemies = new();
        public double EnergySpent, CardsPlayedThisTurn;
    }

    /// <summary>The closed formula set of runtime.formulas. Implement it against engine/runtime/formulas.json.</summary>
    public interface IFormulaEvaluator
    {
        /// <summary>formula is a Dictionary with "f", every $name already substituted. Returns the floored integer.</summary>
        double Evaluate(Dictionary<string, object> formula, FormulaContext context);
    }

    /// <summary>Starter implementation. TODO: metric and traitBonus (see formulas.json) before claiming parity.</summary>
    public sealed class BasicFormulas : IFormulaEvaluator
    {
        public double Evaluate(Dictionary<string, object> formula, FormulaContext ctx) => Math.Floor(Raw(formula, ctx));

        double Raw(object node, FormulaContext ctx)
        {
            if (AshenRuntime.AsDouble(node) is double d) return d;
            if (node is not Dictionary<string, object> f || !f.TryGetValue("f", out var op)) throw new InvalidOperationException("Formula node must be a number or { f }");
            double v = (string)op switch
            {
                "add" => ((List<object>)f["args"]).Sum(a => Raw(a, ctx)),
                "mul" => ((List<object>)f["args"]).Aggregate(1.0, (acc, a) => acc * Raw(a, ctx)),
                "percentMaxHp" => Of(f, ctx).MaxHp * Raw(f["pct"], ctx) / 100.0,
                "missingHp" => Math.Max(0, Of(f, ctx).MaxHp - Of(f, ctx).Hp),
                "missingMana" => Math.Max(0, Of(f, ctx).MaxMana - Of(f, ctx).Mana),
                "blockOf" => Of(f, ctx).Block,
                "hpOf" => Of(f, ctx).Hp,
                "energySpent" => ctx.EnergySpent * Per(f, ctx),
                "cardsPlayedThisTurn" => ctx.CardsPlayedThisTurn * Per(f, ctx),
                "stacks" => Stacks(f, ctx),
                _ => throw new NotSupportedException($"Formula op '{op}' is not implemented"),
            };
            if (f.TryGetValue("min", out var mn)) v = Math.Max(v, Raw(mn, ctx));
            if (f.TryGetValue("max", out var mx)) v = Math.Min(v, Raw(mx, ctx));
            return v;
        }

        static double Per(Dictionary<string, object> f, FormulaContext ctx) => f.TryGetValue("per", out var p) ? AshenRuntime.AsDouble(p) ?? throw new InvalidOperationException("per must be a number") : 1;

        static FormulaEntity Of(Dictionary<string, object> f, FormulaContext ctx)
        {
            var name = (string)f["of"];
            return ctx.Entities.TryGetValue(name, out var e) ? e : throw new InvalidOperationException($"Unresolvable of '{name}'");
        }

        static double Stacks(Dictionary<string, object> f, FormulaContext ctx)
        {
            var status = (string)f["status"];
            double total = (string)f["of"] == "allEnemies"
                ? ctx.AllEnemies.Sum(e => e.Statuses.GetValueOrDefault(status))
                : Of(f, ctx).Statuses.GetValueOrDefault(status);
            // "per" floors the division at once.
            return f.TryGetValue("per", out var per) ? Math.Floor(total / (AshenRuntime.AsDouble(per) ?? throw new InvalidOperationException("per must be a number"))) : total;
        }
    }

    // ---- Runtime -------------------------------------------------------------------------------------------

    public sealed class AshenRuntime
    {
        public const int MaxDepth = 32;
        static readonly string[] Comparators = { "<", "<=", "==", "!=", ">=", ">" };
        static readonly HashSet<string> ImplementedOps = new()
        {
            "damage", "block", "heal", "loseHp", "applyStatus", "removeStatus", "draw", "discard", "exhaust", "addCard",
            "restoreStamina", "restoreMana", "gainEnergy", "poiseDamage", "gainPoise", "restorePoise", "stagger",
        };

        readonly AshenBuild _build;
        readonly List<string> _slugs;                    // sorted: the order events reach listeners
        readonly HashSet<string> _slugSet;
        readonly IFormulaEvaluator _formulas;

        public AshenRuntime(AshenBuild build, IFormulaEvaluator formulas = null)
        {
            _build = build;
            _formulas = formulas ?? new BasicFormulas();
            _slugs = build.MechanicOrder();
            _slugSet = new HashSet<string>(_slugs);
            // 8. A runtime must refuse to start if a portable op has no implementation.
            foreach (var op in build.Ops.EnumerateObject())
                if (op.Value.TryGetProperty("reference", out var r) && r.GetString() == "portable" && !ImplementedOps.Contains(op.Name))
                    throw new InvalidOperationException($"ops catalog marks '{op.Name}' portable but this runtime has no implementation");
        }

        // ----- per-call context -----
        sealed class Call
        {
            public GameState State;
            public List<RuntimeEvent> Events = new();
            public int Depth;
        }

        sealed class Scope
        {
            public string Slug;
            public Dictionary<string, object> Vars;
            public Scope With(string name, object value)
            {
                var vars = new Dictionary<string, object>(Vars) { [name] = value };
                return new Scope { Slug = Slug, Vars = vars };
            }
        }

        // ----- 3. Entry points -----
        public CallResult Command(GameState state, string full, Dictionary<string, object> parameters = null)
        {
            var call = Start(state);
            InvokeCommand(call, full, parameters ?? new());
            return new CallResult { State = call.State, Events = call.Events };
        }

        public CallResult Emit(GameState state, string full, Dictionary<string, object> payload = null)
        {
            var call = Start(state);
            Dispatch(call, full, payload != null ? new(payload) : new());
            return new CallResult { State = call.State, Events = call.Events };
        }

        public object Query(GameState state, string full, Dictionary<string, object> parameters = null)
        {
            var call = Start(state);
            var (slug, name) = SplitName(full, "query");
            var queries = _build.Mechanics[slug].Interface;
            if (queries.ValueKind != JsonValueKind.Object || !queries.TryGetProperty("queries", out var qs) || !qs.TryGetProperty(name, out var def))
                throw new InvalidOperationException($"Unknown query '{full}'");
            return Value(call, new Scope { Slug = slug, Vars = parameters != null ? new(parameters) : new() }, def.GetProperty("value"));
        }

        Call Start(GameState state) => new() { State = state.Clone() };

        // ----- 2. Names -----
        (string slug, string name) SplitName(string full, string what)
        {
            // Slugs may contain dots: take the longest known slug prefix.
            for (int i = full.LastIndexOf('.'); i > 0; i = full.LastIndexOf('.', i - 1))
                if (_slugSet.Contains(full[..i])) return (full[..i], full[(i + 1)..]);
            throw new InvalidOperationException($"Unknown {what} '{full}'");
        }

        static IEnumerable<JsonElement> Handlers(BuildMechanic m) =>
            m.Service.ValueKind == JsonValueKind.Object && m.Service.TryGetProperty("handlers", out var h) ? h.EnumerateArray() : Enumerable.Empty<JsonElement>();

        void InvokeCommand(Call call, string full, Dictionary<string, object> parameters)
        {
            var (slug, name) = SplitName(full, "command");
            var handlers = Handlers(_build.Mechanics[slug]).Where(h => h.GetProperty("on").GetString() == $"command.{name}").ToList();
            if (handlers.Count == 0) throw new InvalidOperationException($"Unknown command '{full}'");
            foreach (var h in handlers) RunHandler(call, slug, h, new(parameters));
        }

        // ----- 6. Events, handlers and steps -----
        void Dispatch(Call call, string name, Dictionary<string, object> payload)
        {
            call.Events.Add(new RuntimeEvent { Name = name, Payload = payload });
            foreach (var slug in _slugs)
                foreach (var h in Handlers(_build.Mechanics[slug]))
                    if (h.GetProperty("on").GetString() == $"event.{name}") RunHandler(call, slug, h, new(payload));
        }

        void RunHandler(Call call, string slug, JsonElement handler, Dictionary<string, object> parameters)
        {
            if (call.Depth >= MaxDepth) throw new InvalidOperationException($"Recursion depth exceeds {MaxDepth}");
            call.Depth++;
            try
            {
                var scope = new Scope { Slug = slug, Vars = parameters };
                if (handler.TryGetProperty("when", out var when) && !Condition(call, scope, when)) return;
                RunSteps(call, scope, handler.GetProperty("do"));
            }
            finally { call.Depth--; }
        }

        void RunSteps(Call call, Scope scope, JsonElement steps)
        {
            if (steps.ValueKind != JsonValueKind.Array) return;
            foreach (var step in steps.EnumerateArray()) RunStep(call, scope, step);
        }

        // The first key found decides the kind, in this order: op, if, forEach, emit, call, set.
        void RunStep(Call call, Scope scope, JsonElement step)
        {
            if (step.TryGetProperty("op", out var op)) { RunOp(call, scope, op.GetString(), step); return; }
            if (step.TryGetProperty("if", out var cond))
            {
                var branch = Condition(call, scope, cond) ? "then" : "else";
                if (step.TryGetProperty(branch, out var steps)) RunSteps(call, scope, steps);
                return;
            }
            if (step.TryGetProperty("forEach", out var each))
            {
                var name = step.GetProperty("as").GetString();
                foreach (var item in ForEachItems(call, scope, each)) RunSteps(call, scope.With(name, item), step.GetProperty("do"));
                return;
            }
            if (step.TryGetProperty("emit", out var emit))
            {
                Dispatch(call, emit.GetString(), (Dictionary<string, object>)GameState.DeepCopy(AsDict(WithValue(call, scope, step))));
                return;
            }
            if (step.TryGetProperty("call", out var cmd))
            {
                InvokeCommand(call, cmd.GetString(), (Dictionary<string, object>)GameState.DeepCopy(AsDict(WithValue(call, scope, step))));
                return;
            }
            if (step.TryGetProperty("set", out var set))
            {
                var path = set.GetString().Split('.');
                if (!call.State.Mechanics.TryGetValue(scope.Slug, out var cur)) call.State.Mechanics[scope.Slug] = cur = new();
                foreach (var key in path[..^1])
                {
                    if (!cur.TryGetValue(key, out var next) || next is not Dictionary<string, object>) cur[key] = next = new Dictionary<string, object>();
                    cur = (Dictionary<string, object>)next;
                }
                // Clone so a later set never writes into the caller's params or an emitted payload (SPEC 1).
                cur[path[^1]] = GameState.DeepCopy(Value(call, scope, step.GetProperty("value")));
                return;
            }
            throw new InvalidOperationException($"Unknown step {step.GetRawText()}");
        }

        object WithValue(Call call, Scope scope, JsonElement step) =>
            step.TryGetProperty("with", out var w) ? Value(call, scope, w) : new Dictionary<string, object>();

        static Dictionary<string, object> AsDict(object v) => v as Dictionary<string, object> ?? new();

        IEnumerable<object> ForEachItems(Call call, Scope scope, JsonElement each)
        {
            var raw = each.ValueKind == JsonValueKind.Array ? each.EnumerateArray().ToList() : new List<JsonElement> { each };
            foreach (var item in raw)
            {
                if (item.ValueKind != JsonValueKind.String) { yield return Value(call, scope, item); continue; }
                var s = item.GetString();
                var v = s.StartsWith("$") ? Lookup(call, scope, s) : s;
                if (AsList(v) is List<object> list) { foreach (var x in list) yield return x; }
                else if (v is string name && (name == "allEnemies" || call.State.Entities.ContainsKey(name))) { foreach (var k in EntityKeys(call, scope, name)) yield return k; }
                else yield return v;
            }
        }

        // ----- 4. Values -----
        object Lookup(Call call, Scope scope, string reference)
        {
            // A present null is a value; only a missing key is unresolved (the reference rejects only undefined).
            var path = reference[1..].Split('.');
            InvalidOperationException Unresolved() => new($"Unresolved {reference}");
            object cur;
            if (path[0] == "model" || path[0] == "state")
            {
                // SPEC 4: $model is the mechanic's own state merged over model.schema.json property defaults.
                if (path[0] == "model") cur = ModelView(call, scope.Slug);
                else if (call.State.Mechanics.TryGetValue(scope.Slug, out var own)) cur = own;
                else throw Unresolved();
                foreach (var key in path[1..])
                    if (!(cur is Dictionary<string, object> d && d.TryGetValue(key, out cur))) throw Unresolved();
                return cur;
            }
            if (!scope.Vars.TryGetValue(path[0], out cur)) throw Unresolved();
            foreach (var key in path[1..])
            {
                // An entity ref reads that entity's field next.
                if (cur is string name && call.State.Entities.TryGetValue(name, out var entity)) { cur = EntityField(entity, key); if (cur == null) throw Unresolved(); }
                else if (!(cur is Dictionary<string, object> d && d.TryGetValue(key, out cur))) throw Unresolved();
            }
            return cur;
        }

        Dictionary<string, object> ModelView(Call call, string slug)
        {
            var defaults = _build.Mechanics.TryGetValue(slug, out var m) && m.Model.ValueKind == JsonValueKind.Object
                ? SchemaDefaults(m.Model) : new Dictionary<string, object>();
            call.State.Mechanics.TryGetValue(slug, out var own);
            return MergeOver(defaults, own);
        }

        static Dictionary<string, object> SchemaDefaults(JsonElement schema)
        {
            var out_ = new Dictionary<string, object>();
            if (!schema.TryGetProperty("properties", out var props) || props.ValueKind != JsonValueKind.Object) return out_;
            foreach (var p in props.EnumerateObject())
            {
                if (p.Value.TryGetProperty("default", out var dflt)) out_[p.Name] = FromJson(dflt);
                else if (p.Value.TryGetProperty("properties", out _)) out_[p.Name] = SchemaDefaults(p.Value);
            }
            return out_;
        }

        static Dictionary<string, object> MergeOver(Dictionary<string, object> baseValues, Dictionary<string, object> over)
        {
            var result = (Dictionary<string, object>)GameState.DeepCopy(baseValues);
            if (over == null) return result;
            foreach (var (k, v) in over)
                result[k] = result.TryGetValue(k, out var b) && b is Dictionary<string, object> bd && v is Dictionary<string, object> vd ? MergeOver(bd, vd) : GameState.DeepCopy(v);
            return result;
        }

        static object FromJson(JsonElement e) => e.ValueKind switch
        {
            JsonValueKind.Object => e.EnumerateObject().ToDictionary(p => p.Name, p => FromJson(p.Value)),
            JsonValueKind.Array => e.EnumerateArray().Select(FromJson).ToList(),
            JsonValueKind.Number => e.GetDouble(),
            JsonValueKind.String => e.GetString(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null,
        };

        static object EntityField(Entity e, string key) => key switch
        {
            "hp" => (double)e.Hp, "maxHp" => (double)e.MaxHp, "block" => (double)e.Block, "poise" => (double)e.Poise,
            "sp" => (double)e.Sp, "mp" => (double)e.Mp,
            // Caps are absent (unresolved) when null, as in the reference runtime.
            "poiseMax" => e.PoiseMax is int pm ? (object)(double)pm : null,
            "spMax" => e.SpMax is int sm ? (object)(double)sm : null,
            "mpMax" => e.MpMax is int mm ? (object)(double)mm : null,
            "statuses" => e.Statuses.ToDictionary(kv => kv.Key, kv => (object)(double)kv.Value),
            "tags" => e.Tags.Cast<object>().ToList(),
            _ => null,
        };

        /// <summary>Evaluate a JSON node to double, bool, string, null, List&lt;object&gt; or Dictionary&lt;string, object&gt;.</summary>
        object Value(Call call, Scope scope, JsonElement node)
        {
            switch (node.ValueKind)
            {
                case JsonValueKind.Number: return node.GetDouble();
                case JsonValueKind.True: return true;
                case JsonValueKind.False: return false;
                case JsonValueKind.Null: return null;
                case JsonValueKind.String: { var s = node.GetString(); return s.StartsWith("$") ? Lookup(call, scope, s) : s; }
                case JsonValueKind.Array: return node.EnumerateArray().Select(n => Value(call, scope, n)).ToList();
                case JsonValueKind.Object:
                    if (node.TryGetProperty("f", out var f) && f.ValueKind == JsonValueKind.String)
                        return _formulas.Evaluate((Dictionary<string, object>)Substitute(call, scope, node), FormulaContextFor(call, scope));
                    if (IsCondition(node)) return Condition(call, scope, node);
                    return node.EnumerateObject().ToDictionary(p => p.Name, p => Value(call, scope, p.Value));
                default: throw new InvalidOperationException($"Cannot resolve value {node.GetRawText()}");
            }
        }

        // Replace every $name string inside a formula (nested formulas stay formulas). 7: before evaluation.
        object Substitute(Call call, Scope scope, JsonElement node) => node.ValueKind switch
        {
            JsonValueKind.String => node.GetString().StartsWith("$") ? Lookup(call, scope, node.GetString()) : node.GetString(),
            JsonValueKind.Array => node.EnumerateArray().Select(n => Substitute(call, scope, n)).ToList(),
            JsonValueKind.Object => node.EnumerateObject().ToDictionary(p => p.Name, p => Substitute(call, scope, p.Value)),
            JsonValueKind.Number => node.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null,
        };

        FormulaContext FormulaContextFor(Call call, Scope scope)
        {
            var ctx = new FormulaContext();
            foreach (var (key, e) in call.State.Entities)
                ctx.Entities[key] = new FormulaEntity { Hp = e.Hp, MaxHp = e.MaxHp, Block = e.Block, Mana = e.Mp, MaxMana = e.MpMax ?? e.Mp, Statuses = new(e.Statuses) };
            // Variables holding an entity ref are aliases ("target" -> the param value).
            foreach (var (name, v) in scope.Vars)
                if (v is string s && ctx.Entities.TryGetValue(s, out var e)) ctx.Entities[name] = e;
            foreach (var (key, e) in call.State.Entities) if (e.Tags.Contains("enemy")) ctx.AllEnemies.Add(ctx.Entities[key]);
            if (scope.Vars.TryGetValue("energySpent", out var es) && AsDouble(es) is double d1) ctx.EnergySpent = d1;
            if (scope.Vars.TryGetValue("cardsPlayedThisTurn", out var cp) && AsDouble(cp) is double d2) ctx.CardsPlayedThisTurn = d2;
            return ctx;
        }

        double Number(Call call, Scope scope, JsonElement node, string what)
        {
            var v = Value(call, scope, node);
            // Callers may pass boxed int/long/float/decimal; normalise every numeric type to double.
            double d = v switch
            {
                double x => x, float x => x, int x => x, long x => x, short x => x, byte x => x, uint x => x, ulong x => x, decimal x => (double)x,
                _ => double.NaN,
            };
            if (double.IsNaN(d)) throw new InvalidOperationException($"{what} must be a number");
            return d;
        }

        string EntityKey(Call call, Scope scope, object reference)
        {
            if (reference is string s && s.StartsWith("$")) reference = Lookup(call, scope, s);
            if (reference is string key && call.State.Entities.ContainsKey(key)) return key;
            throw new InvalidOperationException($"Unknown entity ref '{reference}'");
        }

        List<string> EntityKeys(Call call, Scope scope, object reference)
        {
            if (reference is string s && s.StartsWith("$")) reference = Lookup(call, scope, s);
            if (AsList(reference) is List<object> list) return list.SelectMany(i => EntityKeys(call, scope, i)).ToList();
            if (reference is string name && name == "allEnemies" && !call.State.Entities.ContainsKey("allEnemies"))
                return call.State.Entities.Where(kv => kv.Value.Tags.Contains("enemy")).Select(kv => kv.Key).ToList();
            return new List<string> { EntityKey(call, scope, reference) };
        }

        // ----- 5. Conditions -----
        static bool IsCondition(JsonElement n) => n.ValueKind == JsonValueKind.Object && n.EnumerateObject().Count() == 1 && new[] { "all", "any", "not", "cmp", "hasTag", "hasStatus" }.Any(k => n.TryGetProperty(k, out _));

        bool Condition(Call call, Scope scope, JsonElement c)
        {
            if (c.TryGetProperty("all", out var all)) return all.EnumerateArray().All(x => Condition(call, scope, x));
            if (c.TryGetProperty("any", out var any)) return any.EnumerateArray().Any(x => Condition(call, scope, x));
            if (c.TryGetProperty("not", out var not)) return !Condition(call, scope, not);
            if (c.TryGetProperty("cmp", out var cmp))
            {
                var parts = cmp.EnumerateArray().ToArray();
                var op = parts[0].GetString();
                if (!Comparators.Contains(op)) throw new InvalidOperationException($"Unknown comparator '{op}'");
                var a = Value(call, scope, parts[1]); var b = Value(call, scope, parts[2]);
                if (op == "==") return DeepEquals(a, b);
                if (op == "!=") return !DeepEquals(a, b);
                if (AsDouble(a) is not double x || AsDouble(b) is not double y || !double.IsFinite(x) || !double.IsFinite(y))
                    throw new InvalidOperationException($"cmp {op} needs two numbers");
                return op switch { "<" => x < y, "<=" => x <= y, ">=" => x >= y, _ => x > y };
            }
            if (c.TryGetProperty("hasTag", out var ht))
            {
                var p = ht.EnumerateArray().ToArray();
                return call.State.Entities[EntityKey(call, scope, Value(call, scope, p[0]))].Tags.Contains((string)Value(call, scope, p[1]));
            }
            if (c.TryGetProperty("hasStatus", out var hs))
            {
                var p = hs.EnumerateArray().ToArray();
                return call.State.Entities[EntityKey(call, scope, Value(call, scope, p[0]))].Statuses.GetValueOrDefault((string)Value(call, scope, p[1])) > 0;
            }
            throw new InvalidOperationException($"Unknown condition {c.GetRawText()}");
        }

        static bool DeepEquals(object a, object b)
        {
            if (a == null || b == null) return a == null && b == null;
            // Boxed int/long/float and JSON doubles compare as numbers, as in the JS runtime.
            if (AsDouble(a) is double na && AsDouble(b) is double nb) return na == nb;
            if (AsList(a) is List<object> la && AsList(b) is List<object> lb) return la.Count == lb.Count && la.Zip(lb).All(p => DeepEquals(p.First, p.Second));
            if (a is Dictionary<string, object> da && b is Dictionary<string, object> db)
                return da.Count == db.Count && da.All(kv => db.TryGetValue(kv.Key, out var o) && DeepEquals(kv.Value, o));
            return a.Equals(b);
        }

        /// <summary>Host arrays and typed lists (string[], List&lt;string&gt;) read as a JSON array; strings and records do not.</summary>
        internal static List<object> AsList(object v) => v switch
        {
            List<object> l => l,
            string or System.Collections.IDictionary => null,
            System.Collections.IEnumerable e => e.Cast<object>().ToList(),
            _ => null,
        };

        internal static double? AsDouble(object v) => v switch
        {
            double x => x, float x => x, int x => x, long x => x, short x => x, byte x => x, uint x => x, ulong x => x, decimal x => (double)x,
            _ => null,
        };

        // ----- 8. Ops -----
        static int Floor0(double v) => (int)Math.Max(0, Math.Floor(v));

        void RunOp(Call call, Scope scope, string name, JsonElement step)
        {
            if (!_build.Ops.TryGetProperty(name, out var def)) throw new InvalidOperationException($"Unknown op '{name}'");
            if (def.GetProperty("reference").GetString() != "portable") throw new InvalidOperationException($"legacy op {name} is not portable");
            if (def.TryGetProperty("params", out var declared) && declared.ValueKind == JsonValueKind.Object)
                foreach (var param in declared.EnumerateObject())
                    if (param.Value.TryGetProperty("required", out var req) && req.ValueKind == JsonValueKind.True && !step.TryGetProperty(param.Name, out _))
                        throw new InvalidOperationException($"op {name} needs '{param.Name}'");
            var s = call.State;

            // Optional numeric param, evaluated in the given scope.
            double Num(string key, double fallback, Scope sc = null) =>
                step.TryGetProperty(key, out var n) ? Number(call, sc ?? scope, n, $"{name} {key}") : fallback;

            // Targets: step.target, else the variable "target" when defined, else "self". The op applies to each in order.
            IEnumerable<string> Targets() =>
                EntityKeys(call, scope, step.TryGetProperty("target", out var t) ? Value(call, scope, t) : scope.Vars.ContainsKey("target") ? "$target" : "self");

            void PerTarget(Action<Entity, string, Scope> fn)
            {
                foreach (var key in Targets()) fn(s.Entities[key], key, scope.With("target", key));
            }

            void MoveFromHand(string destination)
            {
                int amount = Floor0(Num("amount", 1));
                bool random = step.TryGetProperty("random", out var r) && r.ValueKind == JsonValueKind.True;
                var hand = s.Piles["hand"];
                for (int i = 0; i < amount && hand.Count > 0; i++)
                {
                    int index = random ? (int)Math.Floor(Mulberry32.Next(s) * hand.Count) : 0;
                    s.Piles[destination].Add(hand[index]);
                    hand.RemoveAt(index);
                }
            }

            switch (name)
            {
                case "damage":
                    PerTarget((e, key, sc) =>
                    {
                        int hits = Floor0(Num("hits", 1, sc));
                        for (int h = 0; h < hits; h++)
                        {
                            int amount = Floor0(Num("amount", 0, sc));   // re-evaluated each hit
                            int absorbed = Math.Min(e.Block, amount);
                            e.Block -= absorbed;
                            e.Hp = Math.Max(0, e.Hp - (amount - absorbed));
                        }
                    });
                    break;
                case "block":
                    PerTarget((e, key, sc) => e.Block += Floor0(Num("amount", 0, sc)));
                    break;
                case "loseHp":
                    PerTarget((e, key, sc) =>
                    {
                        int amount = Floor0(Num("amount", 0, sc));
                        if (step.TryGetProperty("nonlethal", out var nl) && nl.ValueKind == JsonValueKind.True && amount >= e.Hp)
                            throw new InvalidOperationException("Not enough HP for a nonlethal loss");
                        e.Hp = Math.Max(0, e.Hp - amount);
                    });
                    break;
                case "heal":
                    PerTarget((e, key, sc) => e.Hp = Math.Min(e.MaxHp, e.Hp + Floor0(Num("amount", 0, sc))));
                    break;
                case "applyStatus":
                    PerTarget((e, key, sc) =>
                    {
                        var id = (string)Value(call, sc, step.GetProperty("status"));
                        int next = e.Statuses.GetValueOrDefault(id) + (int)Math.Floor(Num("stacks", 1, sc));   // stacks may be negative
                        if (next > 0) e.Statuses[id] = next; else e.Statuses.Remove(id);
                    });
                    break;
                case "removeStatus":
                    PerTarget((e, key, sc) =>
                    {
                        var id = (string)Value(call, sc, step.GetProperty("status"));
                        if (!step.TryGetProperty("amount", out _)) { e.Statuses.Remove(id); return; }
                        int next = e.Statuses.GetValueOrDefault(id) - Floor0(Num("amount", 0, sc));
                        if (next > 0) e.Statuses[id] = next; else e.Statuses.Remove(id);
                    });
                    break;
                case "draw":
                    {
                        int amount = Floor0(Num("amount", 1));
                        for (int i = 0; i < amount && s.Piles["draw"].Count > 0; i++)
                        {
                            s.Piles["hand"].Add(s.Piles["draw"][0]);
                            s.Piles["draw"].RemoveAt(0);
                        }
                        break;
                    }
                case "discard": MoveFromHand("discard"); break;
                case "exhaust": MoveFromHand("exhaust"); break;
                case "addCard":
                    {
                        var card = Value(call, scope, step.GetProperty("card")) as string ?? throw new InvalidOperationException("addCard needs a card id");
                        var pileName = step.TryGetProperty("pile", out var p) ? (string)Value(call, scope, p) : "discard";
                        if (!s.Piles.TryGetValue(pileName, out var pile)) throw new InvalidOperationException($"Unknown pile '{pileName}'");
                        int count = (int)Math.Max(1, Math.Floor(Num("count", 1)));
                        bool top = step.TryGetProperty("position", out var pos) && (string)Value(call, scope, pos) == "top";
                        for (int i = 0; i < count; i++) { if (top) pile.Insert(0, card); else pile.Add(card); }
                        break;
                    }
                case "gainEnergy":   // same arithmetic as restoreStamina plus "funded"
                    PerTarget((e, key, sc) =>
                    {
                        e.Sp += Floor0(Num("amount", 1, sc) - Num("funded", 0, sc));
                        if (e.SpMax is int cap) e.Sp = Math.Min(cap, e.Sp);
                    });
                    break;
                case "restoreStamina":   // signed: a negative amount removes SP, floored at 0 (SPEC 8)
                    PerTarget((e, key, sc) =>
                    {
                        e.Sp = Math.Max(0, e.Sp + (int)Math.Floor(Num("amount", 1, sc)));
                        if (e.SpMax is int cap) e.Sp = Math.Min(cap, e.Sp);
                    });
                    break;
                case "restoreMana":
                    PerTarget((e, key, sc) =>
                    {
                        if (step.TryGetProperty("toFloorPct", out _))
                        {
                            int cap = e.MpMax ?? e.Mp;
                            int floor = Math.Min(cap, (int)Math.Floor(cap * (double)Floor0(Num("toFloorPct", 0, sc)) / 100.0));
                            e.Mp = e.Mp >= floor ? cap : floor;
                            return;
                        }
                        e.Mp += Floor0(Num("amount", 1, sc) - Num("funded", 0, sc));
                        if (e.MpMax is int mpCap) e.Mp = Math.Min(mpCap, e.Mp);
                    });
                    break;
                case "poiseDamage":
                    PerTarget((e, key, sc) =>
                    {
                        int before = e.Poise;
                        e.Poise = Math.Max(0, e.Poise - Floor0(Num("amount", 0, sc)));
                        if (before > 0 && e.Poise == 0) Dispatch(call, "runtime.poiseBroken", new() { ["target"] = key });
                    });
                    break;
                case "gainPoise":
                    PerTarget((e, key, sc) => e.Poise += Floor0(Num("amount", 0, sc)));
                    break;
                case "restorePoise":
                    PerTarget((e, key, sc) =>
                    {
                        e.Poise += Floor0(Num("amount", 0, sc));
                        if (e.PoiseMax is int cap) e.Poise = Math.Min(cap, e.Poise);
                    });
                    break;
                case "stagger":
                    PerTarget((e, key, sc) => Dispatch(call, "runtime.staggered", new() { ["target"] = key }));
                    break;
                default:
                    throw new InvalidOperationException($"Op '{name}' has no implementation");
            }
        }
    }
}
