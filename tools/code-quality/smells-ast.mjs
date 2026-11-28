// Shared TypeScript AST helpers for the smell scanners.
import ts from 'typescript';

const ANONYMOUS_NAME = '<anonymous>';
const CONSTRUCTOR_NAME = 'constructor';
const FUNCTION_KINDS = new Set([
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.FunctionExpression,
    ts.SyntaxKind.ArrowFunction,
    ts.SyntaxKind.MethodDeclaration,
    ts.SyntaxKind.Constructor,
    ts.SyntaxKind.GetAccessor,
    ts.SyntaxKind.SetAccessor,
]);

export function ParseSource(path, text)
{
    return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

export function IsFunctionLike(node)
{
    return FUNCTION_KINDS.has(node.kind);
}

export function IsInsideFunction(node)
{
    for (let current = node.parent; current; current = current.parent)
    {
        if (IsFunctionLike(current))
        {
            return true;
        }
    }
    return false;
}

export function LineOf(sourceFile, position)
{
    return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

export function NodeLine(node)
{
    const sourceFile = node.getSourceFile();
    return LineOf(sourceFile, node.getStart(sourceFile));
}

export function Visit(node, visitor)
{
    visitor(node);
    ts.forEachChild(node, child => Visit(child, visitor));
}

export function FunctionName(node)
{
    if (node.name)
    {
        return node.name.getText();
    }
    if (node.kind === ts.SyntaxKind.Constructor)
    {
        return CONSTRUCTOR_NAME;
    }
    const parent = node.parent;
    const namedParent = ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)
        || ts.isPropertyDeclaration(parent);
    return namedParent
        ? parent.name.getText()
        : ANONYMOUS_NAME;
}

export function CalleeName(callExpression)
{
    const callee = callExpression.expression;
    if (ts.isIdentifier(callee))
    {
        return callee.text;
    }
    if (ts.isPropertyAccessExpression(callee))
    {
        return callee.name.text;
    }
    return null;
}

export function CalleeObjectName(callExpression)
{
    const callee = callExpression.expression;
    if (!ts.isPropertyAccessExpression(callee))
    {
        return null;
    }
    const target = callee.expression;
    return ts.isIdentifier(target)
        ? target.text
        : null;
}
