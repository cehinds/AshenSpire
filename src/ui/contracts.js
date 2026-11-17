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
 * @param {string[]} selectedIds
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
 * @property {string} label
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
 * @param {object} [options]
 * @returns {ScreenHandle | void}
 */

/**
 * @typedef {object} LongPressOptions
 * @property {number} [ms]
 * @property {number} [tolerance]
 * @property {(event: Event) => void} onHold
 */

/**
 * @typedef {object} Pressable
 * @property {(element: HTMLElement, options: LongPressOptions) => Disarm} armLongPress
 * @property {(button: HTMLElement, action: () => unknown) => Disarm} guardOnce
 * @property {(element: HTMLElement, onActivate: (event: Event) => void) => Disarm} activateOnKey
 */

export const CONTRACT_NAMES = Object.freeze([
    'CardRenderer',
    'ChoiceModal',
    'EffectLayers',
    'FeedbackChannel',
    'Modal',
    'Picker',
    'Pressable',
    'RailItem',
    'Screen',
]);
