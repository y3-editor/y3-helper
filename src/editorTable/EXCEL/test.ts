import * as y3 from 'y3-helper';

export async function test() {
    let table = y3.table.open('单位');
    await table.get(134218426);
}
