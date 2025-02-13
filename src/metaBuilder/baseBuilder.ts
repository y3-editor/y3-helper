import { env } from '../env';
import * as tools from '../tools';
import { throttle } from '../utility/decorators';
import * as l10n from '@vscode/l10n';

export abstract class BaseBuilder {
    constructor(public path: string) { }

    @throttle(500)
    public async update() {
        if (!env.helperUri) {
            return;
        }
        if (!await this.isValid()) {
            return;
        }
        let code = await this.make();
        if (code === undefined) {
            if (await tools.fs.isExists(env.helperUri, this.path)) {
                return;
            } else {
                await tools.fs.writeFile(env.helperUri, this.path, '');
            }
        } else {
            code = code.replace(/\by3\b/g, l10n.t('y3'));
            code = code.replace(/\bY3\b/g, l10n.t('Y3'));
            if (code !== (await tools.fs.readFile(env.helperUri))?.string) {
                await tools.fs.writeFile(env.helperUri, this.path, code);
            }
        }
    }

    protected async isValid() {
        return true;
    }

    protected abstract make(): Promise<string | undefined>;
}
