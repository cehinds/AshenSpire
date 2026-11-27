// The Score Studio "Game content" tab: pick a section, edit entries, Save, Revert or Check.
// Every word, class name, route and size comes from the JSON files contentConfig.js loads.
import { ContentApi } from './contentApi.js';
import { LoadContentConfig } from './contentConfig.js';
import { ContentSection } from './contentSection.js';
import { ContentStore } from './contentStore.js';
import { Button, El, TextInput } from './dom.js';
import { CreateFieldRenderers } from './fieldRenderers.js';
import { FillTemplate } from './textTemplate.js';

const OPENED_FLAG = 'contentEditorOpened';
const LISTBOX_ROLE = 'listbox';
const STYLESHEET_REL = 'stylesheet';
// The config may be what failed to load, so this one class name cannot come from it.
const OPEN_ERROR_CLASS = 'ce-open-error';

function loadStylesheet(href)
{
    const link = El('link', {
        attributes: {
            rel: STYLESHEET_REL,
            href,
        },
    });
    document.head.append(link);
}

class ContentEditor
{
    constructor(panel, config)
    {
        this.config = config;
        this.ui = config.ui;
        this.classes = config.ui.classes;
        this.text = config.ui.text;
        this.sections = new Map();
        this.renderers = CreateFieldRenderers(this.ui);
        const api = new ContentApi(config.api);
        this.store = new ContentStore(api, this.ui.sizes.jsonIndent, () => this.ShowDirty());
        this.BuildPanes();
        panel.append(this.Layout());
        window.addEventListener('beforeunload', (event) => this.WarnUnsaved(event));
    }

    BuildPanes()
    {
        const classes = this.classes;
        this.status = El('span', { className: classes.status });
        this.dirtyPill = El('span', { className: classes.dirtyPill, text: this.text.notSaved });
        this.dirtyPill.hidden = true;
        const filter = (text) => this.current?.Filter(text);
        this.search = TextInput('', filter, { className: classes.search });
        this.search.placeholder = this.text.search;
        this.checkOutput = El('div', { className: classes.check });
        this.checkOutput.hidden = true;
        const form = El('div', { className: classes.form });
        const listAttributes = {
            role: LISTBOX_ROLE,
        };
        this.panes = {
            list: El('div', { className: classes.list, attributes: listAttributes }),
            form,
            scroller: El('div', { className: classes.formPane }, [this.checkOutput, form]),
            suggestions: El('div', { attributes: { hidden: '' } }),
        };
    }

    Layout()
    {
        const listPane = El('div', { className: this.classes.listPane }, [
            this.search,
            this.panes.list,
        ]);
        const body = El('div', { className: this.classes.body }, [
            listPane,
            this.panes.scroller,
        ]);
        return El('div', { className: this.classes.root }, [
            this.Toolbar(),
            body,
            this.panes.suggestions,
        ]);
    }

    ToolbarButton(spec)
    {
        const className = this.classes[spec.className];
        return Button(spec.text, className, () => this[spec.action](), spec.title);
    }

    Toolbar()
    {
        const sectionOptions = this.config.sections.map((section) =>
        {
            return El('option', { text: section.label, attributes: { value: section.id } });
        });
        this.sectionSelect = El('select', {
            className: this.classes.sectionSelect,
            on: {
                change: () => this.ShowSection(this.sectionSelect.value),
            },
        }, sectionOptions);
        const pairs = this.ui.buttons.map((spec) => [spec.action, this.ToolbarButton(spec)]);
        this.buttons = new Map(pairs);
        return El('div', { className: this.classes.toolbar }, [
            this.sectionSelect,
            this.dirtyPill,
            this.status,
            ...this.buttons.values(),
        ]);
    }

    SetStatus(text, isError = false)
    {
        this.status.textContent = text;
        this.status.classList.toggle(this.classes.error, isError);
    }

    async Run(task)
    {
        try
        {
            await task();
        }
        catch (error)
        {
            this.SetStatus(error.message, true);
        }
    }

    ShortNames(paths)
    {
        return paths.map((path) => ContentStore.ShortName(path)).join(this.text.listSeparator);
    }

    FilesMessage(template, emptyText, paths)
    {
        return paths.length
            ? FillTemplate(template, { files: this.ShortNames(paths) })
            : emptyText;
    }

