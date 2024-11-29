/* eslint-disable @typescript-eslint/semi */
import { Formatter } from './formatter';
import * as y3 from 'y3-helper';
import { define } from '../customDefine';

const metaDir = 'src\\helper_meta\\trigger';

let hasFilledEvents = false;
async function fillEvents(formatter: Formatter) {
    if (hasFilledEvents) {
        return;
    }
    hasFilledEvents = true;
    let eventInfoFile = await y3.fs.readFile(y3.uri(y3.helper.extensionUri, metaDir, 'event.json'));
    y3.assert(eventInfoFile, '未找到event.json');
    let eventInfo = y3.json.parse(eventInfoFile.string) as Record<string, { key: string, name: string }>;

    for (let [key, info] of Object.entries(eventInfo)) {
        formatter.setRule(key, (args) => {
            if (args) {
                return [y3.lua.encode(info.name), ...args].join(', ');
            }
            return y3.lua.encode(info.name);
        });
    }

    formatter.setRule('GENERIC_UNIT_EVENT', (args) => {
        let key = args?.[0];
        if (!key) {
            return '"GENERIC_UNIT_EVENT"';
        }
        return y3.lua.encode(eventInfo[key]?.name ?? key);
    })
}

function wrapLuaValue(t: Record<any, any>) {
    for (let key in t) {
        t[key] = y3.lua.encode(t[key]);
    }
    return t;
}

export async function fillMapDefined(formatter: Formatter) {
    await fillEvents(formatter);
    // 自定义事件
    formatter.setRule(100238, (await define.自定义事件.getEvents()).reduce((map, event) => {
        map[event.id] = y3.lua.encode(event.name);
        return map;
    }, {} as Record<string, string>))
    // 字体类型
    formatter.setRule(100259, wrapLuaValue({
        'physics': '物理伤害',
        'magic': '魔法伤害',
        'real': '真实伤害',
        'heal': '治疗',
        'get_gold': '获取金币',
        0: '系统字体',
        'MSYH': '微软雅黑',
        'HKHeiW9': '华康黑体W9',
        'HKHeiW12': '华康黑体W12',
        'HKSongW9': '华康标题宋W9',
        'HKWeiBeiW7': '华康魏碑W7',
        'HKXinZongYiW7': '华康新综艺体W7',
        'HKXinZongYiW9': '华康新综艺体W9',
        'HKYuanW5': '华康圆体W5',
        'HKYuanW7': '华康圆体W7',
        'HKYuanW9': '华康圆体W9',
        // 从配置里读取自定义字体
        ...(await define.字体.get()).reduce((map, font) => {
            map[font.uid] = font.name;
            return map;
        }, {} as Record<string, string>),
    }))
    // 从配置里读取跳字类型
    formatter.setRule(100333, (await define.跳字.get()).reduce((map, word) => {
        map[word.uid] = y3.lua.encode(word.name);
        return map;
    }, {} as Record<string, string>))
}

