// Finds functions that run too long or nest blocks too deeply.
import ts from 'typescript';
import { FunctionName, IsFunctionLike, LineOf, NodeLine, Visit } from './smells-ast.mjs';

const LONG_FUNCTION = 'long-function';
const DEEP_NESTING = 'deep-nesting';
const NESTING_KINDS = new Set([
    ts.SyntaxKind.IfStatement,
    ts.SyntaxKind.ForStatement,
    ts.SyntaxKind.ForInStatement,
    ts.SyntaxKind.ForOfStatement,
    ts.SyntaxKind.WhileStatement,
    ts.SyntaxKind.DoStatement,
    ts.SyntaxKind.SwitchStatement,
    ts.SyntaxKind.TryStatement,
]);

function isElseIf(node)
{
    const parent = node.parent;
    return ts.isIfStatement(node) && ts.isIfStatement(parent) && parent.elseStatement === node;
}

function addsNesting(node)
{
    return NESTING_KINDS.has(node.kind) && !isElseIf(node);
}

function deepestNesting(node, depth)
{
    let deepest = depth;
    ts.forEachChild(node, child =>
    {
        if (IsFunctionLike(child))
        {
            return;
        }
        const childDepth = addsNesting(child)
            ? depth + 1
            : depth;
        deepest = Math.max(deepest, deepestNesting(child, childDepth));
    });
    return deepest;
}

function functionLines(node)
{
    const sourceFile = node.getSourceFile();
    const firstLine = LineOf(sourceFile, node.getStart(sourceFile));
    return LineOf(sourceFile, node.getEnd()) - firstLine + 1;
}

function functionFindings(node, config)
{
    const findings = [];
    const name = FunctionName(node);
    const line = NodeLine(node);
    const lines = functionLines(node);
    if (lines > config.maxFunctionLines)
    {
        const detail = `${name} ${lines} lines (max ${config.maxFunctionLines})`;
        findings.push({ line, kind: LONG_FUNCTION, detail });
    }
    const depth = node.body
        ? deepestNesting(node.body, 0)
        : 0;
    if (depth > config.maxNesting)
    {
        const detail = `${name} depth ${depth} (max ${config.maxNesting})`;
        findings.push({ line, kind: DEEP_NESTING, detail });
    }
    return findings;
}

export function FindStructureSmells(sourceFile, config)
{
    const findings = [];
    Visit(sourceFile, node =>
    {
        if (IsFunctionLike(node))
        {
            findings.push(...functionFindings(node, config));
        }
    });
    return findings;
}
