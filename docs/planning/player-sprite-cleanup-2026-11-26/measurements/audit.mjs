// Planning audit: read game catalogs and pinned rasters; write sibling evidence.
// Run from any directory with Node and Python/Pillow.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const outputDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(outputDirectory, '../../../..');
const baseline = '49eca254d795d06266aa23941cb2b31fe77b27bf';
const release = 'ashenspire-hd-assets-v30';
const snapshotAnchor = '94f46215e72';
const snapshotFilename = 'raster-hashes.json';
const snapshotRelative = 'docs/planning/player-sprite-cleanup-2026-11-26/measurements/raster-hashes.json';
const expectedRasterCount = 330;
const sha256HexLength = 64;
const sha256Pattern = /^[a-f0-9]{64}$/;
const coordinatePrecision = 9;
const jsonIndentation = 2;
const maxEvidenceBytes = 256 * 1024;
const maxPythonOutputBytes = 8 * 1024 * 1024;
const defaultCacheDirectory = 'C:/repos/AshenSpire/.art-cache/ashenspire-hd-assets-v30';
const classIds =
[
  'reaver',
  'rogue',
  'starseer',
  'herald',
];
const reactionKinds =
[
  'evade',
  'guard-break',
  'fully-defended',
  'defend',
];
const stageGeometry =
{
  readyFloor: 464,
  cssHeight: 190,
  defaultFrameSize: 512,
  defaultFrameLeft: 128,
  frameTop: 16,
  canvasWidth: 768,
  canvasHeight: 544,
  supportFloor: 480,
  anchorX: 384,
  sweepMargin: 16,
};

function normalizeLineEndings(bytes)
{
  return bytes.toString('utf8').replaceAll('\r\n', '\n');
}

function readGitFile(revision, path)
{
  const argumentsList =
  [
    '-c',
    `safe.directory=${repositoryRoot}`,
    'show',
    `${revision}:${path}`,
  ];

  return execFileSync('git', argumentsList, { cwd: repositoryRoot });
}

function hashBytes(bytes)
{
  return createHash('sha256').update(bytes).digest('hex');
}

function roundCoordinate(value)
{
  return value == null
    ? null
    : Number(value.toFixed(coordinatePrecision));
}

function placementCoordinates(placement)
{
  const coordinateNames =
  [
    'left',
    'top',
    'width',
    'height',
  ];

  return Object.fromEntries(coordinateNames.map(name =>
  {
    return [name, roundCoordinate(placement[name])];
  }));
}

function indexPhysicalRasters(snapshot, label)
{
  const indexedRasters = new Map();

  for (const entries of Object.values(snapshot.assets || {}))
  {
    for (const raster of entries)
    {
      const key = `${raster.pack}/${raster.path}`;

      if (!raster.exists || !sha256Pattern.test(raster.sha256 || ''))
      {
        throw Error(`${label} raster missing or invalid: ${key}`);
      }

      if (indexedRasters.has(key))
      {
        throw Error(`${label} duplicate raster identity: ${key}`);
      }

      indexedRasters.set(key, raster.sha256);
    }
  }

  return indexedRasters;
}

// Hashless catalog entries also use the retained physical-file snapshot.
// The snapshot is fixed evidence and is never refreshed by this script.
function verifyRasterSnapshot(expected, actual)
{
  const labeledSnapshots =
  [
    ['retained', expected],
    ['measured', actual],
  ];

  for (const [label, snapshot] of labeledSnapshots)
  {
    if (snapshot.baseline !== baseline || snapshot.release !== release)
    {
      throw Error(`${label} raster snapshot baseline/release mismatch`);
    }
  }

  const expectedFiles = indexPhysicalRasters(expected, 'retained');
  const actualFiles = indexPhysicalRasters(actual, 'measured');

  if (expectedFiles.size !== expectedRasterCount)
  {
    throw Error('Retained raster snapshot must contain the original 330 physical files');
  }

  for (const [key, expectedHash] of expectedFiles)
  {
    if (!actualFiles.has(key))
    {
      throw Error(`Measured raster missing from pinned snapshot coverage: ${key}`);
    }

    if (actualFiles.get(key) !== expectedHash)
    {
      throw Error(`Measured raster SHA-256 differs from retained v30 snapshot: ${key}`);
    }
  }

  for (const key of actualFiles.keys())
  {
    if (!expectedFiles.has(key))
    {
      throw Error(`Measured raster has no retained v30 snapshot identity: ${key}`);
    }
  }

  return expectedFiles.size;
}

