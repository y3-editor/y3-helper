import { Int, Str, Bool, Float, List, Tuple, Templete, Enum, RatiosInt, RatiosFloat } from '../../../out/editorTable/EXCEL/fieldTypes.js';
import {REQUIRED, IGNORE, AS, INDEX } from '../../../out/editorTable/EXCEL/attrType.js';
import { ImportRule } from '../../../out/editorTable/EXCEL/importRule.js';

export const towerRule = new ImportRule('单位', './塔表.xlsx', '静态表');
towerRule.filter = (row)=>{
    if(row[0] === '#'){
        return false;
    }
};
towerRule.startBy(2);
towerRule.indexBy('编号');
towerRule.templateBy('模板ID');
towerRule.def('名称', 'name', Str);
towerRule.def('后缀', 'suffix', Str);
towerRule.def('黄金', 1, Int, AS('build_res_cost_list', AS(0)));
let gold_dealer = (obj, data)=>{
    if(Array.isArray(obj) && Array.isArray(obj[1])){
        obj[1][1] = data;
    }
    return obj;
};
towerRule.def('木头', 'build_res_cost_list', Int, gold_dealer);
towerRule.def('人口', 'build_res_cost_list', Int, (obj, data)=>{
    if(Array.isArray(obj) && Array.isArray(obj[1])){
        obj[2][1] = data;
    }
    return obj;
});
towerRule.def('时间', 'build_time', Str);
towerRule.dataRehandle = (rowData)=>{};



export const heroRule = new ImportRule('单位', './英雄表.xlsx', '静态表');
heroRule.startBy(3);
heroRule.filter = (row)=>{
    if(row[0] === '#'){return false;}
};
heroRule.indexBy('塔编号');
heroRule.templateBy('模板ID');
heroRule.def('名称', 'name', Str);
heroRule.def('塔后缀', 'tower_suffix', Str);
heroRule.def('黄金', 'war3_gold', Int(1));
heroRule.def('木头', 'war3_lumber', Int);
heroRule.def('人口', 'population_capacity', Int);
heroRule.def('图标', 'icon', Int);
heroRule.def('模型', 'model', (data)=>{
    if(typeof data === 'number'){
        data = Math.floor(data);
    }else if(typeof data === 'string'){
        if(data === ''){
            return null;
        }
        data = parseInt(data);
    }
    return data;
});
heroRule.def('缩放', 'body_size', Float);
heroRule.def('战斗编号', 'fight_id', Int);
heroRule.def('战兵后缀', 'warhead_suffix', Str);

heroRule.def('种族', 'racist', Enum({
    '地精' : 10,
    '森林' : 3,
    '海洋' : 8,
    '机甲' : 2,
    '黑暗' : 5,
    '精灵' : 12,
}));

/*提供了自定义修改每一行数据的功能，入下列例子中会把一行的某些字段拆出来写到另一个物编数据中 */
heroRule.dataRehandle = (rowData)=>{
    let data_tower = {};
    if(rowData.hasOwnProperty('fight_id')){
        let fight_id = rowData['fight_id'];
        data_tower['uid'] = fight_id.toString();
        if(rowData.hasOwnProperty('name')){
            data_tower['name'] = rowData['name'];
        }
        if(rowData.hasOwnProperty('icon')){
            data_tower['icon'] = rowData['icon'];
        }
        if(rowData.hasOwnProperty('model')){
            data_tower['model'] = rowData['model'];
        }
        if(rowData.hasOwnProperty('body_size')){
            data_tower['body_size'] = rowData['body_size'];
        }
        if(rowData.hasOwnProperty('warhead_suffix')){
            data_tower['suffix'] = rowData['warhead_suffix'];
            delete rowData['warhead_suffix'];
        }
        if(rowData.hasOwnProperty('tower_suffix')){
            rowData['suffix'] = rowData['tower_suffix'];
            delete rowData['tower_suffix'];
        }
        if(rowData.hasOwnProperty('build_res_cost_list') && Array.isArray(rowData['build_res_cost_list']) 
            && Array.isArray(rowData['build_res_cost_list'][1])){
                if(rowData.hasOwnProperty('war3_gold')){
                    rowData['build_res_cost_list'][1][1] = rowData['war3_gold'];
                }
                if(rowData.hasOwnProperty('war3_lumber')){
                    rowData['build_res_cost_list'][1][1] = rowData['war3_lumber'];
                }
                if(rowData.hasOwnProperty('population_capacity')){
                    rowData['build_res_cost_list'][1][1] = rowData['population_capacity'];
                }
        }
    }
    return [rowData, data_tower];
};

