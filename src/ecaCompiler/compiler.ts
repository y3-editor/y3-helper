import * as y3 from 'y3-helper';
import * as vscode from 'vscode';
import { Formatter } from './formatter';

export class Event {
    constructor(private json: y3.json.JObject) { }
}

export class Exp {
    name: string;
    type: number;
    kind: 'action' | 'call' | 'value' = 'call';
    args?: (Exp | null)[];
    value?: string | number | boolean;
    constructor(private json: y3.json.JObject) {
        this.type = json.arg_type as number;
        if (json.sub_type === undefined || typeof json.sub_type === 'string') {
            this.name = (json.sub_type ?? json.action_type) as string;
            this.args = [];
            for (let arg of json.args_list as y3.json.JObject[]) {
                this.args.push(new Exp(arg));
            }
            if ('op_arg' in json) {
                let enables = json.op_arg_enable as boolean[];
                for (let op_arg of json.op_arg as y3.json.JObject[]) {
                    let enable = enables?.shift();
                    if (op_arg === null || enable === false) {
                        this.args.push(null);
                    } else {
                        this.args.push(new Exp(op_arg));
                    }
                }
            }
        } else if (json.sub_type === 1) {
            this.kind = 'value';
            this.name = '$' + String(json.arg_type);
            this.value = (json.args_list as [any])[0];
        } else {
            throw new Error('Unknown sub_type: ' + json.sub_type);
        }
    }

    make(formatter: Formatter): string {
        if (this.kind === 'value') {
            return formatter.formatValue(this.type, this.value);
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

export class ECA {
    name: string;
    events: Event[] = [];
    actions: Exp[] = [];
    constructor(private json: y3.json.JObject) {
        this.name = json.trigger_name as string;
        for (let event of json.event as y3.json.JObject[]) {
            this.events.push(new Event(event));
        }
        for (let action of json.action as y3.json.JObject[]) {
            this.actions.push(new Exp(action));
        }
    }

    private makeActionPart(formatter: Formatter): string {
        return this.actions.map((action) => action.make(formatter)).join('\r\n');
    }

    make(formatter: Formatter): string {
        return this.makeActionPart(formatter);
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
