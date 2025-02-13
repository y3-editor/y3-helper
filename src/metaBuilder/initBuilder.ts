import { UnitAttrs } from './unitAttrs';
import { BaseBuilder } from './baseBuilder';
import { env } from '../env';
import { PlayerAttrs } from './playerAttrs';
import { CustomEvents } from './customEvents';
import { UI } from './ui';
import { UIAnim } from './uiAnim';
import { JumpWord } from './jumpword';
import { Font } from './font';
import { Objects } from './objects';
import { TS } from './tsMeta';
import * as l10n from '@vscode/l10n';

let luaPath = 'meta';
let tsPath  = 'plugin';

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
            .map((builder) => {
                // 将正斜杠和反斜杠替换为点号
                let name = builder.path
                    .replace(/\.lua$/, '')
                    .replace(/[\\/]/g, '.');
                return `include '${l10n.t("y3-helper")}.${name}'`;
            });
        if (codes.length === 0) {
            return;
        }
        return codes.join('\r\n') + '\r\n';
    }

    public addChild(builder: any, fileName: string) {
        let instance = new builder(luaPath + '/' + fileName);
        this.addFile(instance);
    }
}

export function init() {
    let initBuilder = new InitBuilder(luaPath + '/init.lua');

    initBuilder.addChild(UnitAttrs, 'unitAttrs.lua');
    initBuilder.addChild(PlayerAttrs, 'playerAttrs.lua');
    initBuilder.addChild(CustomEvents, 'customEvents.lua');
    initBuilder.addChild(UI, 'ui.lua');
    initBuilder.addChild(UIAnim, 'uiAnim.lua');
    initBuilder.addChild(JumpWord, 'jumpword.lua');
    initBuilder.addChild(Font, 'font.lua');
    //initBuilder.addChild(Objects, 'objects.lua');

    env.onDidChange(() => {
        initBuilder.update();
    });

    new TS(tsPath + '/map-declare.d.ts');
}
