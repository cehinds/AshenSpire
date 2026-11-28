// Finds magic numbers and magic strings inside function bodies.
import ts from 'typescript';
import { CalleeName, CalleeObjectName, IsInsideFunction, NodeLine, Visit } from './smells-ast.mjs';

const MAGIC_NUMBER = 'magic-number';
const MAGIC_STRING = 'magic-string';
const ASSERT_OBJECT = 'assert';
const SLICE_METHODS = new Set([
    'slice',
    'substring',
    'substr',
]);
const LOOKUP_METHODS = new Set([
    'includes',
    'has',
]);
const EQUALITY_OPERATORS = new Set([
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
]);

function isSliceArgument(node)
{
    const parent = node.parent;
    return ts.isCallExpression(parent) && parent.arguments.includes(node)
        && SLICE_METHODS.has(CalleeName(parent));
}

function isIndexArgument(node)
{
    const parent = node.parent;
    return ts.isElementAccessExpression(parent) && parent.argumentExpression === node;
}

function numberTarget(node)
{
    const parent = node.parent;
    const negated = ts.isPrefixUnaryExpression(parent)
        && parent.operator === ts.SyntaxKind.MinusToken;
    return negated
        ? parent
        : node;
}

function magicNumberFinding(node, config)
{
    const target = numberTarget(node);
    const magnitude = Number(node.text);
    const value = target === node
        ? magnitude
        : -magnitude;
    if (config.allowedNumbers.includes(value) || isIndexArgument(target) || isSliceArgument(target))
    {
        return null;
    }
    return { line: NodeLine(target), kind: MAGIC_NUMBER, detail: String(value) };
}

function isTypeofOperand(binary)
{
    return ts.isTypeOfExpression(binary.left) || ts.isTypeOfExpression(binary.right);
}

function stringUse(node)
{
    const parent = node.parent;
    if (ts.isBinaryExpression(parent) && EQUALITY_OPERATORS.has(parent.operatorToken.kind))
    {
        return isTypeofOperand(parent)
            ? null
            : 'comparison';
    }
    if (ts.isCaseClause(parent))
    {
        return 'switch case';
    }
    if (ts.isCallExpression(parent) && LOOKUP_METHODS.has(CalleeName(parent)))
    {
        return `${CalleeName(parent)}() argument`;
    }
    if (ts.isComputedPropertyName(parent) || isIndexArgument(node))
    {
        return 'object key';
    }
    return null;
}

function isAssertionCall(callExpression, config)
{
    const calleeName = CalleeName(callExpression);
    return CalleeObjectName(callExpression) === ASSERT_OBJECT
        || config.assertionCallees.includes(calleeName);
}

function isAssertionMessage(node, isTestFile, config)
{
    const parent = node.parent;
    if (!isTestFile || !ts.isCallExpression(parent) || parent.arguments.length < 2)
    {
        return false;
    }
    const lastArgument = parent.arguments[parent.arguments.length - 1];
    return lastArgument === node && isAssertionCall(parent, config);
}

function isImportSpecifier(node)
{
    const parent = node.parent;
    return ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword;
}

function isCandidateString(node, isTestFile, config)
{
    return ts.isStringLiteral(node) && node.text !== '' && IsInsideFunction(node)
        && !isImportSpecifier(node) && !isAssertionMessage(node, isTestFile, config);
}

function collectStrings(sourceFile, isTestFile, config)
{
    const strings = [];
    Visit(sourceFile, node =>
    {
        if (isCandidateString(node, isTestFile, config))
        {
            strings.push(node);
        }
    });
    return strings;
}

function countByText(nodes)
{
    const counts = new Map();
    for (const node of nodes)
    {
        counts.set(node.text, (counts.get(node.text) ?? 0) + 1);
    }
    return counts;
}

function stringFindings(sourceFile, isTestFile, config)
{
    const strings = collectStrings(sourceFile, isTestFile, config);
    const counts = countByText(strings);
    const reportedRepeats = new Set();
    const findings = [];
    for (const node of strings)
    {
        const label = JSON.stringify(node.text);
        const use = stringUse(node);
        if (use)
        {
            findings.push({ line: NodeLine(node), kind: MAGIC_STRING, detail: `${label} ${use}` });
            continue;
        }
        const count = counts.get(node.text);
        if (count >= config.minRepeatedStrings && !reportedRepeats.has(node.text))
        {
            reportedRepeats.add(node.text);
            const detail = `${label} repeated ${count} times`;
            findings.push({ line: NodeLine(node), kind: MAGIC_STRING, detail });
        }
    }
    return findings;
}

function numberFindings(sourceFile, config)
{
    const findings = [];
    Visit(sourceFile, node =>
    {
        if (!ts.isNumericLiteral(node) || !IsInsideFunction(node))
        {
            return;
        }
        const finding = magicNumberFinding(node, config);
        if (finding)
        {
            findings.push(finding);
        }
    });
    return findings;
}

export function FindLiteralSmells(sourceFile, isTestFile, config)
{
    return [
        ...numberFindings(sourceFile, config),
        ...stringFindings(sourceFile, isTestFile, config),
    ];
}
