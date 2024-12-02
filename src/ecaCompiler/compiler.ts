import * as y3 from 'y3-helper';
import * as vscode from 'vscode';
import { Formatter } from './formatter';

export class Event {
    name: string;
    args?: Exp[];
    constructor(private json: y3.json.JObject) {
        this.name = json.event_type as string;
        let args_list = json.args_list as y3.json.JObject[];
        if (args_list.length > 0) {
            this.args = [];
            for (let arg of args_list) {
                this.args.push(new Exp(arg));
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
    kind: 'action' | 'call' | 'value' | 'var' | 'code' = 'call';
    args?: (Exp | null)[];
    var?: Ref;
    value?: string | number | boolean;
    constructor(private json: y3.json.JObject) {
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
                if ('__tuple__' in arg) {
                    this.kind = 'var';
                    this.var = new Ref(arg.items as any);
                } else {
                    this.args.push(new Exp(arg));
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
                        this.args.push(new Exp(op_args[i]));
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
        } else if (this.kind === 'var') {
            let index = this.args?.[0];
            if (index !== undefined && index !== null) {
                return `${this.var!.make(formatter)}[${index.make(formatter)}]`;
            } else {
                return this.var!.make(formatter);
            }
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

class Variable {
    constructor(public name: string, public type: string, public isArray: boolean, public value: any) {
    }

    make(formatter: Formatter): string {
        return y3.lua.getValidName(this.name);
    }
}

class Ref {
    name: string;
    type: string;
    scope: 'local' | 'global';
    constructor(json: [string, string, 'local' | 'global']) {
        this.type = json[0];
        this.name = json[1];
        this.scope = json[2];
    }

    make(formatter: Formatter): string {
        return y3.lua.getValidName(this.name);
    }
}

export class ECA {
    name: string;
    events: Event[] = [];
    actions: Exp[] = [];
    variables: Variable[] = [];
    constructor(private json: y3.json.JObject) {
        this.name = json.trigger_name as string;
        for (let event of json.event as y3.json.JObject[]) {
            this.events.push(new Event(event));
        }
        for (let action of json.action as y3.json.JObject[]) {
            this.actions.push(new Exp(action));
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

    private ensureEndWithNL(content: string): string {
        return content.endsWith('\n') ? content : content + '\n';
    }

    private ensureNLisCRLF(content: string): string {
        // 只替换单独的 \n，不替换 \r\n
        return content.replace(/\n/g, '\r\n');
    }

    make(formatter: Formatter): string {
        let result = '';
        if (this.events.length === 1) {
            result = `y3.game:event(${this.events[0].make(formatter)}, function(_, data)\n`
                + `${this.increaseTab(this.makeVariablePart(formatter))}\n`
                + `${this.increaseTab(this.makeActionPart(formatter))}\n`
                + `end)`;
        }
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
