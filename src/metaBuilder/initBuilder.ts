import { UnitAttrs } from './unitAttrs';
import { BaseBuilder } from './baseBuilder';
import { env } from '../env';

let path = 'y3-helper/meta';

class InitBuilder extends BaseBuilder {
    private builders: BaseBuilder[] = [];
    public addFile(builder: BaseBuilder) {
        this.builders.push(builder);
    }

    async make() {
        if (!env.scriptUri) {
            return;
        }
        let codes = this.builders
            . filter((builder) => builder.exists)
            . map((builder) => {
                // 将正斜杠和反斜杠替换为点号
                let name = builder.path
                    .replace(/\.lua$/, '')
                    .replace(/[\\/]/g, '.');
                return `require '${name}'`;
            });
        if (codes.length === 0) {
            return;
        }
        return codes.join('\r\n') + '\r\n';
    }
}

export function init() {
    let initBuilder = new InitBuilder(path + '/init.lua');

    let unitAttrs = new UnitAttrs(path + '/unitAttrs.lua');

    initBuilder.addFile(unitAttrs);
    unitAttrs.onDidChange(() => {
        initBuilder.update();
    });
}
