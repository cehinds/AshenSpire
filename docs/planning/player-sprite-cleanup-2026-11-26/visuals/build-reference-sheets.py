"""BEFORE-only pinned-raster composites; no new artwork or gameplay capture.
Run the input collector first, then pass the v30 directory through --cache.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
BASELINE = '49eca254d795d06266aa23941cb2b31fe77b27bf'
RELEASE = 'ashenspire-hd-assets-v30'
DEFAULT_CANVAS_SIZE = [512, 512]
DEFAULT_DRAW_OFFSET = [128, 0]
FRAME_TOP_OFFSET = 16
STAGE_CENTER_X = 384
STAGE_FLOOR_Y = 480
ALPHA_THRESHOLD = 128
OPAQUE_ALPHA = 255
PANEL_HEIGHT = 475
DEFAULT_PANEL_WIDTH = 560
DEFAULT_COLUMNS = 3
DEFAULT_STAGE_SCALE = .68
SHEET_HEADER_HEIGHT = 91
SHEET_BODY_GROUND_Y = 372
SHEET_TITLE_ORIGIN = (18, 12)
SHEET_SUBTITLE_ORIGIN = (18, 41)
SHEET_BASELINE_ORIGIN = (18, 62)
GRID_FIRST_Y = 80
GRID_LAST_Y_EXCLUSIVE = 601
GRID_INTERVAL = 80
GRID_VISIBLE_TOP = 66
GRID_VISIBLE_BOTTOM = 389
GRID_LABEL_OFFSET_Y = 15
GRID_LABEL_INSET_X = 10
CENTER_GUIDE_TOP = 61
CENTER_GUIDE_BOTTOM = 399
PANEL_BORDER_INSET = 3
MIN_ALPHA_REACH_INSET = 4
PANEL_RULE_INSET = 8
PANEL_LABEL_INSET = 12
PANEL_TITLE_Y = 12
PANEL_SCALE_Y = 39
PANEL_FACTOR_Y = 405
PANEL_ASSET_Y = 426
PANEL_RASTER_Y = 446
ASSET_LABEL_LENGTH = 51
SELECTED_SCALE = .58
SELECTED_COLUMNS = 4
HIT_REFERENCE_SCALE = .9
SWEEP_SCALE = .60
SWEEP_PANEL_WIDTH = 680
CANDIDATE_SHEET_SIZE = (1180, 730)
CANDIDATE_PANEL_WIDTH = 590
CANDIDATE_PANEL_HEIGHT = 325
CANDIDATE_START_Y = 80
CANDIDATE_GROUND_Y = 285
CANDIDATE_SOURCE_SCALE = .72
CANDIDATE_COLUMNS = 2
CANDIDATE_CENTER_X = 295
CANDIDATE_TITLE_ORIGIN = (18, 14)
CANDIDATE_SUBTITLE_ORIGIN = (18, 43)
CANDIDATE_LABEL_Y = 9
CANDIDATE_RASTER_LABEL_Y = 302
PAINTED_SOURCE_FLOOR_Y = 600
BODY_FONT_SIZE = 13
TITLE_FONT_SIZE = 19
JSON_INDENT = 2
BACKGROUND = (24, 30, 39, 255)
INK = (232, 235, 240, 255)
MUTED = (169, 183, 199, 255)
PANEL_OUTLINE = (62, 75, 91, 255)
GRID_INK = (36, 46, 60, 255)
GRID_LABEL_INK = (85, 101, 120, 255)
GROUND_INK = (70, 198, 153, 255)
CENTER_GUIDE_INK = (65, 81, 100, 255)
TRANSPARENT = (0, 0, 0, 0)
HURT_ALTERNATIVES = [
    'assets/animations/unarmed-magic/starseer/HURT.webp',
    'assets/animations/unarmed/starseer/HURT.webp',
    'assets/animations/greatsword-outfits/starseer/HURT.webp',
    'assets/painted-outfits/starseer/hit.webp',
]
HELD_POSE_NAMES = [
    'ready',
    'offensive',
    'defensive',
    'casting',
    'counter',
    'sweep',
    'smash',
    'evade',
    'defend',
]
SELECTED_POSE_NAMES = [
    'ready',
    'offensive',
    'defensive',
    'casting',
    'counter',
    'sweep',
    'smash',
]
SWEEP_POSE_NAMES = [
    'ready',
    'sweep',
    'pilot-sweep-windup',
    'pilot-sweep-contact',
    'pilot-sweep-finish',
    'ready',
]
SWEEP_ACTION_NAMES = [
    'pilot-sweep-windup',
    'pilot-sweep-contact',
    'pilot-sweep-finish',
]

parser = argparse.ArgumentParser()
parser.add_argument('--cache', type=Path, required=True)
options = parser.parse_args()
data = json.loads((HERE / 'visual-inputs.json').read_text())
retained = json.loads((HERE / 'image-manifest.json').read_text())
rasterIndex = json.loads(
    (HERE.parent / 'measurements' / 'raster-hashes.json').read_text()
)

if data.get('source') != BASELINE or data.get('art') != RELEASE:
    raise ValueError('Unexpected visual-inputs source/art identity; refusing output overwrite')

if retained.get('sourceCommit') != BASELINE or retained.get('artTag') != RELEASE:
    raise ValueError('Unexpected retained visual baseline; refusing output overwrite')

if rasterIndex.get('baseline') != BASELINE or rasterIndex.get('release') != RELEASE:
    raise ValueError('Unexpected measurement raster baseline; refusing output overwrite')

if options.cache.name != RELEASE:
    raise ValueError(
        f'Cache directory must identify {RELEASE}, not {options.cache.name}'
    )

records = {}
loaded = {}
fontPath = Path('C:/Windows/Fonts/consola.ttf')
FONT = (
    ImageFont.truetype(str(fontPath), BODY_FONT_SIZE)
    if fontPath.exists()
    else ImageFont.load_default()
)
TITLE = (
    ImageFont.truetype(str(fontPath), TITLE_FONT_SIZE)
    if fontPath.exists()
    else FONT
)


def alphaThreshold(value):
    return OPAQUE_ALPHA if value >= ALPHA_THRESHOLD else 0


def imageFor(path):
    if path in loaded:
        return loaded[path]

    candidates = [options.cache / tier / path for tier in ('common', 'high')]
    found = next((candidate for candidate in candidates if candidate.exists()), None)

    if not found:
        raise FileNotFoundError(path)

    resolved = found.relative_to(options.cache).as_posix()
    observedHash = hashlib.sha256(found.read_bytes()).hexdigest()
    matches = [
        entry
        for entry in rasterIndex['assets'].get(path, [])
        if entry.get('exists') and entry['pack'] + '/' + entry['path'] == resolved
    ]
    expectedHash = matches[0]['sha256'] if matches else None

    if expectedHash is None:
        candidate = retained['inputAssets'].get(path)

        if candidate and candidate['resolvedPack'] == resolved:
            expectedHash = candidate['sha256']

    if not expectedHash or observedHash != expectedHash:
        raise ValueError(
            f'Pinned raster mismatch: {resolved}; refusing output overwrite'
        )

    image = Image.open(found).convert('RGBA')
    alpha = image.getchannel('A').point(alphaThreshold)
    records[path] = {
        'resolvedPack': resolved,
        'rasterSize': list(image.size),
        'alpha128Bounds': alpha.getbbox(),
        'sha256': observedHash,
    }
    loaded[path] = image
    return image


def placement(classId, name, mode='current'):
    classData = data['classes'][classId]

    if name == 'HURT':
        hurt = classData['hurt']
        dimensions = (
            DEFAULT_DRAW_OFFSET[0] + hurt['dx'],
            FRAME_TOP_OFFSET + hurt['dy'],
            DEFAULT_CANVAS_SIZE[0] * hurt['scale'],
            DEFAULT_CANVAS_SIZE[1] * hurt['scale'],
        )
        return hurt['file'], dimensions, None, None

    frame = classData['poses'][name]
    logicalSize = (
        frame.get('size', DEFAULT_CANVAS_SIZE)
        if frame.get('drawOffset') is not None
        else DEFAULT_CANVAS_SIZE
    )
    offset = frame.get('drawOffset', DEFAULT_DRAW_OFFSET)
    left = offset[0]
    top = FRAME_TOP_OFFSET + offset[1]
    width = logicalSize[0]
    height = logicalSize[1]
    body = data['landmarks'].get(frame['path'])
    ready = data['landmarks'].get(classData['poses']['ready']['path'])
    factor = 1.0

    if body and ready and mode == 'current':
        readyHeight = classData['poses']['ready'].get('size', DEFAULT_CANVAS_SIZE)[1]
        target = (ready['feetY'] - ready['headY']) * readyHeight / ready['height']
        feet = top + body['feetY'] * height / body['height']
        sourceHeight = (body['feetY'] - body['headY']) * height / body['height']
        factor = target / sourceHeight
        # Held cards use floor480; measured future action frames must retain their own feet.
        targetFeet = STAGE_FLOOR_Y if name in HELD_POSE_NAMES else feet
        left = STAGE_CENTER_X + (left - STAGE_CENTER_X) * factor
        top = targetFeet + (top - feet) * factor
        width *= factor
        height *= factor

    return frame['path'], (left, top, width, height), body, factor


def writeSheet(
    filename,
    title,
    subtitle,
    cells,
    columns=DEFAULT_COLUMNS,
    scale=DEFAULT_STAGE_SCALE,
    panelWidth=DEFAULT_PANEL_WIDTH,
):
    rows = (len(cells) + columns - 1) // columns
    sheetSize = (
        panelWidth * columns,
        SHEET_HEADER_HEIGHT + PANEL_HEIGHT * rows,
    )
    output = Image.new('RGBA', sheetSize, BACKGROUND)
    draw = ImageDraw.Draw(output)
    draw.text(SHEET_TITLE_ORIGIN, title, font=TITLE, fill=INK)
    draw.text(SHEET_SUBTITLE_ORIGIN, subtitle, font=FONT, fill=MUTED)
    draw.text(
        SHEET_BASELINE_ORIGIN,
        'BEFORE only | baseline 49eca254d795 | art v30 | same stage scale within sheet',
        font=FONT,
        fill=MUTED,
    )

    for index, (classId, name, mode) in enumerate(cells):
        panelX = (index % columns) * panelWidth
        panelY = SHEET_HEADER_HEIGHT + (index // columns) * PANEL_HEIGHT
        path, (left, top, width, height), body, factor = placement(classId, name, mode)
        image = imageFor(path)
        originX = panelX + panelWidth / 2 - STAGE_CENTER_X * scale
        originY = panelY + SHEET_BODY_GROUND_Y - STAGE_FLOOR_Y * scale
        panelBorder = (
            panelX + PANEL_BORDER_INSET,
            panelY + PANEL_BORDER_INSET,
            panelX + panelWidth - PANEL_BORDER_INSET,
            panelY + PANEL_HEIGHT - PANEL_BORDER_INSET,
        )
        draw.rectangle(panelBorder, outline=PANEL_OUTLINE, width=1)

        for gridY in range(GRID_FIRST_Y, GRID_LAST_Y_EXCLUSIVE, GRID_INTERVAL):
            projectedY = round(originY + gridY * scale)

            if not (panelY + GRID_VISIBLE_TOP <= projectedY <= panelY + GRID_VISIBLE_BOTTOM):
                continue

            draw.line(
                (
                    panelX + PANEL_RULE_INSET,
                    projectedY,
                    panelX + panelWidth - PANEL_RULE_INSET,
                    projectedY,
                ),
                fill=GRID_INK,
            )
            draw.text(
                (panelX + GRID_LABEL_INSET_X, projectedY - GRID_LABEL_OFFSET_Y),
                str(gridY),
                font=FONT,
                fill=GRID_LABEL_INK,
            )

        ground = round(originY + STAGE_FLOOR_Y * scale)
        centerGuideX = round(originX + STAGE_CENTER_X * scale)
        draw.line(
            (
                panelX + PANEL_RULE_INSET,
                ground,
                panelX + panelWidth - PANEL_RULE_INSET,
                ground,
            ),
            fill=GROUND_INK,
            width=2,
        )
        draw.line(
            (
                centerGuideX,
                panelY + CENTER_GUIDE_TOP,
                centerGuideX,
                panelY + CENTER_GUIDE_BOTTOM,
            ),
            fill=CENTER_GUIDE_INK,
        )
        drawnSize = (
            max(1, round(width * scale)),
            max(1, round(height * scale)),
        )
        drawn = image.resize(drawnSize, Image.Resampling.LANCZOS)
        panel = Image.new('RGBA', (panelWidth, PANEL_HEIGHT), TRANSPARENT)
        panel.alpha_composite(
            drawn,
            (
                round(originX + left * scale) - panelX,
                round(originY + top * scale) - panelY,
            ),
        )
        alpha = image.getchannel('A').getbbox()

        if alpha:
            projected = (
                panelWidth / 2 + (left + alpha[0] * width / image.width - STAGE_CENTER_X) * scale,
                panelWidth / 2 + (left + alpha[2] * width / image.width - STAGE_CENTER_X) * scale,
            )

            if projected[0] < MIN_ALPHA_REACH_INSET or projected[1] > panelWidth - MIN_ALPHA_REACH_INSET:
                raise ValueError(
                    f'Panel too narrow for full alpha reach: {classId}/{name} {projected}'
                )

        output.alpha_composite(panel, (panelX, panelY))
        labelX = panelX + PANEL_LABEL_INSET
        draw.text(
            (labelX, panelY + PANEL_TITLE_Y),
            f'{classId.upper()} / {name}',
            font=TITLE,
            fill=INK,
        )
        draw.text(
            (labelX, panelY + PANEL_SCALE_Y),
            f'{mode}; {scale:g} output px / stage px',
            font=FONT,
            fill=MUTED,
        )
        factorLabel = (
            f'body normalization x{factor:.6f}'
            if factor is not None
            else 'HURT registration; no body landmarks'
        )
        draw.text(
            (labelX, panelY + PANEL_FACTOR_Y),
            factorLabel,
            font=FONT,
            fill=INK,
        )
        basename = Path(path).name
        draw.text(
            (labelX, panelY + PANEL_ASSET_Y),
            basename[:ASSET_LABEL_LENGTH],
            font=FONT,
            fill=MUTED,
        )
        draw.text(
            (labelX, panelY + PANEL_RASTER_Y),
            f'source raster {image.width}x{image.height}; floor=480',
            font=FONT,
            fill=MUTED,
        )

    output.convert('RGB').save(HERE / filename, optimize=True)


# Verify every input before producing any PNG or manifest, avoiding partial regeneration.
required = []

for classId, classData in data['classes'].items():
    required.extend(
        classData['poses'][name]['path']
        for name in SELECTED_POSE_NAMES
    )
    required.append(classData['hurt']['file'])

required.extend(
    data['classes']['reaver']['poses'][name]['path']
    for name in SWEEP_ACTION_NAMES
)
required.extend(HURT_ALTERNATIVES)

for path in dict.fromkeys(required):
    imageFor(path)

for classId in data['classes']:
    cells = [(classId, name, 'current') for name in SELECTED_POSE_NAMES + ['HURT']]
    writeSheet(
        f'{classId}-selected-before.png',
        f'{classId.title()}: selected identity audit',
        'Static current-registration reconstruction, NOT a gameplay screenshot; effects/timing omitted.',
        cells,
        SELECTED_COLUMNS,
        scale=SELECTED_SCALE,
    )

writeSheet(
    'starseer-hit-reference.png',
    'Primary case: Starseer receives a hit',
    'Current source selection and registration; static hit image without recoil/red flash.',
    [('starseer', 'ready', 'current'), ('starseer', 'HURT', 'current')],
    2,
    scale=HIT_REFERENCE_SCALE,
)
writeSheet(
    'reaver-sweep-current-before.png',
    'Primary case: Reaver selected SW09 Sweep',
    'Current held normalization and unmeasured action placement; all panels share one stage scale.',
    [('reaver', name, 'current') for name in SWEEP_POSE_NAMES],
    3,
    scale=SWEEP_SCALE,
    panelWidth=SWEEP_PANEL_WIDTH,
)
writeSheet(
    'reaver-sweep-authored-reference.png',
    'Reaver authored logical placements: BEFORE reference',
    'Normalization omitted for diagnosis only. NOT a proposed fix or after-image.',
    [('reaver', name, 'authored') for name in SWEEP_POSE_NAMES],
    3,
    scale=SWEEP_SCALE,
    panelWidth=SWEEP_PANEL_WIDTH,
)

output = Image.new('RGBA', CANDIDATE_SHEET_SIZE, BACKGROUND)
draw = ImageDraw.Draw(output)
draw.text(
    CANDIDATE_TITLE_ORIGIN,
    'Starseer existing HURT candidates — none establishes a matching hooded staff reaction',
    font=TITLE,
    fill=INK,
)
draw.text(
    CANDIDATE_SUBTITLE_ORIGIN,
    'Pinned v30 inputs at one common 0.72 source-pixel scale; no per-image fit. NOT runtime scale.',
    font=FONT,
    fill=MUTED,
)

# Candidate source rasters share one scale and floor; they are not runtime selections.
for index, path in enumerate(HURT_ALTERNATIVES):
    image = imageFor(path)
    panelX = (index % CANDIDATE_COLUMNS) * CANDIDATE_PANEL_WIDTH
    panelY = CANDIDATE_START_Y + (index // CANDIDATE_COLUMNS) * CANDIDATE_PANEL_HEIGHT
    floor = PAINTED_SOURCE_FLOOR_Y if 'painted-outfits' in path else STAGE_FLOOR_Y
    candidateSize = (
        round(image.width * CANDIDATE_SOURCE_SCALE),
        round(image.height * CANDIDATE_SOURCE_SCALE),
    )
    candidatePosition = (
        round(panelX + CANDIDATE_CENTER_X - image.width * CANDIDATE_SOURCE_SCALE / 2),
        round(panelY + CANDIDATE_GROUND_Y - floor * CANDIDATE_SOURCE_SCALE),
    )
    output.alpha_composite(
        image.resize(candidateSize, Image.Resampling.LANCZOS),
        candidatePosition,
    )
    draw.text(
        (panelX + PANEL_LABEL_INSET, panelY + CANDIDATE_LABEL_Y),
        path.replace('assets/animations/', ''),
        font=FONT,
        fill=INK,
    )
    draw.text(
        (panelX + PANEL_LABEL_INSET, panelY + CANDIDATE_RASTER_LABEL_Y),
        f'{image.width}x{image.height}; source floor reference {floor}',
        font=FONT,
        fill=MUTED,
    )

output.convert('RGB').save(HERE / 'starseer-existing-hurt-candidates.png', optimize=True)
outputImages = {}

for imagePath in sorted(HERE.glob('*.png')):
    outputImages[imagePath.name] = {
        'sha256': hashlib.sha256(imagePath.read_bytes()).hexdigest(),
        'bytes': imagePath.stat().st_size,
    }

manifest = {
    'sourceCommit': data['source'],
    'artTag': data['art'],
    'kind': 'before-only static diagnostic reconstruction; not gameplay capture',
    'inputAssets': records,
    'outputImages': outputImages,
}
(HERE / 'image-manifest.json').write_text(json.dumps(manifest, indent=JSON_INDENT) + '\n')
print(
    f'Verified all {len(records)} pinned raster hashes before output; '
    f'wrote {len(manifest["outputImages"])} sheets.'
)
