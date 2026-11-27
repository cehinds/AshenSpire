"""Diagnostic annotations and measurements; never modifies source art or baselines."""
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

outputDirectory = Path(__file__).resolve().parent
cacheDirectory = Path(r'C:/repos/AshenSpire/.art-cache/ashenspire-hd-assets-v30')
artDirectory = cacheDirectory / 'common/assets-display/alternative'
sourceBaseline = '49eca254d795d06266aa23941cb2b31fe77b27bf'
candidateScales = [0.55, 0.60, 0.65]
readyRasterToStage = 2
sourceRoot = [520, 734]
targetRoot = [384, 480]
displayScale = 0.65
panelWidth = 500
panelHeight = 450
headerHeight = 65
font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 14)

# Manually placed image coordinates. Uncertainty is anatomical, not numerical.
frames = [
    dict(
        name='ready',
        path='card-reaver-ready.webp',
        headTop=[131, 102],
        soleBoundaryY=231,
        helmetCrown=[[124, 109], [140, 112]],
        forearm=[[150, 153], [157, 173]],
        shin=[[148, 204], [148, 224]],
        bootLongAxis=[[145, 228], [166, 230]],
        confidence='medium for helmet; low-to-medium for occluded limb joints',
    ),
    dict(
        name='held',
        path='reaver-greatsword-pilot-sweep.webp',
        headTop=[567, 406],
        soleBoundaryY=736,
        helmetCrown=[[543, 417], [594, 437]],
        forearm=[[487, 534], [423, 572]],
        shin=[[624, 631], [648, 699]],
        bootLongAxis=[[604, 718], [677, 719]],
        confidence='medium for helmet/sole; low-to-medium for limb comparison',
    ),
    dict(
        name='windup',
        path='reaver-greatsword-pilot-sweep-windup.webp',
        headTop=[554, 393],
        soleBoundaryY=732,
        helmetCrown=[[529, 403], [580, 422]],
        confidence='medium; compare crown shell, not extended visor or shoulder',
    ),
    dict(
        name='contact',
        path='reaver-greatsword-pilot-sweep-contact.webp',
        headTop=[559, 405],
        soleBoundaryY=732,
        helmetCrown=[[523, 416], [577, 421]],
        confidence='medium; rear helmet differs in perspective',
    ),
    dict(
        name='finish',
        path='reaver-greatsword-pilot-sweep-finish.webp',
        headTop=[567, 493],
        soleBoundaryY=733,
        helmetCrown=[[537, 507], [584, 528]],
        confidence='medium; deep flexion and visor angle change visible geometry',
    ),
]
segmentNames = ['helmetCrown', 'forearm', 'shin', 'bootLongAxis']
ready = frames[0]
readySegments = {}

for name in segmentNames:
    readySegments[name] = math.dist(*ready[name]) * readyRasterToStage

records = []

for frame in frames:
    imagePath = artDirectory / frame['path']
    imageBytes = imagePath.read_bytes()
    image = Image.open(imagePath).convert('RGBA')
    alpha = image.getchannel('A').point(lambda value: 255 if value >= 128 else 0)
    segments = {}

    for name in segmentNames:
        if name not in frame:
            continue

        nativeLength = math.dist(*frame[name])
        segments[name] = dict(
            points=frame[name],
            nativeLength=nativeLength,
            readyReferenceStage=readySegments[name],
            matchingStageUnitsPerNativePixel=readySegments[name] / nativeLength,
        )

    record = dict(
        name=frame['name'],
        path='assets-display/alternative/' + frame['path'],
        sha256=hashlib.sha256(imageBytes).hexdigest(),
        rasterSize=list(image.size),
        alpha128Box=alpha.getbbox(),
        headTop=frame['headTop'],
        supportingSoleBoundaryY=frame['soleBoundaryY'],
        segments=segments,
        confidence=frame['confidence'],
    )

    if frame['name'] != 'ready':
        record['candidates'] = []

        for scale in candidateScales:
            left = targetRoot[0] - sourceRoot[0] * scale
            top = targetRoot[1] - sourceRoot[1] * scale
            record['candidates'].append(dict(
                stageUnitsPerNativePixel=scale,
                drawPlacement=[left, top, image.width * scale, image.height * scale],
                posedHeadToSoleStage=(frame['soleBoundaryY'] - frame['headTop'][1]) * scale,
                compressionAgainstReady261=(frame['soleBoundaryY'] - frame['headTop'][1]) * scale / 261,
                soleStageY=top + frame['soleBoundaryY'] * scale,
                helmetCrownStage=segments['helmetCrown']['nativeLength'] * scale,
            ))

    records.append(record)

