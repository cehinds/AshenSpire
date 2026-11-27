// Runs node scripts, git and gh, and the owner's build and check steps.
import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from './ownerConfig.mjs';

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
const OUTPUT_TAIL_LINES = 25;
const PASS_MARK = 'ok  ';
const FAIL_MARK = 'FAIL';
const TEXT_ENCODING = 'utf8';
const GIT_PROGRAM = 'git';

function spawn(
    program,
    args,
    cwd,
)
{
    return spawnSync(program, args, {
        cwd,
        encoding: TEXT_ENCODING,
        maxBuffer: MAX_OUTPUT_BYTES,
    });
}

function lastLines(text)
{
    return text
        .trim()
        .split('\n')
        .slice(-OUTPUT_TAIL_LINES)
        .join('\n');
}

function failureText(
    program,
    args,
    result,
)
{
    const detail = (result.stderr || result.stdout || '').trim();
    return `${program} ${args.join(' ')} failed:\n${detail}`;
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
        throw new Error(`Could not run ${program}: ${result.error.message}`);
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
            log(`${FAIL_MARK} ${step.label}`);
            log(lastLines(result.output));
            return {
                ok: false,
                failedStep: step.label,
            };
        }
        log(`${PASS_MARK} ${step.label}`);
    }
    return {
        ok: true,
        failedStep: null,
    };
}
