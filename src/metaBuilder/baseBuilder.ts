import * as vscode from 'vscode';
import { env } from '../env';
import * as tools from '../tools';

export abstract class BaseBuilder {
    constructor(public path: string) {
    }
    protected _onDidChange = new vscode.EventEmitter<void>();

    public onDidChange = this._onDidChange.event;

    public exists = false;

    private debounceTimer?: NodeJS.Timeout;
    public update() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = undefined;
            this.didUpdate();
        }, 1000);
    }

    private async didUpdate() {
        if (!env.scriptUri) {
            this.updateExists(false);
            return;
        }
        let code = await this.make();
        if (code) {
            this.updateExists(await tools.writeFile(env.scriptUri, this.path, code));
        } else {
            tools.removeFile(env.scriptUri, this.path);
            this.updateExists(false);
        }
    }

    private updateExists(exists: boolean) {
        if (exists !== this.exists) {
            this.exists = exists;
            this._onDidChange.fire();
        }
    }

    protected abstract make(): Promise<string | undefined>;
}
