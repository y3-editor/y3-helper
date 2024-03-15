import JSZip from 'jszip';
import { Env } from '../env';
import * as tools from '../tools';

export class UI {
    private env: Env;

    constructor(env: Env) {
        this.env = env;
    }

    public async make() {
        try {
            let result = await tools.download('https://up5.nosdn.127.net/editor/zip/edc461b312fc308779be9273a2cee6bb');
        } catch (error) {
        }
    }
}
