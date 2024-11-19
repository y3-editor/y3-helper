import * as y3 from 'y3-helper';
import * as vscode from 'vscode';

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

    make(): string {
        return `${this.name}(${this.args.map((arg) => arg.make()).join(', ')})`;
    }
}

export class Exp {
    name: string;
    type: number;
    args: Exp[] = [];
    constructor(private json: y3.json.JObject) {
        this.name = json.sub_type as string;
        this.type = json.arg_type as number;
        for (let arg of json.args_list as y3.json.JObject[]) {
            this.args.push(new Exp(arg));
        }
    }

    make(): string {
        return `${this.name}(${this.args.map((arg) => arg.make()).join(', ')})`;
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

    private makeActionPart(): string {
        return this.actions.map((action) => action.make()).join('\n    ');
    }

    make(): string {
        return this.makeActionPart();
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
