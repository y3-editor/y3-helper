import * as y3 from 'y3-helper';
import * as vscode from 'vscode';
import { Formatter } from './formatter';

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

    eachNode(callback: (node: Node) => boolean) {
        for (let arg of this.args) {
            if (arg === null) {
                continue;
            }
            if (callback(arg)) {
                return true;
            }
            if ('eachNode' in arg) {
                if (arg.eachNode(callback)) {
                    return true;
                }
            }
        }
        return false;
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
    constructor(public name: string, public type: string, public isArray: boolean, public value: Value) {
        super();
    }

    make(formatter: Formatter): string {
        return formatter.getVariableName(this.name);
    }

    makeArgs(formatter: Formatter) {
        return undefined;
    }
}

export class VarRef extends Node {
    name: string;
    type: string;
    scope: 'local' | 'global' | 'actor';
    constructor(json: [string, string, 'local' | 'global' | 'actor']) {
        super();
        this.type = json[0];
        this.name = json[1];
        this.scope = json[2] ?? 'global';
    }

    make(formatter: Formatter): string {
        switch (this.scope) {
            case 'local':
                return formatter.getVariableName(this.name);
            case 'global':
                return 'G.' + formatter.getVariableName(this.name);
            case 'actor':
                return 'g.' + formatter.getVariableName(this.name);
        }
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

    eachNode(callback: (node: Node) => boolean) {
        let closure = this.eca.closures[this.id];
        if (closure) {
            if (closure.eachNode(callback)) {
                return true;
            }
        }
        return false;
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

function toArray(v: any): any[] | undefined {
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
        return new VarRef(toArray(exp) as any);
    } else {
        const arg_list = exp.args_list as any[];
        if (arg_list.length === 1) {
            let first = arg_list[0];
            if (toArray(first)) {
                return new VarRef(toArray(first) as any);
            }
            if (typeof first !== 'object') {
                return new Value(exp.arg_type, first);
            }
        }
    }
    return new Call(eca, exp);
}

function parseVarData(dict: Record<string, Record<string, any>>, length: Record<string, 0 | 10>, order: string[] = []): Variable[] {
    let variableMap: Record<string, Variable> = {};
    for (let [type, data] of Object.entries(dict)) {
        for (let [name, value] of Object.entries(data)) {
            variableMap[name] = new Variable(name, type, length[name] !== 0, new Value(type, value));
        }
    }
    let variables: Variable[] = [];
    for (let name of order) {
        variables.push(variableMap[name]);
    }
    return variables;
}

export class Trigger {
    name: string;
    groupID = 0;
    enabled: boolean = true;
    events: Event[] = [];
    conditions: Exp[] = [];
    trunk?: Trunk;
    constructor(public eca: ECA, private json: any, public isClosure = false) {
        this.name = json.trigger_name as string;
        this.groupID = json.group_id as number;
        if (isClosure) {
            if (!json.call_enabled || !json.valid) {
                this.enabled = false;
                return;
            }
        } else {
            if (!json.enabled || !json.valid) {
                this.enabled = false;
                return;
            }
        }
        if (json.event) {
            for (let event of json.event as any[]) {
                this.events.push(new Event(eca, event));
            }
        }
        if (json.condition) {
            for (let condition of json.condition as any) {
                this.conditions.push(parseExp(eca, condition));
            }
        }
        this.trunk = new Trunk(eca, json);
    }

    eachNode(callback: (node: Node) => boolean) {
        return this.trunk?.eachNode(callback) ?? false;
    }

    make(formatter: Formatter): string {
        return formatter.formatTrigger(this);
    }
}

type Param = {
    name: string;
    required: boolean;
};

class Trunk {
    actions: Action[] = [];
    variables: Variable[] = [];
    constructor(private eca: ECA, private json: any) {
        if (json.action) {
            for (let action of json.action as any) {
                let result = parseAction(this.eca, action);
                if (result) {
                    this.actions.push(result);
                }
            }
        }
        if (json.var_data) {
            this.variables = parseVarData(json.var_data[0], json.var_data[1], json.var_data[2]);
        }
    }

    eachNode(callback: (node: Node) => boolean) {
        for (let action of this.actions) {
            if (callback(action)) {
                return true;
            }
            if ('eachNode' in action) {
                if (action.eachNode(callback)) {
                    return true;
                }
            }
        }
        return false;
    }
}

export class Function {
    name: string;
    id: string;
    enabled: boolean = true;
    params: Param[] = [];
    trunk?: Trunk;
    constructor(private eca: ECA, private json: any) {
        this.name = json.func_name as string;
        this.id = json.func_id as string;
        if (!json.call_enabled || !json.valid) {
            this.enabled = false;
            return;
        }
        this.trunk = new Trunk(eca, json);
        if (json.func_param_list) {
            this.params = (json.func_param_list as any[]).map((param: [string, boolean]) => {
                param = toArray(param) as [string, boolean];
                return { name: param[0], required: param[1] };
            });
        }
    }

    eachNode(callback: (node: Node) => boolean) {
        return this.trunk?.eachNode(callback) ?? false;
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
    constructor(private json: y3.json.JObject, public group?: ECAGroup) {
        if (y3.is.object(json.sub_trigger)) {
            for (let [id, closure] of Object.entries(json.sub_trigger as Record<string, y3.json.JObject>)) {
                this.closures[id] = new Trigger(this, closure, true);
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
        return result;
    }
}

export class ECAGroup {
    ecas: ECA[] = [];
    variables: Variable[] = [];
    constructor(private json: any, public objectType: y3.consts.Table.NameCN) {
        for (const [id, obj] of Object.entries(json.trigger_dict as Record<string, y3.json.JObject>)) {
            let eca = new ECA(obj, this);
            this.ecas.push(eca);
        }
        this.variables = parseVarData(
            json.variable_dict,
            json.variable_length_dict,
            json.variable_group_info?.map((v: any) => toArray(v)?.[0]),
        );
    }

    make(formatter: Formatter) {
        return formatter.formatECAGroup(this);
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
                const variable = new Variable(name, type, length[name] === 10, new Value(type, value));
                this.variables.set(name, variable);
            }
        }
    }

    make(formatter: Formatter) {
        let buffer: string[] = [];
        buffer.push('G = {}\n\n');
        for (const variable of this.variables.values()) {
            buffer.push(`G.${y3.lua.getValidName(variable.name)} = ${formatter.getVariableInitValue(variable)}`);
            buffer.push('\n');
        }
        let content = buffer.join('');
        return content;
    }
}

export class Compiler {
    public compileECA(input: string) {
        let json = y3.json.parse(input);
        return new ECA(json);
    }

    public compileGlobalVariables(input: string) {
        let json = y3.json.parse(input);
        return new GlobalVariables(json);
    }

    public compileObject(input: string, objectType: y3.consts.Table.NameCN) {
        let json = y3.json.parse(input);
        return new ECAGroup(json, objectType);
    }
}
