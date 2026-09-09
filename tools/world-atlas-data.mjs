import { DatabaseSync } from "node:sqlite";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  renameSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { act1Enemies } from "../src/content/enemies/act1.js";
import { act2Enemies } from "../src/content/enemies/act2.js";
import { act3Enemies } from "../src/content/enemies/act3.js";
import { act1Encounters } from "../src/content/encounters/act1.js";
import { act2Encounters } from "../src/content/encounters/act2.js";
import { act3Encounters } from "../src/content/encounters/act3.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const schema = readFileSync(join(root, "tools/world-atlas-schema.sql"), "utf8");
const source = join(root, "content/source/worldAtlas.json");
const canonicalEnemies = new Set(
  [...act1Enemies, ...act2Enemies, ...act3Enemies].map((e) => e.id),
);
const canonicalEncounters = new Map(
  [...act1Encounters, ...act2Encounters, ...act3Encounters].map((e) => [
    e.id,
    e,
  ]),
);
export function createAtlasDatabase(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec(schema);
  return db;
}
const tables = (db) =>
  db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY rowid")
    .all()
    .map((r) => r.name);
const columns = (db, name) => db.prepare(`PRAGMA table_info("${name}")`).all();

/** One SQL constraint authority for DB, JSON, CSV and the ordinary content build. */
export function validateAtlasData(data) {
  const db = createAtlasDatabase();
  try {
    const names = tables(db);
    if (!data || Array.isArray(data) || typeof data !== "object")
      throw Error("worldAtlas: expected relational tables");
    for (const name of Object.keys(data))
      if (!names.includes(name))
        throw Error(`worldAtlas: unknown table ${name}`);
    db.exec("BEGIN; PRAGMA defer_foreign_keys=ON;");
    for (const name of names) {
      if (!Array.isArray(data[name]))
        throw Error(`worldAtlas: missing table ${name}`);
      const definition = columns(db, name),
        cols = definition.map((c) => c.name);
      const insert = db.prepare(
        `INSERT INTO "${name}" (${cols.map((c) => '"' + c + '"').join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
      );
      data[name].forEach((row, i) => {
        if (
          !row ||
          Object.keys(row).length !== cols.length ||
          Object.keys(row).some((c) => !cols.includes(c))
        )
          throw Error(
            `${name} row ${i + 1}: columns must be ${cols.join(", ")}`,
          );
        for (const c of definition) {
          const value = row[c.name];
          if (value === null) continue;
          if (
            (c.type === "TEXT" && typeof value !== "string") ||
            (c.type === "INTEGER" && !Number.isInteger(value)) ||
            (c.type === "REAL" &&
              (typeof value !== "number" || !Number.isFinite(value)))
          )
            throw Error(`${name} row ${i + 1}: ${c.name} must be ${c.type}`);
        }
        try {
          insert.run(...cols.map((c) => row[c]));
        } catch (e) {
          throw Error(`${name} row ${i + 1}: ${e.message}`);
        }
      });
    }
    const bad = db.prepare("PRAGMA foreign_key_check").all();
    if (bad.length)
      throw Error("worldAtlas: dangling references " + JSON.stringify(bad));
    for (const row of data.enemies)
      if (!canonicalEnemies.has(row.enemyId))
        throw Error(`Unknown enemyId ${row.enemyId}`);
    for (const row of data.encounters)
      if (!canonicalEncounters.has(row.encounterId))
        throw Error(`Unknown encounterId ${row.encounterId}`);
    for (const row of data.assets)
      if (
        !/^assets\/[a-zA-Z0-9_./-]+$/.test(row.uri) ||
        row.uri.includes("..") ||
        !existsSync(join(root, row.uri))
      )
        throw Error(`Missing or unsafe asset ${row.assetId}: ${row.uri}`);
    for (const row of data.service_handlers)
      if (!["shop", "smith", "rest", "lore"].includes(row.handlerId))
        throw Error(`Unsupported handlerId ${row.handlerId}`);
    for (const row of data.node_types)
      if (
        ![
          "start",
          "city",
          "dungeon",
          "fight",
          "shrine",
          "treasure",
          "landmark",
          "service",
          "quest",
          "gate",
          "boss",
        ].includes(row.nodeTypeId)
      )
        throw Error(`Unsupported nodeTypeId ${row.nodeTypeId}`);
    for (const row of db
      .prepare(
        "SELECT n.nodeId,e.encounterId FROM nodes n LEFT JOIN node_encounters e ON e.nodeId=n.nodeId WHERE n.nodeTypeId='dungeon'",
      )
      .all())
      if (canonicalEncounters.get(row.encounterId)?.pool !== "boss")
        throw Error(
          `Dungeon ${row.nodeId} requires an explicit boss encounter`,
        );
    if (
      db
        .prepare(
          "SELECT n.nodeId FROM world_nodes n JOIN local_map_nodes l ON n.nodeId=l.nodeId",
        )
        .all().length
    )
      throw Error("A node cannot be both a world node and a local point");
    for (const m of data.world_maps) {
      const count = data.world_map_nodes.filter(
        (n) => n.mapId === m.mapId,
      ).length;
      if (count !== m.authoringTargetNodes)
        throw Error(
          `${m.mapId}: expected ${m.authoringTargetNodes} authored nodes, found ${count}`,
        );
    }
    for (const p of data.run_profiles) {
      const anchors = data.profile_anchors
        .filter((a) => a.profileId === p.profileId)
        .sort((a, b) => a.sequence - b.sequence);
      if (anchors.map((a) => a.roleId).join(",") !== "start,hub,final")
        throw Error(
          `${p.profileId}: require ordered start, hub, final anchors`,
        );
      if (
        p.activeTarget >
        data.world_map_nodes.filter((n) => n.mapId === p.mapId).length
      )
        throw Error(`${p.profileId}: activeTarget exceeds map size`);
    }
    db.exec("COMMIT");
    return db;
  } catch (e) {
    db.close();
    throw e;
  }
}
export function atlasTables(db) {
  return Object.fromEntries(
    tables(db).map((name) => {
      const cols = columns(db, name),
        pk = cols
          .filter((c) => c.pk)
          .sort((a, b) => a.pk - b.pk)
          .map((c) => '"' + c.name + '"');
      return [
        name,
        db
          .prepare(`SELECT * FROM "${name}" ORDER BY ${pk.join(",")}`)
          .all()
          .map((r) => ({ ...r })),
      ];
    }),
  );
}
const csvCell = (v) =>
  v === null
    ? ""
    : /[,"\r\n]/.test(String(v))
      ? '"' + String(v).replaceAll('"', '""') + '"'
      : String(v);
export function parseAtlasCsv(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') {
      if (cell) throw Error("Unexpected quote in CSV");
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Unclosed CSV quote");
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}
export function exportAtlas(db, dir) {
  mkdirSync(dir, { recursive: true });
  const data = atlasTables(db);
  writeFileSync(
    join(dir, "content.json"),
    JSON.stringify(data, null, 2) + "\n",
  );
  for (const name of tables(db)) {
    const cols = columns(db, name).map((c) => c.name);
    writeFileSync(
      join(dir, name + ".csv"),
      [
        cols.join(","),
        ...data[name].map((r) => cols.map((c) => csvCell(r[c])).join(",")),
      ].join("\n") + "\n",
    );
  }
}
export function importAtlasCsv(dir) {
  const schemaDb = createAtlasDatabase();
  try {
    return Object.fromEntries(
      tables(schemaDb).map((name) => {
        const cols = columns(schemaDb, name),
          rows = parseAtlasCsv(readFileSync(join(dir, name + ".csv"), "utf8")),
          header = rows.shift();
        if (header?.join(",") !== cols.map((c) => c.name).join(","))
          throw Error(`${name}: unexpected CSV header`);
        return [
          name,
          rows.map((r, i) => {
            if (r.length !== cols.length)
              throw Error(`${name} row ${i + 2}: wrong column count`);
            return Object.fromEntries(
              cols.map((c, j) => [
                c.name,
                r[j] === ""
                  ? c.notnull
                    ? c.type === "TEXT"
                      ? ""
                      : NaN
                    : null
                  : c.type === "TEXT"
                    ? r[j]
                    : Number(r[j]),
              ]),
            );
          }),
        ];
      }),
    );
  } finally {
    schemaDb.close();
  }
}
export async function checkAtlasBuild() {
  const data = JSON.parse(readFileSync(source, "utf8"));
  const db = validateAtlasData(data);
  db.close();
  const { createAtlasIndex, generateJourney } = await import(
    "../src/model/worldAtlas.js"
  );
  const atlas = createAtlasIndex(data);
  for (const p of data.run_profiles)
    generateJourney("CONTENT-CHECK", p.profileId, atlas);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [command = "validate", ...args] = process.argv.slice(2);
  const arg = (key) => args[args.indexOf(key) + 1];
  if (command === "validate") {
    await checkAtlasBuild();
    console.log(
      "world-atlas: SQL constraints, references and handlers verified",
    );
  } else if (command === "export") {
    if (!args.includes("--dir")) throw Error("export --dir <directory>");
    const db = validateAtlasData(JSON.parse(readFileSync(source, "utf8")));
    try {
      exportAtlas(db, resolve(arg("--dir")));
    } finally {
      db.close();
    }
  } else if (command === "database") {
    if (!args.includes("--out")) throw Error("database --out <new.sqlite>");
    const dest = resolve(arg("--out"));
    if (existsSync(dest))
      throw Error(
        "Database already exists; edit it directly or choose a new path",
      );
    const data = JSON.parse(readFileSync(source, "utf8"));
    const checked = validateAtlasData(data);
    checked.close();
    const db = createAtlasDatabase(dest);
    try {
      db.exec("BEGIN; PRAGMA defer_foreign_keys=ON;");
      for (const name of tables(db)) {
        const cols = columns(db, name).map((c) => c.name);
        const stmt = db.prepare(
          `INSERT INTO "${name}" VALUES (${cols.map(() => "?").join(",")})`,
        );
        for (const row of data[name]) stmt.run(...cols.map((c) => row[c]));
      }
      db.exec("COMMIT");
    } finally {
      db.close();
    }
  } else if (command === "import") {
    if (!args.includes("--from"))
      throw Error(
        "import --from <content.json | CSV directory | database.sqlite>",
      );
    const from = resolve(arg("--from"));
    let data;
    if (from.endsWith(".json")) data = JSON.parse(readFileSync(from, "utf8"));
    else if (from.endsWith(".sqlite")) {
      const db = new DatabaseSync(from, { readOnly: true });
      try {
        data = atlasTables(db);
      } finally {
        db.close();
      }
    } else data = importAtlasCsv(from);
    const db = validateAtlasData(data);
    try {
      const normalized = atlasTables(db);
      if (args.includes("--write")) {
        writeFileSync(
          source + ".tmp",
          JSON.stringify(normalized, null, 2) + "\n",
        );
        renameSync(source + ".tmp", source);
        console.log(
          "Imported atomically. Run node tools/content-build.mjs to compile.",
        );
      } else
        console.log("Import valid. Add --write to update authored source.");
    } finally {
      db.close();
    }
  } else throw Error("Commands: validate, export, database, import");
}
