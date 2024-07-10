import * as y3 from 'y3-helper';

export async function test() {
    let table = y3.table.openTable('装饰物');
    let obj = await table.get(201367371);
    if (!obj) {
        throw new Error('not found');
    }
    obj.set('name', '测试');

    let newObj = await table.create({
        name: '测试43',
        copyFrom: 201367371,
        key: 10001,
        overwrite: true,
    });
}
