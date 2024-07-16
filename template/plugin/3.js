let y3 = require('y3-helper');

export async function 查看演示用excel() {
    const uri = y3.uri(y3.env.pluginUri, '3-读取excel.xlsx')
    y3.openInExplorer(uri) // 在 Windows 中浏览文件

    // 建议安装 Excel Viewer 插件，可以直接在 VSCode 中查看
}

// 插件提供了一个简化版的excel读取库
export async function 演示() {
    const uri = y3.uri(y3.env.pluginUri, '3-读取excel.xlsx')
    let sheet = await y3.excel.loadFile(uri)

    // 可以直接使用坐标来读取单元格的内容
    y3.assert(sheet.cells['A2']  === '编号')
    y3.assert(sheet.cells['B8']  === '六花')
    y3.assert(sheet.cells['D12'] === '10000')
    y3.assert(sheet.cells['B1']  === '')

    // 以A2单元格为锚点，生成一个key-value的表格
    let table = sheet.makeTable('A2')

    y3.assert(table[1001]['名称'] === '一心')
    y3.assert(table[1002]['攻击'] === '200')
    y3.assert(table[1003]['血量'] === '3000')
    y3.assert(table[1004]['E'] === '注释4')
    
    y3.print('Excel读取成功！')
}
