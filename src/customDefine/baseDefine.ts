import { env } from "../env";
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

export abstract class BaseDefine {
    constructor(public map: y3.Map) {
        env.onDidChange(() => {
            this.update();
        });
        this.update();
    }

    private readonly _onDidChange = new vscode.EventEmitter<void>();
    private _fileWatchers: vscode.FileSystemWatcher[] = [];

    public onDidChange = this._onDidChange.event;

    protected abstract watchPattern?: vscode.RelativePattern | vscode.RelativePattern[];

    private update() {
        for (const watcher of this._fileWatchers) {
            watcher.dispose();
        }
        this._fileWatchers = [];
        let patterns = this.watchPattern;
        if (patterns) {
            if (!Array.isArray(patterns)) {
                patterns = [patterns];
            }
            for (const pattern of patterns) {
                let watcher = vscode.workspace.createFileSystemWatcher(pattern);
                watcher.onDidChange(() => {
                    this.update();
                });
                watcher.onDidCreate(() => {
                    this.update();
                });
                watcher.onDidDelete(() => {
                    this.update();
                });
                this._fileWatchers.push(watcher);
            }
        }

        this._onDidChange.fire();
    }
}
