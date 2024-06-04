import { PlayerAttrs } from "./playerAttrs";
import { UnitAttrs } from "./unitAttrs";
import { EditorTables } from "./editorTables";
import { Events } from "./event";
import { UI } from "./ui";

export const define = {
    单位属性: new UnitAttrs,
    玩家属性: new PlayerAttrs,
    自定义事件: new Events,
    单位类型: new EditorTables("editorunit"),
    技能类型: new EditorTables("abilityall"),
    物品类型: new EditorTables("editoritem"),
    魔法效果: new EditorTables("modifierall"),
    投射物: new EditorTables("projectileall"),
    界面: new UI,
};
