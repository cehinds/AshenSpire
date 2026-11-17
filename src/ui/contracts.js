/**
 * @callback Disarm
 * @returns {void}
 */

/**
 * @typedef {object} ModalCloseOptions
 * @property {boolean} [restoreFocus]
 * @property {boolean} [liftNow]
 * @property {boolean} [keepParent]
 * @property {boolean} [retainInputShield]
 */

/**
 * @typedef {object} Modal
 * @property {(options?: ModalCloseOptions) => void} close
 * @property {(model: any) => void} [update]
 * @property {HTMLElement} [panel]
 * @property {HTMLElement} [veil]
 */

/**
 * @typedef {object} ModalOpenOptions
 * @property {(() => void) | null} [onClose]
 */

/**
 * @callback OpenModalFunction
 * @param {ModalOpenOptions} [options]
 * @returns {Modal}
 */

/**
 * @typedef {object} ModalPresentation
 * @property {string} kind
 * @property {Record<string, unknown>} config
 * @property {() => Record<string, string>} cssProperties
 * @property {(panel: HTMLElement) => HTMLElement} apply
 */

/**
 * @typedef {object} PickerRow
 * @property {string} id
 * @property {string} name
 * @property {boolean} [disabled]
 */

/**
 * @callback PickerSelectHandler
 * @param {string} optionId
 * @param {HTMLElement} optionElement
 * @returns {void}
 */

/**
 * @typedef {object} PickerOptions
 * @property {PickerSelectHandler | null} [onSelect]
 * @property {string | null} [selectedId]
 * @property {string} [idAttr]
 * @property {number | null} [columns]
 */

/**
 * @callback PickerRender
 * @param {any[]} rows
 * @param {PickerOptions} [options]
 * @returns {HTMLElement}
 */

/**
 * @callback PickerMark
 * @param {HTMLElement} list
 * @param {string} idAttr
 * @param {ReadonlyArray<string | null>} selectedIds
 * @returns {void}
 */

/**
 * @typedef {object} Picker
 * @property {PickerRender} render
 * @property {PickerMark} mark
 * @property {(optionId: string) => void} [select]
 * @property {(rows: any[]) => void} [update]
 * @property {() => void} [focusFirst]
 */

/**
 * @typedef {object} ChoiceModalOpenOptions
 * @property {any[]} rows
 * @property {boolean} [multi]
 * @property {string} [commitLabel]
 */

/**
 * @typedef {object} ChoiceModal
 * @property {(options: ChoiceModalOpenOptions) => Modal} open
 * @property {() => void} [commit]
 * @property {() => void} [cancel]
 */

/**
 * @typedef {object} RenderedCard
 * @property {HTMLElement} element
 * @property {unknown} [model]
 * @property {(options?: object) => void} [update]
 * @property {() => void} [fit]
 */

/**
 * @callback CardRenderer
 * @param {unknown} registries
 * @param {unknown} reference
 * @param {object} [options]
 * @returns {HTMLElement | RenderedCard | string}
 */

/**
 * @typedef {object} EffectLayers
 * @property {(frame: number) => void} show
 * @property {(options: object) => void} update
 * @property {() => void} stop
 */

/**
 * @callback MountEffectLayers
 * @param {HTMLElement} host
 * @param {string} kind
 * @param {object} [options]
 * @returns {EffectLayers | null}
 */

/**
 * @callback PlayEffectLayers
 * @param {HTMLElement} host
 * @param {string} kind
 * @param {object} [options]
 * @returns {Disarm | null}
 */

/**
 * @callback CueSink
 * @param {string} cueId
 * @returns {unknown}
 */

/**
 * @typedef {object} FeedbackChannel
 * @property {(cueId: string) => void} play
 * @property {CueSink | null} sink
 * @property {string[]} recent
 * @property {() => boolean} [enabled]
 */

/**
 * @typedef {object} RailItem
 * @property {string} id
 * @property {string} [label]
 * @property {boolean} selected
 * @property {string} [value]
 */

/**
 * @typedef {object} ScreenHandle
 * @property {(model: any) => void} [update]
 * @property {() => void} [dispose]
 */

/**
 * @callback Screen
 * @param {HTMLElement} app
 * @param {any} [options]
 * @returns {ScreenHandle | void}
 */

/**
 * @typedef {object} LongPressOptions
 * @property {number} holdMs
 * @property {number} [tolerancePx]
 * @property {(event: Event) => boolean | void} onHold
 * @property {boolean} [isPrimaryOnly]
 * @property {boolean} [shouldCapturePointer]
 * @property {boolean} [shouldCancelOnLeave]
 */

/**
 * @typedef {object} Pressable
 * @property {(element: HTMLElement, options: LongPressOptions) => Disarm} armLongPress
 * @property {(button: HTMLElement & { disabled: boolean }, action: (event: Event) => unknown) => Disarm} guardOnce
 */

/**
 * @typedef {object} SelectionMarkOptions
 * @property {string | ReadonlyArray<string> | null} [className]
 * @property {string | ReadonlyArray<string> | null} [ariaAttribute]
 * @property {string | null} [ariaCurrent]
 */

/**
 * @callback SelectionMarker
 * @param {Element | Iterable<Element>} nodes
 * @param {boolean | ((node: Element, index: number) => unknown)} isSelected
 * @param {SelectionMarkOptions} [options]
 * @returns {void}
 */

/**
 * @typedef {object} KeyActivationOptions
 * @property {((event: KeyboardEvent) => boolean) | null} [canActivate]
 * @property {boolean} [shouldStopPropagation]
 */

/**
 * @callback KeyActivator
 * @param {HTMLElement} element
 * @param {((event: KeyboardEvent) => void) | null} [onActivate]
 * @param {KeyActivationOptions} [options]
 * @returns {Disarm}
 */

/**
 * @typedef {'vertical' | 'horizontal' | 'both'} RovingOrientation
 */

/**
 * @typedef {object} RovingListOptions
 * @property {() => HTMLElement[]} [items]
 * @property {RovingOrientation | (() => RovingOrientation | null)} [orientation]
 * @property {number} [columns]
 * @property {boolean} [hasHomeEnd]
 * @property {number | null} [startIndex]
 * @property {boolean} [shouldStopPropagation]
 * @property {(target: HTMLElement, event: KeyboardEvent) => void} [onMove]
 */

/**
 * @callback RovingNavigator
 * @param {HTMLElement} listElement
 * @param {RovingListOptions} [options]
 * @returns {Disarm}
 */

export const CONTRACT_NAMES = Object.freeze([
    'EffectLayers',
    'FeedbackChannel',
    'KeyActivator',
    'Modal',
    'Picker',
    'Pressable',
    'RailItem',
    'RovingNavigator',
    'Screen',
    'SelectionMarker',
]);

export const PLANNED_CONTRACT_NAMES = Object.freeze([
    'CardRenderer',
    'ChoiceModal',
]);
