// The Score Studio "Game content" tab: pick a section, edit entries, then Save, Revert or Check.
// Every word, class name, route and size comes from the JSON files contentConfig.js loads.
import { FillTemplate } from '../../../src/model/textTemplate.js';
import { CheckOutput } from './checkOutput.js';
import { ContentApi } from './contentApi.js';
import { LoadContentConfig } from './contentConfig.js';
import { ContentSection } from './contentSection.js';
import { ContentStore } from './contentStore.js';
import { El, TextInput } from './dom.js';
import { EditorToolbar } from './editorToolbar.js';
import { CreateFieldRenderers } from './fieldRenderers.js';
import { LatestLoad } from './latestLoad.js';

const OPENED_FLAG = 'contentEditorOpened';
const LISTBOX_ROLE = 'listbox';
const STYLESHEET_REL = 'stylesheet';
// This class cannot come from config: the config itself may be what failed to load.
const OPEN_ERROR_CLASS = 'ce-open-error';
const SHOWN_PANEL_CLASS = 'is-active';

let openEditor = null;

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

function showOpenError(panel, error)
{
    panel.replaceChildren(El('p', { className: OPEN_ERROR_CLASS, text: error.message }));
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
        this.toolbar = new EditorToolbar({
            ui: this.ui,
            sections: config.sections,
            onSection: (sectionId) => this.ShowSection(sectionId),
            onAction: (action) => this[action](),
        });
        this.checkOutput = new CheckOutput(this.ui);
        this.BuildPanes();
        panel.append(this.Layout());
        window.addEventListener('beforeunload', (event) => this.WarnUnsaved(event));
    }

    BuildPanes()
    {
        const classes = this.classes;
        const filter = (text) => this.current?.Filter(text);
        this.search = TextInput('', filter, { className: classes.search });
        this.search.placeholder = this.text.search;
        const form = El('div', { className: classes.form });
        const scrollerChildren = [
            this.checkOutput.element,
            form,
        ];
        this.panes = {
            list: El('div', { className: classes.list, attributes: { role: LISTBOX_ROLE } }),
            form,
            scroller: El('div', { className: classes.formPane }, scrollerChildren),
            suggestions: El('div', { attributes: { hidden: '' } }),
            latestLoad: new LatestLoad(),
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
            this.toolbar.element,
            body,
            this.panes.suggestions,
        ]);
    }

    SetStatus(text, isError = false)
    {
        this.toolbar.SetStatus(text, isError);
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
        this.toolbar.ShowUnsaved(this.ShortNames(this.store.DirtyPaths()));
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
        this.toolbar.ShowSection(sectionId);
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
            this.toolbar.SetDisabled(this.ui.disabledDuringSave, true);
            try
            {
                await this.SaveAndReport();
            }
            finally
            {
                this.toolbar.SetDisabled(this.ui.disabledDuringSave, false);
            }
        });
    }

    async SaveAndReport()
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

    Check()
    {
        return this.Run(async () =>
        {
            this.toolbar.SetDisabled(this.ui.disabledDuringCheck, true);
            this.SetStatus(this.text.checking);
            try
            {
                const result = await this.store.api.RunCheck();
                this.checkOutput.Show(result);
                const message = result.ok
                    ? this.text.passed
                    : this.text.failed;
                this.SetStatus(message, !result.ok);
                await this.ReloadFromDisk();
            }
            finally
            {
                this.toolbar.SetDisabled(this.ui.disabledDuringCheck, false);
            }
        });
    }
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
        openEditor = editor;
        await editor.ShowSection(config.sections[0].id);
    }
    catch (error)
    {
        delete panel.dataset[OPENED_FLAG];
        showOpenError(panel, error);
    }
}

/** Saves the Game content editor when its panel is showing; false leaves the key to the caller. */
export function SaveShownContentEditor(panel)
{
    const shown = panel?.classList.contains(SHOWN_PANEL_CLASS);
    if (!openEditor || !shown)
    {
        return false;
    }
    openEditor.Save();
    return true;
}
