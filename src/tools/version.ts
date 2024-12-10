import * as y3 from 'y3-helper';
import * as vscode from 'vscode';
import { runShell } from '../runShell';

interface Version {
    version: number;
    display: string;
}

const filePaths = [
    "LocalData/Patch/editor_patchmd5_windows64_normal.txt",
    "Package/editor_patchmd5_windows64_normal.txt"
];

let lastClient: Version | undefined;

async function _getClient(): Promise<Version | undefined> {
    await y3.env.editorReady();
    if (!y3.env.editorUri) {
        return undefined;
    }
    for (const filePath of filePaths) {
        const fullUri = y3.uri(y3.env.editorUri, '..', filePath);
        if (!await y3.fs.isExists(fullUri)) {
            continue;
        }
        try {
            let file = await y3.fs.readFile(fullUri);
            let json = y3.json.parse(file!.string);
            let version = Number(json[y3.env.editorVersion]['@version@']);
            let display = json[y3.env.editorVersion]['@displayversion@'];
            y3.assert(Number.isInteger(version));
            return {version, display};
        } catch (error) {
            y3.log.error(String(error));
            return undefined;
        }
    }
    return undefined;
}

export async function getClient(): Promise<Version | undefined> {
    return lastClient ??= await _getClient();
}

let lastServer: Version | undefined;
async function _getServer(): Promise<Version | undefined> {
    await y3.env.editorReady();
    if (!y3.env.editorUri) {
        return undefined;
    }
    // 从指定网址上下载json并解析出版本号
    const url = 'https://up5.update.netease.com/pl/patchmd5_windows64_produp5_release.txt';
    try {
        let response = await fetch(url);
        if (!response.ok) {
            return undefined;
        }
        let json = await response.json() as any;
        let version = Number(json[y3.env.editorVersion]['@version@']);
        let display = json[y3.env.editorVersion]['@metadata@']['@displayversion@'];
        y3.assert(Number.isInteger(version));
        return {version, display};
    } catch (error) {
        y3.log.error(String(error));
        return undefined;
    }
}

let _lastServerTest: Version | undefined;
async function _getServerTest(): Promise<Version | undefined> {
    if (!_lastServerTest) {
        _lastServerTest = await _getServer();
    } else {
        _lastServerTest = {
            version: _lastServerTest.version + 1,
            display: _lastServerTest.display,
        };
    }
    return _lastServerTest;
}

export async function getServer(): Promise<Version | undefined> {
    return lastServer ??= await _getServer();
}

export async function needUpdate(): Promise<boolean> {
    let [client, server] = await Promise.all([getClient(), getServer()]);
    if (!client || !server) {
        return false;
    }
    return client.version !== server.version;
}

interface UpdateResult {
    client?: Version,
    server?: Version,
}

const _onDidChange = new vscode.EventEmitter<UpdateResult>();
export function onDidChange(callback: (result: UpdateResult) => void) {
    _onDidChange.event(callback);
}

async function tryUpdateClient() {
    let client = await _getClient();
    if (client && client.version !== lastClient?.version) {
        lastClient = client;
        _onDidChange.fire({client, server: await getServer()});
    }
}

async function tryUpdateServer() {
    let server = await _getServer();
    if (server && server.version !== lastServer?.version) {
        lastServer = server;
        _onDidChange.fire({client: await getClient(), server});
    }
}

let dontAskUpdate = false;
export async function askUpdate(): Promise<boolean> {
    if (dontAskUpdate) {
        return false;
    }
    if (!await needUpdate()) {
        return false;
    }
    const ok = '更新';
    const no = '仍要运行';
    let res = await vscode.window.showInformationMessage('编辑器有新版本', {
        modal: true,
        detail: '如果选择“仍要运行”，那么在VSCode重启前都不会再提醒。',
    }, ok, no);
    if (res === ok) {
        await runShell('更新编辑器', 'start', [y3.env.editorUri!.fsPath]);
        return true;
    } else if (res === no) {
        dontAskUpdate = true;
        return false;
    } else {
        return true;
    }
}

export function init() {
    setInterval(tryUpdateServer, 1000 * 60 * 5); // 5分钟检查一次
    tryUpdateServer();

    let lastWatchers: vscode.Disposable[] = [];
    y3.env.onDidChange(async () => {
        for (const watcher of lastWatchers) {
            watcher.dispose();
        }
        lastWatchers = [];
        if (!y3.env.editorUri) {
            return;
        }
        for (const filePath of filePaths) {
            const fullUri = y3.uri(y3.env.editorUri, '..', filePath);
            const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(fullUri, '*'));
            watcher.onDidChange(tryUpdateClient);
            watcher.onDidCreate(tryUpdateClient);
            watcher.onDidDelete(tryUpdateClient);

            lastWatchers.push(watcher);
        }
    });
}
