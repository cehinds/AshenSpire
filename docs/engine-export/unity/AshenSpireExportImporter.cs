// AshenSpireExportImporter.cs — Unity Editor importer for the Ashen Spire
// engine export (tools/engine-export.mjs, format "ashenspire.engine-export/1").
//
// Put this file in any Editor folder of a Unity project (for example
// Assets/Editor/AshenSpireExportImporter.cs), and AshenSpireTable.cs in a
// runtime folder (for example Assets/AshenSpire/Scripts/AshenSpireTable.cs):
// Unity needs a ScriptableObject in a file of its own name, outside Editor/,
// for the assets to load in a player build. Then use the menu
// "AshenSpire/Import Export Folder…" and pick the folder that holds
// manifest.json (build/engine-export/ by default).
//
// For every table in the manifest it creates or updates one AshenSpireTable
// asset under Assets/AshenSpire/Tables/, holding the table's raw JSON, its row
// count, its schema JSON and its hash. Config files are copied as .json
// TextAssets under Assets/AshenSpire/Config/, and the art manifests under
// Assets/AshenSpire/Art/. Only UnityEngine and UnityEditor are used.
//
// Pruning is by ownership, like the Unreal importer. After each successful
// import the importer writes Assets/AshenSpire/.ashenspire-import.json, listing
// the assets it created or updated. The next import deletes only the listed
// assets that the new manifest no longer has. Assets you made by hand in those
// folders are never listed, so they are kept. With no record (a first import,
// or an upgrade from an importer that wrote none) nothing is pruned.
// Reading rows at runtime: AshenSpireTable.ParseRows<T>().

