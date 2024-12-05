import * as jsonc from 'jsonc-parser';

const parseOptions = {
    allowTrailingComma: true,
    disallowComments: false,
    allowEmptyContent: true,
};

const editOptions = {
    formattingOptions: {
        tabSize: 4,
        insertSpaces: true,
        eol: '\n',
    },
};

export type Item = string | boolean | number | bigint | null | JObject | JArray;
export type JArray = Item[];
export type JObject = { [key: string]: Item };

export class Json {
    private _text: string;
    constructor(text: string) {
        this._text = text;
    }

    public get text() {
        this.applyPatch();
        return this._text;
    }

    private _data?: JObject | null;
    public get data() {
        if (this._data === undefined) {
            this._data = jsonc.parse(this.text, undefined, parseOptions) ?? null;
            if (typeof this._data !== 'object' || this._data === null) {
                this._data = null;
            }
        }
        return this._data ?? undefined;
    }

    private _tree?: jsonc.Node | null;
    public get tree() {
        this.applyPatch();
        if (this._tree === undefined) {
            this._tree = jsonc.parseTree(this.text, undefined, parseOptions) ?? null;
        }
        return this._tree ?? undefined;
    }

    public get(key: string): Item | undefined {
        return this.data?.[key];
    }

    private _patch?: { [key: string]: any };
    public set(key: string, value: any) {
        if (!this.data) {
            return false;
        }
        let finaleValue = value;
        if (typeof finaleValue === 'bigint') {
            finaleValue = Number(finaleValue);
        }
        if (this.data[key] === finaleValue) {
            return false;
        }
        this._data![key] = finaleValue;
        this._patch ??= {};
        this._patch[key] = value;
        return true;
    }

    private applyPatch() {
        if (this._patch === undefined) {
            return;
        }
        this._tree = undefined;

        let originStringify = JSON.stringify;

        JSON.stringify = (value: any, replacer?: any, space?: any) => {
            if (replacer) {
                return originStringify(value, replacer, space);
            }
            if (typeof value === 'bigint') {
                return value.toString();
            }
            if (typeof value === 'number' && isFinite(value)) {
                return value.toFixed(1);
            }
            return originStringify(value, replacer, space);
        };

        try {
            for (const key in this._patch) {
                const value = this._patch[key];
                let edits = jsonc.modify(this._text, [key], value, editOptions);
                this._text = jsonc.applyEdits(this._text, edits);
            }
        } finally {
            this._patch = undefined;
            JSON.stringify = originStringify;
        }
    }
}

/**
 * 解析json文本，支持注释和尾随逗号
 * @param text json文本
 * @returns 
 */
export function parse(text: string) {
    return jsonc.parse(text, undefined, parseOptions);
}