function firstRaster(snapshot)
{
  return Object.values(snapshot.assets)[0][0];
}

function runSnapshotGuardSelftest(expectedSnapshot)
{
  const cloneSnapshot = () =>
  {
    return structuredClone(expectedSnapshot);
  };
  const checkedFiles = verifyRasterSnapshot(expectedSnapshot, expectedSnapshot);
  const testCases =
  [
    ['manipulated expected hash', () =>
    {
      const expected = cloneSnapshot();
      firstRaster(expected).sha256 = '0'.repeat(sha256HexLength);
      return [expected, cloneSnapshot()];
    }],
    ['missing measured file', () =>
    {
      const actual = cloneSnapshot();
      Object.values(actual.assets)[0].shift();
      return [cloneSnapshot(), actual];
    }],
    ['missing physical raster', () =>
    {
      const actual = cloneSnapshot();
      firstRaster(actual).exists = false;
      return [cloneSnapshot(), actual];
    }],
    ['different source baseline', () =>
    {
      const actual = cloneSnapshot();
      actual.baseline = 'different';
      return [cloneSnapshot(), actual];
    }],
    ['different art release', () =>
    {
      const actual = cloneSnapshot();
      actual.release = 'ashenspire-hd-assets-v29';
      return [cloneSnapshot(), actual];
    }],
    ['unexpected physical path', () =>
    {
      const actual = cloneSnapshot();
      firstRaster(actual).path += '-unexpected';
      return [cloneSnapshot(), actual];
    }],
  ];

  for (const [name, createFixture] of testCases)
  {
    let rejected = false;

    try
    {
      verifyRasterSnapshot(...createFixture());
    }
    catch
    {
      rejected = true;
    }

    if (!rejected)
    {
      throw Error(`Snapshot guard failed to reject ${name}`);
    }
  }

  console.log(`PASS retained snapshot ${snapshotAnchor}: ${checkedFiles} identical files accepted; ${testCases.length} manipulated in-memory fixtures rejected; no files written.`);
}

function argumentValue(name)
{
  const argumentIndex = process.argv.indexOf(name);

  return argumentIndex < 0
    ? null
    : process.argv[argumentIndex + 1];
}

function importRepositoryModule(path)
{
  return import(pathToFileURL(join(repositoryRoot, path)).href);
}

function addPoseRole(rolesByPose, key, role)
{
  if (!rolesByPose.has(key))
  {
    rolesByPose.set(key, []);
  }

  rolesByPose.get(key).push(role);
}

function csvCell(value)
{
  const text = value == null
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

  return '"' + text.replaceAll('"', '""') + '"';
}

function writeJsonEvidence(name, value)
{
  const bytes = JSON.stringify(value, null, jsonIndentation) + '\n';

  if (Buffer.byteLength(bytes) > maxEvidenceBytes)
  {
    throw Error(name + ' exceeds evidence limit');
  }

  writeFileSync(join(outputDirectory, name), bytes);
}

function isCatalogPose(row)
{
  return !row.key.startsWith('$');
}

function mismatchRecord(row, path)
{
  return (
  {
    classId: row.classId,
    key: row.key,
    path,
  });
}

const snapshotBytes = readFileSync(join(outputDirectory, snapshotFilename), 'utf8');
const anchoredSnapshot = readGitFile(snapshotAnchor, snapshotRelative);

if (normalizeLineEndings(snapshotBytes) !== normalizeLineEndings(anchoredSnapshot))
{
  throw Error(`Retained raster snapshot changed; restore the evidence from planning commit ${snapshotAnchor} before rerunning.`);
}

const expectedSnapshot = JSON.parse(snapshotBytes);

if (process.argv.includes('--selftest-snapshot-guard'))
{
  runSnapshotGuardSelftest(expectedSnapshot);
  process.exit(0);
}

