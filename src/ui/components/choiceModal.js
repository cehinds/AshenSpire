import { openModal, button, el as buildElement } from '../kit/index.js';
import { t as translate } from '../strings.js';
import { optionRowList, markOptionRows } from './optionRowList.js';
import { ModalModelFor } from '../models/ModalModel.js';

const CLICK_EVENT = 'click';
const NO_SCROLL = Object.freeze({ preventScroll: true });
const FOCUSABLE_ATTRIBUTES = Object.freeze({ 'data-focusable': 'true' });
const ORDER_MARK_CLASS = 'co-order';
const ORDER_MARK_SELECTOR = `.${ORDER_MARK_CLASS}`;

function isEnabledRow(row)
{
    return !row.disabled;
}

function buildCommitButton(label)
{
    return button({
        label,
        weight: 'primary',
        disabled: true,
        attrs: FOCUSABLE_ATTRIBUTES,
    });
}

function buildCancelButton(label)
{
    return button({
        label,
        role: 'exit',
        attrs: FOCUSABLE_ATTRIBUTES,
    });
}

function buildOrderMark(position)
{
    return buildElement('span', {
        class: ORDER_MARK_CLASS,
        text: String(position + 1),
    });
}

class ChoiceModal
{
    constructor(options)
    {
        this.model = ModalModelFor(options.kind);
        this.options = options;
        this.selectedIds = [...(options.initialSelection || [])];
        this.hasPicked = this.selectedIds.length > 0;
        this.committedIds = null;
        this.list = null;
        this.shell = null;
        this.cancelLabel = this.readCancelLabel();
        this.commitButton = buildCommitButton(this.readCommitLabel());
        this.cancelButton = this.model.hasCancelButton
            ? buildCancelButton(this.cancelLabel)
            : null;
    }

    readCommitLabel()
    {
        return this.options.commitLabel ?? translate(this.model.commitLabelKey);
    }

    readCancelLabel()
    {
        return this.options.cancelLabel ?? translate(this.model.cancelLabelKey);
    }

    readCloseLabel()
    {
        if (this.options.closeLabel != null)
        {
            return this.options.closeLabel;
        }

        return this.model.closeLabelKey === this.model.cancelLabelKey
            ? this.cancelLabel
            : translate(this.model.closeLabelKey);
    }

    get selectionLimit()
    {
        return this.model.isMultiSelect
            ? this.options.selectionLimit
            : 1;
    }

    canCommit()
    {
        if (this.options.canCommit)
        {
            return this.options.canCommit(this.selectedIds);
        }

        return this.model.isMultiSelect
            ? this.hasPicked && this.selectedIds.length === this.selectionLimit
            : this.selectedIds.length > 0;
    }

    open()
    {
        this.shell = openModal({
            kind: this.options.kind,
            size: this.model.size,
            className: this.model.className,
            opener: this.options.opener,
            eyebrow: this.options.eyebrow,
            title: this.options.title,
            closeLabel: this.readCloseLabel(),
            bodyClassName: this.model.bodyClassName,
            deferFocus: true,
            initialFocus: () => this.findFirstEnabledRow(),
            body: (host) => this.renderBody(host),
            primary: this.commitButton,
            secondary: this.cancelButton
                ? [this.cancelButton]
                : [],
            footSize: this.model.footSize,
            onClose: () => this.settle(),
        });
        this.commitButton.addEventListener(CLICK_EVENT, () => this.commit());
        this.cancelButton?.addEventListener(CLICK_EVENT, () => this.shell.close());
        return this.shell;
    }

    findFirstEnabledRow()
    {
        const rows = this.list?.querySelectorAll(`[${this.model.idAttribute}]`) || [];
        return [...rows].find(isEnabledRow) || null;
    }

    withRowClassName(row)
    {
        if (
            row.className
            || !this.model.rowClassName
        )
        {
            return row;
        }

        return {
            ...row,
            className: this.model.rowClassName,
        };
    }

    renderEmptyText(host)
    {
        const emptyText = translate(this.model.emptyTextKey);
        host.append(buildElement('p', { text: emptyText }));
    }

    renderBody(host)
    {
        this.options.renderBeforeList?.(host);

        if (
            !this.options.rows.length
            && this.model.emptyTextKey
        )
        {
            this.renderEmptyText(host);
            return;
        }

        this.list = optionRowList(
            this.options.rows.map((row) => this.withRowClassName(row)),
            {
                idAttr: this.model.idAttribute,
                columns: this.model.columns,
                onSelect: (rowId, rowElement) => this.select(rowId, rowElement),
            },
        );
        host.append(this.list);
        this.options.renderAfterList?.(host);
        this.refreshSelection();
    }

    toggleSelection(rowId)
    {
        const selectedIndex = this.selectedIds.indexOf(rowId);

        if (selectedIndex >= 0)
        {
            this.selectedIds.splice(selectedIndex, 1);
            return;
        }

        if (this.selectionLimit <= 0)
        {
            return;
        }

        if (this.selectedIds.length >= this.selectionLimit)
        {
            if (!this.model.swapsAtLimit)
            {
                return;
            }
            this.selectedIds.shift();
        }

        this.selectedIds.push(rowId);
    }

    select(rowId, rowElement)
    {
        this.hasPicked = true;

        if (this.model.isMultiSelect)
        {
            this.toggleSelection(rowId);
        }
        else
        {
            this.selectedIds = [rowId];
        }

        rowElement?.focus?.(NO_SCROLL);
        this.refreshSelection();
    }

    markPickOrder()
    {
        const idAttribute = this.model.idAttribute;

        for (const rowElement of this.list.querySelectorAll(`[${idAttribute}]`))
        {
            rowElement.querySelector?.(ORDER_MARK_SELECTOR)?.remove?.();
            const position = this.selectedIds.indexOf(rowElement.getAttribute(idAttribute));

            if (position >= 0)
            {
                rowElement.insertBefore?.(
                    buildOrderMark(position),
                    rowElement.firstChild,
                );
            }
        }
    }

    refreshSelection()
    {
        markOptionRows(
            this.list,
            this.model.idAttribute,
            this.selectedIds,
        );

        if (this.options.isOrdered)
        {
            this.markPickOrder();
        }

        this.options.onSelectionChange?.(this.selectedIds);
        this.commitButton.disabled = !this.canCommit();
    }

    commit()
    {
        if (!this.canCommit())
        {
            return;
        }

        this.committedIds = [...this.selectedIds];
        this.shell.close();
    }

    readCommittedAnswer()
    {
        return this.model.isMultiSelect
            ? this.committedIds
            : this.committedIds[0];
    }

    settle()
    {
        this.options.onClosed?.();

        if (this.committedIds)
        {
            this.options.onCommit?.(this.readCommittedAnswer());
            return;
        }

        this.options.onCancelled?.();
    }
}

export function OpenChoiceModal(options)
{
    return new ChoiceModal(options).open();
}
