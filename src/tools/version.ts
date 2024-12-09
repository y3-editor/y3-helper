import * as y3 from 'y3-helper';

interface Version {
    version: number;
    display: string;
}

export async function getClient(): Promise<Version | undefined> {
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


export async function getServer(): Promise<Version | undefined> {
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
