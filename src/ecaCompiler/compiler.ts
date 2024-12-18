import * as y3 from 'y3-helper';
import * as vscode from 'vscode';
import { Formatter } from './formatter';

const reservedNames = new Set(['params']);

export class Event {
    name: string;
    args?: Exp[];
    constructor(private eca: ECA, private json: y3.json.JObject) {
        this.name = json.event_type as string;
        let args_list = json.args_list as y3.json.JObject[];
        if (args_list.length > 0) {
            this.args = [];
            for (let arg of args_list) {
                this.args.push(Trigger.parseExp(eca, arg));
            }
        }
    }

    make(formatter: Formatter): string {
        return formatter.formatEvent(this.name, this);
    }

    makeArgs(formatter: Formatter): string[] {
        return this.args?.map((arg) => arg.make(formatter)) ?? [];
    }
}

export class Value {
    constructor(public type: number, public value: string | number | boolean) { }

    make(formatter: Formatter): string {
        return formatter.formatValue(this.type, this);
    }

    makeArgs(formatter: Formatter): string[] {
        return [];
    }
}

export class Call {
    name: string;
    type: number;
    args: (Exp | null)[] = [];
    constructor(private eca: ECA, private json: y3.json.JObject) {
        this.type = json.arg_type as number;
        this.name = (json.action_type ?? json.condition_type) as string
                ??  (typeof json.sub_type === 'string' ? json.sub_type : `$${this.type}`);
        let arg_list = json.args_list as y3.json.JObject[];
        for (let arg of arg_list) {
            this.args.push(Trigger.parseExp(eca, arg));
        }
        if ('op_arg' in json) {
            let enables = json.op_arg_enable as boolean[] | undefined;
            let op_args = json.op_arg as y3.json.JObject[];
            for (let i = 0; i < op_args.length; i++) {
                let enable = enables?.[i];
                if (op_args[i] === null || enable === false) {
                    this.args.push(null);
                } else {
                    this.args.push(Trigger.parseExp(eca, op_args[i]));
                }
            }
        }
    }