    ShowDirty()
    {
        const dirty = this.store.DirtyPaths();
        this.dirtyPill.hidden = dirty.length === 0;
        this.dirtyPill.title = this.ShortNames(dirty);
    }

    WarnUnsaved(event)
    {
        if (this.store.DirtyPaths().length > 0)
        {
            event.preventDefault();
        }
    }

    SectionFor(sectionId)
    {
        if (!this.sections.has(sectionId))
        {
            const section = new ContentSection({
                config: this.config.sections.find((candidate) => candidate.id === sectionId),
                fieldSets: this.config.fieldSets,
                store: this.store,
                panes: this.panes,
                ui: this.ui,
                renderers: this.renderers,
            });
            this.sections.set(sectionId, section);
        }
        return this.sections.get(sectionId);
    }

    ShowSection(sectionId)
    {
        this.current = this.SectionFor(sectionId);
        this.sectionSelect.value = sectionId;
        this.search.value = this.current.filterText;
        return this.Run(async () =>
        {
            this.SetStatus(this.text.loading);
            await this.current.Open();
            this.SetStatus('');
        });
    }

    /** Rereads open files a build may have rewritten, then redraws the section if any changed. */
    async ReloadFromDisk()
    {
        const changed = await this.store.ReloadClean();
        if (changed.length > 0)
        {
            await this.current.Open();
        }
    }

    ScheduleReload()
    {
        clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(() =>
        {
            this.Run(() => this.ReloadFromDisk());
        }, this.ui.timing.reloadAfterSaveMs);
    }

    Save()
    {
        return this.Run(async () =>
        {
            const { saved, refused } = await this.store.SaveAll();
            if (refused.length > 0)
            {
                await this.current.Open();
                this.SetStatus(refused.join(this.text.messageSeparator), true);
                return;
            }
            this.SetStatus(this.FilesMessage(this.text.saved, this.text.nothingToSave, saved));
            this.ScheduleReload();
        });
    }

    Revert()
    {
        return this.Run(async () =>
        {
            const reverted = await this.store.RevertAll();
            await this.current.Open();
            const { reverted: template, nothingToRevert } = this.text;
            this.SetStatus(this.FilesMessage(template, nothingToRevert, reverted));
        });
    }

    CheckLine(line)
    {
        const { failPrefix, passPrefix } = this.ui.checkLines;
        const className = line.startsWith(failPrefix)
            ? this.classes.checkFail
            : line.startsWith(passPrefix)
                ? this.classes.checkPass
                : '';
        return El('div', { className, text: line });
    }

    ShowCheck(result)
    {
        const lines = result.lines.filter(Boolean).map((line) => this.CheckLine(line));
        this.checkOutput.replaceChildren(...lines);
        this.checkOutput.hidden = false;
        const message = result.ok
            ? this.text.passed
            : this.text.failed;
        this.SetStatus(message, !result.ok);
    }

    SetBusy(isBusy)
    {
        for (const action of this.ui.disabledDuringCheck)
        {
            this.buttons.get(action).disabled = isBusy;
        }
    }

    Check()
    {
        return this.Run(async () =>
        {
            this.SetBusy(true);
            this.SetStatus(this.text.checking);
            try
            {
                this.ShowCheck(await this.store.api.RunCheck());
                await this.ReloadFromDisk();
            }
            finally
            {
                this.SetBusy(false);
            }
        });
    }
}

function showOpenError(panel, error)
{
    panel.replaceChildren(El('p', { className: OPEN_ERROR_CLASS, text: error.message }));
}

/** Builds the Game content tab the first time it is shown; a failed open retries next time. */
export async function OpenContentEditor(panel)
{
    if (panel.dataset[OPENED_FLAG])
    {
        return;
    }
    panel.dataset[OPENED_FLAG] = String(true);
    try
    {
        const config = await LoadContentConfig();
        loadStylesheet(new URL(config.ui.stylesheet, config.folderUrl).href);
        panel.replaceChildren();
        const editor = new ContentEditor(panel, config);
        await editor.ShowSection(config.sections[0].id);
    }
    catch (error)
    {
        delete panel.dataset[OPENED_FLAG];
        showOpenError(panel, error);
    }
}
