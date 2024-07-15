import { INDEX } from "./attrType";
import { Int, Str, Templete } from "./fieldTypes";
import * as constants from "../../constants";

export class ImportRule {
    public editorTableType: constants.Table.NameCN;
    public excelRelativePath?: string;
    public sheet?: string;
    public fieldDefs: {
        [key: string]: [string | string[] | number[], any, any];
    } = {};
    public filter: Function | undefined;
    public jumpHeader: number = 1;
    public dataRehandle: Function | undefined;

    constructor(
        editorTableType: constants.Table.NameCN,
        excelRelativePath?: string,
        sheetName?: string
    ) {
        this.editorTableType = editorTableType;
        this.excelRelativePath = excelRelativePath;
        this.sheet = sheetName;
    }
    public resetRule(
        editorTableType: constants.Table.NameCN,
        excelRelativePath?: string,
        sheetName?: string
    ) {
        this.editorTableType = editorTableType;
        this.excelRelativePath = excelRelativePath;
        this.sheet = sheetName;
    }

    public def(
        fieldName: string,
        filedKey: string | string[] | number[],
        fieldType: any,
        attrType: any
    ) {
        this.fieldDefs[fieldName] = [filedKey, fieldType, attrType];
    }

    public templateBy(fieldName: string) {
        this.fieldDefs[fieldName] = ["tmpid", Templete, null];
    }

    public indexBy(fieldName: string) {
        this.fieldDefs[fieldName] = ["uid", Str, INDEX];
    }

    public startBy(jumpHeader: number) {
        this.jumpHeader = jumpHeader;
    }

    public copyRule(): ImportRule {
        let new_rule = new ImportRule(
            this.editorTableType,
            this.excelRelativePath,
            this.sheet
        );
        new_rule.fieldDefs = this.fieldDefs;
        new_rule.filter = this.filter;
        new_rule.jumpHeader = this.jumpHeader;
        new_rule.dataRehandle = this.dataRehandle;
        return new_rule;
    }

    public deepCopy(obj: any): any {
        if (typeof obj !== "object" || obj === null) {
            return obj; // 如果是基本类型或者null，则直接返回
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => this.deepCopy(item)); // 如果是数组，递归调用deepCopy对数组中的每个元素进行深复制
        }

        // 如果是对象，则遍历对象的属性，对每个属性递归调用deepCopy进行深复制
        const newObj: { [key: string]: any } = {};
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                newObj[key] = this.deepCopy(obj[key]);
            }
        }
        return newObj;
    }
}
