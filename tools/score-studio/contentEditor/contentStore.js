// The game files the editor has open, one OpenFileStore each; sections only read from them.
import { OpenFileStore } from './openFileStore.js';

const FOLDER_SEPARATOR = '/';

export class ContentStore
{
    /** `api` is a ContentApi; `indent` is the files' JSON indent; `onChange` runs after edits. */
    constructor(api, indent, onChange)
    {
        this.api = api;
        this.indent = indent;
        this.onChange = onChange;
        this.files = new Map();
    }

    File(path)
    {
        if (!this.files.has(path))
        {
            this.files.set(path, new OpenFileStore(path, this.api, this.indent, this.onChange));
        }
        return this.files.get(path);
    }

    Load(path)
    {
        return this.File(path).Load();
    }

    Root(path)
    {
        return this.files.get(path).value;
    }

    /** Replaces a whole file's value, as a top-level JSON edit does. */
    SetRoot(path, value)
    {
        this.files.get(path).SetValue(value);
    }

    MarkChanged(path)
    {
        this.files.get(path).MarkChanged();
    }

    LoadedFiles()
    {
        return [...this.files.values()].filter((file) => file.loaded);
    }

    DirtyPaths()
    {
        return this.LoadedFiles()
            .filter((file) => file.dirty)
            .map((file) => file.path);
    }

    /** Saves every changed file through its queue: { saved, refused } with plain messages. */
    async SaveAll()
    {
        const files = this.LoadedFiles().filter((file) => file.dirty);
        const results = await Promise.all(files.map((file) => file.Save()));
        return {
            saved: files.filter((file, index) => results[index].saved).map((file) => file.path),
            refused: results.map((result) => result.refused).filter(Boolean),
        };
    }

    /** Rereads open files without unsaved edits; returns the paths whose text changed. */
    async ReloadClean()
    {
        const files = this.LoadedFiles();
        const changed = await Promise.all(files.map((file) => file.ReloadIfClean()));
        return files.filter((file, index) => changed[index]).map((file) => file.path);
    }

    /** Reloads every changed file from disk, dropping its unsaved edits. */
    async RevertAll()
    {
        const files = this.LoadedFiles().filter((file) => file.dirty);
        await Promise.all(files.map((file) => file.Revert()));
        this.onChange();
        return files.map((file) => file.path);
    }

    /** A short name for a repo path, for status lines. */
    static ShortName(path)
    {
        return path.split(FOLDER_SEPARATOR).pop();
    }
}
