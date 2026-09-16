import * as assert from 'assert';
import * as cp from 'child_process';
import * as fs from 'fs';
import moduleAlias from 'module-alias';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

// 扩展在 activate() 里注册的别名，测试进程里要自己补一次
moduleAlias.addAliases({ 'y3-helper': path.join(__dirname, '..', '..', 'y3-helper') });
// out/ 里有引用 webpack 注入变量的模块，脱离打包环境加载时需要补上
(global as unknown as { __non_webpack_require__: NodeRequire }).__non_webpack_require__ = require;
const { LaunchAgentManager } = require('../../launchAgent/manager') as typeof import('../../launchAgent/manager');

// Windows PowerShell 5.1 对没有 BOM 的 .ps1 按系统 ANSI 代码页解析，中文编辑器目录
// （如 `D:\Y3编辑器`）会被拆成乱码，代理收到的 --allow-dir 与实际目录不符，
// 启动请求会被白名单校验拒绝，表现为「启动游戏失败！」。
suite('Launch agent launcher script', function() {
    this.timeout(30000);

    /** 用 PowerShell 的语法树读出脚本里的字符串常量，不执行脚本（避免触发 UAC） */
    function readStringConstants(file: string): string[] {
        const escaped = file.replace(/'/g, "''");
        const script = [
            `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)`,
            `$tokens = $null; $errors = $null`,
            `$ast = [System.Management.Automation.Language.Parser]::ParseFile('${escaped}', [ref]$tokens, [ref]$errors)`,
            `$ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.StringConstantExpressionAst] }, $true) | ForEach-Object { $_.Value }`,
        ].join('; ');
        return cp.execFileSync('powershell.exe', [
            '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script,
        ], { encoding: 'utf8' }).split(/\r?\n/).filter((line) => line.length > 0);
    }

    test('launcher script is UTF-8 with BOM, so non-ASCII editor paths survive', async function() {
        if (process.platform !== 'win32') {
            this.skip();
        }
        const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'y3-launch-agent-'));
        const context = {
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
            },
            globalStorageUri: vscode.Uri.file(directory),
            asAbsolutePath: (relativePath: string) => path.join(__dirname, '..', '..', '..', relativePath),
        } as unknown as vscode.ExtensionContext;

        const manager = new LaunchAgentManager(context);
        const allowDir = ['d:', 'Y3编辑器', 'y3', 'games', '2.0', 'game', 'Engine', 'Binaries', 'Win64'].join(path.sep);
        const launcher = (manager as unknown as { prepareLauncher(allowDir: string): string }).prepareLauncher(allowDir);

        const raw = await fs.promises.readFile(launcher);
        assert.deepStrictEqual([...raw.subarray(0, 3)], [0xEF, 0xBB, 0xBF], 'launcher must start with a UTF-8 BOM');
        assert.ok(raw.toString('utf8').includes(allowDir), 'launcher content must contain the editor directory');
        assert.ok(readStringConstants(launcher).includes(allowDir), 'PowerShell must read back the editor directory unchanged');
    });
});
