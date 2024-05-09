import { RelativePattern } from "vscode";
import { env } from "../env";
import * as tools from '../tools';
import { BaseDefine } from "./baseDefine";
import { typeID } from "../constants";

const filePath = 'customevent.json';

type Event = {
    name: string;
    id: number;
    args: EventArg[];
};

type EventArg = {
    name: string;
    type: number;
    luaType: string;
    desc: string;
};

export class Events extends BaseDefine {
    constructor() {
        super();

        this.onDidChange(() => {
            this._eventsCache = undefined;
        });
    }

    private _eventsCache?: Event[];

    get watchPattern() {
        if (!env.mapUri) {
            return;
        }
        return new RelativePattern(env.mapUri, filePath);
    }

    private async loadEvents() {
        let events: Event[] = [];
        try {
            if (!env.mapUri) {
                return events;
            }
            let jsonFile = await tools.readFile(env.mapUri, filePath);
            if (!jsonFile) {
                return events;
            }
            let json = JSON.parse(jsonFile.string);
            if (typeof json !== 'object') {
                return events;
            }
            // 自定义单位属性
            if (Array.isArray(json.group_info)) {
                for (let item of json.group_info) {
                    let id = item.items?.[0];
                    let name = item.items?.[1];
                    if (id && name) {
                        events.push({name, id: id, args: []});
                    }
                }
            }
            for (const event of events) {
                let conf = json.conf?.[event.id.toString()];
                if (!conf) {
                    continue;
                }
                for (let item of conf) {
                    let name = item[0];
                    let type = item[1];
                    if (name && type) {
                        event.args.push({
                            name,
                            type,
                            luaType: typeID[type]?.[0] ?? 'any',
                            desc: typeID[type]?.[1] ?? '不支持的类型',
                        });
                    }
                }
            }
        } finally {
            return events;
        }
    }

    public async getEvents() {
        if (!this._eventsCache) {
            this._eventsCache = await this.loadEvents();
        }
        return this._eventsCache;
    }
}
