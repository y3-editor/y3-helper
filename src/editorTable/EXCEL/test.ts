import * as y3 from 'y3-helper';

declare interface EditorData<N extends y3.const.Table.NameCN> {
    name: number;
}

export async function test() {
    let table = y3.table.openTable('装饰物');
    let obj = await table.get(201367371);
    if (!obj) {
        throw new Error('not found');
    }
    obj.data.name = '41号';

    let newObj = await table.create({
        name: '测试42',
        copyFrom: 201367371,
        key: 10001,
        overwrite: true,
    });
}
