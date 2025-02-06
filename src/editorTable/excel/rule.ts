import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

const l10n = vscode.l10n;

type Row = Record<string, string>;

/**
 * 读取excel中的值。
 * @param rows excel中的每个对象的数据。
 * @returns 返回需要写入表中的值。
 */
type ReaderFunc<T> = (...rows: Row[]) => NoInfer<T> | undefined;

/**
 * 对数据进行处理。
 * @param content excel中的值
 * @param source 物编中的值。如果你用def修改过，这里会传入修改后的值（用于多个项目修改同一个值）。
 */
type AsFunc<T> = (content: string, source?: T, ...extraContents: string[]) => NoInfer<T> | undefined;

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

class AsRule<T> {
    constructor(private as?: As<T>) {}

    protected value: any;
    applyAs(content: any, source?: T, ...extraContents: any[]): T | undefined {
        let value = this.as ? callAs(this.as, content, source, ...extraContents) : content;
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

class ReaderRule<T> extends AsRule<T> {
    constructor(private reader: ReaderFunc<T>, as?: As<T>) {
        super(as);
    }

    public applyReader(rows: Row | Row[], source?: T): T | undefined {
        if (Array.isArray(rows)) {
            return this.applyAs(this.reader(...rows), source, ...rows.slice(1));
        } else {
            return this.applyAs(this.reader(rows), source);
        }
    }
}

function callAs(as: As<any>, value: any, source?: any, ...extraValues: any[]) {
    if (as instanceof AsRule) {
        return as.applyAs(value, source, ...extraValues);
    }
    return as(value, source, ...extraValues);
}

const braver = {
    boolean: (value: string) => {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        return !!value;
    },
    split: (value: string, separator: string | RegExp, converter?: As<any>) => {
        let array: any[] = value.split(separator);
        if (converter) {
            return array.map((item, index) => {
                return callAs(converter, item, array[index]);
            });
        }
        return array;
    },
} as const;

const as = {
    /**
     * 将值视为数字。
     * @param value 值
     * @param defaultValue 默认值，如果不传表示不做修改（使用物编里原来的值）。
     * @returns
     */
    number: (defaultValue?: number) => {
        return new AsRule<number>((value) => parseFloat(value)).default(defaultValue);
    },
    /**
     * 将值视为整数
     */
    integer: (defaultValue?: number) => {
        return new AsRule<number>((value) => parseInt(value)).default(defaultValue);
    },
    /**
     * 将值视为字符串。
     * @param value 值
     * @param defaultValue 默认值，如果不传表示不做修改（使用物编里原来的值）。
     * @returns
     */
    string: (defaultValue?: string) => {
        return new AsRule<string>((value) => value).default(defaultValue);
    },
    /**
     * 将值视为布尔值。
     * @param value 值
     * @param defaultValue 默认值，如果不传表示不做修改（使用物编里原来的值）。
     * @returns
     */
    boolean: (defaultValue?: boolean) => {
        return new AsRule<boolean>(braver.boolean).default(defaultValue);
    },
    /**
     * 将值视为数组。如果设置了 `default`，则会用默认值填充数组。
     * @param title 列标题
     * @param separator 分割符
     * @param converter 数组中的每一项还会调用此函数再转换一次
     * @returns 
     */
    split: <T = string>(separator: string | RegExp, converter?: (value: string) => T) => {
        let rule = new AsRule<T[]>((value) => braver.split(value, separator, converter));
        return rule;
    },
} as const;

const reader = {
    /**
     * excel的每一个对象都会调用此回调哈数，你需要返回最终写入表中的值。
     * 返回 `undefined` 时表示不做修改（使用物编里原来的值）。
     * @param callback 一个回调函数，需要你返回最终写入表中的值。
     * @returns 
     */
    rule: <T>(callback: ReaderFunc<T>): ReaderRule<T> => new ReaderRule(callback),
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
     * 将值视为整数。
     */
    integer: (title: string, defaultValue?: number) => {
        return new ReaderRule<number>((row) => parseInt(row[title])).default(defaultValue);
    },
    /**
     * 将值视为布尔值。
     * @param title 列标题
     * @param defaultValue 默认值，如果不传表示不做修改（使用物编里原来的值）。
     * @returns 
     */
    boolean: (title: string, defaultValue?: boolean) => {
        return new ReaderRule<boolean>((row) => braver.boolean(row[title])).default(defaultValue);
    },
    /**
     * 将值视为数组。如果设置了 `default`，则会用默认值填充数组。
     * @param title 列标题
     * @param separator 分割符
     * @param converter 数组中的每一项还会调用此函数再转换一次
     * @returns 
     */
    string: (title: string, defaultValue?: string) => {
        return new ReaderRule<string>((row) => row[title]).default(defaultValue);
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
            return braver.split(row[title], separator, converter);
        });
        return rule;
    }
} as const;

type Reader<T> = string | undefined | ReaderFunc<T> | ReaderRule<T>;

type As<T> = AsFunc<T> | AsRule<T>;