const cache = resolve(argumentValue('--cache') || defaultCacheDirectory);
const python = argumentValue('--python') || 'python';
const { alternativeCardAnimationFamily } = await importRepositoryModule('src/model/cardAnimationFamily.js');
const
{
  combatWeaponProfilesFor,
  DEFAULT_COMBAT_WEAPONS: defaultCombatWeapons,
} = await importRepositoryModule('src/model/combatWeaponPresentation.js');
const { COMBAT_BODY_LANDMARKS: landmarks } = await importRepositoryModule('src/content/combatBodyLandmarks.js');
const { bodyPlacement, bodyResize } = await importRepositoryModule('src/ui/models/CombatBodyModel.js');
const { selectedWeaponSequence } = await importRepositoryModule('src/model/selectedWeaponSequences.js');
const { playerHurtFrames } = await importRepositoryModule('src/content/playerHurtFrames.js');
const { DEFEATED_ART: defeatedArt } = await importRepositoryModule('src/content/defeatedArt.js');
const { alternativeCardAnimations } = await importRepositoryModule('src/content/alternativeCardAnimations.js');
const pin = JSON.parse(readFileSync(join(repositoryRoot, 'art-release.json'), 'utf8'));

if (pin.tag !== release)
{
  throw Error('This snapshot is pinned to v30; choose a new evidence baseline before rerunning.');
}

const sourceFiles =
[
  'art-release.json',
  'src/ui/assets.js',
  'src/ui/alternativeCardStage.js',
  'src/ui/models/CombatBodyModel.js',
  'src/ui/models/CombatViewportSizeModel.js',
  'src/ui/components/combatSpriteGeometry.js',
  'src/model/cardAnimationFamily.js',
  'src/model/combatAnimation.js',
  'src/model/alternativeCardAnimation.js',
  'src/model/combatWeaponPresentation.js',
  'src/model/selectedWeaponStances.js',
  'src/model/selectedWeaponSequences.js',
  'src/model/classSmashAnimations.js',
  'src/content/alternativeCardAnimations.js',
  'src/content/alternativeSelectedStances.js',
  'src/content/playerCounterSweepSprites.js',
  'src/content/playerAttackSprites.js',
  'src/content/classSmashAnimations.js',
  'src/content/playerHurtFrames.js',
  'src/content/combatBodyLandmarks.js',
  'src/content/defeatedArt.js',
  'src/content/generated/defeatedArt.js',
  'tools/player-hurt-registration.py',
];
const sourceHashes = sourceFiles.map(path =>
{
  const localBytes = readFileSync(join(repositoryRoot, path));
  const baselineBytes = readGitFile(baseline, path);

  if (normalizeLineEndings(localBytes) !== normalizeLineEndings(baselineBytes))
  {
    throw Error(`Runtime/source drift since selected baseline: ${path}`);
  }

  return (
  {
    path,
    sha256: hashBytes(localBytes),
    baselineBlobSha256: hashBytes(baselineBytes),
    lfNormalizedSha256: hashBytes(normalizeLineEndings(localBytes)),
    baselineMatchIgnoringCrlf: true,
  });
});
const rows = [];
const mappings = {};
const references = {};
const sourcePaths = new Set();

