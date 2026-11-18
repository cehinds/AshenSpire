import assert from 'node:assert/strict';
import { after, test } from 'node:test';

function createTarget()
{
    const listeners = [];
    return {
        listeners,
        addEventListener(type, handler, options)
        {
            listeners.push({ type, handler, capture: options === true || options?.capture === true });
        },
        removeEventListener(type, handler, options)
        {
            const capture = options === true || options?.capture === true;
            const at = listeners.findIndex((entry) =>
                entry.type === type && entry.handler === handler && entry.capture === capture
            );
            if (at >= 0)
            {
                listeners.splice(at, 1);
            }
        },
        fire(type, event = {})
        {
            const sent = { type, currentTarget: this, ...event };
            for (const entry of [...listeners].filter((item) => item.type === type))
            {
                if (sent.isImmediateStopped)
                {
                    break;
                }
                entry.handler(sent);
            }
            return sent;
        },
        count(type)
        {
            return listeners.filter((entry) => entry.type === type).length;
        },
    };
}

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const fakeWindow = createTarget();
globalThis.window = fakeWindow;
after(() =>
{
    if (originalWindow)
    {
        Object.defineProperty(globalThis, 'window', originalWindow);
    }
    else
    {
        delete globalThis.window;
    }
});

const { ArmLongPress, CreateBusyLock, GuardOnce } = await import('../src/ui/pressable.js');

function createElement()
{
    const element = createTarget();
    element.captured = [];
    element.setPointerCapture = (id) => element.captured.push(id);
    element.releasePointerCapture = () => {};
    element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });
    return element;
}

function press(element, event = {})
{
    return element.fire('pointerdown', { pointerId: 1, button: 0, clientX: 0, clientY: 0, ...event });
}

function click(element)
{
    const event = {
        isDefaultPrevented: false,
        isImmediateStopped: false,
        preventDefault() { this.isDefaultPrevented = true; },
        stopImmediatePropagation() { this.isImmediateStopped = true; },
    };
    return element.fire('click', event);
}

const timedTests = new WeakSet();

function armed(t, options = {})
{
    if (!timedTests.has(t))
    {
        timedTests.add(t);
        t.mock.timers.enable({ apis: ['setTimeout'] });
    }
    const element = createElement();
    const holds = [];
    const disarm = ArmLongPress(element, {
        holdMs: 450,
        tolerancePx: 12,
        onHold: () =>
        {
            holds.push('hold');
            return true;
        },
        ...options,
    });
    t.after(() => disarm());
    return { element, holds, disarm };
}

test('ArmLongPress fires at exactly holdMs, not before', (t) =>
{
    const { element, holds } = armed(t);
    press(element);
    t.mock.timers.tick(449);
    assert.deepEqual(holds, []);
    t.mock.timers.tick(1);
    assert.deepEqual(holds, ['hold']);
});

test('ArmLongPress keeps the hold within tolerance and cancels past it', (t) =>
{
    const within = armed(t);
    press(within.element);
    fakeWindow.fire('pointermove', { pointerId: 1, clientX: 12, clientY: 0 });
    t.mock.timers.tick(450);
    assert.deepEqual(within.holds, ['hold'], 'movement exactly at tolerance keeps the hold');
    fakeWindow.fire('pointerup', { pointerId: 1 });

    const beyond = armed(t);
    press(beyond.element);
    fakeWindow.fire('pointermove', { pointerId: 1, clientX: 12.01, clientY: 0 });
    t.mock.timers.tick(450);
    assert.deepEqual(beyond.holds, [], 'movement past tolerance cancels the hold');
    fakeWindow.fire('pointerup', { pointerId: 1 });
});

test('ArmLongPress cancels on an early release or cancel', (t) =>
{
    for (const end of ['pointerup', 'pointercancel'])
    {
        const { element, holds, disarm } = armed(t);
        press(element);
        t.mock.timers.tick(200);
        fakeWindow.fire(end, { pointerId: 1 });
        t.mock.timers.tick(1000);
        assert.deepEqual(holds, [], `${end} before holdMs cancels the hold`);
        disarm();
    }
});

