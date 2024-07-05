import * as y3 from 'y3-helper';

export async function test() {
    let table = y3.table.openTable('单位');
    let obj = await table.get(134218426);
}
