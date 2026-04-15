let y3 = require('y3-helper')

export async function 生成Lua表() {
    let file = await y3.fs.readFile(y3.env.pluginUri, 'jsconfig.json')
    y3.assert(file, '找不到 jsconfig.json')

    let config = y3.json.parse(file.string)

    let luaCode = y3.lua.encode(config)
    await y3.fs.writeFile(y3.env.scriptUri, 'log/演示Lua表.lua', 'return ' + luaCode + '\n')
}
