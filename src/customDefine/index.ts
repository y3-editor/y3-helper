import { PlayerAttrs } from "./playerAttrs";
import { UnitAttrs } from "./unitAttrs";
import { Events } from "./event";
import { UI } from "./ui";

export const define = {
    单位属性: new UnitAttrs,
    玩家属性: new PlayerAttrs,
    自定义事件: new Events,
    界面: new UI,
};
