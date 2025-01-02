import * as y3 from 'y3-helper';
import * as vscode from 'vscode';
import { Formatter } from './formatter';

const reservedNames = new Set(['params']);

export abstract class Node {
    name?: string;
    args?: (Exp | null)[];
    abstract make(formatter: Formatter): string;
    abstract makeArgs(formatter: Formatter): string[] | undefined;
}

export class Event extends Node {
    name: string;
    constructor(private eca: ECA, private json: y3.json.JObject) {
        super();
        this.name = json.event_type as string;
        let args_list = json.args_list as y3.json.JObject[];
        if (args_list.length > 0) {
            this.args = [];
            for (let arg of args_list) {
                this.args.push(parseExp(eca, arg));
            }
        }
    }

    make(formatter: Formatter): string {
        return formatter.formatEvent(this.name, this);
    }

    makeArgs(formatter: Formatter) {
        return this.args?.filter(arg => arg !== null).map(arg => arg.make(formatter));
    }
}

export class Value extends Node {
    constructor(public type: number | string, public value: string | number | boolean) {
        super();
    }

    make(formatter: Formatter): string {
        return formatter.formatValue(this.type, this);
    }

    makeArgs(formatter: Formatter) {
        return undefined;
    }
}

export class Call extends Node {
    name: string;
    type: number;
    args: (Exp | null)[] = [];
    enabled = true;
    constructor(private eca: ECA, private json: y3.json.JObject) {
        super();
        this.type = json.arg_type as number;
        this.name = (json.action_type ?? json.condition_type) as string
                ??  (typeof json.sub_type === 'string' ? json.sub_type : `$${this.type}`);
        this.enabled = typeof json.enable === 'boolean' ? json.enable : true;

        let arg_list = json.args_list as y3.json.JObject[];
        for (let arg of arg_list) {
            this.args.push(parseExp(eca, arg));
        }
        if ('op_arg' in json) {
            let enables = json.op_arg_enable as boolean[] | undefined;
            let op_args = json.op_arg as y3.json.JObject[];
            for (let i = 0; i < op_args.length; i++) {
                let enable = enables?.[i];
                if (op_args[i] === null || enable === false) {
                    this.args.push(null);
                } else {
                    this.args.push(parseExp(eca, op_args[i]));
                }
            }
        }
    }

    make(formatter: Formatter): string {
        let result = formatter.formatCall(this.name, this);
        if (!this.enabled) {
            result = '-- ' + result.replace(/\n/g, '\n-- ');
        }
        return result;
    }

    makeArgs(formatter: Formatter): string[] {
        return this.args.map((arg) => {
            if (arg === null) {
                return 'nil';
            } else {
                return arg.make(formatter);
            }
        });
    }
}

class Comment extends Node {
    content: string;
    constructor(private json: [number, string, number, string]) {
        super();
        this.content = json[1];
    }

    make(formatter: Formatter): string {
        return '-- ' + this.content.replace(/\n/g, '\n-- ');
    }

    makeArgs(formatter: Formatter) {
        return undefined;
    }
}

export class Variable extends Node {
    constructor(public name: string, public type: string, public isArray: boolean, public value: Value, public isGlobal = false) {
        super();
    }

    make(formatter: Formatter): string {
        return y3.lua.getValidName((this.isGlobal ? 'V_' : 'v_') + this.name, reservedNames);
    }

    makeArgs(formatter: Formatter) {
        return undefined;
    }
}

class VarRef extends Node {
    name: string;
    type: string;
    scope: 'local' | 'global';
    constructor(json: [string, string, 'local' | 'global']) {
        super();
        this.type = json[0];
        this.name = json[1];
        this.scope = json[2] ?? 'global';
    }

    make(formatter: Formatter): string {
        return y3.lua.getValidName((this.scope === 'global' ? 'V_' : 'v_') + this.name, reservedNames);
    }

    makeArgs(formatter: Formatter) {
        return undefined;
    }
}

class TriggerRef extends Node {
    constructor(public eca: ECA, public id: string) {
        super();
    }

    make(formater: Formatter): string {
        let closure = this.eca.closures[this.id];
        if (closure) {
            return closure.make(formater);
        } else {
            return '-- 未找到函数： ' + this.id;
        }
    }

    makeArgs(formatter: Formatter) {
        return undefined;
    }
}

class NilNode extends Node {
    make(formatter: Formatter): string {
        return 'nil';
    }

    makeArgs(formatter: Formatter) {
        return undefined;
    }
}

const Nil = new NilNode();

function toArray(v: any) {
    if (Array.isArray(v)) {
        return v;
    }
    if (typeof v === 'object' && v !== null && '__tuple__' in v) {
        return v.items;
    }
    return undefined;
}

function parseAction(eca: ECA, action: y3.json.JObject | y3.json.JArray | number): Action {
    if (Array.isArray(action)) {
        return new Comment(action as any);
    } else if (typeof action === 'number') {
        return new TriggerRef(eca, String(action));
    } else {
        return new Call(eca, action as any);
    }
}

