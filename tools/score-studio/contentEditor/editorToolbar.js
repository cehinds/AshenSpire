// The Game content toolbar: section picker, "Not saved" pill, status line, configured buttons.
import { Button, El } from './dom.js';

export class EditorToolbar
{
    /** `onSection(id)` runs on a section pick; `onAction(action)` on a button press. */
    constructor({ ui, sections, onSection, onAction })
    {
        this.classes = ui.classes;
        this.status = El('span', { className: this.classes.status });
        this.dirtyPill = El('span', { className: this.classes.dirtyPill, text: ui.text.notSaved });
        this.dirtyPill.hidden = true;
        this.sectionSelect = this.SectionSelect(sections, onSection);
        const pairs = ui.buttons.map((spec) => [spec.action, this.ActionButton(spec, onAction)]);
        this.buttons = new Map(pairs);
        this.element = El('div', { className: this.classes.toolbar }, [
            this.sectionSelect,
            this.dirtyPill,
            this.status,
            ...this.buttons.values(),
        ]);
    }

    SectionSelect(sections, onSection)
    {
        const options = sections.map((section) =>
        {
            return El('option', { text: section.label, attributes: { value: section.id } });
        });
        const select = El('select', {
            className: this.classes.sectionSelect,
            on: {
                change: () => onSection(select.value),
            },
        }, options);
        return select;
    }

    ActionButton(spec, onAction)
    {
        const className = this.classes[spec.className];
        return Button(spec.text, className, () => onAction(spec.action), spec.title);
    }

    ShowSection(sectionId)
    {
        this.sectionSelect.value = sectionId;
    }

    SetStatus(text, isError = false)
    {
        this.status.textContent = text;
        this.status.classList.toggle(this.classes.error, isError);
    }

    /** Shows the pill while `files` is not empty; its hover lists them. */
    ShowUnsaved(files)
    {
        this.dirtyPill.hidden = files.length === 0;
        this.dirtyPill.title = files;
    }

    SetDisabled(actions, isDisabled)
    {
        for (const action of actions)
        {
            this.buttons.get(action).disabled = isDisabled;
        }
    }
}
