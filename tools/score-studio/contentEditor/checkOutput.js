// The Check result panel: one line per build or check step, FAIL lines in red.
import { El } from './dom.js';

export class CheckOutput
{
    constructor(ui)
    {
        this.ui = ui;
        this.classes = ui.classes;
        this.element = El('div', { className: this.classes.check });
        this.element.hidden = true;
    }

    LineClass(line)
    {
        const { failPrefix, passPrefix } = this.ui.checkLines;
        if (line.startsWith(failPrefix))
        {
            return this.classes.checkFail;
        }
        return line.startsWith(passPrefix)
            ? this.classes.checkPass
            : '';
    }

    /** Shows the lines of a { ok, lines } check result. */
    Show(result)
    {
        const lines = result.lines.filter(Boolean).map((line) =>
        {
            return El('div', { className: this.LineClass(line), text: line });
        });
        this.element.replaceChildren(...lines);
        this.element.hidden = false;
    }
}
