import { PlayerAttrs } from "./playerAttrs";
import { UnitAttrs } from "./unitAttrs";
import { Events } from "./event";
import { UI } from "./ui";
import { UIAnim } from "./uiAnim";
import { JumpWord } from "./jumpword";
import { Font } from "./font";

export const define = {
    单位属性: new UnitAttrs,
    玩家属性: new PlayerAttrs,
    自定义事件: new Events,
    界面: new UI,
    时间轴动画: new UIAnim,
    跳字: new JumpWord,
    字体: new Font,
};