for (const classId of classIds)
{
  const profiles = combatWeaponProfilesFor({ classId });
  const assembledFamily = alternativeCardAnimationFamily(classId, profiles);
  const
  {
    frames,
    family,
    heldFrames,
    pilotFrames,
  } = assembledFamily;
  const readyFrame = frames.ready;
  const readyBody = landmarks[readyFrame.path];
  const stageHeightReference = stageGeometry.readyFloor - readyFrame.bounds[1];
  const cssScale = stageGeometry.cssHeight / stageHeightReference;
  const referenceBodyHeight = (readyBody.feetY - readyBody.headY)
    * (readyFrame.size?.[1] || stageGeometry.defaultFrameSize) / readyBody.height;
  const frameBounds = Object.values(frames).map(frame =>
  {
    return frame.stageBounds || frame.bounds;
  });
  const boundsTopEdges = frameBounds.map(bounds =>
  {
    return bounds[1];
  });
  const boundsLeftEdges = frameBounds.map(bounds =>
  {
    return bounds[0];
  });
  const boundsRightEdges = frameBounds.map(bounds =>
  {
    return bounds[2];
  });
  const topPadding = Math.max(0, -Math.min(...boundsTopEdges));
  const horizontalMargin = pilotFrames?.['sweep-contact']
    ? stageGeometry.sweepMargin
    : 0;
  const leftPadding = Math.max(0, horizontalMargin - Math.min(...boundsLeftEdges));
  const rightPadding = Math.max(0, Math.max(...boundsRightEdges)
    - (stageGeometry.canvasWidth - horizontalMargin));

  references[classId] =
  {
    profiles,
    ready: readyFrame.path,
    readyRasterBody: readyBody,
    referenceBodyStage: referenceBodyHeight,
    cssPixelsPerStageUnit: cssScale,
    cssReadyBodyPx: referenceBodyHeight * cssScale,
    requestedCanvas:
    [
      stageGeometry.canvasWidth + leftPadding + rightPadding,
      stageGeometry.canvasHeight + topPadding,
    ],
    canvas:
    [
      Math.trunc(stageGeometry.canvasWidth + leftPadding + rightPadding),
      Math.trunc(stageGeometry.canvasHeight + topPadding),
    ],
    padding:
    {
      left: leftPadding,
      top: topPadding,
      right: rightPadding,
    },
    normalFloor: stageGeometry.supportFloor + topPadding,
  };

  const rolesByPose = new Map();

  for (const [action, sequence] of Object.entries(family.sequences))
  {
    for (const key of sequence.poses)
    {
      if (key !== 'origin')
      {
        addPoseRole(rolesByPose, key, `sequence:${action}`);
      }
    }
  }

  addPoseRole(rolesByPose, 'ready', 'rest:idle');
  addPoseRole(rolesByPose, 'guard-brace', 'rest:defend/guard/evade-fallback');

  for (const stance of Object.keys(heldFrames))
  {
    addPoseRole(rolesByPose, `stance-${stance}`, `held:${stance}`);
  }

  const sequences = Object.fromEntries(Object.entries(family.sequences).map(([action, sequence]) =>
  {
    const poses = sequence.poses.map(key =>
    {
      return (
      {
        key,
        path: key === 'origin'
          ? null
          : frames[key]?.path || null,
        resolution: key === 'origin'
          ? 'current held/rest pose at sampling time'
          : frames[key]
            ? 'assembled catalog frame'
            : 'missing frame; painter falls back to ready',
      });
    });

    const sequenceRecord =
    {
      poses,
      durations: sequence.durations,
      impact: sequence.impact,
      travel: sequence.travel,
      hold: sequence.hold ?? false,
      pilot: !!sequence.pilot,
    };

    return [action, sequenceRecord];
  }));
  const targetReactions = {};

  if (pilotFrames)
  {
    for (const kind of reactionKinds)
    {
      const sequence = selectedWeaponSequence(kind);

      const hasEveryFrame = sequence.poses.every(key =>
      {
        return frames[key];
      });

      if (!hasEveryFrame)
      {
        continue;
      }

      targetReactions[kind] = sequence.poses.map(key =>
      {
        return (
        {
          key,
          path: frames[key].path,
        });
      });

      for (const key of sequence.poses)
      {
        addPoseRole(rolesByPose, key, `target-reaction:${kind}`);
      }
    }
  }

  const heldPaths = Object.fromEntries(Object.entries(heldFrames).map(([key, frame]) =>
  {
    return [key, frame.path];
  }));

  mappings[classId] =
  {
    profiles,
    sequences,
    held: heldPaths,
    targetReactions,
    baseReady: readyFrame.path,
    baseSweepOverridden: alternativeCardAnimations.classes[classId].sequences.sweep.poses,
    originPolicy: 'current restPose(); idle->ready, current stance->stance-<stance>, counter->pilot-counter or selected counter stance, defend/guard/evade->guard-brace',
    hurt: playerHurtFrames[classId],
    defeated: defeatedArt[classId]?.file || null,
  };

  for (const [key, frame] of Object.entries(frames))
  {
    const drawSize = frame.drawOffset
      ? frame.size
      : [stageGeometry.defaultFrameSize, stageGeometry.defaultFrameSize];
    const drawOffset = frame.drawOffset || [stageGeometry.defaultFrameLeft, 0];
    const authoredPlacement =
    {
      left: leftPadding + drawOffset[0],
      top: stageGeometry.frameTop + topPadding + drawOffset[1],
      width: drawSize[0],
      height: drawSize[1],
      anchorX: leftPadding + stageGeometry.anchorX,
    };
    const bodyLandmarks = landmarks[frame.path];
    const authoredSpan = bodyLandmarks
      ? (bodyLandmarks.feetY - bodyLandmarks.headY) * drawSize[1] / bodyLandmarks.height
      : null;
    const heldPlacement = bodyLandmarks
      ? bodyPlacement(
        authoredPlacement,
        bodyLandmarks,
        referenceBodyHeight,
        stageGeometry.supportFloor + topPadding)
      : authoredPlacement;
    const actionPlacement = bodyLandmarks
      ? bodyResize(authoredPlacement, bodyLandmarks, referenceBodyHeight)
      : authoredPlacement;
    const roles = rolesByPose.get(key) || [];

    rows.push(
    {
      classId,
      key,
      path: frame.path,
      lite: frame.lite || null,
      roles: roles.join(';'),
      selection: roles.length
        ? 'available through active assembled family'
        : 'assembled but no selected sequence/held/rest role identified',
      rasterDeclared: frame.rasterSize || null,
      mobileRasterDeclared: frame.mobileRasterSize || null,
      drawSize,
      drawOffset,
      catalogBounds: frame.bounds,
      stageBounds: frame.stageBounds || null,
      bodyRaster: bodyLandmarks || null,
      referenceBodyStage: referenceBodyHeight,
      authoredSpanStage: authoredSpan,
      normalizationFactor: authoredSpan
        ? referenceBodyHeight / authoredSpan
        : 1,
      heldPlacement: placementCoordinates(heldPlacement),
      actionPlacement: placementCoordinates(actionPlacement),
      normalizedSpanStage: bodyLandmarks
        ? referenceBodyHeight
        : null,
      cssPixelsPerStageUnit: cssScale,
      cssDrawSizeHeld:
      [
        roundCoordinate(heldPlacement.width * cssScale),
        roundCoordinate(heldPlacement.height * cssScale),
      ],
      cssDrawSizeAction:
      [
        roundCoordinate(actionPlacement.width * cssScale),
        roundCoordinate(actionPlacement.height * cssScale),
      ],
      declaredSha256: frame.sha256 || null,
      declaredLiteSha256: frame.liteSha256 || null,
      source: frame.source || null,
      sourceCrop: frame.sourceCrop || null,
      provenance: frame.provenance || null,
    });
    sourcePaths.add(frame.path);

    if (frame.lite)
    {
      sourcePaths.add(frame.lite);
    }
  }

  const hurtFrame = playerHurtFrames[classId];

  rows.push(
  {
    classId,
    key: '$hurt',
    path: hurtFrame.file,
    roles: 'target:hit',
    selection: 'separate hurt raster; ordinary motion only',
    drawSize:
    [
      stageGeometry.defaultFrameSize * hurtFrame.scale,
      stageGeometry.defaultFrameSize * hurtFrame.scale,
    ],
    drawOffset:
    [
      stageGeometry.defaultFrameLeft + hurtFrame.dx,
      stageGeometry.frameTop + hurtFrame.dy,
    ],
    normalizationFactor: 1,
    heldPlacement: null,
    actionPlacement:
    {
      left: leftPadding + stageGeometry.defaultFrameLeft + hurtFrame.dx,
      top: stageGeometry.frameTop + topPadding + hurtFrame.dy,
      width: stageGeometry.defaultFrameSize * hurtFrame.scale,
      height: stageGeometry.defaultFrameSize * hurtFrame.scale,
    },
    source: 'src/content/playerHurtFrames.js',
    hurtScale: hurtFrame.scale,
    hurtDx: hurtFrame.dx,
    hurtDy: hurtFrame.dy,
    referenceBodyStage: referenceBodyHeight,
    cssPixelsPerStageUnit: cssScale,
  });
  sourcePaths.add(hurtFrame.file);

  if (defeatedArt[classId]?.file)
  {
    const path = defeatedArt[classId].file;
    sourcePaths.add(path);
    rows.push(
    {
      classId,
      key: '$defeated',
      path,
      roles: 'rest:defeated',
      selection: 'separate defeated raster; fixed 512 square draw',
      drawSize: [stageGeometry.defaultFrameSize, stageGeometry.defaultFrameSize],
      drawOffset: [stageGeometry.defaultFrameLeft, stageGeometry.frameTop],
      normalizationFactor: 1,
      actionPlacement:
      {
        left: leftPadding + stageGeometry.defaultFrameLeft,
        top: stageGeometry.frameTop + topPadding,
        width: stageGeometry.defaultFrameSize,
        height: stageGeometry.defaultFrameSize,
      },
      source: 'src/content/generated/defeatedArt.js',
      referenceBodyStage: referenceBodyHeight,
      cssPixelsPerStageUnit: cssScale,
    });
  }
}

