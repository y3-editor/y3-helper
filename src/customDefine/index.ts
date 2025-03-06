import * as env from "../env";
import { PlayerAttrs } from "./playerAttrs";
import { UnitAttrs } from "./unitAttrs";
import { Events } from "./event";
import { UI } from "./ui";
import { UIAnim } from "./uiAnim";
import { JumpWord } from "./jumpword";
import { Font } from "./font";

let _define: Map<env.Map, ReturnType<typeof makeDefine>> = new Map();

function makeDefine(map: env.Map) {
    return {
        单位属性: new UnitAttrs(map),
        玩家属性: new PlayerAttrs(map),
        自定义事件: new Events(map),
        界面: new UI(map),
        时间轴动画: new UIAnim(map),
        跳字: new JumpWord(map),
        字体: new Font(map),
    } as const;
}

export function define(map: env.Map) {
    return _define.get(map) ?? _define.set(map, makeDefine(map)).get(map)!;
}