    make(formatter: Formatter): string {
        return formatter.formatCall(this.name, this);
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

class Comment {
    content: string;
    constructor(private json: [number, string, number, string]) {
        this.content = json[1];
    }

    make(formatter: Formatter): string {
        return '-- ' + this.content.replace(/\n/g, '\n-- ');
    }
}

class Variable {
    constructor(public name: string, public type: string, public isArray: boolean, public value: any) {
    }

    make(formatter: Formatter): string {
        return y3.lua.getValidName(this.name, reservedNames);
    }
}

class VarRef {
    name: string;
    type: string;
    scope: 'local' | 'global';
    constructor(json: [string, string, 'local' | 'global']) {
        this.type = json[0];
        this.name = json[1];
        this.scope = json[2] ?? 'global';
    }

    make(formatter: Formatter): string {
        return y3.lua.getValidName(this.name, reservedNames);
    }

    makeArgs(formatter: Formatter): string[] {
        return [];
    }
}

class TriggerRef {
    constructor(public eca: ECA, public id: string) { }

    make(formater: Formatter): string {
        let closure = this.eca.closures[this.id];
        if (closure) {
            return closure.make(formater);
        } else {
            return '-- 未找到函数： ' + this.id;
        }
    }

    makeArgs(formatter: Formatter): string[] {
        return [];
    }
}

function toArray(v: any) {
    if (Array.isArray(v)) {
        return v;
    }
    if (typeof v === 'object' && v !== null && '__tuple__' in v) {
        return v.items;
    }
    return undefined;
}

class Trigger {
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
                this.conditions.push(Trigger.parseExp(eca, condition));
            }
        }
        if (json.action) {
            for (let action of json.action as any) {
                let result = Trigger.parseAction(this.eca, action);
                if (result) {
                    this.actions.push(result);
                }
            }
        }
        if (json.var_data) {
            const varData = json.var_data as [
                Record<string, Record<string, any>>,
                Record<string, 0|10>,
                string[],
            ];
            let variableMap: Record<string, Variable> = {};
            for (let [type, data] of Object.entries(varData[0])) {
                for (let [name, value] of Object.entries(data)) {
                    variableMap[name] = new Variable(name, type, varData[1][name] !== 0, value);
                }
            }
            for (let name of varData[2]) {
                this.variables.push(variableMap[name]);
            }
        }
    }

    static parseAction(eca: ECA, action: y3.json.JObject | y3.json.JArray | number): Action {
        if (Array.isArray(action)) {
            return new Comment(action as any);
        } else if (typeof action === 'number') {
            return new TriggerRef(eca, String(action));
        } else {
            return new Call(eca, action as any);
        }
    }

    static parseExp(eca: ECA, exp: any): Exp {
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

    private makeActionPart(formatter: Formatter): string {
        return this.actions.map((action) => action.make(formatter)).join('\n');
    }

    private makeVariablePart(formatter: Formatter): string {
        return this.variables.map((variable) => {
            const name = variable.make(formatter);
            const value = y3.lua.encode(variable.value);
            if (variable.isArray) {
                return `local ${name} = y3.eca_rt.array(${value})`;
            } else {
                return `local ${name} = ${value}`;
            }
        }).join('\n');
    }

    private makeConditionPart(formatter: Formatter): string {
        return this.conditions.map((condition) => `not ${condition.make(formatter)}`).join('\nor ');
    }

    private increaseTab(content: string, tab: string = '    '): string {
        return content.split('\n').map((line) => tab + line).join('\n');
    }

    private makeBody(formatter: Formatter): string {
        let result = '';
        if (this.conditions.length > 0) {
            result += `if ${this.makeConditionPart(formatter)}`;
            result += ` then\n`;
            result += `    return\n`;
            result += `end\n`;
        }
        if (this.variables.length > 0) {
            result += `${this.makeVariablePart(formatter)}\n`;
        }
        if (this.actions.length > 0) {
            result += `${this.makeActionPart(formatter)}`;
        }
        return result;
    }

    make(formatter: Formatter): string {
        if (!this.enabled) {
            return `-- 子函数 ${this.name} 已禁用`;
        }
        let result = '';
        if (this.events.length === 1) {
            result += `y3.game:event(${this.events[0].make(formatter)}, function(_, params)\n`;
            result += this.increaseTab(this.makeBody(formatter));
            result += `end)`;
        } else {
            result += `local function action(_, params)\n`;
            result += this.increaseTab(this.makeBody(formatter));
            result += `\nend\n\n`;
            for (let event of this.events) {
                result += `y3.game:event(${event.make(formatter)}, action)\n`;
            }
        }
        return result;
    }
}

type Exp = Value | Call | VarRef | TriggerRef;
type Action = Call | Comment | TriggerRef;

export type Node = Exp | Event;

export class ECA {
    closures: Record<string, Trigger> = {};
    main: Trigger;
    constructor(private json: y3.json.JObject) {
        if (y3.is.object(json.sub_trigger)) {
            for (let [id, closure] of Object.entries(json.sub_trigger as Record<string, y3.json.JObject>)) {
                this.closures[id] = new Trigger(this, closure);
            }
        }
        this.main = new Trigger(this, json);
    }

    private ensureEndWithNL(content: string): string {
        return content.endsWith('\n') ? content : content + '\n';
    }

    private ensureNLisCRLF(content: string): string {
        // 只替换单独的 \n，不替换 \r\n
        return content.replace(/\n/g, '\r\n');
    }

    make(formatter: Formatter) {
        let result = this.main.make(formatter);
        result = this.ensureEndWithNL(result);
        result = this.ensureNLisCRLF(result);
        return result;
    }

}

export class Compiler {
    public async compile(input: string | vscode.Uri | y3.json.JObject): Promise<ECA> {
        let json: y3.json.JObject;
        if (typeof input === 'string') {
            json = y3.json.parse(input);
        } else if (input instanceof vscode.Uri) {
            let file = await y3.fs.readFile(input.fsPath);
            y3.assert(file, 'File not found: ' + input.fsPath);
            json = y3.json.parse(file.string);
        } else {
            json = input;
        }
        return new ECA(json);
    }
}
