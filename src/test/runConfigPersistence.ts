import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

const repoRoot = path.resolve(__dirname, '../..');
const acceptanceRoot = path.join(repoRoot, 'tmp', 'config-acceptance');
const worktree = path.join(acceptanceRoot, 'project');
const userData = path.join(acceptanceRoot, 'user-data');
const stateFile = path.join(acceptanceRoot, 'phase1.json');
const projectSource = process.env.Y3_CONFIG_TEST_PROJECT
    ?? 'C:\\Users\\wb.lixinyan03\\Desktop\\agentmap';
const vscodeVersion = process.env.Y3_CONFIG_TEST_VSCODE ?? '1.143.1';

function resolveExtensionsDir() {
    if (process.env.Y3_TEST_EXTENSIONS_DIR) {
        return process.env.Y3_TEST_EXTENSIONS_DIR;
    }
    const portable = path.join(repoRoot, '.vscode-test', 'extensions');
    const local = 'C:\\Users\\wb.lixinyan03\\Desktop\\y3-helper-test-ext';
    return fs.existsSync(local) ? local : portable;
}

function git(args: string[]) {
    execFileSync('git', args, { cwd: projectSource, stdio: 'inherit' });
}

function prepareWorktree() {
    if (!fs.existsSync(path.join(projectSource, 'header.project'))) {
        throw new Error(`Y3 project not found: ${projectSource}`);
    }
    fs.mkdirSync(acceptanceRoot, { recursive: true });
    try {
        git(['worktree', 'remove', '--force', worktree]);
    } catch {
        // The worktree may only exist on disk from an interrupted run.
    }
    fs.rmSync(worktree, { recursive: true, force: true });
    try {
        git(['worktree', 'prune']);
    } catch {
        // Ignore stale metadata cleanup failures.
    }
    git(['worktree', 'add', '--detach', '--force', worktree, 'HEAD']);

    const settingsDir = path.join(worktree, '.vscode');
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify({
        'Y3-Helper.Language': 'zh-cn',
        'Y3-Helper.CloneY3MakerConfig': 'never',
        'Y3-Helper.ShowStatusBarItem': false,
    }, null, 2));
}

async function runPhase(phase: '1' | '2') {
    return runTests({
        version: vscodeVersion,
        extensionDevelopmentPath: repoRoot,
        extensionTestsPath: path.join(__dirname, 'configAcceptance'),
        launchArgs: [
            worktree,
            `--extensions-dir=${resolveExtensionsDir()}`,
            `--user-data-dir=${userData}`,
            '--disable-telemetry',
        ],
        extensionTestsEnv: {
            Y3_CONFIG_TEST_PHASE: phase,
            Y3_CONFIG_TEST_STATE: stateFile,
        },
    });
}

async function main() {
    prepareWorktree();
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(stateFile, { force: true });

    await runPhase('1');
    if (!fs.existsSync(stateFile)) {
        throw new Error('Phase 1 did not write its expected state.');
    }
    await runPhase('2');

    console.log(`Config persistence acceptance passed. Worktree: ${worktree}`);
    if (process.env.Y3_CONFIG_TEST_CLEANUP === '1') {
        try {
            git(['worktree', 'remove', '--force', worktree]);
        } catch {
            fs.rmSync(worktree, { recursive: true, force: true });
        }
        fs.rmSync(userData, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
