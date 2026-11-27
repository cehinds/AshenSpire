// One open game file owns all its state: the base text from disk, the live value, what was saved,
// one shared read, an edit revision so late reads never replace newer edits, and a queue of saves.
import { FormatJsonLike } from './jsonText.js';

export class OpenFileStore
{
    /** `api` is a ContentApi; `indent` is the JSON indent; `onChange` runs after any change. */
    constructor(path, api, indent, onChange)
    {
        this.path = path;
        this.api = api;
        this.indent = indent;
        this.onChange = onChange;
        this.loaded = false;
        this.read = null;
        this.editRevision = 0;
        this.saving = Promise.resolve();
    }

    /** The live value; callers share one read, and a late read never replaces an open file. */
    Load()
    {
        if (this.loaded)
        {
            return Promise.resolve(this.value);
        }
        this.read ??= this.api.ReadFile(this.path).then((text) =>
        {
            if (!this.loaded)
            {
                this.Reset(text);
            }
            return this.value;
        }).finally(() =>
        {
            this.read = null;
        });
        return this.read;
    }

    /** Parses before committing, so a malformed file stays unloaded and the next Load retries. */
    Reset(text)
    {
        const value = JSON.parse(text);
        this.loaded = true;
        this.text = text;
        this.value = value;
        this.savedShape = JSON.stringify(this.value);
        this.Refresh();
    }

    Refresh()
    {
        this.dirty = JSON.stringify(this.value) !== this.savedShape;
    }

    /** Records a local edit; any read that started before it will not be applied. */
    MarkChanged()
    {
        this.editRevision += 1;
        this.Refresh();
        this.onChange();
    }

    SetValue(value)
    {
        this.value = value;
        this.MarkChanged();
    }

    /** Applies `text` read from disk only if nothing was edited since `revision` was taken. */
    ApplyRead(text, revision, onlyWhenChanged = true)
    {
        const unchanged = onlyWhenChanged && text === this.text;
        if (this.editRevision !== revision || unchanged)
        {
            return false;
        }
        this.Reset(text);
        this.onChange();
        return true;
    }

    /** Rereads a file with no unsaved edits; returns true when its text changed on disk. */
    async ReloadIfClean()
    {
        if (this.dirty)
        {
            return false;
        }
        const revision = this.editRevision;
        return this.ApplyRead(await this.api.ReadFile(this.path), revision);
    }

    /** Drops unsaved edits, unless more were typed while the file was being read. */
    async Revert()
    {
        const revision = this.editRevision;
        return this.ApplyRead(await this.api.ReadFile(this.path), revision, false);
    }

    /** Queues a save; each runs after the previous one and sends the newest value and base text. */
    Save()
    {
        const run = this.saving.then(() => this.SaveNow());
        this.saving = run.catch(() => {});
        return run;
    }

    /** { saved, refused }: refused holds the server's words when the file changed on disk. */
    async SaveNow()
    {
        if (!this.dirty)
        {
            return { saved: false, refused: null };
        }
        const shape = JSON.stringify(this.value);
        const revision = this.editRevision;
        const text = FormatJsonLike(this.text, this.value, this.indent);
        try
        {
            await this.api.SaveFile(this.path, text, this.text);
        }
        catch (error)
        {
            if (!error.stale)
            {
                throw error;
            }
            this.ApplyRead(await this.api.ReadFile(this.path), revision, false);
            return { saved: false, refused: error.message };
        }
        this.text = text;
        this.savedShape = shape;
        this.Refresh();
        this.onChange();
        return { saved: true, refused: null };
    }
}
