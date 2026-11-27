// Planning-artifact verification only; does not run or alter the game.
import {
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
    existsSync
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const verificationConfig =
{
    baseline: '49eca254d795d06266aa23941cb2b31fe77b27bf',
    artTag: 'ashenspire-hd-assets-v30',
    encoding: 'utf8',
    hashAlgorithm: 'sha256',
    jsonIndent: 2,
    maxJsonBytes: 256 * 1024,
    failureExitCode: 1,
    resultKind: 'Planning evidence integrity, not implementation acceptance',
    directories:
    {
        visuals: 'visuals',
        verification: 'verification'
    },
    files:
    {
        visualManifest: 'visuals/image-manifest.json',
        runtimeCaptures: 'verification/runtime-capture-record.json',
        measurementSummary: 'measurements/summary.json',
        validationResult: 'VALIDATION.json'
    },
    extensions:
    {
        json: '.json',
        markdown: '.md'
    },
    patterns:
    {
        codeFence: /```[\s\S]*?```/g,
        markdownLink: /!?\[[^\]]*\]\(([^)]+)\)/g,
        angleBrackets: /^<|>$/g,
        externalLink: /^(https?:|mailto:|#)/i,
        sourceLine: /^L\d+/,
        sourceLineNumber: /^L(\d+)/
    }
};

const rootDirectory = dirname(fileURLToPath(import.meta.url));
const errors = [];
let localLinksChecked = 0;
let imageHashesChecked = 0;
let loadedImageReceiptsChecked = 0;
let compactJsonFilesChecked = 0;

function collectFiles(directory)
{
    const entries = readdirSync(directory,
    {
        withFileTypes: true
    });

    return entries.flatMap(entry =>
    {
        const entryPath = join(directory, entry.name);

        if (entry.isDirectory())
        {
            return collectFiles(entryPath);
        }

        return [entryPath];
    });
}

function readJson(relativePath)
{
    const filePath = join(rootDirectory, relativePath);
    return JSON.parse(readFileSync(filePath, verificationConfig.encoding));
}

function hashBytes(bytes)
{
    return createHash(verificationConfig.hashAlgorithm).update(bytes).digest('hex');
}

function checkImage(filePath, expectedHash, expectedBytes)
{
    if (!existsSync(filePath))
    {
        errors.push(`Missing image: ${filePath}`);
        return;
    }

    const imageBytes = readFileSync(filePath);

    if (!expectedHash || hashBytes(imageBytes) !== expectedHash)
    {
        errors.push(`Image hash mismatch: ${filePath}`);
    }

    if (expectedBytes !== undefined && imageBytes.length !== expectedBytes)
    {
        errors.push(`Image byte count mismatch: ${filePath}`);
    }

    imageHashesChecked++;
}

function checkJsonFile(filePath)
{
    compactJsonFilesChecked++;

    if (statSync(filePath).size > verificationConfig.maxJsonBytes)
    {
        errors.push(`JSON exceeds 256 KiB: ${filePath}`);
    }

    try
    {
        JSON.parse(readFileSync(filePath, verificationConfig.encoding));
    }
    catch
    {
        errors.push(`Invalid JSON: ${filePath}`);
    }
}

function checkSourceLine(destination, anchor, href)
{
    if (!verificationConfig.patterns.sourceLine.test(anchor || ''))
    {
        return;
    }

    const lineNumber = Number(anchor.match(verificationConfig.patterns.sourceLineNumber)[1]);
    const lineCount = readFileSync(destination, verificationConfig.encoding).split('\n').length;

    if (lineNumber > lineCount)
    {
        errors.push(`Invalid source line: ${href}`);
    }
}

function checkMarkdownLinks(filePath)
{
    const markdown = readFileSync(filePath, verificationConfig.encoding);
    const content = markdown.replace(verificationConfig.patterns.codeFence, '');

    for (const match of content.matchAll(verificationConfig.patterns.markdownLink))
    {
        const href = match[1].trim().replace(verificationConfig.patterns.angleBrackets, '');

        if (verificationConfig.patterns.externalLink.test(href))
        {
            continue;
        }

        const [target, anchor] = href.split('#');
        const destination = resolve(dirname(filePath), decodeURIComponent(target));

        if (!existsSync(destination))
        {
            errors.push(`Broken local link in ${filePath}: ${href}`);
            continue;
        }

        checkSourceLine(destination, anchor, href);
        localLinksChecked++;
    }
}

function checkOutputImages()
{
    const visualManifest = readJson(verificationConfig.files.visualManifest);

    if (visualManifest.sourceCommit !== verificationConfig.baseline || visualManifest.artTag !== verificationConfig.artTag)
    {
        errors.push('Visual identity mismatch');
    }

    for (const [fileName, imageRecord] of Object.entries(visualManifest.outputImages))
    {
        const imagePath = join(rootDirectory, verificationConfig.directories.visuals, fileName);
        checkImage(imagePath, imageRecord.sha256, imageRecord.bytes);
    }
}

function checkRuntimeCaptures()
{
    const runtimeCaptures = readJson(verificationConfig.files.runtimeCaptures);

    if (runtimeCaptures.sourceBaseline !== verificationConfig.baseline || runtimeCaptures.artTag !== verificationConfig.artTag)
    {
        errors.push('Runtime capture identity mismatch');
    }

    for (const capture of runtimeCaptures.captures)
    {
        const imagePath = join(rootDirectory, verificationConfig.directories.verification, capture.file);
        checkImage(imagePath, capture.sha256, capture.bytes);

        for (const receipt of capture.receipts || [])
        {
            if (!receipt.loadedBytesMatchCache || receipt.loadedByteSha256 !== receipt.cacheByteSha256)
            {
                errors.push(`Loaded image mismatch: ${receipt.assetId}`);
            }

            loadedImageReceiptsChecked++;
        }
    }
}

for (const filePath of collectFiles(rootDirectory))
{
    if (filePath.endsWith(verificationConfig.extensions.json))
    {
        checkJsonFile(filePath);
    }

    if (filePath.endsWith(verificationConfig.extensions.markdown))
    {
        checkMarkdownLinks(filePath);
    }
}

checkOutputImages();
checkRuntimeCaptures();

const measurements = readJson(verificationConfig.files.measurementSummary);

if (measurements.baseline !== verificationConfig.baseline || measurements.counts.missingRasterFiles || measurements.counts.catalogHashMismatches)
{
    errors.push('Measured baseline checks failed');
}

const result =
{
    baseline: verificationConfig.baseline,
    kind: verificationConfig.resultKind,
    checkedAt: new Date().toISOString(),
    localLinksChecked,
    imageHashesChecked,
    loadedImageReceiptsChecked,
    compactJsonFilesChecked,
    measuredCounts: measurements.counts,
    errors,
    pass: errors.length === 0
};

const resultJson = JSON.stringify(result, null, verificationConfig.jsonIndent);
writeFileSync(join(rootDirectory, verificationConfig.files.validationResult), resultJson + '\n');
console.log(resultJson);

if (errors.length)
{
    process.exitCode = verificationConfig.failureExitCode;
}