type EditorDataField<N extends y3.consts.Table.NameCN> = keyof y3.table.EditorData<N>;
type EditorDataFieldType<N extends y3.consts.Table.NameCN, F extends EditorDataField<N>> = y3.table.EditorData<N>[F];

type RuleData<N extends y3.consts.Table.NameCN> = {
    [key in EditorDataField<N>]: Reader<EditorDataFieldType<N, key>>;
};

type RuleField<N extends y3.consts.Table.NameCN> = {
    [key in EditorDataField<N>]: key;
};

type Action<N extends y3.consts.Table.NameCN> = {
    field: keyof RuleData<N>,
    action: Reader<any>,
    asRule?: AsRule<any>,
};

export class Rule<N extends y3.consts.Table.NameCN> {
    public rule = this;

    /**
     * excel的字段读取器。
     */
    public reader = reader;
    /**
     * 数据转换器
     */
    public as = as;

    private _actions: Action<N>[] = [];
    /**
     * 描述字段从表里的哪些列获取数据。
     */
    public data: RuleData<N> = new Proxy({}, {
        set: (target, key, value) => {
            this._actions.push({ field: key as any, action: value });
            return false;
        },
    }) as any;
    public field: RuleField<N> = new Proxy({}, {
        get (target, key) {
            return key;
        }
    }) as any;

    constructor(public tableName: N, public path: vscode.Uri, public sheetName?: number | string) {
    }

    /**
     * 表格中的偏移量，如 `A1`、`B2` 等。如果不提供会尝试自动查找。
     */
    public offset?: string;

    /**
     * 要跳过多少行。如果标题下一行是描述，可以将此设置为 `1`。
     */
    public skip?: number;

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
     * 是否强制创建对象。默认情况下会优先使用已有对象，保留对象已有的数据。
     */
    public overwrite?: boolean;

    /**
     * 是否是多维表。
     */
    public multi?: boolean;

    /**
     * 定义一个根据excel字段的生成规则
     * @param title excel中的列标题
     * @param field 物编中的字段
     * @param as 数据转换器
     */
    public def<F extends EditorDataField<N>>(title: string, field: F, as?: As<EditorDataFieldType<N, F>>) {
        this._actions.push({
            field,
            action: new ReaderRule((row) => row[title] as any, as),
        });
    }

    /**
     * 立即执行规则。一般来说你不需要调用，会在当前插件执行完后自动调用。
     */
    public async apply() {
        let fileName = this.path.path.match(/([^/\\]+)$/)?.[1] ?? this.path.fsPath;
        const ruleName = `${this.tableName}: ${fileName}@${this.sheetName ?? 1}`;
        y3.log.info(l10n.t('正在执行规则："{0}"', ruleName));
        try {
            let sheet = await y3.excel.loadFile(this.path, this.sheetName);
            let sheetTable = this.multi ? sheet.makeMultiTable(this.offset, this.skip) : sheet.makeTable(this.offset, this.skip);
            let editorTable = y3.table.openTable(this.tableName);

            for (let firstCol in sheetTable) {
                let rows = sheetTable[firstCol];
                let key = this.key ? this.getValue(rows, this.key) : firstCol;
                let template = this.template ? this.getValue(rows, this.template) : undefined;
                let objectKey = Number(key);
                let templateKey: number | undefined = Number(template);
                if (isNaN(objectKey)) {
                    throw new Error(l10n.t('对象的 key({0}) 不是数字：{1}', this.key ?? l10n.t('<第一列>'), key));
                }
                if (templateKey === objectKey || !templateKey) {
                    templateKey = undefined;
                }

                let editorObject = this.overwrite ? undefined : await editorTable.get(objectKey);
                editorObject ??= await editorTable.create({
                                    key: objectKey,
                                    overwrite: true,
                                    copyFrom: templateKey,
                                });
                if (!editorObject) {
                    throw new Error(l10n.t('创建对象失败：{0}', objectKey));
                }

                for (const action of this.rule._actions) {
                    let value = this.getValue(rows, action.action, editorObject.data[action.field]);
                    if (action.asRule) {
                        value = callAs(action.asRule, value, editorObject.data[action.field]);
                    }
                    if (value === undefined) {
                        continue;
                    }
                    editorObject.set(action.field as string, value, true);
                }
            }
        } catch (e) {
            y3.log.error(l10n.t('执行规则失败："{0}"\n{1}', ruleName, String((e as Error)?.stack)));
            vscode.window.showErrorMessage(l10n.t('执行规则失败："{0}"\n{1}', ruleName, String(e)));
        }
    }

    private getValue(rows: Row | Row[], value: Reader<any>, source?: any): any {
        let firstRow = Array.isArray(rows) ? rows[0] : rows;
        if (typeof value === 'string') {
            return firstRow[value];
        }
        if (typeof value === 'function') {
            if (Array.isArray(rows)) {
                return value(...rows);
            } else {
                return value(rows);
            }
        }
        if (value instanceof ReaderRule) {
            return value.applyReader(rows, source);
        }
        throw new Error(l10n.t('未知的值类型: {0}', String(value)));
    }
}
