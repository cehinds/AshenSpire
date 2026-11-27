// Read-only published-build observation. Does not download art or change releases.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const observationConfig =
{
    channels: ['test', 'dev'],
    markerKinds:
    [
        'SOURCE',
        'ORDINAL',
        'DATE',
        'EDITION',
    ],
    artTag: 'ashenspire-hd-assets-v30',
    jsonIndent: 2,
};

function readBuildMarker(html, kind)
{
    const expression = new RegExp('/\\* BUILD_' + kind + '_START \\*/([\\s\\S]*?)/\\* BUILD_' + kind + '_END \\*/');
    return html.match(expression)?.[1].trim() || null;
}

function digest(bytes)
{
    return createHash('sha256').update(bytes).digest('hex');
}

const observedAt = new Date().toISOString();
const observations = [];

for (const channel of observationConfig.channels)
{
    const url = `https://cehinds.github.io/AshenSpire/${channel}/latest/`;
    const response = await fetch(url);
    const html = await response.text();
    const badge = await fetch(url + 'build.svg');
    const svg = await badge.text();
    const markerEntries = observationConfig.markerKinds.map((kind) =>
    {
        return [kind, readBuildMarker(html, kind)];
    });
    const markers = Object.fromEntries(markerEntries);

    observations.push(
    {
        channel,
        observedAt,
        url,
        status: response.status,
        badgeStatus: badge.status,
        publishedBuild: svg.match(/Published build ([^"]+)/)?.[1],
        byteLength: Buffer.byteLength(html),
        htmlSha256: digest(html),
        lastModified: response.headers.get('last-modified'),
        etag: response.headers.get('etag'),
        markers,
        embeddedArtTag: html.includes(observationConfig.artTag)
            ? observationConfig.artTag
            : null,
        owningGameGitCommit: null,
        provenanceNote: 'SOURCE is a content digest, not a Git SHA. Unrelated sourceCommit fields inside art catalogs do not identify the game commit. Art pack release tag not found in game HTML when embeddedArtTag is null.',
    });
}

const serializedObservations = JSON.stringify(observations, null, observationConfig.jsonIndent);

writeFileSync(new URL('published-baseline.json', import.meta.url), serializedObservations + '\n');
console.log(serializedObservations);
