/**
 * 导入规则的数组，放入此数组的导入规则才会被应用
 */
import { ImportRule } from './importRule.mjs';
export const importRules = [];

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
    attrDef;

    /**
     * 请重写此方法以实现自定义转换规则 
     * 返回值的对象需要包含'uid'字段，以确定物编项目的uid，以便本插件导入
     * @param row 表格中的一行
     * @returns 此行被解析得到的Json对象 本插件会把它的属性覆盖到物编项目的Json 物编项目Json中的
     */
    rowImport(row) {
        let res={};
        res['uid'] = row['uid'];
    }
}

/**
 * 必须添加到此数组中 才能生效
 */
importRules.push(new UnitImportRule());