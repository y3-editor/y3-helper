let y3 = require('y3-helper')
let os = require('os')

// 使用一些特定的函数名时会自动运行
// * `onGame`: 使用《Y3开发助手》启动游戏时自动运行
// * `onEditor`: 使用《Y3开发助手》的“在编辑器中打开”时自动运行
// * `onSave`: 使用《Y3编辑器》保存地图后自动运行

export async function onGame() {
    y3.print('启动游戏！')
    // 在你的Lua代码里加入 `require 'log.onGame'` 试试看
    y3.fs.writeFile(y3.uri(y3.env.scriptUri, 'log/onGame.lua'), `
print('运行者：${os.userInfo().username}，运行时间：${new Date().toLocaleString()}')
`)
}

export async function onEditor() {
    y3.print('在编辑器中打开！')
    // 偷偷生成一个单位
    let unitTable = y3.table.openTable('单位')
    let unit = await unitTable.create({
        name: '打开编辑器时自动创建的单位',
        key: 55555,
        overwrite: true,
    })
    unit.data.description = `运行者：${os.userInfo().username}，运行时间：${new Date().toLocaleString()}`
}

export async function onSave() {
    y3.print('保存地图！')
    // 在你的Lua代码里加入 `require 'log.onSave'` 试试看
    y3.fs.writeFile(y3.uri(y3.env.scriptUri, 'log/onSave.lua'), `
print('保存者：${os.userInfo().username}，保存时间：${new Date().toLocaleString()}')
`)
}
