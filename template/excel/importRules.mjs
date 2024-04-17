/**
 * 导入规则的数组，放入此数组的导入规则才会被应用
 * 用户请参考以下给出的UnitImportRule和ItemImportRule的代码示例，自定义出自己想要的导入规则
 */
import { ImportRule } from './importRule.mjs';
export const importRules = [];// 自定义规则后必须实例化并放入此数组

class UnitImportRule extends ImportRule {
    /**
     * 物编数据所属的种类,总共可以填入以下几种类型：
     * 单位 装饰物 物品 技能 魔法效果 投射物 科技 可破坏物 声音
     */
    editorTableType='单位';

    /**
     * 要导入的表格的相对于当前此importRules.mjs文件所在文件夹的路径
     */
    excelRelativePath='./editorTableData.xlsx';

    /**
     * 所属的工作表名
     */
    sheet ='单位';

    /**
     * 属性与Json字段的对应关系
     */
    attrDef = { 'UID':'uid','名称':'name','菲涅尔颜色':'fresnel_color','简易普攻.攻击点':'simple_common_atk.ability_bw_point'};

    /**
     * 自定义属性 请把您自定义的属性名称放到这个列表中
     */
    custormAttr=["自定义属性1","自定义属性2"];

    /**
     * 请重写此方法以实现自定义转换规则 
     * 返回值的对象需要包含'uid'字段，以确定物编项目的uid，以便本插件导入
     * @param row 表格中的一行
     * @returns 此行被解析得到的Json对象 本插件会把它的属性覆盖到物编项目的Json 物编项目Json中的
     */
    rowImport(row) {
        let res = {};
        for (let k in this.attrDef) {
            let attr = this.attrDef[k];
            if (row[k] !== undefined) {
                res[attr] = row[k];
            }
        }
        return res;
    }
}
class ItemImportRule extends ImportRule {
    /**
     * 物编数据所属的种类,总共可以填入以下几种类型：
     * 单位 装饰物 物品 技能 魔法效果 投射物 科技 可破坏物 声音
     */
    editorTableType='物品';

    /**
     * 要导入的表格的相对于当前此importRules.mjs文件所在文件夹的路径
     */
    excelRelativePath='./editorTableData.xlsx';

    /**
     * 所属的工作表名
     */
    sheet ='物品';

    /**
     * 属性与Json字段的对应关系
     */
    attrDef = { 'UID': 'uid', '名称': 'name', '掉落后时间到期自动消失': 'delete_on_discard' };
    
    /**
     * 自定义属性 请把您自定义的属性名称放到这个列表中
     */
    custormAttr=["自定义属性1","自定义属性2"];
    
    /**
     * 请重写此方法以实现自定义转换规则 
     * 返回值的对象需要包含'uid'字段，以确定物编项目的uid，以便本插件导入
     * @param row 表格中的一行
     * @returns 此行被解析得到的Json对象 本插件会把它的属性覆盖到物编项目的Json 物编项目Json中的
     */
    rowImport(row) {
        let res = {};
        for (let k in this.attrDef) {
            let attr = this.attrDef[k];
            if (row[k] !== undefined) {
                res[attr] = row[k];
            }
        }
        return res;
    }
}
/**
 * 必须添加到此数组中 才能生效
 */
importRules.push(new UnitImportRule());
importRules.push(new ItemImportRule());