// Pillow reads alpha >=128 as silhouette bounds, not anatomical landmarks.
// This subprocess decodes and hashes images without writing any image files.
const pythonCode = String.raw`import sys
import json
import hashlib
import os
from PIL import Image

cache = sys.argv[1]
alphaThreshold = 128
result = {}

for assetPath in json.load(sys.stdin):
    if assetPath.startswith('assets-display/'):
        candidates = [('common', assetPath)]
    elif assetPath.startswith('assets/'):
        candidates = [
            ('high', assetPath),
            ('light', assetPath.replace('assets/', 'assets-mobile/', 1))
        ]
    else:
        candidates = [('common', assetPath)]

    entries = []

    for pack, relativePath in candidates:
        filePath = os.path.join(cache, pack, relativePath)

        if not os.path.isfile(filePath):
            entries.append(dict(pack=pack, path=relativePath, exists=False))
            continue

        with open(filePath, 'rb') as stream:
            imageBytes = stream.read()

        with Image.open(filePath) as image:
            alpha = image.convert('RGBA').getchannel('A').point(
                lambda value: 255 if value >= alphaThreshold else 0
            )
            entries.append(dict(
                pack=pack,
                path=relativePath,
                exists=True,
                bytes=len(imageBytes),
                sha256=hashlib.sha256(imageBytes).hexdigest(),
                raster=list(image.size),
                alphaBox128=alpha.getbbox()
            ))

    result[assetPath] = entries

print(json.dumps(result, separators=(',', ':')))`;
const rasterOutput = execFileSync(python, ['-c', pythonCode, cache],
{
  input: JSON.stringify([...sourcePaths].sort()),
  encoding: 'utf8',
  maxBuffer: maxPythonOutputBytes,
});
const rasters = JSON.parse(rasterOutput);
const verifiedRasters = verifyRasterSnapshot(expectedSnapshot,
{
  baseline,
  release: pin.tag,
  assets: rasters,
});

