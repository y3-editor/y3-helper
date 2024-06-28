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

export async function readFile(uri: vscode.Uri, relativePath?: string) {
    if (relativePath) {
        uri = vscode.Uri.joinPath(uri, relativePath);
    }
    try {
        let data = await vscode.workspace.fs.readFile(uri);
        let file = new File().write(data);
        return file;
    } catch {}
}

export async function writeFile(uri: vscode.Uri, relativePath: string | undefined, data: string): Promise<boolean>;
export async function writeFile(uri: vscode.Uri, data: string): Promise<boolean>;
export async function writeFile(uri: vscode.Uri, ...args: any[]) {
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

export async function removeFile(uri: vscode.Uri, relativePath?: string) {
    if (relativePath) {
        uri = vscode.Uri.joinPath(uri, relativePath);
    }
    try {
        await vscode.workspace.fs.delete(uri);
        return true;
    } catch {
        return false;
    }
}

export async function dir(uri: vscode.Uri, relativePath?: string) {
    if (relativePath) {
        uri = vscode.Uri.joinPath(uri, relativePath);
    }
    try {
        let files = await vscode.workspace.fs.readDirectory(uri);
        return files;
    } catch {}
}

export async function stat(uri: vscode.Uri, relativePath?: string) {
    if (relativePath) {
        uri = vscode.Uri.joinPath(uri, relativePath);
    }
    try {
        let stat = await vscode.workspace.fs.stat(uri);
        return stat;
    } catch {}
}
