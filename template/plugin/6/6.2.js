let y3 = require('y3-helper')

export async function 手动() {
    y3.excel.setBaseDir(y3.env.pluginUri)

    let excel = await y3.excel.loadFile('6-更多的演示/6.2-多维表')
    let table = excel.makeMultiTable()

    y3.assert(table['风暴之锤'][0]['字段1'] === '伤害')
    y3.assert(table['风暴之锤'][1]['字段1'] === '100|200|300')

    y3.assert(table['雷霆一击'][0]['编号'] === '1002')

    y3.assert(table['重击'][0]['名字'] === '重击')

    y3.print('多维表读取成功！')
}

export async function 规则1() {
    y3.excel.setBaseDir(y3.env.pluginUri)

    let {rule, reader} = y3.excel.rule('技能', '6-更多的演示/6.2-多维表')

    rule.multi = true
    rule.skip = 1

    rule.key = '编号'
    rule.data.name = '名字'
    rule.data.kv = reader.rule((row1, row2) => {
        // JS的类型检查有bug，直接写 `{}` 会有蜜汁报错
        let kv = Object.create(null);
        for (const title of ['字段1', '字段2', '字段3', '字段4']) {
            let k = row1[title]
            if (!k) continue
            let v = row2[title]
            kv[k] = v
        }
        return kv;
    })
}

export async function 规则2() {
    y3.excel.setBaseDir(y3.env.pluginUri)

    let {rule, as} = y3.excel.rule('技能', '6-更多的演示/6.2-多维表')

    rule.multi = true
    rule.skip = 1
    rule.key = '编号'

    rule.def('名字', rule.field.name)
    for (const title of ['字段1', '字段2', '字段3', '字段4']) {
        rule.def(title, rule.field.kv, (k, source, v) => {
            if (!k) return
            source[k] = v
            return source
        })
    }
}
