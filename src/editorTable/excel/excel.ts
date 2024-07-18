import * as exceljs from 'exceljs';
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

type Cells = Record<string, string>;

export type Table = Record<string | number, Record<string, string>>;

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

    private guessTableOffset(): string | undefined {
        let rowPart: string | undefined;
        let colPart: string | undefined;
        let rowIndex = 0;
        let colIndex = 0;
        for (let i = 1; i <= this.sheet.columnCount; i++) {
            const col = this.sheet.getColumn(i);
            let count = 0;
            for (let j = 1; j <= this.sheet.rowCount; j++) {
                if (col.values[j]) {
                    count++;
                }
            }
            if (count * 2 > this.sheet.rowCount) {
                colPart = col.letter;
                colIndex = i;
                break;
            }
        }
        if (!colPart) {
            return undefined;
        }
        for (let i = 1; i <= this.sheet.rowCount; i++) {
            const row = this.sheet.getRow(i);
            let count = 0;
            for (let j = 1; j <= this.sheet.columnCount; j++) {
                if ((row.values as [])[j]) {
                    count++;
                }
            }
            if (count * 2 > this.sheet.columnCount) {
                rowPart = i.toString();
                rowIndex = i;
                break;
            }
        }
        if (!rowPart) {
            return undefined;
        }
        return colPart + rowPart;
    }

    /**
     * 已某个单元格为锚点，创建一个key-value的表格。
     * 如果不提供参数，会自动猜测一个合适的位置。
     * @param offset 锚点位置，如 `"B2"`
     */
    public makeTable(offset?: string): Table {
        if (!offset) {
            offset = this.guessTableOffset();
            if (!offset) {
                throw new Error('无法猜测出锚点位置，请手动指定锚点');
            }
        }
        const cell = this.sheet.getCell(offset);
        const row = cell.row as any as number;
        const col = cell.col as any as number;
        const titleRow = this.sheet.getRow(row);
        const titles: string[] = [];
        for (let c = col; c <= this.sheet.columnCount; c++) {
            const cell = titleRow.getCell(c);
            const title = cell.toString();
            titles[c] = title ? title : (cell.address.match(/[A-Z]+/)?.[0] ?? c.toString());
        }

        let table: Table = {};
        for (let r = row + 1; r <= this.sheet.rowCount; r++) {
            const row = this.sheet.getRow(r);
            const key = row.getCell(col).toString();
            if (!key) {
                continue;
            }
            table[key] = {};
            for (let c = col; c <= this.sheet.columnCount; c++) {
                const title = titles[c];
                table[key][title] = row.getCell(c).toString();
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
    private uri?: vscode.Uri;

    /**
     * 
     * @param fileUri 文件路径
     */
    async loadFile(fileUri: vscode.Uri): Promise<boolean> {
        if (this.uri) {
            return false;
        }
        let file = await y3.fs.readFile(fileUri)
                ?? await y3.fs.readFile(vscode.Uri.parse(fileUri.toString() + '.xlsx'));
        if (!file) {
            return false;
        }
        await this.workbook.xlsx.load(file.buffer);
        this.uri = fileUri;
        return true;
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