#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace AshenSpire.EngineExport
{
    [Serializable]
    internal class ManifestTable
    {
        public string id;
        public string file;
        public string schema;
        public int rows;
        public string sha256;
        public string[] omittedFunctions;
    }

    [Serializable]
    internal class ManifestFile
    {
        public string id;
        public string source;
        public string file;
        public string sha256;
    }

    [Serializable]
    internal class Manifest
    {
        public string format;
        public string version;
        public string release;
        public int buildOrdinal;
        public string gitSha;
        public string rowKey;
        public ManifestTable[] tables;
        public ManifestFile[] config;
        public ManifestFile[] art;
    }

    // Written after every successful import: the asset paths that import created
    // or updated. The next import prunes only the paths listed here.
    [Serializable]
    internal class ImportRecord
    {
        public string[] paths;
    }

    public static class AshenSpireExportImporter
    {
        public const string Format = "ashenspire.engine-export/1";
        private const string Root = "Assets/AshenSpire";
        // A dot-prefixed name is hidden from Unity's asset database, so the record is not an asset.
        private const string RecordPath = Root + "/.ashenspire-import.json";

        [MenuItem("AshenSpire/Import Export Folder…")]
        public static void ImportFromMenu()
        {
            var folder = EditorUtility.OpenFolderPanel("Ashen Spire export folder (holds manifest.json)", "", "");
            if (string.IsNullOrEmpty(folder)) return;
            try
            {
                var count = Import(folder);
                Debug.Log("AshenSpire: imported " + count + " tables from " + folder);
            }
            catch (Exception e)
            {
                Debug.LogError("AshenSpire: import failed — " + e.Message);
                EditorUtility.DisplayDialog("Ashen Spire import failed", e.Message, "OK");
            }
            finally
            {
                EditorUtility.ClearProgressBar();
            }
        }

        /// <summary>Imports an export folder; returns the number of tables imported.</summary>
        public static int Import(string folder)
        {
            var manifestPath = Path.Combine(folder, "manifest.json");
            if (!File.Exists(manifestPath)) throw new FileNotFoundException("no manifest.json in " + folder);
            var manifest = JsonUtility.FromJson<Manifest>(File.ReadAllText(manifestPath));
            if (manifest == null || manifest.format != Format)
                throw new InvalidDataException("manifest format is '" + (manifest == null ? "?" : manifest.format) + "', expected '" + Format + "'");

            EnsureFolder(Root);
            EnsureFolder(Root + "/Tables");
            EnsureFolder(Root + "/Config");
            EnsureFolder(Root + "/Art");

            var tables = manifest.tables ?? new ManifestTable[0];
            var imported = new HashSet<string>();
            AssetDatabase.StartAssetEditing();
            try
            {
                for (var i = 0; i < tables.Length; i++)
                {
                    var t = tables[i];
                    EditorUtility.DisplayProgressBar("Ashen Spire import", t.id, (float)i / Math.Max(1, tables.Length));
                    var assetPath = Root + "/Tables/" + t.id + ".asset";
                    imported.Add(assetPath);
                    var table = AssetDatabase.LoadAssetAtPath<AshenSpireTable>(assetPath);
                    var created = table == null;
                    if (created) table = ScriptableObject.CreateInstance<AshenSpireTable>();
                    table.tableId = t.id;
                    table.rowCount = t.rows;
                    table.sha256 = t.sha256;
                    table.omittedFunctions = t.omittedFunctions ?? new string[0];
                    table.rowsJson = File.ReadAllText(Path.Combine(folder, t.file));
                    table.schemaJson = string.IsNullOrEmpty(t.schema) ? "" : File.ReadAllText(Path.Combine(folder, t.schema));
                    if (created) AssetDatabase.CreateAsset(table, assetPath);
                    else EditorUtility.SetDirty(table);
                }
                // Config objects and art manifests stay JSON: copied as TextAssets.
                imported.UnionWith(CopyAll(folder, manifest.config, Root + "/Config", false));
                imported.UnionWith(CopyAll(folder, manifest.art, Root + "/Art", true));
                // Prune only what an earlier import recorded and this manifest no
                // longer lists (a removed or renamed table). Files the user made in
                // these folders are not in the record, so they are never deleted.
                // No record (first run, or an upgrade from an older importer) prunes nothing.
                var previous = ReadRecord();
                if (previous != null)
                    foreach (var stale in previous)
                        if (stale.StartsWith(Root + "/") && !imported.Contains(stale))
                            AssetDatabase.DeleteAsset(stale);
            }
            finally
            {
                AssetDatabase.StopAssetEditing();
            }
            WriteRecord(imported);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            return tables.Length;
        }

        // Returns the paths the previous import recorded, or null when there is no readable record.
        private static HashSet<string> ReadRecord()
        {
            if (!File.Exists(RecordPath)) return null;
            try
            {
                var record = JsonUtility.FromJson<ImportRecord>(File.ReadAllText(RecordPath));
                return record == null || record.paths == null ? null : new HashSet<string>(record.paths);
            }
            catch (ArgumentException)
            {
                return null;
            }
        }

        private static void WriteRecord(HashSet<string> imported)
        {
            var paths = new List<string>(imported);
            paths.Sort(StringComparer.Ordinal);
            var record = new ImportRecord { paths = paths.ToArray() };
            File.WriteAllText(RecordPath, JsonUtility.ToJson(record, true));
        }

        private static HashSet<string> CopyAll(string folder, ManifestFile[] files, string target, bool keepTree)
        {
            var written = new HashSet<string>();
            if (files == null) return written;
            foreach (var f in files)
            {
                // art/asset-data/x/manifest.json keeps its tree; config/<id>.json is flat.
                var rel = keepTree && f.file.StartsWith("art/") ? f.file.Substring(4) : Path.GetFileName(f.file);
                var dest = Path.Combine(target, rel).Replace('\\', '/');
                var dir = Path.GetDirectoryName(dest);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
                File.Copy(Path.Combine(folder, f.file), dest, true);
                written.Add(dest);
            }
            return written;
        }

        private static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            var parent = Path.GetDirectoryName(path).Replace('\\', '/');
            EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, Path.GetFileName(path));
        }
    }
}
#endif
