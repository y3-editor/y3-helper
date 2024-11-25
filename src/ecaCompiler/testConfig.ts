/* eslint-disable @typescript-eslint/semi */
import { Formatter } from './formatter';
import * as y3 from 'y3-helper';
import { define } from '../customDefine';

export async function fillMapDefined(formatter: Formatter) {
    formatter
        // 字体类型
        .setRule(100259, {
            'physics': y3.lua.encode('物理伤害'),
            'magic': y3.lua.encode('魔法伤害'),
            'real': y3.lua.encode('真实伤害'),
            'heal': y3.lua.encode('治疗'),
            'get_gold': y3.lua.encode('获取金币'),
            0: y3.lua.encode('系统字体'),
            'MSYH': y3.lua.encode('微软雅黑'),
            'HKHeiW9': y3.lua.encode('华康黑体W9'),
            'HKHeiW12': y3.lua.encode('华康黑体W12'),
            'HKSongW9': y3.lua.encode('华康标题宋W9'),
            'HKWeiBeiW7': y3.lua.encode('华康魏碑W7'),
            'HKXinZongYiW7': y3.lua.encode('华康新综艺体W7'),
            'HKXinZongYiW9': y3.lua.encode('华康新综艺体W9'),
            'HKYuanW5': y3.lua.encode('华康圆体W5'),
            'HKYuanW7': y3.lua.encode('华康圆体W7'),
            'HKYuanW9': y3.lua.encode('华康圆体W9'),
            // 从配置里读取自定义字体
            ...(await define.字体.get()).reduce((map, font) => {
                map[font.uid] = y3.lua.encode(font.name);
                return map;
            }, {} as Record<string, string>),
        })
        // 从配置里读取跳字类型
        . setRule(100333, (await define.跳字.get()).reduce((map, word) => {
            map[word.uid] = y3.lua.encode(word.name);
            return map;
        }, {} as Record<string, string>))
}

export function fillStatic(formatter: Formatter) {
    formatter
        // 预设单位
        . setRule(100006, 'y3.unit.get_by_res_id({})')
        // 伤害类型
        . setRule(100064, {
            0: y3.lua.encode('物理'),
            1: y3.lua.encode('法术'),
            2: y3.lua.encode('真实'),
        })
        // 预设可破坏物
        . setRule(100205, 'y3.destructible.get_by_id({})')

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
}
