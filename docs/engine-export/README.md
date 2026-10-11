# Engine export importers

Engine-side helpers for the JSON that `node tools/engine-export.mjs` writes to
`build/engine-export/`. The format and the import steps are documented in
[../ENGINE-EXPORT.md](../ENGINE-EXPORT.md).

| File | Engine | What it does |
| --- | --- | --- |
| [`unity/AshenSpireTable.cs`](unity/AshenSpireTable.cs) | Unity (runtime) | `ScriptableObject` that holds one table: raw rows, schema, row count, hash. `ParseRows<T>()` reads typed rows through `JsonUtility`. |
| [`unity/AshenSpireExportImporter.cs`](unity/AshenSpireExportImporter.cs) | Unity (Editor) | Menu **AshenSpire → Import Export Folder…**. Reads `manifest.json` and creates or updates one `AshenSpireTable` per table under `Assets/AshenSpire/Tables/`. It also copies the config and art manifests. |
| [`unreal/import_ashenspire.py`](unreal/import_ashenspire.py) | Unreal (Editor Python) | Creates or refills one DataTable per table listed in a struct map, through `unreal.DataTableFunctionLibrary.fill_data_table_from_json_file`. |
| [`unreal/struct_map.example.json`](unreal/struct_map.example.json) | Unreal | Example struct map: export table id → row struct path. |

These files are not compiled or run by this repository's build or CI. Copy them
into your engine project.
