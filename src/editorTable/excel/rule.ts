import * as excel from './excel';
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

interface ReaderLike<T> {
    (row: Record<string, string>): T | undefined;
}

function mergeObject(from: Record<string, any>, to: Record<string, any>) {
    for (let key in from) {
        if (typeof from[key] === 'object' && from[key] !== null ) {
            if (to[key] === undefined) {
                to[key] = {};
            }
            if (to[key] === null || typeof to[key] !== 'object') {
                continue;
            }
            mergeObject(from[key], to[key]);
        } else {
            to[key] ??= from[key];
        }
    }
}

class ReaderRule<T> {
    constructor(private callback: ReaderLike<T>) {
    }

    public call(row: Record<string, string>): T | undefined {
        let value = this.callback(row);
        if (
            value === undefined ||
            value === null ||
            value === '' ||
            (typeof value === 'number' && isNaN(value))
        ) {
            value = this._default;
        }
        if (
            typeof this._default === 'object' &&
            typeof value === 'object' &&
            this._default !== value &&
            this._default !== null &&
            value !== null
        ) {
            mergeObject(this._default, value);
        }
        if (this._finally) {
            value = this._finally(value);
        }
        return value;
    }

    private _default?: T;
    /**
     * 如果值为 `undefined`，则使用此默认值。
     * @param value 默认值。
     * @returns 
     */
    public default(value?: T) {
        this._default = value;
        return this;
    }

    private _finally?: (value?: T) => T;
    /**
     * 对数据进行最后的处理。
     * @param callback 处理函数。
     * @returns 
     */
    public finally(callback: (value?: T) => T) {
        this._finally = callback;
        return this;
    }
}

const reader = {
    /**
     * excel的每一行都会调用此回调哈数，你需要返回最终写入表中的值。
     * 返回 `undefined` 时表示不做修改（使用物编里原来的值）。
     * @param callback 一个回调函数，需要你返回最终写入表中的值。
     * @returns 
     */
    rule: <T>(callback: ReaderLike<T>): ReaderRule<T> => new ReaderRule(callback),
    /**
     * 将值视为数字。
     * @param title 列标题
     * @param defaultValue 默认值，如果不传表示不做修改（使用物编里原来的值）。
     * @returns 
     */
    number: (title: string, defaultValue?: number) => {
        return new ReaderRule<number>((row) => parseFloat(row[title])).default(defaultValue);
    },
    /**
     * 将值视为数组。如果设置了 `default`，则会用默认值填充数组。
     * @param title 列标题
     * @param separator 分割符
     * @param converter 数组中的每一项还会调用此函数再转换一次
     * @returns 
     */
    split: <T = string>(title: string, separator: string | RegExp, converter?: (value: string) => T) => {
        let rule = new ReaderRule<T[]>((row) => {
            if (!row[title]) {
                return undefined;
            }
            let array: any[] = row[title].split(separator);
            if (converter) {
                return array.map(converter);
            }
            return array;
        });
        return rule;
    }
} as const;

type Reader<T> = string | undefined | ReaderLike<T> | ReaderRule<T>;

type RuleData<N extends y3.const.Table.NameCN> = {
    [key in keyof y3.table.EditorData<N>]: Reader<y3.table.EditorData<N>[key]>;
};

type Action<N extends y3.const.Table.NameCN> = {
    field: keyof RuleData<N>,
    reader: Reader<any>,
};

export class Rule<N extends y3.const.Table.NameCN> {
    public rule = this;

    /**
     * 用于转换字段的数据。
     */
    public reader = reader;

    private _actions: Action<N>[] = [];
    /**
     * 描述字段从表里的哪些列获取数据。
     */
    public data: RuleData<N> = new Proxy({}, {
        set: (target, key, value) => {
            this._actions.push({ field: key as any, reader: value });
            return false;
        },
        get: (target, key) => {
            return key;
        },
    }) as any;

    constructor(public tableName: N, public path: vscode.Uri, public sheetName?: number | string) {
    }

    /**
     * 表格中的偏移量，如 `A1`、`B2` 等。如果不提供会尝试自动查找。
     */
    public offset?: string;

    /**
     * 对象的key在表格中的列名。如果不提供会使用第一列。
     * 如果不存在会新建。
     */
    public key?: string;

    /**
     * 对象从哪个模板上继承。如果不提供，或是与`key`相同则使用默认模板。
     */
    public template?: string;

    /**
     * 立即执行规则。一般来说你不需要调用，会在当前插件执行完后自动调用。
     */
    public async apply() {
        let fileName = this.path.path.match(/([^/\\]+)$/)?.[1] ?? this.path.fsPath;
        fileName = fileName.replace(/\.[^.]+$/, '');
        const ruleName = `${this.tableName}: ${fileName}/${this.sheetName ?? 1}`;
        y3.log.info(`正在执行规则："${ruleName}"`);
        try {
            let sheet = await y3.excel.loadFile(this.path, this.sheetName);
            let sheetTable = sheet.makeTable();
            let editorTable = y3.table.openTable(this.tableName);

            for (let firstCol in sheetTable) {
                let row = sheetTable[firstCol];
                let key = this.key ? this.getValue(row, this.key) : firstCol;
                let template = this.template ? this.getValue(row, this.template) : undefined;
                let objectKey = Number(key);
                let templateKey: number | undefined = Number(template);
                if (isNaN(objectKey)) {
                    throw new Error(`对象的 key(${this.key ?? '<第一列>'}) 不是数字：${key}`);
                }
                if (templateKey === objectKey || !templateKey) {
                    templateKey = undefined;
                }

                let editorObject = await editorTable.get(objectKey)
                                ?? await editorTable.create({
                                    key: objectKey,
                                    overwrite: true,
                                    copyFrom: templateKey,
                                });
                if (!editorObject) {
                    throw new Error(`创建对象失败：${objectKey}`);
                }

                for (const action of this.rule._actions) {
                    let value = this.getValue(row, action.reader);
                    if (value === undefined) {
                        continue;
                    }
                    editorObject.set(action.field as string, value, true);
                }
            }
        } catch (e) {
            y3.log.error(`执行规则失败："${ruleName}"\n${e}`);
            vscode.window.showErrorMessage(`执行规则失败："${ruleName}"\n${e}`);
        }
    }

    private getValue(row: Record<string, string>, value: Reader<any>): any {
        if (typeof value === 'string') {
            return row[value];
        }
        if (typeof value === 'function') {
            return value(row);
        }
        if (value instanceof ReaderRule) {
            return value.call(row);
        }
        throw new Error('未知的值类型: ' + String(value));
    }
}
