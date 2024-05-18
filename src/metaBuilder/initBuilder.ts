import { UnitAttrs } from './unitAttrs';
import { BaseBuilder } from './baseBuilder';
import { env } from '../env';
import { PlayerAttrs } from './playerAttrs';
import { CustomEvents } from './customEvents';
import { EditorTablesBuilder } from "./editorTables";
import { define } from '../customDefine';


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
    let editorunit = new EditorTablesBuilder(path + '/editorunit.lua', 'unitTypes', define.单位类型);
    let abilityall = new EditorTablesBuilder(path + '/abilityTypes.lua', 'abilityType', define.技能类型);
    let editoritem = new EditorTablesBuilder(path + '/itemTypes.lua', 'itemType', define.物品类型);
    let modifierall = new EditorTablesBuilder(path + '/buffTypes.lua', 'buffType', define.魔法效果);
    let projectileall = new EditorTablesBuilder(path + '/projectileTypes.lua', 'projectileType', define.投射物);




    initBuilder.addFile(unitAttrs);
    initBuilder.addFile(playerAttrs);
    initBuilder.addFile(customEvents);
    initBuilder.addFile(editorunit);
    initBuilder.addFile(abilityall);
    initBuilder.addFile(editoritem);
    initBuilder.addFile(modifierall);
    initBuilder.addFile(projectileall);

    unitAttrs.onDidChange(() => {
        initBuilder.update();
    });
    playerAttrs.onDidChange(() => {
        initBuilder.update();
    });
    customEvents.onDidChange(() => {
        initBuilder.update();
    });
}
