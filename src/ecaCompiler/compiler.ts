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
                this.args.push(new Exp(eca, arg));
            }
        }
    }

    make(formatter: Formatter): string {
        return formatter.formatEvent(this.name, this.args?.map((arg) => arg.make(formatter)));
    }
}

export class Exp {
    name: string;
    type: number;
    kind: 'action' | 'call' | 'value' | 'code' = 'call';
    args?: (Exp | VarRef | FuncRef | null)[];
    value?: string | number | boolean;
    constructor(private eca: ECA, private json: y3.json.JObject) {
        this.type = json.arg_type as number;
        let arg_list = json.args_list as y3.json.JObject[];
        if (arg_list.length === 1 && typeof arg_list[0] !== 'object') {
            if (json.sub_type === 1) {
                this.kind = 'value';
            } else {
                this.kind = 'code';
            }
            this.name = '$' + String(json.arg_type);
            this.value = arg_list[0];
        }
        else {
            this.name = (json.sub_type ?? json.action_type) as string;
            this.args = [];
            for (let arg of json.args_list as y3.json.JObject[]) {
                if (typeof arg === 'number') {
                    this.args.push(new FuncRef(eca, String(arg)));
                } else if ('__tuple__' in arg) {
                    this.args.push(new VarRef(arg.items as any));
                } else if (Array.isArray(arg)) {
                    this.args.push(new VarRef(arg as any));
                } else {
                    this.args.push(new Exp(eca, arg));
                }
            }
            if ('op_arg' in json) {
                let enables = json.op_arg_enable as boolean[] | undefined;
                let op_args = json.op_arg as y3.json.JObject[];
                for (let i = 0; i < op_args.length; i++) {
                    let enable = enables?.[i];
                    if (op_args[i] === null || enable === false) {
                        this.args.push(null);
                    } else {
                        this.args.push(new Exp(eca, op_args[i]));
                    }
                }
            }
        }
    }

    make(formatter: Formatter): string {
        if (this.kind === 'value') {
            return formatter.formatValue(this.type, this.value);
        } else if (this.kind === 'code') {
            return String(this.value);
        } else {
            return formatter.formatCall(this.name, this.args!.map((arg) => {
                if (arg === null) {
                    return 'nil';
                } else {
                    return arg.make(formatter);
                }
            }));
        }
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
        this.scope = json[2];
    }

    make(formatter: Formatter): string {
        return y3.lua.getValidName(this.name, reservedNames);
    }
}

class FuncRef {
    constructor(public eca: ECA, public id: string) { }

    make(formater: Formatter): string {
        let closure = this.eca.closures[this.id];
        if (closure) {
            return closure.make(formater);
        } else {
            return '-- 未找到函数： ' + this.id;
        }
    }
}

class Function {
    name: string;
    enabled: boolean = true;
    events: Event[] = [];
    actions: (Exp | FuncRef | Comment)[] = [];
    variables: Variable[] = [];
    constructor(private eca: ECA, private json: y3.json.JObject) {
        this.name = json.trigger_name as string;
        if (!json.enabled) {
            this.enabled = false;
            return;
        }
        for (let event of json.event as y3.json.JObject[]) {
            this.events.push(new Event(eca, event));
        }
        for (let action of json.action as any) {
            let result = this.parseAction(action);
            if (result) {
                this.actions.push(result);
            }
        }
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


    private parseAction(action: y3.json.JObject | y3.json.JArray | number) {
        if (Array.isArray(action)) {
            return new Comment(action as any);
        } else if (typeof action === 'number') {
            return new FuncRef(this.eca, String(action));
        } else {
            return new Exp(this.eca, action as any);
        }
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

    private increaseTab(content: string, tab: string = '    '): string {
        return content.split('\n').map((line) => tab + line).join('\n');
    }

    make(formatter: Formatter): string {
        if (!this.enabled) {
            return `-- 子函数 ${this.name} 已禁用`;
        }
        let result = '';
        if (this.events.length === 1) {
            result += `y3.game:event(${this.events[0].make(formatter)}, function(_, params)\n`;
            if (this.variables.length > 0) {
                result += `${this.increaseTab(this.makeVariablePart(formatter))}\n`;
            }
            if (this.actions.length > 0) {
                result += `${this.increaseTab(this.makeActionPart(formatter))}\n`;
            }
            result += `end)`;
        }
        return result;
    }
}

export class ECA {
    closures: Record<string, Function> = {};
    main: Function;
    constructor(private json: y3.json.JObject) {
        if (y3.is.object(json.sub_trigger)) {
            for (let [id, closure] of Object.entries(json.sub_trigger as Record<string, y3.json.JObject>)) {
                this.closures[id] = new Function(this, closure);
            }
        }
        this.main = new Function(this, json);
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
