import * as exceljs from 'exceljs';
import * as vscode from 'vscode';

type Cells = Record<string, string>;

type Table = Record<string | number, Record<string, string>>;

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
                return this.sheet.findCell(key, undefined!)?.toString() ?? '';
            },
        });
    }

    /**
     * 已某个单元格为锚点，创建一个key-value的表格
     * @param offset 锚点位置
     */
    public makeTable(offset: string) {
        const cell = this.sheet.getCell(offset);
        const row = cell.row as any as number;
        const col = cell.col as any as number;
        const titleRow = this.sheet.getRow(row);
        const titles: string[] = [];
        for (let c = col + 1; c <= this.sheet.columnCount; c++) {
            const cell = titleRow.getCell(c);
            const title = cell?.toString();
            titles[c] = title ? title : (cell.address.match(/[A-Z]+/)?.[0] ?? c.toString());
        }

        let table: Table = {};
        for (let r = row + 1; r <= this.sheet.rowCount; r++) {
            const row = this.sheet.getRow(r);
            const key = row.getCell(col)?.toString();
            if (!key) {
                continue;
            }
            table[key] = {};
            for (let c = col + 1; c <= this.sheet.columnCount; c++) {
                const title = titles[c];
                table[key][title] = row.getCell(c)?.toString();
            }
        }

        return new Proxy(table, {
            set: () => {
                throw new Error('这是只读表！');
            },
            get: (target, key) => {
                if (typeof key === 'symbol') {
                    return {};
                }
                return target[key] ?? {};
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
