import * as excel from './excel';
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

const as = {

};

type As<T> = string | (() => T);

type RuleData<N extends y3.const.Table.NameCN> = {
    [key in keyof y3.table.EditorData<N>]: As<y3.table.EditorData<N>[key]>;
};

export class Rule<N extends y3.const.Table.NameCN> {
    public rule = this;
    public as = as;
    public data: RuleData<N> = {} as any;

    constructor(public tableName: N, public path: vscode.Uri, public sheetName?: number | string) {
    }

    /**
     * 表格中的偏移量，如 `A1`、`B2` 等。如果不提供会尝试自动查找。
     */
    public offset?: string;

    /**
     * 对象的key在表格中的列名。如果不提供会使用第一列。
     */
    public key?: string;

    /**
     * 立即执行规则。一般来说你不需要调用，会在当前插件执行完后自动调用。
     */
    public async apply() {
        const fileName = this.path.path.match(/([^/\\]+)\.json$/)?.[1] ?? this.path.fsPath;
        const ruleName = `${this.tableName} - ${fileName}/${this.sheetName ?? 1}`;
        y3.log.info(`正在执行规则：${ruleName}`);
        try {
            if (!this.key) {
                throw new Error('必须先设置 rule.key');
            }
            let sheet = await y3.excel.loadFile(this.path, this.sheetName);
            let sheetTable = sheet.makeTable();
            let editorTable = y3.table.openTable(this.tableName);

            for (let firstCol in sheetTable) {
                let row = sheetTable[firstCol];
                let key = this.getValue(row, this.key ?? firstCol);
                let objectKey = Number(key);
                if (isNaN(objectKey)) {
                    throw new Error(`对象的 key(${this.key ?? firstCol}) 不是数字：${key}`);
                }
                let editorObject = await editorTable.create({
                    key: objectKey,
                    overwrite: true,
                });
                if (!editorObject) {
                    throw new Error(`创建对象失败：${objectKey}`);
                }

                for (const field in this.rule.data) {
                    const col = this.rule.data[field];
                    let value = this.getValue(row, col);
                    editorObject.data[field] = value;
                }
            }
        } catch (e) {
            y3.log.error(`执行规则失败：${ruleName}\n${e}`);
            vscode.window.showErrorMessage(`执行规则失败：${ruleName}\n${e}`);
        }
    }

    private getValue(row: Record<string, string>, value: As<any>): any {
        if (typeof value === 'string') {
            return row[value];
        }
        return '';
    }
}
