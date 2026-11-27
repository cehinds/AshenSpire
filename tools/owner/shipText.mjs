// The words ship writes: branch names, commit messages, the pull request body and receipt.
// Templates live in ownerText.json; limits in ownerTools.json.
import { FormatText, OWNER_TEXT, OWNER_TOOLS } from './ownerConfig.mjs';

const TITLE_WORD_PATTERN = /[A-Za-z0-9]+/g;
const LINE_BREAK = '\n';
const PARAGRAPH_BREAK = '\n\n';
const RECEIPT = OWNER_TEXT.receipt;

function bulletList(lines)
{
    return lines
        .map((line) => `${OWNER_TEXT.marks.bullet}${line}`)
        .join(LINE_BREAK);
}

function capitalised(word)
{
    return `${word[0].toUpperCase()}${word.slice(1)}`;
}

function fileSection(item)
{
    const lines = item.lines.length
        ? item.lines
        : [item.subject];
    return FormatText(OWNER_TEXT.pullRequestSection, {
        path: item.path,
        lines: bulletList(lines),
    });
}

/** Turns a free-text title into a CamelCase branch name under the owner prefix. */
export function BranchNameFor(title, settings = OWNER_TOOLS)
{
    const words = title.match(TITLE_WORD_PATTERN) || [OWNER_TEXT.branch.defaultTitleWord];
    const camel = words
        .map(capitalised)
        .join('')
        .slice(0, settings.limits.branchTitleLimit);
    return `${settings.git.branchPrefix}${camel}`;
}

/** A commit message: the subject, then the change lines unless they only repeat it. */
export function CommitMessage(subject, bodyLines)
{
    const repeatsSubject = bodyLines.length === 1 && bodyLines[0] === subject;
    if (!bodyLines.length || repeatsSubject)
    {
        return subject;
    }
    return `${subject}${PARAGRAPH_BREAK}${bulletList(bodyLines)}`;
}

/** The pull request body from the ownerText.json template. */
export function PullRequestBody(described, checkLines)
{
    const values = {
        sections: described
            .map(fileSection)
            .join(PARAGRAPH_BREAK),
        checks: checkLines.join(LINE_BREAK),
    };
    return OWNER_TEXT.pullRequestBody
        .map((line) => FormatText(line, values))
        .join(LINE_BREAK);
}

/** The receipt's prose: the first change lines as sentences. */
export function ReceiptSummary(described)
{
    const shown = described
        .flatMap((item) => item.lines)
        .slice(0, OWNER_TOOLS.limits.receiptSummaryLines)
        .join(RECEIPT.sentenceJoiner);
    return shown.endsWith(RECEIPT.sentenceEnd)
        ? shown
        : `${shown}${RECEIPT.sentenceEnd}`;
}

/** One CHANGELOG bullet in the receipt shape the receipt checks read. */
export function ReceiptLine(receipt)
{
    const url = `${OWNER_TOOLS.git.repositoryUrl}/pull/${receipt.pullNumber}`;
    return FormatText(RECEIPT.line, {
        ...receipt,
        pull: receipt.pullNumber,
        url,
    });
}
