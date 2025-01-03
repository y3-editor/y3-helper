import * as vscode from 'vscode';
import { env } from '../env';
import * as tools from '../tools';
import { throttle } from '../utility/decorators';

export abstract class BaseBuilder {
    constructor(public path: string) { }

    @throttle(500)
    public async update() {
        if (!env.scriptUri) {
            return;
        }
        let code = await this.make();
        if (code === undefined) {
            if (await tools.fs.isExists(env.scriptUri, this.path)) {
                return;
            } else {
                await tools.fs.writeFile(env.scriptUri, this.path, '');
            }
        } else if (code !== (await tools.fs.readFile(env.scriptUri))?.string) {
            await tools.fs.writeFile(env.scriptUri, this.path, code);
        }
    }

    protected abstract make(): Promise<string | undefined>;
}
