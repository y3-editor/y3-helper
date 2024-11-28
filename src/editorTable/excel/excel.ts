import * as exceljs from 'exceljs';
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

type Cells = Record<string, string>;
type TableKey = string | number;
export type Table = Record<TableKey, Record<string, string>>;
export type MultiTable = Record<TableKey, Record<string, string>[]>;

export class Sheet {
    name: string;
    id: number;
    constructor(private sheet: exceljs.Worksheet) {
        this.name = sheet.name;
        this.id = sheet.id;
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
        const colCount = this.sheet.actualColumnCount;
        const rowCount = this.sheet.actualRowCount;
        for (let i = 1; i <= colCount; i++) {
            const col = this.sheet.getColumn(i);
            let count = col.values.length;
            if (count * 4 > rowCount) {
                colPart = col.letter;
                break;
            }
        }
        if (!colPart) {
            return undefined;
        }
        for (let i = 1; i <= rowCount; i++) {
            const row = this.sheet.getRow(i);
            let count = (row.values as []).length;
            if (count * 2 > colCount) {
                rowPart = i.toString();
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
     * @param skip 标题下额外跳过的行数（可能是标题的描述）
     */
    public makeTable(offset?: string, skip?: number): Table {
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
        const colCount = this.sheet.actualColumnCount;
        const rowCount = this.sheet.actualRowCount;
        for (let c = col; c <= colCount; c++) {
            const cell = titleRow.getCell(c);
            const title = cell.toString();
            titles[c] = title ? title : (cell.address.match(/[A-Z]+/)?.[0] ?? c.toString());
        }

        let table: Table = {};
        for (let r = row + 1 + (skip ?? 0); r <= rowCount; r++) {
            const row = this.sheet.getRow(r);
            const key = row.getCell(col).toString();
            if (!key) {
                continue;
            }
            table[key] = {};
            for (let c = col; c <= colCount; c++) {
                const title = titles[c];
                table[key][title] = row.getCell(c).toString();
            }
        }

        return table;
    }

    
    /**
     * 已某个单元格为锚点，创建一个key-value[]的多维表格。
     * 与 `makeTable` 不同，可以一个对象可以保存多行的数据。
     * 如果不提供参数，会自动猜测一个合适的位置。
     * @param offset 锚点位置，如 `"B2"`
     * @param skip 标题下额外跳过的行数（可能是标题的描述）
     */
    public makeMultiTable(offset?: string, skip?: number): MultiTable {
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
        const colCount = this.sheet.actualColumnCount;
        const rowCount = this.sheet.actualRowCount;
        for (let c = col; c <= colCount; c++) {
            const cell = titleRow.getCell(c);
            const title = cell.toString();
            titles[c] = title ? title : (cell.address.match(/[A-Z]+/)?.[0] ?? c.toString());
        }

        let table: MultiTable = {};
        let current: Record<string, string>[] | undefined;

        const mergeIntoCurrent = (row: exceljs.Row) => {
            if (!current) {
                return;
            }
            let record: Record<string, string> = {};
            current.push(record);
            for (let c = col; c <= colCount; c++) {
                const title = titles[c];
                record[title] = row.getCell(c).toString();
            }
        };

        for (let r = row + 1 + (skip ?? 0); r <= rowCount; r++) {
            const row = this.sheet.getRow(r);
            const key = row.getCell(col).toString();
            if (key) {
                current = [];
                table[key] = current;
            }
            mergeIntoCurrent(row);
        }

        return table;
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
    public getSheet(indexOrName?: number | string) {
        const sheet = this.workbook.getWorksheet(indexOrName);
        if (!sheet) {
            return undefined;
        }
        return this.proxySheet[sheet.id] ??= new Sheet(sheet);
    }

    public getAllSheets(): Sheet[] {
        this.workbook.worksheets.forEach((sheet) => {
            this.proxySheet[sheet.id] ??= new Sheet(sheet);
        });
        return Object.values(this.proxySheet);
    }
}
