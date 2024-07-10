import * as jsonc from 'jsonc-parser';

const parseOptions = {
    allowTrailingComma: true,
    disallowComments: false,
    allowEmptyContent: true,
};

interface Patch {
    key: string;
    value: any;
}

const editOptions = {
    formattingOptions: {
        tabSize: 4,
        insertSpaces: true,
        eol: '\n',
    },
};

export class Json {
    private _text: string;
    constructor(text: string) {
        this._text = text;
    }

    public get text() {
        this.applyPatch();
        return this._text;
    }

    private _data?: any | null;
    public get data() {
        if (this._data === undefined) {
            this._data = jsonc.parse(this.text, undefined, parseOptions) ?? null;
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

    public get(key: string): any {
        return this.data[key];
    }

    private _patch: Patch[] = [];
    public set(key: string, value: any) {
        if (this.data[key] === value) {
            return;
        }
        this._data[key] = value;
        this._patch.push({ key, value });
    }

    private applyPatch() {
        if (this._patch.length === 0) {
            return;
        }
        this._tree = undefined;
        let allEdits: jsonc.Edit[] = [];
        for (const patch of this._patch) {
            let edits = jsonc.modify(this._text, [patch.key], patch.value, editOptions);
            allEdits.push(...edits);
        }
        this._patch = [];
        this._text = jsonc.applyEdits(this._text, allEdits);
    }
}
