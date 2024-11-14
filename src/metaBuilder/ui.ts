import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';

const template =
`y3.const.SceneUI = y3.const.SceneUI or {}

%{UI_ENUMS}

---@enum(key, partial) y3.Const.SceneUI
local SceneUI = {
%{META_UI_ENUMS}
}
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
            return `y3.const.SceneUI["${sceneUI.name}"] = "${sceneUI.uid}"`;
        }).join('\r\n')).replace('%{META_UI_ENUMS}', sceneUIs.map(sceneUI => {
            return `    ["${sceneUI.name}"] = "${sceneUI.uid}",`;
        }).join('\r\n'));
    }

}
