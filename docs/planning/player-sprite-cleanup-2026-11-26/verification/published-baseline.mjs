// Read-only published-build observation. Does not download art or change releases.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const observedAt = new Date().toISOString();
const observations = [];
for (const channel of ['test', 'dev']) {
  const url = `https://cehinds.github.io/AshenSpire/${channel}/latest/`;
  const response = await fetch(url);
  const html = await response.text();
  const badge = await fetch(url + 'build.svg');
  const svg = await badge.text();
  const marker = kind => html.match(new RegExp('/\\* BUILD_' + kind + '_START \\*/([\\s\\S]*?)/\\* BUILD_' + kind + '_END \\*/'))?.[1].trim() || null;
  const markers=Object.fromEntries(['SOURCE','ORDINAL','DATE','EDITION'].map(kind=>[kind,marker(kind)]));
  observations.push({ channel, observedAt, url, status: response.status,
    badgeStatus: badge.status, publishedBuild: svg.match(/Published build ([^"]+)/)?.[1],
    byteLength: Buffer.byteLength(html), htmlSha256: createHash('sha256').update(html).digest('hex'),
    lastModified: response.headers.get('last-modified'), etag: response.headers.get('etag'), markers,
    embeddedArtTag: html.includes('ashenspire-hd-assets-v30')?'ashenspire-hd-assets-v30':null,
    owningGameGitCommit: null,
    provenanceNote: 'SOURCE is a content digest, not a Git SHA. Unrelated sourceCommit fields inside art catalogs do not identify the game commit. Art pack release tag not found in game HTML when embeddedArtTag is null.' });
}
writeFileSync(new URL('published-baseline.json', import.meta.url), JSON.stringify(observations, null, 2) + '\n');
console.log(JSON.stringify(observations, null, 2));
