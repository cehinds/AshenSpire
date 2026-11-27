// Read-only evidence input collection. Run from any cwd; no game/art outputs.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const collectionConfig =
{
    baseline: '49eca254d795d06266aa23941cb2b31fe77b27bf',
    art: 'ashenspire-hd-assets-v30',
    expectedSourceFileCount: 23,
    gitMaxBufferBytes: 8 * 1024 * 1024,
    jsonIndent: 2,
    classIds:
    [
        'reaver',
        'rogue',
        'starseer',
        'herald',
    ],
};

function normalizedHash(text)
{
    return createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
}

function verifySourceFile(file, root)
{
    const baselineText = execFileSync('git',
    [
        '-c',
        `safe.directory=${root.replace(/\\/g, '/')}`,
        '-C',
        root,
        'show',
        `${collectionConfig.baseline}:${file.path}`,
    ],
    {
        encoding: 'utf8',
        maxBuffer: collectionConfig.gitMaxBufferBytes,
    });
    const expected = normalizedHash(baselineText);
    const current = normalizedHash(readFileSync(join(root, file.path), 'utf8'));

    if (expected !== file.lfNormalizedSha256 || expected !== current)
    {
        throw new Error(`Baseline source mismatch: ${file.path}; refusing to overwrite visual evidence.`);
    }
}

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const index = JSON.parse(readFileSync(new URL('../measurements/source-hashes.json', import.meta.url), 'utf8'));

if (index.baseline !== collectionConfig.baseline || index.files.length !== collectionConfig.expectedSourceFileCount)
{
    throw new Error('Unexpected retained source-hash baseline/index.');
}

// Verify immutable Git blobs and the retained receipt before importing source or overwriting evidence.
for (const file of index.files)
{
    verifySourceFile(file, root);
}

const modules = await Promise.all(
[
    import('../../../../src/model/combatWeaponPresentation.js'),
    import('../../../../src/model/cardAnimationFamily.js'),
    import('../../../../src/content/playerHurtFrames.js'),
    import('../../../../src/content/combatBodyLandmarks.js'),
]);
const { combatWeaponProfilesFor } = modules[0];
const { alternativeCardAnimationFamily } = modules[1];
const { playerHurtFrames } = modules[2];
const { COMBAT_BODY_LANDMARKS } = modules[3];
const classes = {};

for (const classId of collectionConfig.classIds)
{
    const profiles = combatWeaponProfilesFor({ classId });
    const animation = alternativeCardAnimationFamily(classId, profiles);
    const poses =
    {
        ready: animation.frames.ready,
        ...animation.heldFrames,
    };

    for (const name of animation.family.sequences.sweep.poses)
    {
        if (animation.frames[name])
        {
            poses[name] = animation.frames[name];
        }
    }

    classes[classId] =
    {
        profiles,
        poses,
        hurt: playerHurtFrames[classId],
        sweep: animation.family.sequences.sweep,
    };
}

const selectedPaths = Object.values(classes).flatMap((classData) =>
{
    return Object.values(classData.poses).map((pose) =>
    {
        return pose.path;
    });
});
const paths = new Set(selectedPaths);
const measuredPaths = [...paths].filter((path) =>
{
    return COMBAT_BODY_LANDMARKS[path];
});
const landmarkEntries = measuredPaths.map((path) =>
{
    return [path, COMBAT_BODY_LANDMARKS[path]];
});
const landmarks = Object.fromEntries(landmarkEntries);
const output =
{
    source: collectionConfig.baseline,
    art: collectionConfig.art,
    classes,
    landmarks,
};

writeFileSync(fileURLToPath(new URL('visual-inputs.json', import.meta.url)), JSON.stringify(output, null, collectionConfig.jsonIndent) + '\n');
console.log(`Verified ${index.files.length} owning source files against ${collectionConfig.baseline}; collected ${paths.size} unique selected images and ${Object.keys(landmarks).length} landmark records.`);
