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

export async function writeFile(uri: vscode.Uri, relativePath: string | undefined, data: string) {
    if (relativePath) {
        uri = vscode.Uri.joinPath(uri, relativePath);
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
