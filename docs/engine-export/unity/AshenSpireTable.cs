// AshenSpireTable.cs — one table of the Ashen Spire engine export as a Unity
// asset. AshenSpireExportImporter (Editor) creates and updates these. Keep this
// file OUTSIDE an Editor folder, in a file of this name, so the assets load in
// player builds.
//
// JsonUtility cannot parse a top-level JSON array, so ParseRows wraps the
// array as {"rows": [...]} first. Declare a [Serializable] row class whose
// public fields are named like the columns you need (schemaJson lists them;
// every row has a string `Name`) and call table.ParseRows<MyRow>(). Nested
// objects need nested [Serializable] classes; shapes JsonUtility cannot map
// (dictionaries, mixed-type arrays) stay readable from rowsJson with any JSON
// library.

using System;
using UnityEngine;

namespace AshenSpire.EngineExport
{
    [CreateAssetMenu(menuName = "AshenSpire/Table", fileName = "AshenSpireTable")]
    public class AshenSpireTable : ScriptableObject
    {
        public string tableId;
        public int rowCount;
        public string sha256;
        public string[] omittedFunctions = new string[0];
        [TextArea(3, 20)] public string rowsJson;
        [TextArea(3, 20)] public string schemaJson;

        [Serializable]
        private class Wrapper<T> { public T[] rows; }

        /// <summary>Rows as T[]; T is a [Serializable] class with public fields named like the columns.</summary>
        public T[] ParseRows<T>()
        {
            if (string.IsNullOrEmpty(rowsJson)) return new T[0];
            var wrapped = JsonUtility.FromJson<Wrapper<T>>("{\"rows\":" + rowsJson + "}");
            return wrapped != null && wrapped.rows != null ? wrapped.rows : new T[0];
        }
    }
}
