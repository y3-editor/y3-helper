let y3 = require('y3-helper')

export async function 多维表() {
    y3.excel.setBaseDir(y3.env.pluginUri)

    let excel = await y3.excel.loadFile('6-更多的演示/6.2-多维表')
    let table = excel.makeMultiTable()

    y3.assert(table['风暴之锤'][0]['字段1'] === '伤害')
    y3.assert(table['风暴之锤'][1]['字段1'] === '100|200|300')

    y3.assert(table['雷霆一击'][0]['编号'] === '1002')

    y3.assert(table['重击'][0]['名字'] === '重击')

    y3.print('多维表读取成功！')
}
