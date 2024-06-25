import { Int, Str, Bool, Float, List, Tuple, Templete, Enum, RatiosInt, RatiosFloat } from '../../../out/editorTable/EXCEL/fieldTypes.js';
import {REQUIRED, IGNORE, AS, INDEX } from '../../../out/editorTable/EXCEL/attrType.js';
import { ImportRule } from '../../../out/editorTable/EXCEL/importRule.js';

export const soldiersSkillCorrelatSoldierRule = new ImportRule('单位', './兵种技能关联表.xlsx', 'Sheet1');
soldiersSkillCorrelatSoldierRule.startBy(2);
soldiersSkillCorrelatSoldierRule.filter = (row)=>{
    if(row[0] === '#'){return false;}
};
soldiersSkillCorrelatSoldierRule.indexBy('战兵编号');
soldiersSkillCorrelatSoldierRule.templateBy('战兵编号');
soldiersSkillCorrelatSoldierRule.def('技能信息', 'common_ability_list', List('_', Int), (obj, data)=>{
    if(Array.isArray(obj)){
        obj.push(data);
    }
    return obj;
});

export const soldiersSkillCorrelatTowerRule = new ImportRule('单位', './兵种技能关联表.xlsx', 'Sheet1');
soldiersSkillCorrelatTowerRule.filter = (row)=>{
    if(row[0] === '#'){return false;}
};
soldiersSkillCorrelatTowerRule.startBy(2);
soldiersSkillCorrelatTowerRule.indexBy('塔编号');
soldiersSkillCorrelatTowerRule.templateBy('塔编号');
soldiersSkillCorrelatTowerRule.def('技能信息', 'passive_ability_list', List('_', Int), (obj, data)=>{
    if(Array.isArray(obj)){
        obj.push(data);
    }
    return obj;
});

export const towerUpdateRule = new ImportRule('单位', './塔升级表.xlsx', '静态表');
towerUpdateRule.startBy(2);
towerUpdateRule.filter = (row)=>{
    if(row[0] === '#'){return false;}
};
towerUpdateRule.indexBy('原始塔');
towerUpdateRule.templateBy('原始塔');
towerUpdateRule.def('目标塔', 'build_upgrade_list', Int, (obj, data)=>{
    if(Array.isArray(obj)){
        obj.push(data);
    }
    return obj;
});
towerUpdateRule.def('合成技能', 'common_ability_list', List('_', Int), (obj, data)=>{
    if(Array.isArray(obj)){
        obj.push(data);
    }
    return obj;
});