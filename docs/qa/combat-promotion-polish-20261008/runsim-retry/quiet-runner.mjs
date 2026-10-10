import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const root = 'D:/repos/.codex/worktrees/combat-expansion-runtime/AshenSpire';
const output = 'D:/repos/.codex/outputs/combat-card-stances/regular-polish-1151-quiet-runsim';
const { RUNSIM_FLEET_TIMEOUT_MS, completedFleet } = await import(pathToFileURL(path.join(root, 'tools/runsim-selftest-policy.mjs')));
const sourcePaths = ['tools/runsim.mjs', 'tools/simbot.mjs', 'tools/simrun.mjs', 'tools/runsim-selftest-policy.mjs', 'src/engine/combat.js', 'src/engine/actions.js', 'src/model/formulas.js'];
const sourceIdentity = () => Object.fromEntries(sourcePaths.map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const load = () => JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', `
$now=Get-Date
$processes=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'tools[/\\\\](bundle|launch|runsim|measure-classes)|--test-concurrency|--test --test-reporter' } | ForEach-Object { [pscustomobject]@{pid=$_.ProcessId;parentPid=$_.ParentProcessId;createdAt=$_.CreationDate.ToString('o');cpuSeconds=($_.KernelModeTime+$_.UserModeTime)/10000000;workingSetBytes=$_.WorkingSetSize;command=$_.CommandLine} })
$cpu=Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor | Where-Object Name -eq '_Total'
$mem=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
$disk=Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk | Where-Object Name -eq '_Total'
[pscustomobject]@{capturedAt=$now.ToString('o');watchedProcesses=$processes;cpuPercent=$cpu.PercentProcessorTime;memoryAvailableMB=$mem.AvailableMBytes;diskQueueLength=$disk.CurrentDiskQueueLength;diskBytesPerSecond=$disk.DiskBytesPersec} | ConvertTo-Json -Depth 5 -Compress
`], { encoding: 'utf8', timeout: 20000 }).trim());
fs.mkdirSync(output, { recursive: true });
const before = { head: head(), sourceHashes: sourceIdentity(), load: load() };
fs.writeFileSync(path.join(output, 'before.json'), JSON.stringify(before, null, 2) + '\n');
const startedAt = new Date().toISOString();
const started = performance.now();
const result = spawnSync(process.execPath, ['tools/runsim.mjs', '5'], { cwd: root, encoding: 'utf8', timeout: RUNSIM_FLEET_TIMEOUT_MS, maxBuffer: 1 << 24 });
const elapsedMs = performance.now() - started;
fs.writeFileSync(path.join(output, 'stdout.log'), result.stdout || '');
fs.writeFileSync(path.join(output, 'stderr.log'), result.stderr || '');
const after = { head: head(), sourceHashes: sourceIdentity(), load: load() };
fs.writeFileSync(path.join(output, 'after.json'), JSON.stringify(after, null, 2) + '\n');
const resultLines = (result.stdout || '').match(/^RESULT: .*$/gm) || [];
const classRows = (result.stdout || '').match(/^\S+\s+full-run wins\s+\d+\/5\s+.*$/gm) || [];
const policyComplete = completedFleet(result);
const exactFleet = resultLines.length === 1 && /^RESULT: 20 runs over 4 classes \(5 fixed seeds each\), every one to a win or a death — \d+ wins, 0 crashes, 0 soft-locks\.$/.test(resultLines[0]) && classRows.length === 4;
const sourceUnchanged = JSON.stringify(before.sourceHashes) === JSON.stringify(after.sourceHashes);
const receipt = { label: 'Quiet unchanged simulator fleet; local source verification only', wrapperPid: process.pid, startedAt, finishedAt: new Date().toISOString(), elapsedMs, command: [process.execPath, 'tools/runsim.mjs', '5'], cwd: root, timeoutMs: RUNSIM_FLEET_TIMEOUT_MS, status: result.status, signal: result.signal, error: result.error ? { code: result.error.code, message: result.error.message } : null, policyComplete, exactFleet, sourceUnchanged, resultLines, classRows, before, after, passed: policyComplete && exactFleet && sourceUnchanged };
fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ passed: receipt.passed, elapsedMs, timeoutMs: RUNSIM_FLEET_TIMEOUT_MS, status: result.status, signal: result.signal, error: receipt.error, resultLines, sourceUnchanged, beforeWatchedProcesses: before.load.watchedProcesses.length, afterWatchedProcesses: after.load.watchedProcesses.length, receipt: path.join(output, 'receipt.json') }));
process.exitCode = receipt.passed ? 0 : 1;
