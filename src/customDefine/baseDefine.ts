import { env } from "../env";
import * as vscode from 'vscode';

export abstract class BaseDefine {
    constructor() {
        env.onDidChange(() => {
            this.update();
        });
        this.update();
    }

    private readonly _onDidChange = new vscode.EventEmitter<void>();
    private _fileWatcher?: vscode.FileSystemWatcher;

    public onDidChange = this._onDidChange.event;

    protected abstract watchPattern?: vscode.RelativePattern | undefined;

    private update() {
        this._fileWatcher?.dispose();
        let pattern = this.watchPattern;
        if (pattern) {
            this._fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
            this._fileWatcher.onDidChange(() => {
                this.update();
            });
            this._fileWatcher.onDidCreate(() => {
                this.update();
            });
            this._fileWatcher.onDidDelete(() => {
                this.update();
            });
        }

        this._onDidChange.fire();
    }
}
