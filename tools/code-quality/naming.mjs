import ts from 'typescript';

const pascal = /^[A-Z][A-Za-z0-9]*$/;
const camel = /^[a-z][A-Za-z0-9]*$/;
const sourceFileExtension = /\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/;
const generatedFolders = ['src/config/generated/', 'src/content/generated/', 'src/framework/data/'];

export function IsAuthoredSource(path)
{
    return path.startsWith('src/') && sourceFileExtension.test(path)
        && !/\.d\.[cm]?ts$|\.generated\./.test(path)
        && !generatedFolders.some(folder => path.startsWith(folder));
}

export function CreateProgram(files)
{
    return ts.createProgram(files, {
        allowJs: true,
        checkJs: false,
        noEmit: true,
        types: [],
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
    });
}

function resolveSymbol(checker, symbol)
{
    return symbol && (symbol.flags & ts.SymbolFlags.Alias)
        ? checker.getAliasedSymbol(symbol)
        : symbol;
}

function callable(type)
{
    return type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0;
}

function constBinding(node)
{
    return ts.isVariableDeclaration(node) && (node.parent.flags & ts.NodeFlags.Const);
}

function functionBody(declaration)
{
    let node = ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
    while (node && ts.isParenthesizedExpression(node))
    {
        node = node.expression;
    }
    return node && ts.isFunctionLike(node) ? node.body : undefined;
}

function visitBody(body, callback)
{
    callback(body);
    ts.forEachChild(body, child =>
    {
        if (!ts.isFunctionLike(child))
        {
            visitBody(child, callback);
        }
    });
}

function validAlias(checker, declaration, target, kind)
{
    if (kind === 'binding')
    {
        const initializer = constBinding(declaration) && declaration.initializer;
        return initializer && ts.isIdentifier(initializer)
            && resolveSymbol(checker, checker.getSymbolAtLocation(initializer)) === target;
    }
    const body = functionBody(declaration);
    if (
        !body || !ts.isBlock(body) || body.statements.length !== 2
        || !ts.getJSDocTags(declaration).some(tag => tag.tagName.text === 'deprecated')
    )
    {
        return false;
    }
    const [bind, result] = body.statements;
    if (
        !ts.isVariableStatement(bind) || bind.declarationList.declarations.length !== 1
        || !ts.isReturnStatement(result) || !result.expression
        || !ts.isObjectLiteralExpression(result.expression)
    )
    {
        return false;
    }
    const [local] = bind.declarationList.declarations;
    const call = local.initializer;
    if (
        !constBinding(local) || !ts.isIdentifier(local.name) || !call || !ts.isCallExpression(call)
        || resolveSymbol(checker, checker.getSymbolAtLocation(call.expression)) !== target
    )
    {
        return false;
    }
    const binding = checker.getSymbolAtLocation(local.name);
    const members = result.expression.properties;
    return members.length > 0 && members.every(member =>
        ts.isPropertyAssignment(member)
        && ts.isIdentifier(member.name) && camel.test(member.name.text)
        && ts.isPropertyAccessExpression(member.initializer)
        && checker.getSymbolAtLocation(member.initializer.expression) === binding
        && member.initializer.name.text
            === member.name.text[0].toUpperCase() + member.name.text.slice(1)
    );
}

function privateMember(member)
{
    return ts.isPrivateIdentifier(member.name)
        || member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword);
}

function methodName(name)
{
    if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name))
    {
        return name.text.replace(/^#/, '');
    }
    if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression))
    {
        return name.expression.text;
    }
    return null;
}

function checkFactoryMethods(declaration, source, checker, issue)
{
    const body = functionBody(declaration);
    if (!body)
    {
        return;
    }
    const checkReturn = expression =>
    {
        const type = checker.getTypeAtLocation(expression);
        for (const member of checker.getPropertiesOfType(type))
        {
            const property = member.valueDeclaration;
            const returnedMethod = property && (ts.isObjectLiteralExpression(property.parent)
                || (ts.isClassLike(property.parent) && !privateMember(property))
                || (ts.isPropertyAccessExpression(property)
                    && ts.isBinaryExpression(property.parent)));
            if (
                returnedMethod && property.getSourceFile() === source
                && callable(checker.getTypeOfSymbolAtLocation(member, property))
                && !pascal.test(member.name)
            )
            {
                issue(property, `public method '${member.name}' must be PascalCase`);
            }
        }
    };
    if (!ts.isBlock(body))
    {
        checkReturn(body);
    }
    else
    {
        visitBody(body, node =>
        {
            if (ts.isReturnStatement(node) && node.expression)
            {
                checkReturn(node.expression);
            }
        });
    }
}

