export class ImportRule {

    /**
     * 物编数据所属的种类,总共可以填入以下几种类型：
     * 单位 装饰物 物品 技能 魔法效果 投射物 科技 可破坏物 声音
     * @type {string}
     */
    editorTableType;

    /**
     * 要导入的表格的相对于当前vscode工作区的路径
     * @type {string}
     */
    inputRelativePath;

    /**
     * 所属的工作表名
     * @type {string}
     */
    sheet;

    /**
     * 属性与Json字段的对应关系
     * @type {{ [key: string]: string }}
     */
    attrDef;

    /**
     * 请重写此方法以实现自定义转换规则
     * 返回值的对象需要包含'uid'字段，以确定物编项目的uid，以便本插件导入
     * @param {any}  row 表格中的一行 可以通过字段访问某一列数据 如 row['uid']
     * @returns {any} 此行被解析得到的Json对象 本插件会把它的属性覆盖到物编项目的Json 物编项目Json中的
     */
    rowImport(row) {
        throw new Error("您没有重写rowImport方法，ImportRule的子类必须重写此方法");
   };
}