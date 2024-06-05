import { UnitAttrs } from './unitAttrs';
import { BaseBuilder } from './baseBuilder';
import { env } from '../env';
import { PlayerAttrs } from './playerAttrs';
import { CustomEvents } from './customEvents';
import { EditorTablesBuilder } from "./editorTables";
import { define } from '../customDefine';
import { UI } from './ui';

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
            .filter((builder) => builder.exists)
            .map((builder) => {
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
    let playerAttrs = new PlayerAttrs(path + '/playerAttrs.lua');
    let customEvents = new CustomEvents(path + '/customEvents.lua');
    // let editorunit = new EditorTablesBuilder(path + '/unitKeys.lua', 'unitKeys', define.单位类型);
    // let abilityall = new EditorTablesBuilder(path + '/abilityKeys.lua', 'abilityKeys', define.技能类型);
    // let editoritem = new EditorTablesBuilder(path + '/itemKeys.lua', 'itemKeys', define.物品类型);
    // let modifierall = new EditorTablesBuilder(path + '/buffKeys.lua', 'buffKeys', define.魔法效果类型);
    // let projectileall = new EditorTablesBuilder(path + '/projectileKeys.lua', 'projectileKeys', define.投射物类型);
    let ui = new UI(path + '/ui.lua');

    initBuilder.addFile(unitAttrs);
    initBuilder.addFile(playerAttrs);
    initBuilder.addFile(customEvents);
    // initBuilder.addFile(editorunit);
    // initBuilder.addFile(abilityall);
    // initBuilder.addFile(editoritem);
    // initBuilder.addFile(modifierall);
    // initBuilder.addFile(projectileall);
    initBuilder.addFile(ui);

    unitAttrs.onDidChange(() => {
        initBuilder.update();
    });
    playerAttrs.onDidChange(() => {
        initBuilder.update();
    });
    customEvents.onDidChange(() => {
        initBuilder.update();
    });
    ui.onDidChange(() => {
        initBuilder.update();
    });
}
