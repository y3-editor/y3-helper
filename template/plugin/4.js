let y3 = require('y3-helper')

// 结合“1-使用代码修改物编”和“3-读取excel”，
// 已经可以简单的批量修改物编了，来尝试一下！
export async function 生成物编() {
    const uri = y3.uri(y3.env.pluginUri, '3-读取excel.xlsx')
    let sheet = await y3.excel.loadFile(uri)

    let table = sheet.makeTable()

    for (let key in table) {
        let data = table[key]
        let unitTable = y3.table.openTable('单位')
        // 先获取单位，如果不存在则创建
        let unit = await unitTable.get(Number(key))
                || await unitTable.create({
                    key: Number(key),
                    overwrite: true,
                })

        unit.data.name       = data['名称']
        unit.data.attack_phy = Number(data['攻击'])
        unit.data.hp_max     = Number(data['血量'])
    }

    y3.print('物编生成成功！')
}

// 我们还提供了一些更加“抽象”的接口来支持大批量的操作
export async function 生成规则() {
    // 设置 excel 的基础目录，作为演示这里使用插件目录
    y3.excel.setBaseDir(y3.env.pluginUri)
    let rule = y3.excel.rule('单位', '3-读取excel')

    rule.data.name = '名称'
    rule.data.attack_phy = '攻击'
    rule.data.hp_max = '血量'
}