console.log(`PASS retained v30 raster snapshot: ${verifiedRasters} physical pack/path SHA-256 values match planning commit ${snapshotAnchor}.`);

const csvColumns =
[
  'classId',
  'key',
  'path',
  'lite',
  'roles',
  'selection',
  'rasterDeclared',
  'mobileRasterDeclared',
  'actualRasters',
  'drawSize',
  'drawOffset',
  'catalogBounds',
  'stageBounds',
  'bodyRaster',
  'referenceBodyStage',
  'authoredSpanStage',
  'normalizationFactor',
  'heldPlacement',
  'actionPlacement',
  'normalizedSpanStage',
  'cssPixelsPerStageUnit',
  'cssDrawSizeHeld',
  'cssDrawSizeAction',
  'declaredSha256',
  'declaredLiteSha256',
  'source',
  'sourceCrop',
  'provenance',
  'hurtScale',
  'hurtDx',
  'hurtDy',
];

for (const row of rows)
{
  row.actualRasters =
  {
    path: rasters[row.path],
    lite: row.lite
      ? rasters[row.lite]
      : null,
  };
}

const csvRows = rows.map(row =>
{
  const cells = csvColumns.map(column =>
  {
    return csvCell(row[column]);
  });

  return cells.join(',');
});
const csvOutput = [csvColumns.join(','), ...csvRows].join('\n') + '\n';
writeFileSync(join(outputDirectory, 'inventory.csv'), csvOutput);

const keyedFrames = rows
  .filter(isCatalogPose)
  .map(row =>
  {
    return [row.classId + '|' + row.path, row];
  });
