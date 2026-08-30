import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installPackage, planInstall, rollbackPackage, upgradePackage, validatePackageManifest, verifyInstall } from "./pipeline-pilot-install.mjs";

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "task-pipeline-install-"));
try {
  const plan = planInstall(temporary);
  assert.equal(plan.writable, true);
  assert.equal(plan.files.length, 8);
  const validManifest = { schema: "task-pipeline-package/v1", install_root: ".task-pipeline", files: ["stable/A.json"] };
  assert.throws(() => validatePackageManifest({ ...validManifest, install_root: "../outside" }), /installation root/);
  assert.throws(() => validatePackageManifest({ ...validManifest, files: ["stable/A.json", "stable/A.json"] }), /duplicate/);
  assert.throws(() => validatePackageManifest({ ...validManifest, files: ["../outside"] }), /package path/);

  const installed = installPackage(temporary);
  assert.equal(installed.action, "installed");
  assert.equal(verifyInstall(temporary).valid, true);
  assert.equal(upgradePackage(temporary).reason, "same-version");
  assert.throws(() => installPackage(temporary), /already exists/);

  const statePath = path.join(temporary, ".task-pipeline", ".install-state.json");
  const originalState = fs.readFileSync(statePath, "utf8");
  const tamperedState = JSON.parse(originalState);
  tamperedState.files[0].sha256 = "0".repeat(64);
  fs.writeFileSync(statePath, `${JSON.stringify(tamperedState, null, 2)}\n`);
  assert.throws(() => verifyInstall(temporary), /signed package file set/);
  fs.writeFileSync(statePath, originalState);

  const installedRoot = path.join(temporary, ".task-pipeline");
  const stableCharacters = ["stable/PIPELINE_KERNEL.md", "stable/AUTHORITY.json", "stable/RISK_ROUTES.json"].reduce((sum, relative) => sum + fs.readFileSync(path.join(installedRoot, relative), "utf8").length, 0);
  const codexCharacters = fs.readFileSync(path.join(installedRoot, "startup", "START_HERE.md"), "utf8").length + fs.readFileSync(path.join(installedRoot, "startup", "CODEX.md"), "utf8").length;
  assert.ok(stableCharacters < 6000, `stable bootstrap too large: ${stableCharacters}`);
  assert.ok(codexCharacters < 3000, `Codex startup pointers too large: ${codexCharacters}`);

  const kernel = path.join(temporary, ".task-pipeline", "stable", "PIPELINE_KERNEL.md");
  fs.appendFileSync(kernel, "drift\n");
  assert.throws(() => verifyInstall(temporary), /drift/);
  assert.throws(() => rollbackPackage(temporary), /drift/);
  fs.copyFileSync(".agentops/pipeline-pilot/package/templates/stable/PIPELINE_KERNEL.md", kernel);

  const rolledBack = rollbackPackage(temporary);
  assert.equal(rolledBack.action, "rolled-back");
  assert.equal(fs.existsSync(path.join(temporary, ".task-pipeline")), false);
  console.log(`PASS 16/16; package-files=${plan.files.length}; stable-chars=${stableCharacters}; codex-startup-chars=${codexCharacters}; path-hardening=3/3; state-tamper-safe=yes; install=verified; same-version-upgrade=no-op; drift-safe=yes; rollback=verified`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
