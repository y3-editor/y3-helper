/* eslint-disable @typescript-eslint/semi */
import { Formatter } from './formatter';

export function testConfig(formatter: Formatter) {
    formatter
        . setRule(100006, 'y3.unit.get_by_res_id({})')
        . setRule(100205, 'y3.destructible.get_by_id({})')
        . setRule(100333, {
            934231441: '"伤害_左上"',
            934269508: '"伤害_中上"',
            934266669: '"伤害_右上"',
            934252831: '"伤害_左下"',
            934277693: '"金币跳字"',
        })

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
