import { Table } from "src/constants";
import { env } from "src/env";

class EditorTable {
    constructor(
        public tableName: Table.NameCN
    ) {
    }

}

export function open(tableName: Table.NameCN) {
    if (!env.editorTableUri) {
        throw new Error('未选择地图路径');
    }
}
