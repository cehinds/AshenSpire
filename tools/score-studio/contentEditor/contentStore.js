// Holds the game JSON files the editor has open, which ones changed, and saves them.
import { FormatJsonLike } from './jsonText.js';

const FOLDER_SEPARATOR = '/';

/** One open file: its text on disk, its live value, and whether they differ. */
class OpenFile
{
    constructor(text)
    {
        this.Reset(text);
    }

    Reset(text)
    {
        this.text = text;
        this.value = JSON.parse(text);
        this.MarkSaved(text);
    }

    /** `shape` is the value as it was sent; edits made while the save ran stay dirty. */
    MarkSaved(text, shape = JSON.stringify(this.value))
    {
        this.text = text;
        this.savedShape = shape;
        this.Refresh();
    }

    Refresh()
    {
        this.dirty = JSON.stringify(this.value) !== this.savedShape;
    }
}

export class ContentStore
{
    /** `api` is a ContentApi; `indent` is the files' JSON indent; `onChange` runs after edits. */
    constructor(api, indent, onChange)
    {
        this.api = api;
        this.indent = indent;
        this.files = new Map();
        this.onChange = onChange;
        this.saving = Promise.resolve();
    }

    /** The live value of a file, loaded once. */
    async Load(path)
    {
        if (!this.files.has(path))
        {
            this.files.set(path, new OpenFile(await this.api.ReadFile(path)));
        }
        return this.files.get(path).value;
    }

    /** Replaces a whole file's value, as a top-level JSON edit does. */
    SetRoot(path, value)
    {
        this.files.get(path).value = value;
        this.MarkChanged(path);
    }

    Root(path)
    {
        return this.files.get(path).value;
    }

    MarkChanged(path)
    {
        this.files.get(path).Refresh();
        this.onChange();
    }

    DirtyPaths()
    {
        return [...this.files.entries()]
            .filter(([, file]) => file.dirty)
            .map(([path]) => path);
    }

    /** Saves one file; a stale refusal reloads it from disk and returns the server's words. */
    async SaveFile(path)
    {
        const file = this.files.get(path);
        const shape = JSON.stringify(file.value);
        const text = FormatJsonLike(file.text, file.value, this.indent);
        try
        {
            await this.api.SaveFile(path, text, file.text);
            file.MarkSaved(text, shape);
            return null;
        }
        catch (error)
        {
            if (!error.stale)
            {
                throw error;
            }
            const onDisk = await this.api.ReadFile(path);
            // Edits typed after the request was sent are kept; Revert reloads the file if wanted.
            if (JSON.stringify(file.value) === shape)
            {
                file.Reset(onDisk);
            }
            return error.message;
        }
    }

    /** Writes every changed file: { saved, refused } where refused holds plain messages. */
    /** Saves run one after another, so each starts from the text the previous one wrote. */
    SaveAll()
    {
        const run = this.saving.then(() => this.SaveDirty());
        this.saving = run.catch(() => {});
        return run;
    }

    async SaveDirty()
    {
        const saved = [];
        const refused = [];
        for (const path of this.DirtyPaths())
        {
            const problem = await this.SaveFile(path);
            if (problem)
            {
                refused.push(problem);
                continue;
            }
            saved.push(path);
        }
        this.onChange();
        return {
            saved,
            refused,
        };
    }

    /** Rereads every open file without unsaved edits; returns the paths whose text changed. */
    async ReloadClean()
    {
        const clean = [...this.files.entries()].filter(([, file]) => !file.dirty);
        const texts = await Promise.all(clean.map(([path]) => this.api.ReadFile(path)));
        const changed = [];
        clean.forEach(([path, file], index) =>
        {
            // An edit typed while the files were being read wins over the reload.
            if (file.dirty || texts[index] === file.text)
            {
                return;
            }
            file.Reset(texts[index]);
            changed.push(path);
        });
        this.onChange();
        return changed;
    }

    /** Reloads every changed file from disk, dropping unsaved edits. */
    async RevertAll()
    {
        const reverted = this.DirtyPaths();
        for (const path of reverted)
        {
            this.files.get(path).Reset(await this.api.ReadFile(path));
        }
        this.onChange();
        return reverted;
    }

    /** A short name for a repo path, for status lines. */
    static ShortName(path)
    {
        return path.split(FOLDER_SEPARATOR).pop();
    }
}
