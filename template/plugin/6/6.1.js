let y3 = require('y3-helper')

export async function 保存() {
    let unit = await y3.table.openTable('单位').create({
        name: '演示单位2',
        key: 11038,
        overwrite: true,
    })

    unit.data.kv = {
        '演示字符串': 'abc',
        '演示整数': 123,
        '演示实数': 123.456,
        '演示布尔': true,
    }

    y3.print('保存完成！')
}

export async function 读取() {
    let unit = await y3.table.openTable('单位').create({
        name: '演示单位2',
        key: 11038,
        overwrite: true,
    })

    y3.assert(unit.data.kv['演示字符串'] === 'abc')
    y3.assert(unit.data.kv['演示整数'] === 123)
    y3.assert(unit.data.kv['演示实数'] === 123.456)
    y3.assert(unit.data.kv['演示布尔'] === true)

    y3.print('读取完成！')
}

export async function 增加() {
    let unit = await y3.table.openTable('单位').create({
        name: '演示单位2',
        key: 11038,
        overwrite: true,
    })

    unit.data.kv['新增字符串1'] = '这种写法无效！'

    let kv = unit.data.kv
    kv['新增字符串2'] = '必须要重新赋值才能成功写入！'
    unit.data.kv = kv

    y3.print('新增完成！')
}
