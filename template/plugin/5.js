let y3 = require('y3-helper')

// 这是一个极致复杂的例子，请打开对应的xlsx文件对比查看
export function 生成物编·极() {
    // 设置 excel 的基础目录，作为演示这里使用插件目录
    y3.excel.setBaseDir(y3.env.pluginUri)
    let {rule, reader} = y3.excel.rule('单位', '5-excel生成物编·极')

    rule.key = '编号' // 手动指定key的列名
    rule.template = '模板' // 手动指定模板的列名

    rule.data.name = '名称'

    // 单位的力量值是编号的2倍
    rule.data.strength = reader.rule((row) => Number(row['编号']) * 2)
    // 单位的敏捷是编号的2倍+模板的3倍
    rule.data.agility = reader.rule((row) => {
        return Number(row['编号']) * 2 + Number(row['模板']) * 3
    })

    // 我们还抽象了一些常用的算法，请仔细对照：

    // 智力使用“智力”栏。如果无法转换成有效的数字，则使用 `9`
    rule.data.intelligence = reader.number('智力', 9)
    // tag按照 `|` 分割“标签”栏，生成一个数组
    rule.data.tags = reader.split('标签', '|')
    // 颜色按照 `|` 分割“颜色”栏，生成一个数组。
    rule.data.base_tint_color = reader.split('颜色', '|', Number) // 将每一项转成一个数字
                                . default([150, 200, 250, 0.8]) // 默认值，数组中缺少的项会被填充

}

// 上面的接口是根据物编字段来收集数据。如果你倾向于通过excel中的字段来生成物编，可以使用下面风格的接口
export function 生成物编·极·改() {
    y3.excel.setBaseDir(y3.env.pluginUri)
    let {rule, as} = y3.excel.rule('单位', '5-excel生成物编·极')

    rule.key = '编号'
    rule.template = '模板'

    rule.def('名称', rule.field.name)
    rule.def('编号', rule.field.strength, (value) => Number(value) * 2)
    rule.def('编号', rule.field.agility,  (value) => Number(value) * 2)
    // 第二次修改某个字段时，上一次的修改结果会通过source参数传递过来
    rule.def('模板', rule.field.agility,  (value, source) => {
        return Number(source) + Number(value) * 3
    })
    rule.def('智力', rule.field.intelligence, as.number(9))
    rule.def('标签', rule.field.tags,         as.split('|'))
    rule.def('颜色', rule.field.base_tint_color,
        as.split('|', Number).default([150, 200, 250, 0.8])
    )
}
