import { hintImage } from './imageHints.js';
import { currentArtUrl } from './highResArt.js';

function buildPlaneNode(kind, part, planeLook)
{
    const planeImage = hintImage(
        document.createElement('img'),
        planeLook.imageHintOptions,
    );

    planeImage.className = planeLook.className;
    planeImage.dataset.effect = kind;
    planeImage.dataset.plane = part.plane;
    planeImage.alt = '';
    planeImage.setAttribute(
        'aria-hidden',
        'true',
    );

    Object.assign(
        planeImage.style,
        {
            position: 'absolute',
            pointerEvents: 'none',
            maxWidth: 'none',
            aspectRatio: '1',
            objectFit: 'contain',
            zIndex: part.plane === 'behind' ? planeLook.behindZIndex : planeLook.frontZIndex,
            maskImage: part.mask,
            webkitMaskImage: part.mask,
            ...planeLook.styleOf(part),
        },
    );

    return planeImage;
}

function clampFrameIndex(frame, frameCount)
{
    return Math.max(
        0,
        Math.min(
            frameCount - 1,
            Math.floor(frame),
        ),
    );
}

export function CreateEffectPlanes({
    host,
    kind,
    frames,
    planes,
    planeLook,
    settings,
    placePlanes,
    shouldSkipRepeatedFrame = false,
})
{
    const nodes = planes.map((part) =>
    {
        const planeImage = buildPlaneNode(
            kind,
            part,
            planeLook,
        );

        host.append(planeImage);

        return { el: planeImage, part };
    });

    let isStopped = false;
    let shownFrameIndex = -1;

    const update = (options) =>
    {
        if (isStopped)
        {
            return;
        }

        Object.assign(
            settings,
            options,
        );
        placePlanes(
            nodes,
            settings,
        );
    };

    const show = (frame) =>
    {
        if (isStopped)
        {
            return;
        }

        const frameIndex = clampFrameIndex(
            frame,
            frames.length,
        );

        if (
            shouldSkipRepeatedFrame
            && frameIndex === shownFrameIndex
        )
        {
            return;
        }

        shownFrameIndex = frameIndex;

        const frameUrl = currentArtUrl(frames[frameIndex]);

        for (const { el } of nodes)
        {
            el.src = frameUrl;
            el.dataset.frame = String(frameIndex + 1);
        }
    };

    const stop = () =>
    {
        isStopped = true;

        for (const { el } of nodes)
        {
            el.remove();
        }
    };

    update({});
    show(0);

    return { show, update, stop };
}
