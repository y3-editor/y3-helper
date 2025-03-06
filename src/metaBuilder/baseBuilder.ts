import * as y3 from 'y3-helper';
import * as tools from '../tools';
import { throttle } from '../utility/decorators';
import * as l10n from '@vscode/l10n';

export abstract class BaseBuilder {
    constructor(public path: string) { }

    @throttle(500)
    public async updateAll() {
        if (!y3.env.project) {
            return;
        }
        for (const map of y3.env.project.maps) {
            await this.updateMap(map);
        }
    }

    private _mapInited = false;

    public async updateMap(map: y3.Map) {
        if (!await this.isValid(map)) {
            return;
        }
        if (!this._mapInited) {
            this._mapInited = true;
            this.initMap(map);
        }
        let code = await this.make(map);
        if (code === undefined) {
            if (await tools.fs.isExists(map.helperUri, this.path)) {
                return;
            } else {
                await tools.fs.writeFile(map.helperUri, this.path, '');
            }
        } else {
            code = code.replace(/\by3\b/g, l10n.t('y3'));
            code = code.replace(/\bY3\b/g, l10n.t('Y3'));
            if (code !== (await tools.fs.readFile(map.helperUri))?.string) {
                await tools.fs.writeFile(map.helperUri, this.path, code);
            }
        }
    }

    protected async isValid(map: y3.Map) {
        return true;
    }

    protected initMap(map: y3.Map): void { }

    protected abstract make(map: y3.Map): Promise<string | undefined>;
}
