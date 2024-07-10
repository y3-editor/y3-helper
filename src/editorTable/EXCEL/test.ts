import * as y3 from 'y3-helper';

const Keys = {
    /**
     * 描述1
     */
    a: 1,
} as const;

/**
 * 设置值1
 * @param k - 键
 * @param v - 值
 */
function testSet(k: 'a', v: number): void;

/**
 * 设置值2
 * @param k - 键
 * @param v - 值
 */
function testSet(k: 'b', v: string): void;

function testSet(...args: any[]) {}

testSet('a', 1);
testSet('b', '1');

export async function test() {
    let table = y3.table.openTable('装饰物');
    let obj = await table.get(201367371);
    if (!obj) {
        throw new Error('not found');
    }
    obj.set('name', '测试');

    let newObj = await table.create({
        name: '测试42',
        copyFrom: 201367371,
        key: 10001,
        overwrite: true,
    });
}
