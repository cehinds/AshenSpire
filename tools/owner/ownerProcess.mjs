// Runs node scripts, git and gh, and the owner's build and check steps.
import { spawnSync } from 'node:child_process';
import {
    FormatText,
    OWNER_TEXT,
    OWNER_TOOLS,
    REPO_ROOT,
} from './ownerConfig.mjs';

const TEXT_ENCODING = 'utf8';
const GIT_PROGRAM = 'git';
const LIMITS = OWNER_TOOLS.limits;
const MARKS = OWNER_TEXT.marks;

function spawn(
    program,
    args,
    cwd,
)
{
    return spawnSync(program, args, {
        cwd,
        encoding: TEXT_ENCODING,
        maxBuffer: LIMITS.maxOutputBytes,
    });
}

function lastLines(text)
{
    return text
        .trim()
        .split('\n')
        .slice(-LIMITS.outputTailLines)
        .join('\n');
}

function failureText(
    program,
    args,
    result,
)
{
    const detail = (result.stderr || result.stdout || '').trim();
    return FormatText(OWNER_TEXT.process.failed, {
        command: `${program} ${args.join(' ')}`,
        detail,
    });
}

function failedStep(
    step,
    result,
    log,
)
{
    log(`${MARKS.fail} ${step.label}`);
    log(lastLines(result.output));
    return {
        ok: false,
        failedStep: step.label,
    };
}

/** Runs `node <args>` in `cwd`; returns { ok, output }. */
export function RunNode(args, cwd = REPO_ROOT)
{
    const result = spawn(
        process.execPath,
        args,
        cwd,
    );
    return {
        ok: result.status === 0,
        output: `${result.stdout || ''}${result.stderr || ''}`,
    };
}

/** Runs a program; returns stdout (trimmed unless `raw`) and throws when it fails. */
export function RunProgram(
    program,
    args,
    options = {},
)
{
    const {
        cwd = REPO_ROOT,
        allowFailure = false,
        raw = false,
    } = options;
    const result = spawn(
        program,
        args,
        cwd,
    );
    if (result.error)
    {
        const message = FormatText(OWNER_TEXT.process.couldNotRun, {
            program,
            error: result.error.message,
        });
        throw new Error(message);
    }
    if (result.status !== 0 && !allowFailure)
    {
        throw new Error(failureText(
            program,
            args,
            result,
        ));
    }
    const output = result.stdout || '';
    return raw
        ? output
        : output.trim();
}

/** RunProgram for git; options are { cwd, allowFailure, raw }. */
export function RunGit(args, options = {})
{
    return RunProgram(
        GIT_PROGRAM,
        args,
        options,
    );
}

/** RunProgram for the GitHub CLI named in ownerTools.json. */
export function RunGitHub(args, options = {})
{
    return RunProgram(
        OWNER_TOOLS.git.githubProgram,
        args,
        options,
    );
}

/** Runs each step in order with one line per step; stops at the first failure. */
export function RunSteps(
    steps,
    cwd = REPO_ROOT,
    log = console.log,
)
{
    for (const step of steps)
    {
        const result = RunNode(step.args, cwd);
        if (!result.ok)
        {
            return failedStep(
                step,
                result,
                log,
            );
        }
        log(`${MARKS.pass} ${step.label}`);
    }
    return {
        ok: true,
        failedStep: null,
    };
}
