"""import_ashenspire.py - Unreal Editor importer for the Ashen Spire engine export.

Run inside the Unreal Editor (Python Editor Script Plugin enabled):

    py "C:/path/to/import_ashenspire.py" --export "C:/path/to/build/engine-export" \
        --structs "C:/path/to/struct_map.json" --dest /Game/AshenSpire/Data

or from the Output Log's Python console after editing the defaults below.

An Unreal DataTable needs a row struct (USTRUCT deriving FTableRowBase, or a
Blueprint User Defined Struct) whose fields match the JSON columns. The
`Name` column of every exported row is the DataTable row name. The struct map
is a JSON object from export table id to struct path, for example:

    {
      "content.cards":   "/Script/MyGame.AshenCardRow",
      "content.enemies": "/Game/AshenSpire/Structs/S_Enemy.S_Enemy"
    }

Tables not in the map are skipped and listed at the end. Columns the struct
does not declare are ignored by the JSON importer (Unreal logs a warning);
the matching schemas/<id>.schema.json lists every column and its type.
"""

import argparse
import json
import os
import sys

import unreal

FORMAT = "ashenspire.engine-export/1"

# Defaults for running from the Python console without arguments.
DEFAULT_EXPORT = ""
DEFAULT_STRUCTS = ""
DEFAULT_DEST = "/Game/AshenSpire/Data"


def asset_name(table_id):
    """content.cards -> DT_content_cards (asset names may not contain dots)."""
    return "DT_" + "".join(c if c.isalnum() else "_" for c in table_id)


def load_struct(path):
    struct = unreal.load_object(None, path)
    if struct is None:
        raise RuntimeError("row struct not found: " + path)
    return struct


def ensure_data_table(dest, name, struct):
    path = dest.rstrip("/") + "/" + name
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        table = unreal.EditorAssetLibrary.load_asset(path)
        if isinstance(table, unreal.DataTable):
            return table
        raise RuntimeError(path + " exists and is not a DataTable")
    factory = unreal.DataTableFactory()
    factory.struct = struct
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    return tools.create_asset(name, dest, unreal.DataTable, factory)


def import_export(export_dir, struct_map, dest):
    manifest_path = os.path.join(export_dir, "manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)
    if manifest.get("format") != FORMAT:
        raise RuntimeError("manifest format is %r, expected %r" % (manifest.get("format"), FORMAT))

    imported, skipped = [], []
    tables = manifest.get("tables", [])
    with unreal.ScopedSlowTask(len(tables), "Importing Ashen Spire tables") as task:
        task.make_dialog(True)
        for entry in tables:
            if task.should_cancel():
                break
            task.enter_progress_frame(1, entry["id"])
            struct_path = struct_map.get(entry["id"])
            if not struct_path:
                skipped.append(entry["id"])
                continue
            struct = load_struct(struct_path)
            table = ensure_data_table(dest, asset_name(entry["id"]), struct)
            json_file = os.path.join(export_dir, entry["file"])
            ok = unreal.DataTableFunctionLibrary.fill_data_table_from_json_file(table, json_file, struct)
            if not ok:
                unreal.log_error("AshenSpire: %s did not import from %s" % (entry["id"], json_file))
                continue
            unreal.EditorAssetLibrary.save_loaded_asset(table)
            imported.append(entry["id"])

    unreal.log("AshenSpire: imported %d tables into %s (export %s, build %s)" % (
        len(imported), dest, manifest.get("version"), manifest.get("buildOrdinal")))
    if skipped:
        unreal.log_warning("AshenSpire: no struct mapped for %d tables: %s" % (len(skipped), ", ".join(skipped)))
    return imported, skipped


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--export", default=DEFAULT_EXPORT, help="folder holding manifest.json")
    parser.add_argument("--structs", default=DEFAULT_STRUCTS, help="JSON file: table id -> struct path")
    parser.add_argument("--dest", default=DEFAULT_DEST, help="content folder for the DataTables")
    args = parser.parse_args(argv)
    if not args.export or not args.structs:
        parser.error("--export and --structs are required")
    with open(args.structs, "r", encoding="utf-8") as fh:
        struct_map = json.load(fh)
    import_export(args.export, struct_map, args.dest)


if __name__ == "__main__":
    main(sys.argv[1:])
