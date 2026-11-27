// The words ship writes: branch names, commit messages, the pull request body and receipt.
import { OWNER_TOOLS } from './ownerConfig.mjs';

const TITLE_WORD_PATTERN = /[A-Za-z0-9]+/g;
const BRANCH_TITLE_LIMIT = 40;
const DEFAULT_TITLE_WORD = 'Content';
const BULLET = '- ';
const SUMMARY_LINES = 2;
const SENTENCE_END = '.';
const SENTENCE_JOINER = '. ';

function bulletList(lines)
{
    return lines
        .map((line) => `${BULLET}${line}`)
        .join('\n');
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
    return `**${item.path}**\n${bulletList(lines)}`;
}

/** Turns a free-text title into a CamelCase branch name under the owner prefix. */
export function BranchNameFor(title, settings = OWNER_TOOLS)
{
    const words = title.match(TITLE_WORD_PATTERN) || [DEFAULT_TITLE_WORD];
    const camel = words
        .map(capitalised)
        .join('')
        .slice(0, BRANCH_TITLE_LIMIT);
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
    return `${subject}\n\n${bulletList(bodyLines)}`;
}

/** The pull request body: what changed per file and the checks that ran. */
export function PullRequestBody(described, checkLines)
{
    return [
        '## What changed',
        '',
        described.map(fileSection).join('\n\n'),
        '',
        '## Checks run before pushing',
        '',
        checkLines.join('\n'),
        '',
        '## Try it',
        '',
        'Check out this branch, then run `npm run play`.',
        '',
        'Opened by `npm run ship` (docs/OWNER-EDITING.md).',
    ].join('\n');
}

/** The receipt's prose: the first two change lines as sentences. */
export function ReceiptSummary(described)
{
    const shown = described
        .flatMap((item) => item.lines)
        .slice(0, SUMMARY_LINES)
        .join(SENTENCE_JOINER);
    return shown.endsWith(SENTENCE_END)
        ? shown
        : `${shown}${SENTENCE_END}`;
}

/** One CHANGELOG bullet in the receipt shape the receipt checks read. */
export function ReceiptLine(receipt)
{
    const url = `${OWNER_TOOLS.git.repositoryUrl}/pull/${receipt.pullNumber}`;
    const link = `[#${receipt.pullNumber}](${url})`;
    return `- **${receipt.title}** (${link}, \`${receipt.stamp}\`). ${receipt.summary}`;
}