function parseExp(eca: ECA, exp: any): Exp {
    if (exp === null) {
        return Nil;
    }
    if (typeof exp === 'number') {
        return new TriggerRef(eca, String(exp));
    }
    if (toArray(exp)) {
        return new VarRef(toArray(exp));
    } else {
        const arg_list = exp.args_list as any[];
        if (arg_list.length === 1) {
            let first = arg_list[0];
            if (toArray(first)) {
                return new VarRef(toArray(first));
            }
            if (typeof first !== 'object') {
                return new Value(exp.arg_type, first);
            }
        }
    }
    return new Call(eca, exp);
}

interface VarData {
    [0]: Record<string, Record<string, any>>;
    [1]: Record<string, 0 | 10>;
    [2]: string[];
}

function parseVarData(eca: ECA, varData: VarData) {
    let variableMap: Record<string, Variable> = {};
    for (let [type, data] of Object.entries(varData[0])) {
        for (let [name, value] of Object.entries(data)) {
            variableMap[name] = new Variable(name, type, varData[1][name] !== 0, new Value(type, value));
        }
    }
    let variables: Variable[] = [];
    for (let name of varData[2]) {
        variables.push(variableMap[name]);
    }
    return variables;
}

export class Trigger {
    name: string;
    enabled: boolean = true;
    events: Event[] = [];
    conditions: Exp[] = [];
    actions: Action[] = [];
    variables: Variable[] = [];
    constructor(private eca: ECA, private json: y3.json.JObject) {
        this.name = json.trigger_name as string;
        if (!json.enabled) {
            this.enabled = false;
            return;
        }
        if (json.event) {
            for (let event of json.event as y3.json.JObject[]) {
                this.events.push(new Event(eca, event));
            }
        }
        if (json.condition) {
            for (let condition of json.condition as any) {
                this.conditions.push(parseExp(eca, condition));
            }
        }
        if (json.action) {
            for (let action of json.action as any) {
                let result = parseAction(this.eca, action);
                if (result) {
                    this.actions.push(result);
                }
            }
        }
        if (json.var_data) {
            const varData = json.var_data as unknown as VarData;
            this.variables = parseVarData(eca, varData);
        }
    }

    make(formatter: Formatter): string {
        return formatter.formatTrigger(this);
    }
}

export class Function {
    name: string;
    id: string;
    enabled: boolean = true;
    actions: Action[] = [];
    variables: Variable[] = [];
    constructor(private eca: ECA, private json: y3.json.JObject) {
        this.name = json.func_name as string;
        this.id = json.func_id as string;
        if (!json.enabled) {
            this.enabled = false;
            return;
        }
        if (json.action) {
            for (let action of json.action as any) {
                let result = parseAction(this.eca, action);
                if (result) {
                    this.actions.push(result);
                }
            }
        }
        if (json.var_data) {
            const varData = json.var_data as unknown as VarData;
            this.variables = parseVarData(eca, varData);
        }
    }

    make(formatter: Formatter): string {
        return formatter.formatFunction(this);
    }
}

type Exp = Value | Call | VarRef | TriggerRef | NilNode;
type Action = Call | Comment | TriggerRef;

export class ECA {
    closures: Record<string, Trigger> = {};
    main: Trigger | Function;
    constructor(private json: y3.json.JObject) {
        if (y3.is.object(json.sub_trigger)) {
            for (let [id, closure] of Object.entries(json.sub_trigger as Record<string, y3.json.JObject>)) {
                this.closures[id] = new Trigger(this, closure);
            }
        }
        if (json.is_func) {
            this.main = new Function(this, json);
        } else {
            this.main = new Trigger(this, json);
        }
    }

    make(formatter: Formatter) {
        let result = this.main.make(formatter);
        result = formatter.asFileContent(result);
        return result;
    }
}

export class GlobalVariables {
    variables = new Map<string, Variable>();

    constructor(private json: y3.json.JObject) {
        const dict = json.variable_dict as Record<string, Record<string, any>>;
        const length = json.variable_length_dict as Record<string, number>;
        for (const type in dict) {
            const group = dict[type];
            for (const name in group) {
                const value = group[name];
                const variable = new Variable(name, type, length[name] === 10, new Value(type, value), true);
                this.variables.set(name, variable);
            }
        }
    }

    make(formatter: Formatter) {
        let buffer: string[] = [];
        for (const variable of this.variables.values()) {
            buffer.push(formatter.formatVariable(variable));
            buffer.push('\n');
        }
        let content = buffer.join('');
        content = formatter.asFileContent(content);
        return content;
    }
}

export class Compiler {
    private async loadJson(input: string | vscode.Uri | y3.json.JObject) {
        let json: y3.json.JObject;
        if (typeof input === 'string') {
            json = y3.json.parse(input);
        } else if (input instanceof vscode.Uri) {
            let file = await y3.fs.readFile(input);
            y3.assert(file, 'File not found: ' + input.fsPath);
            json = y3.json.parse(file.string);
        } else {
            json = input;
        }
        return json;
    }
    public async compileECA(input: string | vscode.Uri | y3.json.JObject): Promise<ECA> {
        let json = await this.loadJson(input);
        return new ECA(json);
    }

    public async compileGlobalVariables(input: string | vscode.Uri | y3.json.JObject) {
        let json = await this.loadJson(input);
        return new GlobalVariables(json);
    }
}
