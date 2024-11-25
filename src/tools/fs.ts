import * as vscode from 'vscode';

class File {
    private _data = new Uint8Array();

    write(data: Uint8Array) {
        this._data = data;
        return this;
    }

    get buffer() {
        return Buffer.from(this._data);
    }

    get string() {
        return this.buffer.toString();
    }
}

export async function readFile(uri: vscode.Uri | string, relativePath?: string) {
    if (typeof uri === 'string') {
        uri = vscode.Uri.file(uri);
    }
    if (relativePath) {
        uri = vscode.Uri.joinPath(uri, relativePath);
    }
    try {
        let data = await vscode.workspace.fs.readFile(uri);
        let file = new File().write(data);
        return file;
    } catch {}
}

export async function writeFile(uri: vscode.Uri | string, relativePath: string | undefined, data: string): Promise<boolean>;
export async function writeFile(uri: vscode.Uri | string, data: string): Promise<boolean>;
export async function writeFile(uri: vscode.Uri | string, ...args: any[]) {
    if (typeof uri === 'string') {
        uri = vscode.Uri.file(uri);
    }
    let data: string;
    if (args.length === 1) {
        data = args[0];
    } else {
        let relativePath: string = args[0];
        uri = vscode.Uri.joinPath(uri, relativePath);
        data = args[1];
    }
    try {
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(data));
        return true;
    } catch {
        return false;
    }
}

interface DeleteOptions {
    /**
     * 递归删除文件夹
     */
    recursive?: boolean;
    /**
     * 尝试移动到回收站
     */
    useTrash?: boolean;
}

export async function removeFile(uri: vscode.Uri | string, options?: DeleteOptions): Promise<boolean>;
export async function removeFile(uri: vscode.Uri | string, relativePath?: string, options?: DeleteOptions): Promise<boolean>;
export async function removeFile(uri: vscode.Uri | string, ...args: any[]) {
    if (typeof uri === 'string') {
        uri = vscode.Uri.file(uri);
    }
    let options: DeleteOptions | undefined;
    if (typeof args[0] === 'string') {
        uri = vscode.Uri.joinPath(uri, args[0]);
        options = args[1];
    } else {
        options = args[0];
    }
    try {
        await vscode.workspace.fs.delete(uri, options);
        return true;
    } catch {
        return false;
    }
}

export async function dir(uri: vscode.Uri | string, relativePath?: string) {
    if (typeof uri === 'string') {
        uri = vscode.Uri.file(uri);
    }
    if (relativePath) {
        uri = vscode.Uri.joinPath(uri, relativePath);
    }
    try {
        if ((await vscode.workspace.fs.stat(uri)).type !== vscode.FileType.Directory) {
            return [];
        };
        let files = await vscode.workspace.fs.readDirectory(uri);
        return files;
    } catch {
        return [];
    }
}

export async function scan(uri: vscode.Uri | string, relativePath?: string, partail?: (result: [string, vscode.FileType][]) => void) {
    if (typeof uri === 'string') {
        uri = vscode.Uri.file(uri);
    }
    if (relativePath) {
        uri = vscode.Uri.joinPath(uri, relativePath);
    }

    let result: [string, vscode.FileType][] = [];

    async function doScan(uri: vscode.Uri, path?: string) {
        let files = await dir(uri, path);
        for (const [name, fileType] of files) {
            let fullPath = path ? `${path}/${name}` : name;
            result.push([fullPath, fileType]);
            partail?.(result);
            if (fileType === vscode.FileType.Directory) {
                await doScan(uri, fullPath);
            }
        }
    }

    await doScan(uri);

    return result;
}

export async function stat(uri: vscode.Uri | string, relativePath?: string) {
    if (typeof uri === 'string') {
        uri = vscode.Uri.file(uri);
    }
    if (relativePath) {
        uri = vscode.Uri.joinPath(uri, relativePath);
    }
    try {
        let stat = await vscode.workspace.fs.stat(uri);
        return stat;
    } catch {}
}

export async function isFile(uri: vscode.Uri | string, relativePath?: string) {
    let statInfo = await stat(uri, relativePath);
    return statInfo?.type === vscode.FileType.File;
}

export async function isDirectory(uri: vscode.Uri | string, relativePath?: string) {
    let statInfo = await stat(uri, relativePath);
    return statInfo?.type === vscode.FileType.Directory;
}

export async function isExists(uri: vscode.Uri | string, relativePath?: string) {
    return (await stat(uri, relativePath)) !== undefined;
}

interface CopyOptions {
    overwrite?: boolean;
    recursive?: boolean;
    nameMap?: string;
    pattern?: RegExp;
}

async function loadNameMap(uri: vscode.Uri, nameMapPath: string): Promise<{[key: string]: string} | undefined>{
    let nameMapFile = await readFile(uri, nameMapPath);
    if (!nameMapFile) {
        return undefined;
    }
    try {
        let map = JSON.parse(nameMapFile.string);
        if (typeof map !== 'object' || map === null) {
            return undefined;
        }
        return map;
    } catch {
        return undefined;
    }
}

export async function copy(source: vscode.Uri | string, target: vscode.Uri | string, options?: CopyOptions): Promise<boolean> {
    if (typeof source === 'string') {
        source = vscode.Uri.file(source);
    }
    if (typeof target === 'string') {
        target = vscode.Uri.file(target);
    }
    const fileStat = await stat(source);
    if (!fileStat) {
        return false;
    }
    if (fileStat.type === vscode.FileType.Directory) {
        let promises: Promise<boolean>[] = [];
        let nameMap = options?.nameMap ? await loadNameMap(source, options?.nameMap) : undefined;
        for (const [name, fileType] of await dir(source)) {
            if (options?.pattern && !options.pattern.test(name)) {
                continue;
            }
            if (options?.nameMap && options.nameMap === name) {
                continue;
            }
            let childSource = vscode.Uri.joinPath(source, name);
            let childTarget = vscode.Uri.joinPath(target, nameMap?.[name] ?? name);
            if (fileType !== vscode.FileType.Directory || options?.recursive) {
                promises.push(copy(childSource, childTarget, options));
            }
        }
        let results = await Promise.all(promises);
        return results.every(value => value);
    } else {
        await vscode.workspace.fs.copy(source, target, options);
        return true;
    }
}

export function isRelativePath(path: string) {
    return path.startsWith('./') || path.startsWith('../');
}

export function isAbsolutePath(path: string) {
    return path.startsWith('/') || /^[a-zA-Z]:\\/.test(path);
}
