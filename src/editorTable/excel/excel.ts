import * as exceljs from 'exceljs';
import * as vscode from 'vscode';

type Upper = Uppercase<string>;
type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type CellKey = `${Upper}${Digit}`;
type Cells = Record<CellKey, string | undefined>;

export class Sheet {
    constructor(private sheet: exceljs.Worksheet) {
    }

    private _cells?: Cells;

    /**
     * 存放所有的单元格，使用 `sheet.cells['A1']` 来获取单元格的值
     */
    get cells(): Cells {
        return this._cells ??= this.createCells();
    }

    private createCells() {
        return new Proxy({}, {
            set: () => {
                throw new Error('不允许修改excel！');
            },
            get: (target, key) => {
                if (typeof key !== 'string') {
                    return undefined;
                }
                return this.sheet.findCell(key, undefined!)?.value?.toString();
            },
            has: (target, p) => {
                if (typeof p !== 'string') {
                    return false;
                }
                return this.sheet.findCell(p, undefined!) !== undefined;
            },
        });
    }
}

export class Excel {
    private workbook = new exceljs.Workbook();

    /**
     * 
     * @param fileUri 文件路径
     */
    async loadFile(fileUri: vscode.Uri) {
        await this.workbook.xlsx.readFile(fileUri.fsPath);
    }

    private proxySheet: Record<number, Sheet> = {};

    /**
     * 获取指定的sheet
     * @param indexOrName sheet的索引或名称
     */
    public getSheet(indexOrName: number | string) {
        const sheet = this.workbook.getWorksheet(indexOrName);
        if (!sheet) {
            return undefined;
        }
        return this.proxySheet[sheet.id] ??= new Sheet(sheet);
    }
}