const uniqueFrames = [...new Map(keyedFrames).values()];
const availableFrames = uniqueFrames.filter(frame =>
{
  return rows.some(row =>
  {
    return row.classId === frame.classId && row.path === frame.path && row.roles;
  });
});
const physicalRasters = Object.values(rasters).flat();
const missingRasters = physicalRasters.filter(raster =>
{
  return !raster.exists;
});
const existingRasterCount = physicalRasters.filter(raster =>
{
  return raster.exists;
}).length;
const hashMismatches = rows.flatMap(row =>
{
  const fullRaster = rasters[row.path]?.[0];
  const liteRaster = rasters[row.lite]?.[0];
  const fullMismatch = row.declaredSha256 && fullRaster?.exists
    && row.declaredSha256 !== fullRaster.sha256;
  const liteMismatch = row.declaredLiteSha256 && liteRaster?.exists
    && row.declaredLiteSha256 !== liteRaster.sha256;

  return [
    fullMismatch
      ? mismatchRecord(row, row.path)
      : null,
    liteMismatch
      ? mismatchRecord(row, row.lite)
      : null,
  ];
}).filter(Boolean);
const summaries = Object.fromEntries(Object.keys(references).map(classId =>
{
  const classFrames = uniqueFrames.filter(frame =>
  {
    return frame.classId === classId;
  });
  const classAvailableFrames = availableFrames.filter(frame =>
  {
    return frame.classId === classId;
  });
  const classPoseCount = rows.filter(row =>
  {
    return row.classId === classId && isCatalogPose(row);
  }).length;
  const landmarkedFrameCount = classFrames.filter(frame =>
  {
    return frame.bodyRaster;
  }).length;
  const landmarkedAvailableFrameCount = classAvailableFrames.filter(frame =>
  {
    return frame.bodyRaster;
  }).length;
  const missingLandmarkPaths = classAvailableFrames
    .filter(frame =>
    {
      return !frame.bodyRaster;
    })
    .map(frame =>
    {
      return frame.path;
    });

  const classSummary =
  {
    catalogPoseRows: classPoseCount,
    uniqueFramePaths: classFrames.length,
    uniqueAvailablePaths: classAvailableFrames.length,
    landmarkedUniqueFrames: landmarkedFrameCount,
    landmarkedAvailableFrames: landmarkedAvailableFrameCount,
    missingLandmarkPaths,
  };

  return [classId, classSummary];
}));

writeJsonEvidence('summary.json',
{
  baseline,
  artRelease: pin.repo + '/' + pin.tag,
  cache,
  defaultCombatWeapons,
  measurementScope: 'Static baseline reconstruction at zero action travel/recoil; no browser/viewport assertion and no anatomical inference from vertical spans.',
  references,
  counts:
  {
    rows: rows.length,
    uniqueFramePaths: uniqueFrames.length,
    uniqueAvailableFramePaths: availableFrames.length,
    assetIdentifiers: sourcePaths.size,
    rasterFiles: existingRasterCount,
    missingRasterFiles: missingRasters.length,
    catalogHashMismatches: hashMismatches.length,
  },
  classes: summaries,
  missingRasters,
  hashMismatches,
});
writeJsonEvidence('action-mappings.json',
{
  baseline,
  classes: mappings,
});
writeJsonEvidence('source-hashes.json',
{
  baseline,
  files: sourceHashes,
});

// Never replace the retained snapshot, even when supplied cache files match.
const generatedOutputs =
[
  'inventory.csv',
  'summary.json',
  'action-mappings.json',
  'source-hashes.json',
];
const consoleSummary =
{
  counts:
  {
    rows: rows.length,
    uniqueFramePaths: uniqueFrames.length,
    available: availableFrames.length,
    rasters: existingRasterCount,
    missing: missingRasters.length,
    hashMismatches: hashMismatches.length,
  },
  classes: summaries,
  outputs: generatedOutputs,
  retainedSnapshot:
  {
    path: snapshotFilename,
    planningCommit: snapshotAnchor,
    verifiedFiles: verifiedRasters,
  },
};
console.log(JSON.stringify(consoleSummary, null, jsonIndentation));

const measuredJsonFiles =
[
  'summary.json',
  'action-mappings.json',
  'source-hashes.json',
  snapshotFilename,
];

for (const name of measuredJsonFiles)
{
  console.log(`${name}: ${statSync(join(outputDirectory, name)).size} bytes`);
}
