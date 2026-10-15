// Trusted Pages collector: download data only; never run a feature checkout.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, lstatSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { safeBranchDir } from './pages-site.mjs';

const shaPattern = /^[a-f0-9]{40}$/;
export const documentationOnly = (file) => file === 'README.md' || file === 'CONTRIBUTING.md' || file.startsWith('docs/');

// GitHub exposes at most 300 comparison files. At that boundary we cannot prove
// completeness, even when all returned names happen to be documentation.
export async function freshBuild(api, repo, built, head) {
  if (!shaPattern.test(built) || !shaPattern.test(head)) return false;
  if (built === head) return true;
  const result = await api(`repos/${repo}/compare/${built}...${head}?per_page=100&page=1`);
  return result.status === 'ahead' && result.merge_base_commit?.sha === built
    && result.total_commits > 0 && Array.isArray(result.files)
    && result.files.length > 0 && result.files.length < 300
    && result.files.every((f) => documentationOnly(f.filename) && (!f.previous_filename || documentationOnly(f.previous_filename)));
}

export async function collectFeaturePreviews({ repo, out, api, download, warn = console.warn }) {
  if (!repo || !out) throw new Error('repo and output directory are required');
  // Listing/API failures propagate: publishing an incomplete inventory would
  // silently remove live previews. A bad individual artifact is only skipped.
  const pages = async (path, key) => {
    const rows = [];
    for (let page = 1; ; page++) {
      const data = await api(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      const batch = key ? data[key] : data;
      if (!Array.isArray(batch)) throw new Error(`invalid API list: ${path}`);
      rows.push(...batch);
      if (batch.length < 100) return rows;
    }
  };
  const branches = (await pages(`repos/${repo}/branches`)).filter((b) => /^(feature|fix|chore)\//i.test(b.name));
  const manifest = join(out, 'previews.json');
  const original = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).previews : [];
  if (!Array.isArray(original)) throw new Error('invalid existing previews manifest');
  let entries = [...original];
  for (const branch of branches) {
    let dir;
    try { dir = safeBranchDir(branch.name); } catch (error) { warn(error.message); continue; }
    const runs = await pages(`repos/${repo}/actions/workflows/feature-preview.yml/runs?branch=${encodeURIComponent(branch.name)}`, 'workflow_runs');
    const successful = runs.filter((r) => r.conclusion === 'success' && r.head_branch === branch.name).sort((a, b) => b.id - a.id);
    let selected;
    for (const run of successful) {
      if (await freshBuild(api, repo, run.head_sha, branch.commit.sha)) { selected = run; break; }
    }
    // Existing PR entries for other branches survive. For this branch, an old
    // PR build cannot bypass the current feature pipeline's freshness decision.
    if (runs.length) entries = entries.filter((e) => e.branch !== branch.name);
    if (!selected) continue;
    const artifacts = await pages(`repos/${repo}/actions/runs/${selected.id}/artifacts`, 'artifacts');
    const artifact = artifacts.find((a) => a.name === `feature-preview-${selected.head_sha}` && !a.expired);
    if (!artifact) { warn(`${branch.name}: feature artifact missing or expired`); continue; }
    const destination = join(out, dir);
    rmSync(destination, { recursive: true, force: true });
    mkdirSync(destination, { recursive: true });
    try {
      try { await download(selected.id, artifact.name, destination); }
      catch (error) {
        if (!/HTTP 410|expired/i.test(`${error.message} ${error.stderr || ''}`)) throw Object.assign(error, { collectionFailure: true });
        throw error;
      }
      const html = readdirSync(destination).filter((f) => f.endsWith('.html'));
      if (html.length !== 1 || !lstatSync(join(destination, html[0])).isFile() || !lstatSync(join(destination, html[0])).size) throw new Error('expected exactly one non-empty regular HTML file');
      entries = entries.filter((e) => e.branch !== branch.name);
      entries.push({ branch: branch.name, dir, sha: selected.head_sha, pr: original.find((e) => e.branch === branch.name)?.pr || 0 });
    } catch (error) {
      rmSync(destination, { recursive: true, force: true });
      if (error.collectionFailure) throw error;
      warn(`${branch.name}: feature artifact skipped: ${error.message}`);
    }
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(manifest, JSON.stringify({ previews: entries }));
  return entries;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const repo = process.env.REPO || process.env.GITHUB_REPOSITORY;
  const out = process.argv[2];
  collectFeaturePreviews({ repo, out,
    api: async (path) => JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })),
    download: async (id, name, dir) => execFileSync('gh', ['run', 'download', String(id), '--repo', repo, '--name', name, '--dir', dir], { stdio: 'pipe' }),
  }).catch((error) => { console.error(error); process.exitCode = 1; });
}
