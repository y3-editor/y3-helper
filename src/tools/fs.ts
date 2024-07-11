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
        await vscode.workspace.fs.writeFile(uri, Buffer.from(data));
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
        let files = await vscode.workspace.fs.readDirectory(uri);
        return files;
    } catch {
        return [];
    }
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

export async function copy(source: vscode.Uri | string, target: vscode.Uri | string, options?: { overwrite?: boolean }) {
    if (typeof source === 'string') {
        source = vscode.Uri.file(source);
    }
    if (typeof target === 'string') {
        target = vscode.Uri.file(target);
    }
    try {
        await vscode.workspace.fs.copy(source, target, options);
        return true;
    } catch {
        return false;
    }
}

export function isRelativePath(path: string) {
    return path.startsWith('./') || path.startsWith('../');
}

export function isAbsolutePath(path: string) {
    return path.startsWith('/') || /^[a-zA-Z]:\\/.test(path);
}