test('ArmLongPress swallows only the click after a hold that returned true', (t) =>
{
    const { element } = armed(t);
    press(element);
    t.mock.timers.tick(450);
    fakeWindow.fire('pointerup', { pointerId: 1 });
    assert.equal(click(element).isDefaultPrevented, true, 'the hold release click is swallowed');
    assert.equal(click(element).isDefaultPrevented, false, 'only once');

    const declined = armed(t, { onHold: () => false });
    press(declined.element);
    t.mock.timers.tick(450);
    fakeWindow.fire('pointerup', { pointerId: 1 });
    assert.equal(click(declined.element).isDefaultPrevented, false, 'a declined hold keeps its click');
});

test('ArmLongPress honours the primary-button, capture and leave options, and declines key presses', (t) =>
{
    const primary = armed(t);
    press(primary.element, { button: 2 });
    t.mock.timers.tick(450);
    assert.deepEqual(primary.holds, [], 'a secondary button is not a press by default');
    assert.deepEqual(primary.element.captured, []);

    const anyButton = armed(t, { isPrimaryOnly: false, shouldCapturePointer: false, shouldCancelOnLeave: true });
    press(anyButton.element, { button: 2 });
    assert.deepEqual(anyButton.element.captured, [], 'shouldCapturePointer: false leaves the pointer uncaptured');
    anyButton.element.fire('pointerleave');
    t.mock.timers.tick(450);
    assert.deepEqual(anyButton.holds, [], 'leaving the element cancels when asked');
    fakeWindow.fire('pointerup', { pointerId: 1 });

    const keyPress = primary.element.fire('gppress', {
        detail: { source: 'key' },
        preventDefault() { this.isDefaultPrevented = true; },
    });
    assert.notEqual(keyPress.isDefaultPrevented, true, 'a key press is declined, so it activates at once');
});

test('ArmLongPress disarm removes every listener it added', (t) =>
{
    const { element, disarm } = armed(t);
    disarm();
    for (const type of ['pointerdown', 'gppress', 'gprelease', 'click', 'pointerleave'])
    {
        assert.equal(element.count(type), 0, type);
    }
});

test('GuardOnce disables the button while an async action runs and refuses a second press', async () =>
{
    const button = createElement();
    button.disabled = false;
    let finish = null;
    let runs = 0;
    GuardOnce(button, () =>
    {
        runs += 1;
        return new Promise((resolve) => { finish = resolve; });
    });
    const first = button.fire('click');
    assert.equal(button.disabled, true, 'disabled while running');
    button.fire('click');
    assert.equal(runs, 1, 'a second press while busy is refused');
    finish();
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(button.disabled, false, 're-enabled when the action settles');
    void first;
});

test('GuardOnce re-enables after a throwing action and shares a lock across controls', async () =>
{
    const lock = CreateBusyLock();
    const first = createElement();
    const second = createElement();
    first.disabled = false;
    second.disabled = false;
    const order = [];
    GuardOnce(first, async () =>
    {
        order.push('first');
        throw new Error('refused');
    }, { lock, controls: [first, second] });
    GuardOnce(second, () => order.push('second'), { lock, controls: [first, second] });
    const running = lock.Run([first, second], () => new Promise((resolve) => setImmediate(resolve)));
    second.fire('click');
    assert.deepEqual(order, [], 'the shared lock refuses while another action runs');
    await running;
    await assert.rejects(Promise.resolve(lock.Run([first], async () => { throw new Error('x'); })));
    assert.equal(first.disabled, false, 'a throwing action still restores');
    assert.equal(lock.IsBusy(), false);
});

test('CreateBusyLock runs a custom restore instead of re-enabling every control', async () =>
{
    const lock = CreateBusyLock();
    const kept = { disabled: false };
    const restored = { disabled: false };
    await lock.Run([kept, restored], () => 'done', () => { restored.disabled = false; });
    assert.equal(kept.disabled, true, 'the custom restore decides what comes back');
    assert.equal(restored.disabled, false);
});
