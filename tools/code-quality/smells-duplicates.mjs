// Finds statement runs whose normalized tokens repeat across the scanned files.
import ts from 'typescript';
import { LineOf, Visit } from './smells-ast.mjs';

const DUPLICATE = 'duplicate';
const IDENTIFIER_TOKEN = '$id';
const LITERAL_TOKEN = '$lit';
const TOKEN_SEPARATOR = ' ';
const LITERAL_KINDS = new Set([
    ts.SyntaxKind.NumericLiteral,
    ts.SyntaxKind.BigIntLiteral,
    ts.SyntaxKind.StringLiteral,
    ts.SyntaxKind.RegularExpressionLiteral,
    ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateHead,
    ts.SyntaxKind.TemplateMiddle,
    ts.SyntaxKind.TemplateTail,
]);

function normalizedToken(node)
{
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node))
    {
        return IDENTIFIER_TOKEN;
    }
    return LITERAL_KINDS.has(node.kind)
        ? LITERAL_TOKEN
        : String(node.kind);
}

function collectTokens(node, sourceFile, tokens)
{
    const children = node.getChildren(sourceFile);
    if (!children.length || LITERAL_KINDS.has(node.kind) || ts.isIdentifier(node))
    {
        if (node.kind !== ts.SyntaxKind.EndOfFileToken && node.getWidth(sourceFile) > 0)
        {
            tokens.push(normalizedToken(node));
        }
        return;
    }
    for (const child of children)
    {
        collectTokens(child, sourceFile, tokens);
    }
}

function statementRecord(statement, path, sourceFile)
{
    const tokens = [];
    collectTokens(statement, sourceFile, tokens);
    return {
        path,
        start: statement.getStart(sourceFile),
        end: statement.getEnd(),
        startLine: LineOf(sourceFile, statement.getStart(sourceFile)),
        endLine: LineOf(sourceFile, statement.getEnd()),
        tokens,
        key: tokens.join(TOKEN_SEPARATOR),
    };
}

function statementLists(sourceFile, path)
{
    const lists = [];
    Visit(sourceFile, node =>
    {
        if (node.statements && node.statements.length)
        {
            lists.push(
                node.statements.map(statement => statementRecord(statement, path, sourceFile)),
            );
        }
    });
    return lists;
}

function windowAt(list, startIndex, minTokens)
{
    let tokenCount = 0;
    for (let index = startIndex; index < list.length; index++)
    {
        tokenCount += list[index].tokens.length;
        if (tokenCount >= minTokens)
        {
            const statements = list.slice(startIndex, index + 1);
            return {
                list,
                startIndex,
                endIndex: index,
                key: statements.map(statement => statement.key).join('\n'),
            };
        }
    }
    return null;
}

function groupWindows(lists, minTokens)
{
    const groups = new Map();
    for (const list of lists)
    {
        for (let startIndex = 0; startIndex < list.length; startIndex++)
        {
            const window = windowAt(list, startIndex, minTokens);
            if (!window)
            {
                break;
            }
            const group = groups.get(window.key) ?? [];
            group.push(window);
            groups.set(window.key, group);
        }
    }
    return [...groups.values()].filter(group => group.length > 1);
}

function windowStart(window)
{
    return window.list[window.startIndex];
}

function compareWindows(left, right)
{
    const leftStart = windowStart(left);
    const rightStart = windowStart(right);
    if (leftStart.path !== rightStart.path)
    {
        return leftStart.path < rightStart.path
            ? -1
            : 1;
    }
    return leftStart.start - rightStart.start;
}

function isCovered(window, covered)
{
    const start = windowStart(window);
    const ranges = covered.get(start.path) ?? [];
    return ranges.some(range => start.start >= range.start && start.start < range.end);
}

function extendWindows(windows)
{
    for (;;)
    {
        const nextKeys = windows.map(window => window.list[window.endIndex + 1]?.key);
        const sameNext = nextKeys[0] !== undefined && nextKeys.every(key => key === nextKeys[0]);
        if (!sameNext)
        {
            return;
        }
        for (const window of windows)
        {
            window.endIndex += 1;
        }
    }
}

function disjointWindows(group, covered)
{
    const kept = [];
    for (const window of group)
    {
        const overlaps = kept.some(other =>
            other.list === window.list && window.startIndex <= other.endIndex
        );
        if (!overlaps && !isCovered(window, covered))
        {
            kept.push(window);
        }
    }
    return kept;
}

function markCovered(window, covered)
{
    const start = windowStart(window);
    const ranges = covered.get(start.path) ?? [];
    ranges.push({ start: start.start, end: window.list[window.endIndex].end });
    covered.set(start.path, ranges);
}

function windowTokens(window)
{
    const statements = window.list.slice(window.startIndex, window.endIndex + 1);
    return statements.reduce((total, statement) => total + statement.tokens.length, 0);
}

function location(window)
{
    const start = windowStart(window);
    return `${start.path}:${start.startLine}`;
}

function groupFindings(windows)
{
    const tokenCount = windowTokens(windows[0]);
    return windows.map(window =>
    {
        const others = windows.filter(other => other !== window).map(location);
        const start = windowStart(window);
        const endLine = window.list[window.endIndex].endLine;
        return {
            path: start.path,
            line: start.startLine,
            kind: DUPLICATE,
            detail: `${tokenCount} tokens to line ${endLine}, also at ${others.join(', ')}`,
        };
    });
}

export function FindDuplicateSmells(sourceFiles, config)
{
    const lists = sourceFiles.flatMap(({ path, sourceFile }) => statementLists(sourceFile, path));
    const groups = groupWindows(lists, config.minDuplicateTokens);
    groups.forEach(group => group.sort(compareWindows));
    groups.sort((left, right) => compareWindows(left[0], right[0]));
    const covered = new Map();
    const findings = [];
    for (const group of groups)
    {
        const windows = disjointWindows(group, covered);
        if (windows.length < 2)
        {
            continue;
        }
        extendWindows(windows);
        windows.forEach(window => markCovered(window, covered));
        findings.push(...groupFindings(windows));
    }
    return findings;
}
