import * as y3 from 'y3-helper';
import * as vscode from 'vscode';
import * as fs from '../tools/fs';
import { throttle } from '../utility/decorators';
import * as l10n from '@vscode/l10n';

export abstract class BaseBuilder {
    constructor(public path: string) { }

    private _mapsReadySubscription?: ReturnType<typeof y3.env.onDidChange>;

    @throttle(500)
    public async updateAll() {
        const maps = y3.env.project?.maps;
        if (!maps?.length) {
            this._mapsReadySubscription ??= y3.env.onDidChange(() => {
                if (!y3.env.project?.maps.length) {
                    return;
                }
                this._mapsReadySubscription?.dispose();
                this._mapsReadySubscription = undefined;
                this.updateAll();
            });
            return;
        }

        this._mapsReadySubscription?.dispose();
        this._mapsReadySubscription = undefined;
        for (const map of maps) {
            await this.updateMap(map);
        }
    }

    private _mapInited: Set<y3.Map> = new Set();

    public async updateMap(map: y3.Map) {
        if (!await this.isValid(map)) {
            return;
        }
        if (!this._mapInited.has(map)) {
            this._mapInited.add(map);
            this.initMap(map);
        }
        await this.writeTo(map.helperUri, map);
        // 启用全局脚本时额外生成一份到全局目录做兜底；
        // 加载顺序是“地图脚本优先于全局脚本”，所以地图里已有的那份会覆盖全局这份。
        if (y3.env.globalScriptEnabled && y3.env.globalHelperUri && map === y3.env.project?.entryMap) {
            await this.writeTo(y3.env.globalHelperUri, map);
        }
    }

    private async writeTo(rootUri: vscode.Uri, map: y3.Map) {
        let code = await this.make(map);
        if (code === undefined) {
            if (await fs.isExists(rootUri, this.path)) {
                return;
            }
            await fs.writeFile(rootUri, this.path, '');
            return;
        }
        code = code.replace(/\by3\b/g, l10n.t('y3'));
        code = code.replace(/\bY3\b/g, l10n.t('Y3'));
        if (code !== (await fs.readFile(rootUri, this.path))?.string) {
            await fs.writeFile(rootUri, this.path, code);
        }
    }

    protected async isValid(map: y3.Map) {
        return true;
    }

    protected initMap(map: y3.Map): void { }

    protected abstract make(map: y3.Map): Promise<string | undefined>;
}
