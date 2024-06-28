import { TableNameCN } from "src/constants";
import { env } from "src/env";

class EditorTable {
    constructor(
        public tableName: TableNameCN
    ) {
    }

}

export function open(tableName: TableNameCN) {
    if (!env.editorTableUri) {
        throw new Error('未选择地图路径');
    }
}
