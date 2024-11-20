import * as y3 from 'y3-helper';
import * as vscode from 'vscode';
import { Formatter } from './formatter';

export class Event {
    constructor(private json: y3.json.JObject) { }
}

export class Action {
    name: string;
    args: Exp[] = [];
    constructor(private json: y3.json.JObject) {
        this.name = json.action_type as string;
        for (let arg of json.args_list as y3.json.JObject[]) {
            this.args.push(new Exp(arg));
        }
    }

    make(formatter: Formatter): string {
        return formatter.formatCall(this.name, this.args.map((arg) => arg.make(formatter)));
    }
}

export class Exp {
    name: string;
    type: number;
    kind: 'call' | 'value' = 'call';
    args?: Exp[];
    value?: string | number | boolean;
    constructor(private json: y3.json.JObject) {
        this.type = json.arg_type as number;
        if (typeof json.sub_type === 'string') {
            this.name = json.sub_type as string;
            this.args = [];
            for (let arg of json.args_list as y3.json.JObject[]) {
                this.args.push(new Exp(arg));
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
            return `_${this.type}(${y3.lua.encode(this.value)})`;
        } else {
            return `${this.name}(${this.args!.map((arg) => arg.make(formatter)).join(', ')})`;
        }
    }
}

export class ECA {
    name: string;
    events: Event[] = [];
    actions: Action[] = [];
    constructor(private json: y3.json.JObject) {
        this.name = json.trigger_name as string;
        for (let event of json.event as y3.json.JObject[]) {
            this.events.push(new Event(event));
        }
        for (let action of json.action as y3.json.JObject[]) {
            this.actions.push(new Action(action));
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
