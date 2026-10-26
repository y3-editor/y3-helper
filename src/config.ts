import * as vscode from 'vscode';
import {
    ConfigSnapshot,
    LaunchMapTarget,
    createDefaultConfigSnapshot,
    parseConfigSnapshot,
    sanitizeConfigForPlatform,
    snapshotConfig,
} from './configSnapshot';

const CONFIG_FILE_NAME = 'config.json';

class Config {
    multiMode: boolean = false;
    multiPlayers: number[] = [];
    multiPlayerNicknames: Record<number, string> = {};
    debugPlayers: number[] = [];
    tracy: boolean = false;
    attachWhenLaunch: boolean = true;
    attachCloudScriptWhenLaunch: boolean = false;
    launchMap: LaunchMapTarget = ['option', 'entry'];

    private storageUri?: vscode.Uri;
    private saveQueue: Promise<void> = Promise.resolve();

    async load(storageUri: vscode.Uri | undefined) {
        this.storageUri = storageUri;
        if (!storageUri) {
            this.apply(createDefaultConfigSnapshot());
            return;
        }
        try {
            const content = await vscode.workspace.fs.readFile(this.getConfigUri(storageUri));
            this.apply(parseConfigSnapshot(JSON.parse(new TextDecoder().decode(content))));
        } catch (error) {
            if ((error as { code?: string } | undefined)?.code !== 'FileNotFound') {
                console.error('[y3-helper] Failed to load config', error);
            }
            this.apply(createDefaultConfigSnapshot());
        }
    }

    update(mutator: (config: Config) => void) {
        mutator(this);
        this.scheduleSave();
    }

    async flush() {
        await this.saveQueue;
    }

    async readPersisted(): Promise<unknown> {
        if (!this.storageUri) {
            return undefined;
        }
        try {
            const content = await vscode.workspace.fs.readFile(this.getConfigUri(this.storageUri));
            return JSON.parse(new TextDecoder().decode(content));
        } catch {
            return undefined;
        }
    }

    private apply(snapshot: ConfigSnapshot) {
        const sanitized = sanitizeConfigForPlatform(snapshot);
        this.multiMode = sanitized.multiMode;
        this.multiPlayers = [...sanitized.multiPlayers];
        this.debugPlayers = [...sanitized.debugPlayers];
        this.tracy = sanitized.tracy;
        this.attachWhenLaunch = sanitized.attachWhenLaunch;
        this.attachCloudScriptWhenLaunch = sanitized.attachCloudScriptWhenLaunch;
        this.launchMap = [sanitized.launchMap[0], sanitized.launchMap[1]];
        // Nicknames are restored from archive_storage.json when the project loads.
        this.multiPlayerNicknames = {};
    }

    private scheduleSave() {
        const storageUri = this.storageUri;
        if (!storageUri) {
            return;
        }
        const snapshot = snapshotConfig(this);
        this.saveQueue = this.saveQueue
            .then(() => this.writeSnapshot(storageUri, snapshot))
            .catch((error) => console.error('[y3-helper] Failed to save config', error))
            .then(() => undefined);
    }

    private async writeSnapshot(storageUri: vscode.Uri, snapshot: ConfigSnapshot) {
        await vscode.workspace.fs.createDirectory(storageUri);
        await vscode.workspace.fs.writeFile(
            this.getConfigUri(storageUri),
            new TextEncoder().encode(JSON.stringify(snapshot, null, 2)),
        );
    }

    private getConfigUri(storageUri: vscode.Uri) {
        return vscode.Uri.joinPath(storageUri, CONFIG_FILE_NAME);
    }
}

export let config = new Config();
