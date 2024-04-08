
/**
 * 请勿改动此文件！ 请勿改动此文件！ 请勿改动此文件！
 * 自定义导表规则请在importRules.mjs中继承ImportRule导入规则类，以实现自定义的导入规则并把它push放入importRules数组
 * 本插件会在运行时按顺序执行importRules数组中的每一个导入规则
 * 注意请勿随意改动ImportRule抽象类，否则可能导致插件运行失败
 */
export abstract class ImportRule {

    /**
     * 物编数据所属的种类,总共可以填入以下几种类型：
     * 单位 装饰物 物品 技能 魔法效果 投射物 科技 可破坏物 声音
     */
    public abstract editorTableType: string;

    /**
     * 要导入的表格的相对于当前vscode工作区的路径
     */
    public abstract excelRelativePath: string;

    /**
     * 所属的工作表名
     */
    public abstract sheet: string;

    /**
     * 属性与Json字段的对应关系
     */
    public abstract attrDef: { [key: string]: string };

    /**
     * 请重写此方法以实现自定义转换规则
     * 返回值的对象需要包含'uid'字段，以确定物编项目的uid，以便本插件导入
     * @param row 表格中的一行
     * @returns 此行被解析得到的Json对象 本插件会把它的属性覆盖到物编项目的Json 物编项目Json中的
     */
    public abstract rowImport(row: any): any;
}