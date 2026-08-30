import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourceRoot = path.resolve(".agentops", "pipeline-pilot", "package");

function canonicalDirectory(target) {
  const resolved = path.resolve(target);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) throw new Error("target must be an existing directory");
  const real = fs.realpathSync.native(resolved);
  const comparable = (value) => process.platform === "win32" ? path.normalize(value).toLowerCase() : path.normalize(value);
  if (comparable(real) !== comparable(resolved)) throw new Error("target must not traverse a symbolic link or junction");
  return resolved;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

export function validatePackageManifest(value) {
  if (value.schema !== "task-pipeline-package/v1" || !Array.isArray(value.files) || value.files.length === 0) throw new Error("invalid package manifest");
  if (value.install_root !== ".task-pipeline") throw new Error("invalid installation root");
  if (new Set(value.files).size !== value.files.length) throw new Error("duplicate package file");
  for (const relative of value.files) {
    if (typeof relative !== "string" || relative.includes("\\") || path.posix.isAbsolute(relative) || path.posix.normalize(relative) !== relative || relative.startsWith("../")) throw new Error(`invalid package path ${relative}`);
  }
  return value;
}

function manifest() {
  return validatePackageManifest(JSON.parse(fs.readFileSync(path.join(sourceRoot, "manifest.json"), "utf8")));
}

function sourceFile(relative) {
  const file = path.resolve(sourceRoot, "templates", relative);
  const templatesRoot = path.resolve(sourceRoot, "templates") + path.sep;
  if (!file.startsWith(templatesRoot) || !fs.statSync(file).isFile()) throw new Error(`invalid package file ${relative}`);
  return file;
}

function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .sort();
}

export function planInstall(target) {
  const definition = manifest();
  const targetRoot = canonicalDirectory(target);
  const installRoot = path.join(targetRoot, definition.install_root);
  return {
    action: "install",
    version: definition.version,
    target: installRoot,
    writable: !fs.existsSync(installRoot),
    files: definition.files.map((relative) => ({ relative, sha256: sha256(sourceFile(relative)) }))
  };
}

export function installPackage(target) {
  const plan = planInstall(target);
  if (!plan.writable) throw new Error("installation root already exists");
  fs.mkdirSync(plan.target, { recursive: false });
  try {
    for (const item of plan.files) {
      const destination = path.join(plan.target, item.relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(sourceFile(item.relative), destination, fs.constants.COPYFILE_EXCL);
    }
    const state = {
      schema: "task-pipeline-install-state/v1",
      version: plan.version,
      files: plan.files
    };
    fs.writeFileSync(path.join(plan.target, ".install-state.json"), `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return { ...plan, action: "installed" };
  } catch (error) {
    fs.rmSync(plan.target, { recursive: true, force: true });
    throw error;
  }
}

export function verifyInstall(target) {
  const definition = manifest();
  const installRoot = path.join(canonicalDirectory(target), definition.install_root);
  const statePath = path.join(installRoot, ".install-state.json");
  if (fs.existsSync(installRoot) && fs.lstatSync(installRoot).isSymbolicLink()) throw new Error("installation root must not be a symbolic link");
  if (!fs.existsSync(statePath)) throw new Error("install state is missing");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  if (state.schema !== "task-pipeline-install-state/v1") throw new Error("invalid install state");
  const packageFiles = definition.files.map((relative) => ({ relative, sha256: sha256(sourceFile(relative)) }));
  if (state.version !== definition.version || JSON.stringify(state.files) !== JSON.stringify(packageFiles)) throw new Error("install state does not match the signed package file set");
  const expected = [...state.files.map((item) => item.relative), ".install-state.json"].sort();
  const actual = listFiles(installRoot);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("installation contains unlisted or missing files");
  for (const item of state.files) {
    const actualHash = sha256(path.join(installRoot, item.relative));
    if (actualHash !== item.sha256) throw new Error(`installed file drift: ${item.relative}`);
  }
  return { valid: true, version: state.version, target: installRoot, files: state.files.length };
}

export function upgradePackage(target) {
  const current = verifyInstall(target);
  const available = manifest().version;
  if (current.version === available) return { action: "no-op", reason: "same-version", version: available, target: current.target };
  throw new Error(`upgrade from ${current.version} to ${available} requires a version-specific migration`);
}

export function rollbackPackage(target) {
  const current = verifyInstall(target);
  fs.rmSync(current.target, { recursive: true, force: false });
  return { action: "rolled-back", version: current.version, target: current.target, removed_files: current.files + 1 };
}

function parseArgs(argv) {
  const command = argv[2] ?? "plan";
  const targetIndex = argv.indexOf("--target");
  if (targetIndex === -1 || !argv[targetIndex + 1]) throw new Error("usage: pipeline-pilot-install.mjs <plan|install|verify|upgrade|rollback> --target <directory>");
  return { command, target: argv[targetIndex + 1] };
}

function main() {
  const { command, target } = parseArgs(process.argv);
  const actions = { plan: planInstall, install: installPackage, verify: verifyInstall, upgrade: upgradePackage, rollback: rollbackPackage };
  if (!actions[command]) throw new Error(`unknown command ${command}`);
  console.log(JSON.stringify(actions[command](target), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
