/** Owns active timelines, one queued repaint, and the terminal handoff for a combat mount. */
export function CreateCombatPlayback({
    playTimeline,
    isCurrentMount,
    requestFrame,
    cancelFrame,
    setTimer,
    clearTimer,
    renderBeat,
    reportStartFailure,
})
{
    const active = new Set();
    let disposed = false;
    let frame = null;
    let dirty = false;
    let fitGeometry = false;
    let paintHand = false;
    let handoff = null;

    function isCurrent()
    {
        return !disposed && isCurrentMount();
    }

    function cancelQueuedFrame()
    {
        if (frame !== null)
        {
            cancelFrame?.(frame);
            frame = null;
        }
    }

    function discardBeatRender()
    {
        cancelQueuedFrame();
        dirty = fitGeometry = paintHand = false;
    }

    function flushBeatRender()
    {
        cancelQueuedFrame();
        if (!dirty)
        {
            return;
        }
        const geometry = fitGeometry;
        const hand = paintHand;
        dirty = fitGeometry = paintHand = false;
        if (isCurrent())
        {
            renderBeat({ geometry, hand });
        }
    }

    function clearHandoff()
    {
        if (handoff)
        {
            clearTimer(handoff.timer);
            handoff = null;
        }
    }

    return {
        Start(events, context, onFinish)
        {
            if (!isCurrent())
            {
                return;
            }
            const entry = { handle: null, finished: false };
            active.add(entry);
            const ownsTimeline = () => active.has(entry) && isCurrent();
            const whileCurrent = callback =>
                callback && ((...args) =>
                {
                    if (ownsTimeline())
                    {
                        return callback(...args);
                    }
                });
            const finish = () =>
            {
                if (entry.finished)
                {
                    return;
                }
                entry.finished = true;
                if (active.delete(entry) && isCurrent())
                {
                    onFinish();
                }
            };
            try
            {
                entry.handle = playTimeline(events, {
                    ...context,
                    isCurrent: ownsTimeline,
                    onIntent: whileCurrent(context.onIntent),
                    onResolution: whileCurrent(context.onResolution),
                    onStanceLead: whileCurrent(context.onStanceLead),
                    onEngagementMoved: whileCurrent(context.onEngagementMoved),
                    onLeadApplied: whileCurrent(context.onLeadApplied),
                    onBeatApplied: whileCurrent(context.onBeatApplied),
                    onFlush: whileCurrent(context.onFlush),
                }, finish);
                // A timeline may finish or detach while its handle is being created.
                if (!entry.finished && !ownsTimeline())
                {
                    entry.handle?.cancel?.();
                }
            }
            catch (error)
            {
                reportStartFailure(error);
                finish();
            }
        },

        QueueBeatRender({ geometry, hand })
        {
            if (!isCurrent())
            {
                return;
            }
            dirty = true;
            fitGeometry ||= geometry;
            paintHand ||= hand;
            if (fitGeometry || !requestFrame)
            {
                flushBeatRender();
            }
            else if (frame === null)
            {
                frame = requestFrame(flushBeatRender);
            }
        },

        DiscardBeatRender: discardBeatRender,

        ScheduleHandoff(callback, delay)
        {
            if (!isCurrent())
            {
                return;
            }
            clearHandoff();
            const entry = { timer: null };
            handoff = entry;
            entry.timer = setTimer(() =>
            {
                if (handoff !== entry)
                {
                    return;
                }
                handoff = null;
                if (isCurrent())
                {
                    callback();
                }
            }, delay);
        },

        Dispose()
        {
            disposed = true;
            const timelines = [...active];
            active.clear();
            clearHandoff();
            discardBeatRender();
            for (const timeline of timelines)
            {
                timeline.handle?.cancel?.();
            }
        },
    };
}
