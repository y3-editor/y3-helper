import { Formatter } from './formatter';

export function testConfig(formatter: Formatter) {
    formatter.setValueRule(100006, 'y3.unit.get_by_res_id({})');

    formatter.setValueRule(100333, {
        934231441: '"伤害_左上"',
        934269508: '"伤害_中上"',
        934266669: '"伤害_右上"',
        934252831: '"伤害_左下"',
        934277693: '"金币跳字"',
    });

    formatter.setCallRule('UNIT_ENTITY_POINT', '{}:get_point()');
    formatter.setCallRule('ALL_PLAYER', 'y3.player_group.get_all_players()');
    formatter.setCallRule('CREATE_HARM_TEXT_NEW', 'y3.ui.create_floating_text2({point}, {type}, {str}, {jump_word_track}, {player_group})', ['point', 'type', 'str', 'player_group', 'jump_word_track']);
}
