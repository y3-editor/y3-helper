import { BaseBuilder } from './baseBuilder';
import * as y3 from 'y3-helper';

const template =
`---@alias py.%{NAME}KeyEnum integer
%{KEYS}
`;

export class Objects extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.updateAll();
        y3.env.onDidChange(() => {
            this.updateAll();
            this.updateTables();
        });
    }

    private tables: Map<y3.consts.Table.NameCN, y3.table.EditorTable> = new Map();
    private updateTables() {
        for (let key in y3.consts.Table.name.fromCN) {
            let name = key as y3.consts.Table.NameCN;
            let current = this.tables.get(name);
            if (!current) {
                let table = y3.table.openTable(name);
                this.tables.set(name, table);
                table.onDidChange(() => {
                    this.updateAll();
                    this.updateTables();
                });
            }
        }
    }

    private async makeOne(table: y3.table.EditorTable) {
        let keyList = await table.getList();
        let enName = y3.consts.Table.name.fromCN[table.name];
        let text = template
            . replace('%{NAME}', enName[0].toUpperCase() + enName.slice(1))
            . replace('%{KEYS}', keyList.map((key) => {
                return `---| ${key}`;
            }).join('\r\n'));
        return text;
    }

    async make() {
        let texts = await Promise.all(
            Array.from(this.tables.values()).map((table) => {
                return this.makeOne(table);
            })
        );
        return texts.join('\r\n');
    }

}
