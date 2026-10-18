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

        AshenAssets(Dictionary<string, AssetEntry> assets) { _assets = assets; }

        public static AshenAssets FromBuild(AshenBuild build)
        {
            var catalog = build.Assets.GetProperty("catalog").GetProperty("assets");
            var map = catalog.Deserialize<Dictionary<string, AssetEntry>>() ?? new();
            return new AshenAssets(map);
        }

        public int Count => _assets.Count;
        public bool Has(string id) => _assets.ContainsKey(id);

        /// <summary>Relative path for an id at a preferred tier ("light" or "high"), or null when it is a placeholder.</summary>
        public string PathFor(string id, string tier)
        {
            if (!_assets.TryGetValue(id, out var entry)) return null;
            foreach (var t in tier == "light" ? LightOrder : HighOrder)
                if (entry.Files.TryGetValue(t, out var path)) return path;
            return null;
        }

        public bool IsPlaceholder(string id) => !_assets.TryGetValue(id, out var e) || e.Placeholder || e.Files.Count == 0;

        /// <summary>
        /// Addressables key for an id: "ashen/{tier}/{id}", where tier is the tier the file was found in.
        /// The importer marks each file under that key; null means "use the placeholder".
        /// </summary>
        public string AddressableKey(string id, string tier)
        {
            if (!_assets.TryGetValue(id, out var entry)) return null;
            foreach (var t in tier == "light" ? LightOrder : HighOrder)
                if (entry.Files.ContainsKey(t)) return $"ashen/{t}/{id}";
            return null;
        }

        public IEnumerable<KeyValuePair<string, AssetEntry>> All() => _assets;
    }
}
