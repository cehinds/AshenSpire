// REFERENCE CODE - not yet compiled in CI. Plain C#, no Unity API.
// Asset id -> file path per tier, from build.assets.catalog (engine/contracts/asset-catalog.schema.json).
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Ashen.Runtime
{
    public sealed class AssetEntry
    {
        [JsonPropertyName("kind")] public string Kind { get; set; }
        /// <summary>Tier ("light", "high", "common") to path relative to the game's asset root.</summary>
        [JsonPropertyName("files")] public Dictionary<string, string> Files { get; set; } = new();
        /// <summary>True when no file ships: draw the style-guide placeholder from the id.</summary>
        [JsonPropertyName("placeholder")] public bool Placeholder { get; set; }
    }

    public sealed class AshenAssets
    {
        // Mobile asks for light first; desktop and web ask for high first. "common" is one file for every tier.
        static readonly string[] LightOrder = { "light", "common", "high" };
        static readonly string[] HighOrder = { "high", "common", "light" };

        readonly Dictionary<string, AssetEntry> _assets;
        // UI slot -> catalog id; a null target is a placeholder on purpose (build.assets.aliases).
        readonly Dictionary<string, string> _aliases;

        AshenAssets(Dictionary<string, AssetEntry> assets, Dictionary<string, string> aliases) { _assets = assets; _aliases = aliases; }

        public static AshenAssets FromBuild(AshenBuild build)
        {
            var catalog = build.Assets.GetProperty("catalog").GetProperty("assets");
            var map = catalog.Deserialize<Dictionary<string, AssetEntry>>() ?? new();
            var aliases = build.Assets.TryGetProperty("aliases", out var a)
                ? a.Deserialize<Dictionary<string, string>>() ?? new() : new();
            return new AshenAssets(map, aliases);
        }

        public int Count => _assets.Count;
        public bool Has(string id) => Resolve(id) is string real && _assets.ContainsKey(real);

        /// <summary>A UI slot resolves through the alias map to its catalog id; a null alias is a placeholder on purpose (returns null). Other ids pass through.</summary>
        string Resolve(string id) => _aliases.TryGetValue(id, out var target) ? target : id;

        /// <summary>Relative path for an id at a preferred tier ("light" or "high"), or null when it is a placeholder.</summary>
        public string PathFor(string id, string tier)
        {
            if (Resolve(id) is not string real || !_assets.TryGetValue(real, out var entry)) return null;
            foreach (var t in tier == "light" ? LightOrder : HighOrder)
                if (entry.Files.TryGetValue(t, out var path)) return path;
            return null;
        }

        public bool IsPlaceholder(string id) => Resolve(id) is not string real || !_assets.TryGetValue(real, out var e) || e.Placeholder || e.Files.Count == 0;

        /// <summary>
        /// Addressables key for an id: "ashen/{tier}/{id}", where tier is the tier the file was found in.
        /// The importer marks each file under that key; null means "use the placeholder".
        /// </summary>
        public string AddressableKey(string id, string tier)
        {
            if (Resolve(id) is not string real || !_assets.TryGetValue(real, out var entry)) return null;
            foreach (var t in tier == "light" ? LightOrder : HighOrder)
                if (entry.Files.ContainsKey(t)) return $"ashen/{t}/{real}";
            return null;
        }

        public IEnumerable<KeyValuePair<string, AssetEntry>> All() => _assets;
    }
}
