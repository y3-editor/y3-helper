import { Int, Str, Bool, Float, List, Tuple, Templete, Enum, RatiosInt, RatiosFloat } from '../../../out/editorTable/EXCEL/fieldTypes.js';
import {REQUIRED, IGNORE, AS, INDEX } from '../../../out/editorTable/EXCEL/attrType.js';
import { ImportRule } from '../../../out/editorTable/EXCEL/importRule.js';


export const soldiersTypeRule = new ImportRule('单位', './兵种表.xlsx', '静态表');
soldiersTypeRule.startBy(2);
soldiersTypeRule.filter = (row)=>{
    if(row[0] === '#'){return false;}
};
soldiersTypeRule.indexBy('战兵编号');
soldiersTypeRule.templateBy('模板ID');
soldiersTypeRule.def('塔编号', 'tower_id', Int);
soldiersTypeRule.def('名称', 'name', Str);
soldiersTypeRule.def('图标', 'icon', Int);
soldiersTypeRule.def('后缀', 'suffix', Str);
soldiersTypeRule.def('模型', 'model', Int);
soldiersTypeRule.def('缩放', 'body_size', Float);
soldiersTypeRule.def('平均攻击', 'attack_phy', Float);
soldiersTypeRule.def('护甲值', 'defineHeaderense_phy', Float);
soldiersTypeRule.def('生命值', 'hp_max', Float);
soldiersTypeRule.def('魔法值', 'mp_max', Float);
soldiersTypeRule.def('移动速度', 'ori_speed', RatiosFloat(0.01));
soldiersTypeRule.def('碰撞', 'dynamic_collision_r', RatiosFloat(0.02));
soldiersTypeRule.def('离地高度', 'model_height', RatiosFloat(0.01));
soldiersTypeRule.def('攻击类型', 'attack_type', Enum({
    '穿刺':10000,
    '法术':10001,
    '攻城':10002,
    '混乱':10003,
    '魔法':10004,
    '普通':10005,
    '国王':10006,
}));
soldiersTypeRule.def('护甲类型', 'armor_type', Enum({
    '轻甲':20000,
    '中甲':20001,
    '重甲':20002,
    '城甲':20003,
    '普通':20004,
    '魂甲':20005,
    '国王':20006,
    '无甲':20007,
    '虚无':20008,
    '王甲':20006,
}));
soldiersTypeRule.def('魔法恢复', 'mp_rec', Float);
soldiersTypeRule.def('动画状态机', 'anim_state_name', Str);
soldiersTypeRule.def('近战远程', -1, Str, AS('tags', AS('items')));
let taggsDeal = (obj, data)=>{
    if(obj.hasOwnProperty('items') && Array.isArray(obj['items'])){
        obj['items'].push(data);
    }
    return obj;
};
soldiersTypeRule.def('标签1', 'tags', Str, taggsDeal);
soldiersTypeRule.def('标签2', 'tags', Str, taggsDeal);
soldiersTypeRule.def('标签3', 'tags', Str, taggsDeal);
soldiersTypeRule.def('标签4', 'tags', Str, taggsDeal);

soldiersTypeRule.dataRehandle = (datas)=>{
    let data_tower = {};
    if(datas.hasOwnProperty('tower_id')){
        if(datas.hasOwnProperty('name')){
            data_tower['name'] = datas['name'];
        }
        if(datas.hasOwnProperty('icon')){
            data_tower['icon'] = datas['icon'];
        }
        if(datas.hasOwnProperty('model')){
            data_tower['model'] = datas['model'];
        }
        if(datas.hasOwnProperty('body_size')){
            data_tower['body_size'] = datas['body_size'];
        }
        if(datas.hasOwnProperty('defineHeaderense_phy')){
            data_tower['defineHeaderense_phy'] = datas['defineHeaderense_phy'];
        }
        if(datas.hasOwnProperty('hp_max')){
            data_tower['hp_max'] = datas['hp_max'];
        }
        if(datas.hasOwnProperty('mp_max')){
            data_tower['mp_max'] = datas['mp_max'];
        }
        if(datas.hasOwnProperty('ori_speed')){
            data_tower['ori_speed'] = datas['ori_speed'];
        }
        if(datas.hasOwnProperty('dynamic_collision_r')){
            data_tower['dynamic_collision_r'] = datas['dynamic_collision_r'];
        }
        if(datas.hasOwnProperty('model_height')){
            data_tower['model_height'] = datas['model_height'];
        }
        if(datas.hasOwnProperty('attack_type')){
            data_tower['attack_type'] = datas['attack_type'];
        }
        if(datas.hasOwnProperty('armor_type')){
            data_tower['armor_type'] = datas['armor_type'];
        }
        if(datas.hasOwnProperty('mp_rec')){
            data_tower['mp_rec'] = datas['mp_rec'];
        }
        if(datas.hasOwnProperty('anim_state_name')){
            data_tower['anim_state_name'] = datas['anim_state_name'];
        }
        if(datas.hasOwnProperty('tags')){
            data_tower['tags'] = datas['tags'];
        }
        let fight_id = datas['tower_id'];
        datas[fight_id.toString()] = data_tower;
    }
    return datas;
};