import { Env } from '../env';
import * as vscode from 'vscode';

type Event = {
    name: string;
    id: number;
    args: EventArg[];
};

type EventArg = {
    name: string;
    type: string;
};

export class Loader extends vscode.Disposable {
    private env: Env;
    private uri: vscode.Uri;
    private onUpdate: (customEvent: Loader) => void;
    private data?: Object;
    private _events?: Event[];

    constructor(env: Env, onUpdated: (customEvent: Loader) => void) {
        let watcher: vscode.FileSystemWatcher;
        super(() => watcher?.dispose());
        this.env = env;
        this.onUpdate = onUpdated;
        this.uri = vscode.Uri.joinPath(this.env.scriptUri!, '../customevent.json');
        watcher = vscode.workspace.createFileSystemWatcher(this.uri.fsPath);
        watcher.onDidCreate(this.update, this);
        watcher.onDidChange(this.update, this);
        watcher.onDidDelete(this.update, this);
    }

    private async update() {
        try {
            this.data = JSON.parse((await vscode.workspace.fs.readFile(this.uri)).toString());
        } catch {
            this.data = undefined;
        }
        this._events = undefined;
        this.onUpdate(this);
    }

    public get events() {
        if (!this._events) {
            this._events = [];
        }
        return this._events;
    }
}
