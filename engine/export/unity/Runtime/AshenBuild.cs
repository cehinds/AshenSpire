// REFERENCE CODE - not yet compiled in CI, no .csproj is part of the repository build.
// Plain C# (System.Text.Json, no Unity API) so it also builds under .NET. Newtonsoft users: swap JsonElement for JObject.
// Mirrors the top level of engine/contracts/build-artifact.schema.json (format ashen.build@1).
// Guide: engine/export/README.md and engine/export/unity/README.md.
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Ashen.Runtime
{
    /// <summary>One mechanic as compiled: the behaviour behind one tag.</summary>
    public sealed class BuildMechanic
    {
        [JsonPropertyName("manifest")] public JsonElement Manifest { get; set; }
        [JsonPropertyName("model")] public JsonElement Model { get; set; }
        [JsonPropertyName("interface")] public JsonElement Interface { get; set; }
        [JsonPropertyName("service")] public JsonElement Service { get; set; }
        [JsonPropertyName("cases")] public JsonElement Cases { get; set; }

        public string Id => Manifest.GetProperty("id").GetString();
        public string Portability => Manifest.TryGetProperty("portability", out var p) ? p.GetString() : "legacy";
    }

    /// <summary>The whole artifact. Open sections stay JsonElement; the runtime and the UI layer read them as JSON.</summary>
    public sealed class AshenBuild
    {
        public const string SupportedFormat = "ashen.build@1";

        [JsonPropertyName("format")] public string Format { get; set; }
        [JsonPropertyName("game")] public string Game { get; set; }
        [JsonPropertyName("version")] public string Version { get; set; }
        [JsonPropertyName("hash")] public string Hash { get; set; }
        [JsonPropertyName("profile")] public JsonElement Profile { get; set; }
        /// <summary>Tag id to mechanic slug, e.g. "fx:heal" to "fx_heal".</summary>
        [JsonPropertyName("tags")] public Dictionary<string, string> Tags { get; set; } = new();
        /// <summary>ops (catalog), formulas (closed set), specVersion.</summary>
        [JsonPropertyName("runtime")] public JsonElement Runtime { get; set; }
        [JsonPropertyName("mechanics")] public Dictionary<string, BuildMechanic> Mechanics { get; set; } = new();
        [JsonPropertyName("content")] public JsonElement Content { get; set; }
        [JsonPropertyName("ui")] public JsonElement Ui { get; set; }
        [JsonPropertyName("maps")] public JsonElement Maps { get; set; }
        [JsonPropertyName("assets")] public JsonElement Assets { get; set; }
        [JsonPropertyName("report")] public JsonElement Report { get; set; }

        /// <summary>Parse the artifact and refuse a format this loader does not know.</summary>
        public static AshenBuild Load(string json)
        {
            var build = JsonSerializer.Deserialize<AshenBuild>(json)
                ?? throw new InvalidOperationException("Empty build artifact");
            if (build.Format != SupportedFormat)
                throw new InvalidOperationException($"Unsupported build format '{build.Format}', expected '{SupportedFormat}'");
            return build;
        }

        /// <summary>Mechanic slugs in the order the runtime must visit them (sorted ascending, ordinal).</summary>
        public List<string> MechanicOrder()
        {
            var slugs = new List<string>(Mechanics.Keys);
            slugs.Sort(StringComparer.Ordinal);
            return slugs;
        }

        /// <summary>Mechanic bound to a tag, or null when the tag has no mechanic.</summary>
        public BuildMechanic MechanicForTag(string tag) =>
            Tags.TryGetValue(tag, out var slug) && Mechanics.TryGetValue(slug, out var m) ? m : null;

        public JsonElement Ops => Runtime.GetProperty("ops").GetProperty("ops");
    }
}
