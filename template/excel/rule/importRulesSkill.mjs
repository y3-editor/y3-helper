import { Int, Str, Bool, Float, List, Tuple, Templete, Enum, RatiosInt, RatiosFloat } from '../../../out/editorTable/EXCEL/fieldTypes.js';
import { DEFAULT, REQUIRED, IGNORE, AS, INDEX } from '../../../out/editorTable/EXCEL/attrType.js';
import { ImportRule } from '../../../out/editorTable/EXCEL/importRule.js';

export const magicEffectRule = new ImportRule('魔法效果', './魔法效果表.xlsx', '静态表');
magicEffectRule.startBy(2);
magicEffectRule.indexBy('编号');
magicEffectRule.templateBy('模板ID');
magicEffectRule.def('名称', 'name', Str);
magicEffectRule.def('图标', 'icon', Int);
magicEffectRule.def('类型', 'modifier_type', Enum({
    '普通' : 1,
    '光环' : 2,
    '光环效果' : 3,
    '护盾' : 4,
}));
magicEffectRule.def('是否显示', 'show_on_ui', Bool);
magicEffectRule.def('影响类型', 'modifier_effect', Enum({
    '普通' : 1,
    '正面' : 2,
    '负面' : 3,
}));
magicEffectRule.def('覆盖类型', 'modifier_cover_type',  Enum({
    '独立（不覆盖）' : 1,
    '高级覆盖低级' : 2,
    '新的覆盖旧的' : 3,
    '叠加' : 4,
}));
magicEffectRule.def('层数', 'layer_max', Int);
magicEffectRule.def('描述', 'description', Str);

export const projectileRule = new ImportRule('投射物', './投射物表.xlsx', '静态表');
projectileRule.startBy(1);
projectileRule.indexBy('编号');
projectileRule.templateBy('模板ID');
projectileRule.def('名称', 'name', Str);
projectileRule.def('图标', 'icon', Int);
projectileRule.def('模型编号1', 'model', Int, AS('effect_foes', AS(5)));
projectileRule.def('模型编号2', 'model', Int, AS('effect_friend', AS(5)));
projectileRule.def('缩放', [0,1,2], Float, AS('effect_foes', AS(5, AS('scale', AS('items')))));
projectileRule.def('缩放1', [0,1,2], Float, AS('effect_friend', AS(5, AS('scale', AS('items')))));

export const heroSkillCorrelatRule = new ImportRule('单位', './英雄技能关联表.xlsx', '静态表');
heroSkillCorrelatRule.startBy(2);
heroSkillCorrelatRule.indexBy('战兵编号');
heroSkillCorrelatRule.templateBy('战兵编号');
heroSkillCorrelatRule.def('塔编号', 'tower_id', Int);
heroSkillCorrelatRule.def('技能编号', 'common_ability_list', List('_', Int), (obj, data)=>{
    if(Array.isArray(obj)){
        obj.push(data);
    }
    return obj;
});
heroSkillCorrelatRule.dataRehandle = (rowData)=>{
    let data_tower = {};
    if(rowData.hasOwnProperty('tower_id')){
        if(rowData.hasOwnProperty('common_ability_list')){
            data_tower['common_ability_list'] = [];
            data_tower['common_ability_list'].push(rowData['common_ability_list'][rowData['common_ability_list'].length-1]);
        }
        data_tower['common_ability_list'][data_tower['common_ability_list'].length-1][1] = 1;
        let tower_id = rowData['tower_id'];
        data_tower['uid'] = tower_id;
    }
    return [data_tower, rowData];
};

export const heroSkillRule = new ImportRule('技能', './英雄技能表.xlsx', '静态表');
heroSkillRule.startBy(1);
heroSkillRule.indexBy('编号');
heroSkillRule.templateBy('模板ID');
heroSkillRule.def('图标1', 'icon', Int);
heroSkillRule.def('图标2', 'ability_icon', Int);
heroSkillRule.def('名称', 'name', Str);
heroSkillRule.def('最大等级', 'ability_max_level', Int);
heroSkillRule.def('施法距离', 0, RatiosInt(0.01), AS('ability_cast_range', AS('items')));
heroSkillRule.def('冷却时间', 0, Float, AS('cold_down_time', AS('items')));
heroSkillRule.def('法力消耗', 0, Float, AS('ability_cost', AS('items')));
heroSkillRule.def('木头消耗', 1, Float, AS('player_props_cost', AS(0)));
heroSkillRule.def('技能类型', 'ability_cast_type', Enum({
    '主动':2,
    '被动':3,
}));
heroSkillRule.def('目标阵营', 'filter_condition_camp', Int);
heroSkillRule.def('手动使用', 'is_autocast', Bool);
heroSkillRule.def('对自己', 'sight_type', Bool);
heroSkillRule.def('筛选标签1', -1, Str, AS('filter_unit_tags', AS('items')));
heroSkillRule.def('筛选标签2', -1, Str, AS('filter_unit_tags', AS('items')));
heroSkillRule.def('筛选标签3', -1, Str, AS('filter_unit_tags', AS('items')));
heroSkillRule.def('筛选标签4', -1, Str, AS('filter_unit_tags', AS('items')));
heroSkillRule.def('可瞬发', 'is_immediate', Bool);
heroSkillRule.def('自动施法', 'is_autocast', Bool);
heroSkillRule.def('施法持续时间', 'ability_channel_time', Float);
heroSkillRule.def('可瞬发', 'is_immediate', Bool);
heroSkillRule.def('可瞬发', 'is_immediate', Bool);

export const soldiersSkillRule = heroSkillRule.copyRule();
soldiersSkillRule.resetRule('技能', './兵种技能表.xlsx', '静态表');