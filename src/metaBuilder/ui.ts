import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';

const template =
`---@enum(key, partial) y3.Const.SceneUI
local SceneUI = {
%{UI_ENUMS}
}

y3.util.tableMerge(y3.const.SceneUI or {}, SceneUI)
`;

export class UI extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.update();
        define.界面.onDidChange(() => {
            this.update();
        });
    }

    async make() {
        let uiPackage = await define.界面.getUIPackage();
        let sceneUIs = uiPackage.场景UI;
        if (sceneUIs.length === 0) {
            return;
        }
        return template.replace('%{UI_ENUMS}', sceneUIs.map(sceneUI => {
            return `    ["${sceneUI.name}"] = "${sceneUI.uid}",`;
        }).join('\r\n'));
    }

}
