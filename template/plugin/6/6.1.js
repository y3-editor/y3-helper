let y3 = require('y3-helper')

export async function 多维表() {
    y3.excel.setBaseDir(y3.env.pluginUri)

    let excel = await y3.excel.loadFile('6-更多的演示/6.1-多维表')
    let table = excel.makeMultiTable()

    y3.assert(table['风暴之锤']['字段1'][0] === '伤害')
    y3.assert(table['风暴之锤']['字段1'][1] === '100|200|300')

    y3.assert(table['雷霆一击']['编号'][0] === '1002')

    y3.assert(table['重击']['名字'][0] === '重击')

    y3.print('多维表读取成功！')
}
