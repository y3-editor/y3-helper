import * as y3 from 'y3-helper';
import * as vscode from 'vscode';

interface Version {
    version: number;
    display: string;
}

export async function getClient(): Promise<Version | undefined> {
    await y3.env.editorReady();
    if (!y3.env.editorUri) {
        return undefined;
    }
    for (const filePath of [
        "LocalData/Patch/editor_patchmd5_windows64_normal.txt",
        "Package/editor_patchmd5_windows64_normal.txt"
    ]) {
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

let _lastServer: Version | undefined;
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
    return _lastServer ??= await _getServer();
}

export async function needUpdate(): Promise<boolean> {
    let [client, server] = await Promise.all([getClient(), getServer()]);
    if (!client || !server) {
        return false;
    }
    return client.version < server.version;
}

const _onDidChange = new vscode.EventEmitter<Version>();
export function onDidChange(callback: (version: Version) => void) {
    _onDidChange.event(callback);
}

setInterval(async () => {
    let server = await _getServerTest();
    if (server && server?.version !== _lastServer?.version) {
        _lastServer = server;
        _onDidChange.fire(server);
    }
}, 1000 * 1);
