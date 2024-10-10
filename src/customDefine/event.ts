import { RelativePattern } from "vscode";
import { env } from "../env";
import * as tools from '../tools';
import { BaseDefine } from "./baseDefine";
import { Table } from "../constants";

const filePath = 'customevent.json';

type Event = {
    name: string;
    id: number;
    args: EventArg[];
    path: string[];
};

type EventArg = {
    name: string;
    type: number;
    luaType: string;
    desc: string;
};

export type Folder = {
    name: string;
    childs: { [key: string]: Event | Folder };
};

export class Events extends BaseDefine {
    constructor() {
        super();

        this.onDidChange(() => {
            this._eventsCache = undefined;
            this._folderCache = undefined;
        });
    }

    private _eventsCache?: Event[];
    private _folderCache?: Folder;

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
            let jsonFile = await tools.fs.readFile(env.mapUri, filePath);
            if (!jsonFile) {
                return events;
            }
            let json = JSON.parse(jsonFile.string);
            if (typeof json !== 'object') {
                return events;
            }

            // 自定义单位属性
            function lookInto(folder: any[], path: string[]) {
                if (!Array.isArray(folder)) {
                    return;
                }
                for (let item of folder) {
                    if (typeof item !== 'object') {
                        continue;
                    }
                    if (Array.isArray(item.items)) {
                        let id = item.items[0];
                        let name = item.items[1];
                        if (id && name) {
                            events.push({
                                name,
                                id,
                                args: [],
                                path,
                            });
                        }
                    } else {
                        lookInto(item.group, [...path, item.name]);
                    }
                }
            }
            lookInto(json.group_info, []);

            for (const event of events) {
                let conf = json.conf?.[event.id.toString()];
                if (!conf) {
                    continue;
                }
                for (let item of conf) {
                    let name = item[0];
                    let type: Table.TypeID = item[1];
                    if (name && type) {
                        event.args.push({
                            name,
                            type,
                            luaType: Table.type.toLuaType[type] ?? 'any',
                            desc: Table.type.toName[type] ?? '不支持的类型',
                        });
                    }
                }
            }
        } finally {
            return events;
        }
    }

    public async getEvents() {
        return this._eventsCache ??= await this.loadEvents();
    }

    private async loadEventsFolder() {
        let root: Folder = {
            name: '<root>',
            childs: {},
        };

        let events = await this.getEvents();

        function getFolder(fullPath: string[]) {
            let folder = root;
            for (const path of fullPath) {
                folder.childs[path] ??= {
                    name: path,
                    childs: {},
                };
                folder = folder.childs[path] as Folder;
            }
            return folder;
        }

        for (const event of events) {
            let folder = getFolder(event.path);
            folder.childs[event.name] = event;
        }

        return root;
    }

    public async getEventsFolder() {
        return this._folderCache ??= await this.loadEventsFolder();
    }
}