let hasFilledStatic = false;
export async function fillStatic(formatter: Formatter) {
    if (hasFilledStatic) {
        return;
    }
    hasFilledStatic = true;
    formatter
        // 预设单位
        . setRule(100006, 'y3.unit.get_by_res_id({})')
        // 玩家
        . setRule(100025, 'y3.player({})')
        // 伤害类型
        . setRule(100064, wrapLuaValue({
            0: '物理',
            1: '法术',
            2: '真实',
        }))
        // 预设可破坏物
        . setRule(100205, 'y3.destructible.get_by_id({})')
        . setRule(200220, wrapLuaValue({
            [0x00]: 'NONE',
            [0x01]: 'ESCAPE', // ESC
            [0x02]: 'KEY_1', // 1
            [0x03]: 'KEY_2', // 2
            [0x04]: 'KEY_3', // 3
            [0x05]: 'KEY_4', // 4
            [0x06]: 'KEY_5', // 5
            [0x07]: 'KEY_6', // 6
            [0x08]: 'KEY_7', // 7
            [0x09]: 'KEY_8', // 8
            [0x0A]: 'KEY_9', // 9
            [0x0B]: 'KEY_0', // 0
            [0x0C]: 'MINUS', // -
            [0x0D]: 'EQUAL', // =
            [0x0E]: 'BACKSPACE', // Backspace
            [0x0F]: 'TAB', // Tab
            [0x10]: 'Q', // Q
            [0x11]: 'W', // W
            [0x12]: 'E', // E
            [0x13]: 'R', // R
            [0x14]: 'T', // T
            [0x15]: 'Y', // Y
            [0x16]: 'U', // U
            [0x17]: 'I', // I
            [0x18]: 'O', // O
            [0x19]: 'P', // P
            [0x1A]: 'LBRACKET', // [
            [0x1B]: 'RBRACKET', // ]
            [0x1C]: 'ENTER', // Enter
            [0x1D]: 'LCTRL', // 左Ctrl
            [0x1E]: 'A', // A
            [0x1F]: 'S', // S
            [0x20]: 'D', // D
            [0x21]: 'F', // F
            [0x22]: 'G', // G
            [0x23]: 'H', // H
            [0x24]: 'J', // J
            [0x25]: 'K', // K
            [0x26]: 'L', // L
            [0x27]: 'SEMICOLON', // ;
            [0x28]: 'APOSTROPHE', // '
            [0x29]: 'GRAVE', // `
            [0x2A]: 'LSHIFT', // 左Shift
            [0x2B]: 'BACKSLASH', // \
            [0x2C]: 'Z', // Z
            [0x2D]: 'X', // X
            [0x2E]: 'C', // C
            [0x2F]: 'V', // V
            [0x30]: 'B', // B
            [0x31]: 'N', // N
            [0x32]: 'M', // M
            [0x33]: 'COMMA', // ,
            [0x34]: 'PERIOD', // .
            [0x35]: 'SLASH', // /
            [0x36]: 'RSHIFT', // 右Shift
            [0x37]: 'NUM_STAR', // 小键盘*
            [0x38]: 'LALT', // 左Alt
            [0x39]: 'SPACE', // Space
            [0x3A]: 'CAPSLOCK', // CAPSLOCK
            [0x3B]: 'F1', // F1
            [0x3C]: 'F2', // F2
            [0x3D]: 'F3', // F3
            [0x3E]: 'F4', // F4
            [0x3F]: 'F5', // F5
            [0x40]: 'F6', // F6
            [0x41]: 'F7', // F7
            [0x42]: 'F8', // F8
            [0x43]: 'F9', // F9
            [0x44]: 'F10', // F10
            [0x45]: 'PAUSE', // Pause
            [0x46]: 'SCROLL_LOCK', // Scroll Lock
            [0x47]: 'NUM_7', // 小键盘7
            [0x48]: 'NUM_8', // 小键盘8
            [0x49]: 'NUM_9', // 小键盘9
            [0x4A]: 'NUM_MINUS', // 小键盘-
            [0x4B]: 'NUM_4', // 小键盘4
            [0x4C]: 'NUM_5', // 小键盘5
            [0x4D]: 'NUM_6', // 小键盘6
            [0x4E]: 'NUM_ADD', // 小键盘+
            [0x4F]: 'NUM_1', // 小键盘1
            [0x50]: 'NUM_2', // 小键盘2
            [0x51]: 'NUM_3', // 小键盘3
            [0x52]: 'NUM_0', // 小键盘0
            [0x53]: 'NUM_PERIOD', // 小键盘.
            [0x57]: 'F11', // F11
            [0x58]: 'F12', // F12
            [0x9C]: 'NUM_ENTER', // 小键盘Enter
            [0x9D]: 'RCTRL', // 右Ctrl
            [0xB3]: 'NUM_COMMA', // 小键盘,
            [0xB5]: 'NUM_SLASH', // 小键盘/
            [0xB7]: 'SYSRQ', // 系统重启
            [0xB8]: 'R_ALT', // 右Alt
            [0xC5]: 'NUM_LOCK', // NumLock
            [0xC7]: 'HOME', // Home
            [0xC8]: 'UPARROW', // ↑
            [0xC9]: 'PAGEUP', // PageUp
            [0xCB]: 'LEFTARROW', // ←
            [0xCD]: 'RIGHTARROW', // →
            [0xCF]: 'END', // End
            [0xD0]: 'DOWNARROW', // ↓
            [0xD1]: 'PAGEDOWN', // PageDown
            [0xD2]: 'INSERT', // Insert
            [0xD3]: 'DELETE', // Delete
            [0xDB]: 'LWIN', // 左Win
            [0xDC]: 'RWIN', // 右Win
            [0xDD]: 'APPS', // 应用
        }))

        . setRule('UNIT_ENTITY_POINT', '{}:get_point()')
        . setRule('ALL_PLAYER', 'y3.player_group.get_all_players()')
        . setRule('CREATE_HARM_TEXT_NEW', 'y3.ui.create_floating_text2({point}, {type}, {str}, {jump_word_track}, {player_group})', ['point', 'type', 'str', 'player_group', 'jump_word_track'])
        . setRule('SET_DEST_IS_SELECTED', '{}:set_can_be_selected({})')
        /*
        ---@field target Unit|Item|Destructible
        ---@field type y3.Const.DamageType | integer # 也可以传任意数字
        ---@field damage number
        ---@field ability? Ability # 关联技能
        ---@field text_type? y3.Const.DamageTextType # 跳字类型
        ---@field text_track? integer # 跳字轨迹类型
        ---@field common_attack? boolean # 视为普攻
        ---@field critical? boolean # 必定暴击
        ---@field no_miss? boolean # 必定命中
        ---@field particle? py.SfxKey # 特效
        ---@field socket? string # 特效挂点
        ---@field attack_type? integer # 攻击类型
        ---@field pos_socket? string # 目标挂点
        */
        . setRule('APPLY_DAMAGE', ''
            + '{unit}:damage {\n'
            + '    target  = {target},\n'
            + '    damage  = {damage},\n'
            + '    type    = {type},\n'
            + '  <?socket  = {socket},?>\n'
            + '  <?ability = {ability},?>\n'
            + '  <?no_miss = {no_miss},?>\n'
            + '  <?critical      = {critical},?>\n'
            + '  <?particle      = {particle},?>\n'
            + '  <?text_type     = {text_enable} and {text_type},?>\n'
            + '  <?text_track    = {text_track},?>\n'
            + '  <?common_attack = {common_attack},?>\n'
            + '  <?attack_type   = {attack_type},?>\n'
            + '  <?pos_socket    = {pos_socket},?>\n'
            + '}'
            , [
                'unit', 'ability', 'target', 'type', 'damage', 'text_enable',
                'common_attack', 'critical', 'no_miss', 'particle', 'socket',
                'text_type', 'text_track', 'attack_type', 'pos_socket',
            ]
        )
        . setRule('NONE_ABILITY', null)
        . setRule('DISPLAY_INFO_TO_PLAYER', '{}:display_info({}, {})')
        . setRule('ANY_VAR_TO_STR', 'tostring({})')
        . setRule('CHANGE_MODEL_TEXTURE', '{}:change_model_texture({}, {}, {}, {})')
        . setRule('GET_CUS_EVENT_PARAM', 'data.data[{}]')
        . setRule('KILL_UNIT', '{}:kill_by({})')
        . setRule('KILLER_UNIT', 'data.source_unit')
        . setRule('KILLED_UNIT', 'data.target_unit')
}