report = dict(
    sourceBaseline=sourceBaseline,
    artRelease='ashenspire-hd-assets-v30',
    measurementKind='manual diagnostic landmarks; not accepted implementation calibration',
    readyReferenceSegmentsStage=readySegments,
    sourceRoot=sourceRoot,
    targetRoot=targetRoot,
    rootDerivation='[384,464] - [-136,-270] = [520,734]; painter adds16 to target Y',
    candidateScales=candidateScales,
    recommendedFirstCandidate=0.60,
    uncertainty='Approximately ±10–15% for camera/landmark differences; not rig-derived anatomy',
    existingHeldSemanticFeetY=759,
    records=records,
)
(outputDirectory / 'reaver-calibration-survey.json').write_text(json.dumps(report, indent=2) + '\n')

sheet = Image.new('RGB', (panelWidth * len(frames), headerHeight + panelHeight * len(candidateScales)), '#202730')
draw = ImageDraw.Draw(sheet)
draw.text((15, 10), 'PROPOSED calibration comparison: unchanged source pixels; fixed scale per SW09 family, NOT an accepted fix', font=font, fill='white')
draw.text((15, 32), 'Green: shared authored root floor480. Orange: reviewed sole. Cyan: manual head/crown. Red: old metadata sole759 (held only).', font=font, fill='white')

for rowIndex, scale in enumerate(candidateScales):
    for columnIndex, frame in enumerate(frames):
        image = Image.open(artDirectory / frame['path']).convert('RGBA')
        x = columnIndex * panelWidth
        y = headerHeight + rowIndex * panelHeight
        originX = x + panelWidth / 2 - targetRoot[0] * displayScale
        originY = y + 390 - targetRoot[1] * displayScale

        if frame['name'] == 'ready':
            drawScale = readyRasterToStage
            left = 128
            top = 16
        else:
            drawScale = scale
            left = targetRoot[0] - sourceRoot[0] * scale
            top = targetRoot[1] - sourceRoot[1] * scale

        finalSize = (round(image.width * drawScale * displayScale), round(image.height * drawScale * displayScale))
        resized = image.resize(finalSize, Image.Resampling.LANCZOS)
        imageOrigin = (round(originX + left * displayScale), round(originY + top * displayScale))
        sheet.paste(resized, imageOrigin, resized)
        draw.rectangle((x + 2, y + 2, x + panelWidth - 2, y + panelHeight - 2), outline='#536070')
        groundY = round(originY + targetRoot[1] * displayScale)
        draw.line((x + 5, groundY, x + panelWidth - 5, groundY), fill='#70e0a0')
        draw.text((x + 12, y + 10), f'{frame["name"]} | SW09 scale {scale:.2f} | ready unchanged', font=font, fill='white')

        for first, second in [frame['helmetCrown']]:
            points = []

            for point in [first, second]:
                points.append((originX + (left + point[0] * drawScale) * displayScale, originY + (top + point[1] * drawScale) * displayScale))

            draw.line(points, fill='#70e0ff', width=3)

        soleY = originY + (top + frame['soleBoundaryY'] * drawScale) * displayScale
        draw.line((x + panelWidth / 2 - 45, soleY, x + panelWidth / 2 + 45, soleY), fill='#ffb44f', width=2)

        if frame['name'] == 'held':
            oldSoleY = originY + (top + 759 * drawScale) * displayScale
            draw.line((x + panelWidth / 2 - 55, oldSoleY, x + panelWidth / 2 + 55, oldSoleY), fill='#ff7878', width=2)

        crownStage = math.dist(*frame['helmetCrown']) * drawScale
        posedSpan = (frame['soleBoundaryY'] - frame['headTop'][1]) * drawScale
        draw.text((x + 12, y + 32), f'crown {crownStage:.2f}stage; posed span {posedSpan:.2f}stage', font=font, fill='white')
        draw.text((x + 12, y + 413), f'native raster {image.width}x{image.height}; display {displayScale}px/stage', font=font, fill='white')

sheet.save(outputDirectory / 'reaver-calibration-candidates.png')
print('Wrote survey JSON and .55/.60/.65 comparison; source art and existing evidence unchanged.')