function checkPrivateNames(source, checker, publicBindings, issue)
{
    const visit = node =>
    {
        if (
            ts.isFunctionDeclaration(node)
            || (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
                && callable(checker.getTypeAtLocation(node.name)))
        )
        {
            const name = node.name;
            if (
                name && ts.isIdentifier(name)
                && !publicBindings.has(checker.getSymbolAtLocation(name))
                && !camel.test(name.text)
            )
            {
                issue(name, `private helper '${name.text}' must be camelCase`);
            }
        }
        if (ts.isClassDeclaration(node) || ts.isClassExpression(node))
        {
            for (const member of node.members)
            {
                const method = ts.isMethodDeclaration(member)
                    || (ts.isPropertyDeclaration(member)
                        && callable(checker.getTypeAtLocation(member.name)));
                const name = method && methodName(member.name);
                if (!name)
                {
                    continue;
                }
                const privateMethod = privateMember(member);
                if (privateMethod && !camel.test(name))
                {
                    issue(member, `private method '${name}' must be camelCase`);
                }
                else if (!privateMethod && !pascal.test(name))
                {
                    issue(member, `public method '${name}' must be PascalCase`);
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
}

export function AuditNames(program, files, policy, legacy = {})
{
    const checker = program.getTypeChecker();
    const enrolled = new Set(policy.enrolled);
    const aliases = new Map(policy.aliases.map(alias => [alias.path + ':' + alias.name, alias]));
    const usedAliases = new Set();
    const diagnostics = [];
    const inventory = {};
    for (const [path, absolute] of files)
    {
        const source = program.getSourceFile(absolute);
        const moduleSymbol = checker.getSymbolAtLocation(source);
        const exports = moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : [];
        const exportBindings = new Map(
            exports.map(symbol => [symbol.name, resolveSymbol(checker, symbol)]),
        );
        const publicBindings = new Set();
        const checkedFactories = new Set();
        const issue = (node, message) =>
        {
            const line = node?.getSourceFile() === source
                ? source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
                : 1;
            diagnostics.push(`${path}:${line}: ${message}`);
        };
        for (const symbol of exports)
        {
            const binding = exportBindings.get(symbol.name);
            const declaration = binding?.valueDeclaration;
            if (!declaration || !callable(checker.getTypeOfSymbolAtLocation(binding, declaration)))
            {
                continue;
            }
            publicBindings.add(binding);
            const name = symbol.name === 'default' && declaration.name
                ? declaration.name.getText()
                : symbol.name;
            if (pascal.test(name))
            {
                if (
                    enrolled.has(path) && declaration.getSourceFile() === source
                    && !checkedFactories.has(declaration)
                )
                {
                    checkFactoryMethods(declaration, source, checker, issue);
                    checkedFactories.add(declaration);
                }
                continue;
            }
            if (enrolled.has(path))
            {
                const key = path + ':' + name;
                const alias = aliases.get(key);
                const target = alias && exportBindings.get(alias.target);
                if (
                    target && declaration.getSourceFile() === source
                    && validAlias(checker, declaration, target, alias.kind)
                )
                {
                    usedAliases.add(key);
                    continue;
                }
            }
            else
            {
                (inventory[path] ||= []).push(name);
                if (legacy[path]?.includes(name))
                {
                    continue;
                }
            }
            issue(
                symbol.declarations?.[0] || declaration,
                `public export '${name}' must be PascalCase`,
            );
        }
        if (enrolled.has(path))
        {
            checkPrivateNames(source, checker, publicBindings, issue);
        }
    }
    for (const names of Object.values(inventory))
    {
        names.sort();
    }
    for (const [path, names] of Object.entries(legacy))
    {
        for (const name of names)
        {
            if (!inventory[path]?.includes(name))
            {
                diagnostics.push(`${path}: stale legacy export '${name}'`);
            }
        }
    }
    for (const key of aliases.keys())
    {
        if (!usedAliases.has(key))
        {
            diagnostics.push(`${key}: unused or invalid compatibility alias`);
        }
    }
    return { diagnostics: [...new Set(diagnostics)], inventory };
}
