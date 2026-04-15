import { RelativePattern } from "vscode";
import * as y3 from 'y3-helper';
import * as tools from '../tools';
import { BaseDefine } from "./baseDefine";
import { Table } from "../constants";
import * as l10n from '@vscode/l10n';

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
    private eventsCache;
    private folderCache;
    constructor(map: y3.Map) {
        super(map);

        this.eventsCache = new tools.Cache(this.loadEvents.bind(this), []);
        this.folderCache = new tools.Cache(this.loadEventsFolder.bind(this), {
            name: '<root>',
            childs: {},
        });

        this.onDidChange(() => {
            this.eventsCache.updateVersion();
            this.folderCache.updateVersion();
        });
    }

    get watchPattern() {
        return new RelativePattern(this.map.triggerMapUri, filePath);
    }

    private async loadEvents() {
        let events: Event[] = [];
        let jsonFile = await tools.fs.readFile(this.map.triggerMapUri, filePath);
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
                        desc: Table.type.toName[type] ?? l10n.t('不支持的类型'),
                    });
                }
            }
        }
        return events;
    }

    public async getEvents() {
        return await this.eventsCache.get();
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
        return await this.folderCache.get();
    }
}
